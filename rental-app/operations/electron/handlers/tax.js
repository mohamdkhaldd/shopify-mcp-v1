const { computeDayValue, taxRates } = require("../calc");

// الملف الضريبي (زي التأجير): المقاول الشركة عليه ١٤٪ قيمة مضافة على الفاتورة
// (بتتورّد للضرايب كل شهر)، وبيستقطع ٣٪ من الدفعة (بتتحسب لنا عند الضرايب).
// مقاول الباطن من غير ضرايب مبيتحسبش عليه حاجة.
module.exports = function register(db, ipcMain) {
  const months = (year) => Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, "0")}`);

  function monthTax(month) {
    const r = taxRates(db);
    const rows = db
      .prepare("SELECT * FROM contractors WHERE is_company = 1 ORDER BY name")
      .all()
      .map((c) => {
        const base = db
          .prepare("SELECT * FROM daily_logs WHERE role = 'contractor' AND person_name = ? AND date LIKE ?")
          .all(c.name, `${month}%`)
          .reduce((s, l) => s + computeDayValue(l), 0);
        const vat = c.vat_applies ? (base * r.vat) / 100 : 0;
        const wht = c.wht_applies ? (base * r.wht) / 100 : 0;
        return { id: c.id, name: c.name, base, vat, wht, invoice: base + vat, collect: base + vat - wht };
      })
      .filter((x) => x.base !== 0);
    const sum = (k) => rows.reduce((s, x) => s + x[k], 0);
    const paid = (kind) =>
      db.prepare("SELECT COALESCE(SUM(amount),0) AS t FROM tax_payments WHERE kind = ? AND COALESCE(for_month, substr(date,1,7)) = ?").get(kind, month).t;
    return { month, rows, base: sum("base"), vat: sum("vat"), wht: sum("wht"), invoice: sum("invoice"), vatPaid: paid("vat"), vatDue: sum("vat") - paid("vat") };
  }

  ipcMain.handle("tax:summary", (_e, { month }) => {
    const year = month.slice(0, 4);
    const all = months(year).map(monthTax);
    const sum = (k) => all.reduce((s, m) => s + m[k], 0);
    return {
      rates: taxRates(db),
      month: monthTax(month),
      year: { year, months: all, base: sum("base"), vat: sum("vat"), wht: sum("wht"), vatPaid: sum("vatPaid"), vatDue: sum("vatDue") },
      payments: db.prepare("SELECT * FROM tax_payments WHERE date LIKE ? ORDER BY date DESC, id DESC").all(`${year}%`),
      contractors: db.prepare("SELECT id, name, is_company, vat_applies, wht_applies FROM contractors ORDER BY name").all(),
    };
  });

  ipcMain.handle("tax:setRates", (_e, { vat, wht }) => {
    const set = (k, v) => db.prepare("INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(k, String(v));
    if (Number(vat) >= 0) set("ops_vat_rate", Number(vat));
    if (Number(wht) >= 0) set("ops_wht_rate", Number(wht));
    return { ok: true };
  });

  // المقاول شركة بضرايب ولا مقاول باطن، وبيتحسب عليه أنهي ضريبة
  ipcMain.handle("contractors:setTax", (_e, { id, is_company, vat_applies, wht_applies }) => {
    const company = is_company ? 1 : 0;
    db.prepare("UPDATE contractors SET is_company = ?, vat_applies = ?, wht_applies = ? WHERE id = ?").run(
      company,
      company && vat_applies ? 1 : 0,
      company && wht_applies ? 1 : 0,
      id
    );
    return { ok: true };
  });

  ipcMain.handle("taxPayments:create", (_e, { date, kind, for_month, amount, method, note }) => {
    if (!(Number(amount) > 0)) throw new Error("لازم مبلغ");
    db.prepare("INSERT INTO tax_payments (date, kind, for_month, amount, method, note) VALUES (?, ?, ?, ?, ?, ?)").run(
      date,
      kind === "wht" ? "wht" : "vat",
      for_month || null,
      Number(amount),
      method || "cash",
      note?.trim() || null
    );
    return { ok: true };
  });
  ipcMain.handle("taxPayments:delete", (_e, { id }) => {
    db.prepare("DELETE FROM tax_payments WHERE id = ?").run(id);
    return { ok: true };
  });
};
