// المقاولين
module.exports = function register(db, ipcMain, shared) {
  const { pushToCloud } = shared;

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
};
