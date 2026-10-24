import { app, ipcMain } from "electron";
import { autoUpdater } from "electron-updater";

// Same flow as the old app (silent download, install on quit, manual check from
// settings) — pointed at MK-Tech's own public releases repo (installers only).
// Copies installed before MK-Tech look in albunyan-rental-releases: the update
// that brings them here is published there too (see rental-windows.yml).
export const RELEASES = { provider: "github" as const, owner: "mohamdkhaldd", repo: "mk-tech" };

export function setupAutoUpdate() {
  ipcMain.handle("app:getVersion", () => app.getVersion());
  if (!app.isPackaged) {
    ipcMain.handle("app:checkForUpdate", () => ({ state: "dev" }));
    return;
  }
  autoUpdater.setFeedURL(RELEASES);
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on("error", () => {
    // no internet / no newer version: keep working quietly
  });
  autoUpdater.checkForUpdates().catch(() => {});
  setInterval(() => autoUpdater.checkForUpdates().catch(() => {}), 4 * 60 * 60 * 1000);

  ipcMain.handle(
    "app:checkForUpdate",
    () =>
      new Promise((resolve) => {
        let settled = false;
        const finish = (result: unknown) => {
          if (settled) return;
          settled = true;
          autoUpdater.removeListener("update-not-available", onNone);
          autoUpdater.removeListener("update-downloaded", onReady);
          autoUpdater.removeListener("error", onError);
          resolve(result);
        };
        const onNone = () => finish({ state: "not-available", version: app.getVersion() });
        const onReady = (info: { version: string }) => finish({ state: "downloaded", version: info.version });
        const onError = (err: unknown) => finish({ state: "error", message: String((err as Error)?.message ?? err) });
        autoUpdater.once("update-not-available", onNone);
        autoUpdater.once("update-downloaded", onReady);
        autoUpdater.once("error", onError);
        autoUpdater.checkForUpdates().catch(onError);
      }),
  );
  ipcMain.handle("app:installUpdate", () => autoUpdater.quitAndInstall());
}
