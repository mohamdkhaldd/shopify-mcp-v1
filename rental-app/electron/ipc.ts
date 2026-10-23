import { Db, UserError } from "../core/db";
import { dashboardView } from "../core/services/views";
import { deleteEntity, deletePreview, restoreDeleted } from "../core/services/deletion";

// Every screen call goes through one channel ("core:call") to a named function
// here. Only names listed in this registry can be called from the window.
// Errors come back as { ok: false, message } so Arabic messages reach the
// screen untouched (Electron prefixes thrown errors otherwise).
export function makeRegistry(db: Db) {
  return {
    dashboard: (a: { month?: string }) => dashboardView(db, a.month),
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
    console.error(err);
    return { ok: false, message: "حصلت مشكلة غير متوقعة — جرّب تاني", code: "internal" };
  }
}
