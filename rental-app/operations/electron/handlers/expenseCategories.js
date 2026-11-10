// بنود المصروفات
module.exports = function register(db, ipcMain, shared) {
  const { pushToCloud } = shared;

  // --- Expense categories ---
  ipcMain.handle("expenseCategories:list", () =>
    db.prepare("SELECT * FROM expense_categories ORDER BY name").all()
  );
  // own_fund: "خزنة لوحدها" (المكنيكي، السكن) — مبيتحسبش في الكوميشن.
  ipcMain.handle("expenseCategories:create", (_e, { name, counts_as_commission, own_fund }) => {
    const fund = own_fund ? 1 : 0;
    const commission = counts_as_commission && !fund ? 1 : 0;
    const info = db
      .prepare("INSERT INTO expense_categories (name, counts_as_commission, own_fund) VALUES (?, ?, ?)")
      .run(name.trim(), commission, fund);
    const created = { id: info.lastInsertRowid, name: name.trim(), counts_as_commission: !!commission, own_fund: !!fund };
    pushToCloud("expense_categories", created.id, created);
    return created;
  });
  // بيسمح تحدد نوع مصروف زي "مكنيكي" أو "سكن" إن قيمته على كل معدة تتحسب
  // تلقائيًا ضمن كوميشن حسن — مفيش داعي تسجلها مرتين.
  ipcMain.handle("expenseCategories:update", (_e, { id, name, counts_as_commission, own_fund }) => {
    const existing = db.prepare("SELECT * FROM expense_categories WHERE id = ?").get(id);
    const trimmedName = name.trim();
    const fund = own_fund ? 1 : 0;
    db.prepare("UPDATE expense_categories SET name = ?, counts_as_commission = ?, own_fund = ? WHERE id = ?").run(
      trimmedName,
      counts_as_commission && !fund ? 1 : 0,
      fund,
      id
    );
    pushToCloud("expense_categories", id, { name: trimmedName, counts_as_commission: !!counts_as_commission, old_name: existing?.name });
    return db.prepare("SELECT * FROM expense_categories WHERE id = ?").get(id);
  });
  ipcMain.handle("expenseCategories:delete", (_e, { id }) => {
    db.prepare("DELETE FROM expense_categories WHERE id = ?").run(id);
    return { ok: true };
  });
};
