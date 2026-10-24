import type { Db } from "../db";
import { checkToken, LICENSE_PUBLIC_KEY, Product } from "./token";

export type { Product } from "./token";

// The activation state of this copy of the app. The code the customer typed
// and the last signed token are kept in app_settings (never synced). On every
// start, and every few hours, the app checks in with the server: a stopped or
// expired code locks it right away; without internet the last token keeps it
// working until the token runs out (14 days, or the subscription's last day).

export type LicenseStatus =
  | {
      state: "active";
      licenseId: number;
      /** legal name, for printouts */
      customer: string;
      /** short name, for the app's header */
      name: string;
      /** data: URL of the company's logo, "bundled" for the logo shipped with the app, null = none */
      logo: string | null;
      expiresAt: string | null;
      checkBy: string;
      /** the programs this code opens */
      products: Product[];
    }
  | { state: "needed"; message: string | null };

export interface SyncCredentials {
  email: string;
  password: string;
}

export type ActivateResult = { ok: true; status: LicenseStatus } | { ok: false; message: string };

type ServerAnswer =
  | { ok: true; token: string; logoUrl?: string | null; sync?: SyncCredentials; syncByProduct?: Partial<Record<Product, SyncCredentials>> }
  | { ok: false; error: string; maxDevices?: number; expiresAt?: string };

const MESSAGES: Record<string, (a: ServerAnswer & { ok: false }) => string> = {
  not_found: () => "الكود ده مش صحيح — راجعه تاني",
  revoked: () => "الكود ده اتوقف — كلّم MK-Tech",
  expired: (a) => `الاشتراك خلص${a.expiresAt ? ` يوم ${a.expiresAt}` : ""} — كلّم MK-Tech عشان تجدده`,
  full: (a) => `الكود ده متفعّل على أقصى عدد أجهزة${a.maxDevices ? ` (${a.maxDevices})` : ""} — كلّم MK-Tech لو عايز تزوّد جهاز`,
  device_removed: () => "الجهاز ده اتشال من الترخيص — كلّم MK-Tech",
};
/** answers that mean "this code no longer works here" (anything else is treated like no internet) */
const FINAL = new Set(Object.keys(MESSAGES));
const OFFLINE = "مقدرناش نوصل للنت — اتأكد إن النت شغال وجرّب تاني";
const CHECK_IN = "لازم البرنامج يتصل بالنت مرة عشان يتأكد من الاشتراك";

export interface LicenseOptions {
  db: Db;
  deviceId: string;
  deviceName: string;
  platform: "windows" | "android" | "web" | "other";
  appVersion: string;
  url: string;
  anonKey: string;
  fetch?: typeof fetch;
  now?: () => number;
  publicKey?: string;
  /** called after every successful check with the login of this customer's own cloud space, per program */
  onCredentials?: (c: SyncCredentials, product: Product) => void;
}

const PRODUCTS: Product[] = ["rental", "operations"];
/** where each program's sync login is kept (rental's keys predate the suite) */
const KEYS: Record<Product, { email: string; password: string }> = {
  rental: { email: "sync_email", password: "sync_password" },
  operations: { email: "sync_ops_email", password: "sync_ops_password" },
};

/** logo_url "bundled:…" = the logo shipped inside the app (Al Bunyan's own copy) */
const BUNDLED = "bundled";

