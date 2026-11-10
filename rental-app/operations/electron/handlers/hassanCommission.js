// كوميشن حسن
module.exports = function register(db, ipcMain, shared) {
  const { computePairedCommission, pairKey, computeCommissionRows } = shared;

  // --- Hassan: commission (doc section 4) ---

  ipcMain.handle("hassan:commissionSummary", (_e, { month }) => computeCommissionRows(month));

  // --- Hassan: per-equipment commission sheet — every day this equipment had
  // a paired سركي/مقاول or a سركي سوق commission, what the مقاول/السركي
  // charged that day, and Hassan's cut — plus this equipment's totals for
  // the selected month and for the whole year. ---
  ipcMain.handle("hassan:equipmentCommission", (_e, { equipment_id, month }) => {
    const equipment = db.prepare("SELECT * FROM equipment WHERE id = ?").get(equipment_id);
    const year = month.split("-")[0];

    const driverLogs = db
      .prepare("SELECT * FROM daily_logs WHERE equipment_id = ? AND role = 'driver' AND date LIKE ?")
      .all(equipment_id, `${year}-%`);
    const contractorLogs = db
      .prepare("SELECT * FROM daily_logs WHERE equipment_id = ? AND role = 'contractor' AND date LIKE ?")
      .all(equipment_id, `${year}-%`);
    const marketLogs = db
      .prepare(
        "SELECT * FROM daily_logs WHERE equipment_id = ? AND role = 'market' AND date LIKE ? AND hassan_commission IS NOT NULL"
      )
      .all(equipment_id, `${year}-%`);
    const commissionExpenses = db
      .prepare(
        `SELECT me.*, ec.name AS category_name FROM monthly_expenses me
         JOIN expense_categories ec ON ec.id = me.category_id
         WHERE me.equipment_id = ? AND me.month LIKE ? AND ec.counts_as_commission = 1`
      )
      .all(equipment_id, `${year}-%`);

    const driverByKey = new Map(driverLogs.map((l) => [pairKey(l), l]));
    const allRows = [];
    for (const contractorLog of contractorLogs) {
      const driverLog = driverByKey.get(pairKey(contractorLog));
      if (!driverLog) continue;
      allRows.push({
        date: contractorLog.date,
        shift_label: contractorLog.shift_label ?? "",
        source: "paired",
        contractor_rate: contractorLog.day_rate ?? 0,
        driver_rate: driverLog.day_rate ?? 0,
        commission: computePairedCommission(equipment.name, driverLog, contractorLog),
      });
    }
    for (const marketLog of marketLogs) {
      allRows.push({
        date: marketLog.date,
        source: "market",
        contractor_rate: marketLog.fixed_value ?? 0,
        driver_rate: null,
        commission: marketLog.hassan_commission ?? 0,
      });
    }
    for (const expense of commissionExpenses) {
      allRows.push({
        date: expense.date ?? `${expense.month}-01`,
        source: "expense",
        category_name: expense.category_name,
        contractor_rate: null,
        driver_rate: null,
        commission: expense.amount,
      });
    }
    allRows.sort((a, b) => a.date.localeCompare(b.date));

    const days = allRows.filter((r) => r.date.startsWith(month));
    const monthTotal = days.reduce((sum, r) => sum + r.commission, 0);
    const yearTotal = allRows.reduce((sum, r) => sum + r.commission, 0);

    return { equipment_id, equipment_name: equipment.name, days, monthTotal, yearTotal };
  });
};
