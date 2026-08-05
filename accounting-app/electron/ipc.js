const { ipcMain } = require("electron");

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
  return dayRate + diffHours * hourlyRate;
}

// مرتب السائق مبني على سعره الثابت المسجل في الإعدادات، مش على أي رقم متكتب
// في شيت السركي (ده بقى بيمثل قد إيه المعدة اشتغلت بيه، رقم مختلف تمامًا).
// بيتطبق على أصحاب الأجر اليومي بس — مفيش أوفر تايم ولا إجازة جمعة تلقائية،
// بيتحسب بس من الأيام المسجلة فعليًا.
function computeDriverWageValue(log, employeeRate) {
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

// مرتب السائق بيتحط كمصروف حقيقي على المعدة ("مرتب سائق") بدل الاعتماد على
// دخل السركي المكتوب. أصحاب الأجر اليومي بيتحسبوا بصيغة اليوم مباشرة. أصحاب
// المرتب الشهري بيتقسّم إجمالي الفلوس الحقيقية الماخدوها الشهر ده (سلف +
// مكافآت + دفعات مرتب فعلية) على المعدات اللي اشتغلوا عليها حسب عدد الأيام —
// يعني لو اشتغل 15 يوم هنا و15 هناك يتقسم نص بنص، ولو مفيش فلوس اتاخدت لسه
// (مفيش سلفة ولا دفعة) مفيش مصروف بيتسجل خالص.
function monthlySalaryAllocationForEmployeeMonth(db, employeeName, employeeId, month) {
  const logs = db
    .prepare("SELECT equipment_id FROM daily_logs WHERE role = 'driver' AND person_name = ? AND date LIKE ?")
    .all(employeeName, `${month}%`);
  const result = new Map();
  if (logs.length === 0) return result;

  const daysByEquipment = new Map();
  for (const l of logs) daysByEquipment.set(l.equipment_id, (daysByEquipment.get(l.equipment_id) ?? 0) + 1);

  const advancesTotal = db
    .prepare("SELECT COALESCE(SUM(amount), 0) AS total FROM employee_advances WHERE employee_id = ? AND month = ?")
    .get(employeeId, month).total;
  const bonusesTotal = db
    .prepare("SELECT COALESCE(SUM(amount), 0) AS total FROM employee_bonuses WHERE employee_id = ? AND month = ?")
    .get(employeeId, month).total;
  const paidTotal = db
    .prepare("SELECT COALESCE(SUM(amount), 0) AS total FROM salary_payments WHERE employee_id = ? AND month = ?")
    .get(employeeId, month).total;
  const totalTaken = advancesTotal + bonusesTotal + paidTotal;
  if (totalTaken === 0) return result;

  for (const [equipmentId, days] of daysByEquipment) {
    result.set(equipmentId, totalTaken * (days / logs.length));
  }
  return result;
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

// مرتب أي سواق (يومي أو شهري — مفيش فرق) بيتحط كمصروف على المعدة من الفلوس
// الحقيقية اللي فعلاً اتاخدت (سلف + مكافآت + دفعات مرتب)، مقسومة على المعدات
// حسب أيام الشغل — لا مصروف بيتسجل غير لما فلوس فعلية تتاخد.
function driverSalaryForEquipment(db, equipmentId, month) {
  const logs = month
    ? db
        .prepare("SELECT * FROM daily_logs WHERE equipment_id = ? AND role = 'driver' AND date LIKE ?")
        .all(equipmentId, `${month}%`)
    : db.prepare("SELECT * FROM daily_logs WHERE equipment_id = ? AND role = 'driver'").all(equipmentId);

  const employees = new Map();
  for (const l of logs) {
    const employee = db.prepare("SELECT * FROM employees WHERE name = ?").get(l.person_name);
    if (employee) employees.set(employee.id, employee.name);
  }
  if (employees.size === 0) return 0;

  // كل شهر فيه سجلات له إجمالي فلوس ماخوذة مختلف، لازم نلف عليه لوحده.
  const months = month ? [month] : [...new Set(logs.map((l) => l.date.slice(0, 7)))];
  let sum = 0;
  for (const [empId, empName] of employees) {
    for (const m of months) {
      const allocation = monthlySalaryAllocationForEmployeeMonth(db, empName, empId, m);
      sum += allocation.get(equipmentId) ?? 0;
    }
  }
  return sum;
}

// نفس حساب مرتب السائق بس مقسّم بالاسم — لو أكتر من سواق شغلوا على نفس
// المعدة في نفس الشهر (سواق اتغيّر نص الشهر مثلًا)، كل واحد بيظهر في شيت
// المصروفات بمرتبه لوحده بدل رقم واحد مجمّع مالوش اسم.
function driverSalaryBreakdownForEquipment(db, equipmentId, month) {
  const logs = db
    .prepare("SELECT * FROM daily_logs WHERE equipment_id = ? AND role = 'driver' AND date LIKE ?")
    .all(equipmentId, `${month}%`);
  const employees = new Map();
  for (const l of logs) {
    const employee = db.prepare("SELECT * FROM employees WHERE name = ?").get(l.person_name);
    if (employee) employees.set(employee.id, employee.name);
  }
  const byDriver = new Map();
  for (const [empId, empName] of employees) {
    const allocation = monthlySalaryAllocationForEmployeeMonth(db, empName, empId, month);
    const amount = allocation.get(equipmentId) ?? 0;
    if (amount > 0) byDriver.set(empName, amount);
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

function registerIpcHandlers(db) {
  // --- Partners ---
  ipcMain.handle("partners:list", () => db.prepare("SELECT * FROM partners ORDER BY name").all());
  ipcMain.handle("partners:create", (_e, { name, opening_balance }) => {
    const info = db
      .prepare("INSERT INTO partners (name, opening_balance) VALUES (?, ?)")
      .run(name.trim(), opening_balance ?? 0);
    return { id: info.lastInsertRowid, name: name.trim(), opening_balance: opening_balance ?? 0 };
  });
  ipcMain.handle("partners:delete", (_e, { id }) => {
    db.prepare("DELETE FROM partners WHERE id = ?").run(id);
    return { ok: true };
  });
  ipcMain.handle("partners:updateOpeningBalance", (_e, { id, opening_balance }) => {
    db.prepare("UPDATE partners SET opening_balance = ? WHERE id = ?").run(opening_balance, id);
    return db.prepare("SELECT * FROM partners WHERE id = ?").get(id);
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
    return { id, name: trimmedName, wage_type, rate, fixed_salary: !!fixed_salary };
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
    return db.prepare("SELECT * FROM employees WHERE id = ?").get(id);
  });

  // --- Contractors ---
  ipcMain.handle("contractors:list", () => db.prepare("SELECT * FROM contractors ORDER BY name").all());
  ipcMain.handle("contractors:create", (_e, { name, opening_balance }) => {
    const info = db
      .prepare("INSERT INTO contractors (name, opening_balance) VALUES (?, ?)")
      .run(name.trim(), opening_balance ?? 0);
    return { id: info.lastInsertRowid, name: name.trim(), opening_balance: opening_balance ?? 0 };
  });
  ipcMain.handle("contractors:delete", (_e, { id }) => {
    db.prepare("DELETE FROM contractors WHERE id = ?").run(id);
    return { ok: true };
  });
  ipcMain.handle("contractors:updateOpeningBalance", (_e, { id, opening_balance }) => {
    db.prepare("UPDATE contractors SET opening_balance = ? WHERE id = ?").run(opening_balance, id);
    return db.prepare("SELECT * FROM contractors WHERE id = ?").get(id);
  });

  // --- Expense categories ---
  ipcMain.handle("expenseCategories:list", () =>
    db.prepare("SELECT * FROM expense_categories ORDER BY name").all()
  );
  ipcMain.handle("expenseCategories:create", (_e, { name, counts_as_commission }) => {
    const info = db
      .prepare("INSERT INTO expense_categories (name, counts_as_commission) VALUES (?, ?)")
      .run(name.trim(), counts_as_commission ? 1 : 0);
    return { id: info.lastInsertRowid, name: name.trim(), counts_as_commission: !!counts_as_commission };
  });
  // بيسمح تحدد نوع مصروف زي "مكنيكي" أو "سكن" إن قيمته على كل معدة تتحسب
  // تلقائيًا ضمن كوميشن حسن — مفيش داعي تسجلها مرتين.
  ipcMain.handle("expenseCategories:update", (_e, { id, name, counts_as_commission }) => {
    db.prepare("UPDATE expense_categories SET name = ?, counts_as_commission = ? WHERE id = ?").run(
      name.trim(),
      counts_as_commission ? 1 : 0,
      id
    );
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
    return getEquipmentWithShares().find((e) => e.id === equipmentId);
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
    return getEquipmentWithShares().find((e) => e.id === id);
  });

  ipcMain.handle("equipment:delete", (_e, { id }) => {
    db.prepare("DELETE FROM equipment WHERE id = ?").run(id);
    return { ok: true };
  });

  // --- Daily logs (السركي / المقاول / سركي سوق — same table, different role) ---
  ipcMain.handle("dailyLogs:list", (_e, { equipment_id, month, role }) => {
    const rows = db
      .prepare(
        "SELECT * FROM daily_logs WHERE equipment_id = ? AND role = ? AND date LIKE ? ORDER BY date"
      )
      .all(equipment_id, role, `${month}%`);
    return rows.map((row) => ({ ...row, day_value: computeDayValue(row) }));
  });

  const OTHER_HOURS_ROLE = { driver: "contractor", contractor: "driver" };

  // السركي والمقاول نفس اليوم ونفس الساعات فعليًا — الفرق بس السعر والشخص.
  // فأي تعديل على الساعات/الأساسية/البيان في شيت السائق بينسخ نفسه على شيت
  // المقاول لنفس المعدة واليوم من غير ما تدخلهم مرتين (ولو صف المقاول
  // مالوش شخص/سعر لسه بيتعمله واحد فاضي جاهز يتحدد بس)، والعكس صحيح — من
  // غير ما نلمس اسم الشخص ولا سعر اليوم بتاعه، ومن غير ما نمس إجازة السائق
  // المدفوعة لأنها مفهوم خاص بمرتبه الشهري ومالهاش معنى عند المقاول. علامة
  // "اليوم مشتغلش" (is_day_off) بتتزامن هي كمان زي الساعات بالظبط — لو
  // اليوم مشتغلش في شيت، بيبقى مشتغلش في التاني بردو، من غير ما نمسح
  // بيانات الاسم والسعر (تفضل موجودة لو رجع يشتغل تاني).
  function syncHoursToOtherRole(db, log) {
    const otherRole = OTHER_HOURS_ROLE[log.role];
    if (!otherRole) return;
    const existing = db
      .prepare("SELECT * FROM daily_logs WHERE equipment_id = ? AND date = ? AND role = ?")
      .get(log.equipment_id, log.date, otherRole);
    const params = {
      equipment_id: log.equipment_id,
      date: log.date,
      role: otherRole,
      person_name: existing?.person_name ?? "",
      actual_hours: log.actual_hours ?? null,
      base_hours: log.base_hours ?? null,
      day_rate: existing?.day_rate ?? null,
      is_paid_leave: existing?.is_paid_leave ?? 0,
      is_day_off: log.is_day_off ? 1 : 0,
      fixed_value: existing?.fixed_value ?? null,
      hassan_commission: existing?.hassan_commission ?? null,
      note: log.note ?? null,
    };
    db.prepare(
      `INSERT INTO daily_logs (equipment_id, date, role, person_name, actual_hours, base_hours, day_rate, is_paid_leave, is_day_off, fixed_value, hassan_commission, note)
       VALUES (@equipment_id, @date, @role, @person_name, @actual_hours, @base_hours, @day_rate, @is_paid_leave, @is_day_off, @fixed_value, @hassan_commission, @note)
       ON CONFLICT(equipment_id, date, role) DO UPDATE SET
         actual_hours = excluded.actual_hours,
         base_hours = excluded.base_hours,
         is_day_off = excluded.is_day_off,
         note = excluded.note`
    ).run(params);
  }

  // One row per equipment/date/role — matches the spreadsheet's "one line per
  // day of the month" layout, so saving a day's cells overwrites that day's
  // row instead of appending a new one.
  ipcMain.handle("dailyLogs:upsert", (_e, log) => {
    const params = {
      equipment_id: log.equipment_id,
      date: log.date,
      role: log.role,
      person_name: log.person_name,
      actual_hours: log.actual_hours ?? null,
      base_hours: log.base_hours ?? null,
      day_rate: log.day_rate ?? null,
      is_paid_leave: log.is_paid_leave ? 1 : 0,
      is_day_off: log.is_day_off ? 1 : 0,
      fixed_value: log.fixed_value ?? null,
      hassan_commission: log.hassan_commission ?? null,
      note: log.note ?? null,
    };
    db.prepare(
      `INSERT INTO daily_logs (equipment_id, date, role, person_name, actual_hours, base_hours, day_rate, is_paid_leave, is_day_off, fixed_value, hassan_commission, note)
       VALUES (@equipment_id, @date, @role, @person_name, @actual_hours, @base_hours, @day_rate, @is_paid_leave, @is_day_off, @fixed_value, @hassan_commission, @note)
       ON CONFLICT(equipment_id, date, role) DO UPDATE SET
         person_name = excluded.person_name,
         actual_hours = excluded.actual_hours,
         base_hours = excluded.base_hours,
         day_rate = excluded.day_rate,
         is_paid_leave = excluded.is_paid_leave,
         is_day_off = excluded.is_day_off,
         fixed_value = excluded.fixed_value,
         hassan_commission = excluded.hassan_commission,
         note = excluded.note`
    ).run(params);
    syncHoursToOtherRole(db, log);
    const row = db
      .prepare("SELECT * FROM daily_logs WHERE equipment_id = ? AND date = ? AND role = ?")
      .get(log.equipment_id, log.date, log.role);
    return { ...row, day_value: computeDayValue(row) };
  });

  ipcMain.handle("dailyLogs:delete", (_e, { id }) => {
    const log = db.prepare("SELECT * FROM daily_logs WHERE id = ?").get(id);
    db.prepare("DELETE FROM daily_logs WHERE id = ?").run(id);
    // يوم مشتغلش خالص في شيت — يبقى مشتغلش في التاني بردو (نفس اليوم بيتحذف
    // من الاتنين، مش بس واحد).
    if (log && OTHER_HOURS_ROLE[log.role]) {
      db.prepare("DELETE FROM daily_logs WHERE equipment_id = ? AND date = ? AND role = ?").run(
        log.equipment_id,
        log.date,
        OTHER_HOURS_ROLE[log.role]
      );
    }
    return { ok: true };
  });

  // معدة جديدة غالبًا هتشتغل بنفس ساعات ودوام معدة قديمة (نفس مواعيد الورديات
  // والأوفر تايم) — بننسخ الساعات/الأساسية/الأوفر تايم/علامة "مشتغلش"/البيان
  // بس من شيت السركي بتاع المعدة المصدر لنفس الشهر، وبيتزامنوا لشيت المقاول
  // تلقائيًا زي أي تعديل عادي. الاسم وسعر اليوم (في السركي والمقاول) بيفضلوا
  // زي ما هما عند المعدة الهدف من غير ما نلمسهم — لازم يتحددوا يدويًا بعد
  // النسخ لأن السواق/المقاول وسعره مختلفين عن المعدة التانية.
  ipcMain.handle("dailyLogs:copyFromEquipment", (_e, { target_equipment_id, source_equipment_id, month }) => {
    const sourceLogs = db
      .prepare("SELECT * FROM daily_logs WHERE equipment_id = ? AND role = 'driver' AND date LIKE ?")
      .all(source_equipment_id, `${month}%`);
    const upsertHours = db.prepare(
      `INSERT INTO daily_logs (equipment_id, date, role, person_name, actual_hours, base_hours, day_rate, is_paid_leave, is_day_off, fixed_value, hassan_commission, note)
       VALUES (@equipment_id, @date, @role, @person_name, @actual_hours, @base_hours, @day_rate, @is_paid_leave, @is_day_off, @fixed_value, @hassan_commission, @note)
       ON CONFLICT(equipment_id, date, role) DO UPDATE SET
         actual_hours = excluded.actual_hours,
         base_hours = excluded.base_hours,
         is_day_off = excluded.is_day_off,
         note = excluded.note`
    );
    const copy = db.transaction((logs) => {
      for (const src of logs) {
        for (const targetRole of ["driver", "contractor"]) {
          const existing = db
            .prepare("SELECT * FROM daily_logs WHERE equipment_id = ? AND date = ? AND role = ?")
            .get(target_equipment_id, src.date, targetRole);
          upsertHours.run({
            equipment_id: target_equipment_id,
            date: src.date,
            role: targetRole,
            person_name: existing?.person_name ?? "",
            actual_hours: src.actual_hours,
            base_hours: src.base_hours,
            day_rate: existing?.day_rate ?? null,
            is_paid_leave: existing?.is_paid_leave ?? 0,
            is_day_off: src.is_day_off ? 1 : 0,
            fixed_value: existing?.fixed_value ?? null,
            hassan_commission: existing?.hassan_commission ?? null,
            note: src.note,
          });
        }
      }
    });
    copy(sourceLogs);
    return { count: sourceLogs.length };
  });

  // --- Monthly expenses ---
  ipcMain.handle("monthlyExpenses:list", (_e, { equipment_id, month }) =>
    db
      .prepare(
        `SELECT me.*, ec.name AS category_name FROM monthly_expenses me
         LEFT JOIN expense_categories ec ON ec.id = me.category_id
         WHERE me.equipment_id = ? AND me.month = ? ORDER BY me.date, me.id`
      )
      .all(equipment_id, month)
  );

  ipcMain.handle("monthlyExpenses:create", (_e, expense) => {
    const info = db
      .prepare(
        `INSERT INTO monthly_expenses (equipment_id, month, date, category_id, amount, payment_method, note, receipt_image)
         VALUES (@equipment_id, @month, @date, @category_id, @amount, @payment_method, @note, @receipt_image)`
      )
      .run({ ...expense, date: expense.date ?? null, note: expense.note ?? null, receipt_image: expense.receipt_image ?? null });
    return db
      .prepare(
        `SELECT me.*, ec.name AS category_name FROM monthly_expenses me
         LEFT JOIN expense_categories ec ON ec.id = me.category_id WHERE me.id = ?`
      )
      .get(info.lastInsertRowid);
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
    return db.prepare("SELECT * FROM employee_advances WHERE id = ?").get(info.lastInsertRowid);
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
    return db.prepare("SELECT * FROM employee_bonuses WHERE id = ?").get(info.lastInsertRowid);
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
    return db.prepare("SELECT * FROM employee_deductions WHERE id = ?").get(info.lastInsertRowid);
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
    return db.prepare("SELECT * FROM salary_payments WHERE id = ?").get(info.lastInsertRowid);
  });
  ipcMain.handle("salaryPayments:delete", (_e, { id }) => {
    db.prepare("DELETE FROM salary_payments WHERE id = ?").run(id);
    return { ok: true };
  });

  // --- Hassan: commission (doc section 4) ---
  // Regular equipment: commission = (contractor day_rate - driver day_rate)
  // + overtime_hours * (contractor_rate/base_hours - driver_rate/base_hours),
  // paired by date. The two winches use a flat % of the contractor's day_rate instead.
  // سركي سوق has no formula — whatever commission was typed in on that row.
  const WINCH_PERCENTAGE_EQUIPMENT = ["ونش 5 طن دبوسة", "ونش 3 وصلة"];

  function computePairedCommission(equipmentName, driverLog, contractorLog) {
    if (WINCH_PERCENTAGE_EQUIPMENT.includes(equipmentName)) {
      const k = contractorLog.day_rate ?? 0;
      return k <= 2500 ? k * 0.2 : k * 0.175;
    }
    const k = contractorLog.day_rate ?? 0;
    const h = driverLog.day_rate ?? 0;
    const baseHours = contractorLog.base_hours || 8;
    const overtimeHours = Math.max(0, (contractorLog.actual_hours ?? 0) - (contractorLog.base_hours ?? 0));
    return (k - h) + overtimeHours * (k / baseHours - h / baseHours);
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

      const driverByDate = new Map(driverLogs.map((l) => [l.date, l]));
      for (const contractorLog of contractorLogs) {
        const driverLog = driverByDate.get(contractorLog.date);
        if (!driverLog) continue;
        rows.push({
          equipment_id: equipment.id,
          equipment_name: equipment.name,
          date: contractorLog.date,
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
  ipcMain.handle("hassan:treasuryBalance", (_e, { month }) => {
    const allTimeCommission = computeCommissionRows(null).total;
    const monthCommission = computeCommissionRows(month).total;
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
    };
  });

  ipcMain.handle("hassanTreasury:list", (_e, { month }) =>
    db.prepare("SELECT * FROM hassan_treasury_expenses WHERE date LIKE ? ORDER BY date DESC").all(`${month}%`)
  );
  ipcMain.handle("hassanTreasury:create", (_e, expense) => {
    const info = db
      .prepare("INSERT INTO hassan_treasury_expenses (date, amount, description) VALUES (@date, @amount, @description)")
      .run(expense);
    return db.prepare("SELECT * FROM hassan_treasury_expenses WHERE id = ?").get(info.lastInsertRowid);
  });
  ipcMain.handle("hassanTreasury:delete", (_e, { id }) => {
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

    const driverByDate = new Map(driverLogs.map((l) => [l.date, l]));
    const allRows = [];
    for (const contractorLog of contractorLogs) {
      const driverLog = driverByDate.get(contractorLog.date);
      if (!driverLog) continue;
      allRows.push({
        date: contractorLog.date,
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
    return db.prepare("SELECT * FROM hassan_ledger WHERE id = ?").get(info.lastInsertRowid);
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
    return db.prepare("SELECT * FROM contractor_payments WHERE id = ?").get(info.lastInsertRowid);
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
    return db.prepare("SELECT * FROM partner_payments WHERE id = ?").get(info.lastInsertRowid);
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
      return {
        equipment_name: s.equipment_name,
        percentage: s.percentage,
        monthAmount: (netProfit * s.percentage) / 100,
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

  // --- Treasury (doc section 9) ---
  // Money in: contractor payments (they pay the company). Money out:
  // partner payments, equipment expenses, supplier payments, employee
  // advances — each already carries a payment_method/method tying it to
  // one of the three accounts.
  const ACCOUNT_NAME_AR = { wallet: "اكسيس باي", instapay: "انستا باي", cash: "كاش", vodafone_cash: "فودفون كاش" };

  ipcMain.handle("treasury:list", () => {
    const rows = db.prepare("SELECT * FROM treasury_accounts ORDER BY id").all();
    return rows.map((r) => ({ ...r, name_ar: ACCOUNT_NAME_AR[r.name] ?? r.name }));
  });

  ipcMain.handle("treasury:updateBalance", (_e, { id, current_balance }) => {
    db.prepare("UPDATE treasury_accounts SET current_balance = ? WHERE id = ?").run(current_balance, id);
    return db.prepare("SELECT * FROM treasury_accounts WHERE id = ?").get(id);
  });

  ipcMain.handle("treasury:summary", (_e, { month }) => {
    const accounts = db.prepare("SELECT * FROM treasury_accounts ORDER BY id").all();
    const sumByMethod = (table, methodCol, dateCol, dateLike) =>
      db
        .prepare(`SELECT ${methodCol} AS method, COALESCE(SUM(amount), 0) AS total FROM ${table} WHERE ${dateCol} LIKE ? GROUP BY ${methodCol}`)
        .all(dateLike)
        .reduce((acc, r) => ({ ...acc, [r.method]: r.total }), {});

    const incoming = sumByMethod("contractor_payments", "method", "date", `${month}%`);
    const outgoingPartners = sumByMethod("partner_payments", "method", "date", `${month}%`);
    const outgoingExpenses = sumByMethod("monthly_expenses", "payment_method", "month", month);
    const outgoingSuppliers = sumByMethod("supplier_payments", "method", "date", `${month}%`);
    // السلف والمكافآت ودفعات المرتب بتتحسب على الشهر اللي المرتب بيخصه (زي
    // مصروفات المعدات) — لو مرتب يونيو اتدفع في يوليو يفضل يسمع في يونيو هنا برضو.
    const outgoingAdvances = sumByMethod("employee_advances", "payment_method", "month", month);
    const outgoingBonuses = sumByMethod("employee_bonuses", "payment_method", "month", month);
    const outgoingSalaryPayments = sumByMethod("salary_payments", "payment_method", "month", month);

    return accounts.map((acc) => {
      const monthIncoming = incoming[acc.name] ?? 0;
      const monthOutgoing =
        (outgoingPartners[acc.name] ?? 0) +
        (outgoingExpenses[acc.name] ?? 0) +
        (outgoingSuppliers[acc.name] ?? 0) +
        (outgoingAdvances[acc.name] ?? 0) +
        (outgoingBonuses[acc.name] ?? 0) +
        (outgoingSalaryPayments[acc.name] ?? 0);
      const netMovement = monthIncoming - monthOutgoing;
      return {
        id: acc.id,
        name: acc.name,
        name_ar: ACCOUNT_NAME_AR[acc.name] ?? acc.name,
        currentBalance: acc.current_balance,
        monthIncoming,
        monthOutgoing,
        netMovement,
        projectedBalance: acc.current_balance + netMovement,
      };
    });
  });

  // --- كشف حساب كل وسيلة دفع لوحدها — كل حركة فعلية دخلت أو خرجت من الحساب
  // ده الشهر ده، بتاريخها وبيان واضح بيها. بيستخدم نفس منطق treasury:summary
  // (بتاريخ الدفع الحقيقي، مش شهر الدفاتر) عشان الأرقام تتطابق مع بعضها. ---
  ipcMain.handle("treasury:accountTransactions", (_e, { account_name, month }) => {
    const rows = [];

    db.prepare(
      `SELECT me.date, me.amount, e.name AS equipment_name, ec.name AS category_name
       FROM monthly_expenses me
       JOIN equipment e ON e.id = me.equipment_id
       LEFT JOIN expense_categories ec ON ec.id = me.category_id
       WHERE me.payment_method = ? AND me.month = ?`
    )
      .all(account_name, month)
      .forEach((r) =>
        rows.push({
          date: r.date ?? month,
          direction: "out",
          label: `مصروف ${r.category_name ?? "بدون نوع"} — ${r.equipment_name}`,
          amount: r.amount,
        })
      );

    db.prepare(
      `SELECT ea.date, ea.amount, e.name AS employee_name FROM employee_advances ea
       JOIN employees e ON e.id = ea.employee_id
       WHERE ea.payment_method = ? AND ea.month = ?`
    )
      .all(account_name, month)
      .forEach((r) => {
        const note = equipmentDaysNote(db, r.employee_name, month);
        rows.push({
          date: r.date,
          direction: "out",
          label: `سلفة: ${r.employee_name}${note ? ` (${note})` : ""}`,
          amount: r.amount,
        });
      });

    db.prepare(
      `SELECT eb.date, eb.amount, e.name AS employee_name FROM employee_bonuses eb
       JOIN employees e ON e.id = eb.employee_id
       WHERE eb.payment_method = ? AND eb.month = ?`
    )
      .all(account_name, month)
      .forEach((r) => {
        const note = equipmentDaysNote(db, r.employee_name, month);
        rows.push({
          date: r.date,
          direction: "out",
          label: `مكافأة: ${r.employee_name}${note ? ` (${note})` : ""}`,
          amount: r.amount,
        });
      });

    db.prepare(
      `SELECT sp.date, sp.amount, e.name AS employee_name FROM salary_payments sp
       JOIN employees e ON e.id = sp.employee_id
       WHERE sp.payment_method = ? AND sp.month = ?`
    )
      .all(account_name, month)
      .forEach((r) => {
        const note = equipmentDaysNote(db, r.employee_name, month);
        rows.push({
          date: r.date,
          direction: "out",
          label: `دفعة مرتب: ${r.employee_name}${note ? ` (${note})` : ""}`,
          amount: r.amount,
        });
      });

    db.prepare(
      `SELECT pp.date, pp.amount, p.name AS partner_name FROM partner_payments pp
       JOIN partners p ON p.id = pp.partner_id
       WHERE pp.method = ? AND pp.date LIKE ?`
    )
      .all(account_name, `${month}%`)
      .forEach((r) => rows.push({ date: r.date, direction: "out", label: `دفعة للشريك: ${r.partner_name}`, amount: r.amount }));

    db.prepare(
      `SELECT sp.date, sp.amount, s.name AS supplier_name FROM supplier_payments sp
       JOIN suppliers s ON s.id = sp.supplier_id
       WHERE sp.method = ? AND sp.date LIKE ?`
    )
      .all(account_name, `${month}%`)
      .forEach((r) => rows.push({ date: r.date, direction: "out", label: `دفعة للمورد: ${r.supplier_name}`, amount: r.amount }));

    db.prepare(`SELECT date, amount, note FROM waste_entries WHERE payment_method = ? AND date LIKE ?`)
      .all(account_name, `${month}%`)
      .forEach((r) => rows.push({ date: r.date, direction: "out", label: `هالك${r.note ? `: ${r.note}` : ""}`, amount: r.amount }));

    db.prepare(
      `SELECT cp.date, cp.amount, c.name AS contractor_name FROM contractor_payments cp
       JOIN contractors c ON c.id = cp.contractor_id
       WHERE cp.method = ? AND cp.date LIKE ?`
    )
      .all(account_name, `${month}%`)
      .forEach((r) => rows.push({ date: r.date, direction: "in", label: `دفعة من المقاول: ${r.contractor_name}`, amount: r.amount }));

    rows.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    return rows;
  });

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
    return { ...db.prepare("SELECT * FROM supplier_purchases WHERE id = ?").get(info.lastInsertRowid), supplier_name: supplier.name };
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
    return { ...db.prepare("SELECT * FROM supplier_payments WHERE id = ?").get(info.lastInsertRowid), supplier_name: supplier.name };
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
      return { equipment_name: eq.name, income, expense, netProfit: income - expense };
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
      const driverByDate = new Map(driverLogs.map((l) => [l.date, l]));
      for (const cl of contractorLogs) {
        const dl = driverByDate.get(cl.date);
        if (!dl) continue;
        commissionRows.push(computePairedCommission(eq.name, dl, cl));
      }
      for (const ml of marketLogs) commissionRows.push(ml.hassan_commission ?? 0);
    }
    const hassanCommissionTotal = commissionRows.reduce((sum, c) => sum + c, 0);

    const treasuryAccounts = db.prepare("SELECT * FROM treasury_accounts ORDER BY id").all();

    return {
      month,
      equipmentRows,
      totalIncome,
      totalExpense,
      netProfit: totalIncome - totalExpense,
      payrollTotal,
      hassanCommissionTotal,
      treasuryBalances: treasuryAccounts.map((a) => ({ name: a.name, name_ar: ACCOUNT_NAME_AR[a.name] ?? a.name, balance: a.current_balance })),
    };
  });

  // --- Dashboard: live headline numbers for the home page, computed from
  // the real database for the current calendar year — replaces the old
  // hardcoded Excel-snapshot placeholder that never got wired up. ---
  const MONTH_NAMES_AR = [
    "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
    "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
  ];

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
      return { profit: income - expense, expense };
    }

    const equipmentAnnualExpense = new Map(equipmentList.map((e) => [e.id, 0]));
    const monthlyProfitTrend = [];
    let totalAnnualProfit = 0;
    let totalAnnualExpense = 0;

    for (let m = 0; m < 12; m++) {
      const monthKey = `${year}-${String(m + 1).padStart(2, "0")}`;
      let monthProfit = 0;
      for (const eq of equipmentList) {
        const { profit, expense } = equipmentMonthTotals(eq.id, monthKey);
        monthProfit += profit;
        totalAnnualExpense += expense;
        equipmentAnnualExpense.set(eq.id, equipmentAnnualExpense.get(eq.id) + expense);
      }
      monthlyProfitTrend.push({ month: MONTH_NAMES_AR[m], profit: monthProfit });
      totalAnnualProfit += monthProfit;
    }

    const equipmentExpenses = equipmentList.map((eq) => ({
      name: eq.name,
      annualExpense: equipmentAnnualExpense.get(eq.id),
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
    return db.prepare("SELECT * FROM waste_entries WHERE id = ?").get(info.lastInsertRowid);
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

    const totalOutgoing = equipmentExpensesTotal + partnerPaymentsTotal + supplierPaymentsTotal + payrollTotal + wasteTotal;

    return {
      equipmentExpenses,
      categoryTotals,
      equipmentExpensesTotal,
      partnerPayments,
      partnerPaymentsTotal,
      supplierPayments,
      supplierPaymentsTotal,
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
      db.prepare("DELETE FROM contractor_payments").run();
      db.prepare("DELETE FROM partner_payments").run();
      db.prepare("DELETE FROM supplier_purchases").run();
      db.prepare("DELETE FROM supplier_payments").run();
      db.prepare("DELETE FROM waste_entries").run();
      db.prepare("UPDATE treasury_accounts SET current_balance = 0").run();
    });
    tx();
    return { ok: true };
  });
}

module.exports = { registerIpcHandlers };
