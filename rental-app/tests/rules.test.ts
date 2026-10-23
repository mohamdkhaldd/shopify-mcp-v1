import { describe, expect, it } from "vitest";
import { freshDb, egp } from "./helpers";
import { CashWarning, Db } from "../core/db";
import { distribute } from "../core/calc/distribution";
import { capitalWeight, daysPresent } from "../core/calc/timeWeight";
import { dayValue, sheetTotals, SarkiDay } from "../core/calc/sarki";
import { parsePounds, formatPounds, portion } from "../core/calc/money";
import { allocatePayments } from "../core/calc/collections";
import { createClient, createContract, createEquipment, createInvestor, createSupplier, rateAt, setClientTaxes, setRates } from "../core/services/master";
import { applyOvertime, fillRange, getPartySheet, getSheet, upsertDay } from "../core/services/sarki";
import { recordCapital, recordClientPayment, recordExpense, recordPayout, recordSupplierPayment, reverse } from "../core/services/ledger";
import { computeBooks } from "../core/services/books";
import { closeMonth, recordAdjustment } from "../core/services/close";

const day = (p: Partial<SarkiDay> = {}): SarkiDay => ({ isDayOff: false, actualHoursMilli: null, baseHoursMilli: 8000, dayRatePt: null, overtimeRatePt: null, ...p });

/** A 30-day October contract at the worked example's rates, both sheets filled, no expenses (net 2,850). */
function setup(opts: { kind?: "company" | "individual"; clientRate?: number; supplierRate?: number; unit?: "day" | "month" } = {}) {
  const db = freshDb();
  const a = createInvestor(db, { name: "أ" });
  const b = createInvestor(db, { name: "ب" });
  recordCapital(db, { investorId: a, kind: "deposit", date: "2026-10-01", amountPt: egp(60_000) });
  recordCapital(db, { investorId: b, kind: "deposit", date: "2026-10-01", amountPt: egp(40_000) });
  const supplier = createSupplier(db, { name: "الحاج سيد" });
  const eq = createEquipment(db, { name: "لودر", supplierId: supplier, siteName: "الموقع" });
  const client = createClient(db, { kind: opts.kind ?? "company", name: "شركة الأمل" });
  const contract = createContract(db, {
    clientId: client,
    equipmentId: eq,
    unit: opts.unit ?? "day",
    clientRatePt: egp(opts.clientRate ?? 500),
    supplierRatePt: egp(opts.supplierRate ?? 400),
    startDate: "2026-10-01",
  });
  fillRange(db, contract, "client", "2026-10-01", "2026-10-30", {});
  fillRange(db, contract, "supplier", "2026-10-01", "2026-10-30", {});
  return { db, a, b, supplier, eq, client, contract };
}
const october = (db: Db, asOf = "2026-10-31") => computeBooks(db, asOf).months.find((m) => m.month === "2026-10")!;

describe("money helpers", () => {
  it("parses and formats pounds", () => {
    expect(parsePounds("3,000.5")).toBe(300050);
    expect(parsePounds("٣٠٠٠٫٢٥")).toBe(300025);
    expect(formatPounds(300050)).toBe("3,000.50");
    expect(formatPounds(-150000)).toBe("-1,500");
    expect(() => parsePounds("12.345")).toThrow();
  });
  it("drops only the sub-piaster part, symmetrically for reversals", () => {
    expect(portion(10_000, 1, 3)).toBe(3333);
    expect(portion(-10_000, 1, 3)).toBe(-3333);
  });
});

