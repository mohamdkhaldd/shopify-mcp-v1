import { describe, expect, it } from "vitest";
import { createRequire } from "node:module";
import Database from "better-sqlite3";
import { setupOperationsDatabase } from "../electron/operationsDb";

// التشغيل: تعديل اسم الشريك من الإعدادات — نفس الشريك بنسبه ودفعاته، بس باسم جديد.

const require = createRequire(import.meta.url);
const handlers: Record<string, (e: unknown, payload?: any) => any> = {};
require.cache[require.resolve("electron")] = {
  exports: { ipcMain: { handle: (c: string, fn: any) => (handlers[c] = fn) }, app: { getPath: () => "", isPackaged: true } },
} as any;
const { registerIpcHandlers } = require("../operations/electron/ipc.js");
const call = (c: string, payload?: unknown) => handlers[c](null, payload);

describe("partner rename", () => {
  it("changes the name only, keeps the same partner, and refuses empty or duplicate names", () => {
    const db = setupOperationsDatabase(new Database(":memory:"));
    registerIpcHandlers(db);
    const before = (call("partners:list") as any[]).map((p) => p.name);
    const a = call("partners:create", { name: "شريك أ", opening_balance: 5000 });
    call("partners:create", { name: "شريك ب", opening_balance: 0 });

    const renamed = call("partners:rename", { id: a.id, name: "  محمد خالد  " });
    expect(renamed).toMatchObject({ id: a.id, name: "محمد خالد", opening_balance: 5000 });
    expect((call("partners:list") as any[]).map((p) => p.name).sort()).toEqual([...before, "محمد خالد", "شريك ب"].sort());

    expect(() => call("partners:rename", { id: a.id, name: "شريك ب" })).toThrow("بنفس الاسم");
    expect(() => call("partners:rename", { id: a.id, name: "   " })).toThrow("اسم الشريك");
    expect(call("partners:rename", { id: a.id, name: "محمد خالد" }).name).toBe("محمد خالد");
  });
});
