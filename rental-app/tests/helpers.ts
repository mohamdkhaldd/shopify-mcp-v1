import Database from "better-sqlite3";
import { setupDatabase } from "../core/schema";
import { Db } from "../core/db";

export function freshDb(): Db {
  const db = new Database(":memory:");
  return setupDatabase(db as unknown as Db);
}

/** pounds → piasters, for readable test data */
export const egp = (pounds: number) => Math.round(pounds * 100);
