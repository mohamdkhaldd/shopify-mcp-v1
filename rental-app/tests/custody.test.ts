import { describe, expect, it } from "vitest";
import { createRequire } from "node:module";
import Database from "better-sqlite3";
import { setupOperationsDatabase } from "../electron/operationsDb";

// التشغيل: الصرف من العهدة بيتسجل في مكانه حسب هو اتصرف على إيه (مورد،
// العربية الملاكي، سلفة أو مرتب سواق) — من غير ما يتخصم من الخزنة — وصور
// السركي الورقي لكل معدة وشهر.

const require = createRequire(import.meta.url);
const handlers: Record<string, (e: unknown, payload?: any) => any> = {};
require.cache[require.resolve("electron")] = {
  exports: { ipcMain: { handle: (c: string, fn: any) => (handlers[c] = fn) }, app: { getPath: () => "", isPackaged: true } },
} as any;
const { registerIpcHandlers } = require("../operations/electron/ipc.js");
const call = (c: string, payload?: unknown) => handlers[c](null, payload);

describe("custody spends", () => {
  it("land on the supplier, the car, the driver's payslip — never on the treasury", () => {
    const db = setupOperationsDatabase(new Database(":memory:"));
    registerIpcHandlers(db);
    db.prepare("INSERT INTO employees (name, wage_type, rate, fixed_salary) VALUES ('سواق', 'daily', 500, 0)").run();
    const emp = db.prepare("SELECT id FROM employees").get() as { id: number };
    call("supplierPurchases:create", { supplier_name: "محل الكاوتش", date: "2026-10-01", description: "كاوتش", amount: 20000, note: null });
    const c = call("custodies:create", { holder: "أحمد", date: "2026-10-01", amount: 30000, method: "cash", warn_amount: "", note: null });
    const spend = (o: object) => call("custodyEntries:create", { custody_id: c.id, date: "2026-10-05", type: "expense", ...o });

    spend({ amount: 8000, target: "supplier", supplier_name: "محل الكاوتش" });
    spend({ amount: 1500, target: "car", car_kind: "بنزين" });
    spend({ amount: 2000, target: "advance", employee_id: emp.id, salary_month: "2026-10" });
    const after = spend({ amount: 3000, target: "salary", employee_id: emp.id, salary_month: "2026-10" });
    expect(after.remaining).toBe(15500);

    const supplier = (call("suppliers:dashboard") as any[]).find((s) => s.name === "محل الكاوتش");
    expect(supplier.remaining).toBe(12000);
    expect(call("car:summary", { month: "2026-10" }).fuelTotal).toBe(1500);
    const slip = call("payroll:detail", { employee_id: emp.id, month: "2026-10" });
    expect(slip.advances.map((a: any) => [a.amount, a.payment_method])).toEqual([[2000, "custody"]]);
    expect(slip.payments.map((a: any) => [a.amount, a.payment_method])).toEqual([[3000, "custody"]]);

    // only the custody itself left the treasury
    const cash = JSON.stringify(call("treasury:accountTransactions", { account_name: "cash", month: "2026-10" }));
    expect(cash).toContain("عهدة لـ أحمد");
    expect(cash).not.toContain("محل الكاوتش");

    // deleting the spend deletes what it recorded, and the other way round
    const st = call("custodies:statement", { id: c.id });
    call("custodyEntries:delete", { id: st.entries.find((e: any) => e.target === "advance").id });
    expect(call("payroll:detail", { employee_id: emp.id, month: "2026-10" }).advances).toHaveLength(0);
    call("salaryPayments:delete", { id: slip.payments[0].id });
    expect(call("custodies:list")[0].remaining).toBe(20500);
  });
});

describe("paper timesheet photos", () => {
  it("are kept per equipment and month", () => {
    const db = setupOperationsDatabase(new Database(":memory:"));
    registerIpcHandlers(db);
    const eq = call("equipment:create", { name: "باسكت كرين", purchase_price: 0, shares: [] });
    call("paperSheets:create", { equipment_id: eq.id, month: "2026-10", image: "data:image/jpeg;base64,AAAA", note: null });
    expect(call("paperSheets:list", { equipment_id: eq.id, month: "2026-10" })).toHaveLength(1);
    expect(call("paperSheets:list", { equipment_id: eq.id, month: "2026-11" })).toHaveLength(0);
  });
});
