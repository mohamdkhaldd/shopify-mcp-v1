const { equipmentMonthNetProfit, equipmentShiftIncomeBreakdown } = require("../calc");

// دفعات الشركاء وملخصهم
module.exports = function register(db, ipcMain, shared) {
  const { equipmentAllTimeProfit, partnersSummary, pushToCloud } = shared;

  // --- Partner payments ---
  ipcMain.handle("partnerPayments:list", (_e, { partner_id }) =>
    db.prepare("SELECT * FROM partner_payments WHERE partner_id = ? ORDER BY date DESC").all(partner_id)
  );
  ipcMain.handle("partnerPayments:create", (_e, payment) => {
    const info = db
      .prepare(
        `INSERT INTO partner_payments (partner_id, date, amount, method, note)
         VALUES (@partner_id, @date, @amount, @method, @note)`
      )
      .run({ ...payment, method: payment.method || "cash", note: payment.note ?? null });
    const created = db.prepare("SELECT * FROM partner_payments WHERE id = ?").get(info.lastInsertRowid);
    const partner = db.prepare("SELECT name FROM partners WHERE id = ?").get(payment.partner_id);
    if (partner) pushToCloud("partner_payments", created.id, { partner_name: partner.name, ...created });
    return created;
  });
  ipcMain.handle("partnerPayments:delete", (_e, { id }) => {
    db.prepare("DELETE FROM partner_payments WHERE id = ?").run(id);
    return { ok: true };
  });

  ipcMain.handle("partners:summary", () => partnersSummary());

  ipcMain.handle("partners:detail", (_e, { partner_id, month }) => {
    const partner = db.prepare("SELECT * FROM partners WHERE id = ?").get(partner_id);
    const shares = db
      .prepare(
        `SELECT eps.equipment_id, eps.percentage, e.name AS equipment_name
         FROM equipment_partner_shares eps JOIN equipment e ON e.id = eps.equipment_id
         WHERE eps.partner_id = ?`
      )
      .all(partner_id);

    const equipmentBreakdown = shares.map((s) => {
      const netProfit = equipmentMonthNetProfit(db, s.equipment_id, month);
      const shiftIncome = equipmentShiftIncomeBreakdown(db, s.equipment_id, month);
      return {
        equipment_name: s.equipment_name,
        percentage: s.percentage,
        monthAmount: (netProfit * s.percentage) / 100,
        // عرض بس — الدخل مقسّم بالشيفت لو المعدة اشتغلت بأكتر من وردية،
        // مش داخل في حساب monthAmount نفسه (شوف equipmentShiftIncomeBreakdown).
        shiftIncome,
      };
    });
    const monthDue = equipmentBreakdown.reduce((sum, e) => sum + e.monthAmount, 0);

    // نصيب الشريك من كل معدة على مدار السنة كلها (الشهور اللي فاتت لحد دلوقتي
    // بتديه رقم، والشهور اللي لسه ماجاش وقتها بتدي صفر تلقائيًا لعدم وجود بيانات)
    // — كل سنة بتتحسب لوحدها حسب السنة المختارة في المنتقي.
    const year = month.split("-")[0];
    const yearlyEquipmentBreakdown = shares.map((s) => {
      let yearNetProfit = 0;
      for (let m = 1; m <= 12; m++) {
        yearNetProfit += equipmentMonthNetProfit(db, s.equipment_id, `${year}-${String(m).padStart(2, "0")}`);
      }
      return {
        equipment_name: s.equipment_name,
        percentage: s.percentage,
        yearAmount: (yearNetProfit * s.percentage) / 100,
      };
    });
    const yearDue = yearlyEquipmentBreakdown.reduce((sum, e) => sum + e.yearAmount, 0);

    const totalDue =
      partner.opening_balance +
      shares.reduce((sum, s) => sum + (equipmentAllTimeProfit(s.equipment_id) * s.percentage) / 100, 0);
    const payments = db
      .prepare("SELECT * FROM partner_payments WHERE partner_id = ? ORDER BY date DESC")
      .all(partner_id);
    const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);

    return {
      partner,
      monthDue,
      equipmentBreakdown,
      year,
      yearDue,
      yearlyEquipmentBreakdown,
      totalDue,
      totalPaid,
      remaining: totalDue - totalPaid,
      payments,
    };
  });
};
