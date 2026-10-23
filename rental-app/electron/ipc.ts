import { Db, UserError } from "../core/db";
import { contractOptions, dashboardView, sarkiView } from "../core/services/views";
import { deleteEntity, deletePreview, restoreDeleted } from "../core/services/deletion";
import { newContract, NewContractInput } from "../core/services/master";
import { applyOvertime, clearRange, DayPatch, fillRange, setSupplierRate, Side, upsertDay } from "../core/services/sarki";

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
    setSupplierRate: (a: { contractId: number; from: string; to: string; ratePt: number }) => setSupplierRate(db, a.contractId, a.from, a.to, a.ratePt),

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
