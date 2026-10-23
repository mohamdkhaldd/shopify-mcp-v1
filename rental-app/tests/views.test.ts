import { describe, expect, it } from "vitest";
import { freshDb, egp } from "./helpers";
import { seedDemo } from "../core/demo";
import { asOfForMonth, dashboardView } from "../core/services/views";

describe("dashboard view (demo data)", () => {
  const db = freshDb();
  seedDemo(db);
  const v = dashboardView(db, "2026-10", "2026-10-31");

  it("KPI cards", () => {
    expect(v.kpis).toMatchObject({
      balancePt: egp(97_050),
      availablePt: egp(83_500),
      taxHeldPt: egp(7_050),
      vatHeldPt: egp(6_300),
      tax5HeldPt: egp(750),
      receivablesPt: egp(51_300),
      invoicedPt: egp(102_600),
      payablesPt: egp(22_000),
      deductionsPt: egp(3_000),
      monthProfitPt: egp(13_000),
      monthCollectedProfitPt: egp(6_500),
      activeContracts: 1,
    });
  });
  it("ladder from invoice to split", () => {
    expect(v.ladder).toMatchObject({
      clientBasePt: egp(90_000),
      supplierCostPt: egp(75_000),
      marginPt: egp(15_000),
      tax5Pt: egp(750),
      expensesPt: egp(1_250),
      netPt: egp(13_000),
      managementPt: egp(6_500),
      investorsPt: egp(6_500),
    });
  });
  it("active contracts with names", () => {
    expect(v.activeContracts).toEqual([
      expect.objectContaining({ code: "ع-2026-001", client: "شركة الأمل للمقاولات", equipment: "لودر كاتربيلر 950", supplier: "الحاج سيد عبد الله", daysThisMonth: 30, netThisMonthPt: egp(13_000) }),
    ]);
  });
  it("a past month is read as of its last day", () => {
    expect(asOfForMonth("2026-09", "2026-10-23")).toBe("2026-09-30");
    expect(asOfForMonth("2026-10", "2026-10-23")).toBe("2026-10-23");
  });
});

import { sarkiView } from "../core/services/views";

describe("sarki view", () => {
  const db = freshDb();
  const ids = seedDemo(db);
  it("opens the active contract on the current month with both sheets", () => {
    const v = sarkiView(db, undefined, undefined, "2026-10-31");
    expect(v.contract?.code).toBe("ع-2026-001");
    expect(v.month).toBe("2026-10");
    expect(v.months).toEqual(["2026-10"]);
    if (!v.contract) throw new Error();
    expect([v.client!.totals.workedDays, v.client!.totals.totalPt, v.supplier!.totals.totalPt]).toEqual([30, egp(90_000), egp(75_000)]);
    expect(v.client!.days).toHaveLength(31);
    expect(v.client!.days[8].row?.note).toBe("إجازة الجمعة — الموقع قافل");
    expect(v.supplier!.days[8].row?.is_day_off).toBe(1);
    expect(ids.contract).toBe(v.contract.id);
  });
});

import { suppliersView } from "../core/services/views";

describe("suppliers view", () => {
  const db = freshDb();
  seedDemo(db);
  it("list with what's left for each owner, and the selected owner's page", () => {
    const v = suppliersView(db, undefined, "2026-10-31");
    expect(v.list).toEqual([expect.objectContaining({ name: "الحاج سيد عبد الله", equipmentCount: 1, remainingPt: egp(22_000) })]);
    const s = v.selected!;
    expect(s.totals).toEqual({ fromSarkiPt: egp(75_000), deductionsPt: egp(3_000), paidPt: egp(50_000), remainingPt: egp(22_000) });
    expect(s.equipment).toEqual([expect.objectContaining({ name: "لودر كاتربيلر 950", site_name: "كمبوند الياسمين — التجمع", supplier_rate_pt: egp(2_500), working: true })]);
    expect(s.contracts[0].months).toEqual(["2026-10"]);
    expect(s.payments).toHaveLength(1);
    expect(s.deductions).toHaveLength(1);
  });
});

import { createEquipment, createContract } from "../core/services/master";
import { fillRange as fill } from "../core/services/sarki";
import { recordSupplierPayment as paySupplier } from "../core/services/ledger";

