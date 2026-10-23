import { Db, UserError } from "../core/db";
import { clientsView, contractOptions, dashboardView, investorsView, managementView, sarkiView, suppliersView, taxView, TreasuryFilters, treasuryView } from "../core/services/views";
import { closeMonth, recordAdjustment } from "../core/services/close";
import { today } from "../core/db";
import { deleteEntity, deletePreview, restoreDeleted } from "../core/services/deletion";
import { createClient, createEquipment, createExpenseCategory, createInvestor, createSupplier, updateInvestor, newContract, NewContractInput, setClientTaxes, updateClient, updateEquipment, updateSupplier } from "../core/services/master";
import { recordCapital, recordClientPayment, recordExpense, recordPayout, recordSupplierDeduction, recordSupplierPayment, recordTaxPayment, reinvestProfit } from "../core/services/ledger";
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

    // الشركات والأفراد
    clients: (a: { clientId?: number }) => clientsView(db, a.clientId),
    createClient: (a: { kind: "company" | "individual"; name: string; phone?: string; taxId?: string; vatApplies?: boolean; tax5Applies?: boolean }) => createClient(db, a),
    updateClient: (a: { id: number; kind: "company" | "individual"; name: string; phone?: string | null; taxId?: string | null }) => updateClient(db, a.id, a),
    setClientTaxes: (a: { id: number; vatApplies: boolean; tax5Applies: boolean }) => setClientTaxes(db, a.id, a.vatApplies, a.tax5Applies),
    clientPayment: (a: { clientId: number; contractId?: number | null; date: string; amountPt: number; note?: string }) => recordClientPayment(db, a),

    // الإدارة
    management: (a: { month?: string }) => managementView(db, a.month),
    createExpenseCategory: (a: { name: string }) => createExpenseCategory(db, a.name),
    expense: (a: { kind: "contract" | "general"; contractId?: number | null; categoryId?: number | null; date: string; amountPt: number; note?: string; confirmNegative?: boolean }) =>
      recordExpense(db, a, { confirmNegative: a.confirmNegative }),
    managementPayout: (a: { date: string; amountPt: number; note?: string; confirmNegative?: boolean }) =>
      recordPayout(db, { payee: "management", date: a.date, amountPt: a.amountPt, note: a.note }, { confirmNegative: a.confirmNegative }),
    closeMonth: (a: { month: string }) => {
      closeMonth(db, a.month, today());
    },
    adjustment: (a: { targetMonth: string; contractId: number; kind: "client_base" | "supplier_cost"; amountPt: number; reason: string }) =>
      recordAdjustment(db, { ...a, appliedMonth: today().slice(0, 7) }),

    // المستثمرين
    investors: (a: { month?: string }) => investorsView(db, a.month),
    createInvestor: (a: { name: string; phone?: string }) => createInvestor(db, a),
    updateInvestor: (a: { id: number; name: string; phone?: string | null }) => updateInvestor(db, a.id, a),
    capital: (a: { investorId: number; kind: "deposit" | "withdrawal"; date: string; amountPt: number; note?: string; confirmNegative?: boolean }) =>
      recordCapital(db, a, { confirmNegative: a.confirmNegative }),
    investorPayout: (a: { investorId: number; date: string; amountPt: number; note?: string; confirmNegative?: boolean }) =>
      recordPayout(db, { payee: "investor", investorId: a.investorId, date: a.date, amountPt: a.amountPt, note: a.note }, { confirmNegative: a.confirmNegative }),
    reinvest: (a: { investorId: number; date: string; amountPt: number }) => reinvestProfit(db, a),

    // الخزنة
    treasury: (a: TreasuryFilters) => treasuryView(db, a),

    // الملف الضريبي
    tax: () => taxView(db),
    taxPayment: (a: { tax: "vat" | "tax5"; periodMonth?: string; date: string; amountPt: number; receiptNo?: string; note?: string }) => recordTaxPayment(db, a),

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
