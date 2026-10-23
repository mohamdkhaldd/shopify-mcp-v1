import Database from "better-sqlite3";
import initSqlJs from "sql.js";
import { setupDatabase } from "../core/schema";
import { Db } from "../core/db";
import { createDatabase } from "../tablet/sqlAdapter";

// TEST_DB=sqljs runs every test on the tablet's database engine (sql.js
// through tablet/sqlAdapter.ts) instead of the laptop's better-sqlite3.
const SQL = process.env.TEST_DB === "sqljs" ? await initSqlJs() : null;

export function freshDb(): Db {
  if (SQL) return setupDatabase(createDatabase(SQL));
  const db = new Database(":memory:");
  return setupDatabase(db as unknown as Db);
}

/** pounds → piasters, for readable test data */
export const egp = (pounds: number) => Math.round(pounds * 100);
