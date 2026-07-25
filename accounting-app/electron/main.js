const { app, BrowserWindow } = require("electron");
const path = require("path");
const { initDatabase } = require("./db");
const { registerIpcHandlers } = require("./ipc");
const { autoUpdater } = require("electron-updater");

const isDev = !app.isPackaged;

// vite copies public/* into dist/ on build, so the logo lands at dist/logo.png
// once packaged; in dev mode dist/ doesn't exist yet, so fall back to the
// source public/ folder.
const iconPath = isDev
  ? path.join(__dirname, "..", "public", "logo.png")
  : path.join(__dirname, "..", "dist", "logo.png");

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

  if (isDev) {
    win.loadURL("http://localhost:5173");
  } else {
    win.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }
}

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

app.whenReady().then(() => {
  const db = initDatabase();
  registerIpcHandlers(db);
  createWindow();
  setupAutoUpdate();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
