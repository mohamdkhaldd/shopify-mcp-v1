import { describe, expect, it } from "vitest";
import { createRequire } from "node:module";
import Database from "better-sqlite3";
import { setupOperationsDatabase } from "../electron/operationsDb";

// التشغيل: ميعاد ثابت للمرتبات / الشركاء من غير مبلغ مكتوب — البرنامج بيحسب
// عليك كام لوحده، وبينبّه بيه.

// the screens' functions, registered on a stand-in for Electron's ipcMain
const require = createRequire(import.meta.url);
const handlers: Record<string, (e: unknown, payload?: any) => any> = {};
require.cache[require.resolve("electron")] = {
  exports: { ipcMain: { handle: (c: string, fn: any) => (handlers[c] = fn) }, app: { getPath: () => "", isPackaged: true } },
} as any;
const { registerIpcHandlers } = require("../operations/electron/ipc.js");
const call = (c: string, payload?: unknown) => handlers[c](null, payload);

describe("fixed payment dates", () => {
  it("works out what is owed for salaries and partners, and keeps it once paid", () => {
    const db = setupOperationsDatabase(new Database(":memory:"));
    registerIpcHandlers(db);
    db.prepare("INSERT INTO employees (name, wage_type, rate, fixed_salary) VALUES ('مكنيكي', 'monthly', 6000, 1)").run();
    const emp = db.prepare("SELECT id FROM employees").get() as { id: number };
    db.prepare("INSERT INTO salary_payments (employee_id, month, date, amount) VALUES (?, '2026-10', '2026-10-15', 1000)").run(emp.id);
    db.prepare("INSERT INTO partners (name, opening_balance) VALUES ('شريك', 2500)").run();

    call("obligations:create", { title: "مرتبات", kind: "salaries", amount: null, due_date: "2026-11-05", repeat_monthly: true });
    call("obligations:create", { title: "قبض الشركاء", kind: "partners", amount: null, due_date: "2026-11-10", repeat_monthly: true });
    call("obligations:create", { title: "إيجار", kind: "rent", amount: 3000, due_date: "2026-11-01", repeat_monthly: false });

    const list = call("obligations:list") as any[];
    const byTitle = (t: string) => list.find((o) => o.title === t);
    // the 5th of November = October's salaries: 6000 − 1000 already paid
    expect(byTitle("مرتبات")).toMatchObject({ auto_amount: 5000, for_month: "2026-10" });
    expect(byTitle("قبض الشركاء")).toMatchObject({ auto_amount: 2500 });
    expect(byTitle("إيجار").auto_amount).toBeUndefined();

    // paid: the amount of that day stays on it, next month's date comes by itself
    call("obligations:done", { id: byTitle("مرتبات").id });
    const after = call("obligations:list") as any[];
    expect(after.find((o) => o.title === "مرتبات" && o.done_at)).toMatchObject({ amount: 5000 });
    expect(after.find((o) => o.title === "مرتبات" && !o.done_at)).toMatchObject({ amount: null, due_date: "2026-12-05", for_month: "2026-11" });
  });
});

describe("مصاريف التشغيل", () => {
  it("keeps each expense on its item and lists the items typed before", () => {
    const db = setupOperationsDatabase(new Database(":memory:"));
    registerIpcHandlers(db);
    call("hassanTreasury:create", { date: "2026-10-03", amount: 3000, category: "إيجار", description: "" });
    call("hassanTreasury:create", { date: "2026-10-09", amount: 450, category: "أكل", description: "غدا العمال" });
    call("hassanTreasury:create", { date: "2026-10-20", amount: 300, category: "أكل", description: "" });
    // an expense from before items existed: its text is its item
    db.prepare("INSERT INTO hassan_treasury_expenses (date, amount, description) VALUES ('2026-10-25', 1200, 'قسط عربية')").run();

    const rows = call("hassanTreasury:list", { month: "2026-10" }) as { category: string; description: string; amount: number }[];
    const totals: Record<string, number> = {};
    for (const r of rows) totals[r.category] = (totals[r.category] ?? 0) + r.amount;
    expect(totals).toEqual({ إيجار: 3000, أكل: 750, "قسط عربية": 1200 });
    expect(rows.find((r) => r.description === "غدا العمال")?.category).toBe("أكل");
    expect(call("hassanTreasury:categories")).toEqual(["أكل", "إيجار"]);
    // still counted in what was spent from his money this month
    expect(call("hassan:treasuryBalance", { month: "2026-10" }).monthSpent).toBe(4950);
  });
});
