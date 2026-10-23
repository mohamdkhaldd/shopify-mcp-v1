import { describe, expect, it } from "vitest";
import { freshDb, egp } from "./helpers";
import { seedDemo } from "../core/demo";
import { activityView, runAction, undoAction } from "../core/services/activity";
import { recordClientPayment } from "../core/services/ledger";
import { getSheet, upsertDay } from "../core/services/sarki";
import { deleteEntity } from "../core/services/deletion";
import { computeBooks } from "../core/services/books";
import { closeMonth } from "../core/services/close";

describe("activity log and undo", () => {
  it("a payment and its treasury entry go back together", () => {
    const db = freshDb();
    const ids = seedDemo(db);
    const before = computeBooks(db, "2026-10-31").treasury.balancePt;
    const { actionId } = runAction(db, "دفعة من عميل 10,000", () => recordClientPayment(db, { clientId: ids.amal, date: "2026-10-25", amountPt: egp(10_000) }));
    expect(computeBooks(db, "2026-10-31").treasury.balancePt).toBe(before + egp(10_000));
    expect(activityView(db)[0]).toMatchObject({ label: "دفعة من عميل 10,000", changes: 2, canUndo: true });
    undoAction(db, actionId);
    expect(computeBooks(db, "2026-10-31").treasury.balancePt).toBe(before);
    const log = activityView(db);
    expect(log[0]).toMatchObject({ label: "تراجع: دفعة من عميل 10,000", canUndo: false, undo_of: actionId });
    expect(log[1]).toMatchObject({ undone: true, canUndo: false });
    expect(() => undoAction(db, actionId)).toThrow(/قبل كده/);
  });

  it("a sarki edit goes back on both sheets", () => {
    const db = freshDb();
    const ids = seedDemo(db);
    const { actionId } = runAction(db, "تعديل يوم 03", () => upsertDay(db, ids.contract, "2026-10-03", "client", { actualHoursMilli: 10_000 }));
    expect(getSheet(db, ids.contract, "2026-10", "supplier").totals.overtimeMilli).toBe(2000);
    undoAction(db, actionId);
    expect(getSheet(db, ids.contract, "2026-10", "client").totals.totalPt).toBe(egp(90_000));
    expect(getSheet(db, ids.contract, "2026-10", "supplier").totals.overtimeMilli).toBe(0);
  });

  it("a delete comes back with everything it took", () => {
    const db = freshDb();
    const ids = seedDemo(db);
    const { actionId } = runAction(db, "حذف العقد", () => deleteEntity(db, "contracts", ids.contract));
    expect(computeBooks(db, "2026-10-31").months[0].contracts).toHaveLength(0);
    undoAction(db, actionId);
    expect(computeBooks(db, "2026-10-31").months[0].contracts[0].netPt).toBe(egp(13_000));
  });

  it("closing a month can't be undone, and a change that saved nothing leaves no line", () => {
    const db = freshDb();
    seedDemo(db);
    const { actionId } = runAction(db, "قفل أكتوبر", () => closeMonth(db, "2026-10", "2026-11-02"));
    expect(activityView(db)[0]).toMatchObject({ canUndo: false });
    expect(() => undoAction(db, actionId)).toThrow(/مينفعش/);
    const n = activityView(db).length;
    runAction(db, "ولا حاجة", () => 1);
    expect(activityView(db)).toHaveLength(n);
  });
});
