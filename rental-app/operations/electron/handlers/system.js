// تشخيص ومسح البيانات
module.exports = function register(db, ipcMain, shared) {
  // --- تشخيص مؤقت: بيقول كام مصروف موجود محليًا، وكام منهم بيشاور على
  // equipment_id مش موجود في جدول المعدات خالص (يتيم) — ده اللي بيخلي
  // المزامنة تتخطاه بصمت من غير أي رسالة خطأ. ---
  ipcMain.handle("system:diagnoseExpenses", () => {
    const total = db.prepare("SELECT COUNT(*) AS c FROM monthly_expenses").get().c;
    const orphaned = db
      .prepare("SELECT COUNT(*) AS c FROM monthly_expenses me WHERE NOT EXISTS (SELECT 1 FROM equipment e WHERE e.id = me.equipment_id)")
      .get().c;
    const sample = db
      .prepare(
        "SELECT id, equipment_id, month, date, amount FROM monthly_expenses me WHERE NOT EXISTS (SELECT 1 FROM equipment e WHERE e.id = me.equipment_id) LIMIT 5"
      )
      .all();
    return { total, orphaned, sample };
  });

  // --- Danger zone: wipe every recorded transaction (السركي, expenses,
  // advances, bonuses, payments, Hassan's ledger) so the office can start a
  // clean month — but keep the reference lists (equipment, partners, their
  // shares, employees, contractors, expense categories, suppliers) exactly
  // as set up, since that's real business setup, not day-to-day entries. ---
  ipcMain.handle("system:resetAll", () => {
    const tx = db.transaction(() => {
      db.prepare("DELETE FROM daily_logs").run();
      db.prepare("DELETE FROM monthly_expenses").run();
      db.prepare("DELETE FROM employee_advances").run();
      db.prepare("DELETE FROM employee_bonuses").run();
      db.prepare("DELETE FROM employee_deductions").run();
      db.prepare("DELETE FROM salary_payments").run();
      db.prepare("DELETE FROM hassan_ledger").run();
      db.prepare("DELETE FROM hassan_treasury_expenses").run();
      db.prepare("DELETE FROM hassan_penalties").run();
      db.prepare("DELETE FROM hassan_worker_entries").run();
      db.prepare("DELETE FROM contractor_payments").run();
      db.prepare("DELETE FROM partner_payments").run();
      db.prepare("DELETE FROM supplier_purchases").run();
      db.prepare("DELETE FROM supplier_payments").run();
      db.prepare("DELETE FROM creditor_entries").run();
      db.prepare("DELETE FROM custodies").run();
      db.prepare("DELETE FROM equipment_paper_sheets").run();
      db.prepare("DELETE FROM fund_expenses").run();
      db.prepare("DELETE FROM hassan_installments").run();
      db.prepare("DELETE FROM car_fuel").run();
      db.prepare("DELETE FROM obligations").run();
      db.prepare("DELETE FROM hassan_worker_attendance").run();
      db.prepare("UPDATE creditors SET opening_balance = 0").run();
      db.prepare("DELETE FROM waste_entries").run();
      db.prepare("UPDATE treasury_accounts SET current_balance = 0, opening_balance = 0, opening_date = NULL").run();
      db.prepare("DELETE FROM treasury_transfers").run();
      db.prepare("DELETE FROM other_income").run();
      db.prepare("DELETE FROM treasury_adjustments").run();
    });
    tx();
    return { ok: true };
  });
};
