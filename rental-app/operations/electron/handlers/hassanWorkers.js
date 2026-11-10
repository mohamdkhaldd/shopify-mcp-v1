const { carPersonalAllMonths } = require("../extras");

// عمال حسن ومرتباتهم
module.exports = function register(db, ipcMain, shared) {
  const { computeCommissionRows, pushToCloud } = shared;

  // --- مرتبات عمال حسن: نفس فكرة شيت المرتبات بس الفلوس طالعة من خزنة حسن. ---
  ipcMain.handle("hassanWorkers:list", () =>
    db.prepare("SELECT * FROM hassan_workers WHERE active = 1 ORDER BY name").all()
  );
  const rateOrNull = (v) => (v === "" || v == null || !(Number(v) > 0) ? null : Number(v));
  ipcMain.handle("hassanWorkers:create", (_e, { name, job, monthly_salary, start_month, day_rate, leave_rate }) => {
    const trimmed = (name ?? "").trim();
    if (!trimmed) throw new Error("لازم اسم العامل");
    const info = db
      .prepare("INSERT INTO hassan_workers (name, job, monthly_salary, start_month, day_rate, leave_rate) VALUES (?, ?, ?, ?, ?, ?)")
      .run(trimmed, job?.trim() || null, Number(monthly_salary) || 0, start_month, rateOrNull(day_rate), rateOrNull(leave_rate));
    return db.prepare("SELECT * FROM hassan_workers WHERE id = ?").get(info.lastInsertRowid);
  });
  ipcMain.handle("hassanWorkers:update", (_e, { id, name, job, monthly_salary, day_rate, leave_rate }) => {
    db.prepare("UPDATE hassan_workers SET name = ?, job = ?, monthly_salary = ?, day_rate = ?, leave_rate = ? WHERE id = ?").run(
      (name ?? "").trim(),
      job?.trim() || null,
      Number(monthly_salary) || 0,
      rateOrNull(day_rate),
      rateOrNull(leave_rate),
      id
    );
    return db.prepare("SELECT * FROM hassan_workers WHERE id = ?").get(id);
  });
  // بيشيل العامل من القائمة من الشهر ده ورايح — حركاته القديمة (وفلوسه اللي
  // اتصرفت من خزنة حسن) بتفضل زي ما هي.
  ipcMain.handle("hassanWorkers:delete", (_e, { id }) => {
    db.prepare("UPDATE hassan_workers SET active = 0 WHERE id = ?").run(id);
    return { ok: true };
  });

  ipcMain.handle("hassanWorkerEntries:list", (_e, { month }) =>
    db
      .prepare(
        `SELECT we.*, w.name AS worker_name FROM hassan_worker_entries we
         JOIN hassan_workers w ON w.id = we.worker_id
         WHERE we.month = ? ORDER BY we.date DESC, we.id DESC`
      )
      .all(month)
  );

  const WORKER_ENTRY_LABEL = { payment: "مرتب", advance: "سلفة" };
  ipcMain.handle("hassanWorkerEntries:create", (_e, { worker_id, month, date, type, amount, note, method }) => {
    const worker = db.prepare("SELECT * FROM hassan_workers WHERE id = ?").get(worker_id);
    if (!worker) throw new Error("العامل مش موجود");
    const tx = db.transaction(() => {
      let treasuryExpenseId = null;
      // الدفعة والسلفة فلوس طالعة فعلاً — بتتسجل في خزنة حسن باسم العامل
      // عشان تبان هناك "اتصرف منها مرتب فلان".
      if (type === "payment" || type === "advance") {
        const description = `${WORKER_ENTRY_LABEL[type]} ${worker.name}${worker.job ? ` (${worker.job})` : ""} — شهر ${month}${
          note?.trim() ? ` — ${note.trim()}` : ""
        }`;
        const info = db
          .prepare("INSERT INTO hassan_treasury_expenses (date, amount, description, method) VALUES (?, ?, ?, ?)")
          .run(date, amount, description, method || "cash");
        treasuryExpenseId = info.lastInsertRowid;
        const created = db.prepare("SELECT * FROM hassan_treasury_expenses WHERE id = ?").get(treasuryExpenseId);
        pushToCloud("hassan_treasury_expenses", created.id, created);
      }
      const info = db
        .prepare(
          `INSERT INTO hassan_worker_entries (worker_id, month, date, type, amount, note, treasury_expense_id)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .run(worker_id, month, date, type, amount, note?.trim() || null, treasuryExpenseId);
      return info.lastInsertRowid;
    });
    const id = tx();
    return db.prepare("SELECT * FROM hassan_worker_entries WHERE id = ?").get(id);
  });
  ipcMain.handle("hassanWorkerEntries:delete", (_e, { id }) => {
    const entry = db.prepare("SELECT * FROM hassan_worker_entries WHERE id = ?").get(id);
    const tx = db.transaction(() => {
      if (entry?.treasury_expense_id) {
        db.prepare("DELETE FROM hassan_treasury_expenses WHERE id = ?").run(entry.treasury_expense_id);
      }
      db.prepare("DELETE FROM hassan_worker_entries WHERE id = ?").run(id);
    });
    tx();
    return { ok: true };
  });

  // شيت مرتبات عمال حسن لشهر: كل عامل شغال من الشهر ده أو قبله (أو عنده
  // حركات في الشهر ده حتى لو اتشال) — المرتب + الحوافز − الخصومات = المستحق،
  // والمصروف = دفعات المرتب + السلف، والباقي = المستحق − المصروف.
  ipcMain.handle("hassanWorkers:payroll", (_e, { month }) => {
    const workers = db
      .prepare(
        `SELECT * FROM hassan_workers w
         WHERE (w.active = 1 AND w.start_month <= ?)
            OR EXISTS (SELECT 1 FROM hassan_worker_entries e WHERE e.worker_id = w.id AND e.month = ?)
         ORDER BY w.name`
      )
      .all(month, month);
    const sumStmt = db.prepare(
      "SELECT COALESCE(SUM(amount), 0) AS total FROM hassan_worker_entries WHERE worker_id = ? AND month = ? AND type = ?"
    );
    const attendanceStmt = db.prepare(
      "SELECT status, COUNT(*) AS c FROM hassan_worker_attendance WHERE worker_id = ? AND date LIKE ? GROUP BY status"
    );
    const rows = workers.map((w) => {
      const payments = sumStmt.get(w.id, month, "payment").total;
      const advances = sumStmt.get(w.id, month, "advance").total;
      const bonuses = sumStmt.get(w.id, month, "bonus").total;
      const deductions = sumStmt.get(w.id, month, "deduction").total;
      const att = Object.fromEntries(attendanceStmt.all(w.id, `${month}%`).map((r) => [r.status, r.c]));
      const daysWorked = att.present ?? 0;
      const paidLeaveDays = att.leave_paid ?? 0;
      const unpaidDays = (att.leave_unpaid ?? 0) + (att.absent ?? 0);
      // باليومية: يوم الشغل بيومية، والإجازة المدفوعة بيومية الإجازة (لو
      // متكتبتش = نفس اليومية)، والإجازة غير المدفوعة والغياب ملهمش فلوس.
      const daily = w.day_rate != null && w.day_rate > 0;
      const leaveRate = w.leave_rate != null && w.leave_rate > 0 ? w.leave_rate : w.day_rate;
      const salary = daily
        ? daysWorked * w.day_rate + paidLeaveDays * leaveRate
        : w.active || w.start_month <= month
          ? w.monthly_salary
          : 0;
      const net = salary + bonuses - deductions;
      const paid = payments + advances;
      return {
        worker_id: w.id,
        name: w.name,
        job: w.job,
        active: !!w.active,
        monthly_salary: salary,
        daily,
        day_rate: w.day_rate,
        leave_rate: daily ? leaveRate : null,
        days_worked: daysWorked,
        paid_leave_days: paidLeaveDays,
        unpaid_days: unpaidDays,
        bonuses,
        deductions,
        net,
        payments,
        advances,
        paid,
        remaining: net - paid,
      };
    });
    const total = (key) => rows.reduce((sum, r) => sum + r[key], 0);
    return {
      month,
      rows,
      totalNet: total("net"),
      totalPaid: total("paid"),
      totalRemaining: total("remaining"),
    };
  });

  ipcMain.handle("hassan:treasuryBalance", (_e, { month }) => {
    const allTimePenalties = db.prepare("SELECT COALESCE(SUM(amount), 0) AS total FROM hassan_penalties").get().total;
    const monthPenalties = db
      .prepare("SELECT COALESCE(SUM(amount), 0) AS total FROM hassan_penalties WHERE date LIKE ?")
      .get(`${month}%`).total;
    // الكوميشن هنا صافي بعد الجزاءات — ده اللي فعلاً بيدخل خزنة حسن.
    const allTimeCommission = computeCommissionRows(null).total - allTimePenalties;
    const monthCommission = computeCommissionRows(month).total - monthPenalties;
    // الجزء الخاص من بنزين العربية الملاكي بيتخصم من كوميشن حسن.
    const car = carPersonalAllMonths(db);
    const allTimeSpent =
      db.prepare("SELECT COALESCE(SUM(amount), 0) AS total FROM hassan_treasury_expenses").get().total + car.reduce((s, c) => s + c.personal, 0);
    const monthSpent =
      db.prepare("SELECT COALESCE(SUM(amount), 0) AS total FROM hassan_treasury_expenses WHERE date LIKE ?").get(`${month}%`).total +
      (car.find((c) => c.month === month)?.personal ?? 0);
    // فلوسه الشخصية اللي دخلت/طلعت من خزنة الشركة (الحساب الشخصي بحساب).
    const ledgerCash = (where, ...args) =>
      db
        .prepare(
          `SELECT COALESCE(SUM(CASE WHEN type IN ('loan', 'collection') THEN amount ELSE -amount END), 0) AS total
           FROM hassan_ledger WHERE method IS NOT NULL ${where}`
        )
        .get(...args).total;
    const allTimeLedger = ledgerCash("");
    const monthLedger = ledgerCash("AND date LIKE ?", `${month}%`);
    return {
      balance: allTimeCommission - allTimeSpent + allTimeLedger,
      allTimeLedger,
      monthLedger,
      allTimeCommission,
      allTimeSpent,
      monthCommission,
      monthSpent,
      monthPenalties,
      allTimePenalties,
    };
  });

  ipcMain.handle("hassanTreasury:list", (_e, { month }) => {
    // البند: اللي اتكتب، ولو مفيش (مصاريف قديمة) — مرتبات العمال أو البيان نفسه
    const rows = db
      .prepare(
        `SELECT x.*, COALESCE(NULLIF(TRIM(x.category), ''),
           CASE WHEN EXISTS (SELECT 1 FROM hassan_worker_entries w WHERE w.treasury_expense_id = x.id) THEN 'مرتبات العمال' END,
           x.description) AS category
         FROM hassan_treasury_expenses x WHERE x.date LIKE ? ORDER BY x.date DESC, x.id DESC`
      )
      .all(`${month}%`);
    // سطر محسوب (مش متسجل): الخاص من العربية الملاكي الشهر ده.
    const car = carPersonalAllMonths(db).find((c) => c.month === month);
    if (car && car.personal > 0) {
      rows.unshift({
        id: `car-${month}`,
        date: car.lastDate,
        amount: car.personal,
        description: `العربية الملاكي — خاص (بنزين وزيت ${Math.round(car.fuelTotal).toLocaleString("en-US")} − مشاوير شغل ${Math.round(car.tripsTotal).toLocaleString("en-US")})`,
        category: "العربية الملاكي",
        computed: true,
      });
    }
    return rows;
  });
  ipcMain.handle("hassanTreasury:categories", () =>
    db
      .prepare("SELECT category FROM hassan_treasury_expenses WHERE TRIM(COALESCE(category, '')) <> '' GROUP BY category ORDER BY MAX(date) DESC")
      .all()
      .map((r) => r.category)
  );
  ipcMain.handle("hassanTreasury:create", (_e, expense) => {
    const category = (expense.category ?? "").trim() || null;
    const description = (expense.description ?? "").trim() || category || "";
    if (!description) throw new Error("اكتب البند");
    const info = db
      .prepare("INSERT INTO hassan_treasury_expenses (date, amount, description, category, method) VALUES (?, ?, ?, ?, ?)")
      .run(expense.date, expense.amount, description, category, expense.method || "cash");
    const created = db.prepare("SELECT * FROM hassan_treasury_expenses WHERE id = ?").get(info.lastInsertRowid);
    pushToCloud("hassan_treasury_expenses", created.id, created);
    return created;
  });
  ipcMain.handle("hassanTreasury:delete", (_e, { id }) => {
    // لو السطر ده جاي من شيت مرتبات العمال، بتتمسح الحركة هناك كمان عشان
    // الشيتين ميختلفوش.
    db.prepare("DELETE FROM hassan_worker_entries WHERE treasury_expense_id = ?").run(id);
    db.prepare("DELETE FROM hassan_treasury_expenses WHERE id = ?").run(id);
    return { ok: true };
  });
};
