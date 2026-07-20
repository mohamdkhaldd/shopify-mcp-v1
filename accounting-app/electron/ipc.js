const { ipcMain } = require("electron");

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
}

module.exports = { registerIpcHandlers };
