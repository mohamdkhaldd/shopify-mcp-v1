import { describe, expect, it } from "vitest";
import { freshDb, egp } from "./helpers";
import { assistantApply, assistantContext, assistantFacts, assistantPreview, hasDelete, normalizeName } from "../core/ai/assistant";
import { computeBooks } from "../core/services/books";
import { supplierStatement } from "../core/services/reports";
import { recordCapital } from "../core/services/ledger";
import { createInvestor } from "../core/services/master";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const count = (db: any, t: string) => (db.prepare(`SELECT COUNT(*) n FROM ${t} WHERE deleted_at IS NULL`).get() as { n: number }).n;

describe("المساعد", () => {
  it("دخلت لودر صاحبه محمد لشركة النور: صاحب معدة + شركة + معدة + عقد في خطوة واحدة", () => {
    const db = freshDb({ withholding: true });
    const actions = [
      { type: "contract" as const, equipment: "لودر 950", supplier: "محمد علي", client: "شركة النور", clientKind: "company" as const, unit: "day" as const, clientRate: 1500, supplierRate: 1200, startDate: "2026-10-01", site: "التجمع" },
    ];
    const p = assistantPreview(db, actions);
    expect(p.ok).toBe(true);
    if (p.ok) expect(p.lines.join("\n")).toMatch(/صاحب معدة جديد: محمد علي[\s\S]*عقد جديد: لودر 950 مع شركة النور/);
    // المعاينة مبتسجلش حاجة
    expect([count(db, "suppliers"), count(db, "clients"), count(db, "contracts")]).toEqual([0, 0, 0]);
    assistantApply(db, actions);
    expect([count(db, "suppliers"), count(db, "clients"), count(db, "equipment"), count(db, "contracts")]).toEqual([1, 1, 1, 1]);
    const c = db.prepare("SELECT unit, client_rate_pt, supplier_rate_pt, start_date, site_name FROM contracts").get();
    expect(c).toEqual({ unit: "day", client_rate_pt: egp(1500), supplier_rate_pt: egp(1200), start_date: "2026-10-01", site_name: "التجمع" });
  });

  it("الأسماء الموجودة بتتلقى حتى لو اتكتبت بهمزة مختلفة، ومبيتكررش", () => {
    const db = freshDb({ withholding: true });
    assistantApply(db, [{ type: "contract", equipment: "بوكلين", supplier: "أحمد", client: "شركة الأمل", unit: "day", clientRate: 2000, supplierRate: 1700, startDate: "2026-10-01" }]);
    assistantApply(db, [{ type: "contract", equipment: "لودر", supplier: "احمد", client: "شركه الامل", unit: "day", clientRate: 1500, supplierRate: 1200, startDate: "2026-10-05" }]);
    expect([count(db, "suppliers"), count(db, "clients"), count(db, "equipment"), count(db, "contracts")]).toEqual([1, 1, 2, 2]);
    expect(normalizeName(" شركة  الأمل ")).toBe(normalizeName("شركه الامل"));
  });

  it("صرفت ٢٠٠٠ للسواق و١٥٠٠ زيت لمعدة محمد: كله يتسجل في مكانه", () => {
    const db = freshDb({ withholding: true });
    recordCapital(db, { investorId: createInvestor(db, { name: "م" }), kind: "deposit", date: "2026-10-01", amountPt: egp(100_000) });
    assistantApply(db, [
      { type: "contract", equipment: "لودر", supplier: "محمد", client: "النور", unit: "day", clientRate: 1500, supplierRate: 1200, startDate: "2026-10-01" },
      { type: "work_days", equipment: "لودر", from: "2026-10-01", to: "2026-10-10" },
      { type: "driver", driver: "أحمد السواق", equipment: "لودر", payKind: "month", rate: 6000, startDate: "2026-10-01" },
    ]);
    const lines = assistantApply(db, [
      { type: "driver_payment", driver: "احمد السواق", amount: 2000, date: "2026-10-05", note: "سلفة" },
      { type: "supplier_deduction", equipment: "لودر", amount: 1500, date: "2026-10-06", note: "زيت هيدروليك" },
      { type: "expense", amount: 300, date: "2026-10-07", note: "بنزين عربية", category: "مواصلات" },
    ]);
    expect(lines).toHaveLength(4); // + بند مصروف جديد
    const supplierId = (db.prepare("SELECT id FROM suppliers").get() as { id: number }).id;
    const st = supplierStatement(db, supplierId, "2026-10-31");
    // ١٠ أيام × ١٢٠٠ = ١٢٠٠٠ − ٢٠٠٠ للسواق − ١٥٠٠ زيت
    expect(st.totals).toMatchObject({ fromSarkiPt: egp(12_000), deductionsPt: egp(3_500), remainingPt: egp(8_500) });
    expect(computeBooks(db, "2026-10-31").treasury.balancePt).toBe(egp(100_000 - 2_000 - 1_500 - 300));
  });

  it("لو حاجة غلط مفيش ولا حاجة بتتسجل، والرسالة واضحة", () => {
    const db = freshDb({ withholding: true });
    const bad = [
      { type: "supplier" as const, supplier: "حسن" },
      { type: "client_payment" as const, client: "شركة مش موجودة", amount: 5000 },
    ];
    expect(assistantPreview(db, bad)).toEqual({ ok: false, message: "مش لاقي شركة باسم «شركة مش موجودة»" });
    expect(() => assistantApply(db, bad)).toThrow("مش لاقي شركة");
    expect(count(db, "suppliers")).toBe(0);
    expect(assistantPreview(db, [{ type: "contract", equipment: "لودر", client: "س", unit: "day", clientRate: 100, supplierRate: 90 }])).toEqual({
      ok: false,
      message: "المعدة «لودر» جديدة — قول صاحبها مين",
    });
  });

  it("السياق: الأسماء الموجودة بتتبعت للذكاء الاصطناعي", () => {
    const db = freshDb({ withholding: true });
    assistantApply(db, [{ type: "contract", equipment: "لودر", supplier: "محمد", client: "النور", unit: "day", clientRate: 1500, supplierRate: 1200, startDate: "2026-10-01" }]);
    const ctx = assistantContext(db);
    expect(ctx.suppliers).toEqual(["محمد"]);
    expect(ctx.equipment).toEqual([{ name: "لودر", supplier: "محمد" }]);
    expect(ctx.contracts[0]).toMatchObject({ equipment: "لودر", client: "النور", supplier: "محمد" });
    expect(ctx.accounts.map((a) => a.key)).toContain("cash");
  });

  it("المسح بالاسم: المعاينة بتقول هيتمسح إيه، والمسح بيشيل العقد", () => {
    const db = freshDb({ withholding: true });
    assistantApply(db, [{ type: "contract", equipment: "لودر", supplier: "محمد", client: "النور", unit: "day", clientRate: 1500, supplierRate: 1200, startDate: "2026-10-01" }]);
    const del = [{ type: "delete" as const, target: "contract" as const, equipment: "لودر", client: "النور" }];
    expect(hasDelete(del)).toBe(true);
    const p = assistantPreview(db, del);
    expect(p.ok).toBe(true);
    expect(count(db, "contracts")).toBe(1);
    assistantApply(db, del);
    expect(count(db, "contracts")).toBe(0);
    expect(assistantPreview(db, [{ type: "delete", target: "supplier", supplier: "حد مش موجود" }]).ok).toBe(false);
  });

  it("الأرقام: facts فيها الشهور ورأس المال", () => {
    const db = freshDb({ withholding: true });
    recordCapital(db, { investorId: createInvestor(db, { name: "م" }), kind: "deposit", date: "2026-10-01", amountPt: egp(100_000) });
    const f = assistantFacts(db) as Record<string, unknown>;
    expect(f).toHaveProperty("capital");
    expect(f).toHaveProperty("treasury");
    expect(Array.isArray((f as { months?: unknown }).months)).toBe(true);
  });
});
