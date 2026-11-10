const { computeDriverWageValue, getEmployeeStateForMonth, monthlyEmployeeGrossPay } = require("../calc");

// المرتبات
module.exports = function register(db, ipcMain, shared) {
  const { payrollSummary, pushToCloud } = shared;

  // --- Payroll summary (doc section 5): daily wage = sum of driver day-values
  // across every equipment this month; monthly wage = prorated fixed rate.
  // Advances are deducted and bonuses are added for either type. ---
  ipcMain.handle("payroll:summary", (_e, { month }) => payrollSummary(month));

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
};
