import { describe, expect, it } from "vitest";
import { freshDb, egp } from "./helpers";
import { wipeCompanyData } from "../core/services/reset";
import { setupDatabase } from "../core/schema";
import { assistantApply } from "../core/ai/assistant";
import { recordCapital } from "../core/services/ledger";
import { createInvestor } from "../core/services/master";

const n = (db: any, t: string) => (db.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get() as { n: number }).n;

describe("تصفير البرنامج على الجهاز", () => {
  it("بيمسح كل البيانات والسجل، والترخيص والإعدادات بيفضلوا، والبرنامج يفتح عادي بعدها", () => {
    const db = freshDb({ withholding: true });
    db.prepare("INSERT INTO app_settings (key, value) VALUES ('license_token', 'tok'), ('data_epoch', '3')").run();
    recordCapital(db, { investorId: createInvestor(db, { name: "م" }), kind: "deposit", date: "2026-10-01", amountPt: egp(1000) });
    assistantApply(db, [{ type: "contract", equipment: "لودر", supplier: "محمد", client: "النور", unit: "day", clientRate: 1500, supplierRate: 1200, startDate: "2026-10-01" }]);
    expect(n(db, "contracts")).toBe(1);
    wipeCompanyData(db);
    for (const t of ["contracts", "suppliers", "clients", "equipment", "investors", "capital_movements", "treasury_entries", "audit_log", "treasury_accounts"]) expect(n(db, t)).toBe(0);
    expect(db.prepare("SELECT value FROM app_settings WHERE key = 'license_token'").get()).toEqual({ value: "tok" });
    // فتح البرنامج تاني: الحمايات والقيم الأساسية بترجع
    setupDatabase(db);
    expect(n(db, "treasury_accounts")).toBe(4);
    expect(() => db.prepare("DELETE FROM treasury_accounts").run()).toThrow("مفيش مسح");
    assistantApply(db, [{ type: "supplier", supplier: "جديد" }]);
    expect(n(db, "suppliers")).toBe(1);
  });
});
