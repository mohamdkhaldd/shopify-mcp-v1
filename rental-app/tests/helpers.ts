import Database from "better-sqlite3";
import initSqlJs from "sql.js";
import { setupDatabase } from "../core/schema";
import { Db } from "../core/db";
import { createDatabase } from "../tablet/sqlAdapter";

// TEST_DB=sqljs runs every test on the tablet's database engine (sql.js
// through tablet/sqlAdapter.ts) instead of the laptop's better-sqlite3.
const SQL = process.env.TEST_DB === "sqljs" ? await initSqlJs() : null;

/**
 * A new database. The program's tax is 3% withholding from day one; most
 * tests below were written with worked numbers on the older 5%-of-margin
 * rule, so by default they run on it (the engine still supports it).
 * `freshDb({ withholding: true })` = the program as it ships.
 */
export function freshDb(o: { withholding?: boolean } = {}): Db {
  const db = SQL ? setupDatabase(createDatabase(SQL)) : setupDatabase(new Database(":memory:") as unknown as Db);
  if (!o.withholding) db.prepare("UPDATE withholding_rates SET effective_from = '2999-01-' || printf('%02d', id)").run();
  return db;
}

/** pounds → piasters, for readable test data */
export const egp = (pounds: number) => Math.round(pounds * 100);
