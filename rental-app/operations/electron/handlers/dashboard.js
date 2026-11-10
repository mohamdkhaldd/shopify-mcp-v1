const { computeDayValue, contractorMonthBreakdown, equipmentDayCounts, driverSalaryForEquipment, equipmentMonthNetProfit } = require("../calc");

// الرئيسية
module.exports = function register(db, ipcMain, shared) {
  const { equipmentAllTimeProfit } = shared;

  // --- Dashboard: live headline numbers for the home page, computed from
  // the real database for the current calendar year — replaces the old
  // hardcoded Excel-snapshot placeholder that never got wired up. ---
  const MONTH_NAMES_AR = [
    "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
    "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
  ];

  // المستحق في شهر واحد بس (مش من أول التاريخ): للشركة من كل مقاول = قيمة
  // شغله في الشهر ده − اللي دفعه بتاريخ في الشهر ده؛ ولكل شريك = نصيبه من
  // صافي ربح معداته في الشهر ده − اللي اتدفعله بتاريخ في الشهر ده.
  ipcMain.handle("dashboard:monthDues", (_e, { month }) => {
    const contractors = db
      .prepare("SELECT * FROM contractors ORDER BY name")
      .all()
      .map((c) => {
        // نفس حساب شيت المقاول شهر بشهر: الدفعة اللي عن شهر معين بتروح له،
        // والباقي بيسدد الأقدم الأول — فمفيش رقم بالسالب.
        const r = contractorMonthBreakdown(db, c).months.find((m) => m.month === month);
        const work = r?.work ?? 0;
        const remaining = Math.max(0, r?.remaining ?? 0);
        return { id: c.id, name: c.name, due: work, paid: work - remaining, remaining };
      })
      .filter((c) => c.due !== 0);

    // ربح المعدة في الشهور اللي بعد الشهر ده (عشان نحسب الباقي لحد آخره).
    const afterCache = new Map();
    const equipmentProfitAfter = (equipmentId) => {
      if (!afterCache.has(equipmentId)) {
        const months = db
          .prepare(
            `SELECT DISTINCT substr(date, 1, 7) AS m FROM daily_logs WHERE equipment_id = ? AND substr(date, 1, 7) > ?
             UNION SELECT DISTINCT month AS m FROM monthly_expenses WHERE equipment_id = ? AND month > ?`
          )
          .all(equipmentId, month, equipmentId, month)
          .map((r) => r.m);
        afterCache.set(equipmentId, months.reduce((sum, m) => sum + equipmentMonthNetProfit(db, equipmentId, m), 0));
      }
      return afterCache.get(equipmentId);
    };
    const profitCache = new Map();
    const equipmentProfit = (equipmentId) => {
      if (!profitCache.has(equipmentId)) profitCache.set(equipmentId, equipmentMonthNetProfit(db, equipmentId, month));
      return profitCache.get(equipmentId);
    };
    const partners = db
      .prepare("SELECT * FROM partners ORDER BY name")
      .all()
      .map((p) => {
        const shares = db
          .prepare("SELECT equipment_id, percentage FROM equipment_partner_shares WHERE partner_id = ?")
          .all(p.id);
        const due = shares.reduce((sum, sh) => sum + (equipmentProfit(sh.equipment_id) * sh.percentage) / 100, 0);
        // زي المقاولين: الدفعات بتسدد الأقدم الأول — اللي لسه متدفعش من نصيب
        // الشهر ده = الباقي له لحد آخر الشهر ده، بس مش أكتر من نصيب الشهر.
        const uptoMonth = shares.reduce(
          (sum, sh) => sum + ((equipmentAllTimeProfit(sh.equipment_id) - equipmentProfitAfter(sh.equipment_id)) * sh.percentage) / 100,
          0
        );
        const allPaid = db.prepare("SELECT COALESCE(SUM(amount), 0) AS total FROM partner_payments WHERE partner_id = ?").get(p.id).total;
        const outstanding = (p.opening_balance ?? 0) + uptoMonth - allPaid;
        const remaining = Math.max(0, Math.min(due, outstanding));
        return { id: p.id, name: p.name, due, paid: Math.max(0, due) - remaining, remaining };
      })
      .filter((p) => p.due !== 0);

    return {
      month,
      contractors,
      partners,
      contractorsRemaining: contractors.reduce((sum, c) => sum + c.remaining, 0),
      partnersRemaining: partners.reduce((sum, p) => sum + p.remaining, 0),
    };
  });

  ipcMain.handle("dashboard:summary", () => {
    const now = new Date();
    const year = String(now.getFullYear());
    const currentMonthIndex = now.getMonth();
    const equipmentList = db.prepare("SELECT * FROM equipment ORDER BY name").all();

    function equipmentMonthTotals(equipmentId, monthKey) {
      const income = db
        .prepare("SELECT * FROM daily_logs WHERE equipment_id = ? AND role IN ('driver', 'market') AND date LIKE ?")
        .all(equipmentId, `${monthKey}%`)
        .reduce((sum, l) => sum + computeDayValue(l), 0);
      const manualExpense = db
        .prepare("SELECT COALESCE(SUM(amount), 0) AS total FROM monthly_expenses WHERE equipment_id = ? AND month = ?")
        .get(equipmentId, monthKey).total;
      const driverSalaryExpense = driverSalaryForEquipment(db, equipmentId, monthKey);
      const expense = manualExpense + driverSalaryExpense;
      return { profit: income - expense, expense, income };
    }

    const equipmentAnnualExpense = new Map(equipmentList.map((e) => [e.id, 0]));
    const equipmentAnnualIncome = new Map(equipmentList.map((e) => [e.id, 0]));
    const monthlyProfitTrend = [];
    let totalAnnualProfit = 0;
    let totalAnnualExpense = 0;

    for (let m = 0; m < 12; m++) {
      const monthKey = `${year}-${String(m + 1).padStart(2, "0")}`;
      let monthProfit = 0;
      for (const eq of equipmentList) {
        const { profit, expense, income } = equipmentMonthTotals(eq.id, monthKey);
        monthProfit += profit;
        totalAnnualExpense += expense;
        equipmentAnnualExpense.set(eq.id, equipmentAnnualExpense.get(eq.id) + expense);
        equipmentAnnualIncome.set(eq.id, equipmentAnnualIncome.get(eq.id) + income);
      }
      monthlyProfitTrend.push({ month: MONTH_NAMES_AR[m], profit: monthProfit });
      totalAnnualProfit += monthProfit;
    }

    const equipmentExpenses = equipmentList.map((eq) => ({
      name: eq.name,
      annualExpense: equipmentAnnualExpense.get(eq.id),
      annualIncome: equipmentAnnualIncome.get(eq.id),
      annualProfit: equipmentAnnualIncome.get(eq.id) - equipmentAnnualExpense.get(eq.id),
      ...equipmentDayCounts(db, eq.id, year),
    }));

    const contractors = db.prepare("SELECT * FROM contractors").all();
    const totalReceivables = contractors.reduce((sum, c) => {
      const totalWork =
        c.opening_balance +
        db
          .prepare("SELECT * FROM daily_logs WHERE role = 'contractor' AND person_name = ?")
          .all(c.name)
          .reduce((s, l) => s + computeDayValue(l), 0);
      const totalPaid = db
        .prepare("SELECT COALESCE(SUM(amount), 0) AS total FROM contractor_payments WHERE contractor_id = ?")
        .get(c.id).total;
      // المقاول اللي دافع زيادة (فلوسه عندنا) مبيتخصمش من اللي على الباقيين.
      return sum + Math.max(0, totalWork - totalPaid);
    }, 0);

    const partners = db.prepare("SELECT * FROM partners").all();
    const partnersRemaining = partners.reduce((sum, p) => {
      const shares = db
        .prepare("SELECT equipment_id, percentage FROM equipment_partner_shares WHERE partner_id = ?")
        .all(p.id);
      const totalDue =
        p.opening_balance + shares.reduce((s, sh) => s + (equipmentAllTimeProfit(sh.equipment_id) * sh.percentage) / 100, 0);
      const totalPaid = db
        .prepare("SELECT COALESCE(SUM(amount), 0) AS total FROM partner_payments WHERE partner_id = ?")
        .get(p.id).total;
      return sum + (totalDue - totalPaid);
    }, 0);

    const suppliers = db.prepare("SELECT * FROM suppliers").all();
    const suppliersRemaining = suppliers.reduce((sum, s) => {
      const totalPurchases = db
        .prepare("SELECT COALESCE(SUM(amount), 0) AS total FROM supplier_purchases WHERE supplier_id = ?")
        .get(s.id).total;
      const totalPaid = db
        .prepare("SELECT COALESCE(SUM(amount), 0) AS total FROM supplier_payments WHERE supplier_id = ?")
        .get(s.id).total;
      return sum + (totalPurchases - totalPaid);
    }, 0);

    return {
      totalAnnualProfit,
      totalAnnualExpense,
      equipmentCount: equipmentList.length,
      currentMonthLabel: MONTH_NAMES_AR[currentMonthIndex],
      currentMonthProfit: monthlyProfitTrend[currentMonthIndex].profit,
      totalReceivables,
      totalPartnersDue: partnersRemaining,
      totalSuppliersDue: suppliersRemaining,
      monthlyProfitTrend,
      equipmentExpenses,
    };
  });
};
