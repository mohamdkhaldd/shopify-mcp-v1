import { describe, expect, it } from "vitest";
import { freshDb, egp } from "./helpers";
import { createClient, createContract, createEquipment, createSupplier } from "../core/services/master";
import { fillRange } from "../core/services/sarki";
import { computeBooks } from "../core/services/books";
import { recordCapital, recordExpense, recordPayout } from "../core/services/ledger";
import { supplierStatement } from "../core/services/reports";
import { createDriver, driversView, recordDriverPayment } from "../core/services/drivers";
import { managersReport } from "../core/services/managers";

function setup() {
  const db = freshDb({ withholding: true });
  const owner = createSupplier(db, { name: "محمد" });
  const eq = createEquipment(db, { name: "لودر ٩٥٠", supplierId: owner, siteName: "الموقع" });
  const client = createClient(db, { kind: "company", name: "شركة" });
  const contract = createContract(db, { clientId: client, equipmentId: eq, unit: "day", clientRatePt: egp(1000), supplierRatePt: egp(800), startDate: "2026-10-01" });
  fillRange(db, contract, "client", "2026-10-01", "2026-10-20", {});
  fillRange(db, contract, "supplier", "2026-10-01", "2026-10-20", {});
  recordCapital(db, { investorId: (db.prepare("INSERT INTO investors (name) VALUES ('م')").run().lastInsertRowid as number), kind: "deposit", date: "2026-10-01", amountPt: egp(100_000) });
  return { db, owner, eq, contract };
}

describe("السواقين", () => {
  it("إحنا بنقبّضه: المرتب − اللي خده = الباقي، وكل اللي خده بيتخصم من صاحب المعدة", () => {
    const { db, owner, eq } = setup();
    const ahmed = createDriver(db, { name: "أحمد", supplierId: owner, equipmentId: eq, paidBy: "us", payKind: "month", ratePt: egp(6000), startDate: "2026-10-01" });
    recordDriverPayment(db, { driverId: ahmed, date: "2026-10-10", amountPt: egp(2000), note: "سلفة" });
    const v = driversView(db, "2026-10", ahmed);
    expect(v.selected).toMatchObject({ earnedPt: egp(6000), paidPt: egp(2000), remainingPt: egp(4000), supplierName: "محمد", equipmentName: "لودر ٩٥٠" });
    expect(v.payments[0]).toMatchObject({ amountPt: egp(2000), note: "للسواق أحمد — سلفة" });
    // صاحب المعدة: ٢٠ يوم × ٨٠٠ = ١٦٠٠٠، اتخصم منه ٢٠٠٠ للسواق
    const st = supplierStatement(db, owner, "2026-10-31");
    expect(st.totals).toMatchObject({ fromSarkiPt: egp(16_000), deductionsPt: egp(2000), remainingPt: egp(14_000) });
    // الشهر الجاي: ٤٠٠٠ باقيين من أكتوبر + ٦٠٠٠ نوفمبر
    expect(driversView(db, "2026-11", ahmed).selected).toMatchObject({ earnedPt: egp(6000), previousPt: egp(4000), paidPt: 0, remainingPt: egp(10_000) });
  });

  it("يومية × أيام شغل المعدة في السركي", () => {
    const { db, owner, eq } = setup();
    const d = createDriver(db, { name: "سيد", supplierId: owner, equipmentId: eq, paidBy: "us", payKind: "day", ratePt: egp(250), startDate: "2026-10-01" });
    expect(driversView(db, "2026-10", d).selected).toMatchObject({ days: 20, earnedPt: egp(5000), remainingPt: egp(5000) });
  });

  it("صاحب المعدة بيقبّضه: ملوش مرتب عندنا، واللي اديناهوله بيتخصم من صاحب المعدة", () => {
    const { db, owner, eq } = setup();
    const d = createDriver(db, { name: "حسن", supplierId: owner, equipmentId: eq, paidBy: "owner", payKind: "month" });
    recordDriverPayment(db, { driverId: d, date: "2026-10-05", amountPt: egp(500) });
    expect(driversView(db, "2026-10", d).selected).toMatchObject({ earnedPt: 0, paidPt: egp(500), remainingPt: 0 });
    expect(supplierStatement(db, owner, "2026-10-31").totals.deductionsPt).toBe(egp(500));
    // الفلوس طلعت من الخزنة
    expect(computeBooks(db, "2026-10-31").treasury.balancePt).toBe(egp(100_000 - 500));
  });

  it("المعدة لازم تبقى بتاعة صاحب المعدة، والمرتب لازم يتكتب لو إحنا بنقبّضه", () => {
    const { db, owner, eq } = setup();
    const other = createSupplier(db, { name: "تاني" });
    expect(() => createDriver(db, { name: "x", supplierId: other, equipmentId: eq, paidBy: "owner", payKind: "month" })).toThrow("مش بتاعة");
    expect(() => createDriver(db, { name: "y", supplierId: owner, paidBy: "us", payKind: "month" })).toThrow("اكتب مرتب");
  });
});

describe("شركاء الإدارة بيصرفوا من جيبهم", () => {
  it("المصروف من جيب الشريك: مبيطلعش من الخزنة، وبيتحسب له", () => {
    const { db, contract } = setup();
    db.prepare("INSERT INTO contract_managers (contract_id, name, share_bp) VALUES (?, 'خالد', 5000), (?, 'عمرو', 5000)").run(contract, contract);
    const before = computeBooks(db, "2026-10-31").treasury.balancePt;
    recordExpense(db, { kind: "general", date: "2026-10-12", amountPt: egp(1500), note: "زيت هيدروليك", paidBy: "خالد" });
    const books = computeBooks(db, "2026-10-31");
    expect(books.treasury.balancePt).toBe(before);
    const r = managersReport(db, books, "2026-10");
    const khaled = r.people.find((p) => p.name === "خالد")!;
    const amr = r.people.find((p) => p.name === "عمرو")!;
    expect(khaled.pocketPt).toBe(egp(1500));
    expect(khaled.balancePt - amr.balancePt).toBe(egp(1500));
    // نرجّعله فلوسه حتى لو نصيب الإدارة لسه متحصّلش
    recordPayout(db, { payee: "management", managerName: "خالد", date: "2026-10-31", amountPt: egp(1500) }, { confirmNegative: true });
    expect(managersReport(db, computeBooks(db, "2026-10-31"), "2026-10").people.find((p) => p.name === "خالد")!.paidPt).toBe(egp(1500));
  });
});

describe("الإقرارات", () => {
  it("إقرار ١٤٪ الشهري بالفواتير، وإقرار ٣٪ السنوي لكل شركة", async () => {
    const { db } = setup();
    const { taxView } = await import("../core/services/views");
    const v = taxView(db, "2026-10-31");
    expect(v.vatDeclarations).toHaveLength(1);
    expect(v.vatDeclarations[0]).toMatchObject({ month: "2026-10", basePt: egp(20_000), vatPt: egp(2_800), whtPt: egp(600) });
    expect(v.vatDeclarations[0].invoices[0]).toMatchObject({ client: "شركة", equipment: "لودر ٩٥٠" });
    expect(v.whtDeclarations[0]).toMatchObject({ year: "2026", basePt: egp(20_000), whtPt: egp(600) });
    expect(v.whtDeclarations[0].clients[0]).toMatchObject({ client: "شركة", months: 1 });
  });
});
