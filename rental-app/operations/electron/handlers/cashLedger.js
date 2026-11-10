// الهالك والصادر والوارد
module.exports = function register(db, ipcMain, shared) {
  const { pushToCloud } = shared;

  // --- الهالك (waste): money spent as an outright loss/write-off — logged
  // with a date, how it was paid, and a note describing what it was. Every
  // entry here also shows up inside "الصادر" below, since it's real company
  // cash going out just like any other expense. ---
  ipcMain.handle("waste:list", (_e, { month }) =>
    db.prepare("SELECT * FROM waste_entries WHERE date LIKE ? ORDER BY date, id").all(`${month}%`)
  );
  ipcMain.handle("waste:create", (_e, entry) => {
    const info = db
      .prepare(`INSERT INTO waste_entries (date, amount, payment_method, note) VALUES (@date, @amount, @payment_method, @note)`)
      .run({ date: entry.date, amount: entry.amount, payment_method: entry.payment_method || "cash", note: entry.note ?? null });
    const created = db.prepare("SELECT * FROM waste_entries WHERE id = ?").get(info.lastInsertRowid);
    pushToCloud("waste_entries", created.id, created);
    return created;
  });
  ipcMain.handle("waste:delete", (_e, { id }) => {
    db.prepare("DELETE FROM waste_entries WHERE id = ?").run(id);
    return { ok: true };
  });

  // --- الصادر والوارد: a full company-wide cash ledger for one month.
  // الصادر (outgoing) = every equipment expense + partner/supplier payments
  // + payroll advances/bonuses actually paid out + waste entries — every real
  // cash-out event, company-wide. الوارد (incoming) = money collected from
  // contractors. Note: a driver/employee's final month-end wage isn't its own
  // recorded transaction anywhere in the system (same as a partner's or
  // contractor's due amount before they're actually paid) — only advances and
  // bonuses are real recorded payroll cash movements, so that's what "الرواتب"
  // reflects here. ---
  ipcMain.handle("outgoing:list", (_e, { month }) => {
    const equipmentExpenses = db
      .prepare(
        `SELECT me.*, e.name AS equipment_name, ec.name AS category_name
         FROM monthly_expenses me
         JOIN equipment e ON e.id = me.equipment_id
         LEFT JOIN expense_categories ec ON ec.id = me.category_id
         WHERE me.month = ?
         ORDER BY COALESCE(me.date, ''), me.id`
      )
      .all(month);
    const categoryTotalsMap = new Map();
    for (const row of equipmentExpenses) {
      const label = row.category_name || "بدون نوع";
      categoryTotalsMap.set(label, (categoryTotalsMap.get(label) ?? 0) + row.amount);
    }
    const categoryTotals = [...categoryTotalsMap.entries()].map(([category_name, total]) => ({ category_name, total }));
    const equipmentExpensesTotal = equipmentExpenses.reduce((sum, r) => sum + r.amount, 0);

    const partnerPayments = db
      .prepare(
        `SELECT pp.*, p.name AS partner_name FROM partner_payments pp
         JOIN partners p ON p.id = pp.partner_id
         WHERE pp.date LIKE ? ORDER BY pp.date, pp.id`
      )
      .all(`${month}%`);
    const partnerPaymentsTotal = partnerPayments.reduce((sum, r) => sum + r.amount, 0);

    const supplierPayments = db
      .prepare(
        `SELECT sp.*, s.name AS supplier_name FROM supplier_payments sp
         JOIN suppliers s ON s.id = sp.supplier_id
         WHERE sp.date LIKE ? ORDER BY sp.date, sp.id`
      )
      .all(`${month}%`);
    const supplierPaymentsTotal = supplierPayments.reduce((sum, r) => sum + r.amount, 0);

    const creditorPayments = db
      .prepare(
        `SELECT ce.*, c.name AS creditor_name FROM creditor_entries ce
         JOIN creditors c ON c.id = ce.creditor_id
         WHERE ce.type = 'payment' AND ce.date LIKE ? ORDER BY ce.date, ce.id`
      )
      .all(`${month}%`);
    const creditorPaymentsTotal = creditorPayments.reduce((sum, r) => sum + r.amount, 0);

    // السلف والمكافآت ودفعات المرتب هنا بتتحسب على الشهر اللي بتخصه (زي
    // مصروفات المعدات) مش تاريخ الصرف الحقيقي — لو دفعت مرتب يونيو في 5 يوليو
    // يفضل يسمع في يونيو، هنا وفي الخزنة كمان.
    const advances = db
      .prepare(
        `SELECT ea.*, e.name AS employee_name FROM employee_advances ea
         JOIN employees e ON e.id = ea.employee_id
         WHERE ea.month = ? ORDER BY ea.date, ea.id`
      )
      .all(month)
      .map((r) => ({ ...r, kind: "advance" }));
    const bonuses = db
      .prepare(
        `SELECT eb.*, e.name AS employee_name FROM employee_bonuses eb
         JOIN employees e ON e.id = eb.employee_id
         WHERE eb.month = ? ORDER BY eb.date, eb.id`
      )
      .all(month)
      .map((r) => ({ ...r, kind: "bonus" }));
    const salaryPayments = db
      .prepare(
        `SELECT sp.*, e.name AS employee_name FROM salary_payments sp
         JOIN employees e ON e.id = sp.employee_id
         WHERE sp.month = ? ORDER BY sp.date, sp.id`
      )
      .all(month)
      .map((r) => ({ ...r, kind: "salary" }));
    const payroll = [...advances, ...bonuses, ...salaryPayments].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    const payrollTotal = payroll.reduce((sum, r) => sum + r.amount, 0);

    const waste = db.prepare("SELECT * FROM waste_entries WHERE date LIKE ? ORDER BY date, id").all(`${month}%`);
    const wasteTotal = waste.reduce((sum, w) => sum + w.amount, 0);

    const totalOutgoing = equipmentExpensesTotal + partnerPaymentsTotal + supplierPaymentsTotal + creditorPaymentsTotal + payrollTotal + wasteTotal;

    return {
      equipmentExpenses,
      categoryTotals,
      equipmentExpensesTotal,
      partnerPayments,
      partnerPaymentsTotal,
      supplierPayments,
      supplierPaymentsTotal,
      creditorPayments,
      creditorPaymentsTotal,
      payroll,
      payrollTotal,
      waste,
      wasteTotal,
      totalOutgoing,
    };
  });

  ipcMain.handle("incoming:list", (_e, { month }) => {
    const contractorPayments = db
      .prepare(
        `SELECT cp.*, c.name AS contractor_name FROM contractor_payments cp
         JOIN contractors c ON c.id = cp.contractor_id
         WHERE cp.date LIKE ? ORDER BY cp.date, cp.id`
      )
      .all(`${month}%`);
    const totalIncoming = contractorPayments.reduce((sum, r) => sum + r.amount, 0);
    return { contractorPayments, totalIncoming };
  });
};
