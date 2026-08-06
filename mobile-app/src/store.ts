import {
  Contractor,
  DailyLog,
  DailyLogRole,
  Driver,
  Equipment,
  ExpenseCategory,
  MonthlyExpense,
  Partner,
  PayrollEntry,
  PayrollKind,
  SalaryPayment,
} from "./types";
import {
  SEED_CONTRACTORS,
  SEED_EMPLOYEES,
  SEED_EQUIPMENT,
  SEED_EXPENSE_CATEGORIES,
  SEED_PARTNERS,
} from "./seed";

const STORAGE_KEY = "al-bunyan-mobile-v2";

interface State {
  partners: Partner[];
  equipment: Equipment[];
  employees: Driver[];
  contractors: Contractor[];
  expense_categories: ExpenseCategory[];
  daily_logs: DailyLog[];
  monthly_expenses: MonthlyExpense[];
  payroll_entries: PayrollEntry[];
  salary_payments: SalaryPayment[];
  nextId: number;
}

function buildSeedState(): State {
  let nextId = 1;
  const partners: Partner[] = SEED_PARTNERS.map((name) => ({ id: nextId++, name, opening_balance: 0 }));
  const partnerIdByName = new Map(partners.map((p) => [p.name, p.id]));

  const equipment: Equipment[] = SEED_EQUIPMENT.map((eq) => ({
    id: nextId++,
    name: eq.name,
    purchase_price: 0,
    shares: eq.shares.map(([partnerName, percentage]) => ({
      partner_id: partnerIdByName.get(partnerName)!,
      percentage,
    })),
  }));

  const employees: Driver[] = SEED_EMPLOYEES.map(([name, wage_type, rate, fixed_salary]) => ({
    id: nextId++,
    name,
    wage_type,
    rate,
    fixed_salary,
  }));

  const contractors: Contractor[] = SEED_CONTRACTORS.map((name) => ({ id: nextId++, name, opening_balance: 0 }));

  const expense_categories: ExpenseCategory[] = SEED_EXPENSE_CATEGORIES.map((name) => ({
    id: nextId++,
    name,
    counts_as_commission: false,
  }));

  return {
    partners,
    equipment,
    employees,
    contractors,
    expense_categories,
    daily_logs: [],
    monthly_expenses: [],
    payroll_entries: [],
    salary_payments: [],
    nextId,
  };
}

let state: State = loadState();

function loadState(): State {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    const seeded = buildSeedState();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
    return seeded;
  }
  return JSON.parse(raw);
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

// --- Partners ---
export function listPartners(): Partner[] {
  return [...state.partners];
}
export function addPartner(name: string, opening_balance: number): Partner {
  const partner: Partner = { id: state.nextId++, name, opening_balance, addedOnMobile: true };
  state.partners.push(partner);
  save();
  return partner;
}

// --- Contractors ---
export function listContractors(): Contractor[] {
  return [...state.contractors];
}
export function addContractor(name: string, opening_balance: number): Contractor {
  const contractor: Contractor = { id: state.nextId++, name, opening_balance, addedOnMobile: true };
  state.contractors.push(contractor);
  save();
  return contractor;
}

// --- Employees (drivers) ---
export function listEmployees(): Driver[] {
  return [...state.employees];
}
export function addEmployee(name: string, wage_type: Driver["wage_type"], rate: number, fixed_salary: boolean): Driver {
  const employee: Driver = { id: state.nextId++, name, wage_type, rate, fixed_salary, addedOnMobile: true };
  state.employees.push(employee);
  save();
  return employee;
}

// --- Expense categories ---
export function listExpenseCategories(): ExpenseCategory[] {
  return [...state.expense_categories];
}
export function addExpenseCategory(name: string, counts_as_commission: boolean): ExpenseCategory {
  const category: ExpenseCategory = { id: state.nextId++, name, counts_as_commission, addedOnMobile: true };
  state.expense_categories.push(category);
  save();
  return category;
}

// --- Equipment ---
export function listEquipment(): Equipment[] {
  return [...state.equipment];
}
export function addEquipment(name: string, purchase_price: number, shares: { partner_id: number; percentage: number }[]): Equipment {
  const equipment: Equipment = { id: state.nextId++, name, purchase_price, shares, addedOnMobile: true };
  state.equipment.push(equipment);
  save();
  return equipment;
}

// --- Daily logs (السركي / المقاول / سركي سوق) ---
const OTHER_HOURS_ROLE: Partial<Record<DailyLogRole, DailyLogRole>> = {
  driver: "contractor",
  contractor: "driver",
};

export function listDailyLogs(equipment_id: number, month: string, role: DailyLogRole): DailyLog[] {
  return state.daily_logs
    .filter((l) => l.equipment_id === equipment_id && l.role === role && l.date.startsWith(month))
    .sort((a, b) => a.date.localeCompare(b.date));
}

