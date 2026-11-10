const { computeDayValue, computeDriverWageValue, getEmployeeStateForMonth, monthlyEmployeeGrossPay, equipmentDayCounts, driverSalaryForEquipment } = require("../calc");

// التقارير
module.exports = function register(db, ipcMain, shared) {
  const { computePairedCommission, pairKey, ACCOUNT_NAME_AR, accountBalance } = shared;

  // --- Reports: pulls the headline numbers from every module together for
  // one month, so there's a single printable summary. ---
  ipcMain.handle("reports:monthly", (_e, { month }) => {
    const equipmentList = db.prepare("SELECT * FROM equipment ORDER BY name").all();
    let totalIncome = 0;
    let totalExpense = 0;
    const equipmentRows = equipmentList.map((eq) => {
      const income = db
        .prepare("SELECT * FROM daily_logs WHERE equipment_id = ? AND role IN ('driver','market') AND date LIKE ?")
        .all(eq.id, `${month}%`)
        .reduce((sum, l) => sum + computeDayValue(l), 0);
      const manualExpense = db
        .prepare("SELECT COALESCE(SUM(amount), 0) AS total FROM monthly_expenses WHERE equipment_id = ? AND month = ?")
        .get(eq.id, month).total;
      const driverSalaryExpense = driverSalaryForEquipment(db, eq.id, month);
      const expense = manualExpense + driverSalaryExpense;
      totalIncome += income;
      totalExpense += expense;
      return { equipment_name: eq.name, income, expense, netProfit: income - expense, ...equipmentDayCounts(db, eq.id, month) };
    });

    const employees = db.prepare("SELECT * FROM employees").all();
    let payrollTotal = 0;
    for (const emp of employees) {
      const advances = db
        .prepare("SELECT COALESCE(SUM(amount), 0) AS total FROM employee_advances WHERE employee_id = ? AND month = ?")
        .get(emp.id, month).total;
      const deductions = db
        .prepare("SELECT COALESCE(SUM(amount), 0) AS total FROM employee_deductions WHERE employee_id = ? AND month = ?")
        .get(emp.id, month).total;
      const state = getEmployeeStateForMonth(db, emp.id, month);
      if (state.wage_type === "monthly") {
        const { grossPay } = monthlyEmployeeGrossPay(db, emp, month);
        payrollTotal += grossPay - advances - deductions;
      } else {
        const gross = db
          .prepare("SELECT * FROM daily_logs WHERE role = 'driver' AND person_name = ? AND date LIKE ?")
          .all(emp.name, `${month}%`)
          .reduce((sum, l) => sum + computeDriverWageValue(l, state.rate), 0);
        payrollTotal += gross - advances - deductions;
      }
    }
    const commissionRows = [];
    for (const eq of equipmentList) {
      const driverLogs = db
        .prepare("SELECT * FROM daily_logs WHERE equipment_id = ? AND role = 'driver' AND date LIKE ?")
        .all(eq.id, `${month}%`);
      const contractorLogs = db
        .prepare("SELECT * FROM daily_logs WHERE equipment_id = ? AND role = 'contractor' AND date LIKE ?")
        .all(eq.id, `${month}%`);
      const marketLogs = db
        .prepare(
          "SELECT * FROM daily_logs WHERE equipment_id = ? AND role = 'market' AND date LIKE ? AND hassan_commission IS NOT NULL"
        )
        .all(eq.id, `${month}%`);
      const driverByKey = new Map(driverLogs.map((l) => [pairKey(l), l]));
      for (const cl of contractorLogs) {
        const dl = driverByKey.get(pairKey(cl));
        if (!dl) continue;
        commissionRows.push(computePairedCommission(eq.name, dl, cl));
      }
      for (const ml of marketLogs) commissionRows.push(ml.hassan_commission ?? 0);
    }
    const monthPenalties = db
      .prepare("SELECT COALESCE(SUM(amount), 0) AS total FROM hassan_penalties WHERE date LIKE ?")
      .get(`${month}%`).total;
    const hassanCommissionTotal = commissionRows.reduce((sum, c) => sum + c, 0) - monthPenalties;

    const treasuryAccounts = db.prepare("SELECT * FROM treasury_accounts ORDER BY CASE name WHEN 'wallet' THEN 1 WHEN 'instapay' THEN 2 WHEN 'cash' THEN 3 WHEN 'vodafone_cash' THEN 4 ELSE 5 END, id").all();

    return {
      month,
      equipmentRows,
      totalIncome,
      totalExpense,
      netProfit: totalIncome - totalExpense,
      payrollTotal,
      hassanCommissionTotal,
      treasuryBalances: treasuryAccounts.map((a) => ({ name: a.name, name_ar: ACCOUNT_NAME_AR[a.name] ?? a.name, balance: accountBalance(a) })),
    };
  });
};
