// شهادات المعايرة وضمان البطاريات: صورة الورقة، تاريخ البداية والنهاية، والمعدة
const KIND_LABEL = { calibration: "شهادة معايرة", battery: "ضمان بطارية", other: "ورقة" };

module.exports = function register(db, ipcMain) {
  const list = () =>
    db
      .prepare(
        `SELECT c.*, e.name AS equipment_name FROM certificates c LEFT JOIN equipment e ON e.id = c.equipment_id
         ORDER BY c.end_date, c.id`
      )
      .all();
  ipcMain.handle("certificates:list", () => list());
  ipcMain.handle("certificates:save", (_e, c) => {
    if (!c.end_date) throw new Error("لازم تاريخ الانتهاء");
    if (c.start_date && c.start_date > c.end_date) throw new Error("تاريخ البداية بعد النهاية");
    const kind = KIND_LABEL[c.kind] ? c.kind : "other";
    const row = [kind, c.title?.trim() || null, c.equipment_id || null, c.start_date || null, c.end_date, c.image ?? null, c.note?.trim() || null];
    if (c.id) {
      db.prepare("UPDATE certificates SET kind = ?, title = ?, equipment_id = ?, start_date = ?, end_date = ?, image = COALESCE(?, image), note = ? WHERE id = ?").run(...row, c.id);
      return { id: c.id };
    }
    return { id: Number(db.prepare("INSERT INTO certificates (kind, title, equipment_id, start_date, end_date, image, note) VALUES (?, ?, ?, ?, ?, ?, ?)").run(...row).lastInsertRowid) };
  });
  ipcMain.handle("certificates:delete", (_e, { id }) => {
    db.prepare("DELETE FROM certificates WHERE id = ?").run(id);
    return { ok: true };
  });
};
module.exports.KIND_LABEL = KIND_LABEL;
