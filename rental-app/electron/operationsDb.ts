import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
// The operations program (التشغيل): the old accounting app's backend, unchanged
// apart from its cloud login (operations/electron/). No Electron here, so the
// tests can use it.
const { setupDatabase } = require("../operations/electron/schema.js");

export const OPERATIONS_DB = "mk-operations.db";

/**
 * The first time التشغيل opens on a computer that had the old app, its data is
 * copied over (the old app's own file is left untouched). The copy then starts
 * syncing in the customer's own space on the new cloud.
 */
export async function migrateLegacyOperations(target: string, legacy: string): Promise<boolean> {
  // once per computer: after signing out (which removes the copy) the data
  // comes back from the cloud, never again from the old app
  const marker = path.join(path.dirname(target), "mk-operations.migrated");
  if (fs.existsSync(target) || fs.existsSync(marker) || !fs.existsSync(legacy)) return false;
  const src = new Database(legacy, { readonly: true, fileMustExist: true });
  try {
    await src.backup(target);
  } finally {
    src.close();
  }
  const db = new Database(target);
  try {
    // the old app was one company's own, its commission page was "حسن"; in
    // MK-Tech each company types the name in Settings — this one keeps its
    setupOperationsDatabase(db);
    db.prepare("INSERT OR IGNORE INTO app_settings (key, value) VALUES ('commission_name', 'حسن')").run();
    resetSyncForNewCloud(db);
  } finally {
    db.close();
  }
  fs.writeFileSync(marker, new Date().toISOString());
  return true;
}


/**
 * Forget everything the copied file knew about the old cloud (its login, how
 * far it had read, what it was about to send): on the new cloud it sends all
 * its rows once, as the first device of this customer's space. Row ids (gid)
 * stay, so the customer's other devices merge into the same rows.
 */
export function resetSyncForNewCloud(db: Database.Database) {
  const has = (t: string) => !!db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(t);
  if (has("sync_state")) db.exec("DELETE FROM sync_state WHERE key LIKE 'auth:%' OR key IN ('last_seq', 'last_log_id', 'gid_ready', 'known_tables')");
  for (const t of ["sync_outbox", "sync_deferred", "sync_rowtime"]) if (has(t)) db.exec(`DELETE FROM ${t}`);
}

/**
 * The tables, without the old app's starting data (that was one company's own
 * partners, machines and staff); only the treasury accounts every company has.
 * They're unique by name, so two devices creating them merge on sync.
 */
export function setupOperationsDatabase(db: Database.Database) {
  setupDatabase(db, { seed: false });
  const add = db.prepare("INSERT OR IGNORE INTO treasury_accounts (name, current_balance) VALUES (?, 0)");
  for (const name of ["wallet", "instapay", "cash", "vodafone_cash"]) add.run(name);
  return db;
}
