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

describe("own funds (المكنيكي والسكن)", () => {
  it("move out of the commission into their own fund, with their own spending", () => {
    const db = setupOperationsDatabase(new Database(":memory:"));
    registerIpcHandlers(db);
    // an older database: the mechanic and housing used to count as commission
    db.exec("ALTER TABLE expense_categories DROP COLUMN own_fund");
    db.prepare("INSERT INTO expense_categories (name, counts_as_commission) VALUES ('مكنيكي', 1), ('سكن', 1), ('عمولة', 1), ('صيانة', 0)").run();
    const eq = call("equipment:create", { name: "لودر", purchase_price: 0, shares: [] });
    const cat = (n: string) => (db.prepare("SELECT id FROM expense_categories WHERE name = ?").get(n) as { id: number }).id;
    for (const [n, amount] of [["مكنيكي", 3000], ["سكن", 2000], ["عمولة", 500]] as const) {
      call("monthlyExpenses:create", { equipment_id: eq.id, month: "2026-10", date: "2026-10-05", category_id: cat(n), amount, payment_method: "cash", note: null, receipt_image: null, paid_amount: null, payee: null });
    }
    expect(call("hassan:treasuryBalance", { month: "2026-10" }).monthCommission).toBe(5500);

    setupOperationsDatabase(db); // the update runs on the next start
    expect(call("hassan:treasuryBalance", { month: "2026-10" }).monthCommission).toBe(500);
    call("fundExpenses:create", { category_id: cat("مكنيكي"), date: "2026-10-20", amount: 1200, description: "قطعة" });
    const funds = call("funds:list", { month: "2026-10" }) as any[];
    expect(funds.map((f) => [f.name, f.monthIn, f.monthOut, f.balance])).toEqual([
      ["سكن", 2000, 0, 2000],
      ["مكنيكي", 3000, 1200, 1800],
    ]);

    // the choice stays the user's: back to commission from the settings
    call("expenseCategories:update", { id: cat("سكن"), name: "سكن", counts_as_commission: true, own_fund: false });
    setupOperationsDatabase(db);
    expect(call("hassan:treasuryBalance", { month: "2026-10" }).monthCommission).toBe(2500);
  });
});

describe("driver bonus", () => {
  it("is an expense on the equipment he worked on, split by his days", () => {
    const db = setupOperationsDatabase(new Database(":memory:"));
    registerIpcHandlers(db);
    db.prepare("INSERT INTO employees (name, wage_type, rate, fixed_salary) VALUES ('محمود', 'daily', 500, 0)").run();
    const emp = db.prepare("SELECT id FROM employees").get() as { id: number };
    const a = call("equipment:create", { name: "لودر", purchase_price: 0, shares: [] });
    const b = call("equipment:create", { name: "كرين", purchase_price: 0, shares: [] });
    const day = (equipment_id: number, d: number) =>
      call("dailyLogs:upsert", {
        equipment_id, date: `2026-10-${String(d).padStart(2, "0")}`, role: "driver", shift_label: "", person_name: "محمود",
        actual_hours: 8, base_hours: 8, day_rate: 2500, is_paid_leave: false, is_day_off: false, fixed_value: null,
        hassan_commission: null, note: null, site_name: null, overtime_rate: null,
      });
    for (let d = 1; d <= 10; d++) day(a.id, d);
    for (let d = 11; d <= 15; d++) day(b.id, d);
    const before = call("equipment:summary", { equipment_id: a.id, month: "2026-10" }).driverSalaryExpense;
    call("employeeBonuses:create", { employee_id: emp.id, month: "2026-10", date: "2026-10-30", amount: 1500, payment_method: "cash", note: "شغل كويس" });

    const sa = call("equipment:summary", { equipment_id: a.id, month: "2026-10" });
    const sb = call("equipment:summary", { equipment_id: b.id, month: "2026-10" });
    expect(sa.driverSalaryExpense - before).toBe(1000);
    expect(sa.driverSalaryBreakdown).toContainEqual({ name: "محمود — حافز", amount: 1000 });
    expect(sb.driverSalaryBreakdown).toContainEqual({ name: "محمود — حافز", amount: 500 });
  });
});

