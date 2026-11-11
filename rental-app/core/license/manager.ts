import { cleanSheet, READ_ERRORS, ReadRequest, ReadResult } from "../ai/sarkiRead";
import type { AssistantAction } from "../ai/assistant";

export interface AssistantRequest {
  text: string;
  /** الأسماء الموجودة في البرنامج (assistantContext) */
  context: unknown;
  /** آخر كام رسالة عشان يفهم "و كمان..." */
  history?: { role: "user" | "assistant"; text: string }[];
  /** صورة (فاتورة، ورقة) لو فيه */
  image?: string;
  mediaType?: string;
}
export type AssistantReply = { ok: true; reply: string; actions: AssistantAction[] } | { ok: false; message: string };
const ASSISTANT_ERRORS: Record<string, string> = {
  empty: "اكتب اللي عايز تسجله",
  too_long: "الرسالة طويلة أوي — قسّمها على كذا رسالة",
};
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
      /** باقة التأجير وأقصى عدد معدات (null = من غير حد) */
      plan: string | null;
      maxEquipment: number | null;
      /** الاشتراك خلص: البرنامج بيفتح وبيعرض كل حاجة، بس مفيش تعديل ولا إضافة لحد ما يتجدد */
      expired?: boolean;
    }
  | { state: "needed"; message: string | null };

