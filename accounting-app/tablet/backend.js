// "البرنامج" نفسه على التابلت: نفس قاعدة البيانات (schema.js) ونفس الحسابات
// (ipc.js) ونفس المزامنة (syncEngine.js) بتوع اللاب بالظبط — بس شغالين جوه
// التطبيق بدل Electron.
import initSqlJs from "sql.js";
import wasmUrl from "sql.js/dist/sql-wasm.wasm?url";
import { createClient } from "@supabase/supabase-js";
import schemaModule from "../electron/schema.js";
import ipcModule from "../electron/ipc.js";
import engineModule from "../electron/syncEngine.js";
import cloud from "../electron/cloudConfig.js";
import { handlers } from "./electronShim.js";
import { createDatabase, loadSavedDatabase } from "./sqlAdapter.js";
import { tabletAppHandlers } from "./appHandlers.js";

export async function startBackend() {
  const SQL = await initSqlJs({ locateFile: () => wasmUrl });
  const saved = await loadSavedDatabase();
  const db = createDatabase(SQL, saved ? new Uint8Array(saved) : null);
  schemaModule.setupDatabase(db, { seed: false });
  ipcModule.registerIpcHandlers(db);

  const listeners = new Map();
  const emit = (channel, data) => (listeners.get(channel) ?? []).forEach((cb) => cb(data));

  const sync = engineModule.createSyncEngine({
    db,
    createClient,
    ...cloud,
    defaultDeviceName: "التابلت",
    onRemoteChanges: (info) => emit("sync:remoteChanges", info),
  });
  sync.setup();
  sync.start();
  handlers["sync:status"] = () => sync.status();
  handlers["sync:now"] = () => sync.syncNow();
  handlers["sync:login"] = (_e, { password }) => sync.login(password);
  handlers["sync:setDeviceName"] = (_e, { name }) => sync.setDeviceName(name);
  handlers["sync:activity"] = (_e, filters) => sync.activity(filters ?? {});
  Object.assign(handlers, tabletAppHandlers(emit));

  // حفظ القاعدة على الجهاز: كل ثانية لو فيه تعديل، وفورًا لو التطبيق اتقفل
  // أو راح في الخلفية.
  setInterval(() => db.flush().catch((err) => console.error("save failed", err)), 1000);
  const flushNow = () => db.flush().catch(() => {});
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushNow();
  });
  window.addEventListener("pagehide", flushNow);

  return {
    invoke: async (channel, payload) => {
      const fn = handlers[channel];
      if (!fn) throw new Error(`No handler for ${channel}`);
      return fn(null, payload);
    },
    on: (channel, callback) => {
      if (!listeners.has(channel)) listeners.set(channel, []);
      listeners.get(channel).push(callback);
      return () => listeners.set(channel, (listeners.get(channel) ?? []).filter((cb) => cb !== callback));
    },
  };
}
