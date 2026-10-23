import { describe, expect, it } from "vitest";
import initSqlJs from "sql.js";
import { setupDatabase } from "../core/schema";
import { seedDemo } from "../core/demo";
import { computeBooks } from "../core/services/books";
import { createDatabase } from "../tablet/sqlAdapter";
import { egp } from "./helpers";

describe("the tablet's saved database file", () => {
  it("reopens with the same books and the same protections", async () => {
    const SQL = await initSqlJs();
    const first = createDatabase(SQL);
    setupDatabase(first);
    seedDemo(first);
    const before = computeBooks(first, "2026-10-31").treasury;
    const file = first.exportIfDirty()!;
    expect(file).toBeInstanceOf(Uint8Array);
    expect(first.exportIfDirty()).toBeNull(); // nothing changed since the save

    const reopened = createDatabase(SQL, file);
    setupDatabase(reopened);
    expect(computeBooks(reopened, "2026-10-31").treasury).toEqual(before);
    expect(before.balancePt).toBe(egp(97_050));
    // financial rows still can't be edited or deleted after a reopen
    expect(() => reopened.prepare("UPDATE client_payments SET amount_pt = 1").run()).toThrow();
    expect(() => reopened.prepare("DELETE FROM client_payments").run()).toThrow();
    // and foreign keys are back on after the export
    expect(reopened.prepare("PRAGMA foreign_keys").get()).toEqual({ foreign_keys: 1 });
    expect(first.prepare("PRAGMA foreign_keys").get()).toEqual({ foreign_keys: 1 });
  });
});
