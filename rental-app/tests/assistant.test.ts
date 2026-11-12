import { describe, expect, it } from "vitest";
import { freshDb, egp } from "./helpers";
import { assistantApply, assistantContext, assistantFacts, assistantPreview, hasDelete, normalizeName } from "../core/ai/assistant";
import { computeBooks } from "../core/services/books";
import { supplierStatement } from "../core/services/reports";
import { recordCapital } from "../core/services/ledger";
import { createInvestor } from "../core/services/master";
import { callCore, makeRegistry, assistantDeletesRegistry } from "../electron/ipc";

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
    expect(ctx.suppliers.map((x) => x.name)).toEqual(["محمد"]);
    expect(ctx.equipment[0]).toMatchObject({ name: "لودر", supplier: "محمد" });
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

  it("أي دالة في البرنامج (call): تعديل تليفون ودفعة بالجنيه، مع معاينة وتراجع", () => {
    const db = freshDb({ withholding: true });
    recordCapital(db, { investorId: createInvestor(db, { name: "م" }), kind: "deposit", date: "2026-10-01", amountPt: egp(50_000) });
    assistantApply(db, [{ type: "contract", equipment: "لودر", supplier: "محمد", client: "النور", unit: "day", clientRate: 1500, supplierRate: 1200, startDate: "2026-10-01" }]);
    const reg = makeRegistry(db);
    const sid = (db.prepare("SELECT id FROM suppliers").get() as { id: number }).id;
    const actions = [
      { type: "call" as const, fn: "updateSupplier", args: { id: sid, name: "محمد علي", phone: "01012345678" } },
      { type: "call" as const, fn: "supplierPayment", args: { supplierId: sid, date: "2026-10-02", amountPt: 1000, account: "instapay" } },
    ];
    const p = callCore(db, reg, "assistantPreview", { actions });
    expect(p).toMatchObject({ ok: true, value: { ok: true, lines: ["تعديل صاحب معدة: محمد علي", "دفعة لصاحب معدة 1,000 ج"] } });
    expect((db.prepare("SELECT name FROM suppliers").get() as { name: string }).name).toBe("محمد");
    const r = callCore(db, reg, "assistantApply", { actions, summary: "تجربة" });
    expect(r.ok).toBe(true);
    expect(db.prepare("SELECT name, phone FROM suppliers").get()).toEqual({ name: "محمد علي", phone: "01012345678" });
    expect((db.prepare("SELECT amount_pt FROM supplier_payments").get() as { amount_pt: number }).amount_pt).toBe(egp(1000));
    // الرسالة كلها بتترجع مرة واحدة
    expect(callCore(db, reg, "undo", { actionId: (r as { actionId: string }).actionId }).ok).toBe(true);
    expect((db.prepare("SELECT name FROM suppliers").get() as { name: string }).name).toBe("محمد");
    expect(count(db, "supplier_payments")).toBe(0);
  });

  it("دالة مش في القايمة مرفوضة، والمسح بالـ id محتاج باسورد", () => {
    const db = freshDb({ withholding: true });
    assistantApply(db, [{ type: "contract", equipment: "لودر", supplier: "محمد", client: "النور", unit: "day", clientRate: 1500, supplierRate: 1200, startDate: "2026-10-01" }]);
    const reg = makeRegistry(db);
    expect(callCore(db, reg, "assistantApply", { actions: [{ type: "call", fn: "undo", args: {} }] })).toMatchObject({ ok: false });
    const cid = (db.prepare("SELECT id FROM clients").get() as { id: number }).id;
    recordClientPaymentFor(db, cid);
    const payId = (db.prepare("SELECT id FROM client_payments").get() as { id: number }).id;
    const del = [{ type: "call" as const, fn: "delete", args: { entity: "client_payments", id: payId } }];
    expect(callCore(db, reg, "assistantApply", { actions: del })).toMatchObject({ ok: false, message: "دي محتاجة باسورد الشركة" });
    expect(callCore(db, reg, "assistantPreview", { actions: del })).toMatchObject({ ok: true, value: { ok: true } });
    expect(callCore(db, assistantDeletesRegistry(db), "assistantApplyDeletes", { actions: del, summary: "مسح" }).ok).toBe(true);
    expect(count(db, "client_payments")).toBe(0);
  });

  it("القراية: النتيجة بالجنيه", () => {
    const db = freshDb({ withholding: true });
    recordCapital(db, { investorId: createInvestor(db, { name: "م" }), kind: "deposit", date: "2026-10-01", amountPt: egp(100_000) });
    const r = callCore(db, makeRegistry(db), "assistantRead", { fn: "treasury", args: {} }) as { ok: boolean; value: unknown };
    expect(r.ok).toBe(true);
    expect(JSON.stringify(r.value)).toContain("100000");
    expect(callCore(db, makeRegistry(db), "assistantRead", { fn: "createSupplier", args: { name: "x" } }).ok).toBe(false);
  });
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function recordClientPaymentFor(db: any, clientId: number) {
  makeRegistry(db).clientPayment({ clientId, date: "2026-10-05", amountPt: egp(5000) });
}

