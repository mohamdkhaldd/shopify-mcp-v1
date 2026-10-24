import path from "node:path";
import fs from "node:fs";
import { app, BrowserWindow, dialog, ipcMain } from "electron";
import Database from "better-sqlite3";
import { dbPath, openDatabase } from "./db";
import { backupTo, dailyBackup, lastBackup, looksLikeRentalDb } from "./backup";
import { printPreview, savePdf } from "./print";
import { setupAutoUpdate } from "./updater";
import { callCore, makeRegistry } from "./ipc";
import { exportExcel, ExcelSheet } from "./excel";
import { seedDemo } from "../core/demo";
import { startDeviceSync } from "./sync";
import { deviceIdentity } from "./device";
import { createLicenseManager, LicenseManager, LicenseStatus, Product } from "../core/license/manager";
import { licenseServer } from "../core/license/config";
import { OperationsBackend, startOperations } from "./operations";
import { createLock } from "../core/shell/lock";

const isDev = !app.isPackaged;
const root = path.join(__dirname, "..");
const iconPath = path.join(root, isDev ? "public" : "dist", "mk-icon.png");

// MK-Tech: one program, two products — التأجير (rental) and التشغيل
// (operations). The activation code decides which ones open. Each run opens
// one of them (switching restarts the app with --product=…), so each keeps
// its own screens, database and sync, unchanged.

// The data folder keeps the name it was first created with: the product was
// called "البنيان - التأجير", then "MK-Tech التأجير", now MK-Tech; copies
// installed under an earlier name keep their data where it is.
const legacyData = ["البنيان - التأجير", "MK-Tech التأجير"].map((n) => path.join(app.getPath("appData"), n)).find((d) => fs.existsSync(d));
if (legacyData) app.setPath("userData", legacyData);

// Screenshot / demo mode (never in a real install): RENTAL_DEMO=1 fills an empty
// database with the mockup example, RENTAL_TODAY pins "today",
// RENTAL_PRODUCT=operations opens التشغيل.
if (process.env.RENTAL_TODAY) (globalThis as { __RENTAL_TODAY__?: string }).__RENTAL_TODAY__ = process.env.RENTAL_TODAY;
if (process.env.RENTAL_USER_DATA) app.setPath("userData", process.env.RENTAL_USER_DATA);

type Page = Product | "launcher";
const TITLES: Record<Page, string> = { rental: "MK-Tech التأجير", operations: "MK-Tech التشغيل", launcher: "MK-Tech" };
const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const productArg = arg("product") as Product | undefined;
/** without --product / --pass: the chooser (and the password page, if one is set) */
const shellArgs = () => process.argv.slice(1).filter((a) => !a.startsWith("--product=") && !a.startsWith("--pass="));

let mainWindow: BrowserWindow | null = null;

/** page: the rental screens, the operations screens, or the activation / chooser page */
function createWindow(page: Page) {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    autoHideMenuBar: true,
    icon: iconPath,
    title: TITLES[page],
    webPreferences: { contextIsolation: true, nodeIntegration: false, preload: path.join(__dirname, "preload.cjs") },
  });
  mainWindow = win;
  win.on("closed", () => {
    if (mainWindow === win) mainWindow = null;
  });
  loadPage(win, page);
}

function loadPage(win: BrowserWindow, page: Page) {
  if (page === "operations") return win.loadFile(path.join(root, "dist", "operations", "index.html"));
  const launcher = page === "launcher";
  if (process.env.VITE_DEV_SERVER_URL) return win.loadURL(process.env.VITE_DEV_SERVER_URL + (launcher ? "?launcher=1" : ""));
  return win.loadFile(path.join(root, "dist", "index.html"), launcher ? { query: { launcher: "1" } } : undefined);
}

