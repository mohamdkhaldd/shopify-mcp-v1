import initSqlJs from "sql.js";
import wasmUrl from "sql.js/dist/sql-wasm.wasm?url";
import { createClient } from "@supabase/supabase-js";
import { setupDatabase } from "../core/schema";
import { createSyncEngine } from "../core/sync/syncEngine";
import { cloud } from "../core/sync/cloudConfig";
import { callCore, makeRegistry } from "../electron/ipc";
import { createDatabase } from "./sqlAdapter";
import { forget, loadSaved, save } from "./storage";
import { tabletAppHandlers } from "./appHandlers";
import { Capacitor } from "@capacitor/core";
import { Device } from "@capacitor/device";
import { sha256 } from "@noble/hashes/sha256";
import { bytesToHex } from "@noble/hashes/utils";
import { createLicenseManager, Product } from "../core/license/manager";
import { startOperations } from "./operations";
import { licenseServer } from "../core/license/config";
import { createPass } from "../core/shell/lock";
import { unsyncedChanges } from "../core/shell/unsynced";

declare const __APP_VERSION__: string;
declare const __TEST_LICENSE_KEY__: string;

/** Inside the Android app, or the web version in a browser (iPhone, any computer). */
const native = Capacitor.isNativePlatform();

/**
 * Android's id for this app on this device (same on reinstall, different on
 * another device); in a browser, an id saved in that browser's storage.
 */
async function deviceIdentity() {
  const [{ identifier }, info] = await Promise.all([Device.getId(), Device.getInfo()]);
  const ua = navigator.userAgent;
  const webName = /iPhone/.test(ua) ? "آيفون" : /iPad/.test(ua) ? "آيباد" : /Android/.test(ua) ? "موبايل (ويب)" : "متصفح";
  return {
    deviceId: bytesToHex(sha256(`albunyan-rental:${identifier}`)).slice(0, 32),
    deviceName: native ? [info.manufacturer, info.model].filter(Boolean).join(" ") || "تابلت" : webName,
    platform: native ? ("android" as const) : ("web" as const),
  };
}

// MK-Tech on the tablet / web: the activation code decides the program —
// التأجير runs on the same core/ and registry as the laptop, التشغيل on the
// old app's backend (./operations). The rental file also keeps the activation.
type Handler = (payload: any) => unknown;
export type Page = Product | "launcher";

