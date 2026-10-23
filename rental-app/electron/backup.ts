import path from "node:path";
import fs from "node:fs";
import { app } from "electron";
import type Database from "better-sqlite3";

// Automatic daily backup (new — the old app had none) plus manual backup/restore.
const KEEP_DAYS = 30;

export function backupsDir() {
  return path.join(app.getPath("userData"), "backups");
}

const stamp = () => new Date().toLocaleDateString("en-CA");

/** Once per day, on start-up and every few hours while open. */
export async function dailyBackup(raw: Database.Database) {
  const dir = backupsDir();
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `albunyan-rental-${stamp()}.db`);
  if (!fs.existsSync(file)) await raw.backup(file);
  const old = fs
    .readdirSync(dir)
    .filter((f) => /^albunyan-rental-\d{4}-\d{2}-\d{2}\.db$/.test(f))
    .sort()
    .reverse()
    .slice(KEEP_DAYS);
  for (const f of old) fs.rmSync(path.join(dir, f), { force: true });
  return file;
}

export async function backupTo(raw: Database.Database, file: string) {
  await raw.backup(file);
  return file;
}

export function lastBackup(): { file: string; at: string } | null {
  const dir = backupsDir();
  if (!fs.existsSync(dir)) return null;
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".db")).sort();
  const last = files[files.length - 1];
  if (!last) return null;
  return { file: path.join(dir, last), at: fs.statSync(path.join(dir, last)).mtime.toISOString() };
}

/** Checks the file really is a rental database before it replaces the live one. */
export function looksLikeRentalDb(file: string, open: (f: string) => Database.Database) {
  const probe = open(file);
  try {
    const t = probe.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('contracts', 'work_logs', 'treasury_entries')").all();
    return t.length === 3;
  } finally {
    probe.close();
  }
}
