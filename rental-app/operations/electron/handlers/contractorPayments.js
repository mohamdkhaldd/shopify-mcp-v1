const { computeDayValue, contractorMonthBreakdown } = require("../calc");

// دفعات المقاولين
module.exports = function register(db, ipcMain, shared) {
  const { pushToCloud } = shared;

  // --- Contractor payments ---
  ipcMain.handle("contractorPayments:list", (_e, { contractor_id }) =>
    db.prepare("SELECT * FROM contractor_payments WHERE contractor_id = ? ORDER BY date DESC").all(contractor_id)
  );
  ipcMain.handle("contractorPayments:create", (_e, payment) => {
    const info = db
      .prepare(
        `INSERT INTO contractor_payments (contractor_id, date, amount, method, note, for_month)
         VALUES (@contractor_id, @date, @amount, @method, @note, @for_month)`
      )
      .run({
        contractor_id: payment.contractor_id,
        date: payment.date,
        amount: payment.amount,
        method: payment.method || "cash",
        note: payment.note ?? null,
        for_month: payment.for_month || null,
      });
    const created = db.prepare("SELECT * FROM contractor_payments WHERE id = ?").get(info.lastInsertRowid);
    const contractor = db.prepare("SELECT name FROM contractors WHERE id = ?").get(payment.contractor_id);
    if (contractor) pushToCloud("contractor_payments", created.id, { contractor_name: contractor.name, ...created });
    return created;
  });
  ipcMain.handle("contractorPayments:delete", (_e, { id }) => {
    db.prepare("DELETE FROM contractor_payments WHERE id = ?").run(id);
    return { ok: true };
  });

  // Contractors dashboard (doc section 6): total work value is computed
  // automatically from every المقاول daily-log entry across all equipment
  // (all time, not just one month — this is a running balance), minus what
  // has actually been paid out.
  ipcMain.handle("contractors:summary", () => {
    const contractors = db.prepare("SELECT * FROM contractors ORDER BY name").all();
    const workStmt = db.prepare("SELECT * FROM daily_logs WHERE role = 'contractor' AND person_name = ?");
    const paidStmt = db.prepare(
      "SELECT COALESCE(SUM(amount), 0) AS total FROM contractor_payments WHERE contractor_id = ?"
    );
    return contractors.map((c) => {
      const totalWork = c.opening_balance + workStmt.all(c.name).reduce((sum, l) => sum + computeDayValue(l), 0);
      const totalPaid = paidStmt.get(c.id).total;
      return {
        id: c.id,
        name: c.name,
        opening_balance: c.opening_balance,
        totalWork,
        totalPaid,
        remaining: totalWork - totalPaid,
      };
    });
  });

  ipcMain.handle("contractors:detail", (_e, { contractor_id }) => {
    const contractor = db.prepare("SELECT * FROM contractors WHERE id = ?").get(contractor_id);
    const logs = db
      .prepare(
        `SELECT dl.*, e.name AS equipment_name FROM daily_logs dl
         JOIN equipment e ON e.id = dl.equipment_id
         WHERE dl.role = 'contractor' AND dl.person_name = ?
         ORDER BY dl.date`
      )
      .all(contractor.name);

    const byEquipment = new Map();
    for (const log of logs) {
      const value = computeDayValue(log);
      const entry = byEquipment.get(log.equipment_name) ?? { equipment_name: log.equipment_name, days: 0, totalValue: 0 };
      entry.days += 1;
      entry.totalValue += value;
      byEquipment.set(log.equipment_name, entry);
    }

    const payments = db
      .prepare("SELECT * FROM contractor_payments WHERE contractor_id = ? ORDER BY date DESC")
      .all(contractor_id);

    const totalWork = contractor.opening_balance + logs.reduce((sum, l) => sum + computeDayValue(l), 0);
    const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);

    const { months, advance } = contractorMonthBreakdown(db, contractor);
    return {
      contractor,
      workByEquipment: [...byEquipment.values()],
      months: months.reverse(),
      advance,
      payments,
      totalWork,
      totalPaid,
      remaining: totalWork - totalPaid,
    };
  });
};
