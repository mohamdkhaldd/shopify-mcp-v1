// حساب حسن الشخصي
module.exports = function register(db, ipcMain, shared) {
  const { pushToCloud } = shared;

  // --- Hassan: personal ledger (doc section 7) — separate from commission ---
  ipcMain.handle("hassanLedger:list", (_e, { month }) =>
    db.prepare("SELECT * FROM hassan_ledger WHERE date LIKE ? ORDER BY date DESC").all(`${month}%`)
  );
  ipcMain.handle("hassanLedger:create", (_e, entry) => {
    const info = db
      .prepare(
        `INSERT INTO hassan_ledger (date, type, amount, party_name, description, note, method)
         VALUES (@date, @type, @amount, @party_name, @description, @note, @method)`
      )
      .run({
        date: entry.date,
        type: entry.type,
        amount: entry.amount,
        party_name: entry.party_name ?? null,
        description: entry.description ?? null,
        note: entry.note ?? null,
        method: entry.method || "cash",
      });
    const created = db.prepare("SELECT * FROM hassan_ledger WHERE id = ?").get(info.lastInsertRowid);
    pushToCloud("hassan_ledger", created.id, created);
    return created;
  });
  ipcMain.handle("hassanLedger:delete", (_e, { id }) => {
    db.prepare("DELETE FROM hassan_ledger WHERE id = ?").run(id);
    return { ok: true };
  });
  ipcMain.handle("hassanLedger:update", (_e, entry) => {
    db.prepare(
      `UPDATE hassan_ledger SET date = @date, type = @type, amount = @amount, party_name = @party_name, description = @description, method = @method
       WHERE id = @id`
    ).run({
      id: entry.id,
      date: entry.date,
      type: entry.type,
      amount: Number(entry.amount) || 0,
      party_name: entry.party_name?.trim() || null,
      description: entry.description?.trim() || null,
      method: entry.method || "cash",
    });
    return db.prepare("SELECT * FROM hassan_ledger WHERE id = ?").get(entry.id);
  });
  // الرصيد بالتفصيل: تغيير اسم شخص/جهة في كل حركاته، أو مسحه هو وكل حركاته.
  const partyWhere = "COALESCE(NULLIF(TRIM(party_name), ''), 'بدون تحديد') = ?";
  ipcMain.handle("hassanLedger:renameParty", (_e, { from, to }) => {
    const name = (to ?? "").trim();
    if (!name) throw new Error("اكتب الاسم الجديد");
    db.prepare(`UPDATE hassan_ledger SET party_name = ? WHERE ${partyWhere}`).run(name, from);
    return { ok: true };
  });
  ipcMain.handle("hassanLedger:deleteParty", (_e, { name }) => {
    db.prepare(`DELETE FROM hassan_ledger WHERE ${partyWhere}`).run(name);
    return { ok: true };
  });
  ipcMain.handle("hassanLedger:partyEntries", (_e, { name }) =>
    db.prepare(`SELECT * FROM hassan_ledger WHERE ${partyWhere} ORDER BY date, id`).all(name)
  );

  ipcMain.handle("hassanLedger:balance", () => {
    const sums = db
      .prepare("SELECT type, COALESCE(SUM(amount), 0) AS total FROM hassan_ledger GROUP BY type")
      .all();
    const byType = Object.fromEntries(sums.map((s) => [s.type, s.total]));
    const netDebt = (byType.loan ?? 0) - (byType.repayment ?? 0);
    const netDue = (byType.due ?? 0) - (byType.collection ?? 0);
    return { netDebt, netDue };
  });

  // Per-party breakdown: doc asks "who does Hassan owe, how much is left,
  // who owes Hassan, how much is left" by name, not just one lump total.
  ipcMain.handle("hassanLedger:balanceByParty", () => {
    const rows = db.prepare("SELECT * FROM hassan_ledger").all();
    const byParty = new Map();
    for (const row of rows) {
      const party = row.party_name?.trim() || "بدون تحديد";
      if (!byParty.has(party)) {
        byParty.set(party, { party_name: party, loan: 0, repayment: 0, due: 0, collection: 0 });
      }
      byParty.get(party)[row.type] += row.amount;
    }
    return [...byParty.values()]
      .map((p) => ({
        party_name: p.party_name,
        netDebt: p.loan - p.repayment,
        netDue: p.due - p.collection,
      }))
      .filter((p) => p.netDebt !== 0 || p.netDue !== 0)
      .sort((a, b) => a.party_name.localeCompare(b.party_name));
  });
};
