import { describe, expect, it } from "vitest";
import { freshDb, egp } from "./helpers";
import { createClient, createInvestor, createSupplier } from "../core/services/master";
import { markDelivered, recordHold, returnHold, recordCapital, recordClientPayment, recordSupplierPayment, recordTransfer, transferFee } from "../core/services/ledger";
import { computeBooks } from "../core/services/books";
import { treasuryView, suppliersView } from "../core/services/views";
import { deleteEntity } from "../core/services/deletion";

// خزنة التأجير: حسابين (انستا باي ومحفظة)، الفلوس اللي لسه مع حد، والتحويل
// من انستا باي بعمولة (٠٫١٪، أقل حاجة ٥٠ قرش، أقصى ٢٠ ج) — الدفع من غير عمولة.
describe("rental treasury accounts", () => {
  it("instapay fee: 0.1% between 0.5 and 20 pounds", () => {
    const db = freshDb();
    expect(transferFee(db, "instapay", egp(100))).toBe(50);
    expect(transferFee(db, "instapay", egp(5_000))).toBe(egp(5));
    expect(transferFee(db, "instapay", egp(50_000))).toBe(egp(20));
    expect(transferFee(db, "wallet", egp(50_000))).toBe(0);
    expect(transferFee(db, "cash", egp(50_000))).toBe(0);
  });

  it("three accounts: instapay, wallet, cash", () => {
    const db = freshDb();
    const keys = (db.prepare("SELECT key, name FROM treasury_accounts WHERE deleted_at IS NULL ORDER BY sort").all() as { key: string; name: string }[]);
    expect(keys).toEqual([{ key: "instapay", name: "انستا باي" }, { key: "wallet", name: "محفظة" }, { key: "cash", name: "كاش" }]);
  });

  it("balances per account, held money, transfer fee, and delete takes the fee along", () => {
    const db = freshDb();
    const inv = createInvestor(db, { name: "م" });
    const client = createClient(db, { kind: "individual", name: "ع" });
    const sup = createSupplier(db, { name: "ص" });
    recordCapital(db, { investorId: inv, kind: "deposit", date: "2026-10-01", amountPt: egp(100_000), account: "instapay" });
    recordCapital(db, { investorId: inv, kind: "deposit", date: "2026-10-01", amountPt: egp(20_000), account: "wallet" });
    // العميل دفع 10,000 بس لسه مع "كريم"
    recordClientPayment(db, { clientId: client, date: "2026-10-05", amountPt: egp(10_000), account: "wallet", heldBy: "كريم" });
    let t = computeBooks(db, "2026-10-31").treasury;
    expect(t.balancePt).toBe(egp(120_000));
    expect(t.heldPt).toBe(egp(10_000));

    const held = treasuryView(db, {}, "2026-10-31").held[0];
    expect(held.heldBy).toBe("كريم");
    markDelivered(db, held.id, "2026-10-07");
    t = computeBooks(db, "2026-10-31").treasury;
    expect(t.balancePt).toBe(egp(130_000));
    expect(t.heldPt).toBe(0);

    // دفعة لصاحب المعدة "تحويل" من انستا باي: 5,000 + عمولة 5 ج — و"دفع" من غير عمولة
    const p1 = recordSupplierPayment(db, { supplierId: sup, date: "2026-10-10", amountPt: egp(5_000), account: "instapay", transferFee: true }, { confirmNegative: true });
    recordSupplierPayment(db, { supplierId: sup, date: "2026-10-11", amountPt: egp(5_000), account: "instapay", transferFee: false }, { confirmNegative: true });
    recordTransfer(db, { date: "2026-10-12", from: "instapay", to: "wallet", amountPt: egp(10_000), transferFee: true });
    const acc = (k: string) => computeBooks(db, "2026-10-31").treasury.byAccount.find((a) => a.key === k)!.balancePt;
    expect(acc("instapay")).toBe(egp(100_000 - 5_000 - 5 - 5_000 - 10_000 - 10));
    expect(acc("wallet")).toBe(egp(20_000 + 10_000 + 10_000));
    expect(suppliersView(db, sup, "2026-10-31").selected!.payments.find((p) => p.id === p1)!.note).toContain("عمولة تحويل 5");

    // حذف الدفعة بيحذف عمولتها معاها
    deleteEntity(db, "supplier_payments", p1);
    expect(acc("instapay")).toBe(egp(100_000 - 5_000 - 10_000 - 10));
    // فلتر الحساب بيطلع رصيد الحساب ده بالتحويلات
    const w = treasuryView(db, { account: "wallet" }, "2026-10-31");
    expect(w.rows[w.rows.length - 1].balancePt).toBe(egp(40_000));
  });

  it("money already in the treasury that a partner holds leaves the balance until it comes back", () => {
    const db = freshDb();
    const inv = createInvestor(db, { name: "م" });
    recordCapital(db, { investorId: inv, kind: "deposit", date: "2026-10-01", amountPt: egp(100_000), account: "instapay" });
    const h = recordHold(db, { date: "2026-10-10", account: "instapay", amountPt: egp(30_000), heldBy: "م. كريم" });
    let t = computeBooks(db, "2026-10-31").treasury;
    expect(t.balancePt).toBe(egp(70_000));
    expect(t.byAccount.find((a) => a.key === "instapay")!.balancePt).toBe(egp(70_000));
    expect(t.heldPt).toBe(egp(30_000));
    expect(treasuryView(db, {}, "2026-10-31").held[0]).toMatchObject({ source: "hold", heldBy: "م. كريم" });
    returnHold(db, h, "2026-10-20");
    t = computeBooks(db, "2026-10-31").treasury;
    expect(t.balancePt).toBe(egp(100_000));
    expect(t.heldPt).toBe(0);
    // قبل ما ترجع (يوم ١٥) كانت لسه برا
    expect(computeBooks(db, "2026-10-15").treasury.balancePt).toBe(egp(70_000));
    const rows = treasuryView(db, { account: "instapay" }, "2026-10-31").rows;
    expect(rows[rows.length - 1].balancePt).toBe(egp(100_000));
  });
});
