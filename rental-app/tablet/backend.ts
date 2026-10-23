import initSqlJs from "sql.js";
import wasmUrl from "sql.js/dist/sql-wasm.wasm?url";
import { createClient } from "@supabase/supabase-js";
import { setupDatabase } from "../core/schema";
import { createSyncEngine } from "../core/sync/syncEngine";
import { cloud } from "../core/sync/cloudConfig";
import { callCore, makeRegistry } from "../electron/ipc";
import { createDatabase } from "./sqlAdapter";
import { loadSaved, save } from "./storage";
import { tabletAppHandlers } from "./appHandlers";

// The app itself on the tablet: same schema, same calculations (core/) and the
// same registry the laptop's main process serves (electron/ipc.ts), only
// running inside the Android app instead of Electron.
type Handler = (payload: any) => unknown;

export async function startBackend() {
  const SQL = await initSqlJs({ locateFile: () => wasmUrl });
  const db = createDatabase(SQL, await loadSaved());
  setupDatabase(db);
  const registry = makeRegistry(db);

  const listeners = new Map<string, ((data: unknown) => void)[]>();
  const emit = (channel: string, data: unknown) => (listeners.get(channel) ?? []).forEach((cb) => cb(data));

  const sync = createSyncEngine({
    db,
    createClient,
    ...cloud,
    defaultDeviceName: "التابلت",
    onRemoteChanges: (info) => emit("sync:remoteChanges", info),
  });
  sync.setup();
  sync.start().catch((e) => console.error("sync start failed", e));

  // a save is a whole-file export: at most once a second, and right away when
  // the app is sent to the background or closed
  let saving: Promise<void> | null = null;
  const flush = () => {
    if (saving) return saving;
    const bytes = db.exportIfDirty();
    if (!bytes) return Promise.resolve();
    saving = save(bytes)
      .catch((e) => console.error("save failed", e))
      .finally(() => {
        saving = null;
      });
    return saving;
  };
  setInterval(flush, 1000);
  document.addEventListener("visibilitychange", () => document.visibilityState === "hidden" && flush());
  window.addEventListener("pagehide", () => flush());

  const handlers: Record<string, Handler> = {
    "core:call": ({ fn, args }) => callCore(db, registry, fn, args),
    "sync:status": () => sync.status(),
    "sync:now": () => sync.syncNow(),
    "sync:login": async ({ password }) => {
      try {
        return { ok: true, status: await sync.login(password) };
      } catch (e) {
        return { ok: false, message: e instanceof Error ? e.message : String(e) };
      }
    },
    "sync:setDeviceName": ({ name }) => sync.setDeviceName(name),
    ...tabletAppHandlers(emit, () => db.exportNow()),
  };

  return {
    platform: "tablet" as const,
    invoke: async (channel: string, payload?: unknown) => {
      const fn = handlers[channel];
      if (!fn) throw new Error(`No handler for ${channel}`);
      return fn(payload ?? {});
    },
    on: (channel: string, cb: (data: unknown) => void) => {
      listeners.set(channel, [...(listeners.get(channel) ?? []), cb]);
      return () => listeners.set(channel, (listeners.get(channel) ?? []).filter((x) => x !== cb));
    },
  };
}