describe("one treasury", () => {
  it("spending from the commission leaves the company treasury and comes off the commission", () => {
    const db = setupOperationsDatabase(new Database(":memory:"));
    registerIpcHandlers(db);
    const before = call("hassan:treasuryBalance", { month: "2026-10" }).balance;

    // an old expense (before one treasury): no account → the treasury doesn't change
    db.prepare("INSERT INTO hassan_treasury_expenses (date, amount, description) VALUES ('2026-10-02', 700, 'قديم')").run();
    call("hassanTreasury:create", { date: "2026-10-03", amount: 3000, category: "إيجار", description: "", method: "cash" });
    const w = call("hassanWorkers:create", { name: "علي", job: null, monthly_salary: 6000, start_month: "2026-10" });
    call("hassanWorkerEntries:create", { worker_id: w.id, month: "2026-10", date: "2026-10-05", type: "payment", amount: 2000, note: null, method: "cash" });

    const cash = JSON.stringify(call("treasury:accountTransactions", { account_name: "cash", month: "2026-10" }));
    expect(cash).toContain("من الكوميشن: إيجار");
    expect(cash).toContain("مرتب علي");
    expect(cash).not.toContain("قديم");
    expect(call("hassan:treasuryBalance", { month: "2026-10" }).balance).toBe(before - 700 - 3000 - 2000);
  });
});

describe("personal account through the treasury", () => {
  it("money in and out follows the type (cash when no account is given)", () => {
    const db = setupOperationsDatabase(new Database(":memory:"));
    registerIpcHandlers(db);
    const before = call("hassan:treasuryBalance", { month: "2026-10" }).balance;
    call("hassanLedger:create", { date: "2026-10-02", type: "loan", amount: 10000, party_name: "أحمد", description: null, note: null, method: "instapay" });
    call("hassanLedger:create", { date: "2026-10-09", type: "repayment", amount: 4000, party_name: "أحمد", description: null, note: null, method: "cash" });
    call("hassanLedger:create", { date: "2026-10-10", type: "due", amount: 500, party_name: "محمد", description: null, note: null, method: null });

    const insta = JSON.stringify(call("treasury:accountTransactions", { account_name: "instapay", month: "2026-10" }));
    const cash = JSON.stringify(call("treasury:accountTransactions", { account_name: "cash", month: "2026-10" }));
    expect(insta).toContain("الحساب الشخصي: استلف — أحمد");
    expect(cash).toContain("الحساب الشخصي: سدد — أحمد");
    expect(cash).toContain("الحساب الشخصي: سلّف — محمد");
    expect(call("hassan:treasuryBalance", { month: "2026-10" }).balance).toBe(before + 10000 - 4000 - 500);
    expect(call("hassanLedger:balance").netDebt).toBe(6000);
  });
});

