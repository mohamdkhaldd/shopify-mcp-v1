const { ipcMain } = require("electron");

// اسم نوع المصروف اللي بيتسجل بيه مشوار العربية الملاكي على معدة.
const CAR_CATEGORY = "عربية ملاكي";

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

// يوم الاستحقاق الجاي لالتزام شهري — نفس اليوم في الشهر اللي بعده (ولو الشهر
// أقصر، آخر يوم فيه).
function nextMonthSameDay(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const ny = m === 12 ? y + 1 : y;
  const nm = m === 12 ? 1 : m + 1;
  const last = new Date(ny, nm, 0).getDate();
  return `${ny}-${String(nm).padStart(2, "0")}-${String(Math.min(d, last)).padStart(2, "0")}`;
}

// نفس يوم أول ميعاد بعد n شهر (ولو الشهر أقصر، آخر يوم فيه).
function addMonths(dateStr, n) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const total = (m - 1) + n;
  const ny = y + Math.floor(total / 12);
  const nm = (total % 12) + 1;
  const last = new Date(ny, nm, 0).getDate();
  return `${ny}-${String(nm).padStart(2, "0")}-${String(Math.min(d, last)).padStart(2, "0")}`;
}

// قسط: اتدفع كام، الجاي رقم كام وميعاده إمتى، وفاضل كام.
function installmentState(db, inst) {
  const payments = db.prepare("SELECT * FROM hassan_installment_payments WHERE installment_id = ? ORDER BY number, id").all(inst.id);
  const paidCount = payments.length;
  const done = inst.count != null && paidCount >= inst.count;
  return {
    ...inst,
    payments,
    paidCount,
    paidTotal: payments.reduce((s, p) => s + p.amount, 0),
    remainingCount: inst.count != null ? Math.max(0, inst.count - paidCount) : null,
    remainingAmount: inst.count != null ? Math.max(0, inst.count - paidCount) * inst.amount : null,
    done,
    nextNumber: done ? null : paidCount + 1,
    nextDue: done ? null : addMonths(inst.start_date, paidCount),
  };
}

function daysBetween(a, b) {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);
}

// ---------- العهد ----------
function custodyBalances(db, { includeClosed = true } = {}) {
  const sumStmt = db.prepare("SELECT COALESCE(SUM(amount), 0) AS total FROM custody_entries WHERE custody_id = ? AND type = ?");
  return db
    .prepare(`SELECT * FROM custodies ${includeClosed ? "" : "WHERE closed = 0"} ORDER BY closed, date DESC, id DESC`)
    .all()
    .map((c) => {
      const spent = sumStmt.get(c.id, "expense").total;
      const topups = sumStmt.get(c.id, "topup").total;
      const returned = sumStmt.get(c.id, "return").total;
      const given = c.amount + topups;
      const remaining = given - spent - returned;
      return { ...c, closed: !!c.closed, given, topups, spent, returned, remaining, low: !c.closed && remaining <= c.warn_amount + 0.005 };
    });
}

// ---------- العربية الملاكي ----------
function carCategoryId(db, create = false) {
  const row = db.prepare("SELECT id FROM expense_categories WHERE name = ?").get(CAR_CATEGORY);
  if (row || !create) return row?.id ?? null;
  return db.prepare("INSERT INTO expense_categories (name) VALUES (?)").run(CAR_CATEGORY).lastInsertRowid;
}

