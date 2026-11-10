const { computeDayValue, equipmentMonthNetProfit } = require("../calc");

// الآجل والدائنين
module.exports = function register(db, ipcMain, shared) {
  const { equipmentAllTimeProfit } = shared;

  // --- الآجل (اللي علينا) ---
  // مصروفات المعدات اللي لسه ليها باقي، ونصيب كل شريك اللي لسه متدفعلوش
  // (الشهر ده والسنة دي)، وإجمالي المستحق للموردين.
  function expensePaidTotal(expense) {
    const later = db
      .prepare("SELECT COALESCE(SUM(amount), 0) AS total FROM expense_payments WHERE expense_id = ?")
      .get(expense.id).total;
    return (expense.paid_amount ?? expense.amount) + later;
  }

  ipcMain.handle("expensePayments:create", (_e, { expense_id, date, amount, method, note }) => {
    db.prepare("INSERT INTO expense_payments (expense_id, date, amount, method, note) VALUES (?, ?, ?, ?, ?)").run(
      expense_id,
      date,
      Number(amount) || 0,
      method,
      note?.trim() || null
    );
    return { ok: true };
  });
  ipcMain.handle("expensePayments:delete", (_e, { id }) => {
    db.prepare("DELETE FROM expense_payments WHERE id = ?").run(id);
    return { ok: true };
  });

  // --- فلوس علينا لجهات تانية ---
  // الباقي = الرصيد الافتتاحي + كل الديون − كل السدادات.
  function creditorBalances() {
    const sumStmt = db.prepare("SELECT COALESCE(SUM(amount), 0) AS total FROM creditor_entries WHERE creditor_id = ? AND type = ?");
    return db
      .prepare("SELECT * FROM creditors ORDER BY name")
      .all()
      .map((c) => {
        const debts = sumStmt.get(c.id, "debt").total;
        const paid = sumStmt.get(c.id, "payment").total;
        const opening = c.opening_balance ?? 0;
        return { id: c.id, name: c.name, note: c.note, openingBalance: opening, debts, paid, remaining: opening + debts - paid };
      });
  }
  ipcMain.handle("creditors:list", () => creditorBalances());
  ipcMain.handle("creditors:create", (_e, { name, opening_balance, note }) => {
    const trimmed = (name ?? "").trim();
    if (!trimmed) throw new Error("لازم اسم الجهة");
    if (db.prepare("SELECT 1 FROM creditors WHERE name = ?").get(trimmed)) throw new Error("الاسم ده موجود قبل كده");
    const info = db
      .prepare("INSERT INTO creditors (name, opening_balance, note) VALUES (?, ?, ?)")
      .run(trimmed, Number(opening_balance) || 0, note?.trim() || null);
    return db.prepare("SELECT * FROM creditors WHERE id = ?").get(info.lastInsertRowid);
  });
  ipcMain.handle("creditors:update", (_e, { id, name, opening_balance, note }) => {
    const trimmed = (name ?? "").trim();
    if (!trimmed) throw new Error("لازم اسم الجهة");
    db.prepare("UPDATE creditors SET name = ?, opening_balance = ?, note = ? WHERE id = ?").run(
      trimmed,
      Number(opening_balance) || 0,
      note?.trim() || null,
      id
    );
    return db.prepare("SELECT * FROM creditors WHERE id = ?").get(id);
  });
  ipcMain.handle("creditors:delete", (_e, { id }) => {
    db.prepare("DELETE FROM creditors WHERE id = ?").run(id);
    return { ok: true };
  });
  // كشف حساب جهة: كل الحركات بالترتيب والباقي بعد كل حركة.
  ipcMain.handle("creditors:statement", (_e, { id }) => {
    const c = creditorBalances().find((x) => x.id === id);
    if (!c) throw new Error("الجهة مش موجودة");
    let balance = c.openingBalance;
    const entries = db
      .prepare("SELECT * FROM creditor_entries WHERE creditor_id = ? ORDER BY date, id")
      .all(id)
      .map((e) => {
        balance += e.type === "debt" ? e.amount : -e.amount;
        return { ...e, balance };
      });
    return { ...c, entries };
  });
  ipcMain.handle("creditorEntries:create", (_e, { creditor_id, date, type, amount, method, note }) => {
    if (!["debt", "payment"].includes(type)) throw new Error("نوع الحركة غلط");
    if (!(Number(amount) > 0)) throw new Error("لازم مبلغ");
    const info = db
      .prepare("INSERT INTO creditor_entries (creditor_id, date, type, amount, method, note) VALUES (?, ?, ?, ?, ?, ?)")
      .run(creditor_id, date, type, Number(amount), type === "payment" ? method || "cash" : null, note?.trim() || null);
    return db.prepare("SELECT * FROM creditor_entries WHERE id = ?").get(info.lastInsertRowid);
  });
  ipcMain.handle("creditorEntries:delete", (_e, { id }) => {
    db.prepare("DELETE FROM creditor_entries WHERE id = ?").run(id);
    return { ok: true };
  });

  ipcMain.handle("payables:summary", (_e, { month }) => {
    const expenses = db
      .prepare(
        `SELECT me.*, e.name AS equipment_name, ec.name AS category_name FROM monthly_expenses me
         JOIN equipment e ON e.id = me.equipment_id
         LEFT JOIN expense_categories ec ON ec.id = me.category_id
         WHERE me.paid_amount IS NOT NULL
         ORDER BY COALESCE(me.date, me.month || '-01')`
      )
      .all()
      .map((me) => {
        const paid = expensePaidTotal(me);
        return {
          id: me.id,
          equipment_name: me.equipment_name,
          category_name: me.category_name,
          payee: me.payee,
          date: me.date ?? `${me.month}-01`,
          note: me.note,
          amount: me.amount,
          paid,
          remaining: me.amount - paid,
        };
      })
      .filter((e) => e.remaining > 0.005);

    const year = month.slice(0, 4);
    const yearMonths = Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, "0")}`);
    const profitCache = new Map();
    const eqProfit = (equipmentId, m) => {
      const key = `${equipmentId}|${m}`;
      if (!profitCache.has(key)) profitCache.set(key, equipmentMonthNetProfit(db, equipmentId, m));
      return profitCache.get(key);
    };
    const paidStmt = db.prepare("SELECT COALESCE(SUM(amount), 0) AS total FROM partner_payments WHERE partner_id = ? AND date LIKE ?");
    const partners = db
      .prepare("SELECT * FROM partners ORDER BY name")
      .all()
      .map((p) => {
        const shares = db.prepare("SELECT equipment_id, percentage FROM equipment_partner_shares WHERE partner_id = ?").all(p.id);
        const shareOf = (m) => shares.reduce((sum, sh) => sum + (eqProfit(sh.equipment_id, m) * sh.percentage) / 100, 0);
        const monthDue = shareOf(month) - paidStmt.get(p.id, `${month}%`).total;
        const yearDue = yearMonths.reduce((sum, m) => sum + shareOf(m), 0) - paidStmt.get(p.id, `${year}%`).total;
        // الإجمالي = الرصيد الافتتاحي (فلوس قديمة ليه قبل السيستم) + نصيبه من
        // كل الأرباح من الأول − كل اللي اتدفعله — نفس "الباقي" في صفحة الشركاء.
        const allTimeShare = shares.reduce((sum, sh) => sum + (equipmentAllTimeProfit(sh.equipment_id) * sh.percentage) / 100, 0);
        const totalDue = (p.opening_balance ?? 0) + allTimeShare - paidStmt.get(p.id, "%").total;
        return { id: p.id, name: p.name, monthDue, yearDue, openingBalance: p.opening_balance ?? 0, totalDue };
      })
      .filter((p) => Math.abs(p.monthDue) > 0.005 || Math.abs(p.yearDue) > 0.005 || Math.abs(p.totalDue) > 0.005);

    // لينا عند المقاولين: الرصيد الافتتاحي (فلوس قديمة عليهم قبل السيستم) +
    // قيمة كل شغلهم − كل اللي دفعوه — نفس "الباقي" في صفحة المقاولين.
    const contractorWorkStmt = db.prepare("SELECT * FROM daily_logs WHERE role = 'contractor' AND person_name = ?");
    const contractorPaidStmt = db.prepare("SELECT COALESCE(SUM(amount), 0) AS total FROM contractor_payments WHERE contractor_id = ?");
    const receivables = db
      .prepare("SELECT * FROM contractors ORDER BY name")
      .all()
      .map((c) => {
        const work = contractorWorkStmt.all(c.name).reduce((sum, l) => sum + computeDayValue(l), 0);
        const paid = contractorPaidStmt.get(c.id).total;
        return { id: c.id, name: c.name, openingBalance: c.opening_balance ?? 0, work, paid, remaining: (c.opening_balance ?? 0) + work - paid };
      })
      .filter((c) => Math.abs(c.remaining) > 0.005);

    const suppliersDue = db
      .prepare(
        `SELECT COALESCE((SELECT SUM(amount) FROM supplier_purchases), 0) - COALESCE((SELECT SUM(amount) FROM supplier_payments), 0) AS total`
      )
      .get().total;

    const creditors = creditorBalances().filter((c) => Math.abs(c.remaining) > 0.005);
    const creditorsDue = creditors.reduce((sum, c) => sum + Math.max(0, c.remaining), 0);

    const recentPayments = db
      .prepare(
        `SELECT ep.*, e.name AS equipment_name, ec.name AS category_name, me.payee FROM expense_payments ep
         JOIN monthly_expenses me ON me.id = ep.expense_id
         JOIN equipment e ON e.id = me.equipment_id
         LEFT JOIN expense_categories ec ON ec.id = me.category_id
         WHERE ep.date LIKE ? ORDER BY ep.date DESC, ep.id DESC`
      )
      .all(`${month}%`);

    const expensesDue = expenses.reduce((sum, e) => sum + e.remaining, 0);
    const partnersTotalDue = partners.reduce((sum, p) => sum + Math.max(0, p.totalDue), 0);
    return {
      month,
      expenses,
      partners,
      receivables,
      suppliersDue,
      recentPayments,
      expensesDue,
      partnersMonthDue: partners.reduce((sum, p) => sum + p.monthDue, 0),
      partnersYearDue: partners.reduce((sum, p) => sum + p.yearDue, 0),
      partnersOpening: partners.reduce((sum, p) => sum + p.openingBalance, 0),
      partnersTotalDue,
      receivablesTotal: receivables.reduce((sum, c) => sum + Math.max(0, c.remaining), 0),
      creditors,
      creditorsDue,
      totalDue: expensesDue + partnersTotalDue + Math.max(0, suppliersDue) + creditorsDue,
    };
  });

  ipcMain.handle("treasury:extras", (_e, { month }) => ({
    transfers: db.prepare("SELECT * FROM treasury_transfers WHERE date LIKE ? ORDER BY date DESC, id DESC").all(`${month}%`),
    otherIncome: db.prepare("SELECT * FROM other_income WHERE date LIKE ? ORDER BY date DESC, id DESC").all(`${month}%`),
    adjustments: db.prepare("SELECT * FROM treasury_adjustments WHERE date LIKE ? ORDER BY date DESC, id DESC").all(`${month}%`),
  }));
};
