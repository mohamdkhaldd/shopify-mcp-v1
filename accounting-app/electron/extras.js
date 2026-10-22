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

function registerExtraHandlers(db) {
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
    // المصروفات اللي اتسجلت على المعدات من العهدة دي بتتمسح معاها.
    const tx = db.transaction(() => {
      const ids = db.prepare("SELECT expense_id FROM custody_entries WHERE custody_id = ? AND expense_id IS NOT NULL").all(id);
      for (const r of ids) db.prepare("DELETE FROM monthly_expenses WHERE id = ?").run(r.expense_id);
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
        `SELECT ce.*, e.name AS equipment_name, ec.name AS category_name FROM custody_entries ce
         LEFT JOIN monthly_expenses me ON me.id = ce.expense_id
         LEFT JOIN equipment e ON e.id = me.equipment_id
         LEFT JOIN expense_categories ec ON ec.id = me.category_id
         WHERE ce.custody_id = ? ORDER BY ce.date, ce.id`
      )
      .all(id)
      .map((e) => {
        balance += e.type === "topup" ? e.amount : -e.amount;
        return { ...e, balance };
      });
    return { ...c, entries };
  });
  ipcMain.handle("custodyEntries:create", (_e, { custody_id, date, type, amount, description, method, equipment_id, category_id }) => {
    const custody = custodyBalances(db).find((c) => c.id === custody_id);
    if (!custody) throw new Error("العهدة مش موجودة");
    if (!["expense", "topup", "return"].includes(type)) throw new Error("نوع الحركة غلط");
    const value = Number(amount);
    if (!(value > 0)) throw new Error("لازم مبلغ");
    if (type !== "topup" && value > custody.remaining + 0.005) {
      throw new Error(`المبلغ أكبر من الباقي في العهدة (${Math.round(custody.remaining).toLocaleString("en-US")} ج.م)`);
    }
    const tx = db.transaction(() => {
      let expenseId = null;
      if (type === "expense" && equipment_id) {
        // مصروف على معدة: بيظهر في مصروفات المعدة وأرباحها، وطريقة دفعه
        // "عهدة" فمبيتخصمش من الخزنة تاني.
        expenseId = db
          .prepare(
            `INSERT INTO monthly_expenses (equipment_id, month, date, category_id, amount, payment_method, note, payee)
             VALUES (?, ?, ?, ?, ?, 'custody', ?, ?)`
          )
          .run(equipment_id, date.slice(0, 7), date, category_id || null, value, description?.trim() || null, `عهدة ${custody.holder}`).lastInsertRowid;
      }
      db.prepare(
        "INSERT INTO custody_entries (custody_id, date, type, amount, description, method, expense_id) VALUES (?, ?, ?, ?, ?, ?, ?)"
      ).run(custody_id, date, type, value, description?.trim() || null, type === "expense" ? null : method || custody.method, expenseId);
    });
    tx();
    return custodyBalances(db).find((c) => c.id === custody_id);
  });
  ipcMain.handle("custodyEntries:delete", (_e, { id }) => {
    const entry = db.prepare("SELECT * FROM custody_entries WHERE id = ?").get(id);
    const tx = db.transaction(() => {
      if (entry?.expense_id) db.prepare("DELETE FROM monthly_expenses WHERE id = ?").run(entry.expense_id);
      db.prepare("DELETE FROM custody_entries WHERE id = ?").run(id);
    });
    tx();
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
    db.prepare("SELECT * FROM obligations ORDER BY done_at IS NOT NULL, due_date, id").all()
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
      db.prepare("UPDATE obligations SET done_at = ? WHERE id = ?").run(today(), id);
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
      alerts.push({
        kind: "obligation",
        level: d < 0 ? "danger" : d === 0 ? "danger" : "warn",
        id: o.id,
        title: o.title,
        amount: o.amount,
        due_date: o.due_date,
        days: d,
      });
    }
    return alerts;
  });
}

module.exports = { registerExtraHandlers, custodyBalances, carPersonalAllMonths, CAR_CATEGORY };