// الخاص في شهر = بنزين/زيت الشهر − مشاوير الشغل (مصروفات "عربية ملاكي" على
// المعدات) في نفس الشهر — ده اللي بيتخصم من كوميشن حسن.
function carMonth(db, month) {
  const fuel = db.prepare("SELECT * FROM car_fuel WHERE date LIKE ? ORDER BY date, id").all(`${month}%`);
  const catId = carCategoryId(db);
  const trips = catId
    ? db
        .prepare(
          `SELECT me.*, e.name AS equipment_name FROM monthly_expenses me
           JOIN equipment e ON e.id = me.equipment_id
           WHERE me.category_id = ? AND me.month = ? ORDER BY COALESCE(me.date, me.month || '-01'), me.id`
        )
        .all(catId, month)
    : [];
  const fuelTotal = fuel.reduce((s, f) => s + f.amount, 0);
  const tripsTotal = trips.reduce((s, t) => s + t.amount, 0);
  const byEquipment = new Map();
  for (const t of trips) byEquipment.set(t.equipment_name, (byEquipment.get(t.equipment_name) ?? 0) + t.amount);
  return {
    month,
    fuel,
    trips,
    byEquipment: [...byEquipment.entries()].map(([equipment_name, amount]) => ({ equipment_name, amount })),
    fuelTotal,
    tripsTotal,
    personal: Math.max(0, fuelTotal - tripsTotal),
    over: Math.max(0, tripsTotal - fuelTotal),
  };
}

// كل الشهور اللي فيها بنزين أو مشاوير — للخصم من خزنة حسن على كل الوقت.
function carPersonalAllMonths(db) {
  const months = new Set(db.prepare("SELECT DISTINCT substr(date, 1, 7) AS m FROM car_fuel").all().map((r) => r.m));
  const catId = carCategoryId(db);
  if (catId) db.prepare("SELECT DISTINCT month AS m FROM monthly_expenses WHERE category_id = ?").all(catId).forEach((r) => months.add(r.m));
  return [...months].sort().map((m) => {
    const c = carMonth(db, m);
    return { month: m, personal: c.personal, fuelTotal: c.fuelTotal, tripsTotal: c.tripsTotal, lastDate: c.fuel.at(-1)?.date ?? `${m}-01` };
  });
}

// الالتزامات الثابتة (مرتبات / شركاء) من غير مبلغ مكتوب: البرنامج بيحسب
// "عليك كام" لوحده من شيت المرتبات ومن أرصدة الشركاء.
// المرتبات: ميعاد يوم ٢٠ أو بعده = مرتبات نفس الشهر، قبل ٢٠ = الشهر اللي فات.
function salaryMonthFor(dueDate) {
  const [y, m, d] = dueDate.split("-").map(Number);
  if (d >= 20) return dueDate.slice(0, 7);
  const prev = new Date(Date.UTC(y, m - 2, 1));
  return `${prev.getUTCFullYear()}-${String(prev.getUTCMonth() + 1).padStart(2, "0")}`;
}
const owedTotal = (rows) => rows.reduce((sum, r) => sum + Math.max(0, r.remaining), 0);
function owedFor(o, owed) {
  if (o.amount != null || o.done_at || !owed) return {};
  if (o.kind === "salaries") {
    const month = salaryMonthFor(o.due_date);
    return { auto_amount: owedTotal(owed.payrollSummary(month)), for_month: month };
  }
  if (o.kind === "partners") return { auto_amount: owedTotal(owed.partnersSummary()) };
  return {};
}

