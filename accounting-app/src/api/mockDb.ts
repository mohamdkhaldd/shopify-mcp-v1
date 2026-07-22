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
  is_paid_leave: boolean;
  fixed_value: number | null;
  hassan_commission: number | null;
}

interface MonthlyExpenseRow {
  id: number;
  equipment_id: number;
  month: string;
  date: string | null;
  category_id: number | null;
  amount: number;
  payment_method: string | null;
}

interface EmployeeAdvanceRow {
  id: number;
  employee_id: number;
  date: string;
  amount: number;
  payment_method: "wallet" | "instapay" | "cash";
  note: string | null;
}

interface EmployeeBonusRow {
  id: number;
  employee_id: number;
  date: string;
  amount: number;
  payment_method: "wallet" | "instapay" | "cash";
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

interface ContractorPaymentRow {
  id: number;
  contractor_id: number;
  date: string;
  amount: number;
  method: string;
  note: string | null;
}

interface PartnerPaymentRow {
  id: number;
  partner_id: number;
  date: string;
  amount: number;
  method: string;
  note: string | null;
}

interface TreasuryAccountRow {
  id: number;
  name: "wallet" | "instapay" | "cash";
  current_balance: number;
}

interface SupplierRow {
  id: number;
  name: string;
}

interface SupplierPurchaseRow {
  id: number;
  supplier_id: number;
  date: string;
  description: string | null;
  amount: number;
  note: string | null;
}

interface SupplierPaymentRow {
  id: number;
  supplier_id: number;
  date: string;
  amount: number;
  method: string;
  note: string | null;
}

interface MockState {
  partners: { id: number; name: string; opening_balance: number }[];
  employees: { id: number; name: string; wage_type: "daily" | "monthly"; rate: number; fixed_salary: boolean }[];
  contractors: { id: number; name: string; opening_balance: number }[];
  expense_categories: { id: number; name: string }[];
  equipment: { id: number; name: string; purchase_price: number; shares: { partner_id: number; percentage: number }[] }[];
  daily_logs: DailyLogRow[];
  monthly_expenses: MonthlyExpenseRow[];
  employee_advances: EmployeeAdvanceRow[];
  employee_bonuses: EmployeeBonusRow[];
  hassan_ledger: HassanLedgerRow[];
  contractor_payments: ContractorPaymentRow[];
  partner_payments: PartnerPaymentRow[];
  treasury_accounts: TreasuryAccountRow[];
  suppliers: SupplierRow[];
  supplier_purchases: SupplierPurchaseRow[];
  supplier_payments: SupplierPaymentRow[];
  nextId: number;
}

const ACCOUNT_NAME_AR: Record<string, string> = { wallet: "محفظة", instapay: "انستا باي", cash: "كاش" };

function computeDayValue(log: DailyLogRow): number {
  if (log.role === "market") return (log.fixed_value ?? 0) - (log.hassan_commission ?? 0);
  if (log.is_paid_leave) return 0;
  const dayRate = log.day_rate ?? 0;
  const hourlyRate = dayRate / 8;
  const overtimeHours = Math.max(0, (log.actual_hours ?? 0) - (log.base_hours ?? 0));
  return dayRate + overtimeHours * hourlyRate;
}

// مرتب السائق مبني على سعره الثابت المسجل في الإعدادات، مش على أي رقم متكتب
// في شيت السركي (ده بقى بيمثل قد إيه المعدة اشتغلت بيه، رقم مختلف تمامًا).
// بيتطبق على أصحاب الأجر اليومي بس — بيتحسب من الأيام المسجلة فعليًا فقط.
function computeDriverWageValue(log: DailyLogRow, employeeRate: number): number {
  if (log.is_paid_leave) return 0;
  const hourlyRate = employeeRate / 8;
  const overtimeHours = Math.max(0, (log.actual_hours ?? 0) - (log.base_hours ?? 0));
  return employeeRate + overtimeHours * hourlyRate;
}

function daysInMonthList(monthKey: string): string[] {
  const [year, month] = monthKey.split("-").map(Number);
  const daysCount = new Date(year, month, 0).getDate();
  return Array.from({ length: daysCount }, (_, i) => `${monthKey}-${String(i + 1).padStart(2, "0")}`);
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

const STORAGE_KEY = "al-bunyan-mock-db-v6";

// Real starting data pulled from the company's existing Excel system, so the
// preview opens already reflecting how the business actually operates.
// Only the reference/master lists are seeded — daily logs, expenses,
// advances and every other transactional table always start empty.
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

// fixed_salary بيبقى true بس لموظف شهري مرتبه ثابت مهما حصل (زي المكنيكي) —
// مش مرتبط بحضوره في السركي زي السواقين الشهريين.
const SEED_EMPLOYEES: [string, "daily" | "monthly", number, boolean][] = [
  ["سيد حسين", "daily", 600, false],
  ["أشرف", "daily", 550, false],
  ["فتحي", "daily", 500, false],
  ["محمد الصياد", "daily", 500, false],
  ["أسامة علي", "daily", 475, false],
  ["أبو نسمة", "daily", 400, false],
  ["محمود", "daily", 400, false],
  ["خالد", "daily", 375, false],
  ["بدري", "daily", 375, false],
  ["فكري", "daily", 375, false],
  ["عبدالله", "daily", 500, false],
  ["التربو", "monthly", 12000, true],
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
    return { id, name, opening_balance: 0 };
  });

