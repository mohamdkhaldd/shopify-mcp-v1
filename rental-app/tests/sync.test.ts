import { afterEach, describe, expect, it } from "vitest";
import { freshDb, egp } from "./helpers";
import { Db } from "../core/db";
import { seedDemo } from "../core/demo";
import { createSyncEngine, SyncEngine } from "../core/sync/syncEngine";
import { computeBooks } from "../core/services/books";
import { dashboardView } from "../core/services/views";
import { getSheet, upsertDay } from "../core/services/sarki";
import { recordClientPayment, reverse } from "../core/services/ledger";
import { deleteEntity } from "../core/services/deletion";
import { runAction, undoAction } from "../core/services/activity";
import { setupDatabase } from "../core/schema";

// A fake Supabase with the same sync_rows rules as the real project
// (older edits never overwrite newer ones, every write gets the next seq).
function fakeCloud() {
  const rows = new Map<string, any>();
  let seq = 0;
  const log: any[] = [];
  const query = (table: string) => {
    const filters: ((r: any) => boolean)[] = [];
    let lim = 1e9;
    const q: any = {
      select: () => q,
      in: (c: string, vals: any[]) => (filters.push((r) => vals.includes(r[c])), q),
      gt: (c: string, v: any) => (filters.push((r) => r[c] > v), q),
      order: () => q,
      limit: (n: number) => ((lim = n), q),
      then: (res: any) => {
        const src = table === "sync_rows" ? [...rows.values()].sort((a, b) => a.seq - b.seq) : log;
        res({ data: src.filter((r) => filters.every((f) => f(r))).slice(0, lim).map((r) => structuredClone(r)), error: null });
      },
      upsert: async (records: any[]) => {
        for (const rec of records) {
          const key = `${rec.tbl}|${rec.gid}`;
          const old = rows.get(key);
          if (old && Date.parse(rec.updated_at) < Date.parse(old.updated_at)) continue;
          rows.set(key, { ...structuredClone(rec), seq: ++seq });
        }
        return { error: null };
      },
    };
    return q;
  };
  const signedIn: { email?: string; logins: string[] } = { email: "rental@elbonyan.app", logins: [] };
  return {
    rows,
    signedIn,
    createClient: () => ({
      auth: {
        getSession: async () => ({ data: { session: { user: { email: signedIn.email } } }, error: null }),
        signInWithPassword: async ({ email }: { email: string }) => ((signedIn.email = email), signedIn.logins.push(email), { error: null }),
        signOut: async () => ((signedIn.email = undefined), { error: null }),
        refreshSession: async () => ({ error: null }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      },
      from: (t: string) => query(t),
      channel: () => ({ on() { return this; }, subscribe() { return this; } }),
    }),
  };
}

const engines: SyncEngine[] = [];
afterEach(() => engines.splice(0).forEach((e) => e.stop()));

async function device(db: Db, cloud: ReturnType<typeof fakeCloud>, name: string) {
  const e = createSyncEngine({ db, createClient: cloud.createClient, supabaseUrl: "x", supabaseKey: "x", email: "x", defaultDeviceName: name, logger: { error() {}, warn() {} } });
  engines.push(e);
  await e.start();
  return e;
}

describe("sync between the laptop and the tablet", () => {
  it("a full copy arrives with every link intact, and edits go both ways", async () => {
    const cloud = fakeCloud();
    const laptop = freshDb();
    const ids = seedDemo(laptop);
    const tablet = freshDb();
    const a = await device(laptop, cloud, "اللاب");
    const b = await device(tablet, cloud, "التابلت");
    await a.syncNow();
    await b.syncNow();

    const view = (db: Db) => dashboardView(db, "2026-10", "2026-10-31");
    expect(view(tablet).kpis).toEqual(view(laptop).kpis);
    expect(computeBooks(tablet, "2026-10-31").treasury).toEqual({ balancePt: egp(97_050), taxHeldPt: egp(7_050), profitsDuePt: egp(6_500), availablePt: egp(83_500) });
    // treasury entries still point at their own payment / party on the tablet
    const t = tablet.prepare("SELECT source_table, source_id, party_kind, party_id FROM treasury_entries WHERE type = 'client_collection'").get();
    expect(tablet.prepare(`SELECT amount_pt FROM ${t.source_table} WHERE id = ?`).get(t.source_id).amount_pt).toBe(egp(51_300));
    expect(tablet.prepare("SELECT name FROM clients WHERE id = ?").get(t.party_id).name).toBe("شركة الأمل للمقاولات");

    // tablet: overtime on day 3 + a payment → laptop sees both
    const tc = tablet.prepare("SELECT id FROM contracts").get().id;
    upsertDay(tablet, tc, "2026-10-03", "client", { actualHoursMilli: 10_000 });
    const tAmal = tablet.prepare("SELECT id FROM clients WHERE name = 'شركة الأمل للمقاولات'").get().id;
    recordClientPayment(tablet, { clientId: tAmal, date: "2026-10-25", amountPt: egp(10_000) });
    await b.syncNow();
    await a.syncNow();
    expect(getSheet(laptop, ids.contract, "2026-10", "supplier").totals.overtimeMilli).toBe(2000);
    expect(view(laptop).kpis).toEqual(view(tablet).kpis);
    expect(view(laptop).kpis.receivablesPt).toBe(egp(51_300 + 750 * 1.14 - 10_000));

    // laptop: cancel that payment (reversal) and delete the expense → tablet follows
    const pay = laptop.prepare("SELECT id FROM client_payments WHERE amount_pt = ?").get(egp(10_000)).id;
    reverse(laptop, "client_payments", pay, "2026-10-26", "اتسجلت مرتين");
    const exp = laptop.prepare("SELECT id FROM expenses").get().id;
    deleteEntity(laptop, "expenses", exp);
    await a.syncNow();
    await b.syncNow();
    expect(view(tablet).kpis).toEqual(view(laptop).kpis);
    expect(computeBooks(tablet, "2026-10-31").months[0].contracts[0].expensesPt).toBe(0);
  });

  it("undo on one device reaches the other", async () => {
    const cloud = fakeCloud();
    const laptop = freshDb();
    const ids = seedDemo(laptop);
    const tablet = freshDb();
    const a = await device(laptop, cloud, "اللاب");
    const b = await device(tablet, cloud, "التابلت");
    await a.syncNow();
    await b.syncNow();
    const { actionId } = runAction(laptop, "دفعة", () => recordClientPayment(laptop, { clientId: ids.amal, date: "2026-10-25", amountPt: egp(5_000) }));
    await a.syncNow();
    await b.syncNow();
    expect(computeBooks(tablet, "2026-10-31").treasury.balancePt).toBe(egp(97_050 + 5_000));
    undoAction(laptop, actionId);
    await a.syncNow();
    await b.syncNow();
    expect(computeBooks(tablet, "2026-10-31").treasury.balancePt).toBe(egp(97_050));
    expect(computeBooks(laptop, "2026-10-31").treasury.balancePt).toBe(egp(97_050));
  });

  it("keeps working after the app restarts (schema set up again over the sync tables)", async () => {
    const cloud = fakeCloud();
    const laptop = freshDb();
    const ids = seedDemo(laptop);
    const tablet = freshDb();
    const a = await device(laptop, cloud, "اللاب");
    const b = await device(tablet, cloud, "التابلت");
    await a.syncNow();
    await b.syncNow();
    a.stop();
    setupDatabase(laptop);
    const a2 = await device(laptop, cloud, "اللاب");
    const { actionId } = runAction(laptop, "دفعة", () => recordClientPayment(laptop, { clientId: ids.amal, date: "2026-10-25", amountPt: egp(1_000) }));
    await a2.syncNow();
    await b.syncNow();
    expect(computeBooks(tablet, "2026-10-31").treasury.balancePt).toBe(egp(98_050));
    undoAction(laptop, actionId);
    await a2.syncNow();
    await b.syncNow();
    expect(computeBooks(tablet, "2026-10-31").treasury.balancePt).toBe(egp(97_050));
    expect(laptop.prepare("SELECT COUNT(*) AS n FROM sync_outbox").get().n).toBe(0);
  });

  it("signs in with the customer's own sync account from the activation", async () => {
    const cloud = fakeCloud();
    const e = await device(freshDb(), cloud, "اللاب");
    await e.ensureLogin({ email: "tenant-7@tenants.albunyan.app", password: "pw" });
    expect(cloud.signedIn).toEqual({ email: "tenant-7@tenants.albunyan.app", logins: ["tenant-7@tenants.albunyan.app"] });
    // already on the right account: no new sign-in
    await e.ensureLogin({ email: "tenant-7@tenants.albunyan.app", password: "pw" });
    expect(cloud.signedIn.logins).toHaveLength(1);
  });
});
