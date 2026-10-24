import type { SqlJsStatic } from "sql.js";
import { createClient } from "@supabase/supabase-js";
import { createDatabase } from "./sqlAdapter";
import { loadSaved, save } from "./storage";
import type { SyncCredentials } from "../core/license/manager";
// التشغيل on the tablet / web: the old app's backend (operations/electron),
// registered through the small Electron stand-in instead of Electron.
import schemaModule from "../operations/electron/schema.js";
import ipcModule from "../operations/electron/ipc.js";
import engineModule from "../operations/electron/syncEngine.js";
import cloud from "../operations/electron/cloudConfig.js";
import { handlers as shimHandlers } from "../operations/tablet/electronShim.js";

type Handler = (payload: any) => unknown;

/** Its own database file on the device, its screens' functions and its sync. */
export async function startOperations(opts: {
  SQL: SqlJsStatic;
  native: boolean;
  licensed: () => boolean;
  credentials: () => SyncCredentials | null;
  emit: (channel: string, data: unknown) => void;
}) {
  const db = createDatabase(opts.SQL, await loadSaved("operations"));
  // without the old app's starting data (one company's own partners and staff);
  // the treasury accounts every company has are unique by name, so devices merge them
  schemaModule.setupDatabase(db, { seed: false });
  const add = db.prepare("INSERT OR IGNORE INTO treasury_accounts (name, current_balance) VALUES (?, 0)");
  for (const name of ["wallet", "instapay", "cash", "vodafone_cash"]) add.run(name);
  ipcModule.registerIpcHandlers(db);

  const sync = engineModule.createSyncEngine({
    db,
    createClient,
    ...cloud,
    defaultDeviceName: opts.native ? "التابلت" : "نسخة الويب",
    onRemoteChanges: (info: unknown) => opts.emit("sync:remoteChanges", info),
  });
  sync.setup();
  sync
    .start()
    .then(() => {
      const c = opts.credentials();
      return c ? sync.ensureLogin(c) : undefined;
    })
    .catch((e: unknown) => console.error("sync start failed", e));

  // saved like the rental file: at most once a second, and when the app goes to the background
  let saving: Promise<void> | null = null;
  const flush = () => {
    if (saving) return saving;
    const bytes = db.exportIfDirty();
    if (!bytes) return Promise.resolve();
    saving = save(bytes, "operations")
      .catch((e) => console.error("save failed", e))
      .finally(() => {
        saving = null;
      });
    return saving;
  };
  setInterval(flush, 1000);
  document.addEventListener("visibilitychange", () => document.visibilityState === "hidden" && flush());
  window.addEventListener("pagehide", () => flush());

  // every one of its screen functions refuses to run without a valid code
  const handlers: Record<string, Handler> = {};
  for (const [channel, fn] of Object.entries(shimHandlers as Record<string, (e: unknown, p: unknown) => unknown>)) {
    handlers[channel] = (payload) => (opts.licensed() ? fn(null, payload) : Promise.reject(new Error("البرنامج محتاج كود تفعيل")));
  }
  Object.assign(handlers, {
    "sync:status": () => sync.status(),
    "sync:now": () => sync.syncNow(),
    "sync:login": ({ password }: { password: string }) => sync.login(password),
    "sync:undo": ({ id }: { id: number }) => sync.undo(id),
    "sync:setDeviceName": ({ name }: { name: string }) => sync.setDeviceName(name),
    "sync:activity": (filters: unknown) => sync.activity(filters ?? {}),
  } satisfies Record<string, Handler>);
  return { handlers, sync, exportNow: () => db.exportNow() };
}
