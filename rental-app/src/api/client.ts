import type { DashboardView } from "../../core/services/views";
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

export type { DashboardView, Deletable };
