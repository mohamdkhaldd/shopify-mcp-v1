import { describe, expect, it } from "vitest";
import { freshDb, egp } from "./helpers";
import { newContract } from "../core/services/master";
import { fillRange } from "../core/services/sarki";
import { recordCapital, recordClientPayment, recordSupplierDeduction, recordSupplierPayment } from "../core/services/ledger";
import { clientsView, suppliersView } from "../core/services/views";

// الدفعة "عن شهر كذا" بتسدد الشهر ده؛ ومن غير شهر بتسدد الأقدم الأول —
// وكل شهر بيقول اتدفع كله ولا ناقص كام، ومن أنهي دفعة.
describe("a payment for a chosen month", () => {
  const setup = () => {
    const db = freshDb();
    const id = newContract(db, {
      client: { kind: "individual", name: "م. حسام" },
      equipment: { name: "بوكيت", supplier: { name: "الحاج سيد" } },
      unit: "day",
      clientRatePt: egp(3000),
      supplierRatePt: egp(2000),
      startDate: "2026-08-01",
    }) as number;
    fillRange(db, id, "client", "2026-08-01", "2026-08-10", {}); // أغسطس: 30,000 / 20,000
    fillRange(db, id, "client", "2026-09-01", "2026-09-10", {}); // سبتمبر: 30,000 / 20,000
    fillRange(db, id, "client", "2026-10-01", "2026-10-10", {}); // أكتوبر: 30,000 / 20,000
    recordCapital(db, { investorId: db.prepare("INSERT INTO investors (name) VALUES ('م')").run().lastInsertRowid as number, kind: "deposit", date: "2026-08-01", amountPt: egp(500_000) });
    const clientId = (db.prepare("SELECT id FROM clients").get() as { id: number }).id;
    const supplierId = (db.prepare("SELECT id FROM suppliers").get() as { id: number }).id;
    return { db, clientId, supplierId };
  };
  const rows = (months: { month: string; duePt: number; paidPt: number; openPt: number }[]) => months.map((m) => [m.month, m.duePt / 100, m.paidPt / 100, m.openPt / 100]);

  it("client: chosen month first, the rest pays the oldest", () => {
    const { db, clientId } = setup();
    recordClientPayment(db, { clientId, date: "2026-11-01", amountPt: egp(30_000), forMonth: "2026-10" });
    recordClientPayment(db, { clientId, date: "2026-11-02", amountPt: egp(40_000) });
    const s = clientsView(db, clientId, "2026-11-05").selected!;
    expect(rows(s.byMonth.months)).toEqual([
      ["2026-08", 30000, 30000, 0],
      ["2026-09", 30000, 10000, 20000],
      ["2026-10", 30000, 30000, 0],
    ]);
    expect(s.byMonth.months[1].covered.map((c) => [c.date, c.amountPt / 100])).toEqual([["2026-11-02", 10000]]);
    expect(s.payments.map((p) => p.forMonth)).toEqual(["2026-10", null]);
  });

  it("supplier: deductions count on their month, payments by choice or oldest first", () => {
    const { db, supplierId } = setup();
    recordSupplierDeduction(db, { supplierId, date: "2026-09-05", amountPt: egp(5_000), note: "سولار" });
    recordSupplierPayment(db, { supplierId, date: "2026-11-01", amountPt: egp(20_000), forMonth: "2026-10" });
    recordSupplierPayment(db, { supplierId, date: "2026-11-02", amountPt: egp(25_000) });
    const s = suppliersView(db, supplierId, "2026-11-05").selected!;
    expect(rows(s.byMonth.months)).toEqual([
      ["2026-08", 20000, 20000, 0],
      ["2026-09", 20000, 10000, 10000],
      ["2026-10", 20000, 20000, 0],
    ]);
    expect(s.totals.remainingPt).toBe(egp(10_000));
  });
});

describe("statement rows follow the 'for month', not the payment date", () => {
  it("a payment made in November for September shows under September", () => {
    const db = freshDb();
    const id = newContract(db, {
      client: { kind: "individual", name: "م" },
      equipment: { name: "بوكيت", supplier: { name: "ص" } },
      unit: "day",
      clientRatePt: egp(3000),
      supplierRatePt: egp(2000),
      startDate: "2026-09-01",
    }) as number;
    fillRange(db, id, "client", "2026-09-01", "2026-09-10", {});
    fillRange(db, id, "client", "2026-10-01", "2026-10-10", {});
    const clientId = (db.prepare("SELECT id FROM clients").get() as { id: number }).id;
    const supplierId = (db.prepare("SELECT id FROM suppliers").get() as { id: number }).id;
    recordCapital(db, { investorId: db.prepare("INSERT INTO investors (name) VALUES ('م')").run().lastInsertRowid as number, kind: "deposit", date: "2026-09-01", amountPt: egp(500_000) });
    recordClientPayment(db, { clientId, date: "2026-11-02", amountPt: egp(30_000), forMonth: "2026-10" });
    recordSupplierPayment(db, { supplierId, date: "2026-11-03", amountPt: egp(20_000), forMonth: "2026-10" });
    const c = clientsView(db, clientId, "2026-11-05").selected!;
    expect(c.rows.map((r) => [r.month, r.paidPt / 100])).toEqual([["2026-09", 0], ["2026-10", 30000]]);
    const s = suppliersView(db, supplierId, "2026-11-05").selected!;
    expect(s.rows.map((r) => [r.month, r.paidPt / 100])).toEqual([["2026-09", 0], ["2026-10", 20000]]);
    expect(s.totals.paidPt).toBe(egp(20_000));
  });
});

import { dashboardView } from "../core/services/views";
describe("dashboard month picker", () => {
  it("picking an old month still lists every month up to today", () => {
    const db = freshDb();
    const id = newContract(db, {
      client: { kind: "individual", name: "م" },
      equipment: { name: "بوكيت", supplier: { name: "ص" } },
      unit: "day",
      clientRatePt: egp(3000),
      supplierRatePt: egp(2000),
      startDate: "2026-08-01",
    }) as number;
    fillRange(db, id, "client", "2026-08-01", "2026-08-10", {});
    const v = dashboardView(db, "2026-08", "2026-11-05");
    expect(v.month).toBe("2026-08");
    expect(v.months.map((m) => m.month)).toEqual(["2026-08", "2026-09", "2026-10", "2026-11"]);
  });
});
