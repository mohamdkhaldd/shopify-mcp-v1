// Browser-preview fallback. The real app always talks to SQLite through
// window.api (see electron/preload.js); this only exists so the Settings UI
// can be developed and previewed with `npm run dev` in a plain browser,
// where there is no Electron main process to answer IPC calls. Same
// channel names, same shapes — the UI code never knows which one it's using.
// Seed data mirrors electron/db.js's seedIfEmpty() so the preview matches
// what the packaged app actually opens with.

interface DailyLogRow {
  id: number;
  equipment_id: number;
  date: string;
  role: "driver" | "contractor" | "market";
  person_name: string;
  actual_hours: number | null;
  base_hours: number | null;
  day_rate: number | null;
  fixed_value: number | null;
}

interface MonthlyExpenseRow {
  id: number;
  equipment_id: number;
  month: string;
  category_id: number | null;
  amount: number;
  payment_method: string | null;
}

interface MockState {
  partners: { id: number; name: string }[];
  employees: { id: number; name: string; wage_type: "daily" | "monthly"; rate: number }[];
  contractors: { id: number; name: string }[];
  expense_categories: { id: number; name: string }[];
  equipment: { id: number; name: string; shares: { partner_id: number; percentage: number }[] }[];
  daily_logs: DailyLogRow[];
  monthly_expenses: MonthlyExpenseRow[];
  nextId: number;
}

function computeDayValue(log: DailyLogRow): number {
  if (log.role === "market") return log.fixed_value ?? 0;
  const dayRate = log.day_rate ?? 0;
  const hourlyRate = dayRate / 8;
  const overtimeHours = Math.max(0, (log.actual_hours ?? 0) - (log.base_hours ?? 0));
  return dayRate + overtimeHours * hourlyRate;
}

const STORAGE_KEY = "al-bunyan-mock-db";

const SEED_PARTNERS = ["الحج رمضان", "أبو طارق", "أبو أدهم", "مصطفى علي", "د. حازم", "محمد رمضان"];

const SEED_EQUIPMENT: { name: string; shares: [string, number][] }[] = [
  { name: "مان لفت 42", shares: [["الحج رمضان", 12.5], ["أبو طارق", 29.17], ["أبو أدهم", 58.33]] },
  { name: "مان لفت 28 أزرق", shares: [["أبو أدهم", 50], ["الحج رمضان", 25], ["أبو طارق", 25]] },
  { name: "مان لفت 28 أصفر", shares: [["الحج رمضان", 25], ["مصطفى علي", 75]] },
  { name: "بوكيت أزرق", shares: [["الحج رمضان", 33.33], ["أبو طارق", 33.33], ["أبو أدهم", 33.34]] },
  { name: "بوكيت أوتوماتيك", shares: [["مصطفى علي", 50], ["الحج رمضان", 50]] },
  { name: "بوكيت ميتسوبيشي", shares: [["الحج رمضان", 50], ["مصطفى علي", 50]] },
  { name: "بوكيت أخضر", shares: [["الحج رمضان", 50], ["أبو طارق", 50]] },
  { name: "بوكيت كامل", shares: [["د. حازم", 100]] },
  { name: "ونش 5 طن دبوسة", shares: [["الحج رمضان", 33.33], ["محمد رمضان", 33.33], ["أبو طارق", 33.34]] },
  { name: "ونش 3 وصلة", shares: [["الحج رمضان", 33.33], ["أبو طارق", 33.33], ["أبو أدهم", 33.34]] },
];

const SEED_EMPLOYEES: [string, "daily" | "monthly", number][] = [
  ["سيد حسين", "daily", 600],
  ["أشرف", "daily", 550],
  ["فتحي", "daily", 500],
  ["محمد الصياد", "daily", 500],
  ["أسامة علي", "daily", 475],
  ["أبو نسمة", "daily", 400],
  ["محمود", "daily", 400],
  ["خالد", "daily", 375],
  ["بدري", "daily", 375],
  ["فكري", "daily", 375],
  ["عبدالله", "daily", 500],
  ["التربو", "monthly", 12000],
];

const SEED_CONTRACTORS = ["محمد حماد", "حسام مرزوق", "مصطفى عثمان", "عثمان معتمد", "محمود عبد الكريم", "سوق"];

const SEED_EXPENSE_CATEGORIES = [
  "زيت", "صيانة", "مكنيكي", "راتب سائق", "سكن", "سولار", "كارتة", "مواصلات", "قطع غيار", "شهادة معايرة", "زيت هيدروليك",
];

