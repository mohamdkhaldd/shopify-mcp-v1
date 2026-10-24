import type { Db } from "../db";
import { pbkdf2 } from "@noble/hashes/pbkdf2";
import { sha256 } from "@noble/hashes/sha256";
import { bytesToHex, hexToBytes, randomBytes } from "@noble/hashes/utils";

// An optional password on this device, set by the customer in Settings. With
// one, MK-Tech opens on the password page, and "خروج" in either program goes
// back to it. Kept in app_settings next to the activation (never synced);
// forgetting it is fixed with the activation code.
//
// Opening a program restarts the app (laptop) or the page (tablet / web), so
// the chooser hands the new start a one-time pass instead of asking again.

const PASSWORD = "shell_password";
const PASS = "shell_pass";
const ROUNDS = 60_000;
const PASS_LIFETIME_MS = 2 * 60 * 1000;

type Stored = { salt: string; hash: string; rounds: number };

const hash = (password: string, salt: Uint8Array, rounds: number) => bytesToHex(pbkdf2(sha256, password, salt, { c: rounds, dkLen: 32 }));
const normalizeKey = (k: string) => k.toUpperCase().replace(/[^A-Z0-9]/g, "");

export function createLock(o: { db: Db; savedKey: () => string | null; now?: () => number }) {
  const now = o.now ?? Date.now;
  const get = (k: string) => (o.db.prepare("SELECT value FROM app_settings WHERE key = ?").get(k) as { value: string } | undefined)?.value ?? null;
  const set = (k: string, v: string | null) =>
    v === null
      ? o.db.prepare("DELETE FROM app_settings WHERE key = ?").run(k)
      : o.db.prepare("INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(k, v);
  const stored = (): Stored | null => {
    const v = get(PASSWORD);
    return v ? (JSON.parse(v) as Stored) : null;
  };

  const hasPassword = () => stored() !== null;
  const check = (password: string) => {
    const s = stored();
    return !s || hash(password, hexToBytes(s.salt), s.rounds) === s.hash;
  };

  /** Set, change (needs the current one) or remove (next = "") the password. */
  function setPassword(current: string, next: string): { ok: true } | { ok: false; message: string } {
    if (hasPassword() && !check(current)) return { ok: false, message: "الباسورد الحالي غلط" };
    if (!next) {
      set(PASSWORD, null);
      return { ok: true };
    }
    if (next.length < 4) return { ok: false, message: "الباسورد لازم يبقى ٤ حروف أو أرقام على الأقل" };
    const salt = randomBytes(16);
    set(PASSWORD, JSON.stringify({ salt: bytesToHex(salt), hash: hash(next, salt, ROUNDS), rounds: ROUNDS } satisfies Stored));
    return { ok: true };
  }

  /** Forgot it: the activation code this device was activated with removes it. */
  function resetWithCode(code: string) {
    const key = o.savedKey();
    if (!key || normalizeKey(code) !== normalizeKey(key)) return false;
    set(PASSWORD, null);
    return true;
  }

  /** One-time pass for the next start (opening a program). */
  function issuePass() {
    const pass = bytesToHex(randomBytes(16));
    set(PASS, JSON.stringify({ pass, at: now() }));
    return pass;
  }
  function takePass(pass: string | null | undefined) {
    const v = get(PASS);
    set(PASS, null);
    if (!pass || !v) return false;
    const s = JSON.parse(v) as { pass: string; at: number };
    return s.pass === pass && now() - s.at < PASS_LIFETIME_MS;
  }

  return { hasPassword, check, setPassword, resetWithCode, issuePass, takePass };
}

export type Lock = ReturnType<typeof createLock>;
