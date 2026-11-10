// خزنة حسن والجزاءات
module.exports = function register(db, ipcMain, shared) {
  // --- خزنة حسن: كوميشنه المتراكم من أول ما اتسجلت أي بيانات، ناقص أي فلوس
  // دفعها هو من الخزنة دي (زي قسط أو إيجار) — رصيد شخصي بحت، مالوش أي علاقة
  // بخزنة الشركة (الكاش/المحفظة/انستا باي) خالص. ---
  // --- جزاءات حسن: بتتخصم من كوميشنه ومن رصيد خزنته. ---
  ipcMain.handle("hassanPenalties:list", (_e, { month }) =>
    db.prepare("SELECT * FROM hassan_penalties WHERE date LIKE ? ORDER BY date DESC, id DESC").all(`${month}%`)
  );
  ipcMain.handle("hassanPenalties:create", (_e, { date, amount, reason }) => {
    const info = db
      .prepare("INSERT INTO hassan_penalties (date, amount, reason) VALUES (?, ?, ?)")
      .run(date, amount, reason?.trim() || null);
    return db.prepare("SELECT * FROM hassan_penalties WHERE id = ?").get(info.lastInsertRowid);
  });
  ipcMain.handle("hassanPenalties:delete", (_e, { id }) => {
    db.prepare("DELETE FROM hassan_penalties WHERE id = ?").run(id);
    return { ok: true };
  });
};
