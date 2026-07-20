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
  hassan_commission: number | null;
}

interface MonthlyExpenseRow {
  id: number;
  equipment_id: number;
  month: string;
  category_id: number | null;
  amount: number;
  payment_method: string | null;
}

interface EmployeeAdvanceRow {
  id: number;
  employee_id: number;
  date: string;
  amount: number;
  note: string | null;
}

interface HassanLedgerRow {
  id: number;
  date: string;
  type: "loan" | "repayment" | "due" | "collection";
  amount: number;
  party_name: string | null;
  description: string | null;
  note: string | null;
}

interface MockState {
  partners: { id: number; name: string }[];
  employees: { id: number; name: string; wage_type: "daily" | "monthly"; rate: number }[];
  contractors: { id: number; name: string }[];
  expense_categories: { id: number; name: string }[];
  equipment: { id: number; name: string; shares: { partner_id: number; percentage: number }[] }[];
  daily_logs: DailyLogRow[];
  monthly_expenses: MonthlyExpenseRow[];
  employee_advances: EmployeeAdvanceRow[];
  hassan_ledger: HassanLedgerRow[];
  nextId: number;
}

function computeDayValue(log: DailyLogRow): number {
  if (log.role === "market") return log.fixed_value ?? 0;
  const dayRate = log.day_rate ?? 0;
  const hourlyRate = dayRate / 8;
  const overtimeHours = Math.max(0, (log.actual_hours ?? 0) - (log.base_hours ?? 0));
  return dayRate + overtimeHours * hourlyRate;
}

const WINCH_PERCENTAGE_EQUIPMENT = ["ونش 5 طن دبوسة", "ونش 3 وصلة"];

function computePairedCommission(equipmentName: string, driverLog: DailyLogRow, contractorLog: DailyLogRow): number {
  if (WINCH_PERCENTAGE_EQUIPMENT.includes(equipmentName)) {
    const k = contractorLog.day_rate ?? 0;
    return k <= 2500 ? k * 0.2 : k * 0.175;
  }
  const k = contractorLog.day_rate ?? 0;
  const h = driverLog.day_rate ?? 0;
  const overtimeHours = Math.max(0, (contractorLog.actual_hours ?? 0) - (contractorLog.base_hours ?? 0));
  return k - h + overtimeHours * (k / 8 - h / 8);
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
    employee_advances: [],
    hassan_ledger: [],
    nextId,
  };
}

function loadState(): MockState {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    const state = JSON.parse(raw) as MockState;
    if (!state.employee_advances) state.employee_advances = [];
    if (!state.hassan_ledger) state.hassan_ledger = [];
    return state;
  }
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
  if (channel === "dailyLogs:upsert") {
    const existing = state.daily_logs.find(
      (l) => l.equipment_id === payload.equipment_id && l.date === payload.date && l.role === payload.role
    );
    let record: DailyLogRow;
    if (existing) {
      Object.assign(existing, payload);
      record = existing;
    } else {
      record = { id: state.nextId++, ...payload };
      state.daily_logs.push(record);
    }
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

  if (channel === "employeeAdvances:list") {
    return state.employee_advances
      .filter((a) => a.employee_id === payload.employee_id && a.date.startsWith(payload.month))
      .sort((a, b) => a.date.localeCompare(b.date));
  }
  if (channel === "employeeAdvances:create") {
    const record: EmployeeAdvanceRow = { id: state.nextId++, ...payload, note: payload.note ?? null };
    state.employee_advances.push(record);
    saveState(state);
    return record;
  }
  if (channel === "employeeAdvances:delete") {
    state.employee_advances = state.employee_advances.filter((a) => a.id !== payload.id);
    saveState(state);
    return { ok: true };
  }

  if (channel === "payroll:summary") {
    const { month } = payload;
    return [...state.employees]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((emp) => {
        const advancesTotal = state.employee_advances
          .filter((a) => a.employee_id === emp.id && a.date.startsWith(month))
          .reduce((sum, a) => sum + a.amount, 0);

        if (emp.wage_type === "monthly") {
          return {
            id: emp.id,
            name: emp.name,
            wage_type: emp.wage_type,
            rate: emp.rate,
            days_worked: null,
            gross_pay: emp.rate,
            advances_total: advancesTotal,
            net_pay: emp.rate - advancesTotal,
          };
        }

        const logs = state.daily_logs.filter(
          (l) => l.role === "driver" && l.person_name === emp.name && l.date.startsWith(month)
        );
        const grossPay = logs.reduce((sum, l) => sum + computeDayValue(l), 0);
        return {
          id: emp.id,
          name: emp.name,
          wage_type: emp.wage_type,
          rate: emp.rate,
          days_worked: logs.length,
          gross_pay: grossPay,
          advances_total: advancesTotal,
          net_pay: grossPay - advancesTotal,
        };
      });
  }

  if (channel === "hassan:commissionSummary") {
    const { month } = payload;
    const rows: { equipment_id: number; equipment_name: string; date: string; source: string; commission: number }[] = [];

    for (const equipment of state.equipment) {
      const driverLogs = state.daily_logs.filter(
        (l) => l.equipment_id === equipment.id && l.role === "driver" && l.date.startsWith(month)
      );
      const contractorLogs = state.daily_logs.filter(
        (l) => l.equipment_id === equipment.id && l.role === "contractor" && l.date.startsWith(month)
      );
      const marketLogs = state.daily_logs.filter(
        (l) =>
          l.equipment_id === equipment.id &&
          l.role === "market" &&
          l.date.startsWith(month) &&
          l.hassan_commission != null
      );

      const driverByDate = new Map(driverLogs.map((l) => [l.date, l]));
      for (const contractorLog of contractorLogs) {
        const driverLog = driverByDate.get(contractorLog.date);
        if (!driverLog) continue;
        rows.push({
          equipment_id: equipment.id,
          equipment_name: equipment.name,
          date: contractorLog.date,
          source: "paired",
          commission: computePairedCommission(equipment.name, driverLog, contractorLog),
        });
      }
      for (const marketLog of marketLogs) {
        rows.push({
          equipment_id: equipment.id,
          equipment_name: equipment.name,
          date: marketLog.date,
          source: "market",
          commission: marketLog.hassan_commission ?? 0,
        });
      }
    }

    rows.sort((a, b) => a.date.localeCompare(b.date));
    const total = rows.reduce((sum, r) => sum + r.commission, 0);
    return { rows, total };
  }

  if (channel === "hassanLedger:list") {
    return state.hassan_ledger
      .filter((e) => e.date.startsWith(payload.month))
      .sort((a, b) => b.date.localeCompare(a.date));
  }
  if (channel === "hassanLedger:create") {
    const record: HassanLedgerRow = {
      id: state.nextId++,
      ...payload,
      party_name: payload.party_name ?? null,
      description: payload.description ?? null,
      note: payload.note ?? null,
    };
    state.hassan_ledger.push(record);
    saveState(state);
    return record;
  }
  if (channel === "hassanLedger:delete") {
    state.hassan_ledger = state.hassan_ledger.filter((e) => e.id !== payload.id);
    saveState(state);
    return { ok: true };
  }
  if (channel === "hassanLedger:balance") {
    const sum = (type: string) => state.hassan_ledger.filter((e) => e.type === type).reduce((s, e) => s + e.amount, 0);
    return { netDebt: sum("loan") - sum("repayment"), netDue: sum("due") - sum("collection") };
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