describe("sarki day rules (same as the old app)", () => {
  it("empty actual hours = a full day, no overtime", () => {
    expect(dayValue(day(), { unit: "day", ratePt: egp(3000) }).toPiasters()).toBe(egp(3000));
  });
  it("overtime = actual − base, priced at day rate ÷ base hours", () => {
    expect(dayValue(day({ actualHoursMilli: 10_000 }), { unit: "day", ratePt: egp(3000) }).toPiasters()).toBe(egp(3750));
  });
  it("explicit overtime rate wins", () => {
    expect(dayValue(day({ actualHoursMilli: 10_000, overtimeRatePt: egp(400) }), { unit: "day", ratePt: egp(3000) }).toPiasters()).toBe(egp(3800));
  });
  it("fewer hours than base don't reduce the day", () => {
    expect(dayValue(day({ actualHoursMilli: 5_000 }), { unit: "day", ratePt: egp(3000) }).toPiasters()).toBe(egp(3000));
  });
  it("a month adds up exact fractions and drops the sub-piaster part once", () => {
    // 2,555/8 per hour × 1 h = 319.375 → each day 2,874.375; 3 days = 8,623.125
    const d = day({ actualHoursMilli: 9_000 });
    const t = sheetTotals([d, d, d], { unit: "day", ratePt: egp(2555) });
    expect(t.totalPt).toBe(862312);
    expect(t.overtimeMilli).toBe(3000);
  });
  it("monthly contracts: monthly rate ÷ 30 × days worked", () => {
    const days = Array.from({ length: 15 }, () => day());
    expect(sheetTotals(days, { unit: "month", ratePt: egp(90_000) }).totalPt).toBe(egp(45_000));
  });
  it("day off needs a reason and counts nothing", () => {
    const { db, contract } = setup();
    expect(() => upsertDay(db, contract, "2026-10-05", "client", { isDayOff: true })).toThrow(/سبب/);
    upsertDay(db, contract, "2026-10-05", "client", { isDayOff: true, note: "عطل" });
    expect(getSheet(db, contract, "2026-10", "client").totals.workedDays).toBe(29);
  });
  it("bulk overtime on '3, 7-8' and the red mismatch flag", () => {
    const { db, contract } = setup();
    applyOvertime(db, contract, "client", "2026-10", "3, 7-8", 2000, null);
    const s = getSheet(db, contract, "2026-10", "client");
    expect(s.totals.overtimeMilli).toBe(6000);
    expect(s.totals.totalPt).toBe(egp(15_000) + 3 * egp(125)); // 500/8 × 2 h = 125
    expect(s.mismatchDays).toBe(3);
  });
});

describe("profit split", () => {
  it("time-weighted: joining on the 16th earns 16 of 31 days", () => {
    const month = "2026-10";
    const wA = capitalWeight([{ date: "2026-10-01", signedPt: egp(60_000) }], month);
    const wB = capitalWeight([{ date: "2026-10-16", signedPt: egp(40_000) }], month);
    expect(daysPresent([{ date: "2026-10-16", signedPt: egp(40_000) }], month)).toBe(16);
    const d = distribute(egp(2_500), 5000, [
      { investorId: 1, weight: wA },
      { investorId: 2, weight: wB },
    ]);
    expect(d.investors.map((x) => x.sharePt)).toEqual([egp(930), egp(320)]);
  });
  it("withdrawal day doesn't count", () => {
    const mv = [
      { date: "2026-10-01", signedPt: egp(1000) },
      { date: "2026-10-11", signedPt: -egp(1000) },
    ];
    expect(daysPresent(mv, "2026-10")).toBe(10);
  });
  it("sub-piaster leftovers go to management", () => {
    const d = distribute(egp(200), 5000, [1, 2, 3].map((id) => ({ investorId: id, weight: 1n })));
    expect(d.investors.map((x) => x.sharePt)).toEqual([3333, 3333, 3333]);
    expect(d.remainderToManagementPt).toBe(1);
    expect(d.managementPt).toBe(egp(100) + 1);
    expect(d.managementPt + 3 * 3333).toBe(egp(200));
  });
  it("general expenses come off the month before distribution", () => {
    const { db } = setup();
    recordExpense(db, { kind: "general", date: "2026-10-10", amountPt: egp(500) });
    const m = october(db);
    expect(m.monthNetPt).toBe(egp(3_000 - 150 - 500));
    expect(m.distribution.investorsPoolPt).toBe(egp(1_175));
  });
  it("negative margin: no 5%, loss reduces the month, investors get nothing", () => {
    const { db } = setup({ clientRate: 300, supplierRate: 400 });
    const m = october(db);
    expect(m.contracts[0].tax5Pt).toBe(0);
    expect(m.monthNetPt).toBe(-egp(3_000));
    expect(m.distribution.investors.every((x) => x.sharePt === 0)).toBe(true);
  });
});

