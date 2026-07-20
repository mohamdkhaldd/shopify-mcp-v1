const { ipcMain } = require("electron");

// Overtime rule (doc section 3), applied identically to السركي and المقاول:
// hourly rate = day_rate / 8, overtime = MAX(0, actual - base) hours,
// day value = day_rate + overtime_hours * hourly_rate. سركي سوق has no
// hours at all — the day value is just whatever fixed amount was entered.
function computeDayValue(log) {
  if (log.role === "market") return log.fixed_value ?? 0;
  const dayRate = log.day_rate ?? 0;
  const hourlyRate = dayRate / 8;
  const overtimeHours = Math.max(0, (log.actual_hours ?? 0) - (log.base_hours ?? 0));
  return dayRate + overtimeHours * hourlyRate;
}

function registerIpcHandlers(db) {
  // --- Partners ---
  ipcMain.handle("partners:list", () => db.prepare("SELECT * FROM partners ORDER BY name").all());
  ipcMain.handle("partners:create", (_e, { name }) => {
    const info = db.prepare("INSERT INTO partners (name) VALUES (?)").run(name.trim());
    return { id: info.lastInsertRowid, name: name.trim() };
  });
  ipcMain.handle("partners:delete", (_e, { id }) => {
    db.prepare("DELETE FROM partners WHERE id = ?").run(id);
    return { ok: true };
  });

  // --- Employees (drivers / salaried workers) ---
  ipcMain.handle("employees:list", () => db.prepare("SELECT * FROM employees ORDER BY name").all());
  ipcMain.handle("employees:create", (_e, { name, wage_type, rate }) => {
    const info = db
      .prepare("INSERT INTO employees (name, wage_type, rate) VALUES (?, ?, ?)")
      .run(name.trim(), wage_type, rate);
    return { id: info.lastInsertRowid, name: name.trim(), wage_type, rate };
  });
  ipcMain.handle("employees:delete", (_e, { id }) => {
    db.prepare("DELETE FROM employees WHERE id = ?").run(id);
    return { ok: true };
  });

  // --- Contractors ---
  ipcMain.handle("contractors:list", () => db.prepare("SELECT * FROM contractors ORDER BY name").all());
  ipcMain.handle("contractors:create", (_e, { name }) => {
    const info = db.prepare("INSERT INTO contractors (name) VALUES (?)").run(name.trim());
    return { id: info.lastInsertRowid, name: name.trim() };
  });
  ipcMain.handle("contractors:delete", (_e, { id }) => {
    db.prepare("DELETE FROM contractors WHERE id = ?").run(id);
    return { ok: true };
  });

  // --- Expense categories ---
  ipcMain.handle("expenseCategories:list", () =>
    db.prepare("SELECT * FROM expense_categories ORDER BY name").all()
  );
  ipcMain.handle("expenseCategories:create", (_e, { name }) => {
    const info = db.prepare("INSERT INTO expense_categories (name) VALUES (?)").run(name.trim());
    return { id: info.lastInsertRowid, name: name.trim() };
  });
  ipcMain.handle("expenseCategories:delete", (_e, { id }) => {
    db.prepare("DELETE FROM expense_categories WHERE id = ?").run(id);
    return { ok: true };
  });

  // --- Equipment (+ partner shares) ---
  const getEquipmentWithShares = () => {
    const rows = db.prepare("SELECT * FROM equipment ORDER BY name").all();
    const shareStmt = db.prepare(
      "SELECT partner_id, percentage FROM equipment_partner_shares WHERE equipment_id = ?"
    );
    return rows.map((row) => ({ ...row, shares: shareStmt.all(row.id) }));
  };

  ipcMain.handle("equipment:list", () => getEquipmentWithShares());

  ipcMain.handle("equipment:create", (_e, { name, shares }) => {
    const insertEquipment = db.prepare("INSERT INTO equipment (name) VALUES (?)");
    const insertShare = db.prepare(
      "INSERT INTO equipment_partner_shares (equipment_id, partner_id, percentage) VALUES (?, ?, ?)"
    );
    const tx = db.transaction(() => {
      const info = insertEquipment.run(name.trim());
      const equipmentId = info.lastInsertRowid;
      for (const share of shares ?? []) {
        insertShare.run(equipmentId, share.partner_id, share.percentage);
      }
      return equipmentId;
    });
    const equipmentId = tx();
    return getEquipmentWithShares().find((e) => e.id === equipmentId);
  });

  ipcMain.handle("equipment:delete", (_e, { id }) => {
    db.prepare("DELETE FROM equipment WHERE id = ?").run(id);
    return { ok: true };
  });

  // --- Daily logs (السركي / المقاول / سركي سوق — same table, different role) ---
  ipcMain.handle("dailyLogs:list", (_e, { equipment_id, month, role }) => {
    const rows = db
      .prepare(
        "SELECT * FROM daily_logs WHERE equipment_id = ? AND role = ? AND date LIKE ? ORDER BY date"
      )
      .all(equipment_id, role, `${month}%`);
    return rows.map((row) => ({ ...row, day_value: computeDayValue(row) }));
  });

  // One row per equipment/date/role — matches the spreadsheet's "one line per
  // day of the month" layout, so saving a day's cells overwrites that day's
  // row instead of appending a new one.
  ipcMain.handle("dailyLogs:upsert", (_e, log) => {
    const params = {
      equipment_id: log.equipment_id,
      date: log.date,
      role: log.role,
      person_name: log.person_name,
      actual_hours: log.actual_hours ?? null,
      base_hours: log.base_hours ?? null,
      day_rate: log.day_rate ?? null,
      fixed_value: log.fixed_value ?? null,
      hassan_commission: log.hassan_commission ?? null,
    };
    db.prepare(
      `INSERT INTO daily_logs (equipment_id, date, role, person_name, actual_hours, base_hours, day_rate, fixed_value, hassan_commission)
       VALUES (@equipment_id, @date, @role, @person_name, @actual_hours, @base_hours, @day_rate, @fixed_value, @hassan_commission)
       ON CONFLICT(equipment_id, date, role) DO UPDATE SET
         person_name = excluded.person_name,
         actual_hours = excluded.actual_hours,
         base_hours = excluded.base_hours,
         day_rate = excluded.day_rate,
         fixed_value = excluded.fixed_value,
         hassan_commission = excluded.hassan_commission`
    ).run(params);
    const row = db
      .prepare("SELECT * FROM daily_logs WHERE equipment_id = ? AND date = ? AND role = ?")
      .get(log.equipment_id, log.date, log.role);
    return { ...row, day_value: computeDayValue(row) };
  });

  ipcMain.handle("dailyLogs:delete", (_e, { id }) => {
    db.prepare("DELETE FROM daily_logs WHERE id = ?").run(id);
    return { ok: true };
  });

  // --- Monthly expenses ---
  ipcMain.handle("monthlyExpenses:list", (_e, { equipment_id, month }) =>
    db
      .prepare(
        `SELECT me.*, ec.name AS category_name FROM monthly_expenses me
         LEFT JOIN expense_categories ec ON ec.id = me.category_id
         WHERE me.equipment_id = ? AND me.month = ? ORDER BY me.id`
      )
      .all(equipment_id, month)
  );

  ipcMain.handle("monthlyExpenses:create", (_e, expense) => {
    const info = db
      .prepare(
        `INSERT INTO monthly_expenses (equipment_id, month, category_id, amount, payment_method)
         VALUES (@equipment_id, @month, @category_id, @amount, @payment_method)`
      )
      .run(expense);
    return db
      .prepare(
        `SELECT me.*, ec.name AS category_name FROM monthly_expenses me
         LEFT JOIN expense_categories ec ON ec.id = me.category_id WHERE me.id = ?`
      )
      .get(info.lastInsertRowid);
  });

  ipcMain.handle("monthlyExpenses:delete", (_e, { id }) => {
    db.prepare("DELETE FROM monthly_expenses WHERE id = ?").run(id);
    return { ok: true };
  });

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
    const expenseTotal = expenses.reduce((sum, e) => sum + e.amount, 0);
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

    return { driverIncome, marketIncome, income, expenseTotal, netProfit, distribution };
  });

  // --- Employee advances (سلف) ---
  ipcMain.handle("employeeAdvances:list", (_e, { employee_id, month }) =>
    db
      .prepare("SELECT * FROM employee_advances WHERE employee_id = ? AND date LIKE ? ORDER BY date")
      .all(employee_id, `${month}%`)
  );
  ipcMain.handle("employeeAdvances:create", (_e, advance) => {
    const info = db
      .prepare(
        `INSERT INTO employee_advances (employee_id, date, amount, payment_method, note)
         VALUES (@employee_id, @date, @amount, @payment_method, @note)`
      )
      .run({ ...advance, payment_method: advance.payment_method || "cash", note: advance.note ?? null });
    return db.prepare("SELECT * FROM employee_advances WHERE id = ?").get(info.lastInsertRowid);
  });
  ipcMain.handle("employeeAdvances:delete", (_e, { id }) => {
    db.prepare("DELETE FROM employee_advances WHERE id = ?").run(id);
    return { ok: true };
  });

  // --- Payroll summary (doc section 5): daily wage = sum of driver day-values
  // across every equipment this month; monthly wage = fixed rate. Advances
  // are deducted from either type. ---
  ipcMain.handle("payroll:summary", (_e, { month }) => {
    const employees = db.prepare("SELECT * FROM employees ORDER BY name").all();
    const driverLogsStmt = db.prepare(
      "SELECT * FROM daily_logs WHERE role = 'driver' AND person_name = ? AND date LIKE ?"
    );
    const advancesStmt = db.prepare(
      "SELECT COALESCE(SUM(amount), 0) AS total FROM employee_advances WHERE employee_id = ? AND date LIKE ?"
    );

    return employees.map((emp) => {
      const advancesTotal = advancesStmt.get(emp.id, `${month}%`).total;
      if (emp.wage_type === "monthly") {
        const grossPay = emp.rate;
        return {
          id: emp.id,
          name: emp.name,
          wage_type: emp.wage_type,
          rate: emp.rate,
          days_worked: null,
          gross_pay: grossPay,
          advances_total: advancesTotal,
          net_pay: grossPay - advancesTotal,
        };
      }
      const logs = driverLogsStmt.all(emp.name, `${month}%`);
      const grossPay = logs.reduce((sum, l) => sum + computeDayValue(l), 0);
      return {
        id: emp.id,
        name: emp.name,
        wage_type: emp.wage_type,
        rate: emp.rate,
        days_worked: logs.length,
        gross_pay: grossPay,
        advances_total: advancesTotal,
        net_pay: grossPay - advancesTotal,
      };
    });
  });

  // --- Payroll detail: the per-driver "payslip" — every day worked this
  // month, which equipment, and what it paid, plus the advances list. This
  // is what gets screenshotted and sent to the driver. ---
  ipcMain.handle("payroll:detail", (_e, { employee_id, month }) => {
    const employee = db.prepare("SELECT * FROM employees WHERE id = ?").get(employee_id);
    const advances = db
      .prepare("SELECT * FROM employee_advances WHERE employee_id = ? AND date LIKE ? ORDER BY date")
      .all(employee_id, `${month}%`);
    const advancesTotal = advances.reduce((sum, a) => sum + a.amount, 0);

    if (employee.wage_type === "monthly") {
      return {
        employee,
        days: [],
        advances,
        grossPay: employee.rate,
        advancesTotal,
        netPay: employee.rate - advancesTotal,
      };
    }

    const logs = db
      .prepare(
        `SELECT dl.*, e.name AS equipment_name FROM daily_logs dl
         JOIN equipment e ON e.id = dl.equipment_id
         WHERE dl.role = 'driver' AND dl.person_name = ? AND dl.date LIKE ?
         ORDER BY dl.date`
      )
      .all(employee.name, `${month}%`);
    const days = logs.map((l) => ({
      date: l.date,
      equipment_name: l.equipment_name,
      actual_hours: l.actual_hours,
      base_hours: l.base_hours,
      day_rate: l.day_rate,
      day_value: computeDayValue(l),
    }));
    const grossPay = days.reduce((sum, d) => sum + d.day_value, 0);

    return { employee, days, advances, grossPay, advancesTotal, netPay: grossPay - advancesTotal };
  });

  // --- Hassan: commission (doc section 4) ---
  // Regular equipment: commission = (contractor day_rate - driver day_rate)
  // + overtime_hours * (contractor_rate/8 - driver_rate/8), paired by date.
  // The two winches use a flat % of the contractor's day_rate instead.
  // سركي سوق has no formula — whatever commission was typed in on that row.
  const WINCH_PERCENTAGE_EQUIPMENT = ["ونش 5 طن دبوسة", "ونش 3 وصلة"];

  function computePairedCommission(equipmentName, driverLog, contractorLog) {
    if (WINCH_PERCENTAGE_EQUIPMENT.includes(equipmentName)) {
      const k = contractorLog.day_rate ?? 0;
      return k <= 2500 ? k * 0.2 : k * 0.175;
    }
    const k = contractorLog.day_rate ?? 0;
    const h = driverLog.day_rate ?? 0;
    const overtimeHours = Math.max(0, (contractorLog.actual_hours ?? 0) - (contractorLog.base_hours ?? 0));
    return (k - h) + overtimeHours * (k / 8 - h / 8);
  }

  ipcMain.handle("hassan:commissionSummary", (_e, { month }) => {
    const equipmentList = db.prepare("SELECT * FROM equipment ORDER BY name").all();
    const rows = [];

    for (const equipment of equipmentList) {
      const driverLogs = db
        .prepare("SELECT * FROM daily_logs WHERE equipment_id = ? AND role = 'driver' AND date LIKE ?")
        .all(equipment.id, `${month}%`);
      const contractorLogs = db
        .prepare("SELECT * FROM daily_logs WHERE equipment_id = ? AND role = 'contractor' AND date LIKE ?")
        .all(equipment.id, `${month}%`);
      const marketLogs = db
        .prepare(
          "SELECT * FROM daily_logs WHERE equipment_id = ? AND role = 'market' AND date LIKE ? AND hassan_commission IS NOT NULL"
        )
        .all(equipment.id, `${month}%`);

      const driverByDate = new Map(driverLogs.map((l) => [l.date, l]));
      for (const contractorLog of contractorLogs) {
        const driverLog = driverByDate.get(contractorLog.date);
        if (!driverLog) continue;
        rows.push({
          equipment_id: equipment.id,
          equipment_name: equipment.name,
          date: contractorLog.date,
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
    }

    rows.sort((a, b) => a.date.localeCompare(b.date));
    const total = rows.reduce((sum, r) => sum + r.commission, 0);
    return { rows, total };
  });

  // --- Hassan: personal ledger (doc section 7) — separate from commission ---
  ipcMain.handle("hassanLedger:list", (_e, { month }) =>
    db.prepare("SELECT * FROM hassan_ledger WHERE date LIKE ? ORDER BY date DESC").all(`${month}%`)
  );
  ipcMain.handle("hassanLedger:create", (_e, entry) => {
    const info = db
      .prepare(
        `INSERT INTO hassan_ledger (date, type, amount, party_name, description, note)
         VALUES (@date, @type, @amount, @party_name, @description, @note)`
      )
      .run({
        date: entry.date,
        type: entry.type,
        amount: entry.amount,
        party_name: entry.party_name ?? null,
        description: entry.description ?? null,
        note: entry.note ?? null,
      });
    return db.prepare("SELECT * FROM hassan_ledger WHERE id = ?").get(info.lastInsertRowid);
  });
  ipcMain.handle("hassanLedger:delete", (_e, { id }) => {
    db.prepare("DELETE FROM hassan_ledger WHERE id = ?").run(id);
    return { ok: true };
  });
  ipcMain.handle("hassanLedger:balance", () => {
    const sums = db
      .prepare("SELECT type, COALESCE(SUM(amount), 0) AS total FROM hassan_ledger GROUP BY type")
      .all();
    const byType = Object.fromEntries(sums.map((s) => [s.type, s.total]));
    const netDebt = (byType.loan ?? 0) - (byType.repayment ?? 0);
    const netDue = (byType.due ?? 0) - (byType.collection ?? 0);
    return { netDebt, netDue };
  });

  // Per-party breakdown: doc asks "who does Hassan owe, how much is left,
  // who owes Hassan, how much is left" by name, not just one lump total.
  ipcMain.handle("hassanLedger:balanceByParty", () => {
    const rows = db.prepare("SELECT * FROM hassan_ledger").all();
    const byParty = new Map();
    for (const row of rows) {
      const party = row.party_name?.trim() || "بدون تحديد";
      if (!byParty.has(party)) {
        byParty.set(party, { party_name: party, loan: 0, repayment: 0, due: 0, collection: 0 });
      }
      byParty.get(party)[row.type] += row.amount;
    }
    return [...byParty.values()]
      .map((p) => ({
        party_name: p.party_name,
        netDebt: p.loan - p.repayment,
        netDue: p.due - p.collection,
      }))
      .filter((p) => p.netDebt !== 0 || p.netDue !== 0)
      .sort((a, b) => a.party_name.localeCompare(b.party_name));
  });

  // --- Contractor payments ---
  ipcMain.handle("contractorPayments:list", (_e, { contractor_id }) =>
    db.prepare("SELECT * FROM contractor_payments WHERE contractor_id = ? ORDER BY date DESC").all(contractor_id)
  );
  ipcMain.handle("contractorPayments:create", (_e, payment) => {
    const info = db
      .prepare(
        `INSERT INTO contractor_payments (contractor_id, date, amount, method, note)
         VALUES (@contractor_id, @date, @amount, @method, @note)`
      )
      .run({ ...payment, method: payment.method || "cash", note: payment.note ?? null });
    return db.prepare("SELECT * FROM contractor_payments WHERE id = ?").get(info.lastInsertRowid);
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
      const totalWork = workStmt.all(c.name).reduce((sum, l) => sum + computeDayValue(l), 0);
      const totalPaid = paidStmt.get(c.id).total;
      return { id: c.id, name: c.name, totalWork, totalPaid, remaining: totalWork - totalPaid };
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

    const totalWork = logs.reduce((sum, l) => sum + computeDayValue(l), 0);
    const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);

    return {
      contractor,
      workByEquipment: [...byEquipment.values()],
      payments,
      totalWork,
      totalPaid,
      remaining: totalWork - totalPaid,
    };
  });

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
    return db.prepare("SELECT * FROM partner_payments WHERE id = ?").get(info.lastInsertRowid);
  });
  ipcMain.handle("partnerPayments:delete", (_e, { id }) => {
    db.prepare("DELETE FROM partner_payments WHERE id = ?").run(id);
    return { ok: true };
  });

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
    return income - expense;
  }

  ipcMain.handle("partners:summary", () => {
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
      const totalDue = shares.reduce(
        (sum, s) => sum + (equipmentAllTimeProfit(s.equipment_id) * s.percentage) / 100,
        0
      );
      const totalPaid = paidStmt.get(p.id).total;
      return { id: p.id, name: p.name, totalDue, totalPaid, remaining: totalDue - totalPaid };
    });
  });

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
      const driverIncome = db
        .prepare("SELECT * FROM daily_logs WHERE equipment_id = ? AND role = 'driver' AND date LIKE ?")
        .all(s.equipment_id, `${month}%`)
        .reduce((sum, l) => sum + computeDayValue(l), 0);
      const marketIncome = db
        .prepare("SELECT * FROM daily_logs WHERE equipment_id = ? AND role = 'market' AND date LIKE ?")
        .all(s.equipment_id, `${month}%`)
        .reduce((sum, l) => sum + computeDayValue(l), 0);
      const expense = db
        .prepare("SELECT COALESCE(SUM(amount), 0) AS total FROM monthly_expenses WHERE equipment_id = ? AND month = ?")
        .get(s.equipment_id, month).total;
      const netProfit = driverIncome + marketIncome - expense;
      return {
        equipment_name: s.equipment_name,
        percentage: s.percentage,
        monthAmount: (netProfit * s.percentage) / 100,
      };
    });

    const monthDue = equipmentBreakdown.reduce((sum, e) => sum + e.monthAmount, 0);
    const totalDue = shares.reduce(
      (sum, s) => sum + (equipmentAllTimeProfit(s.equipment_id) * s.percentage) / 100,
      0
    );
    const payments = db
      .prepare("SELECT * FROM partner_payments WHERE partner_id = ? ORDER BY date DESC")
      .all(partner_id);
    const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);

    return { partner, monthDue, equipmentBreakdown, totalDue, totalPaid, remaining: totalDue - totalPaid, payments };
  });

  // --- Treasury (doc section 9) ---
  // Money in: contractor payments (they pay the company). Money out:
  // partner payments, equipment expenses, supplier payments, employee
  // advances — each already carries a payment_method/method tying it to
  // one of the three accounts.
  const ACCOUNT_NAME_AR = { wallet: "محفظة", instapay: "انستا باي", cash: "كاش" };

  ipcMain.handle("treasury:list", () => {
    const rows = db.prepare("SELECT * FROM treasury_accounts ORDER BY id").all();
    return rows.map((r) => ({ ...r, name_ar: ACCOUNT_NAME_AR[r.name] ?? r.name }));
  });

  ipcMain.handle("treasury:updateBalance", (_e, { id, current_balance }) => {
    db.prepare("UPDATE treasury_accounts SET current_balance = ? WHERE id = ?").run(current_balance, id);
    return db.prepare("SELECT * FROM treasury_accounts WHERE id = ?").get(id);
  });

  ipcMain.handle("treasury:summary", (_e, { month }) => {
    const accounts = db.prepare("SELECT * FROM treasury_accounts ORDER BY id").all();
    const sumByMethod = (table, methodCol, dateCol, dateLike) =>
      db
        .prepare(`SELECT ${methodCol} AS method, COALESCE(SUM(amount), 0) AS total FROM ${table} WHERE ${dateCol} LIKE ? GROUP BY ${methodCol}`)
        .all(dateLike)
        .reduce((acc, r) => ({ ...acc, [r.method]: r.total }), {});

    const incoming = sumByMethod("contractor_payments", "method", "date", `${month}%`);
    const outgoingPartners = sumByMethod("partner_payments", "method", "date", `${month}%`);
    const outgoingExpenses = sumByMethod("monthly_expenses", "payment_method", "month", month);
    const outgoingSuppliers = sumByMethod("supplier_payments", "method", "date", `${month}%`);
    const outgoingAdvances = sumByMethod("employee_advances", "payment_method", "date", `${month}%`);

    return accounts.map((acc) => {
      const monthIncoming = incoming[acc.name] ?? 0;
      const monthOutgoing =
        (outgoingPartners[acc.name] ?? 0) +
        (outgoingExpenses[acc.name] ?? 0) +
        (outgoingSuppliers[acc.name] ?? 0) +
        (outgoingAdvances[acc.name] ?? 0);
      const netMovement = monthIncoming - monthOutgoing;
      return {
        id: acc.id,
        name: acc.name,
        name_ar: ACCOUNT_NAME_AR[acc.name] ?? acc.name,
        currentBalance: acc.current_balance,
        monthIncoming,
        monthOutgoing,
        netMovement,
        projectedBalance: acc.current_balance + netMovement,
      };
    });
  });

  // --- Suppliers (doc section 10) — no fixed list, created on first purchase/payment ---
  function findOrCreateSupplier(name) {
    const trimmed = name.trim();
    const existing = db.prepare("SELECT * FROM suppliers WHERE name = ?").get(trimmed);
    if (existing) return existing;
    const info = db.prepare("INSERT INTO suppliers (name) VALUES (?)").run(trimmed);
    return { id: info.lastInsertRowid, name: trimmed };
  }

  ipcMain.handle("suppliers:names", () => db.prepare("SELECT name FROM suppliers ORDER BY name").all().map((r) => r.name));

  ipcMain.handle("supplierPurchases:create", (_e, purchase) => {
    const supplier = findOrCreateSupplier(purchase.supplier_name);
    const info = db
      .prepare(
        `INSERT INTO supplier_purchases (supplier_id, date, description, amount, note)
         VALUES (@supplier_id, @date, @description, @amount, @note)`
      )
      .run({
        supplier_id: supplier.id,
        date: purchase.date,
        description: purchase.description ?? null,
        amount: purchase.amount,
        note: purchase.note ?? null,
      });
    return { ...db.prepare("SELECT * FROM supplier_purchases WHERE id = ?").get(info.lastInsertRowid), supplier_name: supplier.name };
  });

  ipcMain.handle("supplierPayments:create", (_e, payment) => {
    const supplier = findOrCreateSupplier(payment.supplier_name);
    const info = db
      .prepare(
        `INSERT INTO supplier_payments (supplier_id, date, amount, method, note)
         VALUES (@supplier_id, @date, @amount, @method, @note)`
      )
      .run({
        supplier_id: supplier.id,
        date: payment.date,
        amount: payment.amount,
        method: payment.method || "cash",
        note: payment.note ?? null,
      });
    return { ...db.prepare("SELECT * FROM supplier_payments WHERE id = ?").get(info.lastInsertRowid), supplier_name: supplier.name };
  });

  ipcMain.handle("supplierPurchases:delete", (_e, { id }) => {
    db.prepare("DELETE FROM supplier_purchases WHERE id = ?").run(id);
    return { ok: true };
  });
  ipcMain.handle("supplierPayments:delete", (_e, { id }) => {
    db.prepare("DELETE FROM supplier_payments WHERE id = ?").run(id);
    return { ok: true };
  });

  // Dynamic dashboard: any supplier named on a purchase/payment shows up
  // here automatically, no setup step.
  ipcMain.handle("suppliers:dashboard", () => {
    const suppliers = db.prepare("SELECT * FROM suppliers ORDER BY name").all();
    const purchasesStmt = db.prepare("SELECT * FROM supplier_purchases WHERE supplier_id = ? ORDER BY date DESC");
    const paymentsStmt = db.prepare("SELECT * FROM supplier_payments WHERE supplier_id = ? ORDER BY date DESC");

    return suppliers.map((s) => {
      const purchases = purchasesStmt.all(s.id);
      const payments = paymentsStmt.all(s.id);
      const totalPurchases = purchases.reduce((sum, p) => sum + p.amount, 0);
      const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
      return {
        id: s.id,
        name: s.name,
        purchaseCount: purchases.length,
        totalPurchases,
        totalPaid,
        remaining: totalPurchases - totalPaid,
        purchases,
        payments,
      };
    });
  });

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
      const expense = db
        .prepare("SELECT COALESCE(SUM(amount), 0) AS total FROM monthly_expenses WHERE equipment_id = ? AND month = ?")
        .get(eq.id, month).total;
      totalIncome += income;
      totalExpense += expense;
      return { equipment_name: eq.name, income, expense, netProfit: income - expense };
    });

    const employees = db.prepare("SELECT * FROM employees").all();
    let payrollTotal = 0;
    for (const emp of employees) {
      const advances = db
        .prepare("SELECT COALESCE(SUM(amount), 0) AS total FROM employee_advances WHERE employee_id = ? AND date LIKE ?")
        .get(emp.id, `${month}%`).total;
      if (emp.wage_type === "monthly") {
        payrollTotal += emp.rate - advances;
      } else {
        const gross = db
          .prepare("SELECT * FROM daily_logs WHERE role = 'driver' AND person_name = ? AND date LIKE ?")
          .all(emp.name, `${month}%`)
          .reduce((sum, l) => sum + computeDayValue(l), 0);
        payrollTotal += gross - advances;
      }
    }
    const commissionRows = [];
    const winchList = ["ونش 5 طن دبوسة", "ونش 3 وصلة"];
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
      const driverByDate = new Map(driverLogs.map((l) => [l.date, l]));
      for (const cl of contractorLogs) {
        const dl = driverByDate.get(cl.date);
        if (!dl) continue;
        const isWinch = winchList.includes(eq.name);
        const k = cl.day_rate ?? 0;
        const h = dl.day_rate ?? 0;
        const commission = isWinch
          ? k <= 2500
            ? k * 0.2
            : k * 0.175
          : k - h + Math.max(0, (cl.actual_hours ?? 0) - (cl.base_hours ?? 0)) * (k / 8 - h / 8);
        commissionRows.push(commission);
      }
      for (const ml of marketLogs) commissionRows.push(ml.hassan_commission ?? 0);
    }
    const hassanCommissionTotal = commissionRows.reduce((sum, c) => sum + c, 0);

    const treasuryAccounts = db.prepare("SELECT * FROM treasury_accounts ORDER BY id").all();

    return {
      month,
      equipmentRows,
      totalIncome,
      totalExpense,
      netProfit: totalIncome - totalExpense,
      payrollTotal,
      hassanCommissionTotal,
      treasuryBalances: treasuryAccounts.map((a) => ({ name: a.name, name_ar: ACCOUNT_NAME_AR[a.name] ?? a.name, balance: a.current_balance })),
    };
  });
}

module.exports = { registerIpcHandlers };
