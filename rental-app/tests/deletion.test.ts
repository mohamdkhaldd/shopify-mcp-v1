import { describe, expect, it } from "vitest";
import { freshDb, egp } from "./helpers";
import { createClient, createContract, createEquipment, createInvestor, createSupplier } from "../core/services/master";
import { fillRange, getSheet } from "../core/services/sarki";
import { recordCapital, recordClientPayment, recordExpense, recordSupplierPayment } from "../core/services/ledger";
import { computeBooks } from "../core/services/books";
import { closeMonth } from "../core/services/close";
import { deleteEntity, deletePreview, restoreDeleted } from "../core/services/deletion";

function setup() {
  const db = freshDb();
  const inv = createInvestor(db, { name: "أ" });
  recordCapital(db, { investorId: inv, kind: "deposit", date: "2026-10-01", amountPt: egp(100_000) });
  const supplier = createSupplier(db, { name: "الحاج سيد" });
  const eq = createEquipment(db, { name: "لودر 950", supplierId: supplier });
  const client = createClient(db, { kind: "company", name: "شركة الأمل" });
  const contract = createContract(db, { clientId: client, equipmentId: eq, unit: "day", clientRatePt: egp(500), supplierRatePt: egp(400), startDate: "2026-10-01" });
  fillRange(db, contract, "client", "2026-10-01", "2026-10-30", {});
  fillRange(db, contract, "supplier", "2026-10-01", "2026-10-30", {});
  const pay = recordClientPayment(db, { clientId: client, contractId: contract, date: "2026-10-20", amountPt: egp(8_550) });
  const sp = recordSupplierPayment(db, { supplierId: supplier, contractId: contract, date: "2026-10-15", amountPt: egp(10_000) });
  const exp = recordExpense(db, { kind: "contract", contractId: contract, date: "2026-10-02", amountPt: egp(350) });
  return { db, inv, supplier, eq, client, contract, pay, sp, exp };
}

describe("delete with confirmation", () => {
  it("a payment: the preview names it, delete removes it from every total, restore brings it back", () => {
    const { db, pay } = setup();
    const before = computeBooks(db, "2026-10-31");
    expect(deletePreview(db, "client_payments", pay).items).toEqual(["دفعة من عميل 8,550 ج — 2026-10-20"]);
    const batch = deleteEntity(db, "client_payments", pay);
    const after = computeBooks(db, "2026-10-31");
    expect(after.treasury.balancePt).toBe(before.treasury.balancePt - egp(8_550));
    expect(after.raw.clientPayments).toHaveLength(0);
    // the row is still in the database (and the audit log), only hidden
    expect(db.prepare("SELECT deleted_at FROM client_payments WHERE id = ?").get(pay).deleted_at).toBe(batch);
    restoreDeleted(db, batch);
    expect(computeBooks(db, "2026-10-31").treasury.balancePt).toBe(before.treasury.balancePt);
  });

  it("a contract lists everything that goes with it", () => {
    const { db, contract } = setup();
    expect(deletePreview(db, "contracts", contract).items).toEqual([
      "العقد ع-2026-001 (لودر 950 — شركة الأمل)",
      "60 يوم سركي",
      "دفعة من عميل 8,550 ج — 2026-10-20",
      "دفعة لصاحب معدة 10,000 ج — 2026-10-15",
      "مصروف 350 ج — 2026-10-02",
    ]);
    const batch = deleteEntity(db, "contracts", contract);
    const b = computeBooks(db, "2026-10-31");
    expect(b.months.flatMap((m) => m.contracts)).toHaveLength(0);
    expect(b.treasury.balancePt).toBe(egp(100_000));
    restoreDeleted(db, batch);
    expect(computeBooks(db, "2026-10-31").months[0].contracts[0].netPt).toBe(egp(2_500));
  });

  it("deleting a supplier takes his equipment and contracts; the name can be reused", () => {
    const { db, supplier } = setup();
    const p = deletePreview(db, "suppliers", supplier);
    expect(p.items.slice(0, 3)).toEqual(["الحاج سيد", "المعدة لودر 950", "العقد ع-2026-001 (لودر 950 — شركة الأمل)"]);
    deleteEntity(db, "suppliers", supplier);
    createSupplier(db, { name: "الحاج سيد" });
  });

  it("a deleted sarki day can be typed again", () => {
    const { db, contract } = setup();
    const row = db.prepare("SELECT id FROM work_logs WHERE contract_id = ? AND date = '2026-10-05' AND side = 'client'").get(contract);
    deleteEntity(db, "work_logs", row.id);
    expect(getSheet(db, contract, "2026-10", "client").totals.workedDays).toBe(29);
    fillRange(db, contract, "client", "2026-10-05", "2026-10-05", {});
    expect(getSheet(db, contract, "2026-10", "client").totals.workedDays).toBe(30);
  });

  it("anything in a closed month is refused with a clear reason", () => {
    const { db, pay, contract } = setup();
    closeMonth(db, "2026-10", "2026-11-02");
    expect(deletePreview(db, "client_payments", pay).blocked).toMatch(/أكتوبر 2026/);
    expect(() => deleteEntity(db, "client_payments", pay)).toThrow(/شهر مقفول/);
    expect(() => deleteEntity(db, "contracts", contract)).toThrow(/شهر مقفول/);
  });
});
