import path from "node:path";
import { app, ipcMain } from "electron";
import Database from "better-sqlite3";
import type { SyncCredentials } from "../core/license/manager";
import { migrateLegacyOperations, OPERATIONS_DB, setupOperationsDatabase } from "./operationsDb";
// The operations program (التشغيل): the old accounting app's backend, unchanged
// apart from its cloud login (operations/electron/).
const { registerIpcHandlers } = require("../operations/electron/ipc.js");
const { startDeviceSync } = require("../operations/electron/sync.js");

/** Where the old app ("حسابات البنيان") kept its data on this computer. */
export const legacyOperationsDb = () => path.join(app.getPath("appData"), "حسابات البنيان", "al-bunyan.db");

export interface OperationsBackend {
  sync: { ensureLogin(c: SyncCredentials): Promise<unknown>; stop(): void } | null;
}

/** Opens التشغيل: its database, its screens' functions and its sync. */
export async function startOperations(opts: {
  licensed: () => boolean;
  credentials: () => SyncCredentials | null;
  onRemoteChanges: (info: unknown) => void;
  withSync: boolean;
}): Promise<OperationsBackend> {
  const file = path.join(app.getPath("userData"), OPERATIONS_DB);
  await migrateLegacyOperations(file, legacyOperationsDb());
  const db = new Database(file);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  setupOperationsDatabase(db);

  // every one of its screen functions refuses to run without a valid code
  const handle = ipcMain.handle.bind(ipcMain);
  ipcMain.handle = ((channel: string, fn: (...a: unknown[]) => unknown) =>
    handle(channel, (...a: unknown[]) => (opts.licensed() ? fn(...a) : Promise.reject(new Error("البرنامج محتاج كود تفعيل"))))) as typeof ipcMain.handle;
  try {
    registerIpcHandlers(db);
  } finally {
    ipcMain.handle = handle;
  }

  const sync = opts.withSync ? startDeviceSync(db, { onRemoteChanges: opts.onRemoteChanges, getCredentials: opts.credentials }) : null;
  const offline = { deviceId: "", deviceName: "", pending: 0, deferred: 0, online: false, needsLogin: false, lastError: null, lastSyncAt: null, disabled: true };
  ipcMain.handle("sync:status", () => sync?.status() ?? offline);
  ipcMain.handle("sync:now", () => sync?.syncNow() ?? offline);
  ipcMain.handle("sync:login", (_e, { password }: { password: string }) => sync?.login(password) ?? offline);
  ipcMain.handle("sync:undo", (_e, { id }: { id: number }) => sync?.undo(id));
  ipcMain.handle("sync:setDeviceName", (_e, { name }: { name: string }) => sync?.setDeviceName(name) ?? offline);
  ipcMain.handle("sync:activity", (_e, filters?: unknown) => sync?.activity(filters ?? {}) ?? { rows: [], pending: 0, devices: [] });
  return { sync };
}
