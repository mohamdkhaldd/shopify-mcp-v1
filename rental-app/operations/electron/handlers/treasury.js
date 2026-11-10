const { feeRules } = require("../fees");

// الخزنة: الكاش الحقيقي
module.exports = function register(db, ipcMain, shared) {
  const { ACCOUNT_NAME_AR, cashMovements, accountBalance } = shared;

  // --- Treasury: الكاش الحقيقي ---

  function todayISO() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  // اسم الشخص اللي بياخد الكوميشن (صفحة "حسن" عند البنيان) — كل شركة بتكتبه
  // من الإعدادات، وبيتزامن على كل أجهزتها. فاضي = لسه متكتبش.
  ipcMain.handle("commission:getName", () => {
    const row = db.prepare("SELECT value FROM app_settings WHERE key = 'commission_name'").get();
    return row?.value ?? "";
  });
  ipcMain.handle("commission:setName", (_e, { name }) => {
    db.prepare(
      "INSERT INTO app_settings (key, value) VALUES ('commission_name', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    ).run(String(name ?? "").trim());
    return { ok: true };
  });

  // نسبة عمولة التحويل لكل حساب: { instapay: { pct, min, max } } — بتتزامن على كل الأجهزة
  ipcMain.handle("fees:get", () => feeRules(db));
  ipcMain.handle("fees:set", (_e, { rules }) => {
    db.prepare(
      "INSERT INTO app_settings (key, value) VALUES ('transfer_fee_rules', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
    ).run(JSON.stringify(rules ?? {}));
    return feeRules(db);
  });

  ipcMain.handle("treasury:list", () => {
    const rows = db.prepare("SELECT * FROM treasury_accounts ORDER BY CASE name WHEN 'wallet' THEN 1 WHEN 'instapay' THEN 2 WHEN 'cash' THEN 3 WHEN 'vodafone_cash' THEN 4 ELSE 5 END, id").all();
    return rows.map((r) => ({ ...r, name_ar: ACCOUNT_NAME_AR[r.name] ?? r.name }));
  });

  ipcMain.handle("treasury:setOpening", (_e, { id, opening_balance, opening_date }) => {
    db.prepare("UPDATE treasury_accounts SET opening_balance = ?, opening_date = ? WHERE id = ?").run(
      Number(opening_balance) || 0,
      opening_date || null,
      id
    );
    return { ok: true };
  });

  ipcMain.handle("treasury:summary", (_e, { month }) => {
    const accounts = db.prepare("SELECT * FROM treasury_accounts ORDER BY CASE name WHEN 'wallet' THEN 1 WHEN 'instapay' THEN 2 WHEN 'cash' THEN 3 WHEN 'vodafone_cash' THEN 4 ELSE 5 END, id").all();
    return accounts.map((acc) => {
      const movements = cashMovements(acc.name);
      const from = acc.opening_date ?? "";
      const inMonth = movements.filter((m) => m.date.startsWith(month));
      const monthIncoming = inMonth.filter((m) => m.direction === "in").reduce((s, m) => s + m.amount, 0);
      const monthOutgoing = inMonth.filter((m) => m.direction === "out").reduce((s, m) => s + m.amount, 0);
      const balance = movements
        .filter((m) => m.date >= from)
        .reduce((sum, m) => sum + (m.direction === "in" ? m.amount : -m.amount), acc.opening_balance ?? 0);
      const lastCount = db
        .prepare("SELECT * FROM treasury_adjustments WHERE account = ? ORDER BY date DESC, id DESC LIMIT 1")
        .get(acc.name);
      return {
        id: acc.id,
        name: acc.name,
        name_ar: ACCOUNT_NAME_AR[acc.name] ?? acc.name,
        openingBalance: acc.opening_balance ?? 0,
        openingDate: acc.opening_date,
        balance,
        monthIncoming,
        monthOutgoing,
        netMovement: monthIncoming - monthOutgoing,
        lastCountDate: lastCount?.date ?? null,
      };
    });
  });

  // كشف حساب لشهر: كل حركة بتاريخها والرصيد بعدها. الحركات اللي قبل تاريخ
  // رصيد البداية بتظهر بس من غير ما تأثر على الرصيد (البداية متعدّة بعدها).
  // كل حركات الشهر (داخل أو طالع) في كل الحسابات — عشان تتعدّل أو تتمسح من
  // صفحة الخزنة وإنت بتظبط الأرصدة.
  ipcMain.handle("treasury:monthMovements", (_e, { month, direction }) =>
    db
      .prepare("SELECT name FROM treasury_accounts")
      .all()
      .flatMap((a) => cashMovements(a.name).map((m) => ({ ...m, account: a.name })))
      .filter((m) => m.date.startsWith(month) && (!direction || m.direction === direction))
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
  );

  // تعديل حركة من الخزنة: التاريخ والمبلغ والحساب — في الجدول اللي جاية منه.
  const MOVEMENT_COLUMNS = {
    monthly_expenses: { method: "payment_method" },
    expense_payments: { method: "method" },
    employee_advances: { method: "payment_method" },
    employee_bonuses: { method: "payment_method" },
    salary_payments: { method: "payment_method" },
    partner_payments: { method: "method" },
    supplier_payments: { method: "method" },
    creditor_entries: { method: "method" },
    hassan_ledger: { method: "method" },
    hassan_treasury_expenses: { method: "method" },
    custodies: { method: "method" },
    custody_entries: { method: "method" },
    waste_entries: { method: "payment_method" },
    contractor_payments: { method: "method" },
    other_income: { method: "method" },
    treasury_transfers: { method: null },
    treasury_adjustments: { method: null },
    transfer_fees: { method: "account" },
  };
  ipcMain.handle("treasury:movementUpdate", (_e, { src, src_id, date, amount, account }) => {
    const cfg = MOVEMENT_COLUMNS[src];
    if (!cfg) throw new Error("الحركة دي مينفعش تتعدّل من هنا");
    const value = Number(amount);
    if (!(value > 0)) throw new Error("لازم مبلغ");
    const tx = db.transaction(() => {
      if (src === "monthly_expenses") {
        // المصروف: اللي اتدفع وقت التسجيل هو اللي بيطلع من الخزنة.
        const me = db.prepare("SELECT * FROM monthly_expenses WHERE id = ?").get(src_id);
        if (me.paid_amount == null) db.prepare("UPDATE monthly_expenses SET amount = ? WHERE id = ?").run(value, src_id);
        else db.prepare("UPDATE monthly_expenses SET paid_amount = ? WHERE id = ?").run(Math.min(value, me.amount), src_id);
        db.prepare("UPDATE monthly_expenses SET date = ? WHERE id = ?").run(date, src_id);
      } else if (src === "treasury_adjustments") {
        const adj = db.prepare("SELECT amount FROM treasury_adjustments WHERE id = ?").get(src_id);
        db.prepare("UPDATE treasury_adjustments SET date = ?, amount = ? WHERE id = ?").run(date, adj.amount < 0 ? -value : value, src_id);
      } else {
        db.prepare(`UPDATE ${src} SET date = ?, amount = ? WHERE id = ?`).run(date, value, src_id);
      }
      if (account && cfg.method) db.prepare(`UPDATE ${src} SET ${cfg.method} = ? WHERE id = ?`).run(account, src_id);
      // دفعة/سلفة عامل جاية من مرتبات العمال — المبلغ هناك يتظبط معاها.
      if (src === "hassan_treasury_expenses") {
        db.prepare("UPDATE hassan_worker_entries SET amount = ?, date = ? WHERE treasury_expense_id = ?").run(value, date, src_id);
        db.prepare("UPDATE hassan_installment_payments SET amount = ?, paid_date = ? WHERE treasury_expense_id = ?").run(value, date, src_id);
      }
    });
    tx();
    return { ok: true };
  });
  ipcMain.handle("treasury:movementDelete", (_e, { src, src_id }) => {
    if (!MOVEMENT_COLUMNS[src]) throw new Error("الحركة دي مينفعش تتمسح من هنا");
    const tx = db.transaction(() => {
      if (src === "hassan_treasury_expenses") db.prepare("DELETE FROM hassan_worker_entries WHERE treasury_expense_id = ?").run(src_id);
      if (src === "custody_entries" || src === "custodies") {
        const where = src === "custodies" ? "custody_id = ?" : "id = ?";
        const linked = [
          ["expense_id", "monthly_expenses"],
          ["supplier_payment_id", "supplier_payments"],
          ["car_fuel_id", "car_fuel"],
          ["advance_id", "employee_advances"],
          ["salary_payment_id", "salary_payments"],
        ];
        for (const [col, table] of linked) {
          for (const r of db.prepare(`SELECT ${col} AS v FROM custody_entries WHERE ${where} AND ${col} IS NOT NULL`).all(src_id)) {
            db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(r.v);
          }
        }
      }
      db.prepare(`DELETE FROM ${src} WHERE id = ?`).run(src_id);
    });
    tx();
    return { ok: true };
  });

  ipcMain.handle("treasury:accountTransactions", (_e, { account_name, month }) => {
    const acc = db.prepare("SELECT * FROM treasury_accounts WHERE name = ?").get(account_name);
    const from = acc?.opening_date ?? "";
    const movements = cashMovements(account_name);
    let running = movements
      .filter((m) => m.date >= from && m.date < `${month}-01`)
      .reduce((sum, m) => sum + (m.direction === "in" ? m.amount : -m.amount), acc?.opening_balance ?? 0);
    const openingForMonth = running;
    const rows = movements
      .filter((m) => m.date.startsWith(month))
      .map((m) => {
        const counted = m.date >= from;
        if (counted) running += m.direction === "in" ? m.amount : -m.amount;
        return { ...m, balance: counted ? running : null };
      });
    return { openingForMonth, rows, closing: running };
  });

  // جرد: بتكتب الفلوس اللي عدّيتها فعلًا في يوم معيّن، والفرق عن المحسوب
  // بيتسجل تسوية (لو فيه فرق) عشان الرصيد يبقى مطابق للحقيقة.
  ipcMain.handle("treasury:count", (_e, { account_name, date, counted, note }) => {
    const acc = db.prepare("SELECT * FROM treasury_accounts WHERE name = ?").get(account_name);
    const expected = accountBalance(acc, date);
    const difference = Number(counted) - expected;
    if (Math.abs(difference) >= 0.005) {
      db.prepare(
        "INSERT INTO treasury_adjustments (account, date, amount, expected, counted, note) VALUES (?, ?, ?, ?, ?, ?)"
      ).run(account_name, date, difference, expected, Number(counted), note?.trim() || null);
    }
    return { expected, counted: Number(counted), difference };
  });
  ipcMain.handle("treasury:previewCount", (_e, { account_name, date }) => {
    const acc = db.prepare("SELECT * FROM treasury_accounts WHERE name = ?").get(account_name);
    return { expected: accountBalance(acc, date || todayISO()) };
  });
  ipcMain.handle("treasury:deleteAdjustment", (_e, { id }) => {
    db.prepare("DELETE FROM treasury_adjustments WHERE id = ?").run(id);
    return { ok: true };
  });

  ipcMain.handle("treasury:createTransfer", (_e, { date, from_account, to_account, amount, note }) => {
    if (from_account === to_account) throw new Error("لازم حسابين مختلفين");
    db.prepare("INSERT INTO treasury_transfers (date, from_account, to_account, amount, note) VALUES (?, ?, ?, ?, ?)").run(
      date,
      from_account,
      to_account,
      Number(amount) || 0,
      note?.trim() || null
    );
    return { ok: true };
  });
  ipcMain.handle("treasury:deleteTransfer", (_e, { id }) => {
    db.prepare("DELETE FROM treasury_transfers WHERE id = ?").run(id);
    return { ok: true };
  });

  ipcMain.handle("otherIncome:create", (_e, { date, amount, method, description }) => {
    db.prepare("INSERT INTO other_income (date, amount, method, description) VALUES (?, ?, ?, ?)").run(
      date,
      Number(amount) || 0,
      method,
      description?.trim() || null
    );
    return { ok: true };
  });
  ipcMain.handle("otherIncome:delete", (_e, { id }) => {
    db.prepare("DELETE FROM other_income WHERE id = ?").run(id);
    return { ok: true };
  });
};
