import { describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { setupOperationsDatabase } from "../electron/operationsDb";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const makeShared = require("../operations/electron/shared.js");
const sections = ["dailyLogs", "treasury"].map((n) => require(`../operations/electron/handlers/${n}.js`));

// شاشات التشغيل بتنادي على الدوال دي بنفس الأسماء (ipcMain.handle)
function ops() {
  const db = setupOperationsDatabase(new Database(":memory:"));
  const h: Record<string, (e: unknown, a: unknown) => unknown> = {};
  const ipc = { handle: (c: string, f: (e: unknown, a: unknown) => unknown) => (h[c] = f) };
  const shared = { ...makeShared(db), pushToCloud() {} };
  for (const s of sections) s(db, ipc, shared);
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
