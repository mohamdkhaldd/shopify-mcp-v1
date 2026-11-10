// الموردين
module.exports = function register(db, ipcMain, shared) {
  const { pushToCloud } = shared;

  // --- Suppliers (doc section 10) — no fixed list, created on first purchase/payment ---
  function findOrCreateSupplier(name) {
    const trimmed = name.trim();
    const existing = db.prepare("SELECT * FROM suppliers WHERE name = ?").get(trimmed);
    if (existing) return existing;
    const info = db.prepare("INSERT INTO suppliers (name) VALUES (?)").run(trimmed);
    return { id: info.lastInsertRowid, name: trimmed };
  }

  // بس أسماء الموردين اللي لسه معاهم عملية بيع أو شراء فعلية — مورد اتمسحت
  // كل حركاته منها مالوش داعي يفضل ظاهر في اقتراحات الاسم.
  ipcMain.handle("suppliers:names", () =>
    db
      .prepare(
        `SELECT name FROM suppliers s
         WHERE EXISTS (SELECT 1 FROM supplier_purchases WHERE supplier_id = s.id)
            OR EXISTS (SELECT 1 FROM supplier_payments WHERE supplier_id = s.id)
         ORDER BY name`
      )
      .all()
      .map((r) => r.name)
  );

  ipcMain.handle("supplierPurchases:create", (_e, purchase) => {
    const supplier = findOrCreateSupplier(purchase.supplier_name);
    const info = db
      .prepare(
        `INSERT INTO supplier_purchases (supplier_id, date, description, amount, note)
         VALUES (@supplier_id, @date, @description, @amount, @note)`
      )
      .run({
        supplier_id: supplier.id,
        date: purchase.date,
        description: purchase.description ?? null,
        amount: purchase.amount,
        note: purchase.note ?? null,
      });
    const created = { ...db.prepare("SELECT * FROM supplier_purchases WHERE id = ?").get(info.lastInsertRowid), supplier_name: supplier.name };
    pushToCloud("supplier_purchases", created.id, created);
    return created;
  });

  ipcMain.handle("supplierPayments:create", (_e, payment) => {
    const supplier = findOrCreateSupplier(payment.supplier_name);
    const info = db
      .prepare(
        `INSERT INTO supplier_payments (supplier_id, date, amount, method, note)
         VALUES (@supplier_id, @date, @amount, @method, @note)`
      )
      .run({
        supplier_id: supplier.id,
        date: payment.date,
        amount: payment.amount,
        method: payment.method || "cash",
        note: payment.note ?? null,
      });
    const created = { ...db.prepare("SELECT * FROM supplier_payments WHERE id = ?").get(info.lastInsertRowid), supplier_name: supplier.name };
    pushToCloud("supplier_payments", created.id, created);
    return created;
  });

  ipcMain.handle("supplierPurchases:delete", (_e, { id }) => {
    db.prepare("DELETE FROM supplier_purchases WHERE id = ?").run(id);
    return { ok: true };
  });
  ipcMain.handle("supplierPayments:delete", (_e, { id }) => {
    db.prepare("DELETE FROM supplier_payments WHERE id = ?").run(id);
    return { ok: true };
  });

  // Dynamic dashboard: any supplier named on a purchase/payment shows up
  // here automatically, no setup step.
  ipcMain.handle("suppliers:dashboard", () => {
    const suppliers = db.prepare("SELECT * FROM suppliers ORDER BY name").all();
    const purchasesStmt = db.prepare("SELECT * FROM supplier_purchases WHERE supplier_id = ? ORDER BY date DESC");
    const paymentsStmt = db.prepare("SELECT * FROM supplier_payments WHERE supplier_id = ? ORDER BY date DESC");

    return suppliers
      .map((s) => {
        const purchases = purchasesStmt.all(s.id);
        const payments = paymentsStmt.all(s.id);
        const totalPurchases = purchases.reduce((sum, p) => sum + p.amount, 0);
        const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
        return {
          id: s.id,
          name: s.name,
          purchaseCount: purchases.length,
          totalPurchases,
          totalPaid,
          remaining: totalPurchases - totalPaid,
          purchases,
          payments,
        };
      })
      // مورد من غير أي مشترى أو دفعة (زي بعد ما تتمسح كل حركاته) مالوش داعي
      // يفضل ظاهر في القايمة فاضي.
      .filter((s) => s.purchases.length > 0 || s.payments.length > 0);
  });
};
