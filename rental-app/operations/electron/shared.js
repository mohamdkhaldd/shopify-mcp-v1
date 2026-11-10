const { computeDayValue, computeDriverWageValue, getEmployeeStateForMonth, monthlyEmployeeGrossPay, equipmentDaysNote, driverSalaryForEquipment } = require("./calc");

// حسابات بيحتاجها أكتر من قسم (المرتبات، ملخص الشركاء، أرصدة الخزنة، …).
// بتتبني مرة واحدة على قاعدة البيانات وبتتوزع على ملفات handlers/.
module.exports = function makeShared(db) {
  function payrollSummary(month) {
    const employees = db.prepare("SELECT * FROM employees ORDER BY name").all();
    const driverLogsStmt = db.prepare(
      "SELECT * FROM daily_logs WHERE role = 'driver' AND person_name = ? AND date LIKE ?"
    );
    // بالشهر (مش تاريخ الصرف الحقيقي) — لو اتأخرت لشهر بعده (زي سلفة/مكافأة/
    // دفعة مرتب يونيو اتسجلت في يوليو)، تفضل محسوبة على يونيو، الشهر اللي
    // بتخصه فعلاً وقت التسجيل من شيت الرواتب.
    const advancesStmt = db.prepare(
      "SELECT COALESCE(SUM(amount), 0) AS total FROM employee_advances WHERE employee_id = ? AND month = ?"
    );
    const bonusesStmt = db.prepare(
      "SELECT COALESCE(SUM(amount), 0) AS total FROM employee_bonuses WHERE employee_id = ? AND month = ?"
    );
    const deductionsStmt = db.prepare(
      "SELECT COALESCE(SUM(amount), 0) AS total FROM employee_deductions WHERE employee_id = ? AND month = ?"
    );
    const paidStmt = db.prepare(
      "SELECT COALESCE(SUM(amount), 0) AS total FROM salary_payments WHERE employee_id = ? AND month = ?"
    );

    return employees.map((emp) => {
      const advancesTotal = advancesStmt.get(emp.id, month).total;
      const bonusesTotal = bonusesStmt.get(emp.id, month).total;
      const deductionsTotal = deductionsStmt.get(emp.id, month).total;
      const paidTotal = paidStmt.get(emp.id, month).total;
      const state = getEmployeeStateForMonth(db, emp.id, month);
      if (state.wage_type === "monthly") {
        const { grossPay } = monthlyEmployeeGrossPay(db, emp, month);
        const netPay = grossPay - advancesTotal - deductionsTotal;
        return {
          id: emp.id,
          name: emp.name,
          wage_type: state.wage_type,
          rate: state.rate,
          fixed_salary: state.fixed_salary,
          days_worked: null,
          gross_pay: grossPay,
          advances_total: advancesTotal,
          bonuses_total: bonusesTotal,
          deductions_total: deductionsTotal,
          net_pay: netPay,
          paid_total: paidTotal,
          taken_total: advancesTotal + bonusesTotal + paidTotal,
          remaining: netPay - paidTotal,
        };
      }
      const logs = driverLogsStmt.all(emp.name, `${month}%`);
      const grossPay = logs.reduce((sum, l) => sum + computeDriverWageValue(l, state.rate), 0);
      const netPay = grossPay - advancesTotal - deductionsTotal;
      return {
        id: emp.id,
        name: emp.name,
        wage_type: state.wage_type,
        rate: state.rate,
        fixed_salary: state.fixed_salary,
        days_worked: logs.length,
        gross_pay: grossPay,
        advances_total: advancesTotal,
        bonuses_total: bonusesTotal,
        deductions_total: deductionsTotal,
        net_pay: netPay,
        paid_total: paidTotal,
        taken_total: advancesTotal + bonusesTotal + paidTotal,
        remaining: netPay - paidTotal,
      };
    });
  }

  // كل المعدات بنفس المنطق: كوميشن حسن = (سعر المقاول - سعر السركي) +
  // ساعات أوفر تايم × الفرق بينهم بالساعة، متزاوجين بنفس التاريخ. سركي
  // السوق مالوش معادلة — أي رقم كوميشن اتكتب في الصف ده بالظبط.
  function computePairedCommission(_equipmentName, driverLog, contractorLog) {
    // لو أي شيت من الاتنين متعلّم إنه "مشتغلش"، مفيش كوميشن خالص — من غير
    // الشرط ده لو يوم واحد اتعلّم مشتغلش في شيت وسعره لسه متسجل غلط في
    // الشيت التاني، الكوميشن كان بيطلع سعر المقاول كامل من غير خصم السركي.
    if (driverLog.is_day_off || contractorLog.is_day_off) return 0;
    const k = contractorLog.day_rate ?? 0;
    const h = driverLog.day_rate ?? 0;
    const baseHours = contractorLog.base_hours || 8;
    const overtimeHours = Math.max(0, (contractorLog.actual_hours ?? 0) - (contractorLog.base_hours ?? 0));
    const kHour = contractorLog.overtime_rate ?? k / baseHours;
    const hHour = driverLog.overtime_rate ?? h / baseHours;
    return (k - h) + overtimeHours * (kHour - hHour);
  }

  // بيربط سطر السركي بسطر المقاول لنفس اليوم — لازم يبقى بالتاريخ والشيفت
  // مع بعض (مش بالتاريخ بس)، وإلا معدة شغالة بورديتين هيتلخبط سطر وردية
  // بسطر وردية تانية لنفس اليوم.
  function pairKey(log) {
    return `${log.date}|${log.shift_label ?? ""}`;
  }

  // كوميشن حسن كله — لو month اتبعت بيتفلتر عليه بس، لو من غيره (null) بيحسب
  // كل الوقت من أول ما اتسجلت أي بيانات — مستخدمة في شيت الكوميشن الشهري
  // وفي رصيد "خزنة حسن" الكلي.
  function computeCommissionRows(month) {
    const equipmentList = db.prepare("SELECT * FROM equipment ORDER BY name").all();
    const rows = [];

    for (const equipment of equipmentList) {
      const driverLogs = month
        ? db.prepare("SELECT * FROM daily_logs WHERE equipment_id = ? AND role = 'driver' AND date LIKE ?").all(equipment.id, `${month}%`)
        : db.prepare("SELECT * FROM daily_logs WHERE equipment_id = ? AND role = 'driver'").all(equipment.id);
      const contractorLogs = month
        ? db.prepare("SELECT * FROM daily_logs WHERE equipment_id = ? AND role = 'contractor' AND date LIKE ?").all(equipment.id, `${month}%`)
        : db.prepare("SELECT * FROM daily_logs WHERE equipment_id = ? AND role = 'contractor'").all(equipment.id);
      const marketLogs = month
        ? db
            .prepare("SELECT * FROM daily_logs WHERE equipment_id = ? AND role = 'market' AND date LIKE ? AND hassan_commission IS NOT NULL")
            .all(equipment.id, `${month}%`)
        : db
            .prepare("SELECT * FROM daily_logs WHERE equipment_id = ? AND role = 'market' AND hassan_commission IS NOT NULL")
            .all(equipment.id);
      // مصروفات زي المكنيكي والسكن — أي نوع مصروف اتحدد إنه يحسب في الكوميشن
      // (من الإعدادات)، قيمته على المعدة دي بتضاف كاملة لكوميشن حسن.
      const commissionExpenses = month
        ? db
            .prepare(
              `SELECT me.*, ec.name AS category_name FROM monthly_expenses me
               JOIN expense_categories ec ON ec.id = me.category_id
               WHERE me.equipment_id = ? AND me.month = ? AND ec.counts_as_commission = 1`
            )
            .all(equipment.id, month)
        : db
            .prepare(
              `SELECT me.*, ec.name AS category_name FROM monthly_expenses me
               JOIN expense_categories ec ON ec.id = me.category_id
               WHERE me.equipment_id = ? AND ec.counts_as_commission = 1`
            )
            .all(equipment.id);

      const driverByKey = new Map(driverLogs.map((l) => [pairKey(l), l]));
      for (const contractorLog of contractorLogs) {
        const driverLog = driverByKey.get(pairKey(contractorLog));
        if (!driverLog) continue;
        rows.push({
          equipment_id: equipment.id,
          equipment_name: equipment.name,
          date: contractorLog.date,
          shift_label: contractorLog.shift_label ?? "",
          source: "paired",
          commission: computePairedCommission(equipment.name, driverLog, contractorLog),
        });
      }
      for (const marketLog of marketLogs) {
        rows.push({
          equipment_id: equipment.id,
          equipment_name: equipment.name,
          date: marketLog.date,
          source: "market",
          commission: marketLog.hassan_commission ?? 0,
        });
      }
      for (const expense of commissionExpenses) {
        rows.push({
          equipment_id: equipment.id,
          equipment_name: equipment.name,
          date: expense.date ?? `${(month ?? expense.month)}-01`,
          source: "expense",
          category_name: expense.category_name,
          commission: expense.amount,
        });
      }
    }

    rows.sort((a, b) => a.date.localeCompare(b.date));
    const total = rows.reduce((sum, r) => sum + r.commission, 0);
    return { rows, total };
  }

  // Partners dashboard (doc section 8): total due is each partner's share %
  // applied to every equipment's all-time net profit (income - expenses),
  // summed across every equipment they hold a share in — a running balance,
  // same idea as the contractors' remaining balance.
  function equipmentAllTimeProfit(equipmentId) {
    const income = db
      .prepare("SELECT * FROM daily_logs WHERE equipment_id = ? AND role IN ('driver', 'market')")
      .all(equipmentId)
      .reduce((sum, l) => sum + computeDayValue(l), 0);
    const expense = db
      .prepare("SELECT COALESCE(SUM(amount), 0) AS total FROM monthly_expenses WHERE equipment_id = ?")
      .get(equipmentId).total;
    const driverSalaryExpense = driverSalaryForEquipment(db, equipmentId, null);
    return income - expense - driverSalaryExpense;
  }

  function partnersSummary() {
    const partners = db.prepare("SELECT * FROM partners ORDER BY name").all();
    const sharesStmt = db.prepare(
      `SELECT eps.equipment_id, eps.percentage, e.name AS equipment_name
       FROM equipment_partner_shares eps JOIN equipment e ON e.id = eps.equipment_id
       WHERE eps.partner_id = ?`
    );
    const paidStmt = db.prepare(
      "SELECT COALESCE(SUM(amount), 0) AS total FROM partner_payments WHERE partner_id = ?"
    );

    return partners.map((p) => {
      const shares = sharesStmt.all(p.id);
      const totalDue =
        p.opening_balance +
        shares.reduce((sum, s) => sum + (equipmentAllTimeProfit(s.equipment_id) * s.percentage) / 100, 0);
      const totalPaid = paidStmt.get(p.id).total;
      return {
        id: p.id,
        name: p.name,
        opening_balance: p.opening_balance,
        totalDue,
        totalPaid,
        remaining: totalDue - totalPaid,
      };
    });
  }

  // كل حساب (كاش/انستا باي/...) رصيده = رصيد البداية + كل حركة فلوس حقيقية
  // من تاريخ البداية — زي كشف حساب البنك بالظبط. الحركة بتتحسب بتاريخ
  // الدفع الفعلي، والمصروف بيدخل باللي اتدفع منه بس (الباقي في الآجل لحد ما
  // يتدفع). مرتب السواق المحسوب على المعدة باليوم مش هنا — هنا بس اللي
  // اتدفعله فعلًا (سلف/مكافآت/دفعات مرتب).
  const ACCOUNT_NAME_AR = { wallet: "اكسيس باي", instapay: "انستا باي", cash: "كاش", vodafone_cash: "فودفون كاش" };

  function cashMovements(account) {
    const rows = [];
    const add = (date, direction, label, amount, extra = {}) => {
      if (amount) rows.push({ date, direction, label, amount, ...extra });
    };

    db.prepare(
      `SELECT me.id, COALESCE(me.date, me.month || '-01') AS date, COALESCE(me.paid_amount, me.amount) AS paid,
              me.payee, e.name AS equipment_name, ec.name AS category_name
       FROM monthly_expenses me
       JOIN equipment e ON e.id = me.equipment_id
       LEFT JOIN expense_categories ec ON ec.id = me.category_id
       WHERE me.payment_method = ?`
    )
      .all(account)
      .forEach((r) =>
        add(r.date, "out", `مصروف ${r.category_name ?? "بدون نوع"} — ${r.equipment_name}${r.payee ? ` — ${r.payee}` : ""}`, r.paid, { src: "monthly_expenses", src_id: r.id })
      );

    db.prepare(
      `SELECT ep.id, ep.date, ep.amount, me.payee, e.name AS equipment_name, ec.name AS category_name
       FROM expense_payments ep
       JOIN monthly_expenses me ON me.id = ep.expense_id
       JOIN equipment e ON e.id = me.equipment_id
       LEFT JOIN expense_categories ec ON ec.id = me.category_id
       WHERE ep.method = ?`
    )
      .all(account)
      .forEach((r) =>
        add(r.date, "out", `دفعة آجل: ${r.category_name ?? "مصروف"} — ${r.equipment_name}${r.payee ? ` — ${r.payee}` : ""}`, r.amount, { src: "expense_payments", src_id: r.id })
      );

    const employeeMoney = (table, label) =>
      db
        .prepare(
          `SELECT t.id, t.date, t.month, t.amount, e.name AS employee_name FROM ${table} t
           JOIN employees e ON e.id = t.employee_id WHERE t.payment_method = ?`
        )
        .all(account)
        .forEach((r) => {
          const note = equipmentDaysNote(db, r.employee_name, r.month ?? r.date.slice(0, 7));
          add(r.date, "out", `${label}: ${r.employee_name}${note ? ` (${note})` : ""}`, r.amount, { src: table, src_id: r.id });
        });
    employeeMoney("employee_advances", "سلفة");
    employeeMoney("employee_bonuses", "مكافأة");
    employeeMoney("salary_payments", "دفعة مرتب");

    db.prepare(
      `SELECT pp.id, pp.date, pp.amount, p.name AS partner_name FROM partner_payments pp
       JOIN partners p ON p.id = pp.partner_id WHERE pp.method = ?`
    )
      .all(account)
      .forEach((r) => add(r.date, "out", `دفعة للشريك: ${r.partner_name}`, r.amount, { src: "partner_payments", src_id: r.id }));

    db.prepare(
      `SELECT sp.id, sp.date, sp.amount, s.name AS supplier_name FROM supplier_payments sp
       JOIN suppliers s ON s.id = sp.supplier_id WHERE sp.method = ?`
    )
      .all(account)
      .forEach((r) => add(r.date, "out", `دفعة للمورد: ${r.supplier_name}`, r.amount, { src: "supplier_payments", src_id: r.id }));

    db.prepare(
      `SELECT ce.id, ce.date, ce.amount, ce.note, c.name AS creditor_name FROM creditor_entries ce
       JOIN creditors c ON c.id = ce.creditor_id WHERE ce.type = 'payment' AND ce.method = ?`
    )
      .all(account)
      .forEach((r) => add(r.date, "out", `سداد لـ ${r.creditor_name}${r.note ? ` (${r.note})` : ""}`, r.amount, { src: "creditor_entries", src_id: r.id }));

    // العهد: المبلغ اللي اتسلم (وأي زيادة) طالع من الخزنة، والباقي اللي رجع داخل.
    // الحساب الشخصي لصاحب الكوميشن: اللي اتقبض/اتدفع فعلًا من خزنة الشركة —
    // استلف أو حصّل = داخل، سدد أو سلّف حد = طالع.
    const LEDGER_CASH = { loan: ["in", "استلف"], collection: ["in", "حصّل"], repayment: ["out", "سدد"], due: ["out", "سلّف"] };
    db.prepare("SELECT id, date, amount, type, party_name, description FROM hassan_ledger WHERE method = ?")
      .all(account)
      .forEach((r) => {
        const [direction, verb] = LEDGER_CASH[r.type] ?? ["out", ""];
        add(r.date, direction, `الحساب الشخصي: ${verb}${r.party_name ? ` — ${r.party_name}` : ""}${r.description ? ` (${r.description})` : ""}`, r.amount, {
          src: "hassan_ledger",
          src_id: r.id,
        });
      });

    // خزنة واحدة: الصرف من الكوميشن طالع فعلًا من حساب في خزنة الشركة.
    db.prepare(
      `SELECT x.id, x.date, x.amount, NULLIF(TRIM(x.category), '') AS category, x.description FROM hassan_treasury_expenses x WHERE x.method = ?`
    )
      .all(account)
      .forEach((r) => {
        const item = r.category && r.description && r.description !== r.category ? `${r.category} — ${r.description}` : r.category || r.description;
        add(r.date, "out", `من الكوميشن: ${item}`, r.amount, { src: "hassan_treasury_expenses", src_id: r.id });
      });

    db.prepare("SELECT id, date, amount, holder FROM custodies WHERE method = ?")
      .all(account)
      .forEach((r) => add(r.date, "out", `عهدة لـ ${r.holder}`, r.amount, { src: "custodies", src_id: r.id }));
    db.prepare(
      `SELECT ce.id, ce.date, ce.amount, ce.type, c.holder FROM custody_entries ce
       JOIN custodies c ON c.id = ce.custody_id WHERE ce.type IN ('topup', 'return') AND ce.method = ?`
    )
      .all(account)
      .forEach((r) =>
        add(r.date, r.type === "topup" ? "out" : "in", r.type === "topup" ? `زيادة عهدة ${r.holder}` : `رجوع باقي عهدة ${r.holder}`, r.amount, {
          src: "custody_entries",
          src_id: r.id,
        })
      );

    db.prepare("SELECT id, date, amount, note FROM waste_entries WHERE payment_method = ?")
      .all(account)
      .forEach((r) => add(r.date, "out", `هالك${r.note ? `: ${r.note}` : ""}`, r.amount, { src: "waste_entries", src_id: r.id }));

    db.prepare(
      `SELECT cp.id, cp.date, cp.amount, c.name AS contractor_name FROM contractor_payments cp
       JOIN contractors c ON c.id = cp.contractor_id WHERE cp.method = ?`
    )
      .all(account)
      .forEach((r) => add(r.date, "in", `دفعة من المقاول: ${r.contractor_name}`, r.amount, { src: "contractor_payments", src_id: r.id }));

    db.prepare("SELECT * FROM other_income WHERE method = ?")
      .all(account)
      .forEach((r) => add(r.date, "in", `إيراد آخر${r.description ? `: ${r.description}` : ""}`, r.amount, { other_income_id: r.id, src: "other_income", src_id: r.id }));

    db.prepare("SELECT * FROM treasury_transfers WHERE from_account = ? OR to_account = ?")
      .all(account, account)
      .forEach((r) => {
        const out = r.from_account === account;
        const other = ACCOUNT_NAME_AR[out ? r.to_account : r.from_account] ?? "";
        add(r.date, out ? "out" : "in", `تحويل ${out ? "إلى" : "من"} ${other}${r.note ? ` — ${r.note}` : ""}`, r.amount, {
          transfer_id: r.id,
          src: "treasury_transfers",
          src_id: r.id,
        });
      });

    db.prepare("SELECT * FROM treasury_adjustments WHERE account = ?")
      .all(account)
      .forEach((r) =>
        add(r.date, r.amount >= 0 ? "in" : "out", `تسوية جرد (${r.amount >= 0 ? "زيادة" : "عجز"})${r.note ? `: ${r.note}` : ""}`, Math.abs(r.amount), {
          adjustment_id: r.id,
          src: "treasury_adjustments",
          src_id: r.id,
        })
      );

    // عمولة التحويل: الحركة الأصلية مكتوب جنبها "اتدفع كذا + عمولة كذا"، والعمولة
    // نفسها سطر طالع لوحده من نفس الحساب.
    const accName = ACCOUNT_NAME_AR[account] ?? account;
    for (const f of db.prepare("SELECT * FROM transfer_fees WHERE account = ?").all(account)) {
      const base = rows.find((r) => r.src === f.src && r.src_id === f.src_id);
      if (base) base.label += ` — اتدفع ${Number(f.base_amount ?? base.amount).toLocaleString("en-US")} + عمولة ${accName} ${Number(f.amount).toLocaleString("en-US")}`;
      add(f.date, "out", `عمولة ${accName}${base ? ` على: ${base.label.split(" — اتدفع")[0]}` : ""}`, f.amount, { src: "transfer_fees", src_id: f.id });
    }

    rows.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    return rows;
  }

  // الرصيد المحسوب لحساب لحد تاريخ معيّن (شامل) — البداية + حركته من تاريخ البداية.
  function accountBalance(acc, untilDate) {
    const from = acc.opening_date ?? "";
    return cashMovements(acc.name)
      .filter((m) => m.date >= from && (!untilDate || m.date <= untilDate))
      .reduce((sum, m) => sum + (m.direction === "in" ? m.amount : -m.amount), acc.opening_balance ?? 0);
  }

  return { payrollSummary, computePairedCommission, pairKey, computeCommissionRows, equipmentAllTimeProfit, partnersSummary, ACCOUNT_NAME_AR, cashMovements, accountBalance };
};