export function createLicenseManager(o: LicenseOptions) {
  const now = () => Math.floor((o.now ?? Date.now)() / 1000);
  const doFetch = o.fetch ?? fetch;
  const get = (k: string) => (o.db.prepare("SELECT value FROM app_settings WHERE key = ?").get(k) as { value: string } | undefined)?.value ?? null;
  const set = (k: string, v: string | null) =>
    v == null
      ? o.db.prepare("DELETE FROM app_settings WHERE key = ?").run(k)
      : o.db.prepare("INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(k, v);

  let lastMessage: string | null = null;

  function status(): LicenseStatus {
    const token = get("license_token");
    if (!token) return { state: "needed", message: lastMessage };
    const c = checkToken(token, o.deviceId, now(), o.publicKey ?? LICENSE_PUBLIC_KEY);
    if (c.ok)
      return {
        state: "active",
        licenseId: c.payload.lic,
        customer: c.payload.customer,
        name: c.payload.name || c.payload.customer,
        logo: get("brand_logo"),
        expiresAt: c.payload.expiresAt,
        checkBy: new Date(c.payload.exp * 1000).toISOString(),
        products: c.payload.products?.length ? c.payload.products : ["rental"],
      };
    return { state: "needed", message: c.reason === "expired" ? CHECK_IN : lastMessage };
  }

  async function ask(key: string): Promise<ServerAnswer | null> {
    try {
      const res = await doFetch(o.url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${o.anonKey}`, apikey: o.anonKey },
        body: JSON.stringify({ key, deviceId: o.deviceId, deviceName: o.deviceName, platform: o.platform, appVersion: o.appVersion }),
      });
      const body = (await res.json()) as ServerAnswer;
      return body && typeof body.ok === "boolean" ? body : null;
    } catch {
      return null;
    }
  }

  async function saveLogo(url: string | null | undefined) {
    if ((url ?? null) === get("brand_logo_url") && (url == null || get("brand_logo"))) return;
    if (!url) {
      set("brand_logo", null);
      set("brand_logo_url", null);
      return;
    }
    if (url.startsWith(`${BUNDLED}:`)) {
      set("brand_logo", BUNDLED);
      set("brand_logo_url", url);
      return;
    }
    try {
      const res = await doFetch(url);
      if (!res.ok) return; // keep the old one, try again next time
      const type = res.headers.get("content-type") ?? "image/png";
      const bytes = new Uint8Array(await res.arrayBuffer());
      let bin = "";
      for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      set("brand_logo", `data:${type};base64,${btoa(bin)}`);
      set("brand_logo_url", url);
    } catch {
      /* offline: keep the old logo */
    }
  }

  /** "" = fine; otherwise why this answer can't be used on this device */
  async function accept(key: string, a: ServerAnswer & { ok: true }): Promise<string> {
    const c = checkToken(a.token, o.deviceId, now(), o.publicKey ?? LICENSE_PUBLIC_KEY);
    if (!c.ok) return "حصلت مشكلة في التفعيل — جرّب تاني";
    // one device holds one company's data: a code of another company would mix the two
    const before = get("license_lic");
    if (before && Number(before) !== c.payload.lic) return "الجهاز ده عليه بيانات شركة تانية — الكود ده مينفعش عليه";
    set("license_lic", String(c.payload.lic));
    set("license_key", key);
    set("license_token", a.token);
    const byProduct: Partial<Record<Product, SyncCredentials>> = a.syncByProduct ?? (a.sync ? { rental: a.sync } : {});
    for (const p of PRODUCTS) {
      const c = byProduct[p];
      if (!c) continue;
      set(KEYS[p].email, c.email);
      set(KEYS[p].password, c.password);
    }
    await saveLogo(a.logoUrl);
    lastMessage = null;
    for (const p of PRODUCTS) {
      const creds = credentials(p);
      if (creds) o.onCredentials?.(creds, p);
    }
    return "";
  }

  function credentials(product: Product = "rental"): SyncCredentials | null {
    const email = get(KEYS[product].email);
    const password = get(KEYS[product].password);
    return email && password ? { email, password } : null;
  }

  async function activate(key: string): Promise<ActivateResult> {
    const clean = key.trim();
    if (!clean) return { ok: false, message: "اكتب كود التفعيل" };
    const a = await ask(clean);
    if (!a) return { ok: false, message: OFFLINE };
    if (!a.ok) return { ok: false, message: (MESSAGES[a.error] ?? (() => OFFLINE))(a) };
    const problem = await accept(clean, a);
    if (problem) return { ok: false, message: problem };
    return { ok: true, status: status() };
  }

  /** Check in with the server (start-up and every few hours). */
  async function refresh(): Promise<LicenseStatus> {
    const key = get("license_key");
    if (!key) return status();
    const a = await ask(key);
    if (a?.ok) await accept(key, a);
    else if (a && FINAL.has(a.error)) {
      set("license_token", null);
      lastMessage = MESSAGES[a.error](a);
    }
    return status();
  }

  return { status, activate, refresh, credentials, savedKey: () => get("license_key") };
}

export type LicenseManager = ReturnType<typeof createLicenseManager>;
