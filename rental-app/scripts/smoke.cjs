// تجربة آلية للبرنامج بعد البناء: بيفتح النسخة (المبنية أو المتسطبة)، يمر على كل
// الصفحات في التأجير والتشغيل، يسجّل داتا ويتأكد إنها اتحفظت بعد إعادة الفتح،
// ويطلّع PDF ونسخة احتياطية. لو أي حاجة غلط بيخرج بكود ١.
//
//   node scripts/smoke.cjs                      ← نسخة التطوير (محتاجة npm run build)
//   node scripts/smoke.cjs "path/to/MK-Tech.exe" ← النسخة المبنية / المتسطبة
// محتاج playwright (npm i --no-save playwright) وشاشة (xvfb-run على لينكس).
const { _electron } = require("playwright");
const fs = require("fs");
const os = require("os");
const path = require("path");

const exe = process.argv[2];
const appDir = path.join(__dirname, "..");
const userData = fs.mkdtempSync(path.join(os.tmpdir(), "mk-smoke-"));
const fails = [];
const check = (ok, what) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${what}`);
  if (!ok) fails.push(what);
};

async function open(product) {
  const app = await _electron.launch({
    ...(exe ? { executablePath: exe, args: [] } : { executablePath: path.join(appDir, "node_modules/electron/dist/electron"), args: [appDir, "--no-sandbox"] }),
    env: { ...process.env, RENTAL_DEMO: "1", RENTAL_PRODUCT: product, RENTAL_TODAY: "2026-10-31", RENTAL_USER_DATA: path.join(userData, product) },
    timeout: 60000,
  });
  const win = await app.firstWindow({ timeout: 60000 });
  const errs = [];
  win.on("pageerror", (e) => errs.push(e.message));
  win.on("console", (m) => m.type() === "error" && errs.push(m.text()));
  await win.setViewportSize({ width: 1280, height: 900 });
  return { app, win, errs };
}

const NAV = "aside button, aside a, nav button, nav a";
async function visitAll(win) {
  const labels = (await win.locator(NAV).allInnerTexts()).map((l) => l.trim()).filter((l) => l && !/خروج|الوضع الليلي|قفل/.test(l));
  for (const l of labels) {
    await win.locator(NAV).filter({ hasText: l }).first().click({ timeout: 5000 });
    await win.waitForTimeout(500);
  }
  return labels;
}

(async () => {
  console.log("exe:", exe || "(dev electron)", "| platform:", process.platform);

  // ---- التأجير ----
  let s = await open("rental");
  await s.win.waitForSelector("text=رصيد الخزنة", { timeout: 60000 });
  check(true, "التأجير: البرنامج فتح وقاعدة البيانات اشتغلت");
  const call = (win, fn, args) => win.evaluate(([fn, args]) => window.api.invoke("core:call", { fn, args }), [fn, args]);
  console.log("version:", await s.win.evaluate(() => window.api.invoke("app:getVersion")), "| electron:", await s.app.evaluate(() => process.versions.electron));
  const created = await call(s.win, "createSupplier", { name: "تجربة آلية" });
  check(created.ok, "التأجير: تسجيل صاحب معدة جديد");
  const first = (await call(s.win, "suppliers", {})).value.list[0];
  const pay = await call(s.win, "supplierDeduction", { supplierId: first.id, date: "2026-10-20", amountPt: 12300, note: "تجربة", account: "cash", confirmNegative: true });
  check(pay.ok, "التأجير: تسجيل حركة فلوس (خصم من صاحب معدة)");
  const pages = await visitAll(s.win);
  check(pages.length >= 10, `التأجير: فتح ${pages.length} صفحة`);
  const pdf = await s.app.evaluate(async ({ BrowserWindow }) => (await BrowserWindow.getAllWindows()[0].webContents.printToPDF({ pageSize: "A4", printBackground: true })).length);
  check(pdf > 20000, `التأجير: طباعة PDF (${pdf} بايت)`);
  const backups = path.join(userData, "rental", "backups");
  check(fs.existsSync(backups) && fs.readdirSync(backups).length > 0, "التأجير: النسخة الاحتياطية اليومية اتعملت");
  check(s.errs.length === 0, `التأجير: من غير أخطاء في الشاشة${s.errs.length ? " — " + s.errs.join(" | ").slice(0, 400) : ""}`);
  await s.app.close();

  // إعادة فتح: الداتا اللي اتسجلت لسه موجودة على القرص
  s = await open("rental");
  await s.win.waitForSelector("text=رصيد الخزنة", { timeout: 60000 });
  const again = (await call(s.win, "suppliers", {})).value.list;
  check(again.some((x) => x.name === "تجربة آلية"), "التأجير: الداتا محفوظة بعد قفل البرنامج وفتحه");
  check(s.errs.length === 0, "التأجير (بعد إعادة الفتح): من غير أخطاء");
  await s.app.close();

  // ---- التشغيل ----
  s = await open("operations");
  await s.win.waitForSelector(NAV, { timeout: 60000 });
  await s.win.waitForTimeout(2500);
  const ops = await visitAll(s.win);
  check(ops.length >= 10, `التشغيل: فتح ${ops.length} صفحة`);
  const eq = await s.win.evaluate(() => window.api.invoke("equipment:list"));
  check(Array.isArray(eq), "التشغيل: قاعدة البيانات بترد");
  check(s.errs.length === 0, `التشغيل: من غير أخطاء في الشاشة${s.errs.length ? " — " + s.errs.join(" | ").slice(0, 400) : ""}`);
  await s.app.close();

  console.log(fails.length ? `\n${fails.length} FAILED` : "\nALL PASSED");
  process.exit(fails.length ? 1 : 0);
})().catch((e) => {
  console.error("SMOKE CRASHED:", e);
  process.exit(1);
});
