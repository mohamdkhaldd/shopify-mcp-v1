import { describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { setupOperationsDatabase } from "../electron/operationsDb";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const makeShared = require("../operations/electron/shared.js");
const sections = ["dailyLogs", "treasury", "hassanWorkers", "dashboard"].map((n) => require(`../operations/electron/handlers/${n}.js`));

// شاشات التشغيل بتنادي على الدوال دي بنفس الأسماء (ipcMain.handle)
function ops() {
  const db = setupOperationsDatabase(new Database(":memory:"));
  const h: Record<string, (e: unknown, a: unknown) => unknown> = {};
  const ipc = { handle: (c: string, f: (e: unknown, a: unknown) => unknown) => (h[c] = f) };
  const shared = { ...makeShared(db), pushToCloud() {} };
  for (const s of sections) s(db, ipc, shared);
  require("../operations/electron/extras.js").registerExtraHandlers(db, { payrollSummary: shared.payrollSummary, partnersSummary: shared.partnersSummary }, ipc);
  const call = (c: string, a: unknown) => h[c](null, a) as any; // eslint-disable-line @typescript-eslint/no-explicit-any
  return { db, call };
}

describe("التشغيل: شيفت اتعمل بالغلط", () => {
  it("يتغيّر اسمه، ويتمسح هو وأيامه، والتراجع يرجّعه", () => {
    const { db, call } = ops();
    db.prepare("INSERT INTO equipment (id, name) VALUES (1, 'لودر')").run();
    const s = call("equipmentShifts:create", { equipment_id: 1, label: "وردية 2" });
    call("dailyLogs:upsert", { equipment_id: 1, date: "2026-11-02", role: "contractor", shift_label: "وردية 2", person_name: "أحمد", actual_hours: 10, base_hours: 10, day_rate: 500 });
    expect(call("equipmentShifts:days", { id: s.id })).toBeGreaterThan(0);

    call("equipmentShifts:rename", { id: s.id, label: "ليل" });
    expect(call("dailyLogs:list", { equipment_id: 1, month: "2026-11", role: "contractor", shift_label: "ليل" })).toHaveLength(1);

    const r = call("equipmentShifts:delete", { id: s.id });
    expect(call("equipmentShifts:list", { equipment_id: 1 })).toHaveLength(0);
    expect(db.prepare("SELECT COUNT(*) AS n FROM daily_logs").get()).toEqual({ n: 0 });

    call("equipmentShifts:restore", { shift: r.shift, logs: r.logs });
    expect(call("equipmentShifts:list", { equipment_id: 1 })).toHaveLength(1);
    expect(call("dailyLogs:list", { equipment_id: 1, month: "2026-11", role: "contractor", shift_label: "ليل" })).toHaveLength(1);
  });
});

describe("التشغيل: تعديل أي سطر فلوس", () => {
  it("التاريخ والمبلغ والطريقة والبيان بيتعدّلوا، ومصروف المعدة بإجماليه", () => {
    const { db, call } = ops();
    db.prepare("INSERT INTO partners (id, name) VALUES (1, 'سامي')").run();
    db.prepare("INSERT INTO partner_payments (id, partner_id, date, amount, method, note) VALUES (1, 1, '2026-11-01', 1000, 'cash', 'قديم')").run();
    call("treasury:movementUpdate", { src: "partner_payments", src_id: 1, date: "2026-11-05", amount: 1500, account: "instapay", note: "جديد" });
    expect(db.prepare("SELECT date, amount, method, note FROM partner_payments").get()).toEqual({ date: "2026-11-05", amount: 1500, method: "instapay", note: "جديد" });

    db.prepare("INSERT INTO equipment (id, name) VALUES (1, 'لودر')").run();
    db.prepare("INSERT INTO monthly_expenses (id, equipment_id, month, date, amount, paid_amount) VALUES (1, 1, '2026-11', '2026-11-01', 5000, 3000)").run();
    call("treasury:movementUpdate", { src: "monthly_expenses", src_id: 1, date: "2026-11-01", amount: 2000, expenseTotal: true });
    expect(db.prepare("SELECT amount, paid_amount FROM monthly_expenses").get()).toEqual({ amount: 2000, paid_amount: 2000 });

    db.prepare("INSERT INTO car_fuel (id, date, kind, amount) VALUES (1, '2026-11-01', 'بنزين', 300)").run();
    call("treasury:movementUpdate", { src: "car_fuel", src_id: 1, date: "2026-11-02", amount: 350, note: "تفويلة" });
    expect(db.prepare("SELECT date, amount, note FROM car_fuel").get()).toEqual({ date: "2026-11-02", amount: 350, note: "تفويلة" });
  });
});

describe("التشغيل: صدقات وهالك صاحب الكوميشن", () => {
  it("كل شيت لوحده، والمصاريف القديمة فاضلة في مصاريف التشغيل", () => {
    const { call } = ops();
    call("hassanTreasury:create", { date: "2026-11-03", amount: 100, category: "أكل", method: "cash" });
    call("hassanTreasury:create", { date: "2026-11-03", amount: 50, category: "صدقة", method: "cash", kind: "charity" });
    call("hassanTreasury:create", { date: "2026-11-04", amount: 70, category: "عدة باظت", method: "cash", kind: "waste" });
    const list = (kind?: string) => call("hassanTreasury:list", { month: "2026-11", kind }).filter((r: { computed?: boolean }) => !r.computed).map((r: { amount: number }) => r.amount);
    expect(list()).toEqual([100]);
    expect(list("charity")).toEqual([50]);
    expect(list("waste")).toEqual([70]);
    expect(call("hassanTreasury:categories", { kind: "waste" })).toEqual(["عدة باظت"]);
  });
});

describe("التشغيل: الرئيسية بالشهر وبعدين بالسنة", () => {
  it("الدخل قبل الكوميشن، المصروفات، الصافي، والمستحقات", () => {
    const { db, call } = ops();
    db.prepare("INSERT INTO equipment (id, name) VALUES (1, 'لودر')").run();
    db.prepare("INSERT INTO contractors (id, name, opening_balance) VALUES (1, 'المقاول', 0)").run();
    // أكتوبر: يوم واحد — المقاول ١٠٠٠ والسركي ٨٠٠ (كوميشن ٢٠٠)
    const day = (date: string, role: string, rate: number) =>
      call("dailyLogs:upsert", { equipment_id: 1, date, role, shift_label: "", person_name: role === "contractor" ? "المقاول" : "", actual_hours: 8, base_hours: 8, day_rate: rate });
    day("2026-10-05", "contractor", 1000); day("2026-10-05", "driver", 800);
    // نوفمبر: يومين
    day("2026-11-02", "contractor", 1000); day("2026-11-02", "driver", 800);
    day("2026-11-03", "contractor", 1000); day("2026-11-03", "driver", 800);
    db.prepare("INSERT INTO monthly_expenses (equipment_id, month, date, amount) VALUES (1, '2026-11', '2026-11-04', 300)").run();
    db.prepare("INSERT INTO contractor_payments (contractor_id, date, amount, method) VALUES (1, '2026-11-10', 500, 'cash')").run();

    const r = call("dashboard:period", { month: "2026-11" });
    expect(r.monthly.gross).toBe(2000);
    expect(r.monthly.commission).toBe(400);
    expect(r.monthly.companyIncome).toBe(1600);
    expect(r.monthly.expenses.total).toBe(300);
    expect(r.monthly.net.total).toBe(1300);
    expect(r.monthly.working).toBe(1);
    expect(r.yearly.gross).toBe(3000);
    expect(r.yearly.net.total).toBe(2100);
    // المقاول عليه: نوفمبر ٢٠٠٠ والدفعة ٥٠٠ بتسدد أكتوبر الأول (١٠٠٠) → نوفمبر كله لسه
    const company = (p: { dues: { key: string; amount: number }[] }) => p.dues.find((d) => d.key === "company")!.amount;
    expect(company(r.monthly)).toBe(2000);
    expect(company(r.yearly)).toBe(2500);
  });
});

describe("التشغيل: عهدة من شريك أو مقاول", () => {
  it("المقاول: دفعة منه، الشريك: بتزوّد اللي ليه، والخزنة متلمستش — والمسح بيشيلهم", () => {
    const { db, call } = ops();
    db.prepare("INSERT INTO partners (id, name) VALUES (1, 'سامي')").run();
    db.prepare("INSERT INTO contractors (id, name, opening_balance) VALUES (1, 'المقاول', 0)").run();
    const a = call("custodies:create", { holder: "أحمد", date: "2026-11-05", amount: 3000, funded_by: "contractor", funder_id: 1 });
    expect(db.prepare("SELECT amount, method FROM contractor_payments").get()).toEqual({ amount: 3000, method: "custody" });
    const b = call("custodies:create", { holder: "محمود", date: "2026-11-06", amount: 2000, funded_by: "partner", funder_id: 1 });
    expect(db.prepare("SELECT amount FROM partner_payments").get()).toEqual({ amount: -2000 });
    expect(db.prepare("SELECT method FROM custodies WHERE id = ?").get(a.id)).toEqual({ method: "external" });
    call("custodies:delete", { id: a.id });
    call("custodies:delete", { id: b.id });
    expect(db.prepare("SELECT COUNT(*) AS n FROM contractor_payments").get()).toEqual({ n: 0 });
    expect(db.prepare("SELECT COUNT(*) AS n FROM partner_payments").get()).toEqual({ n: 0 });
  });
});
