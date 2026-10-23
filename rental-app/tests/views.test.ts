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
