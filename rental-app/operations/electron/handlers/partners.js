// الشركاء
module.exports = function register(db, ipcMain, shared) {
  const { pushToCloud } = shared;

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
  ipcMain.handle("partners:rename", (_e, { id, name }) => {
    const trimmed = (name ?? "").trim();
    if (!trimmed) throw new Error("لازم تكتب اسم الشريك");
    const clash = db.prepare("SELECT id FROM partners WHERE name = ? AND id != ?").get(trimmed, id);
    if (clash) throw new Error("فيه شريك تاني بنفس الاسم ده");
    db.prepare("UPDATE partners SET name = ? WHERE id = ?").run(trimmed, id);
    const updated = db.prepare("SELECT * FROM partners WHERE id = ?").get(id);
    pushToCloud("partners", id, { name: updated.name, opening_balance: updated.opening_balance });
    return updated;
  });
  ipcMain.handle("partners:updateOpeningBalance", (_e, { id, opening_balance }) => {
    db.prepare("UPDATE partners SET opening_balance = ? WHERE id = ?").run(opening_balance, id);
    const updated = db.prepare("SELECT * FROM partners WHERE id = ?").get(id);
    pushToCloud("partners", id, { name: updated.name, opening_balance: updated.opening_balance });
    return updated;
  });
};
