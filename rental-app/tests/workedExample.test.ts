import { describe, expect, it } from "vitest";
import { contractMonth } from "../core/calc/contractMonth";
import { distribute } from "../core/calc/distribution";
import { capitalWeight } from "../core/calc/timeWeight";
import { freshDb, egp } from "./helpers";
import { createClient, createContract, createEquipment, createInvestor, createSupplier } from "../core/services/master";
import { fillRange } from "../core/services/sarki";
import { recordCapital, recordExpense } from "../core/services/ledger";
import { computeBooks } from "../core/services/books";

// The mandatory worked example from the brief, reproduced to the piaster.
//   30 days × 500 = 15,000 · VAT 2,100 · invoice 17,100
//   30 days × 400 = 12,000 · margin 3,000 · 5% 150 → 2,850
//   expenses 350 → net 2,500 · management 1,250 · investors 1,250
//   A (60,000) 750 · B (40,000) 500

describe("mandatory worked example — pure calculation", () => {
  const r = contractMonth({
    clientBasePt: egp(500) * 30,
    supplierCostPt: egp(400) * 30,
    contractExpensesPt: egp(350),
    vatApplies: true,
    tax5Applies: true,
    vatBp: 1400,
    tax5Bp: 500,
  });

  it("client side", () => {
    expect(r.clientBasePt).toBe(egp(15_000));
    expect(r.vatPt).toBe(egp(2_100));
    expect(r.invoiceTotalPt).toBe(egp(17_100));
  });

  it("supplier side and margin", () => {
    expect(r.supplierCostPt).toBe(egp(12_000));
    expect(r.marginPt).toBe(egp(3_000));
    expect(r.tax5Pt).toBe(egp(150));
    expect(r.afterTax5Pt).toBe(egp(2_850));
    expect(r.netPt).toBe(egp(2_500));
  });

  it("distribution", () => {
    const month = "2026-10";
    const wA = capitalWeight([{ date: "2026-10-01", signedPt: egp(60_000) }], month);
    const wB = capitalWeight([{ date: "2026-10-01", signedPt: egp(40_000) }], month);
    const d = distribute(r.netPt, 5000, [
      { investorId: 1, weight: wA },
      { investorId: 2, weight: wB },
    ]);
    expect(d.managementPt).toBe(egp(1_250));
    expect(d.investorsPoolPt).toBe(egp(1_250));
    expect(d.investors.map((x) => x.sharePt)).toEqual([egp(750), egp(500)]);
    expect(d.remainderToManagementPt).toBe(0);
  });
});

describe("mandatory worked example — through the database", () => {
  it("the same numbers come out of the sarki, expenses and capital rows", () => {
    const db = freshDb();
    const a = createInvestor(db, { name: "مستثمر أ" });
    const b = createInvestor(db, { name: "مستثمر ب" });
    recordCapital(db, { investorId: a, kind: "deposit", date: "2026-10-01", amountPt: egp(60_000) });
    recordCapital(db, { investorId: b, kind: "deposit", date: "2026-10-01", amountPt: egp(40_000) });
    const supplier = createSupplier(db, { name: "صاحب المعدة" });
    const eq = createEquipment(db, { name: "لودر", supplierId: supplier });
    const client = createClient(db, { kind: "company", name: "شركة" });
    const contract = createContract(db, { clientId: client, equipmentId: eq, unit: "day", clientRatePt: egp(500), supplierRatePt: egp(400), startDate: "2026-10-01" });
    fillRange(db, contract, "client", "2026-10-01", "2026-10-30", {});
    fillRange(db, contract, "supplier", "2026-10-01", "2026-10-30", {});
    recordExpense(db, { kind: "contract", contractId: contract, date: "2026-10-02", amountPt: egp(350) });

    const m = computeBooks(db, "2026-10-31").months.find((x) => x.month === "2026-10")!;
    const row = m.contracts[0];
    expect(row.clientDays).toBe(30);
    expect(row.clientBasePt).toBe(egp(15_000));
    expect(row.vatPt).toBe(egp(2_100));
    expect(row.invoiceTotalPt).toBe(egp(17_100));
    expect(row.supplierCostPt).toBe(egp(12_000));
    expect(row.marginPt).toBe(egp(3_000));
    expect(row.tax5Pt).toBe(egp(150));
    expect(row.netPt).toBe(egp(2_500));
    expect(m.monthNetPt).toBe(egp(2_500));
    expect(m.distribution.managementPt).toBe(egp(1_250));
    expect(m.distribution.investors.map((x) => [x.investorId, x.sharePt])).toEqual([
      [a, egp(750)],
      [b, egp(500)],
    ]);
  });
});