describe("المساعد بيرجّع اللي اتعمل بنفسه", () => {
  it("undo من المساعد بيرجّع الدفعة وبيبان في سجل التعديلات", () => {
    const db = freshDb({ withholding: true });
    const reg = makeRegistry(db);
    assistantApply(db, [{ type: "contract", equipment: "لودر", supplier: "محمد", client: "النور", unit: "day", clientRate: 1500, supplierRate: 1200, startDate: "2026-10-01" }]);
    const clientId = (db.prepare("SELECT id FROM clients").get() as { id: number }).id;
    const paid = callCore(db, reg, "clientPayment", { clientId, date: "2026-10-05", amountPt: egp(5000) }) as { ok: boolean; actionId: string };
    expect(paid.ok).toBe(true);
    expect(count(db, "client_payments")).toBe(1);
    const r = callCore(db, reg, "assistantApply", { actions: [{ type: "call", fn: "undo", args: { actionId: paid.actionId } }] }) as { ok: boolean; message?: string };
    expect(r).toMatchObject({ ok: true });
    expect(count(db, "client_payments")).toBe(0);
  });
});

describe("تذكيرات المساعد", () => {
  it("سركي مش متسجل من أيام + شهر فات مفتوح", async () => {
    const { assistantReminders } = await import("../core/ai/reminders");
    const db = freshDb({ withholding: true });
    assistantApply(db, [
      { type: "contract", equipment: "لودر", supplier: "محمد", client: "النور", unit: "day", clientRate: 1500, supplierRate: 1200, startDate: "2026-10-01" },
      { type: "work_days", equipment: "لودر", from: "2026-10-01", to: "2026-11-02" },
    ]);
    const r = assistantReminders(db, "2026-11-10");
    expect(r.map((x) => x.text).join("\n")).toMatch(/سركي لودر عند النور آخر يوم متسجل فيه 2\/11 \(من 8 يوم\)/);
    expect(r.map((x) => x.text).join("\n")).toMatch(/شهر أكتوبر 2026 لسه متقفلش/);
    expect(assistantReminders(db, "2026-11-03").length).toBe(0);
  });
});

describe("أيام الشغل من غير اسم المعدة", () => {
  it("بيلاقي المعدة من صاحبها لو عنده عقد واحد شغال", () => {
    const db = freshDb({ withholding: true });
    assistantApply(db, [{ type: "contract", equipment: "لودر", supplier: "محمد", client: "النور", unit: "day", clientRate: 1500, supplierRate: 1200, startDate: "2026-10-01" }]);
    const lines = assistantApply(db, [{ type: "work_days", supplier: "محمد", from: "2026-10-02", to: "2026-10-04" }]);
    expect(lines.join("\n")).toMatch(/أيام شغل للمعدة لودر: من 2026-10-02 لحد 2026-10-04/);
  });
});

describe("صاحبين معدة عندهم نفس النوع", () => {
  it("مان لفت 36 من أحمد = معدة جديدة لأحمد، مش معدة محمد", () => {
    const db = freshDb({ withholding: true });
    assistantApply(db, [{ type: "contract", equipment: "مان لفت 36", supplier: "محمد", client: "شركة سمير", unit: "day", clientRate: 3500, supplierRate: 3000, startDate: "2026-11-01" }]);
    const lines = assistantApply(db, [{ type: "contract", equipment: "مان لفت 36", supplier: "أحمد", client: "المقاولين", unit: "day", clientRate: 3500, supplierRate: 3000, startDate: "2026-11-12" }]);
    expect(lines.join("\n")).toMatch(/صاحب معدة جديد: أحمد[\s\S]*معدة جديدة: مان لفت 36 — صاحبها أحمد/);
    const owners = db.prepare("SELECT s.name FROM contracts c JOIN suppliers s ON s.id = c.supplier_id ORDER BY c.id").all() as { name: string }[];
    expect(owners.map((o) => o.name)).toEqual(["محمد", "أحمد"]);
    // من غير ما يتقال بتاع مين: بيسأل بدل ما يخمّن
    expect(() => assistantApply(db, [{ type: "work_days", equipment: "مان لفت 36", from: "2026-11-12", to: "2026-11-12" }])).toThrow(/فيه أكتر من «مان لفت 36»: بتاع محمد، بتاع أحمد/);
    // بالشركة أو بصاحبها بيلاقيها
    expect(assistantApply(db, [{ type: "work_days", equipment: "مان لفت 36", client: "المقاولين", from: "2026-11-12", to: "2026-11-12" }]).join()).toMatch(/مان لفت 36/);
    expect(assistantApply(db, [{ type: "work_days", equipment: "مان لفت 36", supplier: "محمد", from: "2026-11-05", to: "2026-11-06" }]).join()).toMatch(/مان لفت 36/);
  });
});
