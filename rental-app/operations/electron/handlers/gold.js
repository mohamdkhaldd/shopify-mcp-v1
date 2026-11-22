// دهب صاحب الكوميشن (حساب شخصي — مالوش دعوة بالخزنة):
// - سلف: «استلفت» كذا جرام من فلان وسعر الجرام ساعتها كذا، ولما ترده بترد
//   كذا جرام بسعر النهارده. استلفت: المكسب = الجرامات × (سعر يوم السلفة − سعر
//   يوم الرد) — لو الدهب غلي خسرت الفرق. سلّفت: العكس.
// - تحويش: اشتريت جرامات بسعر، وبعت منها بسعر — المكسب = المباع × (سعر البيع
//   − متوسط سعر الشرا). كل عيار لوحده.
module.exports = function register(db, ipcMain) {
  const round = (n) => Math.round(n * 100) / 100;

  function summary() {
    const rows = db.prepare("SELECT * FROM hassan_gold ORDER BY date, id").all();
    const loans = rows
      .filter((r) => r.kind === "loan" && (r.direction === "borrow" || r.direction === "lend"))
      .map((l) => {
        const sign = l.direction === "borrow" ? 1 : -1;
        const repays = rows
          .filter((r) => r.ref_id === l.id)
          .map((r) => ({ ...r, gain: round(sign * r.grams * (l.price - r.price)) }));
        const returned = repays.reduce((s, r) => s + r.grams, 0);
        return {
          ...l,
          repays,
          returned: round(returned),
          remaining: round(l.grams - returned),
          gain: round(repays.reduce((s, r) => s + r.gain, 0)),
          value: round(l.grams * l.price),
        };
      });

    // التحويش: كل عيار لوحده بمتوسط سعر الشرا
    const karats = new Map();
    const savings = [];
    for (const r of rows.filter((x) => x.kind === "save")) {
      const k = r.karat || "21";
      const pool = karats.get(k) ?? { karat: k, grams: 0, cost: 0, gain: 0, bought: 0, sold: 0 };
      if (r.direction === "buy") {
        pool.grams += r.grams;
        pool.cost += r.grams * r.price;
        pool.bought += r.grams;
        savings.push({ ...r, gain: null, avg: null });
      } else {
        const avg = pool.grams > 0 ? pool.cost / pool.grams : 0;
        const g = round(r.grams * (r.price - avg));
        pool.cost -= Math.min(r.grams, pool.grams) * avg;
        pool.grams -= r.grams;
        pool.sold += r.grams;
        pool.gain += g;
        savings.push({ ...r, gain: g, avg: round(avg) });
      }
      karats.set(k, pool);
    }
    const holdings = [...karats.values()].map((p) => ({
      karat: p.karat,
      grams: round(p.grams),
      avg: p.grams > 0 ? round(p.cost / p.grams) : 0,
      cost: round(p.cost),
      bought: round(p.bought),
      sold: round(p.sold),
      gain: round(p.gain),
    }));
    return {
      loans,
      savings: savings.reverse(),
      holdings,
      loanGain: round(loans.reduce((s, l) => s + l.gain, 0)),
      saveGain: round(holdings.reduce((s, h) => s + h.gain, 0)),
    };
  }

  ipcMain.handle("gold:summary", () => summary());
  ipcMain.handle("gold:add", (_e, g) => {
    const grams = Number(g.grams);
    const price = Number(g.price);
    if (!(grams > 0)) throw new Error("اكتب الجرامات");
    if (!(price > 0)) throw new Error("اكتب سعر الجرام");
    if (!g.date) throw new Error("اكتب التاريخ");
    const kind = g.kind === "save" ? "save" : "loan";
    const dirs = kind === "save" ? ["buy", "sell"] : ["borrow", "lend", "repay"];
    if (!dirs.includes(g.direction)) throw new Error("مش فاهم");
    if (g.direction === "repay") {
      const loan = summary().loans.find((l) => l.id === g.ref_id);
      if (!loan) throw new Error("السلفة مش موجودة");
      if (grams > loan.remaining + 0.0001) throw new Error(`الباقي ${loan.remaining} جرام بس`);
    }
    if (g.direction === "sell") {
      const h = summary().holdings.find((x) => x.karat === (g.karat || "21"));
      if (!h || grams > h.grams + 0.0001) throw new Error(`عندك ${h ? h.grams : 0} جرام بس من عيار ${g.karat || "21"}`);
    }
    const info = db
      .prepare("INSERT INTO hassan_gold (kind, direction, ref_id, party, date, grams, price, karat, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .run(kind, g.direction, g.direction === "repay" ? g.ref_id : null, g.party?.trim() || null, g.date, grams, price, g.karat || null, g.note?.trim() || null);
    return { id: Number(info.lastInsertRowid) };
  });
  ipcMain.handle("gold:update", (_e, g) => {
    if (!(Number(g.grams) > 0) || !(Number(g.price) > 0)) throw new Error("الجرامات والسعر");
    db.prepare("UPDATE hassan_gold SET party = ?, date = ?, grams = ?, price = ?, karat = ?, note = ? WHERE id = ?").run(
      g.party?.trim() || null,
      g.date,
      Number(g.grams),
      Number(g.price),
      g.karat || null,
      g.note?.trim() || null,
      g.id
    );
    return { ok: true };
  });
  ipcMain.handle("gold:delete", (_e, { id }) => {
    db.prepare("DELETE FROM hassan_gold WHERE id = ? OR ref_id = ?").run(id, id);
    return { ok: true };
  });
};
