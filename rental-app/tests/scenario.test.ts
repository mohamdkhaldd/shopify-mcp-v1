import { beforeAll, describe, expect, it } from "vitest";
import { freshDb, egp } from "./helpers";
import { Db } from "../core/db";
import { createClient, createContract, createEquipment, createInvestor, createSupplier } from "../core/services/master";
import { clearRange, copyClientToSupplier, fillRange, getSheet } from "../core/services/sarki";
import { recordCapital, recordClientPayment, recordExpense, recordSupplierDeduction, recordSupplierPayment } from "../core/services/ledger";
import { computeBooks, Books } from "../core/services/books";
import { clientStatement, dashboard, supplierStatement, taxFile } from "../core/services/reports";

// The everyday example shown in the mockups: 3,000/day to the company,
// 2,500/day to the equipment owner, October 2026, one Friday off.
describe("mockup scenario (3,000 / 2,500)", () => {
  let db: Db;
  let books: Books;
  const ids = {} as Record<string, number>;

  beforeAll(() => {
    db = freshDb();
    ids.ahmed = createInvestor(db, { name: "م. أحمد سالم" });
    ids.khaled = createInvestor(db, { name: "أ. خالد منصور" });
    recordCapital(db, { investorId: ids.ahmed, kind: "deposit", date: "2026-10-01", amountPt: egp(60_000) });
    recordCapital(db, { investorId: ids.khaled, kind: "deposit", date: "2026-10-01", amountPt: egp(40_000) });
    ids.sayed = createSupplier(db, { name: "الحاج سيد عبد الله" });
    ids.loader = createEquipment(db, { name: "لودر كاتربيلر 950", supplierId: ids.sayed, siteName: "كمبوند الياسمين — التجمع", supplierRatePt: egp(2_500) });
    ids.amal = createClient(db, { kind: "company", name: "شركة الأمل للمقاولات", taxId: "512-845-307" });
    ids.contract = createContract(db, {
      clientId: ids.amal,
      equipmentId: ids.loader,
      unit: "day",
      clientRatePt: egp(3_000),
      supplierRatePt: egp(2_500),
      startDate: "2026-10-01",
      endDate: "2026-10-31",
    });
    fillRange(db, ids.contract, "client", "2026-10-01", "2026-10-31", {});
    clearRange(db, ids.contract, "client", "2026-10-09", "2026-10-09", "إجازة الجمعة — الموقع قافل");
    copyClientToSupplier(db, ids.contract, "2026-10");
    recordExpense(db, { kind: "contract", contractId: ids.contract, date: "2026-10-02", amountPt: egp(1_250), note: "نقل المعدة للموقع" });
    recordSupplierDeduction(db, { supplierId: ids.sayed, contractId: ids.contract, date: "2026-10-05", amountPt: egp(3_000), note: "سولار دفعناه عنه" });
    recordSupplierPayment(db, { supplierId: ids.sayed, contractId: ids.contract, date: "2026-10-15", amountPt: egp(50_000) });
    recordClientPayment(db, { clientId: ids.amal, contractId: ids.contract, date: "2026-10-20", amountPt: egp(51_300) });
    books = computeBooks(db, "2026-10-31");
  });

  it("sarki: 30 working days on both sheets, no mismatches", () => {
    const s = getSheet(db, ids.contract, "2026-10", "supplier");
    expect(s.totals.workedDays).toBe(30);
    expect(s.totals.totalPt).toBe(egp(75_000));
    expect(s.mismatchDays).toBe(0);
  });

  it("month result", () => {
    const m = books.months[0];
    const r = m.contracts[0];
    expect([r.clientBasePt, r.vatPt, r.invoiceTotalPt]).toEqual([egp(90_000), egp(12_600), egp(102_600)]);
    expect([r.supplierCostPt, r.marginPt, r.tax5Pt, r.expensesPt, r.netPt]).toEqual([egp(75_000), egp(15_000), egp(750), egp(1_250), egp(13_000)]);
    expect(m.distribution.managementPt).toBe(egp(6_500));
    expect(m.distribution.investors.map((x) => x.sharePt)).toEqual([egp(3_900), egp(2_600)]);
  });

  it("half the invoice collected → half the profit can be paid out", () => {
    const m = books.months[0];
    expect(m.collectedBasePt).toBe(egp(45_000));
    expect(m.releasableManagementPt).toBe(egp(3_250));
    expect([...m.releasableByInvestor.values()]).toEqual([egp(1_950), egp(1_300)]);
  });

  it("treasury split", () => {
    expect(books.treasury).toEqual({ balancePt: egp(97_050), taxHeldPt: egp(7_050), profitsDuePt: egp(6_500), availablePt: egp(83_500) });
    expect(books.capital).toEqual({ totalPt: egp(100_000), deployedPt: egp(9_250), inTreasuryPt: egp(90_750) });
  });

  it("investors page", () => {
    const [a, k] = books.investors;
    expect([a.capitalPt, a.shareBp, a.inUsePt, a.accruedPt, a.payableNowPt, a.paidPt, a.owedPt, a.monthlyReturnBp]).toEqual([
      egp(60_000), 6000, egp(5_550), egp(3_900), egp(1_950), 0, egp(3_900), 650,
    ]);
    expect([k.capitalPt, k.shareBp, k.inUsePt, k.accruedPt, k.payableNowPt]).toEqual([egp(40_000), 4000, egp(3_700), egp(2_600), egp(1_300)]);
    expect(a.daysThisMonth).toBe(31);
  });

  it("supplier statement (no client data)", () => {
    const st = supplierStatement(db, ids.sayed, "2026-10-31", books);
    expect(st.rows).toEqual([{ month: "2026-10", fromSarkiPt: egp(75_000), deductionsPt: egp(3_000), paidPt: egp(50_000), monthBalancePt: egp(22_000), runningBalancePt: egp(22_000) }]);
    expect(st.totals.remainingPt).toBe(egp(22_000));
    expect(JSON.stringify(st)).not.toContain("الأمل");
    expect(JSON.stringify(st)).not.toContain(String(egp(3_000) * 30));
  });

  it("client statement (no supplier data)", () => {
    const st = clientStatement(db, ids.amal, "2026-10-31", books);
    expect(st.totals).toEqual({ basePt: egp(90_000), vatPt: egp(12_600), invoicedPt: egp(102_600), paidPt: egp(51_300), remainingPt: egp(51_300), creditPt: 0 });
    expect(JSON.stringify(st)).not.toContain("سيد");
  });

  it("tax file", () => {
    const t = taxFile(db, "2026-10-31", books).totals;
    expect(t.vat).toEqual({ invoicedPt: egp(12_600), collectedPt: egp(6_300), paidPt: 0, owedPt: egp(12_600), heldPt: egp(6_300) });
    expect(t.tax5).toEqual({ accruedPt: egp(750), paidPt: 0, owedPt: egp(750) });
    expect(t.owedPt).toBe(egp(13_350));
    expect(t.heldInTreasuryPt).toBe(egp(7_050));
  });

  it("dashboard", () => {
    const d = dashboard(db, "2026-10-31", books);
    expect([d.receivablesPt, d.payablesPt, d.monthProfitPt, d.monthCollectedProfitPt, d.activeContracts]).toEqual([
      egp(51_300), egp(22_000), egp(13_000), egp(6_500), 1,
    ]);
  });
});