export async function startBackend(): Promise<{ page: Page; api: NonNullable<Window["api"]> }> {
  const SQL = await initSqlJs({ locateFile: () => wasmUrl });
  const db = createDatabase(SQL, await loadSaved());
  setupDatabase(db);

  const listeners = new Map<string, ((data: unknown) => void)[]>();
  const emit = (channel: string, data: unknown) => (listeners.get(channel) ?? []).forEach((cb) => cb(data));

  // activation: nothing works until this device has a valid code; the code
  // also brings the login of this customer's own sync space for each program
  let rentalSync: ReturnType<typeof createSyncEngine> | null = null;
  let opsSync: { ensureLogin(c: unknown): Promise<unknown> } | null = null;
  const license = createLicenseManager({
    db,
    ...(await deviceIdentity()),
    appVersion: typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "0.0.0",
    ...licenseServer,
    ...(typeof __TEST_LICENSE_KEY__ !== "undefined" && __TEST_LICENSE_KEY__ ? { publicKey: __TEST_LICENSE_KEY__ } : {}),
    onCredentials: (c, p) => (p === "rental" ? rentalSync : opsSync)?.ensureLogin(c).catch(() => {}),
  });
  const products = (): Product[] => {
    const s = license.status();
    return s.state === "active" ? s.products : [];
  };

  // the company password (optional): with one, the app opens on the lock
  // screen and "قفل" goes back to it. The pass the chooser hands over works
  // once; it's taken off the address right away, so reloading later asks again.
  const hasPassword = () => {
    const s = license.status();
    return s.state === "active" && s.hasPassword;
  };
  const pass = createPass({ db });
  const query = new URLSearchParams(location.search);
  let unlocked = !hasPassword() || pass.take(query.get("pass"));
  if (query.has("pass")) {
    query.delete("pass");
    history.replaceState(null, "", `${location.pathname}${query.size ? `?${query}` : ""}`);
  }

  // which program this start opens: the one just picked on the chooser, else
  // the only one the code has; a code with both always starts on the chooser
  const asked = query.get("product") as Product | null;
  const pick = (): Page => {
    if (!unlocked) return "launcher";
    const have = products();
    if (asked && have.includes(asked)) return asked;
    return have.length === 1 ? have[0] : "launcher";
  };
  const page = pick();

  // after each check the screen gets the fresh state right away (name, logo,
  // a stopped code); a code that stops working goes back to activation
  const checkLicense = () =>
    license
      .refresh()
      .then((s) => {
        emit("license:changed", s);
        if (s.state !== "active" && page !== "launcher") location.replace(location.pathname);
      })
      .catch(() => {});
  checkLicense();
  setInterval(checkLicense, 6 * 60 * 60 * 1000);

  // the rental file is saved at most once a second, and right away when the
  // app is sent to the background or closed
  let saving: Promise<void> | null = null;
  let signedOut = false;
  const flush = () => {
    if (signedOut) return Promise.resolve();
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

  const licensed = () => license.status().state === "active" && unlocked;
  const handlers: Record<string, Handler> = {
    "license:status": () => license.status(),
    "license:activate": ({ key, password }) => license.activate(key, password),
    "shell:info": () => ({ product: page === "launcher" ? null : page, products: products(), locked: !unlocked, hasPassword: hasPassword() }),
    // switching programs: start again on the chosen one
    "shell:open": ({ product }: { product: Product }) => {
      if (!unlocked || !products().includes(product)) return { ok: false };
      const p = hasPassword() ? `&pass=${pass.issue()}` : "";
      flush().then(() => location.replace(`${location.pathname}?product=${product}${p}`));
      return { ok: true };
    },
    // "قفل": the lock screen, until the company password is typed
    "shell:lock": () => {
      flush().then(() => location.replace(location.pathname));
      return { ok: true };
    },
    "shell:unlock": async ({ password }: { password: string }) => {
      const r = await license.checkPassword(password);
      if (r.ok) unlocked = true;
      flush();
      return r;
    },
    "shell:setPassword": async ({ current, next }: { current: string; next: string }) => {
      if (!unlocked) return { ok: false, message: "ادخل الأول" };
      const r = await license.setPassword(current, next);
      flush();
      return r;
    },
    // "خروج": this device leaves the code (its place is free again) and starts
    // over on the activation page; its copy of the data goes too (it's all in
    // the cloud). Changes that haven't reached the cloud are reported first.
    "shell:signOut": async ({ force }: { force?: boolean }) => {
      const opsBytes = ops ? null : await loadSaved("operations");
      const pendingOps = ops ? ops.pending() : opsBytes ? unsyncedChanges(createDatabase(SQL, opsBytes)) : 0;
      const pending = unsyncedChanges(db) + pendingOps;
      // from the lock screen ("نسيت الباسورد؟") only when nothing would be lost
      if (pending > 0 && !unlocked) return { ok: false, message: "فيه تعديلات على الجهاز ده لسه ماوصلتش للسحابة — ادخل بالباسورد الأول" };
      if (pending > 0 && !force) return { ok: false, pending };
      const r = await license.signOut();
      if (!r.ok) return r;
      signedOut = true;
      rentalSync?.stop();
      ops?.stop();
      await saving;
      await forget(["main", "operations"]);
      location.replace(location.pathname);
      return { ok: true };
    },
  };

  let ops: Awaited<ReturnType<typeof startOperations>> | null = null;
  if (page === "operations") {
    ops = await startOperations({ SQL, native, licensed, credentials: () => license.credentials("operations"), emit });
    opsSync = ops.sync;
    Object.assign(handlers, tabletAppHandlers(emit, ops.exportNow, native), ops.handlers);
  } else {
    // التأجير (its page also shows the activation / chooser screen)
    const registry = makeRegistry(db);
    if (page === "rental") {
      rentalSync = createSyncEngine({
        db,
        createClient,
        ...cloud,
        defaultDeviceName: native ? "التابلت" : "نسخة الويب",
        onRemoteChanges: (info) => emit("sync:remoteChanges", info),
      });
      rentalSync.setup();
      const sync = rentalSync;
      sync
        .start()
        .then(() => {
          const c = license.credentials("rental");
          return c ? sync.ensureLogin(c) : undefined;
        })
        .catch((e) => console.error("sync start failed", e));
    }
    const offline = { deviceId: "", deviceName: "", pending: 0, deferred: 0, online: false, needsLogin: false, lastError: null, lastSyncAt: null, disabled: true };
    Object.assign(handlers, {
      "core:call": ({ fn, args }) => (licensed() ? callCore(db, registry, fn, args) : { ok: false, code: "license", message: "البرنامج محتاج كود تفعيل" }),
      "sync:status": () => rentalSync?.status() ?? offline,
      "sync:now": () => rentalSync?.syncNow() ?? offline,
      "sync:setDeviceName": ({ name }) => rentalSync?.setDeviceName(name) ?? offline,
      ...tabletAppHandlers(emit, () => db.exportNow(), native),
    } satisfies Record<string, Handler>);
  }

  return {
    page,
    api: {
      platform: native ? ("tablet" as const) : ("web" as const),
      invoke: async (channel: string, payload?: unknown) => {
        const fn = handlers[channel];
        if (!fn) throw new Error(`No handler for ${channel}`);
        return fn(payload ?? {});
      },
      on: (channel: string, cb: (data: unknown) => void) => {
        listeners.set(channel, [...(listeners.get(channel) ?? []), cb]);
        return () => listeners.set(channel, (listeners.get(channel) ?? []).filter((x) => x !== cb));
      },
    },
  };
}
