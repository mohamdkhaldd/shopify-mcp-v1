// Seeds the example quickly and dumps every page/tab's visible text (for writing the script).
const { chromium } = require("playwright");
const fs = require("fs");
const call = (p, fn, args = {}) => p.evaluate(async ([fn, args]) => { const r = await window.api.invoke("core:call", { fn, args }); if (!r.ok) throw new Error(fn + ": " + r.message); return r.value; }, [fn, args]);
(async () => {
  const b = await chromium.launch();
  const c = await b.newContext({ viewport: { width: 1600, height: 900 }, locale: "ar-EG" });
  await c.addInitScript(() => { if (!sessionStorage.getItem("i")) { localStorage.clear(); sessionStorage.setItem("i", "1"); } });
  const p = await c.newPage();
  await p.goto("http://localhost:4173/"); await p.waitForTimeout(2000);
  
  const P = 100;
  const id = await call(p, "newContract", { client: { kind: "company", name: "شركة البناء", vatApplies: true, tax5Applies: true }, equipment: { name: "مان لفت ٣٦", supplier: { name: "الحاج محمد" } }, unit: "day", clientRatePt: 4500 * P, supplierRatePt: 3500 * P, startDate: "2026-10-01", siteName: "التجمع الخامس" });
  await call(p, "fillRange", { contractId: id, from: "2026-10-01", to: "2026-10-22" });
  await call(p, "clientPayment", { clientId: 1, date: "2026-11-03", amountPt: 60000 * P, forMonth: "2026-10" });
  await call(p, "supplierDeduction", { supplierId: 1, date: "2026-10-20", amountPt: 4000 * P, note: "سولار", paidFromTreasury: true, confirmNegative: true });
  await call(p, "supplierPayment", { supplierId: 1, date: "2026-11-05", amountPt: 50000 * P, forMonth: "2026-10", confirmNegative: true });
  await p.reload(); await p.waitForTimeout(2000); 
  const out = [];
  const grab = async (title) => { await p.waitForTimeout(900); const t = await p.locator("main").first().innerText().catch(async () => await p.locator("body").innerText()); out.push(`\n\n######## ${title}\n` + t); };
  const nav = (l) => p.locator("aside").getByText(l, { exact: true }).first();
  const tabs = async (page, names) => { for (const n of names) { const t = p.locator("main button", { hasText: n }).first(); if (await t.isVisible().catch(() => false)) { await t.click(); await grab(`${page} › ${n}`); } } };
  for (const pg of ["الرئيسية", "السركي", "أصحاب المعدات", "الشركات والأفراد", "الإدارة", "المستثمرين", "الخزنة", "الملف الضريبي", "سجل التعديلات", "الإعدادات"]) {
    await nav(pg).click(); await grab(pg);
    if (pg === "الرئيسية") { const s = p.locator("select").first(); await s.selectOption("2026-10").catch(() => {}); await grab("الرئيسية (أكتوبر)"); }
    if (pg === "السركي") { await p.getByLabel("الشهر").selectOption("2026-10").catch(() => {}); await grab("السركي (أكتوبر)"); await tabs(pg, ["سركي صاحب المعدة"]); await p.getByText("+ عقد جديد").first().click(); await grab("عقد جديد (فورم)"); await p.keyboard.press("Escape"); await p.getByText("إلغاء", { exact: true }).last().click().catch(() => {}); }
    if (pg === "أصحاب المعدات") await tabs(pg, ["معداته", "سركي صاحب المعدة", "الخصومات", "الدفعات", "كشف الحساب"]);
    if (pg === "الشركات والأفراد") await tabs(pg, ["الفواتير", "سركي الشركة", "الدفعات", "كشف الحساب"]);
    if (pg === "الملف الضريبي") await tabs(pg, ["١٤٪ لكل معدة", "١٤٪ لكل شهر", "٥٪ لكل عقد"]);
  }
  fs.writeFileSync(__dirname + "/pages.txt", out.join(""));
  await b.close();
})();
