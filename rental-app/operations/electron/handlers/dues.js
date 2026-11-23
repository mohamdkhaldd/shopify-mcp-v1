const { contractorMonthBreakdown, contractorTaxFactor, computeDayValue, equipmentMonthNetProfit } = require("../calc");
const { installmentState, salaryMonthFor, nextMonthSameDay, addMonths } = require("../extras");

// الالتزامات والمستحقات: شيت شهري بالأيام. كل يوم تحته اللي عليك تدفعه أو
// تستلمه، وجنب كل واحد «ادفع» / «استلمت». المرتبات والشركاء والمقاولين
// والموردين والأقساط بيتحسبوا لوحدهم — انت بتحدد يوم الدفع بس.
const GROUPS = {
  installments: { label: "الأقساط", direction: "pay", day: null },
  drivers: { label: "مرتبات السواقين", direction: "pay", day: 1 },
  partners: { label: "الشركاء", direction: "pay", day: 5 },
  contractors: { label: "المقاولين (فلوس لينا)", direction: "receive", day: 10 },
  suppliers: { label: "الموردين", direction: "pay", day: 15 },
};

const pad = (n) => String(n).padStart(2, "0");
const lastDay = (month) => new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate();
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

module.exports = function register(db, ipcMain, shared) {
  const { payrollSummary } = shared;

  const dayFor = (group) => {
    const v = db.prepare("SELECT value FROM app_settings WHERE key = ?").get(`dues_day_${group}`)?.value;
    return Number(v) >= 1 && Number(v) <= 31 ? Number(v) : GROUPS[group].day;
  };
  const dateIn = (month, day) => `${month}-${pad(Math.min(day, lastDay(month)))}`;

  // يوزّع الدفعات على الشهور: اللي متحدد «عن شهر كذا» بيروح له الأول، والباقي
  // بيسدد الأقدم فالأقدم. كل شهر بيعرف اتدفعله كام ومن أنهي دفعة.
  function allocate(rows, payments) {
    const byKey = new Map(rows.map((r) => [r.key, Object.assign(r, { paid: 0, covered: [] })]));
    const take = (r, p, amount) => {
      const t = Math.min(amount, Math.max(0, r.amount - r.paid));
      if (t > 0.0001) {
        r.paid += t;
        r.covered.push({ date: p.date, amount: t, method: p.method ?? null, note: p.note ?? null, loss: !!p.loss });
      }
      return t;
    };
    const left = [];
    for (const p of payments) {
      let rest = p.amount;
      if (p.for_month && byKey.has(p.for_month)) rest -= take(byKey.get(p.for_month), p, rest);
      if (rest > 0.0001) left.push({ ...p, amount: rest });
    }
    left.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    for (const p of left) {
      let rest = p.amount;
      for (const r of rows) {
        if (rest <= 0.0001) break;
        rest -= take(r, p, rest);
      }
    }
    for (const r of rows) r.remaining = Math.max(0, r.amount - r.paid);
    return byKey;
  }
  const monthsOf = (rows) => rows.map((r) => r.key).filter((k) => k !== "opening");
  const sortKeys = (keys) => [...new Set(keys)].sort((a, b) => (a === "opening" ? -1 : b === "opening" ? 1 : a.localeCompare(b)));

  function partnerMonths(p) {
    const shares = db
      .prepare("SELECT eps.equipment_id, eps.percentage, e.name FROM equipment_partner_shares eps JOIN equipment e ON e.id = eps.equipment_id WHERE eps.partner_id = ?")
      .all(p.id);
    const keys = [];
    for (const sh of shares) {
      for (const r of db
        .prepare("SELECT DISTINCT substr(date,1,7) AS m FROM daily_logs WHERE equipment_id = ? UNION SELECT DISTINCT month FROM monthly_expenses WHERE equipment_id = ?")
        .all(sh.equipment_id, sh.equipment_id))
        if (r.m) keys.push(r.m);
    }
    const rows = sortKeys([...(p.opening_balance ? ["opening"] : []), ...keys]).map((k) => {
      if (k === "opening") return { key: k, amount: p.opening_balance, parts: [{ label: "رصيد قديم", amount: p.opening_balance }] };
      const parts = shares.map((sh) => {
        const profit = equipmentMonthNetProfit(db, sh.equipment_id, k);
        return { label: `${sh.name}: ${sh.percentage}% من صافي ${Math.round(profit).toLocaleString("en-US")}`, amount: (profit * sh.percentage) / 100 };
      });
      return { key: k, amount: parts.reduce((s, x) => s + x.amount, 0), parts };
    });
    // شهر خسران: نصيبه من الخسارة بيتخصم من اللي بعده
    const payments = db.prepare("SELECT * FROM partner_payments WHERE partner_id = ? ORDER BY date, id").all(p.id);
    for (const r of rows) if (r.amount < 0) payments.push({ date: `${r.key}-28`, amount: -r.amount, loss: true, note: `خسارة ${r.key}` });
    const pos = rows.map((r) => ({ ...r, amount: Math.max(0, r.amount), raw: r.amount }));
    return allocate(pos, payments);
  }

  function supplierMonths(sup) {
    const purchases = db.prepare("SELECT * FROM supplier_purchases WHERE supplier_id = ? ORDER BY date, id").all(sup.id);
    const keys = sortKeys(purchases.map((x) => x.date.slice(0, 7)));
    const rows = keys.map((k) => {
      const list = purchases.filter((x) => x.date.startsWith(k));
      return { key: k, amount: list.reduce((s, x) => s + x.amount, 0), list };
    });
    return allocate(rows, db.prepare("SELECT * FROM supplier_payments WHERE supplier_id = ? ORDER BY date, id").all(sup.id));
  }

  const money = (n) => Math.round(n * 100) / 100;
  const coveredRows = (covered, verb) => covered.map((c) => ({ date: c.date, label: c.loss ? c.note : `${verb}${c.note ? ` — ${c.note}` : ""}`, amount: -c.amount }));

  function board(month) {
    const items = [];
    const push = (x) => items.push({ paid: 0, breakdown: [], details: [], canPay: true, ...x, remaining: Math.max(0, money(x.remaining)) });
    const cur = today().slice(0, 7);

    // الأقساط: قسط الشهر ده بس (اتدفع أو لسه)
    for (const raw of db.prepare("SELECT * FROM hassan_installments ORDER BY id").all()) {
      const i = installmentState(db, raw);
      const [sy, sm] = i.start_date.split("-").map(Number);
      const [y, m] = month.split("-").map(Number);
      const k = (y - sy) * 12 + (m - sm) + 1;
      if (k < 1 || (i.count != null && k > i.count)) continue;
      const due = addMonths(i.start_date, k - 1);
      const pays = i.payments.filter((x) => x.number === k);
      const paid = pays.reduce((s, x) => s + x.amount, 0);
      push({
        group: "installments",
        ref: i.id,
        label: i.title,
        covers: `قسط رقم ${k}${i.count ? ` من ${i.count}` : ""}`,
        due,
        amount: i.amount,
        paid,
        remaining: pays.length ? 0 : i.amount,
        canPay: !pays.length && i.nextNumber === k,
        cantPayWhy: !pays.length && i.nextNumber != null && i.nextNumber < k ? `لسه قسط رقم ${i.nextNumber} متدفعش — ادفعه الأول من شهره` : null,
        breakdown: [{ label: `قسط رقم ${k}${i.count ? ` من ${i.count}` : ""}`, amount: i.amount }, ...(paid ? [{ label: "اتدفع", amount: -paid }] : [])],
        details: [
          { title: "القسط", rows: [{ label: `ميعاده ${due}`, amount: i.amount }, ...pays.map((x) => ({ date: x.paid_date, label: "اتدفع", amount: -x.amount }))] },
          { title: "القسط كله", rows: [{ label: `اتدفع ${i.paidCount}${i.count ? ` من ${i.count}` : ""} قسط`, amount: i.paidTotal }, ...(i.remainingAmount != null ? [{ label: "الباقي من الأقساط كلها", amount: i.remainingAmount }] : [])] },
        ],
      });
    }

    // المرتبات: مرتب الشهر اللي بيتدفع في اليوم ده (قبل يوم ٢٠ = الشهر اللي فات)
    {
      const due = dateIn(month, dayFor("drivers"));
      const forMonth = salaryMonthFor(due);
      const list = (t, col = "note") => (empId) => db.prepare(`SELECT date, amount, ${col} AS note FROM ${t} WHERE employee_id = ? AND month = ? ORDER BY date, id`).all(empId, forMonth);
      const adv = list("employee_advances"), bon = list("employee_bonuses"), ded = list("employee_deductions", "reason"), sal = list("salary_payments");
      const firstOf = db.prepare(
        `SELECT MIN(m) AS m FROM (
           SELECT MIN(substr(l.date,1,7)) AS m FROM daily_logs l JOIN employees e ON e.name = l.person_name WHERE l.role = 'driver' AND e.id = @id
           UNION ALL SELECT MIN(month) FROM employee_advances WHERE employee_id = @id
           UNION ALL SELECT MIN(month) FROM employee_bonuses WHERE employee_id = @id
           UNION ALL SELECT MIN(month) FROM salary_payments WHERE employee_id = @id)`
      );
      for (const r of payrollSummary(forMonth)) {
        const started = firstOf.get({ id: r.id }).m;
        if (!started || forMonth < started) continue;
        const net = r.net_pay ?? 0;
        if (net <= 0.005 && (r.paid_total ?? 0) <= 0.005) continue;
        const days = db
          .prepare("SELECT e.name, COUNT(*) AS n FROM daily_logs l JOIN equipment e ON e.id = l.equipment_id WHERE l.role = 'driver' AND l.person_name = ? AND l.date LIKE ? GROUP BY e.name")
          .all(r.name, `${forMonth}%`);
        const rowsOf = (xs, label, sign) => xs.map((x) => ({ date: x.date, label: `${label}${x.note ? ` — ${x.note}` : ""}`, amount: sign * x.amount }));
        push({
          group: "drivers",
          ref: r.id,
          forMonth,
          covers: `مرتب ${forMonth}`,
          label: r.name,
          due,
          amount: net,
          paid: r.paid_total ?? 0,
          remaining: r.remaining ?? 0,
          breakdown: [
            { label: "المرتب", amount: r.gross_pay ?? 0 },
            ...(r.bonuses_total ? [{ label: "مكافآت", amount: r.bonuses_total }] : []),
            ...(r.advances_total ? [{ label: "سلف (أخدها)", amount: -r.advances_total }] : []),
            ...(r.deductions_total ? [{ label: "خصم", amount: -r.deductions_total }] : []),
            ...(r.paid_total ? [{ label: "اتدفعله", amount: -r.paid_total }] : []),
          ],
          details: [
            { title: `المرتب — ${forMonth}`, rows: [...days.map((d) => ({ label: `${d.n} يوم على ${d.name}` })), { label: r.wage_type === "monthly" ? "المرتب الشهري" : `المرتب عن ${r.days_worked ?? 0} يوم`, amount: r.gross_pay ?? 0 }] },
            { title: "مكافآت", rows: rowsOf(bon(r.id), "مكافأة", 1) },
            { title: "سلف", rows: rowsOf(adv(r.id), "سلفة", -1) },
            { title: "خصومات", rows: rowsOf(ded(r.id), "خصم", -1) },
            { title: "اتدفعله من المرتب", rows: rowsOf(sal(r.id), "دفعة", -1) },
          ].filter((sec) => sec.rows.length),
        });
      }
    }

    // الشركاء: نصيب كل شريك من صافي شهر واحد بس
    {
      const due = dateIn(month, dayFor("partners"));
      const forMonth = salaryMonthFor(due);
      for (const p of db.prepare("SELECT * FROM partners ORDER BY name").all()) {
        const r = partnerMonths(p).get(forMonth);
        if (!r || (r.raw <= 0.005 && r.paid <= 0.005)) continue;
        push({
          group: "partners",
          ref: p.id,
          forMonth,
          covers: `نصيب ${forMonth}`,
          label: p.name,
          due,
          amount: r.amount,
          paid: r.paid,
          remaining: r.remaining,
          breakdown: [{ label: `نصيبه من ${forMonth}`, amount: r.amount }, ...(r.paid ? [{ label: "اتدفعله", amount: -r.paid }] : [])],
          details: [
            { title: `نصيبه من صافي ${forMonth}`, rows: r.parts },
            { title: "اتدفعله عن الشهر ده", rows: coveredRows(r.covered, "دفعة") },
          ].filter((sec) => sec.rows.length),
        });
      }
    }

    // المقاولين: شغل شهر واحد بس (اللي بيتحصّل في اليوم ده)
    {
      const due = dateIn(month, dayFor("contractors"));
      const forMonth = salaryMonthFor(due);
      for (const c of db.prepare("SELECT * FROM contractors ORDER BY name").all()) {
        const m = contractorMonthBreakdown(db, c).months.find((x) => x.month === forMonth);
        if (!m || (m.work ?? 0) <= 0.005) continue;
        const eq = db
          .prepare("SELECT e.name, l.* FROM daily_logs l JOIN equipment e ON e.id = l.equipment_id WHERE l.role = 'contractor' AND l.person_name = ? AND l.date LIKE ? ORDER BY e.name")
          .all(c.name, `${forMonth}%`);
        const factor = contractorTaxFactor(db, c);
        const byEq = new Map();
        for (const l of eq) {
          const g = byEq.get(l.name) ?? { days: 0, value: 0 };
          g.days += 1;
          g.value += computeDayValue(l) * factor;
          byEq.set(l.name, g);
        }
        push({
          group: "contractors",
          ref: c.id,
          forMonth,
          covers: `شغل ${forMonth}`,
          label: c.name,
          due,
          amount: m.work,
          paid: m.paid,
          remaining: m.remaining,
          breakdown: [{ label: `شغل ${forMonth}`, amount: m.work }, ...(m.paid ? [{ label: "اتستلم", amount: -m.paid }] : [])],
          details: [
            { title: `الشغل — ${forMonth}${factor !== 1 ? " (شامل الضرايب)" : ""}`, rows: [...byEq].map(([name, g]) => ({ label: `${name}: ${g.days} يوم`, amount: g.value })) },
            { title: "اتستلم عن الشهر ده", rows: (m.covered ?? []).map((x) => ({ date: x.date, label: "دفعة", amount: -x.amount })) },
          ].filter((sec) => sec.rows.length),
        });
      }
    }

    // الموردين: مشتريات شهر واحد بس
    {
      const due = dateIn(month, dayFor("suppliers"));
      const forMonth = salaryMonthFor(due);
      for (const sup of db.prepare("SELECT * FROM suppliers ORDER BY name").all()) {
        const r = supplierMonths(sup).get(forMonth);
        if (!r || r.amount <= 0.005) continue;
        push({
          group: "suppliers",
          ref: sup.id,
          forMonth,
          covers: `مشتريات ${forMonth}`,
          label: sup.name,
          due,
          amount: r.amount,
          paid: r.paid,
          remaining: r.remaining,
          breakdown: [{ label: `مشتريات ${forMonth}`, amount: r.amount }, ...(r.paid ? [{ label: "اتدفعله", amount: -r.paid }] : [])],
          details: [
            { title: `المشتريات — ${forMonth}`, rows: r.list.map((x) => ({ date: x.date, label: x.description || x.note || "مشتريات", amount: x.amount })) },
            { title: "اتدفعله عن الشهر ده", rows: coveredRows(r.covered, "دفعة") },
          ].filter((sec) => sec.rows.length),
        });
      }
    }

    // اللي انت كاتبه بإيدك — ميعاده في الشهر ده (اتدفع أو لسه)
    const paysStmt = db.prepare("SELECT * FROM obligation_payments WHERE obligation_id = ? ORDER BY date, id");
    for (const o of db.prepare("SELECT * FROM obligations WHERE substr(due_date,1,7) = ? ORDER BY due_date, id").all(month)) {
      const pays = paysStmt.all(o.id);
      const paid = pays.reduce((s, x) => s + x.amount, 0);
      const recv = o.direction === "receive";
      push({
        group: "manual",
        ref: o.id,
        label: o.title,
        party: o.party,
        direction: o.direction || "pay",
        due: o.due_date,
        amount: o.amount ?? 0,
        paid,
        remaining: o.done_at ? 0 : (o.amount ?? 0) - paid,
        note: o.note,
        breakdown: o.amount != null ? [{ label: "المبلغ", amount: o.amount }, ...(paid ? [{ label: recv ? "اتستلم" : "اتدفع", amount: -paid }] : [])] : [],
        details: [
          { title: o.party ? `${o.title} — ${o.party}` : o.title, rows: [{ label: `ميعاده ${o.due_date}${o.repeat_monthly ? " (كل شهر)" : ""}`, amount: o.amount ?? 0 }, ...(o.note ? [{ label: o.note }] : [])] },
          { title: recv ? "اتستلم" : "اتدفع", rows: pays.map((x) => ({ date: x.date, label: x.note || (recv ? "استلمنا" : "دفعنا"), amount: -x.amount })) },
        ].filter((sec) => sec.rows.length),
      });
    }

    for (const x of items) {
      x.direction = x.direction || GROUPS[x.group]?.direction || "pay";
      x.done = x.remaining <= 0.005;
      x.late = !x.done && x.due.slice(0, 7) < cur;
    }
    items.sort((a, b) => (a.due < b.due ? -1 : a.due > b.due ? 1 : 0));
    const days = [];
    for (const x of items) {
      let d = days.find((y) => y.date === x.due);
      if (!d) days.push((d = { date: x.due, items: [] }));
      d.items.push(x);
    }
    const sum = (xs, dir, f) => xs.filter((x) => x.direction === dir).reduce((s, x) => s + x[f], 0);
    for (const d of days) {
      const groups = [...new Set(d.items.map((x) => x.group))];
      d.title = groups.map((g) => (g === "manual" ? "التزامات" : GROUPS[g].label)).join(" + ");
      d.pay = sum(d.items, "pay", "remaining");
      d.receive = sum(d.items, "receive", "remaining");
    }
    return {
      month,
      days,
      settings: Object.fromEntries(Object.keys(GROUPS).filter((g) => GROUPS[g].day).map((g) => [g, dayFor(g)])),
      totals: {
        pay: sum(items, "pay", "remaining"),
        receive: sum(items, "receive", "remaining"),
        payAll: sum(items, "pay", "amount"),
        receiveAll: sum(items, "receive", "amount"),
        paid: sum(items, "pay", "paid"),
        received: sum(items, "receive", "paid"),
      },
    };
  }

  // شهور فاتت لسه فيها حاجة متدفعتش (آخر ١٢ شهر) — عشان متضيعش في الزحمة
  const shiftMonth = (month, n) => {
    const t = Number(month.slice(0, 4)) * 12 + Number(month.slice(5, 7)) - 1 + n;
    return `${Math.floor(t / 12)}-${pad((t % 12) + 1)}`;
  };
  function overdue(month) {
    const out = [];
    // من أول شهر فيه شغل متسجل في البرنامج بس
    const first = db
      .prepare("SELECT MIN(m) AS m FROM (SELECT MIN(substr(date,1,7)) AS m FROM daily_logs UNION ALL SELECT MIN(month) FROM salary_payments UNION ALL SELECT MIN(substr(due_date,1,7)) FROM obligations UNION ALL SELECT MIN(substr(start_date,1,7)) FROM hassan_installments UNION ALL SELECT MIN(substr(date,1,7)) FROM supplier_purchases)")
      .get().m;
    if (!first) return out;
    for (let i = 1; i <= 12; i++) {
      const m = shiftMonth(month, -i);
      if (m < first) break;
      const b = board(m);
      if (b.totals.pay > 0.005 || b.totals.receive > 0.005) out.push({ month: m, pay: b.totals.pay, receive: b.totals.receive });
    }
    return out;
  }

  ipcMain.handle("dues:board", (_e, { month }) => ({ ...board(month), overdue: overdue(month) }));
  ipcMain.handle("dues:setDay", (_e, { group, day }) => {
    if (!GROUPS[group]?.day) throw new Error("مينفعش");
    const d = Math.round(Number(day));
    if (!(d >= 1 && d <= 31)) throw new Error("اليوم من ١ لـ ٣١");
    db.prepare("INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(`dues_day_${group}`, String(d));
    return { ok: true };
  });

  // «ادفع» / «استلمت»: بيتسجل في المكان الصح (مرتب، دفعة شريك، دفعة مقاول،
  // دفعة مورد، قسط، أو دفعة على الالتزام) — والخزنة بتتحسب منه لوحدها.
  ipcMain.handle("dues:pay", (_e, { group, ref, forMonth, date, amount, method, note }) => {
    const value = Number(amount);
    if (!(value > 0)) throw new Error("لازم مبلغ");
    const d = date || today();
    const m = method || "cash";
    const n = note?.trim() || null;
    const tx = db.transaction(() => {
      if (group === "drivers") {
        return { src: "salary_payments", src_id: db.prepare("INSERT INTO salary_payments (employee_id, month, date, amount, payment_method, note) VALUES (?, ?, ?, ?, ?, ?)").run(ref, forMonth || d.slice(0, 7), d, value, m, n).lastInsertRowid };
      } else if (group === "partners") {
        return { src: "partner_payments", src_id: db.prepare("INSERT INTO partner_payments (partner_id, date, amount, method, note, for_month) VALUES (?, ?, ?, ?, ?, ?)").run(ref, d, value, m, n, forMonth || null).lastInsertRowid };
      } else if (group === "contractors") {
        return { src: "contractor_payments", src_id: db.prepare("INSERT INTO contractor_payments (contractor_id, date, amount, method, note, for_month) VALUES (?, ?, ?, ?, ?, ?)").run(ref, d, value, m, n, forMonth || null).lastInsertRowid };
      } else if (group === "suppliers") {
        return { src: "supplier_payments", src_id: db.prepare("INSERT INTO supplier_payments (supplier_id, date, amount, method, note, for_month) VALUES (?, ?, ?, ?, ?, ?)").run(ref, d, value, m, n, forMonth || null).lastInsertRowid };
      } else if (group === "installments") {
        const raw = db.prepare("SELECT * FROM hassan_installments WHERE id = ?").get(ref);
        const i = raw && installmentState(db, raw);
        if (!i || i.done) throw new Error("القسط ده خلص");
        const expenseId = db
          .prepare("INSERT INTO hassan_treasury_expenses (date, amount, description, category, method) VALUES (?, ?, ?, 'أقساط', ?)")
          .run(d, value, `قسط ${i.title} (${i.nextNumber}${i.count ? ` من ${i.count}` : ""})`, m).lastInsertRowid;
        db.prepare(
          "INSERT INTO hassan_installment_payments (installment_id, number, due_date, paid_date, amount, treasury_expense_id) VALUES (?, ?, ?, ?, ?, ?)"
        ).run(ref, i.nextNumber, i.nextDue, d, value, expenseId);
        return { src: "hassan_treasury_expenses", src_id: expenseId };
      } else if (group === "manual") {
        const o = db.prepare("SELECT * FROM obligations WHERE id = ?").get(ref);
        if (!o) throw new Error("مش موجود");
        const payId = db.prepare("INSERT INTO obligation_payments (obligation_id, date, amount, method, note) VALUES (?, ?, ?, ?, ?)").run(ref, d, value, m, n).lastInsertRowid;
        let spawned = null;
        const paid = db.prepare("SELECT COALESCE(SUM(amount),0) AS t FROM obligation_payments WHERE obligation_id = ?").get(ref).t;
        // اتدفع كامل: بيتقفل، ولو شهري بيتعمل الشهر الجاي لوحده
        if (o.amount == null || paid >= o.amount - 0.005) {
          db.prepare("UPDATE obligations SET done_at = ? WHERE id = ?").run(d, ref);
          if (o.repeat_monthly) {
            spawned = db.prepare("INSERT INTO obligations (title, kind, amount, due_date, repeat_monthly, note, direction, party) VALUES (?, ?, ?, ?, 1, ?, ?, ?)").run(
              o.title,
              o.kind,
              o.amount,
              nextMonthSameDay(o.due_date),
              o.note,
              o.direction || "pay",
              o.party
            ).lastInsertRowid;
          }
        }
        return { src: "obligation_payments", src_id: payId, obligation_id: ref, spawned };
      } else throw new Error("مش فاهم الدفعة دي");
    });
    return { ok: true, ...tx() };
  });

  // تراجع عن «ادفع/استلمت»: الدفعة بتتمسح، والالتزام بيرجع مفتوح
  const UNDO_TABLES = ["salary_payments", "partner_payments", "contractor_payments", "supplier_payments", "hassan_treasury_expenses", "obligation_payments"];
  ipcMain.handle("dues:undo", (_e, { src, src_id, obligation_id, spawned }) => {
    if (!UNDO_TABLES.includes(src)) throw new Error("مينفعش");
    const tx = db.transaction(() => {
      if (src === "hassan_treasury_expenses") db.prepare("DELETE FROM hassan_installment_payments WHERE treasury_expense_id = ?").run(src_id);
      db.prepare(`DELETE FROM ${src} WHERE id = ?`).run(src_id);
      if (obligation_id) db.prepare("UPDATE obligations SET done_at = NULL WHERE id = ?").run(obligation_id);
      if (spawned && !db.prepare("SELECT 1 FROM obligation_payments WHERE obligation_id = ?").get(spawned)) db.prepare("DELETE FROM obligations WHERE id = ?").run(spawned);
    });
    tx();
    return { ok: true };
  });

  ipcMain.handle("dues:addManual", (_e, { title, party, amount, due_date, direction, repeat_monthly, note }) => {
    if (!(title ?? "").trim()) throw new Error("اكتب ده إيه");
    if (!due_date) throw new Error("لازم ميعاد");
    if (!(Number(amount) > 0)) throw new Error("لازم المبلغ");
    db.prepare("INSERT INTO obligations (title, kind, amount, due_date, repeat_monthly, note, direction, party) VALUES (?, 'other', ?, ?, ?, ?, ?, ?)").run(
      title.trim(),
      Number(amount),
      due_date,
      repeat_monthly ? 1 : 0,
      note?.trim() || null,
      direction === "receive" ? "receive" : "pay",
      party?.trim() || null
    );
    return { ok: true };
  });
};
