import { Db } from "./db";
import { createClient, createContract, createEquipment, createExpenseCategory, createInvestor, createSupplier } from "./services/master";
import { clearRange, fillRange } from "./services/sarki";
import { recordCapital, recordClientPayment, recordExpense, recordSupplierDeduction, recordSupplierPayment } from "./services/ledger";

// The everyday example from the mockups (3,000 / 2,500, October 2026). Used by
// tests and by the screenshot/demo mode only — a real install starts empty.
export function seedDemo(db: Db) {
  const egp = (n: number) => n * 100;
  return db.transaction(() => {
    const ahmed = createInvestor(db, { name: "م. أحمد سالم", phone: "0122 555 1010" });
    const khaled = createInvestor(db, { name: "أ. خالد منصور", phone: "0111 777 2020" });
    recordCapital(db, { investorId: ahmed, kind: "deposit", date: "2026-10-01", amountPt: egp(60_000) });
    recordCapital(db, { investorId: khaled, kind: "deposit", date: "2026-10-01", amountPt: egp(40_000) });
    const sayed = createSupplier(db, { name: "الحاج سيد عبد الله", phone: "0100 234 5678" });
    const loader = createEquipment(db, { name: "لودر كاتربيلر 950", supplierId: sayed, siteName: "كمبوند الياسمين — التجمع", supplierRatePt: egp(2_500) });
    const amal = createClient(db, { kind: "company", name: "شركة الأمل للمقاولات", taxId: "512-845-307" });
    createClient(db, { kind: "individual", name: "م. حسام فؤاد" });
    const contract = createContract(db, {
      clientId: amal,
      equipmentId: loader,
      unit: "day",
      clientRatePt: egp(3_000),
      supplierRatePt: egp(2_500),
      startDate: "2026-10-01",
      endDate: "2026-10-31",
    });
    fillRange(db, contract, "client", "2026-10-01", "2026-10-31", {});
    clearRange(db, contract, "client", "2026-10-09", "2026-10-09", "إجازة الجمعة — الموقع قافل"); // the owner's sheet follows by itself
    const transport = createExpenseCategory(db, "نقل معدات");
    recordExpense(db, { kind: "contract", contractId: contract, categoryId: transport, date: "2026-10-02", amountPt: egp(1_250), note: "نقل المعدة للموقع" });
    recordSupplierDeduction(db, { supplierId: sayed, contractId: contract, date: "2026-10-05", amountPt: egp(3_000), note: "سولار دفعناه عنه" });
    recordSupplierPayment(db, { supplierId: sayed, contractId: contract, date: "2026-10-15", amountPt: egp(50_000), note: "دفعة تحت الحساب" });
    recordClientPayment(db, { clientId: amal, contractId: contract, date: "2026-10-20", amountPt: egp(51_300), note: "تحويل بنكي" });
    return { ahmed, khaled, sayed, loader, amal, contract };
  })();
}