// السركي والمقاول نفس اليوم ونفس الساعات فعليًا — أي تعديل على الساعات في
// شيت بينسخ نفسه على شيت التاني، من غير ما يلمس اسم الشخص ولا سعره —
// إلا لو اليوم اتعلّم "مشتغلش"، ساعتها بيتمسح الاسم والسعر من الشيتين خالص.
function syncHoursToOtherRole(log: DailyLog) {
  const otherRole = OTHER_HOURS_ROLE[log.role];
  if (!otherRole) return;
  const existing = state.daily_logs.find(
    (l) => l.equipment_id === log.equipment_id && l.date === log.date && l.role === otherRole
  );
  if (existing) {
    existing.actual_hours = log.actual_hours;
    existing.base_hours = log.base_hours;
    existing.note = log.note;
    existing.is_day_off = log.is_day_off;
    if (log.is_day_off) {
      existing.person_name = "";
      existing.day_rate = null;
    }
  } else {
    state.daily_logs.push({
      id: state.nextId++,
      equipment_id: log.equipment_id,
      date: log.date,
      role: otherRole,
      person_name: "",
      actual_hours: log.actual_hours,
      base_hours: log.base_hours,
      day_rate: null,
      is_paid_leave: false,
      is_day_off: log.is_day_off,
      fixed_value: null,
      hassan_commission: null,
      note: log.note,
    });
  }
}

export function upsertDailyLog(log: Omit<DailyLog, "id">): DailyLog {
  const existing = state.daily_logs.find(
    (l) => l.equipment_id === log.equipment_id && l.date === log.date && l.role === log.role
  );
  let record: DailyLog;
  if (existing) {
    Object.assign(existing, log);
    record = existing;
  } else {
    record = { id: state.nextId++, ...log };
    state.daily_logs.push(record);
  }
  syncHoursToOtherRole(record);
  save();
  return record;
}

export function deleteDailyLog(id: number) {
  const log = state.daily_logs.find((l) => l.id === id);
  state.daily_logs = state.daily_logs.filter((l) => l.id !== id);
  if (log) {
    const otherRole = OTHER_HOURS_ROLE[log.role];
    if (otherRole) {
      state.daily_logs = state.daily_logs.filter(
        (l) => !(l.equipment_id === log.equipment_id && l.date === log.date && l.role === otherRole)
      );
    }
  }
  save();
}

// --- Monthly expenses ---
export function listMonthlyExpenses(equipment_id: number, month: string): MonthlyExpense[] {
  return state.monthly_expenses
    .filter((e) => e.equipment_id === equipment_id && e.month === month)
    .sort((a, b) => (a.date ?? "").localeCompare(b.date ?? "") || a.id - b.id);
}
export function addMonthlyExpense(expense: Omit<MonthlyExpense, "id">): MonthlyExpense {
  const record: MonthlyExpense = { id: state.nextId++, ...expense };
  state.monthly_expenses.push(record);
  save();
  return record;
}
export function deleteMonthlyExpense(id: number) {
  state.monthly_expenses = state.monthly_expenses.filter((e) => e.id !== id);
  save();
}

// --- Payroll (سلفة / حافز / خصم) ---
export function listPayrollEntries(employee_id: number, month: string, kind?: PayrollKind): PayrollEntry[] {
  return state.payroll_entries
    .filter((e) => e.employee_id === employee_id && e.month === month && (!kind || e.kind === kind))
    .sort((a, b) => b.date.localeCompare(a.date));
}
export function addPayrollEntry(entry: Omit<PayrollEntry, "id">): PayrollEntry {
  const record: PayrollEntry = { id: state.nextId++, ...entry };
  state.payroll_entries.push(record);
  save();
  return record;
}
export function deletePayrollEntry(id: number) {
  state.payroll_entries = state.payroll_entries.filter((e) => e.id !== id);
  save();
}

// --- دفع المرتب (تسوية فعلية، منفصلة عن السلف/الحافز/الخصم) ---
export function listSalaryPayments(employee_id: number, month: string): SalaryPayment[] {
  return state.salary_payments
    .filter((p) => p.employee_id === employee_id && p.month === month)
    .sort((a, b) => b.date.localeCompare(a.date));
}
export function addSalaryPayment(payment: Omit<SalaryPayment, "id">): SalaryPayment {
  const record: SalaryPayment = { id: state.nextId++, ...payment };
  state.salary_payments.push(record);
  save();
  return record;
}
export function deleteSalaryPayment(id: number) {
  state.salary_payments = state.salary_payments.filter((p) => p.id !== id);
  save();
}

// --- Export bookkeeping: كل حاجة اتصدّرت قبل كده بتتعلّم عشان التصدير
// الجاي يجيب بس الجديد، مش يكرر كل حاجة تاني.
export function markAllExported() {
  // النسخة الأولى بسيطة: التصدير دايمًا بياخد كل الداتا الموجودة، والمستخدم
  // هو اللي بيقرر يستوردها تاني ولا لأ. ملحوظة للمرحلة الجاية لو احتجنا
  // نتبع بس "الجديد من آخر تصدير".
}

export function getState(): Readonly<State> {
  return state;
}
