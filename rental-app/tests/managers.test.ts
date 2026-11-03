import { describe, expect, it } from "vitest";
import { freshDb, egp } from "./helpers";
import { newContract } from "../core/services/master";
import { fillRange } from "../core/services/sarki";
import { setContractManagers } from "../core/services/managers";
import { managementView } from "../core/services/views";
import { recordClientPayment, recordPayout } from "../core/services/ledger";

// شركاء الإدارة: كل عقد ليه شركاء بنسب، وآخر الشهر كل واحد له كام من كل عقد وتوتال.
describe("management partners per contract", () => {
  it("splits each contract's management share by its partners, and sums per person", () => {
    const db = freshDb();
    const mk = (eq: string, client: number, supplier: number) =>
      newContract(db, {
        client: { kind: "individual", name: `عميل ${eq}` },
        equipment: { name: eq, supplier: { name: `صاحب ${eq}` } },
        unit: "day",
        clientRatePt: egp(client),
        supplierRatePt: egp(supplier),
        startDate: "2026-10-01",
      }) as number;
    const a = mk("لودر", 3000, 2000); // 10 أيام → هامش 10,000
    const b = mk("كرين", 5000, 3000); // 10 أيام → هامش 20,000
    fillRange(db, a, "client", "2026-10-01", "2026-10-10", {});
    fillRange(db, b, "client", "2026-10-01", "2026-10-10", {});

    setContractManagers(db, a, [
      { name: "أحمد", shareBp: 3333 },
      { name: "محمد", shareBp: 3333 },
      { name: "علي", shareBp: 3334 },
    ]);
    setContractManagers(db, b, [
      { name: "أحمد", shareBp: 5000 },
      { name: "سامي", shareBp: 5000 },
    ]);
    expect(() => setContractManagers(db, b, [{ name: "أحمد", shareBp: 6000 }])).toThrow();

    const v = managementView(db, "2026-10", "2026-10-31");
    const mgmt = v.totals.managementPt;
    expect(mgmt).toBeGreaterThan(0);
    const byContract = new Map(v.managers.contracts.map((c) => [c.contractId, c.managementPt]));
    expect(byContract.get(a)! + byContract.get(b)!).toBe(mgmt);
    expect(byContract.get(b)).toBe(byContract.get(a)! * 2);

    const p = new Map(v.managers.people.map((x) => [x.name, x]));
    expect([...p.keys()].sort()).toEqual(["أحمد", "سامي", "علي", "محمد"].sort());
    expect(v.managers.people.reduce((s, x) => s + x.monthPt, 0)).toBe(mgmt);
    const ahmed = p.get("أحمد")!;
    expect(ahmed.byContract.map((x) => x.contractId).sort()).toEqual([a, b].sort());
    expect(ahmed.monthPt).toBe(ahmed.byContract.reduce((s, x) => s + x.amountPt, 0));
    expect(p.get("سامي")!.monthPt).toBe(byContract.get(b)! / 2);
    expect(v.managers.unassignedPt).toBe(0);

    // صرف لشخص معين بيتخصم من الباقي له
    const clients = db.prepare("SELECT id FROM clients ORDER BY id").all() as { id: number }[];
    recordClientPayment(db, { clientId: clients[0].id, date: "2026-10-31", amountPt: egp(30_000) });
    recordClientPayment(db, { clientId: clients[1].id, date: "2026-10-31", amountPt: egp(50_000) });
    recordPayout(db, { payee: "management", managerName: "سامي", date: "2026-10-31", amountPt: egp(1000) }, { confirmNegative: true });
    const after = managementView(db, "2026-10", "2026-10-31").managers.people.find((x) => x.name === "سامي")!;
    expect(after.paidPt).toBe(egp(1000));
    expect(after.balancePt).toBe(after.accruedPt - egp(1000));

    // تغيير الشركاء بيبدّل القديم
    setContractManagers(db, a, []);
    const later = managementView(db, "2026-10", "2026-10-31");
    expect(later.managers.unassignedPt).toBe(byContract.get(a));
    expect(later.managers.people.find((x) => x.name === "علي")).toBeUndefined();
  });
});
