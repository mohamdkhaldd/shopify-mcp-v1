const { contractorMonthBreakdown } = require("../calc");
const { installmentState, salaryMonthFor, nextMonthSameDay } = require("../extras");

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
  const { payrollSummary, partnersSummary } = shared;

  const dayFor = (group) => {
    const v = db.prepare("SELECT value FROM app_settings WHERE key = ?").get(`dues_day_${group}`)?.value;
    return Number(v) >= 1 && Number(v) <= 31 ? Number(v) : GROUPS[group].day;
  };
  const dateIn = (month, day) => `${month}-${pad(Math.min(day, lastDay(month)))}`;

  function board(month) {
    const items = [];
    const push = (x) => items.push({ paid: 0, breakdown: [], ...x, remaining: Math.max(0, x.remaining) });

    // الأقساط: القسط الجاي لو ميعاده في الشهر ده (أو متأخر)
    for (const raw of db.prepare("SELECT * FROM hassan_installments ORDER BY id").all()) {
      const i = installmentState(db, raw);
      if (i.done || !i.nextDue || i.nextDue.slice(0, 7) > month) continue;
      push({
        group: "installments",
        ref: i.id,
        label: i.title,
        due: i.nextDue.slice(0, 7) < month ? dateIn(month, 1) : i.nextDue,
        late: i.nextDue.slice(0, 7) < month,
        amount: i.amount,
        remaining: i.amount,
        breakdown: [{ label: `قسط رقم ${i.nextNumber}${i.count ? ` من ${i.count}` : ""}`, amount: i.amount }, ...(i.remainingAmount != null ? [{ label: "الباقي من الأقساط كلها", amount: i.remainingAmount }] : [])],
      });
    }

    // المرتبات: اليوم اللي بتختاره؛ قبل يوم ٢٠ = مرتبات الشهر اللي فات
    {
      const due = dateIn(month, dayFor("drivers"));
      const forMonth = salaryMonthFor(due);
      for (const r of payrollSummary(forMonth)) {
        const net = r.net_pay ?? 0;
        if (net <= 0.005 && (r.paid_total ?? 0) <= 0.005) continue;
        push({
          group: "drivers",
          ref: r.id,
          forMonth,
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
        });
      }
    }

    // الشركاء: اللي ليهم لحد دلوقتي
    {
      const due = dateIn(month, dayFor("partners"));
      for (const p of partnersSummary()) {
        if (p.remaining <= 0.005) continue;
        push({
          group: "partners",
          ref: p.id,
          label: p.name,
          due,
          amount: p.totalDue,
          paid: p.totalPaid,
          remaining: p.remaining,
          breakdown: [
            { label: "نصيبه (من الأول)", amount: p.totalDue },
            { label: "اتدفعله", amount: -p.totalPaid },
          ],
        });
      }
    }

    // المقاولين: اللي عليهم لحد آخر الشهر ده (بالشهور)
    {
      const due = dateIn(month, dayFor("contractors"));
      for (const c of db.prepare("SELECT * FROM contractors ORDER BY name").all()) {
        const months = contractorMonthBreakdown(db, c).months.filter((m) => m.month <= month && (m.remaining ?? 0) > 0.005);
        const remaining = months.reduce((s, m) => s + m.remaining, 0);
        if (remaining <= 0.005) continue;
        push({
          group: "contractors",
          ref: c.id,
          label: c.name,
          due,
          amount: remaining,
          remaining,
          breakdown: months.map((m) => ({ label: `شغل ${m.month} (الباقي)`, amount: m.remaining })),
        });
      }
    }

    // الموردين: مشتريات لسه متدفعتش
    {
      const due = dateIn(month, dayFor("suppliers"));
      for (const s of db
        .prepare(
          `SELECT s.id, s.name,
             (SELECT COALESCE(SUM(amount),0) FROM supplier_purchases WHERE supplier_id = s.id) AS bought,
             (SELECT COALESCE(SUM(amount),0) FROM supplier_payments WHERE supplier_id = s.id) AS paid
           FROM suppliers s ORDER BY s.name`
        )
        .all()) {
        if (s.bought - s.paid <= 0.005) continue;
        push({
          group: "suppliers",
          ref: s.id,
          label: s.name,
          due,
          amount: s.bought,
          paid: s.paid,
          remaining: s.bought - s.paid,
          breakdown: [
            { label: "المشتريات", amount: s.bought },
            { label: "اتدفعله", amount: -s.paid },
          ],
        });
      }
    }

    // اللي انت كاتبه بإيدك (إيجار، أي حاجة تدفعها أو تستلمها)
    const paidStmt = db.prepare("SELECT COALESCE(SUM(amount),0) AS t FROM obligation_payments WHERE obligation_id = ?");
    for (const o of db.prepare("SELECT * FROM obligations WHERE done_at IS NULL AND substr(due_date,1,7) <= ? ORDER BY due_date, id").all(month)) {
      const paid = paidStmt.get(o.id).t;
      const late = o.due_date.slice(0, 7) < month;
      push({
        group: "manual",
        ref: o.id,
        label: o.title,
        party: o.party,
        direction: o.direction || "pay",
        due: late ? dateIn(month, 1) : o.due_date,
        late,
        amount: o.amount ?? 0,
        paid,
        remaining: (o.amount ?? 0) - paid,
        note: o.note,
        breakdown: o.amount != null ? [{ label: "المبلغ", amount: o.amount }, ...(paid ? [{ label: o.direction === "receive" ? "اتستلم" : "اتدفع", amount: -paid }] : [])] : [],
      });
    }

    for (const x of items) x.direction = x.direction || GROUPS[x.group]?.direction || "pay";
    items.sort((a, b) => (a.due < b.due ? -1 : a.due > b.due ? 1 : 0));
    // كل يوم: عنوانه = اسم المجموعة لو كله مجموعة واحدة (يوم ١ = الأقساط)
    const days = [];
    for (const x of items) {
      let d = days.find((y) => y.date === x.due);
      if (!d) days.push((d = { date: x.due, items: [] }));
      d.items.push(x);
    }
    for (const d of days) {
      const groups = [...new Set(d.items.map((x) => x.group))];
      d.title = groups.map((g) => (g === "manual" ? "التزامات" : GROUPS[g].label)).join(" + ");
      d.pay = d.items.filter((x) => x.direction === "pay").reduce((s, x) => s + x.remaining, 0);
      d.receive = d.items.filter((x) => x.direction === "receive").reduce((s, x) => s + x.remaining, 0);
    }
    return {
      month,
      days,
      settings: Object.fromEntries(Object.keys(GROUPS).filter((g) => GROUPS[g].day).map((g) => [g, dayFor(g)])),
      totals: {
        pay: items.filter((x) => x.direction === "pay").reduce((s, x) => s + x.remaining, 0),
        receive: items.filter((x) => x.direction === "receive").reduce((s, x) => s + x.remaining, 0),
      },
    };
  }

  ipcMain.handle("dues:board", (_e, { month }) => board(month));
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
        return { src: "partner_payments", src_id: db.prepare("INSERT INTO partner_payments (partner_id, date, amount, method, note) VALUES (?, ?, ?, ?, ?)").run(ref, d, value, m, n).lastInsertRowid };
      } else if (group === "contractors") {
        return { src: "contractor_payments", src_id: db.prepare("INSERT INTO contractor_payments (contractor_id, date, amount, method, note) VALUES (?, ?, ?, ?, ?)").run(ref, d, value, m, n).lastInsertRowid };
      } else if (group === "suppliers") {
        return { src: "supplier_payments", src_id: db.prepare("INSERT INTO supplier_payments (supplier_id, date, amount, method, note) VALUES (?, ?, ?, ?, ?)").run(ref, d, value, m, n).lastInsertRowid };
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
