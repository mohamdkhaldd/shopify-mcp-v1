// الموظفين والسواقين
module.exports = function register(db, ipcMain, shared) {
  const { pushToCloud } = shared;

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
};
