import { describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { setupOperationsDatabase } from "../electron/operationsDb";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const makeShared = require("../operations/electron/shared.js");
const sections = ["dailyLogs", "treasury", "hassanWorkers", "dashboard", "dues", "tax", "certificates", "gold"].map((n) => require(`../operations/electron/handlers/${n}.js`));

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

describe("التشغيل: الالتزامات والمستحقات", () => {
  it("بالأيام، ادفع/استلمت بيتسجلوا صح، والجزئي بيفضل باقي", () => {
    const { db, call } = ops();
    db.prepare("INSERT INTO contractors (id, name, opening_balance) VALUES (1, 'المقاول', 0)").run();
    db.prepare("INSERT INTO equipment (id, name) VALUES (1, 'لودر')").run();
    call("dailyLogs:upsert", { equipment_id: 1, date: "2026-11-02", role: "contractor", shift_label: "", person_name: "المقاول", actual_hours: 8, base_hours: 8, day_rate: 1000 });
    db.prepare("INSERT INTO hassan_installments (id, title, amount, count, start_date) VALUES (1, 'العربية', 2000, 10, '2026-11-01')").run();
    call("dues:addManual", { title: "إيجار المخزن", amount: 3000, due_date: "2026-11-20", direction: "pay", repeat_monthly: true });

    let b = call("dues:board", { month: "2026-11" });
    const find = (g: string) => b.days.flatMap((d: { items: { group: string }[] }) => d.items).find((x: { group: string }) => x.group === g);
    expect(b.days[0]).toMatchObject({ date: "2026-11-01", title: "الأقساط" });
    expect(find("contractors")).toMatchObject({ direction: "receive", remaining: 1000, due: "2026-11-10" });
    expect(find("manual")).toMatchObject({ remaining: 3000, due: "2026-11-20" });

    // استلمت من المقاول
    call("dues:pay", { group: "contractors", ref: 1, date: "2026-11-10", amount: 1000, method: "cash" });
    // إيجار: جزء وبعدين الباقي
    const rent = find("manual");
    call("dues:pay", { group: "manual", ref: rent.ref, date: "2026-11-20", amount: 1000, method: "cash" });
    b = call("dues:board", { month: "2026-11" });
    expect(find("manual")).toMatchObject({ paid: 1000, remaining: 2000 });
    call("dues:pay", { group: "manual", ref: rent.ref, date: "2026-11-21", amount: 2000, method: "cash" });
    b = call("dues:board", { month: "2026-11" });
    expect(find("manual")).toBeUndefined();
    expect(find("contractors")).toBeUndefined();
    // شهري: الشهر الجاي اتعمل لوحده
    expect(call("dues:board", { month: "2026-12" }).days.some((d: { title: string }) => d.title.includes("التزامات"))).toBe(true);
    // القسط: ادفع
    call("dues:pay", { group: "installments", ref: 1, date: "2026-11-01", amount: 2000, method: "cash" });
    expect(db.prepare("SELECT COUNT(*) AS n FROM hassan_installment_payments").get()).toEqual({ n: 1 });

    // تراجع: الإيجار اللي اتقفل يرجع مفتوح، والشهر الجاي اللي اتعمل يتشال
    const rent2 = db.prepare("SELECT * FROM obligations WHERE title = 'إيجار المخزن' AND done_at IS NULL").get() as { id: number };
    const last = db.prepare("SELECT id FROM obligation_payments ORDER BY id DESC").get() as { id: number };
    call("dues:undo", { src: "obligation_payments", src_id: last.id, obligation_id: rent.ref, spawned: rent2.id });
    b = call("dues:board", { month: "2026-11" });
    expect(find("manual")).toMatchObject({ remaining: 2000 });
    expect(db.prepare("SELECT COUNT(*) AS n FROM obligations").get()).toEqual({ n: 1 });

    // يوم الدفع بيتغيّر
    call("dues:setDay", { group: "contractors", day: 25 });
    expect(call("dues:board", { month: "2026-11" }).settings.contractors).toBe(25);
  });
});

describe("التشغيل: كذا عربية", () => {
  it("العربية القديمة بقت أول عربية، الملاكي بيتخصم من الكوميشن، والشغل من الخزنة وبيدخّل", () => {
    const { db, call } = ops();
    // بيانات قديمة قبل كذا عربية
    db.prepare("INSERT INTO car_fuel (date, kind, amount) VALUES ('2026-11-02', 'بنزين', 500)").run();
    const cars = call("cars:list", {});
    expect(cars).toHaveLength(1);
    expect(cars[0]).toMatchObject({ name: "العربية الملاكي", kind: "personal" });
    expect(call("car:summary", { month: "2026-11" }).personal).toBe(500);

    const { id: truck } = call("cars:save", { name: "النقل", kind: "work" });
    call("carFuel:create", { date: "2026-11-03", kind: "بنزين", amount: 300, car_id: truck, method: "cash" });
    call("carIncome:create", { car_id: truck, date: "2026-11-04", amount: 1200, method: "cash", note: "نقلة" });
    const t = call("car:summary", { month: "2026-11", car_id: truck });
    expect(t).toMatchObject({ fuelTotal: 300, incomeTotal: 1200, net: 900, personal: 0 });
    // الملاكي متأثرش بعربية الشغل
    expect(call("car:summary", { month: "2026-11", car_id: cars[0].id }).personal).toBe(500);
    // الخزنة: مصروف الشغل طالع ودخله داخل
    const moves = call("treasury:monthMovements", { month: "2026-11" }).filter((m: { src: string }) => m.src === "car_fuel" || m.src === "car_income");
    expect(moves.map((m: { direction: string; amount: number }) => `${m.direction}:${m.amount}`).sort()).toEqual(["in:1200", "out:300"]);
  });
});

describe("التشغيل: الضرايب زي التأجير", () => {
  it("الشركة: الشغل + ١٤٪ − ٣٪، مقاول الباطن زي ما هو، والتوريد بيطلع من الخزنة", () => {
    const { db, call } = ops();
    db.prepare("INSERT INTO equipment (id, name) VALUES (1, 'لودر')").run();
    db.prepare("INSERT INTO contractors (id, name, opening_balance) VALUES (1, 'شركة النور', 0), (2, 'أبو أحمد', 0)").run();
    const day = (who: string) => call("dailyLogs:upsert", { equipment_id: 1, date: who === "شركة النور" ? "2026-11-02" : "2026-11-03", role: "contractor", shift_label: "", person_name: who, actual_hours: 8, base_hours: 8, day_rate: 1000 });
    day("شركة النور"); day("أبو أحمد");
    call("contractors:setTax", { id: 1, is_company: true, vat_applies: true, wht_applies: true });
    const t = call("tax:summary", { month: "2026-11" });
    expect(t.month.rows).toEqual([expect.objectContaining({ name: "شركة النور", base: 1000, vat: 140, wht: 30, collect: 1110 })]);
    const owed = call("dues:board", { month: "2026-11" }).days.flatMap((d: { items: { group: string; label: string; remaining: number }[] }) => d.items).filter((x: { group: string }) => x.group === "contractors");
    expect(Object.fromEntries(owed.map((x: { label: string; remaining: number }) => [x.label, Math.round(x.remaining)]))).toEqual({ "شركة النور": 1110, "أبو أحمد": 1000 });
    call("taxPayments:create", { date: "2026-12-05", kind: "vat", for_month: "2026-11", amount: 140, method: "cash" });
    expect(call("tax:summary", { month: "2026-11" }).month.vatDue).toBe(0);
    expect(call("treasury:monthMovements", { month: "2026-12" }).some((m: { src: string; direction: string }) => m.src === "tax_payments" && m.direction === "out")).toBe(true);
  });
});

describe("التشغيل: شهادات المعايرة والضمان", () => {
  it("بتتسجل، والرئيسية بتنبّه قبلها بـ ٥ أيام بس", () => {
    const { db, call } = ops();
    db.prepare("INSERT INTO equipment (id, name) VALUES (1, 'ونش 50')").run();
    const iso = (days: number) => { const d = new Date(); d.setDate(d.getDate() + days); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
    call("certificates:save", { kind: "calibration", equipment_id: 1, start_date: iso(-360), end_date: iso(4) });
    call("certificates:save", { kind: "battery", title: "فارتا", end_date: iso(40) });
    expect(call("certificates:list", {})).toHaveLength(2);
    const alerts = call("alerts:dashboard", {}).filter((a: { kind: string }) => a.kind === "certificate");
    expect(alerts).toEqual([expect.objectContaining({ title: "شهادة معايرة معدة ونش 50 قربت تخلص", days: 4 })]);
  });
});

describe("التشغيل: دهب صاحب الكوميشن", () => {
  it("السلفة: الفرق بين سعر يوم السلفة ويوم الرد، والتحويش: البيع − متوسط الشرا", () => {
    const { call } = ops();
    // استلفت ١٠ جرام والجرام بـ ٤٠٠٠، رديت ٦ والجرام بـ ٤٥٠٠ → خسرت ٣٠٠٠
    const { id } = call("gold:add", { kind: "loan", direction: "borrow", party: "عم سيد", date: "2026-01-10", grams: 10, price: 4000, karat: "21" });
    call("gold:add", { kind: "loan", direction: "repay", ref_id: id, date: "2026-06-01", grams: 6, price: 4500 });
    // سلّفت ٥ جرام بـ ٤٢٠٠ ورجعولي ٥ بـ ٤٦٠٠ → كسبت ٢٠٠٠
    const lend = call("gold:add", { kind: "loan", direction: "lend", party: "خالد", date: "2026-02-01", grams: 5, price: 4200, karat: "21" });
    call("gold:add", { kind: "loan", direction: "repay", ref_id: lend.id, date: "2026-07-01", grams: 5, price: 4600 });
    expect(() => call("gold:add", { kind: "loan", direction: "repay", ref_id: id, date: "2026-07-01", grams: 5, price: 4600 })).toThrow(/الباقي 4/);
    // تحويش: اشتريت ١٠ بـ ٤٠٠٠ و١٠ بـ ٥٠٠٠ (متوسط ٤٥٠٠)، بعت ٥ بـ ٥٢٠٠ → كسبت ٣٥٠٠
    call("gold:add", { kind: "save", direction: "buy", date: "2026-01-05", grams: 10, price: 4000, karat: "21" });
    call("gold:add", { kind: "save", direction: "buy", date: "2026-03-05", grams: 10, price: 5000, karat: "21" });
    call("gold:add", { kind: "save", direction: "sell", date: "2026-08-05", grams: 5, price: 5200, karat: "21" });
    const g = call("gold:summary", {});
    expect(g.loans.find((l: { id: number }) => l.id === id)).toMatchObject({ returned: 6, remaining: 4, gain: -3000 });
    expect(g.loans.find((l: { id: number }) => l.id === lend.id)).toMatchObject({ remaining: 0, gain: 2000 });
    expect(g.loanGain).toBe(-1000);
    expect(g.holdings[0]).toMatchObject({ karat: "21", grams: 15, avg: 4500, gain: 3500 });
    expect(() => call("gold:add", { kind: "save", direction: "sell", date: "2026-09-01", grams: 20, price: 5000, karat: "21" })).toThrow(/15/);
  });
});

describe("دهب صاحب الكوميشن من خزنة الشركة", () => {
  it("الشرا طالع والبيع داخل الخزنة ومن رصيده، و«الخزنة فيها كذا منهم كذا»", () => {
    const { db, call } = ops();
    db.prepare("UPDATE treasury_accounts SET opening_balance = 100000, opening_date = '2026-01-01' WHERE name = 'cash'").run();
    const before = call("hassan:cashStatus", {});
    expect(before.total).toBe(100000);
    expect(before.hassan).toBe(0);

    call("gold:add", { kind: "save", direction: "buy", date: "2026-03-01", grams: 10, price: 5000, karat: "21", method: "cash" });
    call("gold:add", { kind: "save", direction: "sell", date: "2026-04-01", grams: 4, price: 5500, karat: "21", method: "cash" });
    // سلفة دهب بس (من غير فلوس) مالهاش دعوة بالخزنة
    const loan = call("gold:add", { kind: "loan", direction: "borrow", party: "سيد", date: "2026-03-01", grams: 5, price: 5000, karat: "21" });
    // رد السلفة بدهب اتشرى بفلوس من الخزنة
    call("gold:add", { kind: "loan", direction: "repay", ref_id: loan.id, date: "2026-05-01", grams: 5, price: 5200, method: "cash" });

    const s = call("hassan:cashStatus", {});
    // -50000 + 22000 - 26000
    expect(s.total).toBe(100000 - 54000);
    expect(s.hassan).toBe(-54000);
    expect(s.company).toBe(100000);
    expect(call("hassan:treasuryBalance", { month: "2026-04" }).monthGold).toBe(22000);

    const moves = call("treasury:monthMovements", { month: "2026-03" });
    const buy = moves.find((m: { src: string }) => m.src === "hassan_gold");
    expect(buy).toMatchObject({ direction: "out", amount: 50000, account: "cash" });

    // تعديل المبلغ من الخزنة بيغيّر سعر الجرام
    call("treasury:movementUpdate", { src: "hassan_gold", src_id: buy.src_id, date: "2026-03-01", amount: 48000, account: "cash" });
    expect(db.prepare("SELECT price FROM hassan_gold WHERE id = ?").get(buy.src_id)).toEqual({ price: 4800 });
    expect(call("hassan:cashStatus", {}).hassan).toBe(-52000);
  });
});
