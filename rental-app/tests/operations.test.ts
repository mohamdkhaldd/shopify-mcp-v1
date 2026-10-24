import { afterEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { fakeCloud } from "./fakeCloud";
import { migrateLegacyOperations, setupOperationsDatabase } from "../electron/operationsDb";
import { createSyncEngine } from "../operations/electron/syncEngine.js";
import { setupDatabase as oldSetupDatabase } from "../operations/electron/schema.js";

// التشغيل inside MK-Tech: a new customer starts clean, and a computer that ran
// the old app ("حسابات البنيان") brings its data along to the new cloud.

const engines: { stop(): void }[] = [];
afterEach(() => engines.splice(0).forEach((e) => e.stop()));

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "mk-ops-"));
const count = (db: Database.Database, t: string) => (db.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get() as { n: number }).n;

async function device(db: Database.Database, cloud: ReturnType<typeof fakeCloud>, name: string) {
  const e = createSyncEngine({ db, createClient: cloud.createClient, supabaseUrl: "x", supabaseKey: "x", email: "x", defaultDeviceName: name, logger: { error() {}, warn() {} } });
  engines.push(e);
  e.setup();
  await e.start();
  return e;
}

describe("التشغيل for a new customer", () => {
  it("starts without the old app's company data, with the treasury accounts", () => {
    const db = setupOperationsDatabase(new Database(":memory:"));
    for (const t of ["partners", "equipment", "employees", "contractors", "expense_categories"]) expect(count(db, t)).toBe(0);
    expect((db.prepare("SELECT name FROM treasury_accounts ORDER BY name").all() as { name: string }[]).map((r) => r.name)).toEqual(["cash", "instapay", "vodafone_cash", "wallet"]);
    // opening again adds nothing
    setupOperationsDatabase(db);
    expect(count(db, "treasury_accounts")).toBe(4);
    // the commission person's name: typed by the company in Settings
    expect(count(db, "app_settings")).toBe(0);
  });
});

describe("moving the old app's data into MK-Tech", () => {
  it("copies everything, forgets the old cloud, and syncs it all into the customer's new space", async () => {
    const dir = tmp();
    const legacyFile = path.join(dir, "al-bunyan.db");
    const target = path.join(dir, "mk-operations.db");

    // the old app on the client's laptop: its data, synced with the old cloud,
    // plus a change it hadn't sent yet
    const oldCloud = fakeCloud();
    const legacy = oldSetupDatabase(new Database(legacyFile));
    legacy.pragma("journal_mode = WAL");
    const oldEngine = await device(legacy, oldCloud, "اللاب");
    await oldEngine.syncNow();
    oldEngine.stop();
    legacy.prepare("INSERT INTO partners (name) VALUES ('شريك جديد')").run();
    legacy.prepare("INSERT INTO sync_state (key, value) VALUES ('auth:albunyan-sync', 'old-session') ON CONFLICT(key) DO UPDATE SET value = excluded.value").run();
    const partners = count(legacy, "partners");
    const equipment = count(legacy, "equipment");
    expect(partners).toBeGreaterThan(1);
    expect(count(legacy, "sync_outbox")).toBeGreaterThan(0);
    legacy.close();

    expect(await migrateLegacyOperations(target, legacyFile)).toBe(true);
    // done once: the next start keeps the copy as it is
    expect(await migrateLegacyOperations(target, legacyFile)).toBe(false);

    // straight after the copy: nothing left of the old cloud
    const copied = new Database(target);
    expect(copied.prepare("SELECT key FROM sync_state WHERE key LIKE 'auth:%' OR key IN ('gid_ready', 'last_seq')").all()).toEqual([]);
    expect(count(copied, "sync_outbox")).toBe(0);
    expect(copied.prepare("SELECT value FROM app_settings WHERE key = 'commission_name'").get()).toEqual({ value: "حسن" });
    const laptop = setupOperationsDatabase(copied);
    expect(count(laptop, "partners")).toBe(partners);
    expect(count(laptop, "equipment")).toBe(equipment);
    // the old app's own file is untouched
    const still = new Database(legacyFile, { readonly: true });
    expect(still.prepare("SELECT value FROM sync_state WHERE key = 'gid_ready'").get()).toEqual({ value: "1" });
    still.close();

    // first start on the new cloud: everything goes up once
    const newCloud = fakeCloud();
    const a = await device(laptop, newCloud, "اللاب");
    await a.syncNow();
    const inCloud = (t: string) => [...newCloud.rows.values()].filter((r) => r.tbl === t && !r.deleted).length;
    expect(inCloud("partners")).toBe(partners);
    expect(inCloud("equipment")).toBe(equipment);

    // the customer's tablet, empty, gets the same data — no duplicate accounts
    const tablet = setupOperationsDatabase(new Database(":memory:"));
    const b = await device(tablet, newCloud, "التابلت");
    await b.syncNow();
    expect(count(tablet, "partners")).toBe(partners);
    expect(count(tablet, "equipment")).toBe(equipment);
    expect(count(tablet, "treasury_accounts")).toBe(4);
    expect(tablet.prepare("SELECT name FROM partners WHERE name = 'شريك جديد'").get()).toEqual({ name: "شريك جديد" });
    expect(tablet.prepare("SELECT value FROM app_settings WHERE key = 'commission_name'").get()).toEqual({ value: "حسن" });

    // renamed on the tablet → the laptop shows the new name
    tablet.prepare("UPDATE app_settings SET value = 'أحمد' WHERE key = 'commission_name'").run();
    await b.syncNow();
    await a.syncNow();
    expect(laptop.prepare("SELECT value FROM app_settings WHERE key = 'commission_name'").get()).toEqual({ value: "أحمد" });
  });

  it("does nothing on a computer that never had the old app", async () => {
    const dir = tmp();
    expect(await migrateLegacyOperations(path.join(dir, "mk-operations.db"), path.join(dir, "missing.db"))).toBe(false);
    expect(fs.existsSync(path.join(dir, "mk-operations.db"))).toBe(false);
  });
});