app.whenReady().then(async () => {
  // the rental database also keeps this copy's activation (app_settings)
  let { raw, db } = openDatabase();
  const demo = process.env.RENTAL_DEMO === "1";

  // ---- activation: nothing works until this copy has a valid code ----
  const identity = deviceIdentity();
  let rentalSync: ReturnType<typeof startDeviceSync> | null = null;
  let operations: OperationsBackend | null = null;
  const makeLicense = () =>
    createLicenseManager({
      db,
      ...identity,
      appVersion: app.getVersion(),
      ...licenseServer,
      onCredentials: (c, p) => (p === "rental" ? rentalSync : operations?.sync)?.ensureLogin(c).catch(() => {}),
    });
  let license: LicenseManager = makeLicense();

  // demo / screenshots only: RENTAL_DEMO_BRAND="name|legal name" shows another company's copy
  const [demoName, demoCustomer] = (process.env.RENTAL_DEMO_BRAND ?? "").split("|");
  const demoStatus: LicenseStatus = {
    state: "active",
    licenseId: 0,
    customer: demoName ? demoCustomer || demoName : "شركة البنيان للمعدات الثقيلة",
    name: demoName || "البنيان",
    logo: demoName ? null : "bundled",
    expiresAt: null,
    checkBy: "",
    products: ["rental", "operations"],
  };
  const licenseStatus = () => (demo ? demoStatus : license.status());

  // the device password (optional): until it's typed, only the password page opens
  const makeLock = () => createLock({ db, savedKey: () => license.savedKey() });
  let lock = makeLock();
  let unlocked = !lock.hasPassword() || lock.takePass(arg("pass"));
  const usable = () => licenseStatus().state === "active" && unlocked;
  const products = () => {
    const s = licenseStatus();
    return s.state === "active" ? s.products : [];
  };

  // which program this run opens: the one just picked on the chooser, else
  // the only one the code has; a code with both always starts on the chooser
  const pick = (): Product | null => {
    if (!unlocked) return null;
    const have = products();
    const wanted = (demo ? ((process.env.RENTAL_PRODUCT as Product | undefined) ?? "rental") : undefined) ?? productArg;
    if (wanted && have.includes(wanted)) return wanted;
    return have.length === 1 ? have[0] : null;
  };
  const product = pick();

  // after each check the screen gets the fresh state right away (name, logo,
  // a stopped code); a code that stops working sends it back to activation
  const checkLicense = () =>
    license
      .refresh()
      .then((s) => {
        mainWindow?.webContents.send("license:changed", s);
        if (s.state !== "active" && product && mainWindow) loadPage(mainWindow, "launcher");
      })
      .catch(() => {});
  if (!demo) {
    checkLicense();
    setInterval(checkLicense, 6 * 60 * 60 * 1000);
  }
  ipcMain.handle("license:status", () => licenseStatus());
  ipcMain.handle("license:activate", (_e, { key }: { key: string }) => license.activate(key));

  // ---- switching between the two programs ----
  ipcMain.handle("shell:info", () => ({ product, products: products(), locked: !unlocked, hasPassword: lock.hasPassword() }));
  ipcMain.handle("shell:open", (_e, { product: next }: { product: Product }) => {
    if (!unlocked || !products().includes(next)) return { ok: false };
    const pass = lock.hasPassword() ? [`--pass=${lock.issuePass()}`] : [];
    app.relaunch({ args: [...shellArgs(), `--product=${next}`, ...pass] });
    app.exit(0);
    return { ok: true };
  });
  // "خروج": back to the start — the password page, or the chooser
  ipcMain.handle("shell:logout", () => {
    app.relaunch({ args: shellArgs() });
    app.exit(0);
    return { ok: true };
  });
  ipcMain.handle("shell:unlock", (_e, { password }: { password: string }) => {
    if (!lock.check(password)) return { ok: false, message: "الباسورد غلط" };
    unlocked = true;
    return { ok: true };
  });
  ipcMain.handle("shell:resetPassword", (_e, { code }: { code: string }) => {
    if (!lock.resetWithCode(code)) return { ok: false, message: "ده مش كود التفعيل بتاع الجهاز ده" };
    unlocked = true;
    return { ok: true };
  });
  ipcMain.handle("shell:setPassword", (_e, { current, next }: { current: string; next: string }) =>
    unlocked ? lock.setPassword(current, next) : { ok: false, message: "ادخل الأول" },
  );

  // shared by both programs
  ipcMain.handle("print:preview", (_e, opts?: { singlePage?: boolean }) => mainWindow && printPreview(mainWindow, iconPath, opts?.singlePage ?? true));
  ipcMain.handle("print:savePdf", async (_e, { name }: { name: string }) => {
    if (!mainWindow) return null;
    const r = await dialog.showSaveDialog(mainWindow, { defaultPath: `${name}.pdf`, filters: [{ name: "PDF", extensions: ["pdf"] }] });
    return r.canceled || !r.filePath ? null : savePdf(mainWindow, r.filePath);
  });
  const notifyRemote = (info: unknown) => mainWindow?.webContents.send("sync:remoteChanges", info);

  if (product === "operations") {
    operations = await startOperations({
      licensed: usable,
      credentials: () => license.credentials("operations"),
      onRemoteChanges: notifyRemote,
      withSync: !demo,
    });
    createWindow("operations");
  } else {
    // ---- التأجير (its page also shows the activation / chooser screen) ----
    if (demo && !raw.prepare("SELECT 1 FROM contracts LIMIT 1").get()) seedDemo(db);
    let registry = makeRegistry(db);
    const startRentalSync = () => startDeviceSync(db, notifyRemote, () => license.credentials("rental"));
    rentalSync = demo || product !== "rental" ? null : startRentalSync();
    const offline = { deviceId: "", deviceName: "", pending: 0, deferred: 0, online: false, needsLogin: false, lastError: null, lastSyncAt: null, disabled: true };
    ipcMain.handle("sync:status", () => rentalSync?.status() ?? offline);
    ipcMain.handle("sync:now", () => rentalSync?.syncNow() ?? offline);
    ipcMain.handle("sync:setDeviceName", (_e, { name }: { name: string }) => rentalSync?.setDeviceName(name) ?? offline);

    ipcMain.handle("core:call", (_e, { fn, args }) =>
      usable() ? callCore(db, registry, fn, args) : { ok: false, code: "license", message: "البرنامج محتاج كود تفعيل" },
    );
    ipcMain.handle("export:excel", (_e, { fileName, sheets }: { fileName: string; sheets: ExcelSheet[] }) => mainWindow && exportExcel(mainWindow, fileName, sheets));

    // ---- backups ----
    const runDaily = () => dailyBackup(raw).catch((e) => console.error("backup failed", e));
    if (product === "rental") {
      runDaily();
      setInterval(runDaily, 3 * 60 * 60 * 1000);
    }
    ipcMain.handle("backup:last", () => lastBackup());
    ipcMain.handle("backup:now", async () => {
      if (!mainWindow) return null;
      const r = await dialog.showSaveDialog(mainWindow, {
        defaultPath: `نسخة-${(() => {
          const s = licenseStatus();
          return s.state === "active" ? s.name : "التأجير";
        })()}-${new Date().toLocaleDateString("en-CA")}.db`,
        filters: [{ name: "نسخة احتياطية", extensions: ["db"] }],
      });
      return r.canceled || !r.filePath ? null : backupTo(raw, r.filePath);
    });
    ipcMain.handle("backup:restore", async () => {
      if (!mainWindow) return { ok: false };
      const r = await dialog.showOpenDialog(mainWindow, { properties: ["openFile"], filters: [{ name: "نسخة احتياطية", extensions: ["db"] }] });
      const file = r.filePaths[0];
      if (r.canceled || !file) return { ok: false };
      if (!looksLikeRentalDb(file, (f) => new Database(f, { readonly: true }))) return { ok: false, message: "الملف ده مش نسخة من برنامج التأجير" };
      await dailyBackup(raw); // keep today's state before replacing it
      rentalSync?.stop();
      raw.close();
      for (const ext of ["", "-wal", "-shm"]) fs.rmSync(dbPath() + ext, { force: true });
      fs.copyFileSync(file, dbPath());
      ({ raw, db } = openDatabase());
      registry = makeRegistry(db);
      license = makeLicense();
      lock = makeLock();
      if (rentalSync) rentalSync = startRentalSync();
      mainWindow.webContents.reload();
      return { ok: true };
    });

    createWindow(product === "rental" ? "rental" : "launcher");
  }

  setupAutoUpdate();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow(product ?? "launcher");
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
