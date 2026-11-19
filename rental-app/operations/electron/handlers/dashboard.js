const { computeDayValue, contractorWorkTotal, contractorMonthBreakdown, equipmentDayCounts, driverSalaryForEquipment, equipmentMonthNetProfit } = require("../calc");

// الرئيسية
module.exports = function register(db, ipcMain, shared) {
  const { equipmentAllTimeProfit, payrollSummary, computeCommissionRows } = shared;

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
  function monthDuesFor(month) {
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
  }
  ipcMain.handle("dashboard:monthDues", (_e, { month }) => monthDuesFor(month));

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
        c.opening_balance + contractorWorkTotal(db, c, db.prepare("SELECT * FROM daily_logs WHERE role = 'contractor' AND person_name = ?").all(c.name));
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


  // ===== الرئيسية الجديدة: أرقام الشهر، وتحتها نفس الأرقام للسنة =====
  // الدخل قبل الكوميشن = اللي المعدات اشتغلت بيه فعلاً (سعر المقاول + السوق
  // كامل)، والكوميشن = الفرق بين المقاول والسركي (زي شيت الكوميشن بالظبط).
  function periodMonth(month) {
    const equipment = db.prepare("SELECT * FROM equipment ORDER BY name").all();
    const logs = (eid, role) => db.prepare("SELECT * FROM daily_logs WHERE equipment_id = ? AND role = ? AND date LIKE ?").all(eid, role, `${month}%`);
    let gross = 0;
    let working = 0;
    const net = [];
    const expenseItems = new Map();
    let driverSalaries = 0;
    for (const e of equipment) {
      const contractor = logs(e.id, "contractor");
      const market = logs(e.id, "market");
      const driver = logs(e.id, "driver");
      const g =
        contractor.reduce((s, l) => s + computeDayValue(l), 0) +
        market.reduce((s, l) => s + (l.is_day_off ? 0 : l.fixed_value ?? 0), 0);
      // معدة اشتغلت لوحدها من غير مقاول (سركي بس): دخلها هو السركي
      const soloDriver = contractor.length ? 0 : driver.reduce((s, l) => s + computeDayValue(l), 0);
      gross += g + soloDriver;
      if (contractor.some((l) => !l.is_day_off) || market.some((l) => !l.is_day_off) || driver.some((l) => !l.is_day_off)) working++;
      for (const x of db
        .prepare(
          `SELECT COALESCE(ec.name, 'مصروفات تانية') AS name, SUM(me.amount) AS amount FROM monthly_expenses me
           LEFT JOIN expense_categories ec ON ec.id = me.category_id WHERE me.equipment_id = ? AND me.month = ? GROUP BY 1`
        )
        .all(e.id, month))
        expenseItems.set(x.name, (expenseItems.get(x.name) ?? 0) + x.amount);
      driverSalaries += driverSalaryForEquipment(db, e.id, month);
      const p = equipmentMonthNetProfit(db, e.id, month);
      if (p !== 0) net.push({ label: e.name, amount: p });
    }
    if (driverSalaries) expenseItems.set("مرتبات السواقين", (expenseItems.get("مرتبات السواقين") ?? 0) + driverSalaries);
    const commission = computeCommissionRows(month).total;
    const expenses = [...expenseItems.entries()].map(([label, amount]) => ({ label, amount })).sort((a, b) => b.amount - a.amount);

    const dues = monthDuesFor(month);
    const drivers = payrollSummary(month)
      .map((r) => ({ label: r.name, amount: Math.max(0, r.remaining ?? 0) }))
      .filter((r) => r.amount > 0.005);
    const suppliers = db
      .prepare(
        `SELECT s.name AS label,
           (SELECT COALESCE(SUM(amount),0) FROM supplier_purchases WHERE supplier_id = s.id AND date LIKE @m)
         - (SELECT COALESCE(SUM(amount),0) FROM supplier_payments WHERE supplier_id = s.id AND date LIKE @m) AS amount
         FROM suppliers s`
      )
      .all({ m: `${month}%` })
      .filter((r) => r.amount > 0.005);
    const sum = (a) => a.reduce((s, x) => s + x.amount, 0);
    return {
      equipmentCount: equipment.length,
      working,
      gross,
      commission,
      companyIncome: gross - commission,
      expenses: { total: sum(expenses), items: expenses },
      net: { total: sum(net), items: net.sort((a, b) => b.amount - a.amount) },
      dues: [
        { key: "company", label: "مستحق للشركة (عند المقاولين)", items: dues.contractors.filter((c) => c.remaining > 0.005).map((c) => ({ label: c.name, amount: c.remaining })) },
        { key: "partners", label: "مستحق للشركاء", items: dues.partners.filter((c) => c.remaining > 0.005).map((c) => ({ label: c.name, amount: c.remaining })) },
        { key: "drivers", label: "مستحق للسواقين", items: drivers },
        { key: "suppliers", label: "مستحق للموردين", items: suppliers },
      ].map((d) => ({ ...d, amount: sum(d.items) })),
    };
  }

  function mergePeriods(list) {
    const merge = (arrays) => {
      const m = new Map();
      for (const a of arrays) for (const x of a) m.set(x.label, (m.get(x.label) ?? 0) + x.amount);
      return [...m.entries()].map(([label, amount]) => ({ label, amount })).sort((a, b) => b.amount - a.amount);
    };
    const sum = (a) => a.reduce((s, x) => s + x.amount, 0);
    const exp = merge(list.map((p) => p.expenses.items));
    const net = merge(list.map((p) => p.net.items));
    return {
      equipmentCount: list[0]?.equipmentCount ?? 0,
      working: Math.max(0, ...list.map((p) => p.working)),
      gross: list.reduce((s, p) => s + p.gross, 0),
      commission: list.reduce((s, p) => s + p.commission, 0),
      companyIncome: list.reduce((s, p) => s + p.companyIncome, 0),
      expenses: { total: sum(exp), items: exp },
      net: { total: sum(net), items: net },
      dues: (list[0]?.dues ?? []).map((d) => {
        const items = merge(list.map((p) => p.dues.find((x) => x.key === d.key)?.items ?? []));
        return { key: d.key, label: d.label, items, amount: sum(items) };
      }),
    };
  }

  ipcMain.handle("dashboard:period", (_e, { month }) => {
    const year = month.slice(0, 4);
    const last = Number(month.slice(5, 7));
    const months = Array.from({ length: last }, (_, i) => `${year}-${String(i + 1).padStart(2, "0")}`);
    const byMonth = months.map(periodMonth);
    return { month, monthly: byMonth[byMonth.length - 1], yearly: mergePeriods(byMonth) };
  });
};
