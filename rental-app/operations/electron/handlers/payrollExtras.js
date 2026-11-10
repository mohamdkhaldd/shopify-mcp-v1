// السلف والحوافز والخصومات
module.exports = function register(db, ipcMain, shared) {
  const { pushToCloud } = shared;

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
};
