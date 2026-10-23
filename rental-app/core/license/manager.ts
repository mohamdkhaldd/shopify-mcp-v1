import type { Db } from "../db";
import { checkToken, LICENSE_PUBLIC_KEY } from "./token";

// The activation state of this copy of the app. The code the customer typed
// and the last signed token are kept in app_settings (never synced). On every
// start, and every few hours, the app checks in with the server: a stopped or
// expired code locks it right away; without internet the last token keeps it
// working until the token runs out (14 days, or the subscription's last day).

export type LicenseStatus =
  | { state: "active"; customer: string; expiresAt: string | null; checkBy: string }
  | { state: "needed"; message: string | null };

export type ActivateResult = { ok: true; status: LicenseStatus } | { ok: false; message: string };

type ServerAnswer = { ok: true; token: string } | { ok: false; error: string; maxDevices?: number; expiresAt?: string };

const MESSAGES: Record<string, (a: ServerAnswer & { ok: false }) => string> = {
  not_found: () => "الكود ده مش صحيح — راجعه تاني",
  revoked: () => "الكود ده اتوقف — كلّم البنيان",
  expired: (a) => `الاشتراك خلص${a.expiresAt ? ` يوم ${a.expiresAt}` : ""} — كلّم البنيان عشان تجدده`,
  full: (a) => `الكود ده متفعّل على أقصى عدد أجهزة${a.maxDevices ? ` (${a.maxDevices})` : ""} — كلّم البنيان لو عايز تزوّد جهاز`,
  device_removed: () => "الجهاز ده اتشال من الترخيص — كلّم البنيان",
};
/** answers that mean "this code no longer works here" (anything else is treated like no internet) */
const FINAL = new Set(Object.keys(MESSAGES));
const OFFLINE = "مقدرناش نوصل للنت — اتأكد إن النت شغال وجرّب تاني";
const CHECK_IN = "لازم البرنامج يتصل بالنت مرة عشان يتأكد من الاشتراك";

export interface LicenseOptions {
  db: Db;
  deviceId: string;
  deviceName: string;
  platform: "windows" | "android" | "other";
  appVersion: string;
  url: string;
  anonKey: string;
  fetch?: typeof fetch;
  now?: () => number;
  publicKey?: string;
}

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
    if (c.ok) return { state: "active", customer: c.payload.customer, expiresAt: c.payload.expiresAt, checkBy: new Date(c.payload.exp * 1000).toISOString() };
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

  function accept(key: string, token: string): boolean {
    if (!checkToken(token, o.deviceId, now(), o.publicKey ?? LICENSE_PUBLIC_KEY).ok) return false;
    set("license_key", key);
    set("license_token", token);
    lastMessage = null;
    return true;
  }

  async function activate(key: string): Promise<ActivateResult> {
    const clean = key.trim();
    if (!clean) return { ok: false, message: "اكتب كود التفعيل" };
    const a = await ask(clean);
    if (!a) return { ok: false, message: OFFLINE };
    if (!a.ok) return { ok: false, message: (MESSAGES[a.error] ?? (() => OFFLINE))(a) };
    if (!accept(clean, a.token)) return { ok: false, message: "حصلت مشكلة في التفعيل — جرّب تاني" };
    return { ok: true, status: status() };
  }

  /** Check in with the server (start-up and every few hours). */
  async function refresh(): Promise<LicenseStatus> {
    const key = get("license_key");
    if (!key) return status();
    const a = await ask(key);
    if (a?.ok) accept(key, a.token);
    else if (a && FINAL.has(a.error)) {
      set("license_token", null);
      lastMessage = MESSAGES[a.error](a);
    }
    return status();
  }

  return { status, activate, refresh, savedKey: () => get("license_key") };
}

export type LicenseManager = ReturnType<typeof createLicenseManager>;
