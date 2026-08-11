const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");
const os = require("os");
const { initDatabase } = require("./db");
const { registerIpcHandlers } = require("./ipc");
const { startCloudSync, pushAllToCloud, markAsSecondaryMachine, isSecondaryMachine } = require("./sync");
const { autoUpdater } = require("electron-updater");

const isDev = !app.isPackaged;

// vite copies public/* into dist/ on build, so the logo lands at dist/logo.png
// once packaged; in dev mode dist/ doesn't exist yet, so fall back to the
// source public/ folder.
const iconPath = isDev
  ? path.join(__dirname, "..", "public", "logo.png")
  : path.join(__dirname, "..", "dist", "logo.png");

let mainWindow = null;

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    autoHideMenuBar: true,
    icon: iconPath,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.js"),
    },
  });
  mainWindow = win;
  win.on("closed", () => {
    if (mainWindow === win) mainWindow = null;
  });

  if (isDev) {
    win.loadURL("http://localhost:5173");
  } else {
    win.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }
}

// Electron مفيهوش شاشة "معاينة قبل الطباعة" زي المتصفحات العادية —
// لو استخدمنا window.print() هيحاول يفتح نافذة معاينة داخلية بتحتاج
// إضافة plugin مش متاحة، فبتظهر رسالة خطأ. الحل: نولّد PDF فعلي من
// نفس الصفحة وبنفس تنسيق الطباعة، ونفتحه في نافذة جديدة جوه البرنامج نفسه
// (مش برنامج خارجي) باستخدام عارض الـ PDF المدمج في Electron — فيه زرار
// طباعة وتكبير/تصغير، فده بالظبط "تاب الطباعة" اللي بيوريك هيطبع إيه قبل
// ما تدوس طباعة فعلاً.
let printPreviewWindow = null;

ipcMain.handle("print:preview", async () => {
  if (!mainWindow) return;
  const pdfBuffer = await mainWindow.webContents.printToPDF({
    printBackground: true,
    pageSize: "A4",
    margins: { marginType: "default" },
  });
  const tmpPath = path.join(os.tmpdir(), `albunyan-print-${Date.now()}.pdf`);
  fs.writeFileSync(tmpPath, pdfBuffer);

  if (printPreviewWindow && !printPreviewWindow.isDestroyed()) {
    printPreviewWindow.close();
  }
  printPreviewWindow = new BrowserWindow({
    width: 900,
    height: 1000,
    title: "معاينة الطباعة",
    icon: iconPath,
    webPreferences: {
      plugins: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  printPreviewWindow.setMenuBarVisibility(false);
  printPreviewWindow.on("closed", () => {
    printPreviewWindow = null;
  });
  await printPreviewWindow.loadURL(`file://${tmpPath}`);
});

// تحديث تلقائي: كل ما نصدر نسخة جديدة على GitHub Releases، البرنامج بيكتشفها
// لوحده، بينزّلها في الخلفية من غير ما يوقف شغل المستخدم، وبيثبّتها تلقائيًا
// أول ما يقفل البرنامج ويفتحه تاني — من غير ما يحتاج ينزّل حاجة بنفسه، ومن
// غير ما داتاه (قاعدة البيانات) تتأثر خالص، لأنها متخزنة في مجلد منفصل تمامًا
// عن ملفات البرنامج نفسها.
function setupAutoUpdate() {
  if (isDev) return;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on("error", () => {
    // بيتجاهل بهدوء — لو مفيش إنترنت أو لسه مفيش نسخة أحدث، البرنامج يشتغل عادي
  });
  autoUpdater.checkForUpdates().catch(() => {});
  setInterval(() => {
    autoUpdater.checkForUpdates().catch(() => {});
  }, 4 * 60 * 60 * 1000);
}

// من صفحة الإعدادات: زرار "تحقق من التحديثات" بيدوس على الفحص التلقائي يدويًا
// (مفيد لو النسخة قديمة أوي ومفيهاش تحديث تلقائي أصلًا)، وبيستنى النتيجة
// النهائية — لو فيه تحديث بينزله كامل قبل ما يرد، عشان الزرار التاني
// "تثبيت وإعادة التشغيل" يبقى جاهز يشتغل على طول من غير استنى تاني.
ipcMain.handle("app:getVersion", () => app.getVersion());

ipcMain.handle("app:checkForUpdate", () => {
  if (isDev) return Promise.resolve({ state: "dev" });
  return new Promise((resolve) => {
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      autoUpdater.removeListener("update-not-available", onNotAvailable);
      autoUpdater.removeListener("update-downloaded", onDownloaded);
      autoUpdater.removeListener("error", onError);
      resolve(result);
    };
    const onNotAvailable = () => finish({ state: "not-available", version: app.getVersion() });
    const onDownloaded = (info) => finish({ state: "downloaded", version: info.version });
    const onError = (err) => finish({ state: "error", message: String((err && err.message) || err) });
    autoUpdater.once("update-not-available", onNotAvailable);
    autoUpdater.once("update-downloaded", onDownloaded);
    autoUpdater.once("error", onError);
    autoUpdater.checkForUpdates().catch(onError);
  });
});

ipcMain.handle("app:installUpdate", () => {
  autoUpdater.quitAndInstall();
});

app.whenReady().then(() => {
  const db = initDatabase();
  registerIpcHandlers(db);
  startCloudSync(db);
  ipcMain.handle("sync:pushAll", () => pushAllToCloud(db));
  ipcMain.handle("sync:isSecondaryMachine", () => isSecondaryMachine());
  ipcMain.handle("sync:markAsSecondaryMachine", () => markAsSecondaryMachine());
  createWindow();
  setupAutoUpdate();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
