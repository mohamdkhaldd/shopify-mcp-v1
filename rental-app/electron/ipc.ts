import { Db, UserError } from "../core/db";
import { contractOptions, dashboardView, sarkiView, suppliersView } from "../core/services/views";
import { deleteEntity, deletePreview, restoreDeleted } from "../core/services/deletion";
import { createEquipment, createSupplier, newContract, NewContractInput, updateEquipment, updateSupplier } from "../core/services/master";
import { recordSupplierDeduction, recordSupplierPayment } from "../core/services/ledger";
import { applyOvertime, clearRange, DayPatch, fillRange, getPartySheet, setSupplierRate, Side, upsertDay } from "../core/services/sarki";

// Every screen call goes through one channel ("core:call") to a named function
// here. Only names listed in this registry can be called from the window.
// Errors come back as { ok: false, message } so Arabic messages reach the
// screen untouched (Electron prefixes thrown errors otherwise).
export function makeRegistry(db: Db) {
  return {
    dashboard: (a: { month?: string }) => dashboardView(db, a.month),

    // السركي
    sarki: (a: { contractId?: number; month?: string }) => sarkiView(db, a.contractId, a.month),
    contractOptions: () => contractOptions(db),
    newContract: (a: NewContractInput) => newContract(db, a),
    upsertDay: (a: { contractId: number; date: string; side: Side; patch: DayPatch }) => upsertDay(db, a.contractId, a.date, a.side, a.patch),
    fillRange: (a: { contractId: number; from: string; to: string; dayRatePt?: number | null; siteName?: string | null; baseHoursMilli?: number }) =>
      fillRange(db, a.contractId, "client", a.from, a.to, { dayRatePt: a.dayRatePt, siteName: a.siteName, baseHoursMilli: a.baseHoursMilli }),
    clearRange: (a: { contractId: number; from: string; to: string; reason: string }) => clearRange(db, a.contractId, "client", a.from, a.to, a.reason),
    applyOvertime: (a: { contractId: number; month: string; days: string; hoursMilli: number; ratePt: number | null }) =>
      applyOvertime(db, a.contractId, "client", a.month, a.days, a.hoursMilli, a.ratePt),
    setSupplierRate: (a: { contractId: number; from: string; to: string; dayRatePt?: number | null; overtimeRatePt?: number | null }) =>
      setSupplierRate(db, a.contractId, a.from, a.to, { dayRatePt: a.dayRatePt, overtimeRatePt: a.overtimeRatePt }),

    // أصحاب المعدات
    suppliers: (a: { supplierId?: number }) => suppliersView(db, a.supplierId),
    createSupplier: (a: { name: string; phone?: string }) => createSupplier(db, a),
    updateSupplier: (a: { id: number; name: string; phone?: string | null }) => updateSupplier(db, a.id, a),
    createEquipment: (a: { name: string; supplierId: number; siteName?: string; supplierRatePt?: number }) => createEquipment(db, a),
    updateEquipment: (a: { id: number; name: string; siteName?: string | null; supplierRatePt?: number | null }) => updateEquipment(db, a.id, a),
    partySheet: (a: { contractId: number; month: string; side: Side }) => getPartySheet(db, a.contractId, a.month, a.side),
    supplierPayment: (a: { supplierId: number; contractId?: number | null; date: string; amountPt: number; note?: string; confirmNegative?: boolean }) =>
      recordSupplierPayment(db, a, { confirmNegative: a.confirmNegative }),
    supplierDeduction: (a: { supplierId: number; contractId?: number | null; date: string; amountPt: number; note: string; paidFromTreasury?: boolean; confirmNegative?: boolean }) =>
      recordSupplierDeduction(db, a, { confirmNegative: a.confirmNegative }),

    // حذف
    deletePreview: (a: { entity: Parameters<typeof deletePreview>[1]; id: number }) => deletePreview(db, a.entity, a.id),
    delete: (a: { entity: Parameters<typeof deleteEntity>[1]; id: number }) => deleteEntity(db, a.entity, a.id),
    restore: (a: { batch: string }) => restoreDeleted(db, a.batch),
  };
}

export type Registry = ReturnType<typeof makeRegistry>;

export function callCore(registry: Registry, fn: string, args: unknown) {
  const f = (registry as Record<string, (a: unknown) => unknown>)[fn];
  if (!f) return { ok: false, message: `unknown call ${fn}` };
  try {
    return { ok: true, value: f(args ?? {}) };
  } catch (err) {
    if (err instanceof UserError) return { ok: false, message: err.message, code: err.code };
    // SQLite RAISE(ABORT, '...') messages from the guard triggers are Arabic and meant for the user
    const msg = String((err as Error)?.message ?? err);
    if (/[؀-ۿ]/.test(msg)) return { ok: false, message: msg, code: "db" };
    if (msg.includes("UNIQUE")) return { ok: false, message: "فيه حاجة متسجلة بنفس الاسم قبل كده", code: "unique" };
    console.error(err);
    return { ok: false, message: "حصلت مشكلة غير متوقعة — جرّب تاني", code: "internal" };
  }
}