function registerExtraHandlers(db, owed) {
  // مشاوير العربية اللي اتسجلت قبل كده بطريقة دفع من الخزنة — بقت من فلوس
  // العربية (مبتتخصمش من الخزنة).
  const carCat = carCategoryId(db);
  if (carCat) db.prepare("UPDATE monthly_expenses SET payment_method = 'car' WHERE category_id = ? AND payment_method IS NOT 'car'").run(carCat);

  // ===== العهد =====
  ipcMain.handle("custodies:list", () => custodyBalances(db));
  ipcMain.handle("custodies:create", (_e, { holder, date, amount, method, warn_amount, note }) => {
    const name = (holder ?? "").trim();
    if (!name) throw new Error("لازم اسم الشخص اللي واخد العهدة");
    if (!(Number(amount) > 0)) throw new Error("لازم مبلغ العهدة");
    const warn = warn_amount === "" || warn_amount == null ? Math.round(Number(amount) * 0.2) : Number(warn_amount) || 0;
    const info = db
      .prepare("INSERT INTO custodies (holder, date, amount, method, warn_amount, note) VALUES (?, ?, ?, ?, ?, ?)")
      .run(name, date, Number(amount), method || "cash", warn, note?.trim() || null);
    return custodyBalances(db).find((c) => c.id === Number(info.lastInsertRowid));
  });
  ipcMain.handle("custodies:update", (_e, { id, holder, warn_amount, note }) => {
    db.prepare("UPDATE custodies SET holder = ?, warn_amount = ?, note = ? WHERE id = ?").run(
      (holder ?? "").trim(),
      Number(warn_amount) || 0,
      note?.trim() || null,
      id
    );
    return { ok: true };
  });
  ipcMain.handle("custodies:setClosed", (_e, { id, closed }) => {
    db.prepare("UPDATE custodies SET closed = ? WHERE id = ?").run(closed ? 1 : 0, id);
    return { ok: true };
  });
  ipcMain.handle("custodies:delete", (_e, { id }) => {
    // كل اللي اتسجل من العهدة دي (مصروفات معدات، دفعات موردين، بنزين، سلف
    // ومرتبات) بيتمسح معاها.
    const tx = db.transaction(() => {
      const linked = [
        ["expense_id", "monthly_expenses"],
        ["supplier_payment_id", "supplier_payments"],
        ["car_fuel_id", "car_fuel"],
        ["advance_id", "employee_advances"],
        ["salary_payment_id", "salary_payments"],
      ];
      for (const [col, table] of linked) {
        for (const r of db.prepare(`SELECT ${col} AS v FROM custody_entries WHERE custody_id = ? AND ${col} IS NOT NULL`).all(id)) {
          db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(r.v);
        }
      }
      db.prepare("DELETE FROM custodies WHERE id = ?").run(id);
    });
    tx();
    return { ok: true };
  });
  ipcMain.handle("custodies:statement", (_e, { id }) => {
    const c = custodyBalances(db).find((x) => x.id === id);
    if (!c) throw new Error("العهدة مش موجودة");
    let balance = c.amount;
    const entries = db
      .prepare(
        `SELECT ce.*, e.name AS equipment_name, ec.name AS category_name,
                s.name AS supplier_name, cf.kind AS car_kind,
                COALESCE(ea_emp.name, sp_emp.name) AS employee_name
         FROM custody_entries ce
         LEFT JOIN monthly_expenses me ON me.id = ce.expense_id
         LEFT JOIN equipment e ON e.id = me.equipment_id
         LEFT JOIN expense_categories ec ON ec.id = me.category_id
         LEFT JOIN supplier_payments spp ON spp.id = ce.supplier_payment_id
         LEFT JOIN suppliers s ON s.id = spp.supplier_id
         LEFT JOIN car_fuel cf ON cf.id = ce.car_fuel_id
         LEFT JOIN employee_advances ea ON ea.id = ce.advance_id
         LEFT JOIN employees ea_emp ON ea_emp.id = ea.employee_id
         LEFT JOIN salary_payments sal ON sal.id = ce.salary_payment_id
         LEFT JOIN employees sp_emp ON sp_emp.id = sal.employee_id
         WHERE ce.custody_id = ? ORDER BY ce.date, ce.id`
      )
      .all(id)
      .map((e) => {
        balance += e.type === "topup" ? e.amount : -e.amount;
        return { ...e, balance };
      });
    return { ...c, entries };
  });
  // الصرف من العهدة بيتسجل في مكانه حسب هو اتصرف على إيه — وطريقة الدفع
  // "عهدة" فمبيتخصمش من الخزنة تاني:
  //  equipment: مصروف على المعدة | supplier: دفعة للمورد (بتقلل اللي علينا له)
  //  car: بنزين/زيت للعربية الملاكي | advance: سلفة سواق | salary: دفعة مرتب سواق
  ipcMain.handle(
    "custodyEntries:create",
    (_e, { custody_id, date, type, amount, description, method, target, equipment_id, category_id, supplier_name, car_kind, employee_id, salary_month }) => {
      const custody = custodyBalances(db).find((c) => c.id === custody_id);
      if (!custody) throw new Error("العهدة مش موجودة");
      if (!["expense", "topup", "return"].includes(type)) throw new Error("نوع الحركة غلط");
      const value = Number(amount);
      if (!(value > 0)) throw new Error("لازم مبلغ");
      if (type !== "topup" && value > custody.remaining + 0.005) {
        throw new Error(`المبلغ أكبر من الباقي في العهدة (${Math.round(custody.remaining).toLocaleString("en-US")} ج.م)`);
      }
      // متوافق مع النسخة القديمة: لو مفيش target ومعاه معدة يبقى على معدة.
      const kind = type !== "expense" ? null : target || (equipment_id ? "equipment" : "general");
      const note = description?.trim() || null;
      const from = `عهدة ${custody.holder}`;
      const links = { expense_id: null, supplier_payment_id: null, car_fuel_id: null, advance_id: null, salary_payment_id: null };
      const tx = db.transaction(() => {
        if (kind === "equipment") {
          if (!equipment_id) throw new Error("اختار المعدة");
          links.expense_id = db
            .prepare(
              `INSERT INTO monthly_expenses (equipment_id, month, date, category_id, amount, payment_method, note, payee)
               VALUES (?, ?, ?, ?, ?, 'custody', ?, ?)`
            )
            .run(equipment_id, date.slice(0, 7), date, category_id || null, value, note, from).lastInsertRowid;
        } else if (kind === "supplier") {
          const name = (supplier_name ?? "").trim();
          if (!name) throw new Error("اختار المورد");
          let supplier = db.prepare("SELECT * FROM suppliers WHERE name = ?").get(name);
          if (!supplier) supplier = { id: db.prepare("INSERT INTO suppliers (name) VALUES (?)").run(name).lastInsertRowid };
          links.supplier_payment_id = db
            .prepare("INSERT INTO supplier_payments (supplier_id, date, amount, method, note) VALUES (?, ?, ?, 'custody', ?)")
            .run(supplier.id, date, value, note ? `${note} — ${from}` : from).lastInsertRowid;
        } else if (kind === "car") {
          carCategoryId(db, true);
          links.car_fuel_id = db
            .prepare("INSERT INTO car_fuel (date, kind, amount, note) VALUES (?, ?, ?, ?)")
            .run(date, (car_kind ?? "").trim() || "بنزين", value, note ? `${note} — ${from}` : from).lastInsertRowid;
        } else if (kind === "advance" || kind === "salary") {
          if (!employee_id) throw new Error("اختار السواق");
          const month = salary_month || date.slice(0, 7);
          const table = kind === "advance" ? "employee_advances" : "salary_payments";
          const id = db
            .prepare(`INSERT INTO ${table} (employee_id, month, date, amount, payment_method, note) VALUES (?, ?, ?, ?, 'custody', ?)`)
            .run(employee_id, month, date, value, note ? `${note} — ${from}` : from).lastInsertRowid;
          if (kind === "advance") links.advance_id = id;
          else links.salary_payment_id = id;
        }
        db.prepare(
          `INSERT INTO custody_entries (custody_id, date, type, amount, description, method, target, expense_id, supplier_payment_id, car_fuel_id, advance_id, salary_payment_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(
          custody_id,
          date,
          type,
          value,
          note,
          type === "expense" ? null : method || custody.method,
          kind,
          links.expense_id,
          links.supplier_payment_id,
          links.car_fuel_id,
          links.advance_id,
          links.salary_payment_id
        );
      });
      tx();
      return custodyBalances(db).find((c) => c.id === custody_id);
    }
  );
  ipcMain.handle("custodyEntries:delete", (_e, { id }) => {
    const entry = db.prepare("SELECT * FROM custody_entries WHERE id = ?").get(id);
    const tx = db.transaction(() => {
      // الحاجة اللي اتسجلت من الصرف ده (مصروف/دفعة مورد/بنزين/سلفة/مرتب) بتتمسح معاه.
      if (entry?.expense_id) db.prepare("DELETE FROM monthly_expenses WHERE id = ?").run(entry.expense_id);
      if (entry?.supplier_payment_id) db.prepare("DELETE FROM supplier_payments WHERE id = ?").run(entry.supplier_payment_id);
      if (entry?.car_fuel_id) db.prepare("DELETE FROM car_fuel WHERE id = ?").run(entry.car_fuel_id);
      if (entry?.advance_id) db.prepare("DELETE FROM employee_advances WHERE id = ?").run(entry.advance_id);
      if (entry?.salary_payment_id) db.prepare("DELETE FROM salary_payments WHERE id = ?").run(entry.salary_payment_id);
      db.prepare("DELETE FROM custody_entries WHERE id = ?").run(id);
    });
    tx();
    return { ok: true };
  });

  // ===== خزن لوحدها (المكنيكي، السكن...) =====
  // الداخل = كل مصروف من النوع ده على المعدات، والخارج = اللي اتصرف منها.
  ipcMain.handle("funds:list", (_e, { month }) => {
    const sum = (sql, ...args) => db.prepare(sql).get(...args).total;
    return db
      .prepare("SELECT id, name FROM expense_categories WHERE own_fund = 1 ORDER BY name")
      .all()
      .map((c) => {
        const allIn = sum("SELECT COALESCE(SUM(amount), 0) AS total FROM monthly_expenses WHERE category_id = ?", c.id);
        const monthIn = sum("SELECT COALESCE(SUM(amount), 0) AS total FROM monthly_expenses WHERE category_id = ? AND month = ?", c.id, month);
        const allOut = sum("SELECT COALESCE(SUM(amount), 0) AS total FROM fund_expenses WHERE category_id = ?", c.id);
        const monthOut = sum("SELECT COALESCE(SUM(amount), 0) AS total FROM fund_expenses WHERE category_id = ? AND date LIKE ?", c.id, `${month}%`);
        return { category_id: c.id, name: c.name, monthIn, monthOut, allIn, allOut, balance: allIn - allOut };
      });
  });
  ipcMain.handle("funds:detail", (_e, { category_id, month }) => ({
    incoming: db
      .prepare(
        `SELECT me.id, COALESCE(me.date, me.month || '-01') AS date, me.amount, me.note, e.name AS equipment_name
         FROM monthly_expenses me JOIN equipment e ON e.id = me.equipment_id
         WHERE me.category_id = ? AND me.month = ? ORDER BY 2, me.id`
      )
      .all(category_id, month),
    outgoing: db.prepare("SELECT * FROM fund_expenses WHERE category_id = ? AND date LIKE ? ORDER BY date, id").all(category_id, `${month}%`),
  }));
  ipcMain.handle("fundExpenses:create", (_e, { category_id, date, amount, description }) => {
    if (!(Number(amount) > 0)) throw new Error("لازم مبلغ");
    db.prepare("INSERT INTO fund_expenses (category_id, date, amount, description) VALUES (?, ?, ?, ?)").run(
      category_id,
      date,
      Number(amount),
      description?.trim() || null
    );
    return { ok: true };
  });
  ipcMain.handle("fundExpenses:delete", (_e, { id }) => {
    db.prepare("DELETE FROM fund_expenses WHERE id = ?").run(id);
    return { ok: true };
  });

  // ===== باسورد الأقساط =====
  // بيتخزن hash بس (من الشاشة) في إعدادات الشركة اللي بتتزامن على كل أجهزتها.
  const lockHash = () => db.prepare("SELECT value FROM app_settings WHERE key = 'installments_lock'").get()?.value || null;
  ipcMain.handle("installments:lockStatus", () => ({ locked: !!lockHash() }));
  ipcMain.handle("installments:checkLock", (_e, { hash }) => ({ ok: !!hash && hash === lockHash() }));
  ipcMain.handle("installments:setLock", (_e, { oldHash, hash }) => {
    const current = lockHash();
    if (current && oldHash !== current) throw new Error("الباسورد القديم غلط");
    if (hash) {
      db.prepare(
        "INSERT INTO app_settings (key, value) VALUES ('installments_lock', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
      ).run(hash);
    } else {
      db.prepare("DELETE FROM app_settings WHERE key = 'installments_lock'").run();
    }
    return { ok: true };
  });

  // ===== أقساط صاحب الكوميشن =====
  const installmentsAll = () => db.prepare("SELECT * FROM hassan_installments ORDER BY id").all().map((i) => installmentState(db, i));
  ipcMain.handle("installments:list", () =>
    installmentsAll().map((i) => ({ ...i, days: i.nextDue ? daysBetween(today(), i.nextDue) : null }))
  );
  ipcMain.handle("installments:create", (_e, { title, amount, count, start_date, note }) => {
    if (!(title ?? "").trim()) throw new Error("اكتب القسط ده إيه");
    if (!(Number(amount) > 0)) throw new Error("لازم قيمة القسط");
    if (!start_date) throw new Error("لازم ميعاد أول قسط");
    db.prepare("INSERT INTO hassan_installments (title, amount, count, start_date, note) VALUES (?, ?, ?, ?, ?)").run(
      title.trim(),
      Number(amount),
      Number(count) > 0 ? Math.round(Number(count)) : null,
      start_date,
      note?.trim() || null
    );
    return { ok: true };
  });
  ipcMain.handle("installments:update", (_e, { id, title, amount, count, start_date, note }) => {
    db.prepare("UPDATE hassan_installments SET title = ?, amount = ?, count = ?, start_date = ?, note = ? WHERE id = ?").run(
      (title ?? "").trim(),
      Number(amount) || 0,
      Number(count) > 0 ? Math.round(Number(count)) : null,
      start_date,
      note?.trim() || null,
      id
    );
    return { ok: true };
  });
  // مسح القسط: المدفوع منه بيفضل متسجل صرف من الكوميشن (فلوس طلعت فعلًا)،
  // إلا لو اخترت تمسحه معاه.
  ipcMain.handle("installments:delete", (_e, { id, withPayments }) => {
    const tx = db.transaction(() => {
      if (withPayments) {
        for (const p of db.prepare("SELECT treasury_expense_id FROM hassan_installment_payments WHERE installment_id = ? AND treasury_expense_id IS NOT NULL").all(id)) {
          db.prepare("DELETE FROM hassan_treasury_expenses WHERE id = ?").run(p.treasury_expense_id);
        }
      } else {
        db.prepare("UPDATE hassan_installment_payments SET treasury_expense_id = NULL WHERE installment_id = ?").run(id);
      }
      db.prepare("DELETE FROM hassan_installments WHERE id = ?").run(id);
    });
    tx();
    return { ok: true };
  });
  // "دفعت": القسط الجاي بيتسجل صرف من الكوميشن (طالع من الحساب ده في خزنة الشركة).
  ipcMain.handle("installments:pay", (_e, { id, date, method, amount }) => {
    const inst = installmentsAll().find((i) => i.id === id);
    if (!inst) throw new Error("القسط مش موجود");
    if (inst.done) throw new Error("الأقساط دي خلصت");
    const value = Number(amount) > 0 ? Number(amount) : inst.amount;
    const tx = db.transaction(() => {
      const description = `قسط ${inst.title} (${inst.nextNumber}${inst.count ? ` من ${inst.count}` : ""})`;
      const expenseId = db
        .prepare("INSERT INTO hassan_treasury_expenses (date, amount, description, category, method) VALUES (?, ?, ?, 'أقساط', ?)")
        .run(date || today(), value, description, method || "cash").lastInsertRowid;
      db.prepare(
        "INSERT INTO hassan_installment_payments (installment_id, number, due_date, paid_date, amount, treasury_expense_id) VALUES (?, ?, ?, ?, ?, ?)"
      ).run(id, inst.nextNumber, inst.nextDue, date || today(), value, expenseId);
    });
    tx();
    return installmentState(db, db.prepare("SELECT * FROM hassan_installments WHERE id = ?").get(id));
  });
  ipcMain.handle("installmentPayments:delete", (_e, { id }) => {
    const p = db.prepare("SELECT * FROM hassan_installment_payments WHERE id = ?").get(id);
    const tx = db.transaction(() => {
      if (p?.treasury_expense_id) db.prepare("DELETE FROM hassan_treasury_expenses WHERE id = ?").run(p.treasury_expense_id);
      db.prepare("DELETE FROM hassan_installment_payments WHERE id = ?").run(id);
    });
    tx();
    return { ok: true };
  });

  // ===== السركي الورقي (صور) =====
  ipcMain.handle("paperSheets:list", (_e, { equipment_id, month }) =>
    db.prepare("SELECT * FROM equipment_paper_sheets WHERE equipment_id = ? AND month = ? ORDER BY id").all(equipment_id, month)
  );
  ipcMain.handle("paperSheets:create", (_e, { equipment_id, month, image, note }) => {
    if (!image) throw new Error("مفيش صورة");
    db.prepare("INSERT INTO equipment_paper_sheets (equipment_id, month, image, note) VALUES (?, ?, ?, ?)").run(equipment_id, month, image, note?.trim() || null);
    return { ok: true };
  });
  ipcMain.handle("paperSheets:replace", (_e, { id, image }) => {
    db.prepare("UPDATE equipment_paper_sheets SET image = ? WHERE id = ?").run(image, id);
    return { ok: true };
  });
  ipcMain.handle("paperSheets:delete", (_e, { id }) => {
    db.prepare("DELETE FROM equipment_paper_sheets WHERE id = ?").run(id);
    return { ok: true };
  });

  // ===== العربية الملاكي =====
  ipcMain.handle("car:summary", (_e, { month }) => {
    const m = carMonth(db, month);
    const all = carPersonalAllMonths(db);
    return { ...m, categoryId: carCategoryId(db), yearPersonal: all.filter((x) => x.month.startsWith(month.slice(0, 4))).reduce((s, x) => s + x.personal, 0) };
  });
  ipcMain.handle("car:ensureCategory", () => ({ id: carCategoryId(db, true) }));
  ipcMain.handle("carFuel:create", (_e, { date, kind, amount, note }) => {
    if (!(Number(amount) > 0)) throw new Error("لازم مبلغ");
    carCategoryId(db, true);
    db.prepare("INSERT INTO car_fuel (date, kind, amount, note) VALUES (?, ?, ?, ?)").run(date, (kind ?? "").trim() || "بنزين", Number(amount), note?.trim() || null);
    return carMonth(db, date.slice(0, 7));
  });
  ipcMain.handle("carFuel:delete", (_e, { id }) => {
    db.prepare("DELETE FROM car_fuel WHERE id = ?").run(id);
    return { ok: true };
  });

  // ===== الالتزامات =====
  ipcMain.handle("obligations:list", () =>
    db
      .prepare("SELECT * FROM obligations ORDER BY done_at IS NOT NULL, due_date, id")
      .all()
      .map((o) => ({ ...o, ...owedFor(o, owed) }))
  );
  ipcMain.handle("obligations:create", (_e, { title, kind, amount, due_date, repeat_monthly, note }) => {
    if (!(title ?? "").trim()) throw new Error("لازم تكتب الالتزام ده إيه");
    if (!due_date) throw new Error("لازم ميعاد");
    db.prepare("INSERT INTO obligations (title, kind, amount, due_date, repeat_monthly, note) VALUES (?, ?, ?, ?, ?, ?)").run(
      title.trim(),
      kind || "other",
      amount === "" || amount == null ? null : Number(amount),
      due_date,
      repeat_monthly ? 1 : 0,
      note?.trim() || null
    );
    return { ok: true };
  });
  ipcMain.handle("obligations:delete", (_e, { id }) => {
    db.prepare("DELETE FROM obligations WHERE id = ?").run(id);
    return { ok: true };
  });
  // "اتعمل": بيتقفل، ولو شهري بيتعمل الميعاد الجاي لوحده.
  ipcMain.handle("obligations:done", (_e, { id }) => {
    const o = db.prepare("SELECT * FROM obligations WHERE id = ?").get(id);
    if (!o) throw new Error("مش موجود");
    const tx = db.transaction(() => {
      // a computed amount is kept as it was on the day it was paid
      const auto = owedFor(o, owed);
      db.prepare("UPDATE obligations SET done_at = ?, amount = COALESCE(amount, ?) WHERE id = ?").run(today(), auto.auto_amount ?? null, id);
      if (o.repeat_monthly) {
        db.prepare("INSERT INTO obligations (title, kind, amount, due_date, repeat_monthly, note) VALUES (?, ?, ?, ?, 1, ?)").run(
          o.title,
          o.kind,
          o.amount,
          nextMonthSameDay(o.due_date),
          o.note
        );
      }
    });
    tx();
    return { ok: true };
  });
  ipcMain.handle("obligations:reopen", (_e, { id }) => {
    db.prepare("UPDATE obligations SET done_at = NULL WHERE id = ?").run(id);
    return { ok: true };
  });

  // ===== حضور عمال حسن =====
  ipcMain.handle("hassanAttendance:list", (_e, { worker_id, month }) =>
    db.prepare("SELECT * FROM hassan_worker_attendance WHERE worker_id = ? AND date LIKE ? ORDER BY date").all(worker_id, `${month}%`)
  );
  ipcMain.handle("hassanAttendance:set", (_e, { worker_id, date, status }) => {
    if (!status) {
      db.prepare("DELETE FROM hassan_worker_attendance WHERE worker_id = ? AND date = ?").run(worker_id, date);
    } else {
      const existing = db.prepare("SELECT id FROM hassan_worker_attendance WHERE worker_id = ? AND date = ?").get(worker_id, date);
      if (existing) db.prepare("UPDATE hassan_worker_attendance SET status = ? WHERE id = ?").run(status, existing.id);
      else db.prepare("INSERT INTO hassan_worker_attendance (worker_id, date, status) VALUES (?, ?, ?)").run(worker_id, date, status);
    }
    return { ok: true };
  });

  // ===== تنبيهات الصفحة الرئيسية =====
  ipcMain.handle("alerts:dashboard", () => {
    const now = today();
    const alerts = [];
    for (const c of custodyBalances(db, { includeClosed: false })) {
      if (c.remaining <= 0.005) alerts.push({ kind: "custody", level: "danger", id: c.id, title: `عهدة ${c.holder} خلصت`, amount: c.remaining });
      else if (c.low) alerts.push({ kind: "custody", level: "warn", id: c.id, title: `عهدة ${c.holder} قربت تخلص — باقي فيها`, amount: c.remaining });
    }
    for (const o of db.prepare("SELECT * FROM obligations WHERE done_at IS NULL ORDER BY due_date").all()) {
      const d = daysBetween(now, o.due_date);
      if (d > 3) continue;
      const auto = owedFor(o, owed);
      alerts.push({
        kind: "obligation",
        level: d < 0 ? "danger" : d === 0 ? "danger" : "warn",
        id: o.id,
        title: o.title,
        amount: o.amount ?? auto.auto_amount ?? null,
        due_date: o.due_date,
        days: d,
      });
    }
    for (const i of installmentsAll()) {
      if (!i.nextDue) continue;
      const d = daysBetween(now, i.nextDue);
      if (d > 3) continue;
      // الأقساط مقفولة بباسورد: التنبيه بيقول إن فيه قسط وميعاده بس.
      const hidden = !!lockHash();
      alerts.push({
        kind: "installment",
        level: d <= 0 ? "danger" : "warn",
        id: i.id,
        title: hidden ? "قسط (الأقساط مقفولة بباسورد)" : `قسط ${i.title}${i.count ? ` (${i.nextNumber} من ${i.count})` : ""}`,
        amount: hidden ? null : i.amount,
        due_date: i.nextDue,
        days: d,
      });
    }
    return alerts;
  });
}

module.exports = { registerExtraHandlers, custodyBalances, carPersonalAllMonths, CAR_CATEGORY, salaryMonthFor };
