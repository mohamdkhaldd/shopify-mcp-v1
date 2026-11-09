import { describe, expect, it } from "vitest";
import { freshDb, egp } from "./helpers";
import { createEquipment, createSupplier, newContract, renameContract } from "../core/services/master";
import { sarkiView, settingsView } from "../core/services/views";

const setPlan = (db: ReturnType<typeof freshDb>, key: string | null, max: number | null) => {
  const up = db.prepare("INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value");
  up.run("plan_key", key);
  up.run("plan_max_equipment", max == null ? null : String(max));
};

describe("subscription plans (rental)", () => {
  it("blocks the 6th equipment on the 1–5 plan and names the next plan with prices", () => {
    const db = freshDb();
    setPlan(db, "p5", 5);
    const sup = createSupplier(db, { name: "ص" });
    for (let i = 1; i <= 5; i++) createEquipment(db, { name: `معدة ${i}`, supplierId: sup });
    expect(() => createEquipment(db, { name: "معدة 6", supplierId: sup })).toThrow(/الباقة بتاعتك خلصت.*٦–١٠.*1,000 ج/s);
    expect(settingsView(db).plan).toMatchObject({ key: "p5", limit: 5, used: 5 });
  });

  it("no plan / top plan = no limit", () => {
    const db = freshDb();
    setPlan(db, "p20plus", null);
    const sup = createSupplier(db, { name: "ص" });
    for (let i = 1; i <= 25; i++) createEquipment(db, { name: `معدة ${i}`, supplierId: sup });
    expect(settingsView(db).plan).toMatchObject({ key: "p20plus", limit: null, used: 25 });
  });
});

describe("contract name", () => {
  it("shows in the contract picker and can be changed", () => {
    const db = freshDb();
    const id = newContract(db, {
      client: { kind: "individual", name: "م" },
      equipment: { name: "مان لفت", supplier: { name: "ص" } },
      unit: "day",
      clientRatePt: egp(3000),
      supplierRatePt: egp(2000),
      startDate: "2026-10-01",
      name: "مان لفت التجمع",
    }) as number;
    const v = sarkiView(db, id, undefined, "2026-10-15");
    expect(v.contracts[0].code).toMatch(/^مان لفت التجمع \(ع-2026-001\)$/);
    expect(v.contract!.name).toBe("مان لفت التجمع");
    renameContract(db, id, "");
    expect(sarkiView(db, id, undefined, "2026-10-15").contracts[0].code).toBe("ع-2026-001");
  });
});
