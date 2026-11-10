// New system version: seed the example, then dump every page's text + a screenshot.
const { chromium } = require("playwright");
const fs = require("fs");
const call = (p, fn, args = {}) => p.evaluate(async ([fn, args]) => { const r = await window.api.invoke("core:call", { fn, args }); if (!r.ok) throw new Error(fn + ": " + r.message); return r.value; }, [fn, args]);
(async () => {
  const b = await chromium.launch();
  const c = await b.newContext({ viewport: { width: 1280, height: 720 }, locale: "ar-EG" });
  await c.addInitScript(() => { if (!sessionStorage.getItem("i")) { localStorage.clear(); sessionStorage.setItem("i", "1"); } });
  const p = await c.newPage();
  p.on("pageerror", (e) => console.log("PE", e.message.slice(0, 150)));
  await p.goto("http://localhost:4173/"); await p.waitForTimeout(2500);
  const P = 100;
  const id = await call(p, "newContract", { name: "مان لفت التجمع", client: { kind: "company", name: "شركة البناء", vatApplies: true }, equipment: { name: "مان لفت ٣٦", supplier: { name: "الحاج محمد" } }, unit: "day", clientRatePt: 4500 * P, supplierRatePt: 3500 * P, startDate: "2026-10-01", siteName: "التجمع الخامس" });
  await call(p, "fillRange", { contractId: id, from: "2026-10-01", to: "2026-10-22" });
  await call(p, "clientPayment", { clientId: 1, date: "2026-11-03", amountPt: 60000 * P, forMonth: "2026-10" }).catch((e) => console.log(e.message));
  await call(p, "supplierDeduction", { supplierId: 1, date: "2026-10-20", amountPt: 4000 * P, note: "سولار", paidFromTreasury: true, confirmNegative: true }).catch((e) => console.log(e.message));
  await call(p, "supplierPayment", { supplierId: 1, date: "2026-11-05", amountPt: 50000 * P, forMonth: "2026-10", confirmNegative: true }).catch((e) => console.log(e.message));
  await p.waitForTimeout(2500); await p.reload(); await p.waitForTimeout(2500);
  const out = []; let n = 0;
  const grab = async (title) => {
    await p.waitForTimeout(900);
    const t = await p.locator("main").first().innerText().catch(async () => await p.locator("body").innerText());
    out.push(`\n\n######## ${title}\n` + t); fs.writeFileSync("pages2.txt", out.join(""));
    await p.screenshot({ path: `v2/${String(++n).padStart(2, "0")}.png`, fullPage: true });
  };
  const nav = (l) => p.locator("aside").getByText(l, { exact: true }).first();
  const tryClick = async (loc) => { try { if (await loc.first().isVisible()) { await loc.first().click({ timeout: 3000 }); return true; } } catch {} return false; };
  const tabsOf = async (page) => {
    const tabs = p.locator('main button[class*="border-b-["]');
    const k = await tabs.count();
    for (let i = 0; i < k; i++) {
      const t = tabs.nth(i); const nm = (await t.innerText()).trim().split("\n")[0];
      if (await tryClick(t)) await grab(`${page} › ${nm}`);
    }
  };
  const pages = ["الرئيسية", "السركي", "أصحاب المعدات", "السواقين", "الشركات ومقاولين الباطن", "الإدارة", "الهالك", "المستثمرين", "الخزنة", "الضرايب والإقرارات", "سجل التعديلات", "الإعدادات"];
  for (const pg of pages) {
    if (!(await tryClick(nav(pg)))) { console.log("no nav", pg); continue; }
    await grab(pg);
    const item = { "السركي": "مان لفت التجمع", "أصحاب المعدات": "الحاج محمد", "الشركات ومقاولين الباطن": "شركة البناء" }[pg];
    if (item && (await tryClick(p.locator("main").getByText(item)))) { await grab(`${pg} › ${item}`); await tabsOf(`${pg} › ${item}`); }
    else await tabsOf(pg);
  }
  fs.writeFileSync("pages2.txt", out.join(""));
  await b.close();
})();
