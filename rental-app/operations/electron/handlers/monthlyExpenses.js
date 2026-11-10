const { CAR_CATEGORY } = require("../extras");

// المصروفات الشهرية
module.exports = function register(db, ipcMain, shared) {
  const { pushToCloud } = shared;

  // --- Monthly expenses ---
  ipcMain.handle("monthlyExpenses:list", (_e, { equipment_id, month }) =>
    db
      .prepare(
        `SELECT me.*, ec.name AS category_name,
                COALESCE(me.paid_amount, me.amount) + COALESCE((SELECT SUM(amount) FROM expense_payments WHERE expense_id = me.id), 0) AS paid_total,
                (SELECT SUM(amount) FROM transfer_fees WHERE src = 'monthly_expenses' AND src_id = me.id) AS transfer_fee
         FROM monthly_expenses me
         LEFT JOIN expense_categories ec ON ec.id = me.category_id
         WHERE me.equipment_id = ? AND me.month = ? ORDER BY me.date, me.id`
      )
      .all(equipment_id, month)
      .map((me) => ({ ...me, remaining: Math.max(0, me.amount - me.paid_total) }))
  );

  ipcMain.handle("monthlyExpenses:create", (_e, input) => {
    // مصروف "عربية ملاكي" (مشوار بالعربية) بيتخصم من فلوس العربية اللي
    // اتدفعت، مش من الخزنة — مهما كانت طريقة الدفع اللي اتختارت.
    const carCat = db.prepare("SELECT id FROM expense_categories WHERE name = ?").get(CAR_CATEGORY)?.id;
    const expense = carCat && Number(input.category_id) === carCat ? { ...input, payment_method: "car", paid_amount: null } : input;
    const info = db
      .prepare(
        `INSERT INTO monthly_expenses (equipment_id, month, date, category_id, amount, payment_method, note, receipt_image, paid_amount, payee)
         VALUES (@equipment_id, @month, @date, @category_id, @amount, @payment_method, @note, @receipt_image, @paid_amount, @payee)`
      )
      .run({
        ...expense,
        date: expense.date ?? null,
        note: expense.note ?? null,
        receipt_image: expense.receipt_image ?? null,
        // اتدفع كله = NULL (زي القديم)، غير كده بيتسجل اللي اتدفع والباقي آجل.
        paid_amount:
          expense.paid_amount == null || Number(expense.paid_amount) >= Number(expense.amount)
            ? null
            : Math.max(0, Number(expense.paid_amount) || 0),
        payee: expense.payee?.trim() || null,
      });
    const created = db
      .prepare(
        `SELECT me.*, ec.name AS category_name FROM monthly_expenses me
         LEFT JOIN expense_categories ec ON ec.id = me.category_id WHERE me.id = ?`
      )
      .get(info.lastInsertRowid);
    const equipmentName = db.prepare("SELECT name FROM equipment WHERE id = ?").get(expense.equipment_id)?.name;
    if (equipmentName) pushToCloud("monthly_expenses", created.id, { ...created, equipment_name: equipmentName });
    return created;
  });

  ipcMain.handle("monthlyExpenses:delete", (_e, { id }) => {
    db.prepare("DELETE FROM monthly_expenses WHERE id = ?").run(id);
    return { ok: true };
  });
};
