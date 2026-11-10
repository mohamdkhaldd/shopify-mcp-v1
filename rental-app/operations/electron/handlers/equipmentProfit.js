const { computeDayValue, driverSalaryBreakdownForEquipment } = require("../calc");

// ربح المعدة في الشهر وتوزيعه
module.exports = function register(db, ipcMain, shared) {
  // --- Profit summary + partner distribution for one equipment/month ---
  ipcMain.handle("equipment:summary", (_e, { equipment_id, month }) => {
    const driverLogs = db
      .prepare("SELECT * FROM daily_logs WHERE equipment_id = ? AND role = 'driver' AND date LIKE ?")
      .all(equipment_id, `${month}%`);
    const marketLogs = db
      .prepare("SELECT * FROM daily_logs WHERE equipment_id = ? AND role = 'market' AND date LIKE ?")
      .all(equipment_id, `${month}%`);
    const expenses = db
      .prepare("SELECT * FROM monthly_expenses WHERE equipment_id = ? AND month = ?")
      .all(equipment_id, month);

    const driverIncome = driverLogs.reduce((sum, l) => sum + computeDayValue(l), 0);
    const marketIncome = marketLogs.reduce((sum, l) => sum + computeDayValue(l), 0);
    const income = driverIncome + marketIncome;
    const driverSalaryBreakdown = driverSalaryBreakdownForEquipment(db, equipment_id, month);
    const driverSalaryExpense = driverSalaryBreakdown.reduce((sum, d) => sum + d.amount, 0);
    const manualExpenseTotal = expenses.reduce((sum, e) => sum + e.amount, 0);
    const expenseTotal = manualExpenseTotal + driverSalaryExpense;
    const netProfit = income - expenseTotal;

    const shares = db
      .prepare(
        `SELECT eps.percentage, p.id AS partner_id, p.name AS partner_name
         FROM equipment_partner_shares eps JOIN partners p ON p.id = eps.partner_id
         WHERE eps.equipment_id = ?`
      )
      .all(equipment_id);

    const distribution = shares.map((s) => ({
      partner_id: s.partner_id,
      partner_name: s.partner_name,
      percentage: s.percentage,
      amount: (netProfit * s.percentage) / 100,
    }));

    return {
      driverIncome,
      marketIncome,
      income,
      driverSalaryExpense,
      driverSalaryBreakdown,
      manualExpenseTotal,
      expenseTotal,
      netProfit,
      distribution,
    };
  });
};
