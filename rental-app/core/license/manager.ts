import type { Db } from "../db";
import { pbkdf2 } from "@noble/hashes/pbkdf2";
import { sha256 } from "@noble/hashes/sha256";
import { bytesToHex, hexToBytes, randomBytes } from "@noble/hashes/utils";
import { checkToken, LICENSE_PUBLIC_KEY, Product } from "./token";

export type { Product } from "./token";

// The activation state of this copy of the app. The code the customer typed
// and the last signed token are kept in app_settings (never synced). On every
// start, and every few hours, the app checks in with the server: a stopped or
// expired code locks it right away; without internet the last token keeps it
// working until the token runs out (14 days, or the subscription's last day).
//
// The company password (optional, set by the customer from any of its devices)
// is kept on the server: it's asked when the code is entered on a new device,
// and on the lock screen. Each device also keeps a hash of the last password
// typed on it, so the lock screen opens without internet too. Signing out
// frees the device's place on the code.

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
      /** the company set a password: asked on the lock screen and on new devices */
      hasPassword: boolean;
    }
  | { state: "needed"; message: string | null };

export interface SyncCredentials {
  email: string;
  password: string;
}

/** needPassword: the code is right, its company asks for a password on new devices */
export type ActivateResult = { ok: true; status: LicenseStatus } | { ok: false; message: string; needPassword?: boolean };
export type PasswordResult = { ok: true } | { ok: false; message: string };

type ServerAnswer =
  | {
      ok: true;
      token: string;
      logoUrl?: string | null;
      hasPassword?: boolean;
      sync?: SyncCredentials;
      syncByProduct?: Partial<Record<Product, SyncCredentials>>;
    }
  | { ok: false; error: string; maxDevices?: number; expiresAt?: string };
/** answers of the password / sign-out calls */
type PlainAnswer = { ok: true; hasPassword?: boolean } | { ok: false; error: string };

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
const WRONG_PASSWORD = "الباسورد غلط";
const PASSWORD_ROUNDS = 60_000;
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
        hasPassword: get("license_has_password") === "1",
      };
    return { state: "needed", message: c.reason === "expired" ? CHECK_IN : lastMessage };
  }

  /** null = no answer (no internet) */
  async function call<T extends { ok: boolean }>(body: Record<string, unknown>): Promise<T | null> {
    try {
      const res = await doFetch(o.url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${o.anonKey}`, apikey: o.anonKey },
        body: JSON.stringify({ deviceId: o.deviceId, ...body }),
      });
      const answer = (await res.json()) as T;
      return answer && typeof answer.ok === "boolean" ? answer : null;
    } catch {
      return null;
    }
  }
  const ask = (key: string, password?: string) =>
    call<ServerAnswer>({ key, deviceName: o.deviceName, platform: o.platform, appVersion: o.appVersion, ...(password ? { password } : {}) });

  // the last password typed on this device, for the lock screen without internet
  const hashOf = (password: string, salt: Uint8Array) => bytesToHex(pbkdf2(sha256, password, salt, { c: PASSWORD_ROUNDS, dkLen: 32 }));
  function rememberPassword(password: string | null) {
    if (!password) return set("license_password_hash", null);
    const salt = randomBytes(16);
    set("license_password_hash", JSON.stringify({ salt: bytesToHex(salt), hash: hashOf(password, salt) }));
  }
  function matchesRemembered(password: string): boolean | null {
    const v = get("license_password_hash");
    if (!v) return null;
    const { salt, hash } = JSON.parse(v) as { salt: string; hash: string };
    return hashOf(password, hexToBytes(salt)) === hash;
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
    set("license_has_password", a.hasPassword ? "1" : null);
    if (!a.hasPassword) rememberPassword(null);
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

  async function activate(key: string, password?: string): Promise<ActivateResult> {
    const clean = key.trim();
    if (!clean) return { ok: false, message: "اكتب كود التفعيل" };
    const a = await ask(clean, password);
    if (!a) return { ok: false, message: OFFLINE };
    if (!a.ok && a.error === "password_required") return { ok: false, needPassword: true, message: "الشركة دي عاملة باسورد — اكتبه عشان تدخل" };
    if (!a.ok && a.error === "wrong_password") return { ok: false, needPassword: true, message: WRONG_PASSWORD };
    if (!a.ok) return { ok: false, message: (MESSAGES[a.error] ?? (() => OFFLINE))(a) };
    const problem = await accept(clean, a);
    if (problem) return { ok: false, message: problem };
    if (password) rememberPassword(password);
    return { ok: true, status: status() };
  }

  /** The company password from this device: set, change (needs the current one) or remove (next = ""). Needs internet. */
  async function setPassword(current: string, next: string): Promise<PasswordResult> {
    const key = get("license_key");
    if (!key) return { ok: false, message: "البرنامج مش متفعّل" };
    const a = await call<PlainAnswer>({ action: "setPassword", key, current, next });
    if (!a) return { ok: false, message: OFFLINE };
    if (!a.ok)
      return {
        ok: false,
        message: a.error === "wrong_password" ? "الباسورد الحالي غلط" : a.error === "too_short" ? "الباسورد لازم يبقى ٤ حروف أو أرقام على الأقل" : (MESSAGES[a.error]?.(a) ?? OFFLINE),
      };
    set("license_has_password", next ? "1" : null);
    rememberPassword(next || null);
    return { ok: true };
  }

  /** The lock screen: the server decides; without internet, the last password typed on this device. */
  async function checkPassword(password: string): Promise<PasswordResult> {
    const key = get("license_key");
    if (!key) return { ok: false, message: "البرنامج مش متفعّل" };
    const a = await call<PlainAnswer>({ action: "checkPassword", key, password });
    if (a?.ok) {
      set("license_has_password", a.hasPassword ? "1" : null);
      rememberPassword(a.hasPassword ? password : null);
      return { ok: true };
    }
    if (a) return { ok: false, message: a.error === "wrong_password" ? WRONG_PASSWORD : (MESSAGES[a.error]?.(a) ?? OFFLINE) };
    const local = matchesRemembered(password);
    if (local === null) return { ok: false, message: "الجهاز ده محتاج نت المرة دي عشان يتأكد من الباسورد" };
    return local ? { ok: true } : { ok: false, message: WRONG_PASSWORD };
  }

  /** Sign this device out: its place on the code is free again. Needs internet. */
  async function signOut(): Promise<PasswordResult> {
    const key = get("license_key");
    if (key) {
      const a = await call<PlainAnswer>({ action: "release", key });
      if (!a) return { ok: false, message: "لازم نت عشان تخرج — عشان مكان الجهاز ده على الكود يفضى" };
    }
    for (const k of ["license_token", "license_key", "license_lic", "license_has_password", "license_password_hash", "brand_logo", "brand_logo_url"]) set(k, null);
    for (const p of PRODUCTS) {
      set(KEYS[p].email, null);
      set(KEYS[p].password, null);
    }
    return { ok: true };
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

  return { status, activate, refresh, credentials, setPassword, checkPassword, signOut, savedKey: () => get("license_key") };
}

export type LicenseManager = ReturnType<typeof createLicenseManager>;
