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
import { createLicenseManager, LicenseManager } from "../core/license/manager";
import { licenseServer } from "../core/license/config";

const isDev = !app.isPackaged;
const root = path.join(__dirname, "..");
const iconPath = path.join(root, isDev ? "public" : "dist", "mk-icon.png");

// The data folder keeps the name it was first created with: the product was
// renamed to "MK-Tech التأجير", and copies installed before that keep their data
// in "البنيان - التأجير".
const legacyData = path.join(app.getPath("appData"), "البنيان - التأجير");
if (fs.existsSync(legacyData)) app.setPath("userData", legacyData);

// Screenshot / demo mode (never in a real install): RENTAL_DEMO=1 fills an empty
// database with the mockup example, RENTAL_TODAY pins "today".
if (process.env.RENTAL_TODAY) (globalThis as { __RENTAL_TODAY__?: string }).__RENTAL_TODAY__ = process.env.RENTAL_TODAY;
if (process.env.RENTAL_USER_DATA) app.setPath("userData", process.env.RENTAL_USER_DATA);

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    autoHideMenuBar: true,
    icon: iconPath,
    title: "MK-Tech التأجير",
    webPreferences: { contextIsolation: true, nodeIntegration: false, preload: path.join(__dirname, "preload.cjs") },
  });
  mainWindow = win;
  win.on("closed", () => {
    if (mainWindow === win) mainWindow = null;
  });
  if (process.env.VITE_DEV_SERVER_URL) win.loadURL(process.env.VITE_DEV_SERVER_URL);
  else win.loadFile(path.join(root, "dist", "index.html"));
}

app.whenReady().then(async () => {
  let { raw, db } = openDatabase();
  if (process.env.RENTAL_DEMO === "1" && !raw.prepare("SELECT 1 FROM contracts LIMIT 1").get()) seedDemo(db);
  let registry = makeRegistry(db);

  // ---- activation: nothing works until this copy has a valid code ----
  const identity = deviceIdentity();
  const demo = process.env.RENTAL_DEMO === "1";
  const makeLicense = () =>
    createLicenseManager({ db, ...identity, appVersion: app.getVersion(), ...licenseServer, onCredentials: (c) => sync?.ensureLogin(c).catch(() => {}) });
  let license: LicenseManager = makeLicense();

  // ---- sync between this customer's devices (never in demo / screenshot mode) ----
  const notifyRemote = (info: { count: number; devices: string[] }) => mainWindow?.webContents.send("sync:remoteChanges", info);
  const startSync = () => startDeviceSync(db, notifyRemote, () => license.credentials());
  let sync = demo ? null : startSync();
  const offline = { deviceId: "", deviceName: "", pending: 0, deferred: 0, online: false, needsLogin: false, lastError: null, lastSyncAt: null, disabled: true };
  ipcMain.handle("sync:status", () => sync?.status() ?? offline);
  ipcMain.handle("sync:now", () => sync?.syncNow() ?? offline);
  ipcMain.handle("sync:setDeviceName", (_e, { name }: { name: string }) => sync?.setDeviceName(name) ?? offline);

  // demo / screenshots only: RENTAL_DEMO_BRAND="name|legal name" shows another company's copy
  const [demoName, demoCustomer] = (process.env.RENTAL_DEMO_BRAND ?? "").split("|");
  const demoStatus = demoName
    ? { state: "active" as const, licenseId: 0, customer: demoCustomer || demoName, name: demoName, logo: null, expiresAt: null, checkBy: "" }
    : { state: "active" as const, licenseId: 0, customer: "شركة البنيان للمعدات الثقيلة", name: "البنيان", logo: "bundled", expiresAt: null, checkBy: "" };
  const licenseStatus = () => (demo ? demoStatus : license.status());
  // after each check the screen gets the fresh state right away (name, logo, a stopped code)
  const checkLicense = () =>
    license
      .refresh()
      .then((s) => mainWindow?.webContents.send("license:changed", s))
      .catch(() => {});
  if (!demo) {
    checkLicense();
    setInterval(checkLicense, 6 * 60 * 60 * 1000);
  }
  ipcMain.handle("license:status", () => licenseStatus());
  ipcMain.handle("license:activate", (_e, { key }: { key: string }) => license.activate(key));

  ipcMain.handle("core:call", (_e, { fn, args }) =>
    licenseStatus().state === "active" ? callCore(db, registry, fn, args) : { ok: false, code: "license", message: "البرنامج محتاج كود تفعيل" },
  );

  ipcMain.handle("print:preview", (_e, opts?: { singlePage?: boolean }) => mainWindow && printPreview(mainWindow, iconPath, opts?.singlePage ?? true));
  ipcMain.handle("print:savePdf", async (_e, { name }: { name: string }) => {
    if (!mainWindow) return null;
    const r = await dialog.showSaveDialog(mainWindow, { defaultPath: `${name}.pdf`, filters: [{ name: "PDF", extensions: ["pdf"] }] });
    return r.canceled || !r.filePath ? null : savePdf(mainWindow, r.filePath);
  });

  ipcMain.handle("export:excel", (_e, { fileName, sheets }: { fileName: string; sheets: ExcelSheet[] }) => mainWindow && exportExcel(mainWindow, fileName, sheets));

  // ---- backups ----
  const runDaily = () => dailyBackup(raw).catch((e) => console.error("backup failed", e));
  runDaily();
  setInterval(runDaily, 3 * 60 * 60 * 1000);
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
    sync?.stop();
    raw.close();
    for (const ext of ["", "-wal", "-shm"]) fs.rmSync(dbPath() + ext, { force: true });
    fs.copyFileSync(file, dbPath());
    ({ raw, db } = openDatabase());
    registry = makeRegistry(db);
    license = makeLicense();
    if (sync) sync = startSync();
    mainWindow.webContents.reload();
    return { ok: true };
  });

  createWindow();
  setupAutoUpdate();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