describe("an owner with several machines", () => {
  it("one account, split per machine", () => {
    const db = freshDb();
    const ids = seedDemo(db);
    const crane = createEquipment(db, { name: "ونش 25 طن", supplierId: ids.sayed, supplierRatePt: egp(4_000) });
    const c2 = createContract(db, { clientId: ids.amal, equipmentId: crane, unit: "day", clientRatePt: egp(5_000), supplierRatePt: egp(4_000), startDate: "2026-10-20", endDate: "2026-10-29" });
    fill(db, c2, "client", "2026-10-20", "2026-10-29", {}); // 10 days → 40,000 for the owner
    paySupplier(db, { supplierId: ids.sayed, contractId: c2, date: "2026-10-30", amountPt: egp(10_000) }, { confirmNegative: true });
    const v = suppliersView(db, ids.sayed, "2026-10-31").selected!;
    expect(v.equipment.map((e) => e.name)).toEqual(["لودر كاتربيلر 950", "ونش 25 طن"]);
    expect(v.byEquipment.map((e) => [e.name, e.fromSarkiPt, e.deductionsPt, e.paidPt, e.remainingPt])).toEqual([
      ["لودر كاتربيلر 950", egp(75_000), egp(3_000), egp(50_000), egp(22_000)],
      ["ونش 25 طن", egp(40_000), 0, egp(10_000), egp(30_000)],
    ]);
    expect(v.totals.remainingPt).toBe(egp(52_000));
  });
});

import { clientsView } from "../core/services/views";

describe("clients view", () => {
  const db = freshDb();
  seedDemo(db);
  it("company with VAT, an individual without, invoices and monthly statement", () => {
    const v = clientsView(db, undefined, "2026-10-31");
    expect(v.list.map((c) => [c.name, c.kind, c.vat_applies, c.remainingPt])).toEqual([
      ["شركة الأمل للمقاولات", "company", 1, egp(51_300)],
      ["م. حسام فؤاد", "individual", 0, 0],
    ]);
    const s = v.selected!;
    expect(s.totals).toMatchObject({ basePt: egp(90_000), vatPt: egp(12_600), invoicedPt: egp(102_600), paidPt: egp(51_300), remainingPt: egp(51_300) });
    expect(s.invoices).toEqual([expect.objectContaining({ month: "2026-10", code: "ع-2026-001", totalPt: egp(102_600), collectedPt: egp(51_300), status: "partial", serial: null })]);
    expect(s.rows).toEqual([{ month: "2026-10", invoicedPt: egp(102_600), paidPt: egp(51_300), runningPt: egp(51_300) }]);
    expect(JSON.stringify(s)).not.toContain("سيد");
  });
});

import { managementView } from "../core/services/views";

describe("management view", () => {
  it("contracts, per machine, expenses, management share and what can be closed", () => {
    const db = freshDb();
    seedDemo(db);
    const v = managementView(db, "2026-10", "2026-11-05");
    expect(v.rows).toEqual([expect.objectContaining({ code: "ع-2026-001", equipment: "لودر كاتربيلر 950", supplier: "الحاج سيد عبد الله", client: "شركة الأمل للمقاولات", marginPt: egp(15_000), tax5Pt: egp(750), expensesPt: egp(1_250), netPt: egp(13_000) })]);
    expect(v.byEquipment).toEqual([expect.objectContaining({ equipment: "لودر كاتربيلر 950", netPt: egp(13_000) })]);
    expect(v.totals).toMatchObject({ monthNetPt: egp(13_000), managementPt: egp(6_500), releasableManagementPt: egp(3_250) });
    expect(v.expenses).toEqual([expect.objectContaining({ kind: "contract", amount_pt: egp(1_250), code: "ع-2026-001", category: "نقل معدات" })]);
    expect(v.closable).toBe("2026-10");
    expect(v.management.payableNowPt).toBe(egp(3_250));
  });
});

import { investorsView, nextPayoutMonth } from "../core/services/views";
import { recordCapital as cap, reinvestProfit } from "../core/services/ledger";