describe("taxes per client", () => {
  it("individuals pay no 14% and their contracts pay no 5%", () => {
    const { db } = setup({ kind: "individual" });
    const r = october(db).contracts[0];
    expect([r.vatPt, r.invoiceTotalPt, r.tax5Pt, r.netPt]).toEqual([0, egp(15_000), 0, egp(3_000)]);
  });
  it("the two switches are independent", () => {
    const { db, client } = setup();
    setClientTaxes(db, client, false, true);
    const r = october(db).contracts[0];
    expect([r.vatPt, r.tax5Pt]).toEqual([0, egp(150)]);
  });
  it("a rate change applies from its effective date only", () => {
    const { db } = setup();
    setRates(db, "2026-11-01", { vat: 1500 });
    expect(rateAt(db, "vat", "2026-10-31")).toBe(1400);
    expect(rateAt(db, "vat", "2026-11-01")).toBe(1500);
    expect(october(db, "2026-11-30").contracts[0].vatPt).toBe(egp(2_100));
  });
  it("management + investors must add up to 100%", () => {
    const { db } = setup();
    expect(() => setRates(db, "2026-11-01", { management_share: 6000, investors_share: 5000 })).toThrow();
  });
});

describe("collections", () => {
  it("contract-linked payments first, then the client's oldest invoice, then credit", () => {
    const a = allocatePayments(
      [
        { clientId: 1, contractId: 1, month: "2026-09", basePt: 1000, vatPt: 140, totalPt: 1140 },
        { clientId: 1, contractId: 2, month: "2026-10", basePt: 1000, vatPt: 140, totalPt: 1140 },
      ],
      [{ clientId: 1, contractId: 2, date: "2026-10-20", amountPt: 2500 }],
    );
    expect(a.invoices.map((i) => i.collectedPt)).toEqual([1140, 1140]);
    expect(a.creditByClient.get(1)).toBe(220);
  });
  it("profit payouts can't exceed what clients paid for", () => {
    const { db, a, client } = setup();
    recordClientPayment(db, { clientId: client, date: "2026-10-20", amountPt: egp(8_550) }); // half of 17,100
    // A's share = 2,850 × 50% × 60% = 855; half collected → 427.50 may be paid
    expect(() => recordPayout(db, { payee: "investor", investorId: a, date: "2026-10-31", amountPt: egp(427.51) })).toThrow();
    recordPayout(db, { payee: "investor", investorId: a, date: "2026-10-31", amountPt: egp(427.5) });
    const inv = computeBooks(db, "2026-10-31").investors.find((i) => i.investorId === a)!;
    expect([inv.paidPt, inv.payableNowPt, inv.owedPt]).toEqual([egp(427.5), 0, egp(427.5)]);
  });
});

describe("records are never deleted or edited", () => {
  it("DELETE is refused everywhere", () => {
    const { db, client } = setup();
    recordClientPayment(db, { clientId: client, date: "2026-10-20", amountPt: egp(100) });
    expect(() => db.prepare("DELETE FROM client_payments").run()).toThrow(/مسح/);
    expect(() => db.prepare("DELETE FROM investors").run()).toThrow(/مسح/);
    expect(() => db.prepare("DELETE FROM work_logs").run()).toThrow(/مسح/);
  });
  it("money rows can't be edited, only their note", () => {
    const { db, client } = setup();
    const id = recordClientPayment(db, { clientId: client, date: "2026-10-20", amountPt: egp(100) });
    expect(() => db.prepare("UPDATE client_payments SET amount_pt = 1 WHERE id = ?").run(id)).toThrow(/مبتتعدلش/);
    db.prepare("UPDATE client_payments SET note = 'تحويل' WHERE id = ?").run(id);
  });
  it("cancelling = a mirror row; the treasury nets to zero; can't cancel twice", () => {
    const { db, client } = setup();
    const before = computeBooks(db, "2026-10-31").treasury.balancePt;
    const id = recordClientPayment(db, { clientId: client, date: "2026-10-20", amountPt: egp(1_000) });
    reverse(db, "client_payments", id, "2026-10-21", "اتسجلت غلط");
    const b = computeBooks(db, "2026-10-31");
    expect(b.treasury.balancePt).toBe(before);
    expect(b.raw.clientPayments).toHaveLength(0);
    expect(() => reverse(db, "client_payments", id, "2026-10-22", "تاني")).toThrow(/قبل كده/);
    expect(() =>
      db.prepare("INSERT INTO client_payments (client_id, date, amount_pt, reversal_of) VALUES (?, '2026-10-22', ?, ?)").run(client, -5, id),
    ).toThrow();
  });
  it("every change is written to the audit log", () => {
    const { db, contract } = setup();
    const n = db.prepare("SELECT COUNT(*) AS n FROM audit_log").get().n;
    upsertDay(db, contract, "2026-10-03", "client", { note: "تعديل" });
    const last = db.prepare("SELECT * FROM audit_log ORDER BY id DESC LIMIT 1").get();
    expect(db.prepare("SELECT COUNT(*) AS n FROM audit_log").get().n).toBe(n + 1);
    expect([last.tbl, last.op]).toEqual(["work_logs", "update"]);
    expect(JSON.parse(last.after_json).note).toBe("تعديل");
  });
});

