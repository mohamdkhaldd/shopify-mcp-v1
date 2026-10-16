const { ipcMain } = require("electron");
const { pushToCloud } = require("./sync");

// Overtime rule (doc section 3), applied identically to السركي and المقاول:
// hourly rate = day_rate / 8, overtime = MAX(0, actual - base) hours,
// day value = day_rate + overtime_hours * hourly_rate. سركي سوق has no
// hours at all — the day value is just whatever fixed amount was entered.
function computeDayValue(log) {
  if (log.is_day_off) return 0;
  if (log.role === "market") return (log.fixed_value ?? 0) - (log.hassan_commission ?? 0);
  if (log.is_paid_leave) return 0;
  const dayRate = log.day_rate ?? 0;
  const baseHours = log.base_hours ?? 0;
  // سعر الساعة بيتحسب من ساعات الأساس المسجلة لليوم ده نفسه، مش رقم ثابت —
  // لو الأساسي 9 ساعات مثلاً، الساعة بتتحسب على أساس 9 مش 8.
  const hourlyRate = dayRate / (baseHours || 8);
  // لو الساعات الفعلية متكتبتش خالص (لسه فاضية)، معناها يوم عادي كامل —
  // نعتبرها زي الساعات الأساسية بالظبط (فرق = صفر)، مش صفر ساعة عمل (اللي
  // كان هيصفّر القيمة بالغلط). فوق ساعات الأساس بيزود، وتحتها بيخصم بنفس
  // النسبة — بس لما الساعات الفعلية تتكتب فعلاً.
  const actualHours = log.actual_hours ?? baseHours;
  const diffHours = actualHours - baseHours;
  // سعر ساعة الأوفر تايم بيتكتب بإيده في الشيت لو فيه أوفر تايم — لو
  // متكتبش بيفضل اليومية ÷ الساعات الأساسية زي الأول. الساعات الناقصة عن
  // الأساسي بتتخصم دايمًا بسعر الساعة العادي.
  if (diffHours > 0 && log.overtime_rate != null) return dayRate + diffHours * log.overtime_rate;
  return dayRate + diffHours * hourlyRate;
}

// مرتب السائق مبني على سعره الثابت المسجل في الإعدادات، مش على أي رقم متكتب
// في شيت السركي (ده بقى بيمثل قد إيه المعدة اشتغلت بيه، رقم مختلف تمامًا).
// بيتطبق على أصحاب الأجر اليومي بس — مفيش أوفر تايم ولا إجازة جمعة تلقائية،
// بيتحسب بس من الأيام المسجلة فعليًا.
function computeDriverWageValue(log, employeeRate) {
  // يوم المعدة مشتغلتش فيه بس اتعلّم "إجازة مدفوعة" للسواق ده — بياخد
  // يوميته الأساسية كاملة (من غير أوفر تايم طبعًا).
  if (log.is_day_off && log.is_paid_leave) return employeeRate;
  if (log.is_paid_leave || log.is_day_off) return 0;
  const baseHours = log.base_hours ?? 0;
  const hourlyRate = employeeRate / (baseHours || 8);
  const overtimeHours = Math.max(0, (log.actual_hours ?? 0) - baseHours);
  return employeeRate + overtimeHours * hourlyRate;
}

// نوع الأجر والسعر بتاع أي موظف في شهر معيّن — بياخد أحدث سطر تاريخ ساري
// وقت الشهر ده (مش أحدث تعديل عالإطلاق)، عشان تعديل المرتب دلوقتي ميغيرش
// حساب شهور فاتت. لو مفيش تاريخ مسجل (حالة نادرة)، بيرجع القيم الحالية.
function getEmployeeStateForMonth(db, employeeId, month) {
  const row = db
    .prepare(
      `SELECT wage_type, rate, fixed_salary FROM employee_rate_history
       WHERE employee_id = ? AND effective_month <= ? ORDER BY effective_month DESC LIMIT 1`
    )
    .get(employeeId, month);
  if (row) return { wage_type: row.wage_type, rate: row.rate, fixed_salary: !!row.fixed_salary };
  const emp = db.prepare("SELECT wage_type, rate, fixed_salary FROM employees WHERE id = ?").get(employeeId);
  return { wage_type: emp.wage_type, rate: emp.rate, fixed_salary: !!emp.fixed_salary };
}

function daysInMonthList(monthKey) {
  const [year, month] = monthKey.split("-").map(Number);
  const daysCount = new Date(year, month, 0).getDate();
  return Array.from({ length: daysCount }, (_, i) => `${monthKey}-${String(i + 1).padStart(2, "0")}`);
}

// موظف بمرتب شهري وله حضور مرتبط بالسركي (سواق شهري مثلًا): مرتبه بيتقسم
// على عدد أيام الشهر، وأي يوم مفيش له حضور (سجل عادي) ولا إجازة مدفوعة
// مُعلّمة بيتخصم من مرتبه — من غير أي استثناء تلقائي ليوم الجمعة، لازم
// المكتب يعلّم بنفسه أي يوم عايز يتحسب مدفوع من غير شغل (سواء جمعة أو أي
// يوم تاني). أما الموظف اللي مرتبه ثابت مهما حصل (زي مكنيكي مش بيتسجل في
// سركي أي معدة أصلًا) فبياخد مرتبه كامل من غير أي حساب حضور.
function monthlyEmployeeGrossPay(db, emp, month) {
  const state = getEmployeeStateForMonth(db, emp.id, month);
  const days = daysInMonthList(month);
  const dailyRate = state.rate / days.length;
  if (state.fixed_salary) {
    return { grossPay: state.rate, deductedDays: 0, dailyRate, logs: [] };
  }
  const logs = db
    .prepare("SELECT * FROM daily_logs WHERE role = 'driver' AND person_name = ? AND date LIKE ?")
    .all(emp.name, `${month}%`);
  const accountedDates = new Set(logs.map((l) => l.date));
  let deductedDays = 0;
  for (const date of days) {
    if (accountedDates.has(date)) continue;
    deductedDays++;
  }
  return { grossPay: state.rate - deductedDays * dailyRate, deductedDays, dailyRate, logs };
}

// عدد أيام الشغل والإجازة لمعدة في فترة (شهر "2026-10" أو سنة "2026") —
// اليوم بيتحسب شغل لو فيه أي سطر (مقاول/سركي/سوق، أي شيفت) مش متعلّم
// "مشتغلش"، وإجازة لو كل سطوره متعلّمة "مشتغلش". الأيام اللي مفيهاش أي سطر
// خالص مش داخلة في الاتنين — عشان تبان لو فيه أيام لسه متسجلتش.
function equipmentDayCounts(db, equipmentId, periodPrefix) {
  const rows = db
    .prepare(
      `SELECT date, MIN(is_day_off) AS all_off FROM daily_logs
       WHERE equipment_id = ? AND date LIKE ? GROUP BY date`
    )
    .all(equipmentId, `${periodPrefix}%`);
  let workDays = 0;
  let offDays = 0;
  for (const r of rows) {
    if (r.all_off) offDays++;
    else workDays++;
  }
  return { workDays, offDays };
}

// بيرجع نص زي "مان لفت 42: 10 أيام، بوكيت: 5 أيام" لموظف اشتغل على أكتر من
// معدة في شهر معيّن — مستخدم في تفاصيل حركة الخزنة عشان يوضّح مرتب/سلفة/
// مكافأة أي سواق جت من شغله على أنهي معدات وقد إيه.
function equipmentDaysNote(db, employeeName, month) {
  const logs = db
    .prepare("SELECT equipment_id FROM daily_logs WHERE role = 'driver' AND person_name = ? AND date LIKE ?")
    .all(employeeName, `${month}%`);
  if (logs.length === 0) return null;
  const daysByEquipment = new Map();
  for (const l of logs) daysByEquipment.set(l.equipment_id, (daysByEquipment.get(l.equipment_id) ?? 0) + 1);
  return [...daysByEquipment.entries()]
    .map(([equipmentId, days]) => {
      const eq = db.prepare("SELECT name FROM equipment WHERE id = ?").get(equipmentId);
      return `${eq?.name ?? "—"}: ${days} يوم`;
    })
    .join("، ");
}

// مرتب السواق بيتحط كمصروف على المعدة يوم بيوم حسب الأيام اللي اشتغلها في
// السركي — حتى لو لسه متدفعلوش حاجة (ده مكانه صفحة المرتبات وبيفضل زي ما
// هو). صاحب الأجر اليومي: يوميته عن كل يوم (مع الأوفر تايم، ويوم الإجازة
// المدفوعة بيوميته الأساسية). صاحب المرتب الشهري: مرتبه ÷ عدد أيام الشهر عن
// كل يوم متسجل باسمه على المعدة. يعني لو اشتغل 10 أيام بـ 400 = 4000 مصروف.
function driverWageForLog(db, log, cache) {
  if (!log.person_name) return 0;
  const key = `${log.person_name}|${log.date.slice(0, 7)}`;
  let info = cache.get(key);
  if (info === undefined) {
    const employee = db.prepare("SELECT id FROM employees WHERE name = ?").get(log.person_name);
    info = employee ? getEmployeeStateForMonth(db, employee.id, log.date.slice(0, 7)) : null;
    if (info && info.wage_type === "monthly") info = { ...info, perDay: info.rate / daysInMonthList(log.date.slice(0, 7)).length };
    cache.set(key, info);
  }
  if (!info) return 0;
  if (info.wage_type === "monthly") return log.is_day_off && !log.is_paid_leave ? 0 : info.perDay;
  return computeDriverWageValue(log, info.rate);
}

function driverSalaryForEquipment(db, equipmentId, month) {
  const logs = month
    ? db
        .prepare("SELECT * FROM daily_logs WHERE equipment_id = ? AND role = 'driver' AND date LIKE ?")
        .all(equipmentId, `${month}%`)
    : db.prepare("SELECT * FROM daily_logs WHERE equipment_id = ? AND role = 'driver'").all(equipmentId);
  const cache = new Map();
  return logs.reduce((sum, l) => sum + driverWageForLog(db, l, cache), 0);
}

// نفس حساب مرتب السائق بس مقسّم بالاسم — لو أكتر من سواق شغلوا على نفس
// المعدة في نفس الشهر (سواق اتغيّر نص الشهر مثلًا)، كل واحد بيظهر في شيت
// المصروفات بمرتبه لوحده بدل رقم واحد مجمّع مالوش اسم.
function driverSalaryBreakdownForEquipment(db, equipmentId, month) {
  const logs = db
    .prepare("SELECT * FROM daily_logs WHERE equipment_id = ? AND role = 'driver' AND date LIKE ?")
    .all(equipmentId, `${month}%`);
  const cache = new Map();
  const byDriver = new Map();
  for (const l of logs) {
    const amount = driverWageForLog(db, l, cache);
    if (amount > 0) byDriver.set(l.person_name, (byDriver.get(l.person_name) ?? 0) + amount);
  }
  return [...byDriver.entries()].map(([name, amount]) => ({ name, amount }));
}

// صافي ربح معدة واحدة في شهر واحد — دخل السركي + السركي سوق ناقص المصروفات
// اليدوية ناقص مرتب السائق. مستخدمة في توزيع أرباح الشركاء بالشهر وبالسنة.
function equipmentMonthNetProfit(db, equipmentId, monthKey) {
  const driverIncome = db
    .prepare("SELECT * FROM daily_logs WHERE equipment_id = ? AND role = 'driver' AND date LIKE ?")
    .all(equipmentId, `${monthKey}%`)
    .reduce((sum, l) => sum + computeDayValue(l), 0);
  const marketIncome = db
    .prepare("SELECT * FROM daily_logs WHERE equipment_id = ? AND role = 'market' AND date LIKE ?")
    .all(equipmentId, `${monthKey}%`)
    .reduce((sum, l) => sum + computeDayValue(l), 0);
  const expense = db
    .prepare("SELECT COALESCE(SUM(amount), 0) AS total FROM monthly_expenses WHERE equipment_id = ? AND month = ?")
    .get(equipmentId, monthKey).total;
  const driverSalaryExpense = driverSalaryForEquipment(db, equipmentId, monthKey);
  return driverIncome + marketIncome - expense - driverSalaryExpense;
}

// تفصيل دخل معدة معينة مقسّم بالشيفت (سركي أساسي / وردية 2 / ...) — عرض بس،
// مالوش أي علاقة بحساب equipmentMonthNetProfit أو نصيب الشريك (المصروفات
// ومرتب السائق بيتخصموا مرة واحدة على مستوى المعدة كلها، مش لكل شيفت لوحده).
function equipmentShiftIncomeBreakdown(db, equipmentId, monthKey) {
  const logs = db
    .prepare("SELECT * FROM daily_logs WHERE equipment_id = ? AND role IN ('driver','market') AND date LIKE ?")
    .all(equipmentId, `${monthKey}%`);
  const byShift = new Map();
  for (const log of logs) {
    const shiftLabel = log.shift_label ?? "";
    byShift.set(shiftLabel, (byShift.get(shiftLabel) ?? 0) + computeDayValue(log));
  }
  return [...byShift.entries()].map(([shift_label, income]) => ({ shift_label, income }));
}

