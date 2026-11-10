// حسابات التشغيل الصافية: قيمة اليوم والأوفر، مرتب السواق، ربح المعدة في الشهر.
// دوال بتاخد قاعدة البيانات وترجّع أرقام — من غير أي قناة للشاشة.

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

// حساب المقاول شهر بشهر: شغل كل شهر، واتدفع عنه كام، والباقي. الدفعة اللي
// اخترت إنها "عن شهر كذا" بتروح للشهر ده؛ والدفعة من غير شهر بتسدد الشهور
// اللي فاتت الأول (الأقدم فالأحدث).
// "opening" = الرصيد القديم قبل أول شهر.
function contractorMonthBreakdown(db, contractor) {
  const logs = db
    .prepare("SELECT * FROM daily_logs WHERE role = 'contractor' AND person_name = ?")
    .all(contractor.name);
  const payments = db
    .prepare("SELECT * FROM contractor_payments WHERE contractor_id = ? ORDER BY date, id")
    .all(contractor.id);
  const rows = new Map();
  const row = (month) => {
    if (!rows.has(month)) rows.set(month, { month, work: 0, paid: 0, remaining: 0, covered: [] });
    return rows.get(month);
  };
  if (contractor.opening_balance) row("opening").work += contractor.opening_balance;
  for (const l of logs) row(l.date.slice(0, 7)).work += computeDayValue(l);
  // "opening" < أي "YYYY-MM"؟ لأ — فبنرتب بإيدينا: الرصيد القديم الأول.
  const ordered = [...rows.values()].sort((a, b) =>
    a.month === "opening" ? -1 : b.month === "opening" ? 1 : a.month.localeCompare(b.month)
  );
  // الدفعة اللي متحدد إنها "عن شهر كذا" بتروح للشهر ده؛ والزيادة عنه
  // والدفعات اللي من غير شهر بتسدد الأقدم الأول (بترتيب تاريخ الدفعة).
  // وكل شهر بيعرف اتسدد من أنهي دفعة وبكام.
  const byMonth = new Map(ordered.map((r) => [r.month, r]));
  const spread = (p, amount) => {
    let left = amount;
    for (const r of ordered) {
      if (left <= 0) break;
      const take = Math.min(left, Math.max(0, r.work - r.paid));
      if (take <= 0) continue;
      r.paid += take;
      r.covered.push({ date: p.date, amount: take, payment_id: p.id });
      left -= take;
    }
    return left;
  };
  const leftovers = [];
  for (const p of payments.filter((x) => x.for_month)) {
    const r = byMonth.get(p.for_month);
    const take = r ? Math.min(p.amount, Math.max(0, r.work - r.paid)) : 0;
    if (take > 0) {
      r.paid += take;
      r.covered.push({ date: p.date, amount: take, payment_id: p.id });
    }
    if (p.amount - take > 0) leftovers.push({ p, amount: p.amount - take });
  }
  let pool = 0;
  for (const p of payments.filter((x) => !x.for_month)) leftovers.push({ p, amount: p.amount });
  leftovers.sort((a, b) => a.p.date.localeCompare(b.p.date) || a.p.id - b.p.id);
  for (const { p, amount } of leftovers) pool += spread(p, amount);
  for (const r of ordered) r.remaining = r.work - r.paid;
  // pool اللي فاضل = دفع زيادة (مقدّم) عن كل اللي عليه.
  return { months: ordered.filter((r) => r.work !== 0 || r.paid !== 0), advance: pool };
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

// حافز السواق بيتحط مصروف على المعدة اللي اشتغل عليها في شهر الحافز — ولو
// اشتغل الشهر ده على أكتر من معدة بيتقسم على أيام شغله على كل واحدة.
function driverBonusShares(db, equipmentId, month) {
  const bonuses = db
    .prepare(
      `SELECT b.amount, COALESCE(NULLIF(b.month, ''), substr(b.date, 1, 7)) AS month, e.name
       FROM employee_bonuses b JOIN employees e ON e.id = b.employee_id
       ${month ? "WHERE COALESCE(NULLIF(b.month, ''), substr(b.date, 1, 7)) = ?" : ""}`
    )
    .all(...(month ? [month] : []));
  const daysStmt = db.prepare(
    `SELECT equipment_id, COUNT(*) AS c FROM daily_logs
     WHERE role = 'driver' AND person_name = ? AND date LIKE ? AND NOT (is_day_off = 1 AND is_paid_leave = 0)
     GROUP BY equipment_id`
  );
  const byName = new Map();
  for (const b of bonuses) {
    const rows = daysStmt.all(b.name, `${b.month}%`);
    const total = rows.reduce((sum, r) => sum + r.c, 0);
    const mine = rows.find((r) => r.equipment_id === equipmentId)?.c ?? 0;
    if (!total || !mine) continue;
    byName.set(b.name, (byName.get(b.name) ?? 0) + (b.amount * mine) / total);
  }
  return [...byName.entries()].map(([name, amount]) => ({ name, amount }));
}

function driverSalaryForEquipment(db, equipmentId, month) {
  const logs = month
    ? db
        .prepare("SELECT * FROM daily_logs WHERE equipment_id = ? AND role = 'driver' AND date LIKE ?")
        .all(equipmentId, `${month}%`)
    : db.prepare("SELECT * FROM daily_logs WHERE equipment_id = ? AND role = 'driver'").all(equipmentId);
  const cache = new Map();
  const wages = logs.reduce((sum, l) => sum + driverWageForLog(db, l, cache), 0);
  return wages + driverBonusShares(db, equipmentId, month).reduce((sum, b) => sum + b.amount, 0);
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
  const rows = [...byDriver.entries()].map(([name, amount]) => ({ name, amount }));
  for (const b of driverBonusShares(db, equipmentId, month)) rows.push({ name: `${b.name} — حافز`, amount: b.amount });
  return rows;
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

module.exports = { computeDayValue, contractorMonthBreakdown, computeDriverWageValue, getEmployeeStateForMonth, daysInMonthList, monthlyEmployeeGrossPay, equipmentDayCounts, equipmentDaysNote, driverWageForLog, driverBonusShares, driverSalaryForEquipment, driverSalaryBreakdownForEquipment, equipmentMonthNetProfit, equipmentShiftIncomeBreakdown };
