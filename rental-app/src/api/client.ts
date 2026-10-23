import type { ClientsView, ContractOptions, DashboardView, InvestorsView, ManagementView, SarkiView, SettingsView, SuppliersView, TaxView, TreasuryFilters, TreasuryView } from "../../core/services/views";
import type { ActivityView } from "../../core/services/activity";
import type { NewContractInput } from "../../core/services/master";
import type { DayPatch } from "../../core/services/sarki";
import type { Deletable } from "../../core/services/deletion";

// Thin typed wrapper over the single "core:call" IPC channel (see electron/ipc.ts).

declare global {
  interface Window {
    api?: {
      /** set by the Android app (tablet/backend.ts); absent on the laptop */
      platform?: "tablet";
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

/** Fired after every save: { actionId, label } — the undo bar listens to it. */
export const CHANGED_EVENT = "rental:changed";
/** Fired after an undo so the open page reloads. */
export const REFRESH_EVENT = "rental:refresh";

async function call<T>(fn: string, args: unknown = {}): Promise<T> {
  if (!window.api) throw new ApiError("البرنامج لازم يشتغل من نسخة الويندوز");
  const r = await window.api.invoke("core:call", { fn, args });
  if (!r?.ok) throw new ApiError(r?.message ?? "حصلت مشكلة", r?.code);
  if (r.actionId) window.dispatchEvent(new CustomEvent(CHANGED_EVENT, { detail: { actionId: r.actionId, label: r.label, undoable: r.undoable } }));
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
  activity: (f: { from?: string; to?: string } = {}) => call<ActivityView>("activity", f),
  undo: async (actionId: string) => {
    const r = await call<string>("undo", { actionId });
    window.dispatchEvent(new CustomEvent(REFRESH_EVENT));
    return r;
  },
  settings: () => call<SettingsView>("settings"),
  setRates: (v: { effectiveFrom: string; vat: number; tax5: number; management: number }) => call("setRates", v),
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

export const isTablet = () => window.api?.platform === "tablet";

export type UpdateCheck =
  | { state: "dev" }
  | { state: "not-available"; version?: string }
  | { state: "downloaded"; version: string }
  | { state: "apk"; version: string; url: string }
  | { state: "error"; message?: string };

export const appApi = {
  exportExcel: (fileName: string, sheets: ExcelSheet[]) => window.api?.invoke("export:excel", { fileName, sheets }),
  version: (): Promise<string> => window.api?.invoke("app:getVersion") ?? Promise.resolve(""),
  lastBackup: (): Promise<{ file: string; at: string } | null> => window.api?.invoke("backup:last") ?? Promise.resolve(null),
  printPreview: (singlePage = true) => window.api?.invoke("print:preview", { singlePage }),
  checkForUpdate: (): Promise<UpdateCheck> => window.api?.invoke("app:checkForUpdate") ?? Promise.resolve({ state: "dev" }),
  /** laptop: restart into the downloaded version; tablet: download the APK at url and open Android's installer */
  installUpdate: (url?: string): Promise<{ ok: boolean; message?: string } | undefined> => window.api?.invoke("app:installUpdate", { url }) ?? Promise.resolve(undefined),
  onUpdateProgress: (cb: (p: { percent: number }) => void) => window.api?.on("app:updateProgress", cb as (d: unknown) => void) ?? (() => {}),
  backupNow: (): Promise<string | null> => window.api?.invoke("backup:now") ?? Promise.resolve(null),
  restoreBackup: (): Promise<{ ok: boolean; message?: string }> => window.api?.invoke("backup:restore") ?? Promise.resolve({ ok: false }),
  savePdf: (name: string) => window.api?.invoke("print:savePdf", { name }),
};

export interface SyncStatus {
  deviceId: string;
  deviceName: string;
  pending: number;
  deferred: number;
  online: boolean;
  needsLogin: boolean;
  lastError: string | null;
  lastSyncAt: string | null;
  disabled?: boolean;
}

const noSync: SyncStatus = { deviceId: "", deviceName: "", pending: 0, deferred: 0, online: false, needsLogin: false, lastError: null, lastSyncAt: null, disabled: true };

export type LicenseStatus =
  | { state: "active"; licenseId: number; customer: string; name: string; logo: string | null; expiresAt: string | null; checkBy: string }
  | { state: "needed"; message: string | null };

export const licenseApi = {
  status: (): Promise<LicenseStatus> => window.api?.invoke("license:status") ?? Promise.resolve({ state: "needed", message: "البرنامج لازم يشتغل من نسخة الويندوز أو التابلت" }),
  activate: (key: string): Promise<{ ok: true; status: LicenseStatus } | { ok: false; message: string }> =>
    window.api?.invoke("license:activate", { key }) ?? Promise.resolve({ ok: false, message: "البرنامج لازم يشتغل من نسخة الويندوز أو التابلت" }),
  /** fired after every check with the server */
  onChanged: (cb: (s: LicenseStatus) => void) => window.api?.on("license:changed", cb as (d: unknown) => void) ?? (() => {}),
};

export const syncApi = {
  status: (): Promise<SyncStatus> => window.api?.invoke("sync:status") ?? Promise.resolve(noSync),
  now: (): Promise<SyncStatus> => window.api?.invoke("sync:now") ?? Promise.resolve(noSync),
  setDeviceName: (name: string): Promise<SyncStatus> => window.api?.invoke("sync:setDeviceName", { name }) ?? Promise.resolve(noSync),
  /** Another device's edits just landed here. */
  onRemoteChanges: (cb: (info: { count: number; devices: string[] }) => void) => window.api?.on("sync:remoteChanges", cb as (d: unknown) => void) ?? (() => {}),
};

export type { ActivityView, SettingsView, TaxView, TreasuryView, TreasuryFilters, InvestorsView, ManagementView, ClientsView, ContractOptions, DashboardView, Deletable, NewContractInput, SarkiView, SuppliersView };
/** The السركي view once a contract is open. */
export type OpenSarki = Exclude<SarkiView, { contract: null }>;