describe("monthly close", () => {
  it("locks the month, numbers invoices, keeps its distribution", () => {
    const { db, contract } = setup();
    const m = closeMonth(db, "2026-10", "2026-11-02");
    expect(m.distribution.managementPt).toBe(egp(1_425));
    expect(db.prepare("SELECT serial FROM invoices").get().serial).toBe("ف-2026-0001");
    expect(() => upsertDay(db, contract, "2026-10-05", "client", { note: "x" })).toThrow(/اتقفل/);
    expect(() => recordExpense(db, { kind: "general", date: "2026-10-31", amountPt: 100 })).toThrow(/اتقفل/);
    expect(() => closeMonth(db, "2026-10", "2026-11-03")).toThrow(/قبل كده/);
    expect(() => setRates(db, "2026-10-15", { vat: 1500 })).toThrow();
    // a later rate change doesn't touch the closed month
    setRates(db, "2026-11-01", { vat: 1500, management_share: 4000, investors_share: 6000 });
    const after = october(db, "2026-11-30");
    expect(after.closed).toBe(true);
    expect(after.contracts[0].vatPt).toBe(egp(2_100));
    expect(after.distribution.investors.map((x) => x.sharePt)).toEqual([egp(855), egp(570)]);
  });
  it("corrections go in as an adjustment in an open month", () => {
    const { db, contract } = setup();
    closeMonth(db, "2026-10", "2026-11-02");
    expect(() => recordAdjustment(db, { appliedMonth: "2026-10", targetMonth: "2026-10", contractId: contract, kind: "client_base", amountPt: egp(500), reason: "يوم ناقص" })).toThrow();
    recordAdjustment(db, { appliedMonth: "2026-11", targetMonth: "2026-10", contractId: contract, kind: "client_base", amountPt: egp(500), reason: "يوم ناقص" });
    const nov = computeBooks(db, "2026-11-30").months.find((m) => m.month === "2026-11")!;
    expect(nov.contracts[0].clientBasePt).toBe(egp(500));
    expect(nov.contracts[0].vatPt).toBe(egp(70));
  });
  it("months close in order and only after they end", () => {
    const { db } = setup();
    expect(() => closeMonth(db, "2026-10", "2026-10-31")).toThrow(/مخلصش/);
  });
});

describe("cash guard", () => {
  it("warns before operating cash goes negative; tax money never counts as available", () => {
    const { db, supplier, client } = setup();
    recordClientPayment(db, { clientId: client, date: "2026-10-20", amountPt: egp(17_100) });
    const t = computeBooks(db, "2026-10-31").treasury;
    expect(t.balancePt).toBe(egp(117_100));
    expect(t.taxHeldPt).toBe(egp(2_250)); // 2,100 VAT collected + 150 accrued 5%
    expect(t.profitsDuePt).toBe(egp(2_850)); // fully collected → the whole month's profit is payable
    expect(t.availablePt).toBe(egp(117_100 - 2_250 - 2_850));
    try {
      recordSupplierPayment(db, { supplierId: supplier, date: "2026-10-31", amountPt: t.availablePt + 1 });
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(CashWarning);
    }
    recordSupplierPayment(db, { supplierId: supplier, date: "2026-10-31", amountPt: t.availablePt + 1 }, { confirmNegative: true });
  });
});

describe("printed sheets show one party only", () => {
  it("the supplier's sheet has no client name or client rate, and vice versa", () => {
    const { db, contract } = setup({ clientRate: 3000, supplierRate: 2500 });
    const s = JSON.stringify(getPartySheet(db, contract, "2026-10", "supplier"));
    expect(s).toContain("الحاج سيد");
    expect(s).not.toContain("الأمل");
    expect(s).not.toContain(String(egp(3000)));
    const c = JSON.stringify(getPartySheet(db, contract, "2026-10", "client"));
    expect(c).toContain("الأمل");
    expect(c).not.toContain("سيد");
    expect(c).not.toContain(String(egp(2500)));
  });
});