function buildSeedState(): MockState {
  let nextId = 1;
  const partnerIds: Record<string, number> = {};
  const partners = SEED_PARTNERS.map((name) => {
    const id = nextId++;
    partnerIds[name] = id;
    return { id, name };
  });

  const equipment = SEED_EQUIPMENT.map((eq) => ({
    id: nextId++,
    name: eq.name,
    shares: eq.shares.map(([partnerName, percentage]) => ({
      partner_id: partnerIds[partnerName],
      percentage,
    })),
  }));

  const employees = SEED_EMPLOYEES.map(([name, wage_type, rate]) => ({
    id: nextId++,
    name,
    wage_type,
    rate,
  }));

  const contractors = SEED_CONTRACTORS.map((name) => ({ id: nextId++, name }));
  const expense_categories = SEED_EXPENSE_CATEGORIES.map((name) => ({ id: nextId++, name }));

  return {
    partners,
    employees,
    contractors,
    expense_categories,
    equipment,
    daily_logs: [],
    monthly_expenses: [],
    nextId,
  };
}

function loadState(): MockState {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) return JSON.parse(raw);
  const seeded = buildSeedState();
  saveState(seeded);
  return seeded;
}

function saveState(state: MockState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export async function mockInvoke(channel: string, payload?: any): Promise<any> {
  const state = loadState();

  if (channel === "dailyLogs:list") {
    return state.daily_logs
      .filter((l) => l.equipment_id === payload.equipment_id && l.role === payload.role && l.date.startsWith(payload.month))
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((l) => ({ ...l, day_value: computeDayValue(l) }));
  }
  if (channel === "dailyLogs:create") {
    const id = state.nextId++;
    const record: DailyLogRow = { id, ...payload };
    state.daily_logs.push(record);
    saveState(state);
    return { ...record, day_value: computeDayValue(record) };
  }
  if (channel === "dailyLogs:delete") {
    state.daily_logs = state.daily_logs.filter((l) => l.id !== payload.id);
    saveState(state);
    return { ok: true };
  }

  if (channel === "monthlyExpenses:list") {
    return state.monthly_expenses
      .filter((e) => e.equipment_id === payload.equipment_id && e.month === payload.month)
      .map((e) => ({
        ...e,
        category_name: state.expense_categories.find((c) => c.id === e.category_id)?.name ?? null,
      }));
  }
  if (channel === "monthlyExpenses:create") {
    const id = state.nextId++;
    const record: MonthlyExpenseRow = { id, ...payload };
    state.monthly_expenses.push(record);
    saveState(state);
    return {
      ...record,
      category_name: state.expense_categories.find((c) => c.id === record.category_id)?.name ?? null,
    };
  }
  if (channel === "monthlyExpenses:delete") {
    state.monthly_expenses = state.monthly_expenses.filter((e) => e.id !== payload.id);
    saveState(state);
    return { ok: true };
  }

  if (channel === "equipment:summary") {
    const { equipment_id, month } = payload;
    const driverLogs = state.daily_logs.filter(
      (l) => l.equipment_id === equipment_id && l.role === "driver" && l.date.startsWith(month)
    );
    const marketLogs = state.daily_logs.filter(
      (l) => l.equipment_id === equipment_id && l.role === "market" && l.date.startsWith(month)
    );
    const expenses = state.monthly_expenses.filter((e) => e.equipment_id === equipment_id && e.month === month);

    const driverIncome = driverLogs.reduce((sum, l) => sum + computeDayValue(l), 0);
    const marketIncome = marketLogs.reduce((sum, l) => sum + computeDayValue(l), 0);
    const income = driverIncome + marketIncome;
    const expenseTotal = expenses.reduce((sum, e) => sum + e.amount, 0);
    const netProfit = income - expenseTotal;

    const equipment = state.equipment.find((e) => e.id === equipment_id);
    const distribution = (equipment?.shares ?? []).map((s) => ({
      partner_id: s.partner_id,
      partner_name: state.partners.find((p) => p.id === s.partner_id)?.name ?? "—",
      percentage: s.percentage,
      amount: (netProfit * s.percentage) / 100,
    }));

    return { driverIncome, marketIncome, income, expenseTotal, netProfit, distribution };
  }

  const [entity, action] = channel.split(":");
  const key = { partners: "partners", employees: "employees", contractors: "contractors", expenseCategories: "expense_categories", equipment: "equipment" }[
    entity
  ] as keyof MockState;

  if (action === "list") {
    return state[key];
  }

  if (action === "create") {
    const id = state.nextId++;
    const record = { id, ...payload };
    (state[key] as any[]).push(record);
    saveState(state);
    return record;
  }

  if (action === "delete") {
    (state as any)[key] = (state[key] as any[]).filter((r) => r.id !== payload.id);
    saveState(state);
    return { ok: true };
  }

  throw new Error(`Unknown mock channel: ${channel}`);
}