  const equipment = SEED_EQUIPMENT.map((eq) => ({
    id: nextId++,
    name: eq.name,
    purchase_price: 0,
    shares: eq.shares.map(([partnerName, percentage]) => ({
      partner_id: partnerIds[partnerName],
      percentage,
    })),
  }));

  const employees = SEED_EMPLOYEES.map(([name, wage_type, rate, fixed_salary]) => ({
    id: nextId++,
    name,
    wage_type,
    rate,
    fixed_salary,
  }));

  const contractors = SEED_CONTRACTORS.map((name) => ({ id: nextId++, name, opening_balance: 0 }));
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
    employee_bonuses: [],
    hassan_ledger: [],
    contractor_payments: [],
    partner_payments: [],
    treasury_accounts: [
      { id: nextId++, name: "wallet", current_balance: 0 },
      { id: nextId++, name: "instapay", current_balance: 0 },
      { id: nextId++, name: "cash", current_balance: 0 },
    ],
    suppliers: [],
    supplier_purchases: [],
    supplier_payments: [],
    nextId,
  };
}

function loadState(): MockState {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    const state = JSON.parse(raw) as MockState;
    for (const p of state.partners) if (p.opening_balance == null) p.opening_balance = 0;
    for (const c of state.contractors) if (c.opening_balance == null) c.opening_balance = 0;
    for (const e of state.employees) if (e.fixed_salary == null) e.fixed_salary = false;
    for (const e of state.monthly_expenses) if (e.date === undefined) e.date = null;
    for (const eq of state.equipment) if (eq.purchase_price == null) eq.purchase_price = 0;
    if (!state.employee_advances) state.employee_advances = [];
    if (!state.employee_bonuses) state.employee_bonuses = [];
    if (!state.hassan_ledger) state.hassan_ledger = [];
    if (!state.contractor_payments) state.contractor_payments = [];
    if (!state.partner_payments) state.partner_payments = [];
    if (!state.treasury_accounts) {
      state.treasury_accounts = [
        { id: state.nextId++, name: "wallet", current_balance: 0 },
        { id: state.nextId++, name: "instapay", current_balance: 0 },
        { id: state.nextId++, name: "cash", current_balance: 0 },
      ];
    }
    if (!state.suppliers) state.suppliers = [];
    if (!state.supplier_purchases) state.supplier_purchases = [];
    if (!state.supplier_payments) state.supplier_payments = [];
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
      .sort((a, b) => (a.date ?? "").localeCompare(b.date ?? "") || a.id - b.id)
      .map((e) => ({
        ...e,
        category_name: state.expense_categories.find((c) => c.id === e.category_id)?.name ?? null,
      }));
  }
  if (channel === "monthlyExpenses:create") {
    const id = state.nextId++;
    const record: MonthlyExpenseRow = { id, ...payload, date: payload.date ?? null };
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

  // مرتب السائق بيتحط كمصروف حقيقي على المعدة ("مرتب سائق") محسوب من سعره
  // الثابت في الإعدادات. month=null يحسب كل الوقت (مستخدم في equipmentAllTimeProfit).
  // بيشمل بس أصحاب الأجر اليومي — الشهري بيتحسب كتكلفة شركة عامة في المرتبات.
  function driverSalaryForEquipment(equipmentId: number, month: string | null): number {
    return state.daily_logs
      .filter((l) => l.equipment_id === equipmentId && l.role === "driver" && (month === null || l.date.startsWith(month)))
      .reduce((sum, l) => {
        const employee = state.employees.find((e) => e.name === l.person_name);
        if (!employee || employee.wage_type !== "daily") return sum;
        return sum + computeDriverWageValue(l, employee.rate);
      }, 0);
  }

  // موظف بمرتب شهري وله حضور مرتبط بالسركي (سواق شهري مثلًا): مرتبه بيتقسم
  // على عدد أيام الشهر، وأي يوم مفيش له حضور ولا إجازة مدفوعة مُعلّمة
  // بيتخصم من مرتبه — من غير أي استثناء تلقائي ليوم الجمعة، لازم المكتب
  // يعلّم بنفسه أي يوم عايز يتحسب مدفوع من غير شغل. أما الموظف اللي مرتبه
  // ثابت مهما حصل (زي مكنيكي مش بيتسجل في سركي أي معدة) فبياخد مرتبه كامل.
  function monthlyEmployeeGrossPay(emp: { name: string; rate: number; fixed_salary?: boolean }, month: string) {
    const days = daysInMonthList(month);
    const dailyRate = emp.rate / days.length;
    if (emp.fixed_salary) {
      return { grossPay: emp.rate, deductedDays: 0, dailyRate };
    }
    const logs = state.daily_logs.filter((l) => l.role === "driver" && l.person_name === emp.name && l.date.startsWith(month));
    const accountedDates = new Set(logs.map((l) => l.date));
    let deductedDays = 0;
    for (const date of days) {
      if (accountedDates.has(date)) continue;
      deductedDays++;
    }
    return { grossPay: emp.rate - deductedDays * dailyRate, deductedDays, dailyRate };
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
    const driverSalaryExpense = driverSalaryForEquipment(equipment_id, month);
    const manualExpenseTotal = expenses.reduce((sum, e) => sum + e.amount, 0);
    const expenseTotal = manualExpenseTotal + driverSalaryExpense;
    const netProfit = income - expenseTotal;

    const equipment = state.equipment.find((e) => e.id === equipment_id);
    const distribution = (equipment?.shares ?? []).map((s) => ({
      partner_id: s.partner_id,
      partner_name: state.partners.find((p) => p.id === s.partner_id)?.name ?? "—",
      percentage: s.percentage,
      amount: (netProfit * s.percentage) / 100,
    }));

    return {
      driverIncome,
      marketIncome,
      income,
      driverSalaryExpense,
      manualExpenseTotal,
      expenseTotal,
      netProfit,
      distribution,
    };
  }

  if (channel === "employeeAdvances:list") {
    return state.employee_advances
      .filter((a) => a.employee_id === payload.employee_id && a.date.startsWith(payload.month))
      .sort((a, b) => a.date.localeCompare(b.date));
  }
  if (channel === "employeeAdvances:create") {
    const record: EmployeeAdvanceRow = {
      id: state.nextId++,
      ...payload,
      payment_method: payload.payment_method || "cash",
      note: payload.note ?? null,
    };
    state.employee_advances.push(record);
    saveState(state);
    return record;
  }
  if (channel === "employeeAdvances:delete") {
    state.employee_advances = state.employee_advances.filter((a) => a.id !== payload.id);
    saveState(state);
    return { ok: true };
  }

  if (channel === "employeeBonuses:list") {
    return state.employee_bonuses
      .filter((b) => b.employee_id === payload.employee_id && b.date.startsWith(payload.month))
      .sort((a, b) => a.date.localeCompare(b.date));
  }
  if (channel === "employeeBonuses:create") {
    const record: EmployeeBonusRow = {
      id: state.nextId++,
      ...payload,
      payment_method: payload.payment_method || "cash",
      note: payload.note ?? null,
    };
    state.employee_bonuses.push(record);
    saveState(state);
    return record;
  }
  if (channel === "employeeBonuses:delete") {
    state.employee_bonuses = state.employee_bonuses.filter((b) => b.id !== payload.id);
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
        const bonusesTotal = state.employee_bonuses
          .filter((b) => b.employee_id === emp.id && b.date.startsWith(month))
          .reduce((sum, b) => sum + b.amount, 0);

        if (emp.wage_type === "monthly") {
          const { grossPay } = monthlyEmployeeGrossPay(emp, month);
          return {
            id: emp.id,
            name: emp.name,
            wage_type: emp.wage_type,
            rate: emp.rate,
            fixed_salary: !!emp.fixed_salary,
            days_worked: null,
            gross_pay: grossPay,
            advances_total: advancesTotal,
            bonuses_total: bonusesTotal,
            net_pay: grossPay + bonusesTotal - advancesTotal,
          };
        }

        const logs = state.daily_logs.filter(
          (l) => l.role === "driver" && l.person_name === emp.name && l.date.startsWith(month)
        );
        const grossPay = logs.reduce((sum, l) => sum + computeDriverWageValue(l, emp.rate), 0);
        return {
          id: emp.id,
          name: emp.name,
          wage_type: emp.wage_type,
          rate: emp.rate,
          fixed_salary: !!emp.fixed_salary,
          days_worked: logs.length,
          gross_pay: grossPay,
          advances_total: advancesTotal,
          bonuses_total: bonusesTotal,
          net_pay: grossPay + bonusesTotal - advancesTotal,
        };
      });
  }

  if (channel === "payroll:detail") {
    const { employee_id, month } = payload;
    const employee = state.employees.find((e) => e.id === employee_id)!;
    const advances = state.employee_advances
      .filter((a) => a.employee_id === employee_id && a.date.startsWith(month))
      .sort((a, b) => a.date.localeCompare(b.date));
    const advancesTotal = advances.reduce((sum, a) => sum + a.amount, 0);
    const bonuses = state.employee_bonuses
      .filter((b) => b.employee_id === employee_id && b.date.startsWith(month))
      .sort((a, b) => a.date.localeCompare(b.date));
    const bonusesTotal = bonuses.reduce((sum, b) => sum + b.amount, 0);

    if (employee.wage_type === "monthly") {
      const { grossPay, dailyRate } = monthlyEmployeeGrossPay(employee, month);
      let days: { date: string; equipment_name: string; actual_hours: number | null; base_hours: number | null; day_rate: number | null; day_value: number }[] = [];
      if (!employee.fixed_salary) {
        const logs = state.daily_logs
          .filter((l) => l.role === "driver" && l.person_name === employee.name && l.date.startsWith(month))
          .sort((a, b) => a.date.localeCompare(b.date));
        days = logs.map((l) => ({
          date: l.date,
          equipment_name: state.equipment.find((e) => e.id === l.equipment_id)?.name ?? "—",
          actual_hours: l.actual_hours,
          base_hours: l.base_hours,
          day_rate: null,
          day_value: dailyRate,
        }));
      }
      return {
        employee,
        days,
        advances,
        bonuses,
        grossPay,
        advancesTotal,
        bonusesTotal,
        netPay: grossPay + bonusesTotal - advancesTotal,
      };
    }

    const logs = state.daily_logs
      .filter((l) => l.role === "driver" && l.person_name === employee.name && l.date.startsWith(month))
      .sort((a, b) => a.date.localeCompare(b.date));
    const days = logs.map((l) => ({
      date: l.date,
      equipment_name: state.equipment.find((e) => e.id === l.equipment_id)?.name ?? "—",
      actual_hours: l.actual_hours,
      base_hours: l.base_hours,
      day_rate: employee.rate,
      day_value: computeDriverWageValue(l, employee.rate),
    }));
    const grossPay = days.reduce((sum, d) => sum + d.day_value, 0);

    return { employee, days, advances, bonuses, grossPay, advancesTotal, bonusesTotal, netPay: grossPay + bonusesTotal - advancesTotal };
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

  if (channel === "hassan:equipmentCommission") {
    const { equipment_id, month } = payload;
    const equipment = state.equipment.find((e) => e.id === equipment_id)!;
    const year = month.split("-")[0];

    const driverLogs = state.daily_logs.filter(
      (l) => l.equipment_id === equipment_id && l.role === "driver" && l.date.startsWith(`${year}-`)
    );
    const contractorLogs = state.daily_logs.filter(
      (l) => l.equipment_id === equipment_id && l.role === "contractor" && l.date.startsWith(`${year}-`)
    );
    const marketLogs = state.daily_logs.filter(
      (l) =>
        l.equipment_id === equipment_id &&
        l.role === "market" &&
        l.date.startsWith(`${year}-`) &&
        l.hassan_commission != null
    );

    const driverByDate = new Map(driverLogs.map((l) => [l.date, l]));
    const allRows: { date: string; source: "paired" | "market"; contractor_rate: number; driver_rate: number | null; commission: number }[] = [];
    for (const contractorLog of contractorLogs) {
      const driverLog = driverByDate.get(contractorLog.date);
      if (!driverLog) continue;
      allRows.push({
        date: contractorLog.date,
        source: "paired",
        contractor_rate: contractorLog.day_rate ?? 0,
        driver_rate: driverLog.day_rate ?? 0,
        commission: computePairedCommission(equipment.name, driverLog, contractorLog),
      });
    }
    for (const marketLog of marketLogs) {
      allRows.push({
        date: marketLog.date,
        source: "market",
        contractor_rate: marketLog.fixed_value ?? 0,
        driver_rate: null,
        commission: marketLog.hassan_commission ?? 0,
      });
    }
    allRows.sort((a, b) => a.date.localeCompare(b.date));

    const days = allRows.filter((r) => r.date.startsWith(month));
    const monthTotal = days.reduce((sum, r) => sum + r.commission, 0);
    const yearTotal = allRows.reduce((sum, r) => sum + r.commission, 0);

    return { equipment_id, equipment_name: equipment.name, days, monthTotal, yearTotal };
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
  if (channel === "hassanLedger:balanceByParty") {
    const byParty = new Map<string, { loan: number; repayment: number; due: number; collection: number }>();
    for (const row of state.hassan_ledger) {
      const party = row.party_name?.trim() || "بدون تحديد";
      if (!byParty.has(party)) byParty.set(party, { loan: 0, repayment: 0, due: 0, collection: 0 });
      byParty.get(party)![row.type] += row.amount;
    }
    return [...byParty.entries()]
      .map(([party_name, p]) => ({ party_name, netDebt: p.loan - p.repayment, netDue: p.due - p.collection }))
      .filter((p) => p.netDebt !== 0 || p.netDue !== 0)
      .sort((a, b) => a.party_name.localeCompare(b.party_name));
  }

  if (channel === "contractorPayments:list") {
    return state.contractor_payments
      .filter((p) => p.contractor_id === payload.contractor_id)
      .sort((a, b) => b.date.localeCompare(a.date));
  }
  if (channel === "contractorPayments:create") {
    const record: ContractorPaymentRow = {
      id: state.nextId++,
      ...payload,
      method: payload.method || "cash",
      note: payload.note ?? null,
    };
    state.contractor_payments.push(record);
    saveState(state);
    return record;
  }
  if (channel === "contractorPayments:delete") {
    state.contractor_payments = state.contractor_payments.filter((p) => p.id !== payload.id);
    saveState(state);
    return { ok: true };
  }

  if (channel === "contractors:updateOpeningBalance") {
    const contractor = state.contractors.find((c) => c.id === payload.id)!;
    contractor.opening_balance = payload.opening_balance;
    saveState(state);
    return contractor;
  }

  if (channel === "contractors:summary") {
    return state.contractors.map((c) => {
      const totalWork =
        c.opening_balance +
        state.daily_logs
          .filter((l) => l.role === "contractor" && l.person_name === c.name)
          .reduce((sum, l) => sum + computeDayValue(l), 0);
      const totalPaid = state.contractor_payments
        .filter((p) => p.contractor_id === c.id)
        .reduce((sum, p) => sum + p.amount, 0);
      return {
        id: c.id,
        name: c.name,
        opening_balance: c.opening_balance,
        totalWork,
        totalPaid,
        remaining: totalWork - totalPaid,
      };
    });
  }

  if (channel === "contractors:detail") {
    const contractor = state.contractors.find((c) => c.id === payload.contractor_id)!;
    const logs = state.daily_logs.filter((l) => l.role === "contractor" && l.person_name === contractor.name);

    const byEquipment = new Map<string, { equipment_name: string; days: number; totalValue: number }>();
    for (const log of logs) {
      const equipmentName = state.equipment.find((e) => e.id === log.equipment_id)?.name ?? "—";
      const entry = byEquipment.get(equipmentName) ?? { equipment_name: equipmentName, days: 0, totalValue: 0 };
      entry.days += 1;
      entry.totalValue += computeDayValue(log);
      byEquipment.set(equipmentName, entry);
    }

    const payments = state.contractor_payments
      .filter((p) => p.contractor_id === payload.contractor_id)
      .sort((a, b) => b.date.localeCompare(a.date));
    const totalWork = contractor.opening_balance + logs.reduce((sum, l) => sum + computeDayValue(l), 0);
    const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);

    return {
      contractor,
      workByEquipment: [...byEquipment.values()],
      payments,
      totalWork,
      totalPaid,
      remaining: totalWork - totalPaid,
    };
  }

  if (channel === "partnerPayments:list") {
    return state.partner_payments
      .filter((p) => p.partner_id === payload.partner_id)
      .sort((a, b) => b.date.localeCompare(a.date));
  }
  if (channel === "partnerPayments:create") {
    const record: PartnerPaymentRow = {
      id: state.nextId++,
      ...payload,
      method: payload.method || "cash",
      note: payload.note ?? null,
    };
    state.partner_payments.push(record);
    saveState(state);
    return record;
  }
  if (channel === "partnerPayments:delete") {
    state.partner_payments = state.partner_payments.filter((p) => p.id !== payload.id);
    saveState(state);
    return { ok: true };
  }

  function equipmentAllTimeProfit(equipmentId: number): number {
    const income = state.daily_logs
      .filter((l) => l.equipment_id === equipmentId && (l.role === "driver" || l.role === "market"))
      .reduce((sum, l) => sum + computeDayValue(l), 0);
    const expense = state.monthly_expenses
      .filter((e) => e.equipment_id === equipmentId)
      .reduce((sum, e) => sum + e.amount, 0);
    const driverSalaryExpense = driverSalaryForEquipment(equipmentId, null);
    return income - expense - driverSalaryExpense;
  }

  // كل معدة بتحمل سعر شرائها، وبنحسب لها "رجعت كام في الميه من سعرها" من
  // صافي ربحها من أول ما بدأت — زي جدول الإكسيل القديم.
  if (channel === "equipment:list") {
    return state.equipment.map((eq) => {
      const allTimeProfit = equipmentAllTimeProfit(eq.id);
      const roiPercent = eq.purchase_price > 0 ? (allTimeProfit / eq.purchase_price) * 100 : null;
      return { ...eq, allTimeProfit, roiPercent };
    });
  }

  // بيسمح بتعديل سعر الشراء ونسب الشركاء من غير ما تحذف المعدة وتضيفها تاني.
  if (channel === "equipment:update") {
    const eq = state.equipment.find((e) => e.id === payload.id)!;
    eq.purchase_price = payload.purchase_price ?? 0;
    eq.shares = payload.shares ?? [];
    saveState(state);
    const allTimeProfit = equipmentAllTimeProfit(eq.id);
    const roiPercent = eq.purchase_price > 0 ? (allTimeProfit / eq.purchase_price) * 100 : null;
    return { ...eq, allTimeProfit, roiPercent };
  }

  if (channel === "partners:updateOpeningBalance") {
    const partner = state.partners.find((p) => p.id === payload.id)!;
    partner.opening_balance = payload.opening_balance;
    saveState(state);
    return partner;
  }

  if (channel === "partners:summary") {
    return state.partners.map((p) => {
      const equipmentList = state.equipment.filter((e) => e.shares.some((s) => s.partner_id === p.id));
      const totalDue =
        p.opening_balance +
        equipmentList.reduce((sum, e) => {
          const share = e.shares.find((s) => s.partner_id === p.id)!;
          return sum + (equipmentAllTimeProfit(e.id) * share.percentage) / 100;
        }, 0);
      const totalPaid = state.partner_payments
        .filter((pp) => pp.partner_id === p.id)
        .reduce((sum, pp) => sum + pp.amount, 0);
      return {
        id: p.id,
        name: p.name,
        opening_balance: p.opening_balance,
        totalDue,
        totalPaid,
        remaining: totalDue - totalPaid,
      };
    });
  }

  if (channel === "partners:detail") {
    const { partner_id, month } = payload;
    const partner = state.partners.find((p) => p.id === partner_id)!;
    const equipmentList = state.equipment.filter((e) => e.shares.some((s) => s.partner_id === partner_id));

    const equipmentBreakdown = equipmentList.map((e) => {
      const share = e.shares.find((s) => s.partner_id === partner_id)!;
      const driverIncome = state.daily_logs
        .filter((l) => l.equipment_id === e.id && l.role === "driver" && l.date.startsWith(month))
        .reduce((sum, l) => sum + computeDayValue(l), 0);
      const marketIncome = state.daily_logs
        .filter((l) => l.equipment_id === e.id && l.role === "market" && l.date.startsWith(month))
        .reduce((sum, l) => sum + computeDayValue(l), 0);
      const expense = state.monthly_expenses
        .filter((exp) => exp.equipment_id === e.id && exp.month === month)
        .reduce((sum, exp) => sum + exp.amount, 0);
      const driverSalaryExpense = driverSalaryForEquipment(e.id, month);
      const netProfit = driverIncome + marketIncome - expense - driverSalaryExpense;
      return { equipment_name: e.name, percentage: share.percentage, monthAmount: (netProfit * share.percentage) / 100 };
    });

    const monthDue = equipmentBreakdown.reduce((sum, e) => sum + e.monthAmount, 0);
    const totalDue =
      partner.opening_balance +
      equipmentList.reduce((sum, e) => {
        const share = e.shares.find((s) => s.partner_id === partner_id)!;
        return sum + (equipmentAllTimeProfit(e.id) * share.percentage) / 100;
      }, 0);
    const payments = state.partner_payments
      .filter((p) => p.partner_id === partner_id)
      .sort((a, b) => b.date.localeCompare(a.date));
    const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);

    return { partner, monthDue, equipmentBreakdown, totalDue, totalPaid, remaining: totalDue - totalPaid, payments };
  }

  if (channel === "treasury:list") {
    return state.treasury_accounts.map((a) => ({ ...a, name_ar: ACCOUNT_NAME_AR[a.name] ?? a.name }));
  }
  if (channel === "treasury:updateBalance") {
    const account = state.treasury_accounts.find((a) => a.id === payload.id)!;
    account.current_balance = payload.current_balance;
    saveState(state);
    return account;
  }
  if (channel === "treasury:summary") {
    const { month } = payload;
    const sumByMethod = (
      rows: { amount: number; method?: string | null; payment_method?: string | null }[],
      dateOk: boolean[]
    ) => {
      const acc: Record<string, number> = {};
      rows.forEach((r, i) => {
        if (!dateOk[i]) return;
        const method = r.method ?? r.payment_method ?? "cash";
        acc[method] = (acc[method] ?? 0) + r.amount;
      });
      return acc;
    };
    const incoming = sumByMethod(
      state.contractor_payments,
      state.contractor_payments.map((p) => p.date.startsWith(month))
    );
    const outPartners = sumByMethod(
      state.partner_payments,
      state.partner_payments.map((p) => p.date.startsWith(month))
    );
    const outExpenses = sumByMethod(
      state.monthly_expenses,
      state.monthly_expenses.map((e) => e.month === month)
    );
    const outSuppliers = sumByMethod(
      state.supplier_payments,
      state.supplier_payments.map((p) => p.date.startsWith(month))
    );
    const outAdvances = sumByMethod(
      state.employee_advances,
      state.employee_advances.map((a) => a.date.startsWith(month))
    );
    const outBonuses = sumByMethod(
      state.employee_bonuses,
      state.employee_bonuses.map((b) => b.date.startsWith(month))
    );

    return state.treasury_accounts.map((acc) => {
      const monthIncoming = incoming[acc.name] ?? 0;
      const monthOutgoing =
        (outPartners[acc.name] ?? 0) +
        (outExpenses[acc.name] ?? 0) +
        (outSuppliers[acc.name] ?? 0) +
        (outAdvances[acc.name] ?? 0) +
        (outBonuses[acc.name] ?? 0);
      const netMovement = monthIncoming - monthOutgoing;
      return {
        id: acc.id,
        name: acc.name,
        name_ar: ACCOUNT_NAME_AR[acc.name] ?? acc.name,
        currentBalance: acc.current_balance,
        monthIncoming,
        monthOutgoing,
        netMovement,
        projectedBalance: acc.current_balance + netMovement,
      };
    });
  }

  function findOrCreateSupplier(name: string): SupplierRow {
    const trimmed = name.trim();
    const existing = state.suppliers.find((s) => s.name === trimmed);
    if (existing) return existing;
    const record = { id: state.nextId++, name: trimmed };
    state.suppliers.push(record);
    return record;
  }

  if (channel === "suppliers:names") {
    return state.suppliers.map((s) => s.name).sort();
  }
  if (channel === "supplierPurchases:create") {
    const supplier = findOrCreateSupplier(payload.supplier_name);
    const record: SupplierPurchaseRow = {
      id: state.nextId++,
      supplier_id: supplier.id,
      date: payload.date,
      description: payload.description ?? null,
      amount: payload.amount,
      note: payload.note ?? null,
    };
    state.supplier_purchases.push(record);
    saveState(state);
    return { ...record, supplier_name: supplier.name };
  }
  if (channel === "supplierPayments:create") {
    const supplier = findOrCreateSupplier(payload.supplier_name);
    const record: SupplierPaymentRow = {
      id: state.nextId++,
      supplier_id: supplier.id,
      date: payload.date,
      amount: payload.amount,
      method: payload.method || "cash",
      note: payload.note ?? null,
    };
    state.supplier_payments.push(record);
    saveState(state);
    return { ...record, supplier_name: supplier.name };
  }
  if (channel === "supplierPurchases:delete") {
    state.supplier_purchases = state.supplier_purchases.filter((p) => p.id !== payload.id);
    saveState(state);
    return { ok: true };
  }
  if (channel === "supplierPayments:delete") {
    state.supplier_payments = state.supplier_payments.filter((p) => p.id !== payload.id);
    saveState(state);
    return { ok: true };
  }
  if (channel === "suppliers:dashboard") {
    return state.suppliers.map((s) => {
      const purchases = state.supplier_purchases.filter((p) => p.supplier_id === s.id).sort((a, b) => b.date.localeCompare(a.date));
      const payments = state.supplier_payments.filter((p) => p.supplier_id === s.id).sort((a, b) => b.date.localeCompare(a.date));
      const totalPurchases = purchases.reduce((sum, p) => sum + p.amount, 0);
      const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
      return {
        id: s.id,
        name: s.name,
        purchaseCount: purchases.length,
        totalPurchases,
        totalPaid,
        remaining: totalPurchases - totalPaid,
        purchases,
        payments,
      };
    });
  }

  if (channel === "reports:monthly") {
    const { month } = payload;
    let totalIncome = 0;
    let totalExpense = 0;
    const equipmentRows = state.equipment.map((eq) => {
      const income = state.daily_logs
        .filter((l) => l.equipment_id === eq.id && (l.role === "driver" || l.role === "market") && l.date.startsWith(month))
        .reduce((sum, l) => sum + computeDayValue(l), 0);
      const manualExpense = state.monthly_expenses
        .filter((e) => e.equipment_id === eq.id && e.month === month)
        .reduce((sum, e) => sum + e.amount, 0);
      const driverSalaryExpense = driverSalaryForEquipment(eq.id, month);
      const expense = manualExpense + driverSalaryExpense;
      totalIncome += income;
      totalExpense += expense;
      return { equipment_name: eq.name, income, expense, netProfit: income - expense };
    });

    let payrollTotal = 0;
    for (const emp of state.employees) {
      const advances = state.employee_advances
        .filter((a) => a.employee_id === emp.id && a.date.startsWith(month))
        .reduce((sum, a) => sum + a.amount, 0);
      const bonuses = state.employee_bonuses
        .filter((b) => b.employee_id === emp.id && b.date.startsWith(month))
        .reduce((sum, b) => sum + b.amount, 0);
      if (emp.wage_type === "monthly") {
        const { grossPay } = monthlyEmployeeGrossPay(emp, month);
        payrollTotal += grossPay + bonuses - advances;
      } else {
        const gross = state.daily_logs
          .filter((l) => l.role === "driver" && l.person_name === emp.name && l.date.startsWith(month))
          .reduce((sum, l) => sum + computeDriverWageValue(l, emp.rate), 0);
        payrollTotal += gross + bonuses - advances;
      }
    }

    const commissionRows: number[] = [];
    for (const eq of state.equipment) {
      const driverLogs = state.daily_logs.filter((l) => l.equipment_id === eq.id && l.role === "driver" && l.date.startsWith(month));
      const contractorLogs = state.daily_logs.filter((l) => l.equipment_id === eq.id && l.role === "contractor" && l.date.startsWith(month));
      const marketLogs = state.daily_logs.filter(
        (l) => l.equipment_id === eq.id && l.role === "market" && l.date.startsWith(month) && l.hassan_commission != null
      );
      const driverByDate = new Map(driverLogs.map((l) => [l.date, l]));
      for (const cl of contractorLogs) {
        const dl = driverByDate.get(cl.date);
        if (!dl) continue;
        commissionRows.push(computePairedCommission(eq.name, dl, cl));
      }
      for (const ml of marketLogs) commissionRows.push(ml.hassan_commission ?? 0);
    }
    const hassanCommissionTotal = commissionRows.reduce((sum, c) => sum + c, 0);

    return {
      month,
      equipmentRows,
      totalIncome,
      totalExpense,
      netProfit: totalIncome - totalExpense,
      payrollTotal,
      hassanCommissionTotal,
      treasuryBalances: state.treasury_accounts.map((a) => ({ name: a.name, name_ar: ACCOUNT_NAME_AR[a.name] ?? a.name, balance: a.current_balance })),
    };
  }

  // بديل حي لمصدر بيانات الرئيسية اللي كان ثابت من ملف إكسل قديم — بيحسب
  // كل حاجة من الداتا الحقيقية للسنة الحالية.
  if (channel === "dashboard:summary") {
    const MONTH_NAMES_AR = [
      "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
      "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
    ];
    const now = new Date();
    const year = String(now.getFullYear());
    const currentMonthIndex = now.getMonth();

    function equipmentMonthTotals(equipmentId: number, monthKey: string) {
      const income = state.daily_logs
        .filter((l) => l.equipment_id === equipmentId && (l.role === "driver" || l.role === "market") && l.date.startsWith(monthKey))
        .reduce((sum, l) => sum + computeDayValue(l), 0);
      const manualExpense = state.monthly_expenses
        .filter((e) => e.equipment_id === equipmentId && e.month === monthKey)
        .reduce((sum, e) => sum + e.amount, 0);
      const driverSalaryExpense = driverSalaryForEquipment(equipmentId, monthKey);
      const expense = manualExpense + driverSalaryExpense;
      return { profit: income - expense, expense };
    }

    const equipmentAnnualExpense = new Map(state.equipment.map((e) => [e.id, 0]));
    const monthlyProfitTrend: { month: string; profit: number }[] = [];
    let totalAnnualProfit = 0;
    let totalAnnualExpense = 0;

    for (let m = 0; m < 12; m++) {
      const monthKey = `${year}-${String(m + 1).padStart(2, "0")}`;
      let monthProfit = 0;
      for (const eq of state.equipment) {
        const { profit, expense } = equipmentMonthTotals(eq.id, monthKey);
        monthProfit += profit;
        totalAnnualExpense += expense;
        equipmentAnnualExpense.set(eq.id, (equipmentAnnualExpense.get(eq.id) ?? 0) + expense);
      }
      monthlyProfitTrend.push({ month: MONTH_NAMES_AR[m], profit: monthProfit });
      totalAnnualProfit += monthProfit;
    }

    const equipmentExpenses = state.equipment.map((eq) => ({
      name: eq.name,
      annualExpense: equipmentAnnualExpense.get(eq.id) ?? 0,
    }));

    const totalReceivables = state.contractors.reduce((sum, c) => {
      const totalWork =
        c.opening_balance +
        state.daily_logs
          .filter((l) => l.role === "contractor" && l.person_name === c.name)
          .reduce((s, l) => s + computeDayValue(l), 0);
      const totalPaid = state.contractor_payments
        .filter((p) => p.contractor_id === c.id)
        .reduce((s, p) => s + p.amount, 0);
      return sum + (totalWork - totalPaid);
    }, 0);

    const partnersRemaining = state.partners.reduce((sum, p) => {
      const shares = state.equipment.flatMap((eq) =>
        eq.shares.filter((s) => s.partner_id === p.id).map((s) => ({ equipment_id: eq.id, percentage: s.percentage }))
      );
      const totalDue =
        p.opening_balance + shares.reduce((s, sh) => s + (equipmentAllTimeProfit(sh.equipment_id) * sh.percentage) / 100, 0);
      const totalPaid = state.partner_payments.filter((pp) => pp.partner_id === p.id).reduce((s, pp) => s + pp.amount, 0);
      return sum + (totalDue - totalPaid);
    }, 0);

    const suppliersRemaining = state.suppliers.reduce((sum, s) => {
      const totalPurchases = state.supplier_purchases
        .filter((p) => p.supplier_id === s.id)
        .reduce((sm, p) => sm + p.amount, 0);
      const totalPaid = state.supplier_payments.filter((p) => p.supplier_id === s.id).reduce((sm, p) => sm + p.amount, 0);
      return sum + (totalPurchases - totalPaid);
    }, 0);

    return {
      totalAnnualProfit,
      totalAnnualExpense,
      equipmentCount: state.equipment.length,
      currentMonthLabel: MONTH_NAMES_AR[currentMonthIndex],
      currentMonthProfit: monthlyProfitTrend[currentMonthIndex].profit,
      totalReceivables,
      totalPayables: partnersRemaining + suppliersRemaining,
      monthlyProfitTrend,
      equipmentExpenses,
    };
  }

  if (channel === "employees:update") {
    const employee = state.employees.find((e) => e.id === payload.id)!;
    const trimmedName = payload.name.trim();
    if (employee.name !== trimmedName) {
      for (const log of state.daily_logs) {
        if (log.role === "driver" && log.person_name === employee.name) log.person_name = trimmedName;
      }
    }
    employee.name = trimmedName;
    employee.wage_type = payload.wage_type;
    employee.rate = payload.rate;
    employee.fixed_salary = !!payload.fixed_salary;
    saveState(state);
    return employee;
  }

  if (channel === "system:resetAll") {
    // بيمسح السركي والمصروفات والسلف والحوافز ودفعات المقاولين والشركاء
    // وحساب حسن بس — المعدات والشركاء والسائقين والمقاولين وأنواع المصروفات
    // بتفضل زي ما هي، مش من الداتا اللي بتتمسح.
    state.daily_logs = [];
    state.monthly_expenses = [];
    state.employee_advances = [];
    state.employee_bonuses = [];
    state.hassan_ledger = [];
    state.contractor_payments = [];
    state.partner_payments = [];
    state.supplier_purchases = [];
    state.supplier_payments = [];
    for (const acc of state.treasury_accounts) acc.current_balance = 0;
    saveState(state);
    return { ok: true };
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
