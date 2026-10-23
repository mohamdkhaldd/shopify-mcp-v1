import path from "node:path";
import fs from "node:fs";
import { app } from "electron";
import Database from "better-sqlite3";
import { setupDatabase } from "../core/schema";
import { Db } from "../core/db";

// Its own file in its own folder: productName differs from the old app
// ("حسابات البنيان" → al-bunyan.db), so the two never share data.
export const DB_FILE = "albunyan-rental.db";

export function dbPath() {
  return path.join(app.getPath("userData"), DB_FILE);
}

export function openDatabase(file = dbPath()): { raw: Database.Database; db: Db } {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const raw = new Database(file);
  raw.pragma("journal_mode = WAL");
  const db = setupDatabase(raw as unknown as Db);
  return { raw, db };
}
