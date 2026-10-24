import type { Db } from "../db";
import { bytesToHex, randomBytes } from "@noble/hashes/utils";

// When the company has a password (core/license), MK-Tech opens on the lock
// screen, and "قفل" in either program goes back to it. Opening a program
// restarts the app (laptop) or the page (tablet / web), so the chooser hands
// the new start a one-time pass instead of asking for the password again.

const PASS = "shell_pass";
const PASS_LIFETIME_MS = 2 * 60 * 1000;

export function createPass(o: { db: Db; now?: () => number }) {
  const now = o.now ?? Date.now;
  const get = () => (o.db.prepare("SELECT value FROM app_settings WHERE key = ?").get(PASS) as { value: string } | undefined)?.value ?? null;
  const set = (v: string | null) =>
    v === null
      ? o.db.prepare("DELETE FROM app_settings WHERE key = ?").run(PASS)
      : o.db.prepare("INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(PASS, v);

  /** One-time pass for the next start (opening a program). */
  function issue() {
    const pass = bytesToHex(randomBytes(16));
    set(JSON.stringify({ pass, at: now() }));
    return pass;
  }
  /** Used up whether it matches or not. */
  function take(pass: string | null | undefined) {
    const v = get();
    set(null);
    if (!pass || !v) return false;
    const s = JSON.parse(v) as { pass: string; at: number };
    return s.pass === pass && now() - s.at < PASS_LIFETIME_MS;
  }

  return { issue, take };
}
