const { ipcMain } = require("electron");

// Overtime rule (doc section 3), applied identically to السركي and المقاول:
// hourly rate = day_rate / 8, overtime = MAX(0, actual - base) hours,
// day value = day_rate + overtime_hours * hourly_rate. سركي سوق has no
// hours at all — the day value is just whatever fixed amount was entered.
function computeDayValue(log) {
  if (log.role === "market") return log.fixed_value ?? 0;
  const dayRate = log.day_rate ?? 0;
  const hourlyRate = dayRate / 8;
  const overtimeHours = Math.max(0, (log.actual_hours ?? 0) - (log.base_hours ?? 0));
  return dayRate + overtimeHours * hourlyRate;
}

function registerIpcHandlers(db) {
  // --- Partners ---
  ipcMain.handle("partners:list", () => db.prepare("SELECT * FROM partners ORDER BY name").all());
  ipcMain.handle("partners:create", (_e, { name }) => {
    const info = db.prepare("INSERT INTO partners (name) VALUES (?)").run(name.trim());
    return { id: info.lastInsertRowid, name: name.trim() };
  });
  ipcMain.handle("partners:delete", (_e, { id }) => {
    db.prepare("DELETE FROM partners WHERE id = ?").run(id);
    return { ok: true };
  });

  // --- Employees (drivers / salaried workers) ---
  ipcMain.handle("employees:list", () => db.prepare("SELECT * FROM employees ORDER BY name").all());
  ipcMain.handle("employees:create", (_e, { name, wage_type, rate }) => {
    const info = db
      .prepare("INSERT INTO employees (name, wage_type, rate) VALUES (?, ?, ?)")
      .run(name.trim(), wage_type, rate);
    return { id: info.lastInsertRowid, name: name.trim(), wage_type, rate };
  });
  ipcMain.handle("employees:delete", (_e, { id }) => {
    db.prepare("DELETE FROM employees WHERE id = ?").run(id);
    return { ok: true };
  });

  // --- Contractors ---
  ipcMain.handle("contractors:list", () => db.prepare("SELECT * FROM contractors ORDER BY name").all());
  ipcMain.handle("contractors:create", (_e, { name }) => {
    const info = db.prepare("INSERT INTO contractors (name) VALUES (?)").run(name.trim());
    return { id: info.lastInsertRowid, name: name.trim() };
  });
  ipcMain.handle("contractors:delete", (_e, { id }) => {
    db.prepare("DELETE FROM contractors WHERE id = ?").run(id);
    return { ok: true };
  });

  // --- Expense categories ---
  ipcMain.handle("expenseCategories:list", () =>
    db.prepare("SELECT * FROM expense_categories ORDER BY name").all()
  );
  ipcMain.handle("expenseCategories:create", (_e, { name }) => {
    const info = db.prepare("INSERT INTO expense_categories (name) VALUES (?)").run(name.trim());
    return { id: info.lastInsertRowid, name: name.trim() };
  });
  ipcMain.handle("expenseCategories:delete", (_e, { id }) => {
    db.prepare("DELETE FROM expense_categories WHERE id = ?").run(id);
    return { ok: true };
  });

  // --- Equipment (+ partner shares) ---
  const getEquipmentWithShares = () => {
    const rows = db.prepare("SELECT * FROM equipment ORDER BY name").all();
    const shareStmt = db.prepare(
      "SELECT partner_id, percentage FROM equipment_partner_shares WHERE equipment_id = ?"
    );
    return rows.map((row) => ({ ...row, shares: shareStmt.all(row.id) }));
  };

  ipcMain.handle("equipment:list", () => getEquipmentWithShares());

  ipcMain.handle("equipment:create", (_e, { name, shares }) => {
    const insertEquipment = db.prepare("INSERT INTO equipment (name) VALUES (?)");
    const insertShare = db.prepare(
      "INSERT INTO equipment_partner_shares (equipment_id, partner_id, percentage) VALUES (?, ?, ?)"
    );
    const tx = db.transaction(() => {
      const info = insertEquipment.run(name.trim());
      const equipmentId = info.lastInsertRowid;
      for (const share of shares ?? []) {
        insertShare.run(equipmentId, share.partner_id, share.percentage);
      }
      return equipmentId;
    });
    const equipmentId = tx();
    return getEquipmentWithShares().find((e) => e.id === equipmentId);
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

  ipcMain.handle("dailyLogs:create", (_e, log) => {
    const info = db
      .prepare(
        `INSERT INTO daily_logs (equipment_id, date, role, person_name, actual_hours, base_hours, day_rate, fixed_value)
         VALUES (@equipment_id, @date, @role, @person_name, @actual_hours, @base_hours, @day_rate, @fixed_value)`
      )
      .run({
        equipment_id: log.equipment_id,
        date: log.date,
        role: log.role,
        person_name: log.person_name,
        actual_hours: log.actual_hours ?? null,
        base_hours: log.base_hours ?? null,
        day_rate: log.day_rate ?? null,
        fixed_value: log.fixed_value ?? null,
      });
    const row = db.prepare("SELECT * FROM daily_logs WHERE id = ?").get(info.lastInsertRowid);
    return { ...row, day_value: computeDayValue(row) };
  });

  ipcMain.handle("dailyLogs:delete", (_e, { id }) => {
    db.prepare("DELETE FROM daily_logs WHERE id = ?").run(id);
    return { ok: true };
  });

  // --- Monthly expenses ---
  ipcMain.handle("monthlyExpenses:list", (_e, { equipment_id, month }) =>
    db
      .prepare(
        `SELECT me.*, ec.name AS category_name FROM monthly_expenses me
         LEFT JOIN expense_categories ec ON ec.id = me.category_id
         WHERE me.equipment_id = ? AND me.month = ? ORDER BY me.id`
      )
      .all(equipment_id, month)
  );

  ipcMain.handle("monthlyExpenses:create", (_e, expense) => {
    const info = db
      .prepare(
        `INSERT INTO monthly_expenses (equipment_id, month, category_id, amount, payment_method)
         VALUES (@equipment_id, @month, @category_id, @amount, @payment_method)`
      )
      .run(expense);
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
    const expenseTotal = expenses.reduce((sum, e) => sum + e.amount, 0);
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

    return { driverIncome, marketIncome, income, expenseTotal, netProfit, distribution };
  });
}

module.exports = { registerIpcHandlers };