/** رسالة أي محاولة تعديل والاشتراك خالص */
export const EXPIRED_MESSAGE = "اشتراكك خلص — تقدر تشوف كل بياناتك، بس عشان تعدّل أو تضيف لازم تجدد الاشتراك. كلّم MK-Tech وهيرجع يشتغل على طول.";

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
      /** بيزيد كل ما بيانات الشركة تتصفّر أو نسخة قديمة ترجع (من لوحة MK) */
      dataEpoch?: number | null;
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
/** الجهاز عليه بيانات شركة تانية — شاشة التفعيل بتعرض زرار "امسح وابدأ من جديد" لما تشوف الرسالة دي */
export const OTHER_COMPANY = "الجهاز ده عليه بيانات شركة تانية — الكود ده مينفعش عليه";
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
  /** بيانات الشركة اتصفّرت أو اترجعت لنسخة قديمة من جهاز تاني أو من MK: امسح نسخة الجهاز ده وابدأ تاني */
  onDataReset?: () => void;
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
  /** الشركة اتصفّرت من جهاز تاني: بعد ما accept يخلص، الجهاز ده يمسح ويبدأ تاني */
  let resetPending = false;

  /** فيه بيانات شغل حقيقية على الجهاز ده؟ */
  const hasData = () => {
    try {
      return !!o.db.prepare("SELECT 1 FROM contracts UNION ALL SELECT 1 FROM suppliers UNION ALL SELECT 1 FROM clients LIMIT 1").get();
    } catch {
      return false;
    }
  };

  function status(): LicenseStatus {
    const token = get("license_token");
    if (!token) return { state: "needed", message: lastMessage };
    const c = checkToken(token, o.deviceId, now(), o.publicKey ?? LICENSE_PUBLIC_KEY);
    const lapsed = get("license_lapsed") != null;
    // التوكن خلص مع آخر يوم في الاشتراك (مش بسبب ١٤ يوم من غير نت) ← قراية بس
    const ended = !c.ok && c.reason === "expired" && !!c.payload && (lapsed || (!!c.payload.expiresAt && c.payload.expiresAt < new Date(now() * 1000).toISOString().slice(0, 10)));
    if (c.ok || ended) {
      const payload = c.payload!;
      return {
        state: "active",
        licenseId: payload.lic,
        customer: payload.customer,
        name: payload.name || payload.customer,
        logo: get("brand_logo"),
        expiresAt: payload.expiresAt,
        checkBy: new Date(payload.exp * 1000).toISOString(),
        products: payload.products?.length ? payload.products : ["rental"],
        hasPassword: get("license_has_password") === "1",
        plan: payload.plan ?? null,
        maxEquipment: payload.maxEquipment ?? null,
        expired: !c.ok || lapsed,
      };
    }
    return { state: "needed", message: c.reason === "expired" ? CHECK_IN : lastMessage };
  }

  /** null = no answer (no internet) */
  /** null = مفيش رد (مفيش نت، أو السيرفر اتأخر أكتر من timeoutMs) — عمره ما بيعلّق للأبد. */
  async function call<T extends { ok: boolean }>(body: Record<string, unknown>, timeoutMs = 15_000, url = o.url): Promise<T | null> {
    const ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<null>((resolve) => {
      timer = setTimeout(() => {
        ctrl?.abort();
        resolve(null);
      }, timeoutMs);
    });
    const request = (async () => {
      try {
        const res = await doFetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${o.anonKey}`, apikey: o.anonKey },
          body: JSON.stringify({ deviceId: o.deviceId, ...body }),
          ...(ctrl ? { signal: ctrl.signal } : {}),
        });
        const answer = (await res.json()) as T;
        return answer && typeof answer.ok === "boolean" ? answer : null;
      } catch {
        return null;
      }
    })();
    try {
      return await Promise.race([request, timeout]);
    } finally {
      clearTimeout(timer);
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
    const problem = await acceptAnswer(key, a);
    if (!problem && resetPending) {
      resetPending = false;
      o.onDataReset?.();
    }
    return problem;
  }

  async function acceptAnswer(key: string, a: ServerAnswer & { ok: true }): Promise<string> {
    const c = checkToken(a.token, o.deviceId, now(), o.publicKey ?? LICENSE_PUBLIC_KEY);
    if (!c.ok) return "حصلت مشكلة في التفعيل — جرّب تاني";
    // one device holds one company's data: a code of another company would mix the two
    const before = get("license_lic");
    // (لو الجهاز فاضي — مفيش عليه عقود ولا أصحاب معدات ولا عملاء — يقبل عادي)
    if (before && Number(before) !== c.payload.lic && hasData()) return OTHER_COMPANY;
    set("license_lic", String(c.payload.lic));
    set("license_key", key);
    set("license_token", a.token);
    set("license_lapsed", null);
    // الباقة (من التوكن الموقّع): الحد بيتشيك عليه وانت بتضيف معدة
    set("plan_key", c.payload.plan ?? null);
    set("plan_max_equipment", c.payload.maxEquipment != null ? String(c.payload.maxEquipment) : null);
    set("license_has_password", a.hasPassword ? "1" : null);
    if (!a.hasPassword) rememberPassword(null);
    // التصفير: الجهاز بيقارن رقم "نسخة البيانات" باللي عنده (أول مرة بيحفظه بس)
    if (a.dataEpoch != null) {
      const prev = get("data_epoch");
      set("data_epoch", String(a.dataEpoch));
      if (prev != null && Number(prev) !== a.dataEpoch) resetPending = true;
    }
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
    // الباسورد اتكتب صح على الجهاز ده قبل كده: يفتح على طول، والسيرفر
    // بيتأكد في الخلفية (لو الباسورد اتغير، المرة الجاية لازم الجديد)
    if (matchesRemembered(password) === true) {
      call<PlainAnswer>({ action: "checkPassword", key, password }, 8_000).then((a) => {
        if (a && !a.ok && a.error === "wrong_password") rememberPassword(null);
        else if (a?.ok) set("license_has_password", a.hasPassword ? "1" : null);
      });
      return { ok: true };
    }
    const a = await call<PlainAnswer>({ action: "checkPassword", key, password }, 8_000);
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
    for (const k of ["license_token", "license_lapsed", "license_key", "license_lic", "license_has_password", "license_password_hash", "brand_logo", "brand_logo_url"]) set(k, null);
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
    else if (a && a.error === "expired" && get("license_token")) {
      // الاشتراك خلص: التوكن بيفضل (عشان البيانات تتعرض) والبرنامج بيبقى قراية بس
      set("license_lapsed", a.expiresAt ?? "1");
    } else if (a && FINAL.has(a.error)) {
      set("license_token", null);
      set("license_lapsed", null);
      lastMessage = MESSAGES[a.error](a);
    }
    return status();
  }

  /** صورة السركي الورقي ← Claude يقراها (على السيرفر). مش بيسجل حاجة. */
  async function readSarki(r: ReadRequest): Promise<ReadResult> {
    const key = get("license_key");
    if (!key) return { ok: false, message: "البرنامج مش متفعّل" };
    const a = await call<{ ok: true; sheet: unknown } | { ok: false; error: string }>(
      { key, image: r.image, mediaType: r.mediaType, month: r.month, hint: r.hint },
      150_000,
      o.url.replace(/\/license$/, "/sarki-read"),
    );
    if (!a) return { ok: false, message: OFFLINE };
    if (!a.ok) return { ok: false, message: READ_ERRORS[a.error] ?? READ_ERRORS.server };
    const days = r.month ? new Date(Date.UTC(+r.month.slice(0, 4), +r.month.slice(5, 7), 0)).getUTCDate() : 31;
    return { ok: true, sheet: cleanSheet(a.sheet, days) };
  }

  /** "صفّر البرنامج": السيرفر بياخد نسخة من داتا الشركة ويمسحها، وكل أجهزتها بتبدأ من الأول. */
  async function resetCompany(password: string): Promise<PasswordResult> {
    const key = get("license_key");
    if (!key) return { ok: false, message: "البرنامج مش متفعّل" };
    if (!password) return { ok: false, message: "اكتب باسورد الشركة" };
    const a = await call<{ ok: true; dataEpoch: number } | { ok: false; error: string }>({ action: "reset", key, password }, 60_000);
    if (!a) return { ok: false, message: OFFLINE };
    if (!a.ok)
      return {
        ok: false,
        message:
          a.error === "password_needed"
            ? "لازم الشركة يكون ليها باسورد الأول — اعمله من الإعدادات (باسورد الشركة) وارجع صفّر"
            : a.error === "wrong_password"
              ? WRONG_PASSWORD
              : (MESSAGES[a.error]?.(a as ServerAnswer & { ok: false }) ?? "حصلت مشكلة على السيرفر — جرّب تاني"),
      };
    set("data_epoch", String(a.dataEpoch));
    return { ok: true };
  }

  /** المساعد: الكلام + الأسماء الموجودة ← السيرفر يرجّع رد وقايمة أفعال. مش بيسجل حاجة. */
  async function askAssistant(r: AssistantRequest): Promise<AssistantReply> {
    const key = get("license_key");
    if (!key) return { ok: false, message: "البرنامج مش متفعّل" };
    const a = await call<{ ok: true; reply: string; actions: unknown[] } | { ok: false; error: string }>(
      { key, text: r.text, context: r.context, history: r.history ?? [], image: r.image, mediaType: r.mediaType },
      120_000,
      o.url.replace(/\/license$/, "/assistant"),
    );
    if (!a) return { ok: false, message: OFFLINE };
    if (!a.ok) return { ok: false, message: ASSISTANT_ERRORS[a.error] ?? READ_ERRORS[a.error] ?? READ_ERRORS.server };
    return { ok: true, reply: String(a.reply ?? ""), actions: Array.isArray(a.actions) ? (a.actions as AssistantAction[]) : [] };
  }

  return { status, activate, refresh, credentials, setPassword, checkPassword, signOut, readSarki, askAssistant, resetCompany, savedKey: () => get("license_key") };
}

export type LicenseManager = ReturnType<typeof createLicenseManager>;