describe("installments (أقساط صاحب الكوميشن)", () => {
  it("next due date, paying from the treasury, alerts, undo", () => {
    const db = setupOperationsDatabase(new Database(":memory:"));
    registerIpcHandlers(db);
    const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const soon = new Date(Date.now() + 2 * 864e5);
    call("installments:create", { title: "العربية", amount: 5000, count: 12, start_date: iso(soon), note: null });
    let [inst] = call("installments:list") as any[];
    expect(inst).toMatchObject({ nextNumber: 1, nextDue: iso(soon), remainingAmount: 60000, days: 2 });
    expect((call("alerts:dashboard") as any[]).find((a) => a.kind === "installment")).toMatchObject({ title: "قسط العربية (1 من 12)", amount: 5000 });

    const before = call("hassan:treasuryBalance", { month: iso(new Date()).slice(0, 7) }).balance;
    call("installments:pay", { id: inst.id, date: iso(new Date()), method: "instapay" });
    [inst] = call("installments:list") as any[];
    expect(inst).toMatchObject({ paidCount: 1, nextNumber: 2, remainingCount: 11 });
    expect(call("hassan:treasuryBalance", { month: iso(new Date()).slice(0, 7) }).balance).toBe(before - 5000);
    const insta = JSON.stringify(call("treasury:accountTransactions", { account_name: "instapay", month: iso(new Date()).slice(0, 7) }));
    expect(insta).toContain("قسط العربية (1 من 12)");

    call("installmentPayments:delete", { id: inst.payments[0].id });
    [inst] = call("installments:list") as any[];
    expect(inst.paidCount).toBe(0);
    expect(call("hassan:treasuryBalance", { month: iso(new Date()).slice(0, 7) }).balance).toBe(before);
  });

  it("personal account: rename and delete a party, edit an entry", () => {
    const db = setupOperationsDatabase(new Database(":memory:"));
    registerIpcHandlers(db);
    call("hassanLedger:create", { date: "2026-10-02", type: "loan", amount: 1000, party_name: "احمد", description: null, note: null, method: "cash" });
    call("hassanLedger:create", { date: "2026-10-03", type: "due", amount: 300, party_name: "محمد", description: null, note: null, method: "cash" });
    call("hassanLedger:renameParty", { from: "احمد", to: "أحمد علي" });
    const [e] = call("hassanLedger:partyEntries", { name: "أحمد علي" }) as any[];
    call("hassanLedger:update", { ...e, amount: 1500 });
    call("hassanLedger:deleteParty", { name: "محمد" });
    expect(call("hassanLedger:balanceByParty")).toEqual([{ party_name: "أحمد علي", netDebt: 1500, netDue: 0 }]);
  });
});

describe("money owed to the company (contractors)", () => {
  it("is never negative: payments settle the oldest work first, overpaid contractors don't offset others", () => {
    const db = setupOperationsDatabase(new Database(":memory:"));
    registerIpcHandlers(db);
    const eq = call("equipment:create", { name: "لودر", purchase_price: 0, shares: [] });
    call("contractors:create", { name: "حماد", opening_balance: 0 });
    call("contractors:create", { name: "مرزوق", opening_balance: 0 });
    const cid = (n: string) => (db.prepare("SELECT id FROM contractors WHERE name = ?").get(n) as { id: number }).id;
    const work = (person: string, date: string, rate: number) =>
      call("dailyLogs:upsert", {
        equipment_id: eq.id, date, role: "contractor", shift_label: "", person_name: person, actual_hours: 8, base_hours: 8,
        day_rate: rate, is_paid_leave: false, is_day_off: false, fixed_value: null, hassan_commission: null, note: null, site_name: null, overtime_rate: null,
      });
    work("حماد", "2026-10-05", 30000);
    work("حماد", "2026-11-05", 10000);
    call("contractorPayments:create", { contractor_id: cid("حماد"), date: "2026-11-02", amount: 30000, method: "cash", note: "عن أكتوبر" });
    // مرزوق دفع مقدّم أكتر من شغله
    work("مرزوق", "2026-11-06", 5000);
    call("contractorPayments:create", { contractor_id: cid("مرزوق"), date: "2026-11-06", amount: 8000, method: "cash", note: null });

    const nov = call("dashboard:monthDues", { month: "2026-11" });
    expect(nov.contractors.find((c: any) => c.name === "حماد")).toMatchObject({ due: 10000, remaining: 10000 });
    expect(nov.contractors.find((c: any) => c.name === "مرزوق").remaining).toBe(0);
    expect(nov.contractorsRemaining).toBe(10000);
    expect(call("dashboard:monthDues", { month: "2026-10" }).contractorsRemaining).toBe(0);
    expect(call("dashboard:summary").totalReceivables).toBe(10000);
  });
});
