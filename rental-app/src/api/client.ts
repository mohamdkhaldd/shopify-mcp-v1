import type { ContractOptions, DashboardView, SarkiView } from "../../core/services/views";
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
  setSupplierRate: (contractId: number, from: string, to: string, v: { dayRatePt?: number | null; overtimeRatePt?: number | null }) =>
    call("setSupplierRate", { contractId, from, to, ...v }),
  deletePreview: (entity: Deletable, id: number) => call<DeletePreview>("deletePreview", { entity, id }),
  delete: (entity: Deletable, id: number) => call<string>("delete", { entity, id }),
  restore: (batch: string) => call<void>("restore", { batch }),
};

export const appApi = {
  version: (): Promise<string> => window.api?.invoke("app:getVersion") ?? Promise.resolve(""),
  lastBackup: (): Promise<{ file: string; at: string } | null> => window.api?.invoke("backup:last") ?? Promise.resolve(null),
  printPreview: (singlePage = true) => window.api?.invoke("print:preview", { singlePage }),
  savePdf: (name: string) => window.api?.invoke("print:savePdf", { name }),
};

export type { ContractOptions, DashboardView, Deletable, NewContractInput, SarkiView };
/** The السركي view once a contract is open. */
export type OpenSarki = Exclude<SarkiView, { contract: null }>;