function registerIpcHandlers(db) {
  // --- Partners ---
  ipcMain.handle("partners:list", () => db.prepare("SELECT * FROM partners ORDER BY name").all());
  ipcMain.handle("partners:create", (_e, { name, opening_balance }) => {
    const info = db
      .prepare("INSERT INTO partners (name, opening_balance) VALUES (?, ?)")
      .run(name.trim(), opening_balance ?? 0);
    const created = { id: info.lastInsertRowid, name: name.trim(), opening_balance: opening_balance ?? 0 };
    pushToCloud("partners", created.id, created);
    return created;
  });
  ipcMain.handle("partners:delete", (_e, { id }) => {
    db.prepare("DELETE FROM partners WHERE id = ?").run(id);
    return { ok: true };
  });
  ipcMain.handle("partners:updateOpeningBalance", (_e, { id, opening_balance }) => {
    db.prepare("UPDATE partners SET opening_balance = ? WHERE id = ?").run(opening_balance, id);
    const updated = db.prepare("SELECT * FROM partners WHERE id = ?").get(id);
    pushToCloud("partners", id, { name: updated.name, opening_balance: updated.opening_balance });
    return updated;
  });

  // --- Employees (drivers / salaried workers) ---
  ipcMain.handle("employees:list", () => db.prepare("SELECT * FROM employees ORDER BY name").all());
  ipcMain.handle("employees:create", (_e, { name, wage_type, rate, fixed_salary }) => {
    const trimmedName = name.trim();
    const tx = db.transaction(() => {
      const info = db
        .prepare("INSERT INTO employees (name, wage_type, rate, fixed_salary) VALUES (?, ?, ?, ?)")
        .run(trimmedName, wage_type, rate, fixed_salary ? 1 : 0);
      db.prepare(
        `INSERT INTO employee_rate_history (employee_id, effective_month, wage_type, rate, fixed_salary)
         VALUES (?, '0000-01', ?, ?, ?)`
      ).run(info.lastInsertRowid, wage_type, rate, fixed_salary ? 1 : 0);
      return info.lastInsertRowid;
    });
    const id = tx();
    const created = { id, name: trimmedName, wage_type, rate, fixed_salary: !!fixed_salary };
    pushToCloud("employees", id, created);
    return created;
  });
  ipcMain.handle("employees:delete", (_e, { id }) => {
    db.prepare("DELETE FROM employees WHERE id = ?").run(id);
    return { ok: true };
  });
  // بيسمح بتعديل السائق (زي زيادة مرتبه) من غير ما تحذفه وتضيفه تاني كسائق
  // جديد — لو اسمه اتغيّر، بنحدّث سجلات السركي القديمة اللي باسمه القديم
  // عشان تفضل مربوطة بيه. التعديل بيتسجل كسطر تاريخ جديد ساري من الشهر
  // المُختار (effective_month)، مش تعديل رجعي — الشهور اللي فاتت بتفضل
  // محسوبة بالقيم اللي كانت سارية فيها فعلاً.
  ipcMain.handle("employees:update", (_e, { id, name, wage_type, rate, fixed_salary, effective_month }) => {
    const trimmedName = name.trim();
    const existing = db.prepare("SELECT * FROM employees WHERE id = ?").get(id);
    const month = effective_month || new Date().toISOString().slice(0, 7);
    const tx = db.transaction(() => {
      db.prepare("UPDATE employees SET name = ?, wage_type = ?, rate = ?, fixed_salary = ? WHERE id = ?").run(
        trimmedName,
        wage_type,
        rate,
        fixed_salary ? 1 : 0,
        id
      );
      if (existing && existing.name !== trimmedName) {
        db.prepare("UPDATE daily_logs SET person_name = ? WHERE role = 'driver' AND person_name = ?").run(
          trimmedName,
          existing.name
        );
      }
      db.prepare(
        `INSERT INTO employee_rate_history (employee_id, effective_month, wage_type, rate, fixed_salary)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(employee_id, effective_month) DO UPDATE SET
           wage_type = excluded.wage_type, rate = excluded.rate, fixed_salary = excluded.fixed_salary`
      ).run(id, month, wage_type, rate, fixed_salary ? 1 : 0);
    });
    tx();
    pushToCloud("employees", id, { name: trimmedName, wage_type, rate, fixed_salary: !!fixed_salary, old_name: existing?.name });
    return db.prepare("SELECT * FROM employees WHERE id = ?").get(id);
  });

  // --- Contractors ---
  ipcMain.handle("contractors:list", () => db.prepare("SELECT * FROM contractors ORDER BY name").all());
  ipcMain.handle("contractors:create", (_e, { name, opening_balance }) => {
    const info = db
      .prepare("INSERT INTO contractors (name, opening_balance) VALUES (?, ?)")
      .run(name.trim(), opening_balance ?? 0);
    const created = { id: info.lastInsertRowid, name: name.trim(), opening_balance: opening_balance ?? 0 };
    pushToCloud("contractors", created.id, created);
    return created;
  });
  ipcMain.handle("contractors:delete", (_e, { id }) => {
    db.prepare("DELETE FROM contractors WHERE id = ?").run(id);
    return { ok: true };
  });
  ipcMain.handle("contractors:updateOpeningBalance", (_e, { id, opening_balance }) => {
    db.prepare("UPDATE contractors SET opening_balance = ? WHERE id = ?").run(opening_balance, id);
    const updated = db.prepare("SELECT * FROM contractors WHERE id = ?").get(id);
    pushToCloud("contractors", id, { name: updated.name, opening_balance: updated.opening_balance });
    return updated;
  });

  // --- Expense categories ---
  ipcMain.handle("expenseCategories:list", () =>
    db.prepare("SELECT * FROM expense_categories ORDER BY name").all()
  );
  ipcMain.handle("expenseCategories:create", (_e, { name, counts_as_commission }) => {
    const info = db
      .prepare("INSERT INTO expense_categories (name, counts_as_commission) VALUES (?, ?)")
      .run(name.trim(), counts_as_commission ? 1 : 0);
    const created = { id: info.lastInsertRowid, name: name.trim(), counts_as_commission: !!counts_as_commission };
    pushToCloud("expense_categories", created.id, created);
    return created;
  });
  // بيسمح تحدد نوع مصروف زي "مكنيكي" أو "سكن" إن قيمته على كل معدة تتحسب
  // تلقائيًا ضمن كوميشن حسن — مفيش داعي تسجلها مرتين.
  ipcMain.handle("expenseCategories:update", (_e, { id, name, counts_as_commission }) => {
    const existing = db.prepare("SELECT * FROM expense_categories WHERE id = ?").get(id);
    const trimmedName = name.trim();
    db.prepare("UPDATE expense_categories SET name = ?, counts_as_commission = ? WHERE id = ?").run(
      trimmedName,
      counts_as_commission ? 1 : 0,
      id
    );
    pushToCloud("expense_categories", id, { name: trimmedName, counts_as_commission: !!counts_as_commission, old_name: existing?.name });
    return db.prepare("SELECT * FROM expense_categories WHERE id = ?").get(id);
  });
  ipcMain.handle("expenseCategories:delete", (_e, { id }) => {
    db.prepare("DELETE FROM expense_categories WHERE id = ?").run(id);
    return { ok: true };
  });

  // --- Equipment (+ partner shares) ---
  // كل معدة بتحمل سعر شرائها، وبنحسب لها "رجعت كام في الميه من سعرها" من
  // صافي ربحها من أول ما بدأت (equipmentAllTimeProfit) — زي جدول الإكسيل
  // القديم اللي كان بيوضح إيه اللي اتشرا بكام وإيه اللي رجّع فلوسه.
  const getEquipmentWithShares = () => {
    const rows = db.prepare("SELECT * FROM equipment ORDER BY name").all();
    const shareStmt = db.prepare(
      "SELECT partner_id, percentage FROM equipment_partner_shares WHERE equipment_id = ?"
    );
    return rows.map((row) => {
      const allTimeProfit = equipmentAllTimeProfit(row.id);
      const roiPercent = row.purchase_price > 0 ? (allTimeProfit / row.purchase_price) * 100 : null;
      return { ...row, shares: shareStmt.all(row.id), allTimeProfit, roiPercent };
    });
  };

  ipcMain.handle("equipment:list", () => getEquipmentWithShares());

  ipcMain.handle("equipment:create", (_e, { name, purchase_price, shares }) => {
    const insertEquipment = db.prepare("INSERT INTO equipment (name, purchase_price) VALUES (?, ?)");
    const insertShare = db.prepare(
      "INSERT INTO equipment_partner_shares (equipment_id, partner_id, percentage) VALUES (?, ?, ?)"
    );
    const tx = db.transaction(() => {
      const info = insertEquipment.run(name.trim(), purchase_price ?? 0);
      const equipmentId = info.lastInsertRowid;
      for (const share of shares ?? []) {
        insertShare.run(equipmentId, share.partner_id, share.percentage);
      }
      return equipmentId;
    });
    const equipmentId = tx();
    const created = getEquipmentWithShares().find((e) => e.id === equipmentId);
    const partnerNameStmt = db.prepare("SELECT name FROM partners WHERE id = ?");
    pushToCloud("equipment", equipmentId, {
      name: created.name,
      purchase_price: created.purchase_price,
      shares: created.shares.map((s) => ({ partner_name: partnerNameStmt.get(s.partner_id)?.name ?? "", percentage: s.percentage })),
    });
    return created;
  });

  // بيسمح بتعديل سعر الشراء ونسب الشركاء من غير ما تحذف المعدة وتضيفها تاني
  // — شريك بيخرج وشريك جديد بيدخل مكانه، أو الباقيين بيشتروا حصته، من غير ما
  // يضيع تاريخ المعدة (السركي والمصروفات وكل حاجة بتفضل مربوطة بيها).
  ipcMain.handle("equipment:update", (_e, { id, purchase_price, shares }) => {
    const updateEquipment = db.prepare("UPDATE equipment SET purchase_price = ? WHERE id = ?");
    const deleteShares = db.prepare("DELETE FROM equipment_partner_shares WHERE equipment_id = ?");
    const insertShare = db.prepare(
      "INSERT INTO equipment_partner_shares (equipment_id, partner_id, percentage) VALUES (?, ?, ?)"
    );
    const tx = db.transaction(() => {
      updateEquipment.run(purchase_price ?? 0, id);
      deleteShares.run(id);
      for (const share of shares ?? []) {
        insertShare.run(id, share.partner_id, share.percentage);
      }
    });
    tx();
    const equipmentRow = db.prepare("SELECT * FROM equipment WHERE id = ?").get(id);
    const shareNames = (shares ?? []).map((s) => ({
      partner_name: db.prepare("SELECT name FROM partners WHERE id = ?").get(s.partner_id)?.name,
      percentage: s.percentage,
    }));
    pushToCloud("equipment", id, { name: equipmentRow.name, purchase_price: equipmentRow.purchase_price, shares: shareNames });
    return getEquipmentWithShares().find((e) => e.id === id);
  });

  ipcMain.handle("equipment:delete", (_e, { id }) => {
    db.prepare("DELETE FROM equipment WHERE id = ?").run(id);
    return { ok: true };
  });

  // --- Daily logs (السركي / المقاول / سركي سوق — same table, different role) ---
  ipcMain.handle("dailyLogs:list", (_e, { equipment_id, month, role, shift_label }) => {
    const rows = db
      .prepare(
        "SELECT * FROM daily_logs WHERE equipment_id = ? AND role = ? AND shift_label = ? AND date LIKE ? ORDER BY date"
      )
      .all(equipment_id, role, shift_label ?? "", `${month}%`);
    return rows.map((row) => ({ ...row, day_value: computeDayValue(row) }));
  });

  const OTHER_HOURS_ROLE = { driver: "contractor", contractor: "driver" };

  const UPSERT_DAILY_LOG_SQL = `INSERT INTO daily_logs (equipment_id, date, role, shift_label, person_name, actual_hours, base_hours, day_rate, is_paid_leave, is_day_off, fixed_value, hassan_commission, note, site_name, overtime_rate)
       VALUES (@equipment_id, @date, @role, @shift_label, @person_name, @actual_hours, @base_hours, @day_rate, @is_paid_leave, @is_day_off, @fixed_value, @hassan_commission, @note, @site_name, @overtime_rate)
       ON CONFLICT(equipment_id, date, role, shift_label) DO UPDATE SET
         person_name = excluded.person_name,
         actual_hours = excluded.actual_hours,
         base_hours = excluded.base_hours,
         day_rate = excluded.day_rate,
         is_paid_leave = excluded.is_paid_leave,
         is_day_off = excluded.is_day_off,
         fixed_value = excluded.fixed_value,
         hassan_commission = excluded.hassan_commission,
         note = excluded.note,
         site_name = excluded.site_name,
         overtime_rate = excluded.overtime_rate`;

  function findDailyLog(db, equipmentId, date, role, shiftLabel) {
    return db
      .prepare("SELECT * FROM daily_logs WHERE equipment_id = ? AND date = ? AND role = ? AND shift_label = ?")
      .get(equipmentId, date, role, shiftLabel ?? "");
  }

  // شيت المقاول هو المصدر الوحيد للأيام: الساعات/الأساسية/البيان/الموقع/علامة
  // "مشتغلش" بتتكتب فيه وبتتنسخ لشيت السركي لنفس المعدة واليوم والشيفت — مش
  // العكس. اسم السواق وسعر اليوم في السركي بيفضلوا زي ما هما، إلا في يوم
  // "مشتغلش": السعر بيتمسح، وعلامة "مدفوعة" (بتتحدد من شيت السركي نفسه)
  // بتبدأ مش مدفوعة واسم السواق بيتمسح — ولو اليوم كان متعلّم مشتغلش من قبل،
  // اختيار "مدفوعة" والسواق اللي في السركي بيفضلوا زي ما هما.
  // إجازة السائق الشهري المدفوعة في يوم شغل عادي (خاصة بمرتبه) مبتتلمسش.
  function mirrorContractorToDriver(db, contractorLog) {
    const shiftLabel = contractorLog.shift_label ?? "";
    const existing = findDailyLog(db, contractorLog.equipment_id, contractorLog.date, "driver", shiftLabel);
    const isDayOff = !!contractorLog.is_day_off;
    const isPaidDayOff = isDayOff && !!existing?.is_day_off && !!existing?.is_paid_leave;
    db.prepare(UPSERT_DAILY_LOG_SQL).run({
      equipment_id: contractorLog.equipment_id,
      date: contractorLog.date,
      role: "driver",
      shift_label: shiftLabel,
      person_name: isDayOff && !isPaidDayOff ? "" : existing?.person_name ?? "",
      actual_hours: contractorLog.actual_hours ?? null,
      base_hours: contractorLog.base_hours ?? null,
      day_rate: isDayOff ? null : existing?.day_rate ?? null,
      // خارج أيام "مشتغلش" العلامة دي معناها إجازة شهرية مدفوعة للسواق نفسه —
      // بتفضل زي ما هي، إلا لو كانت جاية من يوم "مشتغلش" مدفوع اتشال.
      is_paid_leave: isDayOff ? (isPaidDayOff ? 1 : 0) : existing?.is_day_off ? 0 : existing?.is_paid_leave ?? 0,
      is_day_off: isDayOff ? 1 : 0,
      fixed_value: existing?.fixed_value ?? null,
      hassan_commission: existing?.hassan_commission ?? null,
      note: contractorLog.note ?? null,
      site_name: contractorLog.site_name ?? null,
      overtime_rate: isDayOff ? null : existing?.overtime_rate ?? null,
    });
  }

  // One row per equipment/date/role/shift_label — matches the spreadsheet's
  // "one line per day of the month" layout, so saving a day's cells
  // overwrites that day's row instead of appending a new one.
  ipcMain.handle("dailyLogs:upsert", (_e, log) => {
    const shiftLabel = log.shift_label ?? "";
    const params = {
      equipment_id: log.equipment_id,
      date: log.date,
      role: log.role,
      shift_label: shiftLabel,
      person_name: log.person_name ?? "",
      actual_hours: log.actual_hours ?? null,
      base_hours: log.base_hours ?? null,
      day_rate: log.day_rate ?? null,
      is_paid_leave: log.is_paid_leave ? 1 : 0,
      is_day_off: log.is_day_off ? 1 : 0,
      fixed_value: log.fixed_value ?? null,
      hassan_commission: log.hassan_commission ?? null,
      note: log.note ?? null,
      site_name: log.site_name?.trim() || null,
      overtime_rate: log.overtime_rate ?? null,
    };
    // صف السركي مبيقدرش يغيّر الحاجات المشتركة مع المقاول — لو فيه صف مقاول
    // لنفس اليوم، الساعات/البيان/الموقع/علامة "مشتغلش" بتتاخد منه هو.
    if (log.role === "driver") {
      const master = findDailyLog(db, log.equipment_id, log.date, "contractor", shiftLabel);
      if (master) {
        params.actual_hours = master.actual_hours;
        params.base_hours = master.base_hours;
        params.note = master.note;
        params.site_name = master.site_name;
        params.is_day_off = master.is_day_off ? 1 : 0;
      }
    }
    // "مدفوعة" معناها بس في شيت السركي (مين السواق اللي هياخد اليوم).
    if (log.role === "contractor") params.is_paid_leave = 0;
    if (params.is_day_off) {
      params.day_rate = null;
      params.overtime_rate = null;
      params.actual_hours = null;
      params.base_hours = null;
      if (!params.is_paid_leave) params.person_name = "";
    }
    db.prepare(UPSERT_DAILY_LOG_SQL).run(params);
    if (log.role === "contractor") mirrorContractorToDriver(db, params);
    const row = findDailyLog(db, log.equipment_id, log.date, log.role, shiftLabel);
    const equipmentName = db.prepare("SELECT name FROM equipment WHERE id = ?").get(log.equipment_id)?.name;
    if (equipmentName) {
      pushToCloud("daily_logs", row.id, { ...row, equipment_name: equipmentName });
      if (log.role === "contractor") {
        const counterpart = findDailyLog(db, log.equipment_id, log.date, "driver", shiftLabel);
        if (counterpart) pushToCloud("daily_logs", counterpart.id, { ...counterpart, equipment_name: equipmentName });
      }
    }
    return { ...row, day_value: computeDayValue(row) };
  });

  ipcMain.handle("dailyLogs:delete", (_e, { id }) => {
    const log = db.prepare("SELECT * FROM daily_logs WHERE id = ?").get(id);
    db.prepare("DELETE FROM daily_logs WHERE id = ?").run(id);
    // يوم اتمسح من شيت المقاول (المصدر) بيتمسح من السركي بردو، بشرط يبقوا في
    // نفس الشيفت. مسح يوم من السركي مبيلمسش المقاول.
    if (log && log.role === "contractor") {
      db.prepare("DELETE FROM daily_logs WHERE equipment_id = ? AND date = ? AND role = 'driver' AND shift_label = ?").run(
        log.equipment_id,
        log.date,
        log.shift_label ?? ""
      );
    }
    return { ok: true };
  });

  // أيام اتسجلت في شيت واحد بس (مقاول متكتب فيه الاسم والسعر والسركي فاضي،
  // أو العكس) — بتتعلّم في صفحة المعدات بالأحمر عشان متتنسيش. أيام "مشتغلش"
  // مش داخلة. بيرجع لكل معدة: الشهور اللي فيها نقص وعدد الأيام في كل شهر.
  ipcMain.handle("equipment:sheetMismatches", () => {
    const filled = (alias) =>
      `${alias}.is_day_off = 0 AND ${alias}.person_name != '' AND COALESCE(${alias}.day_rate, 0) > 0`;
    const rows = db
      .prepare(
        `SELECT a.equipment_id, substr(a.date, 1, 7) AS month, a.date
         FROM daily_logs a
         LEFT JOIN daily_logs b ON b.equipment_id = a.equipment_id AND b.date = a.date
           AND b.shift_label = a.shift_label AND b.role = CASE a.role WHEN 'contractor' THEN 'driver' ELSE 'contractor' END
         WHERE a.role IN ('contractor', 'driver') AND ${filled("a")}
           AND (b.id IS NULL OR NOT (${filled("b")}))`
      )
      .all();
    const byEquipment = new Map();
    for (const r of rows) {
      if (!byEquipment.has(r.equipment_id)) byEquipment.set(r.equipment_id, new Map());
      const months = byEquipment.get(r.equipment_id);
      if (!months.has(r.month)) months.set(r.month, new Set());
      months.get(r.month).add(r.date);
    }
    return [...byEquipment.entries()].map(([equipment_id, months]) => ({
      equipment_id,
      months: [...months.entries()].sort().map(([month, dates]) => ({ month, days: dates.size })),
    }));
  });

  // --- Equipment shifts (وردية إضافية زي "وردية 2" لمعدة اشتغلت بأكتر من
  // شيفت في نفس اليوم) — الشيفت الأساسي (shift_label = '') ضمني ومالوش سطر
  // هنا، دي بس للشيفتات الإضافية اللي المستخدم بيسميها بنفسه. ---
  ipcMain.handle("equipmentShifts:list", (_e, { equipment_id }) =>
    db.prepare("SELECT * FROM equipment_shifts WHERE equipment_id = ? ORDER BY id").all(equipment_id)
  );
  ipcMain.handle("equipmentShifts:create", (_e, { equipment_id, label }) => {
    const trimmed = (label ?? "").trim();
    if (!trimmed) throw new Error("لازم اسم للشيفت");
    const info = db
      .prepare("INSERT INTO equipment_shifts (equipment_id, label, created_at) VALUES (?, ?, ?)")
      .run(equipment_id, trimmed, new Date().toISOString());
    const created = { id: info.lastInsertRowid, equipment_id, label: trimmed };
    const equipmentName = db.prepare("SELECT name FROM equipment WHERE id = ?").get(equipment_id)?.name;
    if (equipmentName) pushToCloud("equipment_shifts", created.id, { ...created, equipment_name: equipmentName });
    return created;
  });

  // معدة جديدة غالبًا هتشتغل بنفس ساعات ودوام معدة قديمة (نفس مواعيد الورديات
  // والأوفر تايم) — بننسخ الساعات/الأساسية/الأوفر تايم/علامة "مشتغلش"/البيان
  // بس من شيت المقاول بتاع المعدة المصدر لنفس الشهر، وبيتزامنوا لشيت السركي
  // تلقائيًا زي أي تعديل عادي. الاسم وسعر اليوم (في السركي والمقاول) بيفضلوا
  // زي ما هما عند المعدة الهدف من غير ما نلمسهم — لازم يتحددوا يدويًا بعد
  // النسخ لأن السواق/المقاول وسعره مختلفين عن المعدة التانية.
  ipcMain.handle(
    "dailyLogs:copyFromEquipment",
    (_e, { target_equipment_id, source_equipment_id, month, source_shift_label, target_shift_label }) => {
      const sourceShift = source_shift_label ?? "";
      const targetShift = target_shift_label ?? "";
      const sourceLogs = db
        .prepare("SELECT * FROM daily_logs WHERE equipment_id = ? AND role = 'contractor' AND shift_label = ? AND date LIKE ?")
        .all(source_equipment_id, sourceShift, `${month}%`);
      const copy = db.transaction((logs) => {
        for (const src of logs) {
          const existing = findDailyLog(db, target_equipment_id, src.date, "contractor", targetShift);
          const params = {
            equipment_id: target_equipment_id,
            date: src.date,
            role: "contractor",
            shift_label: targetShift,
            person_name: src.is_day_off ? "" : existing?.person_name ?? "",
            actual_hours: src.actual_hours,
            base_hours: src.base_hours,
            day_rate: src.is_day_off ? null : existing?.day_rate ?? null,
            is_paid_leave: 0,
            is_day_off: src.is_day_off ? 1 : 0,
            fixed_value: existing?.fixed_value ?? null,
            hassan_commission: existing?.hassan_commission ?? null,
            note: src.note,
            site_name: existing?.site_name ?? null,
            overtime_rate: src.is_day_off ? null : existing?.overtime_rate ?? null,
          };
          db.prepare(UPSERT_DAILY_LOG_SQL).run(params);
          mirrorContractorToDriver(db, params);
        }
      });
      copy(sourceLogs);
      return { count: sourceLogs.length };
    }
  );

  // --- Monthly expenses ---
  ipcMain.handle("monthlyExpenses:list", (_e, { equipment_id, month }) =>
    db
      .prepare(
        `SELECT me.*, ec.name AS category_name,
                COALESCE(me.paid_amount, me.amount) + COALESCE((SELECT SUM(amount) FROM expense_payments WHERE expense_id = me.id), 0) AS paid_total
         FROM monthly_expenses me
         LEFT JOIN expense_categories ec ON ec.id = me.category_id
         WHERE me.equipment_id = ? AND me.month = ? ORDER BY me.date, me.id`
      )
      .all(equipment_id, month)
      .map((me) => ({ ...me, remaining: Math.max(0, me.amount - me.paid_total) }))
  );

  ipcMain.handle("monthlyExpenses:create", (_e, expense) => {
    const info = db
      .prepare(
        `INSERT INTO monthly_expenses (equipment_id, month, date, category_id, amount, payment_method, note, receipt_image, paid_amount, payee)
         VALUES (@equipment_id, @month, @date, @category_id, @amount, @payment_method, @note, @receipt_image, @paid_amount, @payee)`
      )
      .run({
        ...expense,
        date: expense.date ?? null,
        note: expense.note ?? null,
        receipt_image: expense.receipt_image ?? null,
        // اتدفع كله = NULL (زي القديم)، غير كده بيتسجل اللي اتدفع والباقي آجل.
        paid_amount:
          expense.paid_amount == null || Number(expense.paid_amount) >= Number(expense.amount)
            ? null
            : Math.max(0, Number(expense.paid_amount) || 0),
        payee: expense.payee?.trim() || null,
      });
    const created = db
      .prepare(
        `SELECT me.*, ec.name AS category_name FROM monthly_expenses me
         LEFT JOIN expense_categories ec ON ec.id = me.category_id WHERE me.id = ?`
      )
      .get(info.lastInsertRowid);
    const equipmentName = db.prepare("SELECT name FROM equipment WHERE id = ?").get(expense.equipment_id)?.name;
    if (equipmentName) pushToCloud("monthly_expenses", created.id, { ...created, equipment_name: equipmentName });
    return created;
  });

  ipcMain.handle("monthlyExpenses:delete", (_e, { id }) => {
    db.prepare("DELETE FROM monthly_expenses WHERE id = ?").run(id);
    return { ok: true };
  });

  // --- Profit summary + partner distribution for one equipment/month ---
  ipcMain.handle("equipment:summary", (_e, { equipment_id, month }) => {
    const driverLogs = db
      .prepare("SELECT * FROM daily_logs WHERE equipment_id = ? AND role = 'driver' AND date LIKE ?")
      .all(equipment_id, `${month}%`);
    const marketLogs = db
      .prepare("SELECT * FROM daily_logs WHERE equipment_id = ? AND role = 'market' AND date LIKE ?")
      .all(equipment_id, `${month}%`);
    const expenses = db
      .prepare("SELECT * FROM monthly_expenses WHERE equipment_id = ? AND month = ?")
      .all(equipment_id, month);

    const driverIncome = driverLogs.reduce((sum, l) => sum + computeDayValue(l), 0);
    const marketIncome = marketLogs.reduce((sum, l) => sum + computeDayValue(l), 0);
    const income = driverIncome + marketIncome;
    const driverSalaryBreakdown = driverSalaryBreakdownForEquipment(db, equipment_id, month);
    const driverSalaryExpense = driverSalaryBreakdown.reduce((sum, d) => sum + d.amount, 0);
    const manualExpenseTotal = expenses.reduce((sum, e) => sum + e.amount, 0);
    const expenseTotal = manualExpenseTotal + driverSalaryExpense;
    const netProfit = income - expenseTotal;

    const shares = db
      .prepare(
        `SELECT eps.percentage, p.id AS partner_id, p.name AS partner_name
         FROM equipment_partner_shares eps JOIN partners p ON p.id = eps.partner_id
         WHERE eps.equipment_id = ?`
      )
      .all(equipment_id);

    const distribution = shares.map((s) => ({
      partner_id: s.partner_id,
      partner_name: s.partner_name,
      percentage: s.percentage,
      amount: (netProfit * s.percentage) / 100,
    }));

    return {
      driverIncome,
      marketIncome,
      income,
      driverSalaryExpense,
      driverSalaryBreakdown,
      manualExpenseTotal,
      expenseTotal,
      netProfit,
      distribution,
    };
  });

  // --- Employee advances (سلف) — month = شهر المرتب اللي السلفة دي بتتخصم
  // منه (زي ما هو المشاهد وقت التسجيل)، date = تاريخ صرفها الحقيقي. ---
  ipcMain.handle("employeeAdvances:list", (_e, { employee_id, month }) =>
    db.prepare("SELECT * FROM employee_advances WHERE employee_id = ? AND month = ? ORDER BY date").all(employee_id, month)
  );
  ipcMain.handle("employeeAdvances:create", (_e, advance) => {
    const info = db
      .prepare(
        `INSERT INTO employee_advances (employee_id, month, date, amount, payment_method, note)
         VALUES (@employee_id, @month, @date, @amount, @payment_method, @note)`
      )
      .run({ ...advance, payment_method: advance.payment_method || "cash", note: advance.note ?? null });
    const created = db.prepare("SELECT * FROM employee_advances WHERE id = ?").get(info.lastInsertRowid);
    const employeeName = db.prepare("SELECT name FROM employees WHERE id = ?").get(advance.employee_id)?.name;
    if (employeeName) pushToCloud("payroll_entries", `advance-${created.id}`, { ...created, kind: "advance", employee_name: employeeName });
    return created;
  });
  ipcMain.handle("employeeAdvances:delete", (_e, { id }) => {
    db.prepare("DELETE FROM employee_advances WHERE id = ?").run(id);
    return { ok: true };
  });

  // --- Employee bonuses (حافز) — an amount added on top of the payroll, with
  // a note explaining what it's for. Applies to daily and monthly wages alike.
  // month = شهر المرتب اللي المكافأة دي بتتضاف عليه، date = تاريخها الحقيقي. ---
  ipcMain.handle("employeeBonuses:list", (_e, { employee_id, month }) =>
    db.prepare("SELECT * FROM employee_bonuses WHERE employee_id = ? AND month = ? ORDER BY date").all(employee_id, month)
  );
  ipcMain.handle("employeeBonuses:create", (_e, bonus) => {
    const info = db
      .prepare(
        `INSERT INTO employee_bonuses (employee_id, month, date, amount, payment_method, note)
         VALUES (@employee_id, @month, @date, @amount, @payment_method, @note)`
      )
      .run({ ...bonus, payment_method: bonus.payment_method || "cash", note: bonus.note ?? null });
    const created = db.prepare("SELECT * FROM employee_bonuses WHERE id = ?").get(info.lastInsertRowid);
    const employeeName = db.prepare("SELECT name FROM employees WHERE id = ?").get(bonus.employee_id)?.name;
    if (employeeName) pushToCloud("payroll_entries", `bonus-${created.id}`, { ...created, kind: "bonus", employee_name: employeeName });
    return created;
  });
  ipcMain.handle("employeeBonuses:delete", (_e, { id }) => {
    db.prepare("DELETE FROM employee_bonuses WHERE id = ?").run(id);
    return { ok: true };
  });

  // --- Employee deductions (خصم) — سبب إجباري + قيمة، بتقلل صافي المرتب
  // المستحق زي السلفة بالظبط، لكن من غير ما فلوس تتحرك فعليًا (عكس السلفة
  // اللي هي فلوس اتدفعت للموظف) — فمالهاش أي أثر في الصادر ولا الخزنة ولا
  // مصروف المعدة، وبس بتقلل "الباقي" في شيت المرتب. ---
  ipcMain.handle("employeeDeductions:list", (_e, { employee_id, month }) =>
    db.prepare("SELECT * FROM employee_deductions WHERE employee_id = ? AND month = ? ORDER BY date").all(employee_id, month)
  );
  ipcMain.handle("employeeDeductions:create", (_e, deduction) => {
    const info = db
      .prepare(
        `INSERT INTO employee_deductions (employee_id, month, date, amount, reason)
         VALUES (@employee_id, @month, @date, @amount, @reason)`
      )
      .run(deduction);
    const created = db.prepare("SELECT * FROM employee_deductions WHERE id = ?").get(info.lastInsertRowid);
    const employeeName = db.prepare("SELECT name FROM employees WHERE id = ?").get(deduction.employee_id)?.name;
    if (employeeName) pushToCloud("payroll_entries", `deduction-${created.id}`, { ...created, kind: "deduction", employee_name: employeeName });
    return created;
  });
  ipcMain.handle("employeeDeductions:delete", (_e, { id }) => {
    db.prepare("DELETE FROM employee_deductions WHERE id = ?").run(id);
    return { ok: true };
  });

  // --- Payroll summary (doc section 5): daily wage = sum of driver day-values
  // across every equipment this month; monthly wage = prorated fixed rate.
  // Advances are deducted and bonuses are added for either type. ---
  ipcMain.handle("payroll:summary", (_e, { month }) => {
    const employees = db.prepare("SELECT * FROM employees ORDER BY name").all();
    const driverLogsStmt = db.prepare(
      "SELECT * FROM daily_logs WHERE role = 'driver' AND person_name = ? AND date LIKE ?"
    );
    // بالشهر (مش تاريخ الصرف الحقيقي) — لو اتأخرت لشهر بعده (زي سلفة/مكافأة/
    // دفعة مرتب يونيو اتسجلت في يوليو)، تفضل محسوبة على يونيو، الشهر اللي
    // بتخصه فعلاً وقت التسجيل من شيت الرواتب.
    const advancesStmt = db.prepare(
      "SELECT COALESCE(SUM(amount), 0) AS total FROM employee_advances WHERE employee_id = ? AND month = ?"
    );
    const bonusesStmt = db.prepare(
      "SELECT COALESCE(SUM(amount), 0) AS total FROM employee_bonuses WHERE employee_id = ? AND month = ?"
    );
    const deductionsStmt = db.prepare(
      "SELECT COALESCE(SUM(amount), 0) AS total FROM employee_deductions WHERE employee_id = ? AND month = ?"
    );
    const paidStmt = db.prepare(
      "SELECT COALESCE(SUM(amount), 0) AS total FROM salary_payments WHERE employee_id = ? AND month = ?"
    );

    return employees.map((emp) => {
      const advancesTotal = advancesStmt.get(emp.id, month).total;
      const bonusesTotal = bonusesStmt.get(emp.id, month).total;
      const deductionsTotal = deductionsStmt.get(emp.id, month).total;
      const paidTotal = paidStmt.get(emp.id, month).total;
      const state = getEmployeeStateForMonth(db, emp.id, month);
      if (state.wage_type === "monthly") {
        const { grossPay } = monthlyEmployeeGrossPay(db, emp, month);
        const netPay = grossPay - advancesTotal - deductionsTotal;
        return {
          id: emp.id,
          name: emp.name,
          wage_type: state.wage_type,
          rate: state.rate,
          fixed_salary: state.fixed_salary,
          days_worked: null,
          gross_pay: grossPay,
          advances_total: advancesTotal,
          bonuses_total: bonusesTotal,
          deductions_total: deductionsTotal,
          net_pay: netPay,
          paid_total: paidTotal,
          taken_total: advancesTotal + bonusesTotal + paidTotal,
          remaining: netPay - paidTotal,
        };
      }
      const logs = driverLogsStmt.all(emp.name, `${month}%`);
      const grossPay = logs.reduce((sum, l) => sum + computeDriverWageValue(l, state.rate), 0);
      const netPay = grossPay - advancesTotal - deductionsTotal;
      return {
        id: emp.id,
        name: emp.name,
        wage_type: state.wage_type,
        rate: state.rate,
        fixed_salary: state.fixed_salary,
        days_worked: logs.length,
        gross_pay: grossPay,
        advances_total: advancesTotal,
        bonuses_total: bonusesTotal,
        deductions_total: deductionsTotal,
        net_pay: netPay,
        paid_total: paidTotal,
        taken_total: advancesTotal + bonusesTotal + paidTotal,
        remaining: netPay - paidTotal,
      };
    });
  });

  // --- Payroll detail: the per-driver "payslip" — every day worked this
  // month, which equipment, and what it paid, plus advances and bonuses.
  // This is what gets screenshotted and sent to the driver. Monthly wages
  // show a plain days×equipment breakdown too (no "full salary minus
  // deduction" framing) — a day marked as paid leave shows under whatever
  // equipment it was logged on, same as a normal work day, since the office
  // marks it explicitly rather than the sheet guessing or labeling it. ---
  ipcMain.handle("payroll:detail", (_e, { employee_id, month }) => {
    const employee = db.prepare("SELECT * FROM employees WHERE id = ?").get(employee_id);
    const advances = db
      .prepare("SELECT * FROM employee_advances WHERE employee_id = ? AND month = ? ORDER BY date")
      .all(employee_id, month);
    const advancesTotal = advances.reduce((sum, a) => sum + a.amount, 0);
    const bonuses = db
      .prepare("SELECT * FROM employee_bonuses WHERE employee_id = ? AND month = ? ORDER BY date")
      .all(employee_id, month);
    const bonusesTotal = bonuses.reduce((sum, b) => sum + b.amount, 0);
    const deductions = db
      .prepare("SELECT * FROM employee_deductions WHERE employee_id = ? AND month = ? ORDER BY date")
      .all(employee_id, month);
    const deductionsTotal = deductions.reduce((sum, d) => sum + d.amount, 0);
    const payments = db
      .prepare("SELECT * FROM salary_payments WHERE employee_id = ? AND month = ? ORDER BY date")
      .all(employee_id, month);
    const paidTotal = payments.reduce((sum, p) => sum + p.amount, 0);
    const state = getEmployeeStateForMonth(db, employee_id, month);

    if (state.wage_type === "monthly") {
      const { grossPay, dailyRate } = monthlyEmployeeGrossPay(db, employee, month);
      let days = [];
      if (!state.fixed_salary) {
        const logsWithEquipment = db
          .prepare(
            `SELECT dl.*, e.name AS equipment_name FROM daily_logs dl
             JOIN equipment e ON e.id = dl.equipment_id
             WHERE dl.role = 'driver' AND dl.person_name = ? AND dl.date LIKE ?
             ORDER BY dl.date`
          )
          .all(employee.name, `${month}%`);
        days = logsWithEquipment.map((l) => ({
          date: l.date,
          equipment_name: l.equipment_name,
          actual_hours: l.actual_hours,
          base_hours: l.base_hours,
          day_rate: null,
          day_value: dailyRate,
        }));
      }
      const netPay = grossPay - advancesTotal - deductionsTotal;
      return {
        employee,
        days,
        advances,
        bonuses,
        deductions,
        payments,
        grossPay,
        advancesTotal,
        bonusesTotal,
        deductionsTotal,
        paidTotal,
        takenTotal: advancesTotal + bonusesTotal + paidTotal,
        netPay,
        remaining: netPay - paidTotal,
      };
    }

    const logs = db
      .prepare(
        `SELECT dl.*, e.name AS equipment_name FROM daily_logs dl
         JOIN equipment e ON e.id = dl.equipment_id
         WHERE dl.role = 'driver' AND dl.person_name = ? AND dl.date LIKE ?
         ORDER BY dl.date`
      )
      .all(employee.name, `${month}%`);
    const days = logs.map((l) => ({
      date: l.date,
      equipment_name: l.equipment_name,
      actual_hours: l.actual_hours,
      base_hours: l.base_hours,
      day_rate: state.rate,
      day_value: computeDriverWageValue(l, state.rate),
    }));
    const grossPay = days.reduce((sum, d) => sum + d.day_value, 0);
    const netPay = grossPay - advancesTotal - deductionsTotal;

    return {
      employee,
      days,
      advances,
      bonuses,
      deductions,
      payments,
      grossPay,
      advancesTotal,
      bonusesTotal,
      deductionsTotal,
      paidTotal,
      takenTotal: advancesTotal + bonusesTotal + paidTotal,
      netPay,
      remaining: netPay - paidTotal,
    };
  });

  // --- دفع المرتب النهائي: تسجيل إن مبلغ من المرتب اتدفع فعلاً للموظف، بتاريخه
  // وطريقة دفعه — نفس فكرة دفعات الشركاء والمقاولين، لأن صافي المرتب المحسوب
  // شهريًا يفضل "مستحق" لحد ما يتسجل له دفعة فعلية زي دي. ---
  ipcMain.handle("salaryPayments:list", (_e, { employee_id, month }) =>
    db.prepare("SELECT * FROM salary_payments WHERE employee_id = ? AND month = ? ORDER BY date").all(employee_id, month)
  );
  ipcMain.handle("salaryPayments:create", (_e, payment) => {
    const info = db
      .prepare(
        `INSERT INTO salary_payments (employee_id, month, date, amount, payment_method, note) VALUES (@employee_id, @month, @date, @amount, @payment_method, @note)`
      )
      .run({
        employee_id: payment.employee_id,
        month: payment.month,
        date: payment.date,
        amount: payment.amount,
        payment_method: payment.payment_method || "cash",
        note: payment.note ?? null,
      });
    const created = db.prepare("SELECT * FROM salary_payments WHERE id = ?").get(info.lastInsertRowid);
    const employeeName = db.prepare("SELECT name FROM employees WHERE id = ?").get(payment.employee_id)?.name;
    if (employeeName) pushToCloud("salary_payments", created.id, { ...created, employee_name: employeeName });
    return created;
  });
  ipcMain.handle("salaryPayments:delete", (_e, { id }) => {
    db.prepare("DELETE FROM salary_payments WHERE id = ?").run(id);
    return { ok: true };
  });

  // --- Hassan: commission (doc section 4) ---
  // كل المعدات بنفس المنطق: كوميشن حسن = (سعر المقاول - سعر السركي) +
  // ساعات أوفر تايم × الفرق بينهم بالساعة، متزاوجين بنفس التاريخ. سركي
  // السوق مالوش معادلة — أي رقم كوميشن اتكتب في الصف ده بالظبط.
  function computePairedCommission(_equipmentName, driverLog, contractorLog) {
    // لو أي شيت من الاتنين متعلّم إنه "مشتغلش"، مفيش كوميشن خالص — من غير
    // الشرط ده لو يوم واحد اتعلّم مشتغلش في شيت وسعره لسه متسجل غلط في
    // الشيت التاني، الكوميشن كان بيطلع سعر المقاول كامل من غير خصم السركي.
    if (driverLog.is_day_off || contractorLog.is_day_off) return 0;
    const k = contractorLog.day_rate ?? 0;
    const h = driverLog.day_rate ?? 0;
    const baseHours = contractorLog.base_hours || 8;
    const overtimeHours = Math.max(0, (contractorLog.actual_hours ?? 0) - (contractorLog.base_hours ?? 0));
    const kHour = contractorLog.overtime_rate ?? k / baseHours;
    const hHour = driverLog.overtime_rate ?? h / baseHours;
    return (k - h) + overtimeHours * (kHour - hHour);
  }

  // بيربط سطر السركي بسطر المقاول لنفس اليوم — لازم يبقى بالتاريخ والشيفت
  // مع بعض (مش بالتاريخ بس)، وإلا معدة شغالة بورديتين هيتلخبط سطر وردية
  // بسطر وردية تانية لنفس اليوم.
  function pairKey(log) {
    return `${log.date}|${log.shift_label ?? ""}`;
  }

  // كوميشن حسن كله — لو month اتبعت بيتفلتر عليه بس، لو من غيره (null) بيحسب
  // كل الوقت من أول ما اتسجلت أي بيانات — مستخدمة في شيت الكوميشن الشهري
  // وفي رصيد "خزنة حسن" الكلي.
  function computeCommissionRows(month) {
    const equipmentList = db.prepare("SELECT * FROM equipment ORDER BY name").all();
    const rows = [];

    for (const equipment of equipmentList) {
      const driverLogs = month
        ? db.prepare("SELECT * FROM daily_logs WHERE equipment_id = ? AND role = 'driver' AND date LIKE ?").all(equipment.id, `${month}%`)
        : db.prepare("SELECT * FROM daily_logs WHERE equipment_id = ? AND role = 'driver'").all(equipment.id);
      const contractorLogs = month
        ? db.prepare("SELECT * FROM daily_logs WHERE equipment_id = ? AND role = 'contractor' AND date LIKE ?").all(equipment.id, `${month}%`)
        : db.prepare("SELECT * FROM daily_logs WHERE equipment_id = ? AND role = 'contractor'").all(equipment.id);
      const marketLogs = month
        ? db
            .prepare("SELECT * FROM daily_logs WHERE equipment_id = ? AND role = 'market' AND date LIKE ? AND hassan_commission IS NOT NULL")
            .all(equipment.id, `${month}%`)
        : db
            .prepare("SELECT * FROM daily_logs WHERE equipment_id = ? AND role = 'market' AND hassan_commission IS NOT NULL")
            .all(equipment.id);
      // مصروفات زي المكنيكي والسكن — أي نوع مصروف اتحدد إنه يحسب في الكوميشن
      // (من الإعدادات)، قيمته على المعدة دي بتضاف كاملة لكوميشن حسن.
      const commissionExpenses = month
        ? db
            .prepare(
              `SELECT me.*, ec.name AS category_name FROM monthly_expenses me
               JOIN expense_categories ec ON ec.id = me.category_id
               WHERE me.equipment_id = ? AND me.month = ? AND ec.counts_as_commission = 1`
            )
            .all(equipment.id, month)
        : db
            .prepare(
              `SELECT me.*, ec.name AS category_name FROM monthly_expenses me
               JOIN expense_categories ec ON ec.id = me.category_id
               WHERE me.equipment_id = ? AND ec.counts_as_commission = 1`
            )
            .all(equipment.id);

      const driverByKey = new Map(driverLogs.map((l) => [pairKey(l), l]));
      for (const contractorLog of contractorLogs) {
        const driverLog = driverByKey.get(pairKey(contractorLog));
        if (!driverLog) continue;
        rows.push({
          equipment_id: equipment.id,
          equipment_name: equipment.name,
          date: contractorLog.date,
          shift_label: contractorLog.shift_label ?? "",
          source: "paired",
          commission: computePairedCommission(equipment.name, driverLog, contractorLog),
        });
      }
      for (const marketLog of marketLogs) {
        rows.push({
          equipment_id: equipment.id,
          equipment_name: equipment.name,
          date: marketLog.date,
          source: "market",
          commission: marketLog.hassan_commission ?? 0,
        });
      }
      for (const expense of commissionExpenses) {
        rows.push({
          equipment_id: equipment.id,
          equipment_name: equipment.name,
          date: expense.date ?? `${(month ?? expense.month)}-01`,
          source: "expense",
          category_name: expense.category_name,
          commission: expense.amount,
        });
      }
    }

    rows.sort((a, b) => a.date.localeCompare(b.date));
    const total = rows.reduce((sum, r) => sum + r.commission, 0);
    return { rows, total };
  }

  ipcMain.handle("hassan:commissionSummary", (_e, { month }) => computeCommissionRows(month));

  // --- خزنة حسن: كوميشنه المتراكم من أول ما اتسجلت أي بيانات، ناقص أي فلوس
  // دفعها هو من الخزنة دي (زي قسط أو إيجار) — رصيد شخصي بحت، مالوش أي علاقة
  // بخزنة الشركة (الكاش/المحفظة/انستا باي) خالص. ---
  // --- جزاءات حسن: بتتخصم من كوميشنه ومن رصيد خزنته. ---
  ipcMain.handle("hassanPenalties:list", (_e, { month }) =>
    db.prepare("SELECT * FROM hassan_penalties WHERE date LIKE ? ORDER BY date DESC, id DESC").all(`${month}%`)
  );
  ipcMain.handle("hassanPenalties:create", (_e, { date, amount, reason }) => {
    const info = db
      .prepare("INSERT INTO hassan_penalties (date, amount, reason) VALUES (?, ?, ?)")
      .run(date, amount, reason?.trim() || null);
    return db.prepare("SELECT * FROM hassan_penalties WHERE id = ?").get(info.lastInsertRowid);
  });
  ipcMain.handle("hassanPenalties:delete", (_e, { id }) => {
    db.prepare("DELETE FROM hassan_penalties WHERE id = ?").run(id);
    return { ok: true };
  });

  // --- مرتبات عمال حسن: نفس فكرة شيت المرتبات بس الفلوس طالعة من خزنة حسن. ---
  ipcMain.handle("hassanWorkers:list", () =>
    db.prepare("SELECT * FROM hassan_workers WHERE active = 1 ORDER BY name").all()
  );
  ipcMain.handle("hassanWorkers:create", (_e, { name, job, monthly_salary, start_month }) => {
    const trimmed = (name ?? "").trim();
    if (!trimmed) throw new Error("لازم اسم العامل");
    const info = db
      .prepare("INSERT INTO hassan_workers (name, job, monthly_salary, start_month) VALUES (?, ?, ?, ?)")
      .run(trimmed, job?.trim() || null, Number(monthly_salary) || 0, start_month);
    return db.prepare("SELECT * FROM hassan_workers WHERE id = ?").get(info.lastInsertRowid);
  });
  ipcMain.handle("hassanWorkers:update", (_e, { id, name, job, monthly_salary }) => {
    db.prepare("UPDATE hassan_workers SET name = ?, job = ?, monthly_salary = ? WHERE id = ?").run(
      (name ?? "").trim(),
      job?.trim() || null,
      Number(monthly_salary) || 0,
      id
    );
    return db.prepare("SELECT * FROM hassan_workers WHERE id = ?").get(id);
  });
  // بيشيل العامل من القائمة من الشهر ده ورايح — حركاته القديمة (وفلوسه اللي
  // اتصرفت من خزنة حسن) بتفضل زي ما هي.
  ipcMain.handle("hassanWorkers:delete", (_e, { id }) => {
    db.prepare("UPDATE hassan_workers SET active = 0 WHERE id = ?").run(id);
    return { ok: true };
  });

  ipcMain.handle("hassanWorkerEntries:list", (_e, { month }) =>
    db
      .prepare(
        `SELECT we.*, w.name AS worker_name FROM hassan_worker_entries we
         JOIN hassan_workers w ON w.id = we.worker_id
         WHERE we.month = ? ORDER BY we.date DESC, we.id DESC`
      )
      .all(month)
  );

  const WORKER_ENTRY_LABEL = { payment: "مرتب", advance: "سلفة" };
  ipcMain.handle("hassanWorkerEntries:create", (_e, { worker_id, month, date, type, amount, note }) => {
    const worker = db.prepare("SELECT * FROM hassan_workers WHERE id = ?").get(worker_id);
    if (!worker) throw new Error("العامل مش موجود");
    const tx = db.transaction(() => {
      let treasuryExpenseId = null;
      // الدفعة والسلفة فلوس طالعة فعلاً — بتتسجل في خزنة حسن باسم العامل
      // عشان تبان هناك "اتصرف منها مرتب فلان".
      if (type === "payment" || type === "advance") {
        const description = `${WORKER_ENTRY_LABEL[type]} ${worker.name}${worker.job ? ` (${worker.job})` : ""} — شهر ${month}${
          note?.trim() ? ` — ${note.trim()}` : ""
        }`;
        const info = db
          .prepare("INSERT INTO hassan_treasury_expenses (date, amount, description) VALUES (?, ?, ?)")
          .run(date, amount, description);
        treasuryExpenseId = info.lastInsertRowid;
        const created = db.prepare("SELECT * FROM hassan_treasury_expenses WHERE id = ?").get(treasuryExpenseId);
        pushToCloud("hassan_treasury_expenses", created.id, created);
      }
      const info = db
        .prepare(
          `INSERT INTO hassan_worker_entries (worker_id, month, date, type, amount, note, treasury_expense_id)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .run(worker_id, month, date, type, amount, note?.trim() || null, treasuryExpenseId);
      return info.lastInsertRowid;
    });
    const id = tx();
    return db.prepare("SELECT * FROM hassan_worker_entries WHERE id = ?").get(id);
  });
  ipcMain.handle("hassanWorkerEntries:delete", (_e, { id }) => {
    const entry = db.prepare("SELECT * FROM hassan_worker_entries WHERE id = ?").get(id);
    const tx = db.transaction(() => {
      if (entry?.treasury_expense_id) {
        db.prepare("DELETE FROM hassan_treasury_expenses WHERE id = ?").run(entry.treasury_expense_id);
      }
      db.prepare("DELETE FROM hassan_worker_entries WHERE id = ?").run(id);
    });
    tx();
    return { ok: true };
  });

  // شيت مرتبات عمال حسن لشهر: كل عامل شغال من الشهر ده أو قبله (أو عنده
  // حركات في الشهر ده حتى لو اتشال) — المرتب + الحوافز − الخصومات = المستحق،
  // والمصروف = دفعات المرتب + السلف، والباقي = المستحق − المصروف.
  ipcMain.handle("hassanWorkers:payroll", (_e, { month }) => {
    const workers = db
      .prepare(
        `SELECT * FROM hassan_workers w
         WHERE (w.active = 1 AND w.start_month <= ?)
            OR EXISTS (SELECT 1 FROM hassan_worker_entries e WHERE e.worker_id = w.id AND e.month = ?)
         ORDER BY w.name`
      )
      .all(month, month);
    const sumStmt = db.prepare(
      "SELECT COALESCE(SUM(amount), 0) AS total FROM hassan_worker_entries WHERE worker_id = ? AND month = ? AND type = ?"
    );
    const rows = workers.map((w) => {
      const payments = sumStmt.get(w.id, month, "payment").total;
      const advances = sumStmt.get(w.id, month, "advance").total;
      const bonuses = sumStmt.get(w.id, month, "bonus").total;
      const deductions = sumStmt.get(w.id, month, "deduction").total;
      const salary = w.active || w.start_month <= month ? w.monthly_salary : 0;
      const net = salary + bonuses - deductions;
      const paid = payments + advances;
      return {
        worker_id: w.id,
        name: w.name,
        job: w.job,
        active: !!w.active,
        monthly_salary: salary,
        bonuses,
        deductions,
        net,
        payments,
        advances,
        paid,
        remaining: net - paid,
      };
    });
    const total = (key) => rows.reduce((sum, r) => sum + r[key], 0);
    return {
      month,
      rows,
      totalNet: total("net"),
      totalPaid: total("paid"),
      totalRemaining: total("remaining"),
    };
  });

  ipcMain.handle("hassan:treasuryBalance", (_e, { month }) => {
    const allTimePenalties = db.prepare("SELECT COALESCE(SUM(amount), 0) AS total FROM hassan_penalties").get().total;
    const monthPenalties = db
      .prepare("SELECT COALESCE(SUM(amount), 0) AS total FROM hassan_penalties WHERE date LIKE ?")
      .get(`${month}%`).total;
    // الكوميشن هنا صافي بعد الجزاءات — ده اللي فعلاً بيدخل خزنة حسن.
    const allTimeCommission = computeCommissionRows(null).total - allTimePenalties;
    const monthCommission = computeCommissionRows(month).total - monthPenalties;
    const allTimeSpent = db.prepare("SELECT COALESCE(SUM(amount), 0) AS total FROM hassan_treasury_expenses").get().total;
    const monthSpent = db
      .prepare("SELECT COALESCE(SUM(amount), 0) AS total FROM hassan_treasury_expenses WHERE date LIKE ?")
      .get(`${month}%`).total;
    return {
      balance: allTimeCommission - allTimeSpent,
      allTimeCommission,
      allTimeSpent,
      monthCommission,
      monthSpent,
      monthPenalties,
      allTimePenalties,
    };
  });

  ipcMain.handle("hassanTreasury:list", (_e, { month }) =>
    db.prepare("SELECT * FROM hassan_treasury_expenses WHERE date LIKE ? ORDER BY date DESC").all(`${month}%`)
  );
  ipcMain.handle("hassanTreasury:create", (_e, expense) => {
    const info = db
      .prepare("INSERT INTO hassan_treasury_expenses (date, amount, description) VALUES (@date, @amount, @description)")
      .run(expense);
    const created = db.prepare("SELECT * FROM hassan_treasury_expenses WHERE id = ?").get(info.lastInsertRowid);
    pushToCloud("hassan_treasury_expenses", created.id, created);
    return created;
  });
  ipcMain.handle("hassanTreasury:delete", (_e, { id }) => {
    // لو السطر ده جاي من شيت مرتبات العمال، بتتمسح الحركة هناك كمان عشان
    // الشيتين ميختلفوش.
    db.prepare("DELETE FROM hassan_worker_entries WHERE treasury_expense_id = ?").run(id);
    db.prepare("DELETE FROM hassan_treasury_expenses WHERE id = ?").run(id);
    return { ok: true };
  });

  // --- Hassan: per-equipment commission sheet — every day this equipment had
  // a paired سركي/مقاول or a سركي سوق commission, what the مقاول/السركي
  // charged that day, and Hassan's cut — plus this equipment's totals for
  // the selected month and for the whole year. ---
  ipcMain.handle("hassan:equipmentCommission", (_e, { equipment_id, month }) => {
    const equipment = db.prepare("SELECT * FROM equipment WHERE id = ?").get(equipment_id);
    const year = month.split("-")[0];

    const driverLogs = db
      .prepare("SELECT * FROM daily_logs WHERE equipment_id = ? AND role = 'driver' AND date LIKE ?")
      .all(equipment_id, `${year}-%`);
    const contractorLogs = db
      .prepare("SELECT * FROM daily_logs WHERE equipment_id = ? AND role = 'contractor' AND date LIKE ?")
      .all(equipment_id, `${year}-%`);
    const marketLogs = db
      .prepare(
        "SELECT * FROM daily_logs WHERE equipment_id = ? AND role = 'market' AND date LIKE ? AND hassan_commission IS NOT NULL"
      )
      .all(equipment_id, `${year}-%`);
    const commissionExpenses = db
      .prepare(
        `SELECT me.*, ec.name AS category_name FROM monthly_expenses me
         JOIN expense_categories ec ON ec.id = me.category_id
         WHERE me.equipment_id = ? AND me.month LIKE ? AND ec.counts_as_commission = 1`
      )
      .all(equipment_id, `${year}-%`);

    const driverByKey = new Map(driverLogs.map((l) => [pairKey(l), l]));
    const allRows = [];
    for (const contractorLog of contractorLogs) {
      const driverLog = driverByKey.get(pairKey(contractorLog));
      if (!driverLog) continue;
      allRows.push({
        date: contractorLog.date,
        shift_label: contractorLog.shift_label ?? "",
        source: "paired",
        contractor_rate: contractorLog.day_rate ?? 0,
        driver_rate: driverLog.day_rate ?? 0,
        commission: computePairedCommission(equipment.name, driverLog, contractorLog),
      });
    }
    for (const marketLog of marketLogs) {
      allRows.push({
        date: marketLog.date,
        source: "market",
        contractor_rate: marketLog.fixed_value ?? 0,
        driver_rate: null,
        commission: marketLog.hassan_commission ?? 0,
      });
    }
    for (const expense of commissionExpenses) {
      allRows.push({
        date: expense.date ?? `${expense.month}-01`,
        source: "expense",
        category_name: expense.category_name,
        contractor_rate: null,
        driver_rate: null,
        commission: expense.amount,
      });
    }
    allRows.sort((a, b) => a.date.localeCompare(b.date));

    const days = allRows.filter((r) => r.date.startsWith(month));
    const monthTotal = days.reduce((sum, r) => sum + r.commission, 0);
    const yearTotal = allRows.reduce((sum, r) => sum + r.commission, 0);

    return { equipment_id, equipment_name: equipment.name, days, monthTotal, yearTotal };
  });

  // --- Hassan: personal ledger (doc section 7) — separate from commission ---
  ipcMain.handle("hassanLedger:list", (_e, { month }) =>
    db.prepare("SELECT * FROM hassan_ledger WHERE date LIKE ? ORDER BY date DESC").all(`${month}%`)
  );
  ipcMain.handle("hassanLedger:create", (_e, entry) => {
    const info = db
      .prepare(
        `INSERT INTO hassan_ledger (date, type, amount, party_name, description, note)
         VALUES (@date, @type, @amount, @party_name, @description, @note)`
      )
      .run({
        date: entry.date,
        type: entry.type,
        amount: entry.amount,
        party_name: entry.party_name ?? null,
        description: entry.description ?? null,
        note: entry.note ?? null,
      });
    const created = db.prepare("SELECT * FROM hassan_ledger WHERE id = ?").get(info.lastInsertRowid);
    pushToCloud("hassan_ledger", created.id, created);
    return created;
  });
  ipcMain.handle("hassanLedger:delete", (_e, { id }) => {
    db.prepare("DELETE FROM hassan_ledger WHERE id = ?").run(id);
    return { ok: true };
  });
  ipcMain.handle("hassanLedger:balance", () => {
    const sums = db
      .prepare("SELECT type, COALESCE(SUM(amount), 0) AS total FROM hassan_ledger GROUP BY type")
      .all();
    const byType = Object.fromEntries(sums.map((s) => [s.type, s.total]));
    const netDebt = (byType.loan ?? 0) - (byType.repayment ?? 0);
    const netDue = (byType.due ?? 0) - (byType.collection ?? 0);
    return { netDebt, netDue };
  });

  // Per-party breakdown: doc asks "who does Hassan owe, how much is left,
  // who owes Hassan, how much is left" by name, not just one lump total.
  ipcMain.handle("hassanLedger:balanceByParty", () => {
    const rows = db.prepare("SELECT * FROM hassan_ledger").all();
    const byParty = new Map();
    for (const row of rows) {
      const party = row.party_name?.trim() || "بدون تحديد";
      if (!byParty.has(party)) {
        byParty.set(party, { party_name: party, loan: 0, repayment: 0, due: 0, collection: 0 });
      }
      byParty.get(party)[row.type] += row.amount;
    }
    return [...byParty.values()]
      .map((p) => ({
        party_name: p.party_name,
        netDebt: p.loan - p.repayment,
        netDue: p.due - p.collection,
      }))
      .filter((p) => p.netDebt !== 0 || p.netDue !== 0)
      .sort((a, b) => a.party_name.localeCompare(b.party_name));
  });

  // --- Contractor payments ---
  ipcMain.handle("contractorPayments:list", (_e, { contractor_id }) =>
    db.prepare("SELECT * FROM contractor_payments WHERE contractor_id = ? ORDER BY date DESC").all(contractor_id)
  );
  ipcMain.handle("contractorPayments:create", (_e, payment) => {
    const info = db
      .prepare(
        `INSERT INTO contractor_payments (contractor_id, date, amount, method, note)
         VALUES (@contractor_id, @date, @amount, @method, @note)`
      )
      .run({ ...payment, method: payment.method || "cash", note: payment.note ?? null });
    const created = db.prepare("SELECT * FROM contractor_payments WHERE id = ?").get(info.lastInsertRowid);
    const contractor = db.prepare("SELECT name FROM contractors WHERE id = ?").get(payment.contractor_id);
    if (contractor) pushToCloud("contractor_payments", created.id, { contractor_name: contractor.name, ...created });
    return created;
  });
  ipcMain.handle("contractorPayments:delete", (_e, { id }) => {
    db.prepare("DELETE FROM contractor_payments WHERE id = ?").run(id);
    return { ok: true };
  });

  // Contractors dashboard (doc section 6): total work value is computed
  // automatically from every المقاول daily-log entry across all equipment
  // (all time, not just one month — this is a running balance), minus what
  // has actually been paid out.
  ipcMain.handle("contractors:summary", () => {
    const contractors = db.prepare("SELECT * FROM contractors ORDER BY name").all();
    const workStmt = db.prepare("SELECT * FROM daily_logs WHERE role = 'contractor' AND person_name = ?");
    const paidStmt = db.prepare(
      "SELECT COALESCE(SUM(amount), 0) AS total FROM contractor_payments WHERE contractor_id = ?"
    );
    return contractors.map((c) => {
      const totalWork = c.opening_balance + workStmt.all(c.name).reduce((sum, l) => sum + computeDayValue(l), 0);
      const totalPaid = paidStmt.get(c.id).total;
      return {
        id: c.id,
        name: c.name,
        opening_balance: c.opening_balance,
        totalWork,
        totalPaid,
        remaining: totalWork - totalPaid,
      };
    });
  });

  ipcMain.handle("contractors:detail", (_e, { contractor_id }) => {
    const contractor = db.prepare("SELECT * FROM contractors WHERE id = ?").get(contractor_id);
    const logs = db
      .prepare(
        `SELECT dl.*, e.name AS equipment_name FROM daily_logs dl
         JOIN equipment e ON e.id = dl.equipment_id
         WHERE dl.role = 'contractor' AND dl.person_name = ?
         ORDER BY dl.date`
      )
      .all(contractor.name);

    const byEquipment = new Map();
    for (const log of logs) {
      const value = computeDayValue(log);
      const entry = byEquipment.get(log.equipment_name) ?? { equipment_name: log.equipment_name, days: 0, totalValue: 0 };
      entry.days += 1;
      entry.totalValue += value;
      byEquipment.set(log.equipment_name, entry);
    }

    const payments = db
      .prepare("SELECT * FROM contractor_payments WHERE contractor_id = ? ORDER BY date DESC")
      .all(contractor_id);

    const totalWork = contractor.opening_balance + logs.reduce((sum, l) => sum + computeDayValue(l), 0);
    const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);

    return {
      contractor,
      workByEquipment: [...byEquipment.values()],
      payments,
      totalWork,
      totalPaid,
      remaining: totalWork - totalPaid,
    };
  });

  // --- Partner payments ---
  ipcMain.handle("partnerPayments:list", (_e, { partner_id }) =>
    db.prepare("SELECT * FROM partner_payments WHERE partner_id = ? ORDER BY date DESC").all(partner_id)
  );
  ipcMain.handle("partnerPayments:create", (_e, payment) => {
    const info = db
      .prepare(
        `INSERT INTO partner_payments (partner_id, date, amount, method, note)
         VALUES (@partner_id, @date, @amount, @method, @note)`
      )
      .run({ ...payment, method: payment.method || "cash", note: payment.note ?? null });
    const created = db.prepare("SELECT * FROM partner_payments WHERE id = ?").get(info.lastInsertRowid);
    const partner = db.prepare("SELECT name FROM partners WHERE id = ?").get(payment.partner_id);
    if (partner) pushToCloud("partner_payments", created.id, { partner_name: partner.name, ...created });
    return created;
  });
  ipcMain.handle("partnerPayments:delete", (_e, { id }) => {
    db.prepare("DELETE FROM partner_payments WHERE id = ?").run(id);
    return { ok: true };
  });

  // Partners dashboard (doc section 8): total due is each partner's share %
  // applied to every equipment's all-time net profit (income - expenses),
  // summed across every equipment they hold a share in — a running balance,
  // same idea as the contractors' remaining balance.
  function equipmentAllTimeProfit(equipmentId) {
    const income = db
      .prepare("SELECT * FROM daily_logs WHERE equipment_id = ? AND role IN ('driver', 'market')")
      .all(equipmentId)
      .reduce((sum, l) => sum + computeDayValue(l), 0);
    const expense = db
      .prepare("SELECT COALESCE(SUM(amount), 0) AS total FROM monthly_expenses WHERE equipment_id = ?")
      .get(equipmentId).total;
    const driverSalaryExpense = driverSalaryForEquipment(db, equipmentId, null);
    return income - expense - driverSalaryExpense;
  }

  ipcMain.handle("partners:summary", () => {
    const partners = db.prepare("SELECT * FROM partners ORDER BY name").all();
    const sharesStmt = db.prepare(
      `SELECT eps.equipment_id, eps.percentage, e.name AS equipment_name
       FROM equipment_partner_shares eps JOIN equipment e ON e.id = eps.equipment_id
       WHERE eps.partner_id = ?`
    );
    const paidStmt = db.prepare(
      "SELECT COALESCE(SUM(amount), 0) AS total FROM partner_payments WHERE partner_id = ?"
    );

    return partners.map((p) => {
      const shares = sharesStmt.all(p.id);
      const totalDue =
        p.opening_balance +
        shares.reduce((sum, s) => sum + (equipmentAllTimeProfit(s.equipment_id) * s.percentage) / 100, 0);
      const totalPaid = paidStmt.get(p.id).total;
      return {
        id: p.id,
        name: p.name,
        opening_balance: p.opening_balance,
        totalDue,
        totalPaid,
        remaining: totalDue - totalPaid,
      };
    });
  });

  ipcMain.handle("partners:detail", (_e, { partner_id, month }) => {
    const partner = db.prepare("SELECT * FROM partners WHERE id = ?").get(partner_id);
    const shares = db
      .prepare(
        `SELECT eps.equipment_id, eps.percentage, e.name AS equipment_name
         FROM equipment_partner_shares eps JOIN equipment e ON e.id = eps.equipment_id
         WHERE eps.partner_id = ?`
      )
      .all(partner_id);

    const equipmentBreakdown = shares.map((s) => {
      const netProfit = equipmentMonthNetProfit(db, s.equipment_id, month);
      const shiftIncome = equipmentShiftIncomeBreakdown(db, s.equipment_id, month);
      return {
        equipment_name: s.equipment_name,
        percentage: s.percentage,
        monthAmount: (netProfit * s.percentage) / 100,
        // عرض بس — الدخل مقسّم بالشيفت لو المعدة اشتغلت بأكتر من وردية،
        // مش داخل في حساب monthAmount نفسه (شوف equipmentShiftIncomeBreakdown).
        shiftIncome,
      };
    });
    const monthDue = equipmentBreakdown.reduce((sum, e) => sum + e.monthAmount, 0);

    // نصيب الشريك من كل معدة على مدار السنة كلها (الشهور اللي فاتت لحد دلوقتي
    // بتديه رقم، والشهور اللي لسه ماجاش وقتها بتدي صفر تلقائيًا لعدم وجود بيانات)
    // — كل سنة بتتحسب لوحدها حسب السنة المختارة في المنتقي.
    const year = month.split("-")[0];
    const yearlyEquipmentBreakdown = shares.map((s) => {
      let yearNetProfit = 0;
      for (let m = 1; m <= 12; m++) {
        yearNetProfit += equipmentMonthNetProfit(db, s.equipment_id, `${year}-${String(m).padStart(2, "0")}`);
      }
      return {
        equipment_name: s.equipment_name,
        percentage: s.percentage,
        yearAmount: (yearNetProfit * s.percentage) / 100,
      };
    });
    const yearDue = yearlyEquipmentBreakdown.reduce((sum, e) => sum + e.yearAmount, 0);

    const totalDue =
      partner.opening_balance +
      shares.reduce((sum, s) => sum + (equipmentAllTimeProfit(s.equipment_id) * s.percentage) / 100, 0);
    const payments = db
      .prepare("SELECT * FROM partner_payments WHERE partner_id = ? ORDER BY date DESC")
      .all(partner_id);
    const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);

    return {
      partner,
      monthDue,
      equipmentBreakdown,
      year,
      yearDue,
      yearlyEquipmentBreakdown,
      totalDue,
      totalPaid,
      remaining: totalDue - totalPaid,
      payments,
    };
  });

  // --- Treasury: الكاش الحقيقي ---
  // كل حساب (كاش/انستا باي/...) رصيده = رصيد البداية + كل حركة فلوس حقيقية
  // من تاريخ البداية — زي كشف حساب البنك بالظبط. الحركة بتتحسب بتاريخ
  // الدفع الفعلي، والمصروف بيدخل باللي اتدفع منه بس (الباقي في الآجل لحد ما
  // يتدفع). مرتب السواق المحسوب على المعدة باليوم مش هنا — هنا بس اللي
  // اتدفعله فعلًا (سلف/مكافآت/دفعات مرتب).
  const ACCOUNT_NAME_AR = { wallet: "اكسيس باي", instapay: "انستا باي", cash: "كاش", vodafone_cash: "فودفون كاش" };

  function cashMovements(account) {
    const rows = [];
    const add = (date, direction, label, amount, extra = {}) => {
      if (amount) rows.push({ date, direction, label, amount, ...extra });
    };

    db.prepare(
      `SELECT me.id, COALESCE(me.date, me.month || '-01') AS date, COALESCE(me.paid_amount, me.amount) AS paid,
              me.payee, e.name AS equipment_name, ec.name AS category_name
       FROM monthly_expenses me
       JOIN equipment e ON e.id = me.equipment_id
       LEFT JOIN expense_categories ec ON ec.id = me.category_id
       WHERE me.payment_method = ?`
    )
      .all(account)
      .forEach((r) =>
        add(r.date, "out", `مصروف ${r.category_name ?? "بدون نوع"} — ${r.equipment_name}${r.payee ? ` — ${r.payee}` : ""}`, r.paid)
      );

    db.prepare(
      `SELECT ep.date, ep.amount, me.payee, e.name AS equipment_name, ec.name AS category_name
       FROM expense_payments ep
       JOIN monthly_expenses me ON me.id = ep.expense_id
       JOIN equipment e ON e.id = me.equipment_id
       LEFT JOIN expense_categories ec ON ec.id = me.category_id
       WHERE ep.method = ?`
    )
      .all(account)
      .forEach((r) =>
        add(r.date, "out", `دفعة آجل: ${r.category_name ?? "مصروف"} — ${r.equipment_name}${r.payee ? ` — ${r.payee}` : ""}`, r.amount)
      );

    const employeeMoney = (table, label) =>
      db
        .prepare(
          `SELECT t.date, t.month, t.amount, e.name AS employee_name FROM ${table} t
           JOIN employees e ON e.id = t.employee_id WHERE t.payment_method = ?`
        )
        .all(account)
        .forEach((r) => {
          const note = equipmentDaysNote(db, r.employee_name, r.month ?? r.date.slice(0, 7));
          add(r.date, "out", `${label}: ${r.employee_name}${note ? ` (${note})` : ""}`, r.amount);
        });
    employeeMoney("employee_advances", "سلفة");
    employeeMoney("employee_bonuses", "مكافأة");
    employeeMoney("salary_payments", "دفعة مرتب");

    db.prepare(
      `SELECT pp.date, pp.amount, p.name AS partner_name FROM partner_payments pp
       JOIN partners p ON p.id = pp.partner_id WHERE pp.method = ?`
    )
      .all(account)
      .forEach((r) => add(r.date, "out", `دفعة للشريك: ${r.partner_name}`, r.amount));

    db.prepare(
      `SELECT sp.date, sp.amount, s.name AS supplier_name FROM supplier_payments sp
       JOIN suppliers s ON s.id = sp.supplier_id WHERE sp.method = ?`
    )
      .all(account)
      .forEach((r) => add(r.date, "out", `دفعة للمورد: ${r.supplier_name}`, r.amount));

    db.prepare(
      `SELECT ce.date, ce.amount, ce.note, c.name AS creditor_name FROM creditor_entries ce
       JOIN creditors c ON c.id = ce.creditor_id WHERE ce.type = 'payment' AND ce.method = ?`
    )
      .all(account)
      .forEach((r) => add(r.date, "out", `سداد لـ ${r.creditor_name}${r.note ? ` (${r.note})` : ""}`, r.amount));

    db.prepare("SELECT date, amount, note FROM waste_entries WHERE payment_method = ?")
      .all(account)
      .forEach((r) => add(r.date, "out", `هالك${r.note ? `: ${r.note}` : ""}`, r.amount));

    db.prepare(
      `SELECT cp.date, cp.amount, c.name AS contractor_name FROM contractor_payments cp
       JOIN contractors c ON c.id = cp.contractor_id WHERE cp.method = ?`
    )
      .all(account)
      .forEach((r) => add(r.date, "in", `دفعة من المقاول: ${r.contractor_name}`, r.amount));

    db.prepare("SELECT * FROM other_income WHERE method = ?")
      .all(account)
      .forEach((r) => add(r.date, "in", `إيراد آخر${r.description ? `: ${r.description}` : ""}`, r.amount, { other_income_id: r.id }));

    db.prepare("SELECT * FROM treasury_transfers WHERE from_account = ? OR to_account = ?")
      .all(account, account)
      .forEach((r) => {
        const out = r.from_account === account;
        const other = ACCOUNT_NAME_AR[out ? r.to_account : r.from_account] ?? "";
        add(r.date, out ? "out" : "in", `تحويل ${out ? "إلى" : "من"} ${other}${r.note ? ` — ${r.note}` : ""}`, r.amount, {
          transfer_id: r.id,
        });
      });

    db.prepare("SELECT * FROM treasury_adjustments WHERE account = ?")
      .all(account)
      .forEach((r) =>
        add(r.date, r.amount >= 0 ? "in" : "out", `تسوية جرد (${r.amount >= 0 ? "زيادة" : "عجز"})${r.note ? `: ${r.note}` : ""}`, Math.abs(r.amount), {
          adjustment_id: r.id,
        })
      );

    rows.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    return rows;
  }

  // الرصيد المحسوب لحساب لحد تاريخ معيّن (شامل) — البداية + حركته من تاريخ البداية.
  function accountBalance(acc, untilDate) {
    const from = acc.opening_date ?? "";
    return cashMovements(acc.name)
      .filter((m) => m.date >= from && (!untilDate || m.date <= untilDate))
      .reduce((sum, m) => sum + (m.direction === "in" ? m.amount : -m.amount), acc.opening_balance ?? 0);
  }

  function todayISO() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  ipcMain.handle("treasury:list", () => {
    const rows = db.prepare("SELECT * FROM treasury_accounts ORDER BY CASE name WHEN 'wallet' THEN 1 WHEN 'instapay' THEN 2 WHEN 'cash' THEN 3 WHEN 'vodafone_cash' THEN 4 ELSE 5 END, id").all();
    return rows.map((r) => ({ ...r, name_ar: ACCOUNT_NAME_AR[r.name] ?? r.name }));
  });

  ipcMain.handle("treasury:setOpening", (_e, { id, opening_balance, opening_date }) => {
    db.prepare("UPDATE treasury_accounts SET opening_balance = ?, opening_date = ? WHERE id = ?").run(
      Number(opening_balance) || 0,
      opening_date || null,
      id
    );
    return { ok: true };
  });

  ipcMain.handle("treasury:summary", (_e, { month }) => {
    const accounts = db.prepare("SELECT * FROM treasury_accounts ORDER BY CASE name WHEN 'wallet' THEN 1 WHEN 'instapay' THEN 2 WHEN 'cash' THEN 3 WHEN 'vodafone_cash' THEN 4 ELSE 5 END, id").all();
    return accounts.map((acc) => {
      const movements = cashMovements(acc.name);
      const from = acc.opening_date ?? "";
      const inMonth = movements.filter((m) => m.date.startsWith(month));
      const monthIncoming = inMonth.filter((m) => m.direction === "in").reduce((s, m) => s + m.amount, 0);
      const monthOutgoing = inMonth.filter((m) => m.direction === "out").reduce((s, m) => s + m.amount, 0);
      const balance = movements
        .filter((m) => m.date >= from)
        .reduce((sum, m) => sum + (m.direction === "in" ? m.amount : -m.amount), acc.opening_balance ?? 0);
      const lastCount = db
        .prepare("SELECT * FROM treasury_adjustments WHERE account = ? ORDER BY date DESC, id DESC LIMIT 1")
        .get(acc.name);
      return {
        id: acc.id,
        name: acc.name,
        name_ar: ACCOUNT_NAME_AR[acc.name] ?? acc.name,
        openingBalance: acc.opening_balance ?? 0,
        openingDate: acc.opening_date,
        balance,
        monthIncoming,
        monthOutgoing,
        netMovement: monthIncoming - monthOutgoing,
        lastCountDate: lastCount?.date ?? null,
      };
    });
  });

  // كشف حساب لشهر: كل حركة بتاريخها والرصيد بعدها. الحركات اللي قبل تاريخ
  // رصيد البداية بتظهر بس من غير ما تأثر على الرصيد (البداية متعدّة بعدها).
  ipcMain.handle("treasury:accountTransactions", (_e, { account_name, month }) => {
    const acc = db.prepare("SELECT * FROM treasury_accounts WHERE name = ?").get(account_name);
    const from = acc?.opening_date ?? "";
    const movements = cashMovements(account_name);
    let running = movements
      .filter((m) => m.date >= from && m.date < `${month}-01`)
      .reduce((sum, m) => sum + (m.direction === "in" ? m.amount : -m.amount), acc?.opening_balance ?? 0);
    const openingForMonth = running;
    const rows = movements
      .filter((m) => m.date.startsWith(month))
      .map((m) => {
        const counted = m.date >= from;
        if (counted) running += m.direction === "in" ? m.amount : -m.amount;
        return { ...m, balance: counted ? running : null };
      });
    return { openingForMonth, rows, closing: running };
  });

  // جرد: بتكتب الفلوس اللي عدّيتها فعلًا في يوم معيّن، والفرق عن المحسوب
  // بيتسجل تسوية (لو فيه فرق) عشان الرصيد يبقى مطابق للحقيقة.
  ipcMain.handle("treasury:count", (_e, { account_name, date, counted, note }) => {
    const acc = db.prepare("SELECT * FROM treasury_accounts WHERE name = ?").get(account_name);
    const expected = accountBalance(acc, date);
    const difference = Number(counted) - expected;
    if (Math.abs(difference) >= 0.005) {
      db.prepare(
        "INSERT INTO treasury_adjustments (account, date, amount, expected, counted, note) VALUES (?, ?, ?, ?, ?, ?)"
      ).run(account_name, date, difference, expected, Number(counted), note?.trim() || null);
    }
    return { expected, counted: Number(counted), difference };
  });
  ipcMain.handle("treasury:previewCount", (_e, { account_name, date }) => {
    const acc = db.prepare("SELECT * FROM treasury_accounts WHERE name = ?").get(account_name);
    return { expected: accountBalance(acc, date || todayISO()) };
  });
  ipcMain.handle("treasury:deleteAdjustment", (_e, { id }) => {
    db.prepare("DELETE FROM treasury_adjustments WHERE id = ?").run(id);
    return { ok: true };
  });

  ipcMain.handle("treasury:createTransfer", (_e, { date, from_account, to_account, amount, note }) => {
    if (from_account === to_account) throw new Error("لازم حسابين مختلفين");
    db.prepare("INSERT INTO treasury_transfers (date, from_account, to_account, amount, note) VALUES (?, ?, ?, ?, ?)").run(
      date,
      from_account,
      to_account,
      Number(amount) || 0,
      note?.trim() || null
    );
    return { ok: true };
  });
  ipcMain.handle("treasury:deleteTransfer", (_e, { id }) => {
    db.prepare("DELETE FROM treasury_transfers WHERE id = ?").run(id);
    return { ok: true };
  });

  ipcMain.handle("otherIncome:create", (_e, { date, amount, method, description }) => {
    db.prepare("INSERT INTO other_income (date, amount, method, description) VALUES (?, ?, ?, ?)").run(
      date,
      Number(amount) || 0,
      method,
      description?.trim() || null
    );
    return { ok: true };
  });
  ipcMain.handle("otherIncome:delete", (_e, { id }) => {
    db.prepare("DELETE FROM other_income WHERE id = ?").run(id);
    return { ok: true };
  });

  // --- الآجل (اللي علينا) ---
  // مصروفات المعدات اللي لسه ليها باقي، ونصيب كل شريك اللي لسه متدفعلوش
  // (الشهر ده والسنة دي)، وإجمالي المستحق للموردين.
  function expensePaidTotal(expense) {
    const later = db
      .prepare("SELECT COALESCE(SUM(amount), 0) AS total FROM expense_payments WHERE expense_id = ?")
      .get(expense.id).total;
    return (expense.paid_amount ?? expense.amount) + later;
  }

  ipcMain.handle("expensePayments:create", (_e, { expense_id, date, amount, method, note }) => {
    db.prepare("INSERT INTO expense_payments (expense_id, date, amount, method, note) VALUES (?, ?, ?, ?, ?)").run(
      expense_id,
      date,
      Number(amount) || 0,
      method,
      note?.trim() || null
    );
    return { ok: true };
  });
  ipcMain.handle("expensePayments:delete", (_e, { id }) => {
    db.prepare("DELETE FROM expense_payments WHERE id = ?").run(id);
    return { ok: true };
  });

  // --- فلوس علينا لجهات تانية ---
  // الباقي = الرصيد الافتتاحي + كل الديون − كل السدادات.
  function creditorBalances() {
    const sumStmt = db.prepare("SELECT COALESCE(SUM(amount), 0) AS total FROM creditor_entries WHERE creditor_id = ? AND type = ?");
    return db
      .prepare("SELECT * FROM creditors ORDER BY name")
      .all()
      .map((c) => {
        const debts = sumStmt.get(c.id, "debt").total;
        const paid = sumStmt.get(c.id, "payment").total;
        const opening = c.opening_balance ?? 0;
        return { id: c.id, name: c.name, note: c.note, openingBalance: opening, debts, paid, remaining: opening + debts - paid };
      });
  }
  ipcMain.handle("creditors:list", () => creditorBalances());
  ipcMain.handle("creditors:create", (_e, { name, opening_balance, note }) => {
    const trimmed = (name ?? "").trim();
    if (!trimmed) throw new Error("لازم اسم الجهة");
    if (db.prepare("SELECT 1 FROM creditors WHERE name = ?").get(trimmed)) throw new Error("الاسم ده موجود قبل كده");
    const info = db
      .prepare("INSERT INTO creditors (name, opening_balance, note) VALUES (?, ?, ?)")
      .run(trimmed, Number(opening_balance) || 0, note?.trim() || null);
    return db.prepare("SELECT * FROM creditors WHERE id = ?").get(info.lastInsertRowid);
  });
  ipcMain.handle("creditors:update", (_e, { id, name, opening_balance, note }) => {
    const trimmed = (name ?? "").trim();
    if (!trimmed) throw new Error("لازم اسم الجهة");
    db.prepare("UPDATE creditors SET name = ?, opening_balance = ?, note = ? WHERE id = ?").run(
      trimmed,
      Number(opening_balance) || 0,
      note?.trim() || null,
      id
    );
    return db.prepare("SELECT * FROM creditors WHERE id = ?").get(id);
  });
  ipcMain.handle("creditors:delete", (_e, { id }) => {
    db.prepare("DELETE FROM creditors WHERE id = ?").run(id);
    return { ok: true };
  });
  // كشف حساب جهة: كل الحركات بالترتيب والباقي بعد كل حركة.
  ipcMain.handle("creditors:statement", (_e, { id }) => {
    const c = creditorBalances().find((x) => x.id === id);
    if (!c) throw new Error("الجهة مش موجودة");
    let balance = c.openingBalance;
    const entries = db
      .prepare("SELECT * FROM creditor_entries WHERE creditor_id = ? ORDER BY date, id")
      .all(id)
      .map((e) => {
        balance += e.type === "debt" ? e.amount : -e.amount;
        return { ...e, balance };
      });
    return { ...c, entries };
  });
  ipcMain.handle("creditorEntries:create", (_e, { creditor_id, date, type, amount, method, note }) => {
    if (!["debt", "payment"].includes(type)) throw new Error("نوع الحركة غلط");
    if (!(Number(amount) > 0)) throw new Error("لازم مبلغ");
    const info = db
      .prepare("INSERT INTO creditor_entries (creditor_id, date, type, amount, method, note) VALUES (?, ?, ?, ?, ?, ?)")
      .run(creditor_id, date, type, Number(amount), type === "payment" ? method || "cash" : null, note?.trim() || null);
    return db.prepare("SELECT * FROM creditor_entries WHERE id = ?").get(info.lastInsertRowid);
  });
  ipcMain.handle("creditorEntries:delete", (_e, { id }) => {
    db.prepare("DELETE FROM creditor_entries WHERE id = ?").run(id);
    return { ok: true };
  });

  ipcMain.handle("payables:summary", (_e, { month }) => {
    const expenses = db
      .prepare(
        `SELECT me.*, e.name AS equipment_name, ec.name AS category_name FROM monthly_expenses me
         JOIN equipment e ON e.id = me.equipment_id
         LEFT JOIN expense_categories ec ON ec.id = me.category_id
         WHERE me.paid_amount IS NOT NULL
         ORDER BY COALESCE(me.date, me.month || '-01')`
      )
      .all()
      .map((me) => {
        const paid = expensePaidTotal(me);
        return {
          id: me.id,
          equipment_name: me.equipment_name,
          category_name: me.category_name,
          payee: me.payee,
          date: me.date ?? `${me.month}-01`,
          note: me.note,
          amount: me.amount,
          paid,
          remaining: me.amount - paid,
        };
      })
      .filter((e) => e.remaining > 0.005);

    const year = month.slice(0, 4);
    const yearMonths = Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, "0")}`);
    const profitCache = new Map();
    const eqProfit = (equipmentId, m) => {
      const key = `${equipmentId}|${m}`;
      if (!profitCache.has(key)) profitCache.set(key, equipmentMonthNetProfit(db, equipmentId, m));
      return profitCache.get(key);
    };
    const paidStmt = db.prepare("SELECT COALESCE(SUM(amount), 0) AS total FROM partner_payments WHERE partner_id = ? AND date LIKE ?");
    const partners = db
      .prepare("SELECT * FROM partners ORDER BY name")
      .all()
      .map((p) => {
        const shares = db.prepare("SELECT equipment_id, percentage FROM equipment_partner_shares WHERE partner_id = ?").all(p.id);
        const shareOf = (m) => shares.reduce((sum, sh) => sum + (eqProfit(sh.equipment_id, m) * sh.percentage) / 100, 0);
        const monthDue = shareOf(month) - paidStmt.get(p.id, `${month}%`).total;
        const yearDue = yearMonths.reduce((sum, m) => sum + shareOf(m), 0) - paidStmt.get(p.id, `${year}%`).total;
        // الإجمالي = الرصيد الافتتاحي (فلوس قديمة ليه قبل السيستم) + نصيبه من
        // كل الأرباح من الأول − كل اللي اتدفعله — نفس "الباقي" في صفحة الشركاء.
        const allTimeShare = shares.reduce((sum, sh) => sum + (equipmentAllTimeProfit(sh.equipment_id) * sh.percentage) / 100, 0);
        const totalDue = (p.opening_balance ?? 0) + allTimeShare - paidStmt.get(p.id, "%").total;
        return { id: p.id, name: p.name, monthDue, yearDue, openingBalance: p.opening_balance ?? 0, totalDue };
      })
      .filter((p) => Math.abs(p.monthDue) > 0.005 || Math.abs(p.yearDue) > 0.005 || Math.abs(p.totalDue) > 0.005);

    // لينا عند المقاولين: الرصيد الافتتاحي (فلوس قديمة عليهم قبل السيستم) +
    // قيمة كل شغلهم − كل اللي دفعوه — نفس "الباقي" في صفحة المقاولين.
    const contractorWorkStmt = db.prepare("SELECT * FROM daily_logs WHERE role = 'contractor' AND person_name = ?");
    const contractorPaidStmt = db.prepare("SELECT COALESCE(SUM(amount), 0) AS total FROM contractor_payments WHERE contractor_id = ?");
    const receivables = db
      .prepare("SELECT * FROM contractors ORDER BY name")
      .all()
      .map((c) => {
        const work = contractorWorkStmt.all(c.name).reduce((sum, l) => sum + computeDayValue(l), 0);
        const paid = contractorPaidStmt.get(c.id).total;
        return { id: c.id, name: c.name, openingBalance: c.opening_balance ?? 0, work, paid, remaining: (c.opening_balance ?? 0) + work - paid };
      })
      .filter((c) => Math.abs(c.remaining) > 0.005);

    const suppliersDue = db
      .prepare(
        `SELECT COALESCE((SELECT SUM(amount) FROM supplier_purchases), 0) - COALESCE((SELECT SUM(amount) FROM supplier_payments), 0) AS total`
      )
      .get().total;

    const creditors = creditorBalances().filter((c) => Math.abs(c.remaining) > 0.005);
    const creditorsDue = creditors.reduce((sum, c) => sum + Math.max(0, c.remaining), 0);

    const recentPayments = db
      .prepare(
        `SELECT ep.*, e.name AS equipment_name, ec.name AS category_name, me.payee FROM expense_payments ep
         JOIN monthly_expenses me ON me.id = ep.expense_id
         JOIN equipment e ON e.id = me.equipment_id
         LEFT JOIN expense_categories ec ON ec.id = me.category_id
         WHERE ep.date LIKE ? ORDER BY ep.date DESC, ep.id DESC`
      )
      .all(`${month}%`);

    const expensesDue = expenses.reduce((sum, e) => sum + e.remaining, 0);
    const partnersTotalDue = partners.reduce((sum, p) => sum + Math.max(0, p.totalDue), 0);
    return {
      month,
      expenses,
      partners,
      receivables,
      suppliersDue,
      recentPayments,
      expensesDue,
      partnersMonthDue: partners.reduce((sum, p) => sum + p.monthDue, 0),
      partnersYearDue: partners.reduce((sum, p) => sum + p.yearDue, 0),
      partnersOpening: partners.reduce((sum, p) => sum + p.openingBalance, 0),
      partnersTotalDue,
      receivablesTotal: receivables.reduce((sum, c) => sum + Math.max(0, c.remaining), 0),
      creditors,
      creditorsDue,
      totalDue: expensesDue + partnersTotalDue + Math.max(0, suppliersDue) + creditorsDue,
    };
  });

  ipcMain.handle("treasury:extras", (_e, { month }) => ({
    transfers: db.prepare("SELECT * FROM treasury_transfers WHERE date LIKE ? ORDER BY date DESC, id DESC").all(`${month}%`),
    otherIncome: db.prepare("SELECT * FROM other_income WHERE date LIKE ? ORDER BY date DESC, id DESC").all(`${month}%`),
    adjustments: db.prepare("SELECT * FROM treasury_adjustments WHERE date LIKE ? ORDER BY date DESC, id DESC").all(`${month}%`),
  }));

  // --- Suppliers (doc section 10) — no fixed list, created on first purchase/payment ---
  function findOrCreateSupplier(name) {
    const trimmed = name.trim();
    const existing = db.prepare("SELECT * FROM suppliers WHERE name = ?").get(trimmed);
    if (existing) return existing;
    const info = db.prepare("INSERT INTO suppliers (name) VALUES (?)").run(trimmed);
    return { id: info.lastInsertRowid, name: trimmed };
  }

  // بس أسماء الموردين اللي لسه معاهم عملية بيع أو شراء فعلية — مورد اتمسحت
  // كل حركاته منها مالوش داعي يفضل ظاهر في اقتراحات الاسم.
  ipcMain.handle("suppliers:names", () =>
    db
      .prepare(
        `SELECT name FROM suppliers s
         WHERE EXISTS (SELECT 1 FROM supplier_purchases WHERE supplier_id = s.id)
            OR EXISTS (SELECT 1 FROM supplier_payments WHERE supplier_id = s.id)
         ORDER BY name`
      )
      .all()
      .map((r) => r.name)
  );

  ipcMain.handle("supplierPurchases:create", (_e, purchase) => {
    const supplier = findOrCreateSupplier(purchase.supplier_name);
    const info = db
      .prepare(
        `INSERT INTO supplier_purchases (supplier_id, date, description, amount, note)
         VALUES (@supplier_id, @date, @description, @amount, @note)`
      )
      .run({
        supplier_id: supplier.id,
        date: purchase.date,
        description: purchase.description ?? null,
        amount: purchase.amount,
        note: purchase.note ?? null,
      });
    const created = { ...db.prepare("SELECT * FROM supplier_purchases WHERE id = ?").get(info.lastInsertRowid), supplier_name: supplier.name };
    pushToCloud("supplier_purchases", created.id, created);
    return created;
  });

  ipcMain.handle("supplierPayments:create", (_e, payment) => {
    const supplier = findOrCreateSupplier(payment.supplier_name);
    const info = db
      .prepare(
        `INSERT INTO supplier_payments (supplier_id, date, amount, method, note)
         VALUES (@supplier_id, @date, @amount, @method, @note)`
      )
      .run({
        supplier_id: supplier.id,
        date: payment.date,
        amount: payment.amount,
        method: payment.method || "cash",
        note: payment.note ?? null,
      });
    const created = { ...db.prepare("SELECT * FROM supplier_payments WHERE id = ?").get(info.lastInsertRowid), supplier_name: supplier.name };
    pushToCloud("supplier_payments", created.id, created);
    return created;
  });

  ipcMain.handle("supplierPurchases:delete", (_e, { id }) => {
    db.prepare("DELETE FROM supplier_purchases WHERE id = ?").run(id);
    return { ok: true };
  });
  ipcMain.handle("supplierPayments:delete", (_e, { id }) => {
    db.prepare("DELETE FROM supplier_payments WHERE id = ?").run(id);
    return { ok: true };
  });

  // Dynamic dashboard: any supplier named on a purchase/payment shows up
  // here automatically, no setup step.
  ipcMain.handle("suppliers:dashboard", () => {
    const suppliers = db.prepare("SELECT * FROM suppliers ORDER BY name").all();
    const purchasesStmt = db.prepare("SELECT * FROM supplier_purchases WHERE supplier_id = ? ORDER BY date DESC");
    const paymentsStmt = db.prepare("SELECT * FROM supplier_payments WHERE supplier_id = ? ORDER BY date DESC");

    return suppliers
      .map((s) => {
        const purchases = purchasesStmt.all(s.id);
        const payments = paymentsStmt.all(s.id);
        const totalPurchases = purchases.reduce((sum, p) => sum + p.amount, 0);
        const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
        return {
          id: s.id,
          name: s.name,
          purchaseCount: purchases.length,
          totalPurchases,
          totalPaid,
          remaining: totalPurchases - totalPaid,
          purchases,
          payments,
        };
      })
      // مورد من غير أي مشترى أو دفعة (زي بعد ما تتمسح كل حركاته) مالوش داعي
      // يفضل ظاهر في القايمة فاضي.
      .filter((s) => s.purchases.length > 0 || s.payments.length > 0);
  });

  // --- Reports: pulls the headline numbers from every module together for
  // one month, so there's a single printable summary. ---
  ipcMain.handle("reports:monthly", (_e, { month }) => {
    const equipmentList = db.prepare("SELECT * FROM equipment ORDER BY name").all();
    let totalIncome = 0;
    let totalExpense = 0;
    const equipmentRows = equipmentList.map((eq) => {
      const income = db
        .prepare("SELECT * FROM daily_logs WHERE equipment_id = ? AND role IN ('driver','market') AND date LIKE ?")
        .all(eq.id, `${month}%`)
        .reduce((sum, l) => sum + computeDayValue(l), 0);
      const manualExpense = db
        .prepare("SELECT COALESCE(SUM(amount), 0) AS total FROM monthly_expenses WHERE equipment_id = ? AND month = ?")
        .get(eq.id, month).total;
      const driverSalaryExpense = driverSalaryForEquipment(db, eq.id, month);
      const expense = manualExpense + driverSalaryExpense;
      totalIncome += income;
      totalExpense += expense;
      return { equipment_name: eq.name, income, expense, netProfit: income - expense, ...equipmentDayCounts(db, eq.id, month) };
    });

    const employees = db.prepare("SELECT * FROM employees").all();
    let payrollTotal = 0;
    for (const emp of employees) {
      const advances = db
        .prepare("SELECT COALESCE(SUM(amount), 0) AS total FROM employee_advances WHERE employee_id = ? AND month = ?")
        .get(emp.id, month).total;
      const deductions = db
        .prepare("SELECT COALESCE(SUM(amount), 0) AS total FROM employee_deductions WHERE employee_id = ? AND month = ?")
        .get(emp.id, month).total;
      const state = getEmployeeStateForMonth(db, emp.id, month);
      if (state.wage_type === "monthly") {
        const { grossPay } = monthlyEmployeeGrossPay(db, emp, month);
        payrollTotal += grossPay - advances - deductions;
      } else {
        const gross = db
          .prepare("SELECT * FROM daily_logs WHERE role = 'driver' AND person_name = ? AND date LIKE ?")
          .all(emp.name, `${month}%`)
          .reduce((sum, l) => sum + computeDriverWageValue(l, state.rate), 0);
        payrollTotal += gross - advances - deductions;
      }
    }
    const commissionRows = [];
    for (const eq of equipmentList) {
      const driverLogs = db
        .prepare("SELECT * FROM daily_logs WHERE equipment_id = ? AND role = 'driver' AND date LIKE ?")
        .all(eq.id, `${month}%`);
      const contractorLogs = db
        .prepare("SELECT * FROM daily_logs WHERE equipment_id = ? AND role = 'contractor' AND date LIKE ?")
        .all(eq.id, `${month}%`);
      const marketLogs = db
        .prepare(
          "SELECT * FROM daily_logs WHERE equipment_id = ? AND role = 'market' AND date LIKE ? AND hassan_commission IS NOT NULL"
        )
        .all(eq.id, `${month}%`);
      const driverByKey = new Map(driverLogs.map((l) => [pairKey(l), l]));
      for (const cl of contractorLogs) {
        const dl = driverByKey.get(pairKey(cl));
        if (!dl) continue;
        commissionRows.push(computePairedCommission(eq.name, dl, cl));
      }
      for (const ml of marketLogs) commissionRows.push(ml.hassan_commission ?? 0);
    }
    const monthPenalties = db
      .prepare("SELECT COALESCE(SUM(amount), 0) AS total FROM hassan_penalties WHERE date LIKE ?")
      .get(`${month}%`).total;
    const hassanCommissionTotal = commissionRows.reduce((sum, c) => sum + c, 0) - monthPenalties;

    const treasuryAccounts = db.prepare("SELECT * FROM treasury_accounts ORDER BY CASE name WHEN 'wallet' THEN 1 WHEN 'instapay' THEN 2 WHEN 'cash' THEN 3 WHEN 'vodafone_cash' THEN 4 ELSE 5 END, id").all();

    return {
      month,
      equipmentRows,
      totalIncome,
      totalExpense,
      netProfit: totalIncome - totalExpense,
      payrollTotal,
      hassanCommissionTotal,
      treasuryBalances: treasuryAccounts.map((a) => ({ name: a.name, name_ar: ACCOUNT_NAME_AR[a.name] ?? a.name, balance: accountBalance(a) })),
    };
  });

  // --- Dashboard: live headline numbers for the home page, computed from
  // the real database for the current calendar year — replaces the old
  // hardcoded Excel-snapshot placeholder that never got wired up. ---
  const MONTH_NAMES_AR = [
    "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
    "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
  ];

  // المستحق في شهر واحد بس (مش من أول التاريخ): للشركة من كل مقاول = قيمة
  // شغله في الشهر ده − اللي دفعه بتاريخ في الشهر ده؛ ولكل شريك = نصيبه من
  // صافي ربح معداته في الشهر ده − اللي اتدفعله بتاريخ في الشهر ده.
  ipcMain.handle("dashboard:monthDues", (_e, { month }) => {
    const contractors = db
      .prepare("SELECT * FROM contractors ORDER BY name")
      .all()
      .map((c) => {
        const work = db
          .prepare("SELECT * FROM daily_logs WHERE role = 'contractor' AND person_name = ? AND date LIKE ?")
          .all(c.name, `${month}%`)
          .reduce((sum, l) => sum + computeDayValue(l), 0);
        const paid = db
          .prepare("SELECT COALESCE(SUM(amount), 0) AS total FROM contractor_payments WHERE contractor_id = ? AND date LIKE ?")
          .get(c.id, `${month}%`).total;
        return { id: c.id, name: c.name, due: work, paid, remaining: work - paid };
      })
      .filter((c) => c.due !== 0 || c.paid !== 0);

    const profitCache = new Map();
    const equipmentProfit = (equipmentId) => {
      if (!profitCache.has(equipmentId)) profitCache.set(equipmentId, equipmentMonthNetProfit(db, equipmentId, month));
      return profitCache.get(equipmentId);
    };
    const partners = db
      .prepare("SELECT * FROM partners ORDER BY name")
      .all()
      .map((p) => {
        const shares = db
          .prepare("SELECT equipment_id, percentage FROM equipment_partner_shares WHERE partner_id = ?")
          .all(p.id);
        const due = shares.reduce((sum, sh) => sum + (equipmentProfit(sh.equipment_id) * sh.percentage) / 100, 0);
        const paid = db
          .prepare("SELECT COALESCE(SUM(amount), 0) AS total FROM partner_payments WHERE partner_id = ? AND date LIKE ?")
          .get(p.id, `${month}%`).total;
        return { id: p.id, name: p.name, due, paid, remaining: due - paid };
      })
      .filter((p) => p.due !== 0 || p.paid !== 0);

    return {
      month,
      contractors,
      partners,
      contractorsRemaining: contractors.reduce((sum, c) => sum + c.remaining, 0),
      partnersRemaining: partners.reduce((sum, p) => sum + p.remaining, 0),
    };
  });

  ipcMain.handle("dashboard:summary", () => {
    const now = new Date();
    const year = String(now.getFullYear());
    const currentMonthIndex = now.getMonth();
    const equipmentList = db.prepare("SELECT * FROM equipment ORDER BY name").all();

    function equipmentMonthTotals(equipmentId, monthKey) {
      const income = db
        .prepare("SELECT * FROM daily_logs WHERE equipment_id = ? AND role IN ('driver', 'market') AND date LIKE ?")
        .all(equipmentId, `${monthKey}%`)
        .reduce((sum, l) => sum + computeDayValue(l), 0);
      const manualExpense = db
        .prepare("SELECT COALESCE(SUM(amount), 0) AS total FROM monthly_expenses WHERE equipment_id = ? AND month = ?")
        .get(equipmentId, monthKey).total;
      const driverSalaryExpense = driverSalaryForEquipment(db, equipmentId, monthKey);
      const expense = manualExpense + driverSalaryExpense;
      return { profit: income - expense, expense, income };
    }

    const equipmentAnnualExpense = new Map(equipmentList.map((e) => [e.id, 0]));
    const equipmentAnnualIncome = new Map(equipmentList.map((e) => [e.id, 0]));
    const monthlyProfitTrend = [];
    let totalAnnualProfit = 0;
    let totalAnnualExpense = 0;

    for (let m = 0; m < 12; m++) {
      const monthKey = `${year}-${String(m + 1).padStart(2, "0")}`;
      let monthProfit = 0;
      for (const eq of equipmentList) {
        const { profit, expense, income } = equipmentMonthTotals(eq.id, monthKey);
        monthProfit += profit;
        totalAnnualExpense += expense;
        equipmentAnnualExpense.set(eq.id, equipmentAnnualExpense.get(eq.id) + expense);
        equipmentAnnualIncome.set(eq.id, equipmentAnnualIncome.get(eq.id) + income);
      }
      monthlyProfitTrend.push({ month: MONTH_NAMES_AR[m], profit: monthProfit });
      totalAnnualProfit += monthProfit;
    }

    const equipmentExpenses = equipmentList.map((eq) => ({
      name: eq.name,
      annualExpense: equipmentAnnualExpense.get(eq.id),
      annualIncome: equipmentAnnualIncome.get(eq.id),
      annualProfit: equipmentAnnualIncome.get(eq.id) - equipmentAnnualExpense.get(eq.id),
      ...equipmentDayCounts(db, eq.id, year),
    }));

    const contractors = db.prepare("SELECT * FROM contractors").all();
    const totalReceivables = contractors.reduce((sum, c) => {
      const totalWork =
        c.opening_balance +
        db
          .prepare("SELECT * FROM daily_logs WHERE role = 'contractor' AND person_name = ?")
          .all(c.name)
          .reduce((s, l) => s + computeDayValue(l), 0);
      const totalPaid = db
        .prepare("SELECT COALESCE(SUM(amount), 0) AS total FROM contractor_payments WHERE contractor_id = ?")
        .get(c.id).total;
      return sum + (totalWork - totalPaid);
    }, 0);

    const partners = db.prepare("SELECT * FROM partners").all();
    const partnersRemaining = partners.reduce((sum, p) => {
      const shares = db
        .prepare("SELECT equipment_id, percentage FROM equipment_partner_shares WHERE partner_id = ?")
        .all(p.id);
      const totalDue =
        p.opening_balance + shares.reduce((s, sh) => s + (equipmentAllTimeProfit(sh.equipment_id) * sh.percentage) / 100, 0);
      const totalPaid = db
        .prepare("SELECT COALESCE(SUM(amount), 0) AS total FROM partner_payments WHERE partner_id = ?")
        .get(p.id).total;
      return sum + (totalDue - totalPaid);
    }, 0);

    const suppliers = db.prepare("SELECT * FROM suppliers").all();
    const suppliersRemaining = suppliers.reduce((sum, s) => {
      const totalPurchases = db
        .prepare("SELECT COALESCE(SUM(amount), 0) AS total FROM supplier_purchases WHERE supplier_id = ?")
        .get(s.id).total;
      const totalPaid = db
        .prepare("SELECT COALESCE(SUM(amount), 0) AS total FROM supplier_payments WHERE supplier_id = ?")
        .get(s.id).total;
      return sum + (totalPurchases - totalPaid);
    }, 0);

    return {
      totalAnnualProfit,
      totalAnnualExpense,
      equipmentCount: equipmentList.length,
      currentMonthLabel: MONTH_NAMES_AR[currentMonthIndex],
      currentMonthProfit: monthlyProfitTrend[currentMonthIndex].profit,
      totalReceivables,
      totalPartnersDue: partnersRemaining,
      totalSuppliersDue: suppliersRemaining,
      monthlyProfitTrend,
      equipmentExpenses,
    };
  });

  // --- الهالك (waste): money spent as an outright loss/write-off — logged
  // with a date, how it was paid, and a note describing what it was. Every
  // entry here also shows up inside "الصادر" below, since it's real company
  // cash going out just like any other expense. ---
  ipcMain.handle("waste:list", (_e, { month }) =>
    db.prepare("SELECT * FROM waste_entries WHERE date LIKE ? ORDER BY date, id").all(`${month}%`)
  );
  ipcMain.handle("waste:create", (_e, entry) => {
    const info = db
      .prepare(`INSERT INTO waste_entries (date, amount, payment_method, note) VALUES (@date, @amount, @payment_method, @note)`)
      .run({ date: entry.date, amount: entry.amount, payment_method: entry.payment_method || "cash", note: entry.note ?? null });
    const created = db.prepare("SELECT * FROM waste_entries WHERE id = ?").get(info.lastInsertRowid);
    pushToCloud("waste_entries", created.id, created);
    return created;
  });
  ipcMain.handle("waste:delete", (_e, { id }) => {
    db.prepare("DELETE FROM waste_entries WHERE id = ?").run(id);
    return { ok: true };
  });

  // --- الصادر والوارد: a full company-wide cash ledger for one month.
  // الصادر (outgoing) = every equipment expense + partner/supplier payments
  // + payroll advances/bonuses actually paid out + waste entries — every real
  // cash-out event, company-wide. الوارد (incoming) = money collected from
  // contractors. Note: a driver/employee's final month-end wage isn't its own
  // recorded transaction anywhere in the system (same as a partner's or
  // contractor's due amount before they're actually paid) — only advances and
  // bonuses are real recorded payroll cash movements, so that's what "الرواتب"
  // reflects here. ---
  ipcMain.handle("outgoing:list", (_e, { month }) => {
    const equipmentExpenses = db
      .prepare(
        `SELECT me.*, e.name AS equipment_name, ec.name AS category_name
         FROM monthly_expenses me
         JOIN equipment e ON e.id = me.equipment_id
         LEFT JOIN expense_categories ec ON ec.id = me.category_id
         WHERE me.month = ?
         ORDER BY COALESCE(me.date, ''), me.id`
      )
      .all(month);
    const categoryTotalsMap = new Map();
    for (const row of equipmentExpenses) {
      const label = row.category_name || "بدون نوع";
      categoryTotalsMap.set(label, (categoryTotalsMap.get(label) ?? 0) + row.amount);
    }
    const categoryTotals = [...categoryTotalsMap.entries()].map(([category_name, total]) => ({ category_name, total }));
    const equipmentExpensesTotal = equipmentExpenses.reduce((sum, r) => sum + r.amount, 0);

    const partnerPayments = db
      .prepare(
        `SELECT pp.*, p.name AS partner_name FROM partner_payments pp
         JOIN partners p ON p.id = pp.partner_id
         WHERE pp.date LIKE ? ORDER BY pp.date, pp.id`
      )
      .all(`${month}%`);
    const partnerPaymentsTotal = partnerPayments.reduce((sum, r) => sum + r.amount, 0);

    const supplierPayments = db
      .prepare(
        `SELECT sp.*, s.name AS supplier_name FROM supplier_payments sp
         JOIN suppliers s ON s.id = sp.supplier_id
         WHERE sp.date LIKE ? ORDER BY sp.date, sp.id`
      )
      .all(`${month}%`);
    const supplierPaymentsTotal = supplierPayments.reduce((sum, r) => sum + r.amount, 0);

    const creditorPayments = db
      .prepare(
        `SELECT ce.*, c.name AS creditor_name FROM creditor_entries ce
         JOIN creditors c ON c.id = ce.creditor_id
         WHERE ce.type = 'payment' AND ce.date LIKE ? ORDER BY ce.date, ce.id`
      )
      .all(`${month}%`);
    const creditorPaymentsTotal = creditorPayments.reduce((sum, r) => sum + r.amount, 0);

    // السلف والمكافآت ودفعات المرتب هنا بتتحسب على الشهر اللي بتخصه (زي
    // مصروفات المعدات) مش تاريخ الصرف الحقيقي — لو دفعت مرتب يونيو في 5 يوليو
    // يفضل يسمع في يونيو، هنا وفي الخزنة كمان.
    const advances = db
      .prepare(
        `SELECT ea.*, e.name AS employee_name FROM employee_advances ea
         JOIN employees e ON e.id = ea.employee_id
         WHERE ea.month = ? ORDER BY ea.date, ea.id`
      )
      .all(month)
      .map((r) => ({ ...r, kind: "advance" }));
    const bonuses = db
      .prepare(
        `SELECT eb.*, e.name AS employee_name FROM employee_bonuses eb
         JOIN employees e ON e.id = eb.employee_id
         WHERE eb.month = ? ORDER BY eb.date, eb.id`
      )
      .all(month)
      .map((r) => ({ ...r, kind: "bonus" }));
    const salaryPayments = db
      .prepare(
        `SELECT sp.*, e.name AS employee_name FROM salary_payments sp
         JOIN employees e ON e.id = sp.employee_id
         WHERE sp.month = ? ORDER BY sp.date, sp.id`
      )
      .all(month)
      .map((r) => ({ ...r, kind: "salary" }));
    const payroll = [...advances, ...bonuses, ...salaryPayments].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    const payrollTotal = payroll.reduce((sum, r) => sum + r.amount, 0);

    const waste = db.prepare("SELECT * FROM waste_entries WHERE date LIKE ? ORDER BY date, id").all(`${month}%`);
    const wasteTotal = waste.reduce((sum, w) => sum + w.amount, 0);

    const totalOutgoing = equipmentExpensesTotal + partnerPaymentsTotal + supplierPaymentsTotal + creditorPaymentsTotal + payrollTotal + wasteTotal;

    return {
      equipmentExpenses,
      categoryTotals,
      equipmentExpensesTotal,
      partnerPayments,
      partnerPaymentsTotal,
      supplierPayments,
      supplierPaymentsTotal,
      creditorPayments,
      creditorPaymentsTotal,
      payroll,
      payrollTotal,
      waste,
      wasteTotal,
      totalOutgoing,
    };
  });

  ipcMain.handle("incoming:list", (_e, { month }) => {
    const contractorPayments = db
      .prepare(
        `SELECT cp.*, c.name AS contractor_name FROM contractor_payments cp
         JOIN contractors c ON c.id = cp.contractor_id
         WHERE cp.date LIKE ? ORDER BY cp.date, cp.id`
      )
      .all(`${month}%`);
    const totalIncoming = contractorPayments.reduce((sum, r) => sum + r.amount, 0);
    return { contractorPayments, totalIncoming };
  });

  // --- تشخيص مؤقت: بيقول كام مصروف موجود محليًا، وكام منهم بيشاور على
  // equipment_id مش موجود في جدول المعدات خالص (يتيم) — ده اللي بيخلي
  // المزامنة تتخطاه بصمت من غير أي رسالة خطأ. ---
  ipcMain.handle("system:diagnoseExpenses", () => {
    const total = db.prepare("SELECT COUNT(*) AS c FROM monthly_expenses").get().c;
    const orphaned = db
      .prepare("SELECT COUNT(*) AS c FROM monthly_expenses me WHERE NOT EXISTS (SELECT 1 FROM equipment e WHERE e.id = me.equipment_id)")
      .get().c;
    const sample = db
      .prepare(
        "SELECT id, equipment_id, month, date, amount FROM monthly_expenses me WHERE NOT EXISTS (SELECT 1 FROM equipment e WHERE e.id = me.equipment_id) LIMIT 5"
      )
      .all();
    return { total, orphaned, sample };
  });

  // --- Danger zone: wipe every recorded transaction (السركي, expenses,
  // advances, bonuses, payments, Hassan's ledger) so the office can start a
  // clean month — but keep the reference lists (equipment, partners, their
  // shares, employees, contractors, expense categories, suppliers) exactly
  // as set up, since that's real business setup, not day-to-day entries. ---
  ipcMain.handle("system:resetAll", () => {
    const tx = db.transaction(() => {
      db.prepare("DELETE FROM daily_logs").run();
      db.prepare("DELETE FROM monthly_expenses").run();
      db.prepare("DELETE FROM employee_advances").run();
      db.prepare("DELETE FROM employee_bonuses").run();
      db.prepare("DELETE FROM employee_deductions").run();
      db.prepare("DELETE FROM salary_payments").run();
      db.prepare("DELETE FROM hassan_ledger").run();
      db.prepare("DELETE FROM hassan_treasury_expenses").run();
      db.prepare("DELETE FROM hassan_penalties").run();
      db.prepare("DELETE FROM hassan_worker_entries").run();
      db.prepare("DELETE FROM contractor_payments").run();
      db.prepare("DELETE FROM partner_payments").run();
      db.prepare("DELETE FROM supplier_purchases").run();
      db.prepare("DELETE FROM supplier_payments").run();
      db.prepare("DELETE FROM creditor_entries").run();
      db.prepare("UPDATE creditors SET opening_balance = 0").run();
      db.prepare("DELETE FROM waste_entries").run();
      db.prepare("UPDATE treasury_accounts SET current_balance = 0, opening_balance = 0, opening_date = NULL").run();
      db.prepare("DELETE FROM treasury_transfers").run();
      db.prepare("DELETE FROM other_income").run();
      db.prepare("DELETE FROM treasury_adjustments").run();
    });
    tx();
    return { ok: true };
  });
}

module.exports = { registerIpcHandlers };
