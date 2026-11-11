import { describe, expect, it } from "vitest";
import { freshDb, egp } from "./helpers";
import { assistantApply } from "../core/ai/assistant";
import { callCore, makeRegistry } from "../electron/ipc";

const setup = () => {
  const db = freshDb({ withholding: true });
  assistantApply(db, [{ type: "contract", equipment: "لودر", supplier: "محمد", client: "النور", unit: "day", clientRate: 4000, supplierRate: 3500, startDate: "2026-11-11" }]);
  const id = (db.prepare("SELECT id FROM contracts").get() as { id: number }).id;
  return { db, reg: makeRegistry(db), id };
};

describe("تعديل العقد", () => {
  it("تغيير البداية بس: الأسعار زي ما هي، والسطر بيقول اتغير إيه والباقي إيه", () => {
    const { db, reg, id } = setup();
    const r = callCore(db, reg, "updateContract", { id, startDate: "2026-11-01" }) as { ok: boolean; label: string };
    expect(r.ok).toBe(true);
    expect(r.label).toContain("البداية 2026-11-11 ← 2026-11-01");
    expect(r.label).toContain("وزي ما هو");
    expect(db.prepare("SELECT start_date, client_rate_pt, supplier_rate_pt FROM contracts").get()).toEqual({ start_date: "2026-11-01", client_rate_pt: egp(4000), supplier_rate_pt: egp(3500) });
    expect((db.prepare("SELECT COUNT(*) n FROM contracts").get() as { n: number }).n).toBe(1);
  });

  it("من المساعد بالجنيه، وبيترجع من سجل التعديلات", () => {
    const { db, reg, id } = setup();
    const actions = [{ type: "call", fn: "updateContract", args: { id, startDate: "2026-11-01", supplierRatePt: 3600 } }];
    const p = callCore(db, reg, "assistantPreview", { actions }) as { value: { ok: boolean; lines: string[] } };
    expect(p.value.lines[0]).toMatch(/سعر صاحب المعدة 3,500 ج ← 3,600 ج/);
    const r = callCore(db, reg, "assistantApply", { actions, summary: "تعديل" }) as { actionId: string };
    expect((db.prepare("SELECT supplier_rate_pt FROM contracts").get() as { supplier_rate_pt: number }).supplier_rate_pt).toBe(egp(3600));
    callCore(db, reg, "undo", { actionId: r.actionId });
    expect(db.prepare("SELECT start_date, supplier_rate_pt FROM contracts").get()).toEqual({ start_date: "2026-11-11", supplier_rate_pt: egp(3500) });
  });

  it("مبيسمحش البداية تبقى بعد أيام متسجلة", () => {
    const { db, reg, id } = setup();
    assistantApply(db, [{ type: "work_days", equipment: "لودر", from: "2026-11-11", to: "2026-11-12" }]);
    expect(callCore(db, reg, "updateContract", { id, startDate: "2026-11-12" })).toMatchObject({ ok: false });
    expect(callCore(db, reg, "updateContract", { id, endDate: "2026-11-11" })).toMatchObject({ ok: false });
  });
});
