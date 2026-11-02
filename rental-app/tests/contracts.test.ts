import { describe, expect, it } from "vitest";
import { freshDb, egp } from "./helpers";
import { endContract, newContract, reopenContract } from "../core/services/master";
import { sarkiView, suppliersView } from "../core/services/views";

// "العقد خلص": المعدة بتبقى فاضية عند صاحبها — بالزرار، أو لوحدها لما عقد بتاريخ نهاية يعدّي.
describe("ending a contract", () => {
  const working = (db: ReturnType<typeof freshDb>, now: string) => {
    const v = suppliersView(db, undefined, now);
    return v.selected!.equipment.map((e) => [e.name, e.working]);
  };

  it("an open contract: the button ends it, the equipment is free; reopen brings it back", () => {
    const db = freshDb();
    const id = newContract(db, {
      client: { kind: "company", name: "شركة" },
      equipment: { name: "لودر", supplier: { name: "صاحب" } },
      unit: "day",
      clientRatePt: egp(3000),
      supplierRatePt: egp(2500),
      startDate: "2026-09-01",
    }) as number;
    expect(working(db, "2026-10-15")).toEqual([["لودر", true]]);
    endContract(db, id, "2026-10-10");
    expect(working(db, "2026-10-15")).toEqual([["لودر", false]]);
    expect(sarkiView(db, id, undefined, "2026-10-15").contract!.status).toBe("ended");
    expect(() => endContract(db, id, "2026-08-01")).toThrow();
    reopenContract(db, id);
    expect(working(db, "2026-10-15")).toEqual([["لودر", true]]);
  });

  it("a contract with an end date is not working after that date", () => {
    const db = freshDb();
    const id = newContract(db, {
      client: { kind: "company", name: "شركة" },
      equipment: { name: "كرين", supplier: { name: "صاحب" } },
      unit: "day",
      clientRatePt: egp(3000),
      supplierRatePt: egp(2500),
      startDate: "2026-09-01",
      endDate: "2026-10-20",
    }) as number;
    expect(working(db, "2026-10-20")).toEqual([["كرين", true]]);
    expect(working(db, "2026-10-21")).toEqual([["كرين", false]]);
    expect(sarkiView(db, id, undefined, "2026-10-21").contract!.status).toBe("ended");
  });
});