describe("investors view", () => {
  it("the investors table, the split for the month, and the next quarterly payout", () => {
    const db = freshDb();
    const ids = seedDemo(db);
    const v = investorsView(db, "2026-10", "2026-10-31");
    expect(v.investors.map((i) => [i.name, i.capitalPt, i.shareBp, i.inUsePt, i.accruedPt, i.payableNowPt, i.monthlyReturnBp])).toEqual([
      ["م. أحمد سالم", egp(60_000), 6000, egp(5_550), egp(3_900), egp(1_950), 650],
      ["أ. خالد منصور", egp(40_000), 4000, egp(3_700), egp(2_600), egp(1_300), 650],
    ]);
    expect(v.split.map((s) => [s.name, s.capitalAtEndPt, s.daysPresent, s.shareBp, s.sharePt])).toEqual([
      ["م. أحمد سالم", egp(60_000), 31, 6000, egp(3_900)],
      ["أ. خالد منصور", egp(40_000), 31, 4000, egp(2_600)],
    ]);
    expect(v.nextPayoutMonth).toBe("2026-12");
    expect(nextPayoutMonth("2027-01-15")).toBe("2027-03");
    // can't withdraw more than his capital
    expect(() => cap(db, { investorId: ids.khaled, kind: "withdrawal", date: "2026-10-31", amountPt: egp(40_001) })).toThrow(/رأس مال/);
    // reinvesting: his payable profit moves into his capital, the treasury doesn't change
    // (dated the 1st of the next month; on the 31st it would add one day of the bigger capital to October's split)
    const before = investorsView(db, "2026-10", "2026-11-01");
    reinvestProfit(db, { investorId: ids.khaled, date: "2026-11-01", amountPt: egp(1_300) });
    const after = investorsView(db, "2026-10", "2026-11-01");
    const k = after.investors.find((i) => i.investorId === ids.khaled)!;
    expect([k.capitalPt, k.payableNowPt, k.paidPt]).toEqual([egp(41_300), 0, egp(1_300)]);
    expect(after.totals.capitalPt - before.totals.capitalPt).toBe(egp(1_300));
  });
});

import { treasuryView } from "../core/services/views";

describe("treasury view", () => {
  it("balance split, every movement with a running balance, and filters", () => {
    const db = freshDb();
    seedDemo(db);
    const v = treasuryView(db, {}, "2026-10-31");
    expect(v.split).toMatchObject({ balancePt: egp(97_050), taxHeldPt: egp(7_050), vatHeldPt: egp(6_300), tax5HeldPt: egp(750), profitsDuePt: egp(6_500), investorsDuePt: egp(3_250), managementDuePt: egp(3_250), availablePt: egp(83_500) });
    expect(v.rows.map((r) => [r.date, r.typeLabel, r.party, r.inPt || -r.outPt, r.balancePt])).toEqual([
      ["2026-10-01", "إيداع مستثمر", "م. أحمد سالم", egp(60_000), egp(60_000)],
      ["2026-10-01", "إيداع مستثمر", "أ. خالد منصور", egp(40_000), egp(100_000)],
      ["2026-10-02", "مصروف", "ع-2026-001", -egp(1_250), egp(98_750)],
      ["2026-10-05", "خصم لحساب صاحب معدة", "الحاج سيد عبد الله", -egp(3_000), egp(95_750)],
      ["2026-10-15", "دفعة لصاحب معدة", "الحاج سيد عبد الله", -egp(50_000), egp(45_750)],
      ["2026-10-20", "تحصيل من عميل", "شركة الأمل للمقاولات", egp(51_300), egp(97_050)],
    ]);
    const f = treasuryView(db, { type: "investor_deposit" }, "2026-10-31");
    expect(f.totals).toEqual({ inPt: egp(100_000), outPt: 0, count: 2 });
    expect(treasuryView(db, { from: "2026-10-10", to: "2026-10-20" }, "2026-10-31").totals.count).toBe(2);
  });
});

import { taxView } from "../core/services/views";
import { recordTaxPayment } from "../core/services/ledger";

describe("tax view", () => {
  it("14% by client / machine / month, 5% by contract-month, payments and what's left", () => {
    const db = freshDb();
    seedDemo(db);
    recordTaxPayment(db, { tax: "vat", periodMonth: "2026-10", date: "2026-10-28", amountPt: egp(6_300), receiptNo: "123" });
    const v = taxView(db, "2026-10-31");
    expect(v.vatByClient).toEqual([expect.objectContaining({ name: "شركة الأمل للمقاولات", taxId: "512-845-307", basePt: egp(90_000), vatPt: egp(12_600), collectedVatPt: egp(6_300) })]);
    expect(v.vatByEquipment).toEqual([expect.objectContaining({ name: "لودر كاتربيلر 950", vatPt: egp(12_600) })]);
    expect(v.vatByMonth).toEqual([expect.objectContaining({ month: "2026-10", vatPt: egp(12_600), paidPt: egp(6_300) })]);
    expect(v.tax5).toEqual([expect.objectContaining({ code: "ع-2026-001", month: "2026-10", marginPt: egp(15_000), tax5Pt: egp(750) })]);
    expect(v.totals.vat).toEqual({ invoicedPt: egp(12_600), collectedPt: egp(6_300), paidPt: egp(6_300), owedPt: egp(6_300), heldPt: 0 });
    expect(v.totals.owedPt).toBe(egp(6_300 + 750));
    expect(v.totals.heldInTreasuryPt).toBe(egp(750));
    expect(v.payments).toHaveLength(1);
  });
});
