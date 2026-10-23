import type { ClientsView, ContractOptions, DashboardView, InvestorsView, ManagementView, SarkiView, SuppliersView, TaxView, TreasuryFilters, TreasuryView } from "../../core/services/views";
import type { NewContractInput } from "../../core/services/master";
import type { DayPatch } from "../../core/services/sarki";
import type { Deletable } from "../../core/services/deletion";

// Thin typed wrapper over the single "core:call" IPC channel (see electron/ipc.ts).

declare global {
  interface Window {
    api?: {
      invoke: (channel: string, payload?: unknown) => Promise<any>;
      on: (channel: string, cb: (data: unknown) => void) => () => void;
    };
  }
}

export class ApiError extends Error {
  constructor(message: string, readonly code?: string) {
    super(message);
  }
}

async function call<T>(fn: string, args: unknown = {}): Promise<T> {
  if (!window.api) throw new ApiError("البرنامج لازم يشتغل من نسخة الويندوز");
  const r = await window.api.invoke("core:call", { fn, args });
  if (!r?.ok) throw new ApiError(r?.message ?? "حصلت مشكلة", r?.code);
  return r.value as T;
}

export interface DeletePreview {
  items: string[];
  count: number;
  blocked: string | null;
}

export const api = {
  dashboard: (month?: string) => call<DashboardView>("dashboard", { month }),
  sarki: (contractId?: number, month?: string) => call<SarkiView>("sarki", { contractId, month }),
  contractOptions: () => call<ContractOptions>("contractOptions"),
  newContract: (input: NewContractInput) => call<number>("newContract", input),
  upsertDay: (contractId: number, date: string, side: "client" | "supplier", patch: DayPatch) => call("upsertDay", { contractId, date, side, patch }),
  fillRange: (contractId: number, from: string, to: string, v: { dayRatePt?: number | null; siteName?: string | null; baseHoursMilli?: number }) =>
    call("fillRange", { contractId, from, to, ...v }),
  clearRange: (contractId: number, from: string, to: string, reason: string) => call("clearRange", { contractId, from, to, reason }),
  applyOvertime: (contractId: number, month: string, days: string, hoursMilli: number, ratePt: number | null) =>
    call("applyOvertime", { contractId, month, days, hoursMilli, ratePt }),
  suppliers: (supplierId?: number) => call<SuppliersView>("suppliers", { supplierId }),
  createSupplier: (name: string, phone?: string) => call<number>("createSupplier", { name, phone }),
  updateSupplier: (id: number, name: string, phone?: string | null) => call("updateSupplier", { id, name, phone }),
  createEquipment: (v: { name: string; supplierId: number; siteName?: string; supplierRatePt?: number }) => call<number>("createEquipment", v),
  updateEquipment: (v: { id: number; name: string; siteName?: string | null; supplierRatePt?: number | null }) => call("updateEquipment", v),
  partySheet: (contractId: number, month: string, side: "client" | "supplier") => call<PartySheet>("partySheet", { contractId, month, side }),
  supplierPayment: (v: { supplierId: number; contractId?: number | null; date: string; amountPt: number; note?: string; confirmNegative?: boolean }) => call<number>("supplierPayment", v),
  supplierDeduction: (v: { supplierId: number; contractId?: number | null; date: string; amountPt: number; note: string; paidFromTreasury?: boolean; confirmNegative?: boolean }) =>
    call<number>("supplierDeduction", v),
  clients: (clientId?: number) => call<ClientsView>("clients", { clientId }),
  createClient: (v: { kind: "company" | "individual"; name: string; phone?: string; taxId?: string; vatApplies?: boolean; tax5Applies?: boolean }) => call<number>("createClient", v),
  updateClient: (v: { id: number; kind: "company" | "individual"; name: string; phone?: string | null; taxId?: string | null }) => call("updateClient", v),
  setClientTaxes: (id: number, vatApplies: boolean, tax5Applies: boolean) => call("setClientTaxes", { id, vatApplies, tax5Applies }),
  clientPayment: (v: { clientId: number; contractId?: number | null; date: string; amountPt: number; note?: string }) => call<number>("clientPayment", v),
  management: (month?: string) => call<ManagementView>("management", { month }),
  createExpenseCategory: (name: string) => call<number>("createExpenseCategory", { name }),
  expense: (v: { kind: "contract" | "general"; contractId?: number | null; categoryId?: number | null; date: string; amountPt: number; note?: string; confirmNegative?: boolean }) =>
    call<number>("expense", v),
  managementPayout: (v: { date: string; amountPt: number; note?: string; confirmNegative?: boolean }) => call<number>("managementPayout", v),
  closeMonth: (month: string) => call<void>("closeMonth", { month }),
  adjustment: (v: { targetMonth: string; contractId: number; kind: "client_base" | "supplier_cost"; amountPt: number; reason: string }) => call<number>("adjustment", v),
  investors: (month?: string) => call<InvestorsView>("investors", { month }),
  createInvestor: (name: string, phone?: string) => call<number>("createInvestor", { name, phone }),
  updateInvestor: (id: number, name: string, phone?: string | null) => call("updateInvestor", { id, name, phone }),
  capital: (v: { investorId: number; kind: "deposit" | "withdrawal"; date: string; amountPt: number; note?: string; confirmNegative?: boolean }) => call<number>("capital", v),
  investorPayout: (v: { investorId: number; date: string; amountPt: number; note?: string; confirmNegative?: boolean }) => call<number>("investorPayout", v),
  reinvest: (v: { investorId: number; date: string; amountPt: number }) => call<number>("reinvest", v),
  treasury: (f: TreasuryFilters) => call<TreasuryView>("treasury", f),
  tax: () => call<TaxView>("tax"),
  taxPayment: (v: { tax: "vat" | "tax5"; periodMonth?: string; date: string; amountPt: number; receiptNo?: string; note?: string }) => call<number>("taxPayment", v),
  setSupplierRate: (contractId: number, from: string, to: string, v: { dayRatePt?: number | null; overtimeRatePt?: number | null }) =>
    call("setSupplierRate", { contractId, from, to, ...v }),
  deletePreview: (entity: Deletable, id: number) => call<DeletePreview>("deletePreview", { entity, id }),
  delete: (entity: Deletable, id: number) => call<string>("delete", { entity, id }),
  restore: (batch: string) => call<void>("restore", { batch }),
};

export type PartySheet = ReturnType<typeof import("../../core/services/sarki").getPartySheet>;

export interface ExcelColumn {
  header: string;
  key: string;
  money?: boolean;
  width?: number;
}
export interface ExcelSheet {
  title: string;
  columns: ExcelColumn[];
  rows: Record<string, string | number | null>[];
  totals?: Record<string, string | number | null>;
}

export const appApi = {
  exportExcel: (fileName: string, sheets: ExcelSheet[]) => window.api?.invoke("export:excel", { fileName, sheets }),
  version: (): Promise<string> => window.api?.invoke("app:getVersion") ?? Promise.resolve(""),
  lastBackup: (): Promise<{ file: string; at: string } | null> => window.api?.invoke("backup:last") ?? Promise.resolve(null),
  printPreview: (singlePage = true) => window.api?.invoke("print:preview", { singlePage }),
  savePdf: (name: string) => window.api?.invoke("print:savePdf", { name }),
};

export type { TaxView, TreasuryView, TreasuryFilters, InvestorsView, ManagementView, ClientsView, ContractOptions, DashboardView, Deletable, NewContractInput, SarkiView, SuppliersView };
/** The السركي view once a contract is open. */
export type OpenSarki = Exclude<SarkiView, { contract: null }>;
