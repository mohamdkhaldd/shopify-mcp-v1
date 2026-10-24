import type { Db } from "../db";

/** Changes made on this device that haven't reached the cloud yet (either program's database). */
export function unsyncedChanges(db: Db) {
  const has = (t: string) => !!db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(t);
  return ["sync_outbox", "sync_deferred"].reduce((n, t) => n + (has(t) ? (db.prepare(`SELECT COUNT(*) AS c FROM ${t}`).get() as { c: number }).c : 0), 0);
}
