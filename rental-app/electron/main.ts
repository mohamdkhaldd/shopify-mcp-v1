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

const isDev = !app.isPackaged;
const root = path.join(__dirname, "..");
const iconPath = path.join(root, isDev ? "public" : "dist", "logo.png");

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
    title: "البنيان - التأجير",
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

  // ---- laptop ↔ tablet sync (never in demo / screenshot mode) ----
  const notifyRemote = (info: { count: number; devices: string[] }) => mainWindow?.webContents.send("sync:remoteChanges", info);
  let sync = process.env.RENTAL_DEMO === "1" ? null : startDeviceSync(db, notifyRemote);
  const offline = { deviceId: "", deviceName: "", pending: 0, deferred: 0, online: false, needsLogin: false, lastError: null, lastSyncAt: null, disabled: true };
  ipcMain.handle("sync:status", () => sync?.status() ?? offline);
  ipcMain.handle("sync:now", () => sync?.syncNow() ?? offline);
  ipcMain.handle("sync:login", async (_e, { password }: { password: string }) => {
    try {
      return { ok: true, status: sync ? await sync.login(password) : offline };
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : String(e) };
    }
  });
  ipcMain.handle("sync:setDeviceName", (_e, { name }: { name: string }) => sync?.setDeviceName(name) ?? offline);

  ipcMain.handle("core:call", (_e, { fn, args }) => callCore(db, registry, fn, args));

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
      defaultPath: `نسخة-البنيان-التأجير-${new Date().toLocaleDateString("en-CA")}.db`,
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
    if (sync) sync = startDeviceSync(db, notifyRemote);
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
