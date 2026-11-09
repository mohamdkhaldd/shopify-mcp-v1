import { describe, expect, it } from "vitest";
import { freshDb, egp } from "./helpers";
import { contractMonth } from "../core/calc/contractMonth";
import { createClient, createContract, createEquipment, createSupplier, setWithholding, withholdingAt } from "../core/services/master";
import { fillRange } from "../core/services/sarki";
import { computeBooks } from "../core/services/books";
import { recordClientPayment } from "../core/services/ledger";
import { clientStatement } from "../core/services/reports";

describe("الاستقطاع ٣٪ بدل الـ ٥٪ على الهامش", () => {
  it("يومية ١٠٠٠: الشركة تخصم ٣٠ وتزود ١٤٠ وتدفع ١١١٠، والـ ٣٠ من ربحنا", () => {
    const r = contractMonth({ clientBasePt: egp(1000), supplierCostPt: egp(800), contractExpensesPt: 0, vatApplies: true, tax5Applies: true, vatBp: 1400, tax5Bp: 500, whtBp: 300 });
    expect(r).toMatchObject({ vatPt: egp(140), whtPt: egp(30), tax5Pt: 0, invoiceTotalPt: egp(1110), marginPt: egp(200), netPt: egp(170) });
    // قبل الاستقطاع: ٥٪ على الهامش زي ما كان
    const old = contractMonth({ clientBasePt: egp(1000), supplierCostPt: egp(800), contractExpensesPt: 0, vatApplies: true, tax5Applies: true, vatBp: 1400, tax5Bp: 500 });
    expect(old).toMatchObject({ whtPt: 0, tax5Pt: egp(10), invoiceTotalPt: egp(1140), netPt: egp(190) });
    // فرد من غير ضرايب: مفيش استقطاع
    expect(contractMonth({ clientBasePt: egp(1000), supplierCostPt: egp(800), contractExpensesPt: 0, vatApplies: false, tax5Applies: false, vatBp: 1400, tax5Bp: 500, whtBp: 300 })).toMatchObject({ whtPt: 0, invoiceTotalPt: egp(1000) });
  });

  it("من نوفمبر ٢٠٢٦ في الحسابات: الفاتورة والتحصيل والضرايب", () => {
    const db = freshDb();
    expect(withholdingAt(db, "2026-10-31")).toBeNull();
    expect(withholdingAt(db, "2026-11-01")).toBe(300);
    const supplier = createSupplier(db, { name: "صاحب المعدة" });
    const eq = createEquipment(db, { name: "لودر", supplierId: supplier, siteName: "الموقع" });
    const client = createClient(db, { kind: "company", name: "شركة" });
    const contract = createContract(db, { clientId: client, equipmentId: eq, unit: "day", clientRatePt: egp(1000), supplierRatePt: egp(800), startDate: "2026-10-01" });
    for (const [a, b] of [["2026-10-01", "2026-10-10"], ["2026-11-01", "2026-11-10"]]) {
      fillRange(db, contract, "client", a, b, {});
      fillRange(db, contract, "supplier", a, b, {});
    }
    recordClientPayment(db, { clientId: client, date: "2026-11-20", amountPt: egp(11_400 + 5_550) }); // أكتوبر كامل + نص نوفمبر
    const books = computeBooks(db, "2026-11-30");
    const oct = books.months.find((m) => m.month === "2026-10")!.contracts[0];
    const nov = books.months.find((m) => m.month === "2026-11")!.contracts[0];
    expect([oct.tax5Pt, oct.whtPt, oct.invoiceTotalPt]).toEqual([egp(100), 0, egp(11_400)]);
    expect([nov.tax5Pt, nov.whtPt, nov.invoiceTotalPt, nov.netPt]).toEqual([0, egp(300), egp(11_100), egp(1_700)]);
    const novInv = books.invoices.find((i) => i.month === "2026-11")!;
    expect(novInv.collectedPt).toBe(egp(5_550));
    expect(novInv.collectedVatPt).toBe(egp(700)); // نص الـ ١٤٪
    expect(books.tax.tax5AccruedPt).toBe(egp(100)); // الـ ٥٪ بتاعة أكتوبر بس
    expect(books.tax.vatInvoicedPt).toBe(egp(2_800));
    const st = clientStatement(db, client, "2026-11-30", books);
    expect(st.totals).toMatchObject({ basePt: egp(20_000), vatPt: egp(2_800), whtPt: egp(300), invoicedPt: egp(22_500), remainingPt: egp(5_550) });
  });

  it("النسبة والتاريخ بيتغيروا من الإعدادات", () => {
    const db = freshDb();
    setWithholding(db, "2027-01-01", 100);
    expect(withholdingAt(db, "2026-12-15")).toBe(300);
    expect(withholdingAt(db, "2027-01-02")).toBe(100);
    setWithholding(db, "2027-01-01", 200);
    expect(withholdingAt(db, "2027-02-01")).toBe(200);
  });
});
