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
import { Device } from "@capacitor/device";
import { sha256 } from "@noble/hashes/sha256";
import { bytesToHex } from "@noble/hashes/utils";
import { createLicenseManager } from "../core/license/manager";
import { licenseServer } from "../core/license/config";

declare const __APP_VERSION__: string;

/** Android's id for this app on this tablet (same on reinstall, different on another tablet). */
async function tabletIdentity() {
  const [{ identifier }, info] = await Promise.all([Device.getId(), Device.getInfo()]);
  return {
    deviceId: bytesToHex(sha256(`albunyan-rental:${identifier}`)).slice(0, 32),
    deviceName: [info.manufacturer, info.model].filter(Boolean).join(" ") || "تابلت",
    platform: "android" as const,
  };
}

// The app itself on the tablet: same schema, same calculations (core/) and the
// same registry the laptop's main process serves (electron/ipc.ts), only
// running inside the Android app instead of Electron.
type Handler = (payload: any) => unknown;

export async function startBackend() {
  const SQL = await initSqlJs({ locateFile: () => wasmUrl });
  const db = createDatabase(SQL, await loadSaved());
  setupDatabase(db);
  const registry = makeRegistry(db);

  // activation: nothing works until this tablet has a valid code

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

  // activation: nothing works until this tablet has a valid code; the code
  // also brings the login of this customer's own sync space
  const license = createLicenseManager({
    db,
    ...(await tabletIdentity()),
    appVersion: typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "0.0.0",
    ...licenseServer,
    onCredentials: (c) => sync.ensureLogin(c).catch(() => {}),
  });
  // after each check the screen gets the fresh state right away (name, logo, a stopped code)
  const checkLicense = () =>
    license
      .refresh()
      .then((s) => emit("license:changed", s))
      .catch(() => {});
  checkLicense();
  setInterval(checkLicense, 6 * 60 * 60 * 1000);
  sync
    .start()
    .then(() => {
      const c = license.credentials();
      return c ? sync.ensureLogin(c) : undefined;
    })
    .catch((e) => console.error("sync start failed", e));

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
    "core:call": ({ fn, args }) =>
      license.status().state === "active" ? callCore(db, registry, fn, args) : { ok: false, code: "license", message: "البرنامج محتاج كود تفعيل" },
    "license:status": () => license.status(),
    "license:activate": ({ key }) => license.activate(key),
    "sync:status": () => sync.status(),
    "sync:now": () => sync.syncNow(),
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
