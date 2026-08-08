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
import { deleteFromCloud, pushToCloud, startCloudSync } from "./sync";

const STORAGE_KEY = "al-bunyan-mobile-v2";
const SEEN_REMOTE_KEYS_KEY = "al-bunyan-seen-remote-keys";

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
let seenRemoteKeys: Set<string> = loadSeenRemoteKeys();

function loadState(): State {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    const seeded = buildSeedState();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
    return seeded;
  }
  return JSON.parse(raw);
}

function loadSeenRemoteKeys(): Set<string> {
  const raw = localStorage.getItem(SEEN_REMOTE_KEYS_KEY);
  return new Set(raw ? (JSON.parse(raw) as string[]) : []);
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function saveSeenRemoteKeys() {
  localStorage.setItem(SEEN_REMOTE_KEYS_KEY, JSON.stringify([...seenRemoteKeys]));
}

// --- إشعار الواجهة لما تعديل يوصل من جهاز تاني (المستخدم نفسه مش محتاج
// إشعار على تعديلاته هو، الشاشة بتاعته بتتحدّث لوحدها زي ما هي دلوقتي). ---
type Listener = () => void;
const remoteChangeListeners = new Set<Listener>();
export function subscribeRemoteChanges(fn: Listener): () => void {
  remoteChangeListeners.add(fn);
  return () => remoteChangeListeners.delete(fn);
}
function notifyRemoteChange() {
  remoteChangeListeners.forEach((fn) => fn());
}

function equipmentName(id: number): string {
  return state.equipment.find((e) => e.id === id)?.name ?? "";
}
function employeeName(id: number): string {
  return state.employees.find((e) => e.id === id)?.name ?? "";
}
function categoryName(id: number | null): string {
  if (id == null) return "";
  return state.expense_categories.find((c) => c.id === id)?.name ?? "";
}
function partnerName(id: number): string {
  return state.partners.find((p) => p.id === id)?.name ?? "";
}

// --- Partners ---
export function listPartners(): Partner[] {
  return [...state.partners];
}
export function addPartner(name: string, opening_balance: number): Partner {
  const partner: Partner = { id: state.nextId++, name, opening_balance, addedOnMobile: true };
  state.partners.push(partner);
  save();
  pushToCloud("partners", partner.id, { name: partner.name });
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
  pushToCloud("contractors", contractor.id, { name: contractor.name });
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
  pushToCloud("employees", employee.id, { name: employee.name, wage_type, rate, fixed_salary });
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
  pushToCloud("expense_categories", category.id, { name: category.name, counts_as_commission });
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
  pushToCloud("equipment", equipment.id, {
    name: equipment.name,
    purchase_price,
    shares: shares.map((s) => ({ partner_name: partnerName(s.partner_id), percentage: s.percentage })),
  });
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

function pushDailyLogToCloud(log: DailyLog) {
  pushToCloud("daily_logs", log.id, {
    equipment_name: equipmentName(log.equipment_id),
    date: log.date,
    role: log.role,
    person_name: log.person_name,
    actual_hours: log.actual_hours,
    base_hours: log.base_hours,
    day_rate: log.day_rate,
    is_day_off: log.is_day_off,
    fixed_value: log.fixed_value,
    hassan_commission: log.hassan_commission,
    note: log.note,
  });
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
  pushDailyLogToCloud(record);
  const otherRole = OTHER_HOURS_ROLE[record.role];
  if (otherRole) {
    const counterpart = state.daily_logs.find(
      (l) => l.equipment_id === record.equipment_id && l.date === record.date && l.role === otherRole
    );
    if (counterpart) pushDailyLogToCloud(counterpart);
  }
  return record;
}

export function deleteDailyLog(id: number) {
  const log = state.daily_logs.find((l) => l.id === id);
  state.daily_logs = state.daily_logs.filter((l) => l.id !== id);
  if (log) {
    deleteFromCloud("daily_logs", id);
    const otherRole = OTHER_HOURS_ROLE[log.role];
    if (otherRole) {
      const counterpart = state.daily_logs.find(
        (l) => l.equipment_id === log.equipment_id && l.date === log.date && l.role === otherRole
      );
      state.daily_logs = state.daily_logs.filter(
        (l) => !(l.equipment_id === log.equipment_id && l.date === log.date && l.role === otherRole)
      );
      if (counterpart) deleteFromCloud("daily_logs", counterpart.id);
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
  pushToCloud("monthly_expenses", record.id, {
    equipment_name: equipmentName(record.equipment_id),
    month: record.month,
    date: record.date,
    category_name: categoryName(record.category_id),
    amount: record.amount,
    payment_method: record.payment_method,
    note: record.note,
  });
  return record;
}
export function deleteMonthlyExpense(id: number) {
  state.monthly_expenses = state.monthly_expenses.filter((e) => e.id !== id);
  save();
  deleteFromCloud("monthly_expenses", id);
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
  pushToCloud("payroll_entries", record.id, {
    employee_name: employeeName(record.employee_id),
    kind: record.kind,
    month: record.month,
    date: record.date,
    amount: record.amount,
    payment_method: record.payment_method,
    reason: record.reason,
  });
  return record;
}
export function deletePayrollEntry(id: number) {
  state.payroll_entries = state.payroll_entries.filter((e) => e.id !== id);
  save();
  deleteFromCloud("payroll_entries", id);
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
  pushToCloud("salary_payments", record.id, {
    employee_name: employeeName(record.employee_id),
    month: record.month,
    date: record.date,
    amount: record.amount,
    payment_method: record.payment_method,
    note: record.note,
  });
  return record;
}
export function deleteSalaryPayment(id: number) {
  state.salary_payments = state.salary_payments.filter((p) => p.id !== id);
  save();
  deleteFromCloud("salary_payments", id);
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

// --- استقبال تعديلات جايه من جهاز تاني (موبايل تاني) عن طريق السحابة ---
function findOrCreatePartnerByName(name: string): number {
  const trimmed = name.trim();
  let p = state.partners.find((x) => x.name === trimmed);
  if (!p) {
    p = { id: state.nextId++, name: trimmed, opening_balance: 0 };
    state.partners.push(p);
  }
  return p.id;
}
function findOrCreateEquipmentByName(name: string): number {
  const trimmed = name.trim();
  let e = state.equipment.find((x) => x.name === trimmed);
  if (!e) {
    e = { id: state.nextId++, name: trimmed, purchase_price: 0, shares: [] };
    state.equipment.push(e);
  }
  return e.id;
}
function findOrCreateCategoryByName(name: string): number | null {
  const trimmed = name.trim();
  if (!trimmed) return null;
  let c = state.expense_categories.find((x) => x.name === trimmed);
  if (!c) {
    c = { id: state.nextId++, name: trimmed, counts_as_commission: false };
    state.expense_categories.push(c);
  }
  return c.id;
}
function findOrCreateEmployeeByName(name: string): number | null {
  const trimmed = name.trim();
  if (!trimmed) return null;
  const e = state.employees.find((x) => x.name === trimmed);
  return e?.id ?? null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mergeRemoteRecord(collectionName: string, docId: string, data: any) {
  switch (collectionName) {
    case "partners": {
      const name = (data.name ?? "").trim();
      if (name && !state.partners.find((p) => p.name === name)) {
        state.partners.push({ id: state.nextId++, name, opening_balance: 0 });
      }
      break;
    }
    case "contractors": {
      const name = (data.name ?? "").trim();
      if (name && !state.contractors.find((c) => c.name === name)) {
        state.contractors.push({ id: state.nextId++, name, opening_balance: 0 });
      }
      break;
    }
    case "employees": {
      const name = (data.name ?? "").trim();
      if (name && !state.employees.find((e) => e.name === name)) {
        state.employees.push({
          id: state.nextId++,
          name,
          wage_type: data.wage_type === "monthly" ? "monthly" : "daily",
          rate: Number(data.rate) || 0,
          fixed_salary: Boolean(data.fixed_salary),
        });
      }
      break;
    }
    case "expense_categories": {
      const name = (data.name ?? "").trim();
      if (name && !state.expense_categories.find((c) => c.name === name)) {
        state.expense_categories.push({ id: state.nextId++, name, counts_as_commission: Boolean(data.counts_as_commission) });
      }
      break;
    }
    case "equipment": {
      const name = (data.name ?? "").trim();
      if (name && !state.equipment.find((e) => e.name === name)) {
        const shares = Array.isArray(data.shares)
          ? data.shares.map((s: { partner_name?: string; percentage?: number }) => ({
              partner_id: findOrCreatePartnerByName(s.partner_name ?? ""),
              percentage: Number(s.percentage) || 0,
            }))
          : [];
        state.equipment.push({ id: state.nextId++, name, purchase_price: Number(data.purchase_price) || 0, shares });
      }
      break;
    }
    case "daily_logs": {
      const equipmentName = (data.equipment_name ?? "").trim();
      if (!equipmentName || !data.date || !data.role) break;
      const equipmentId = findOrCreateEquipmentByName(equipmentName);
      const existing = state.daily_logs.find(
        (l) => l.equipment_id === equipmentId && l.date === data.date && l.role === data.role
      );
      const patch: Omit<DailyLog, "id"> = {
        equipment_id: equipmentId,
        date: data.date,
        role: data.role,
        person_name: data.person_name ?? "",
        actual_hours: data.actual_hours ?? null,
        base_hours: data.base_hours ?? null,
        day_rate: data.day_rate ?? null,
        is_paid_leave: false,
        is_day_off: Boolean(data.is_day_off),
        fixed_value: data.fixed_value ?? null,
        hassan_commission: data.hassan_commission ?? null,
        note: data.note ?? null,
      };
      if (existing) Object.assign(existing, patch);
      else state.daily_logs.push({ id: state.nextId++, ...patch });
      break;
    }
    case "monthly_expenses": {
      if (seenRemoteKeys.has(docId)) break;
      seenRemoteKeys.add(docId);
      saveSeenRemoteKeys();
      const equipmentName = (data.equipment_name ?? "").trim();
      if (!equipmentName || !data.month) break;
      state.monthly_expenses.push({
        id: state.nextId++,
        equipment_id: findOrCreateEquipmentByName(equipmentName),
        month: data.month,
        date: data.date ?? null,
        category_id: findOrCreateCategoryByName(data.category_name ?? ""),
        amount: Number(data.amount) || 0,
        payment_method: data.payment_method ?? null,
        note: data.note ?? null,
      });
      break;
    }
    case "payroll_entries": {
      if (seenRemoteKeys.has(docId)) break;
      seenRemoteKeys.add(docId);
      saveSeenRemoteKeys();
      const employeeId = findOrCreateEmployeeByName(data.employee_name ?? "");
      if (!employeeId || !data.month || !data.kind) break;
      state.payroll_entries.push({
        id: state.nextId++,
        employee_id: employeeId,
        kind: data.kind,
        month: data.month,
        date: data.date,
        amount: Number(data.amount) || 0,
        payment_method: data.payment_method ?? null,
        reason: data.reason ?? null,
      });
      break;
    }
    case "salary_payments": {
      if (seenRemoteKeys.has(docId)) break;
      seenRemoteKeys.add(docId);
      saveSeenRemoteKeys();
      const employeeId = findOrCreateEmployeeByName(data.employee_name ?? "");
      if (!employeeId || !data.month) break;
      state.salary_payments.push({
        id: state.nextId++,
        employee_id: employeeId,
        month: data.month,
        date: data.date,
        amount: Number(data.amount) || 0,
        payment_method: data.payment_method ?? "cash",
        note: data.note ?? null,
      });
      break;
    }
    default:
      return;
  }
  save();
  notifyRemoteChange();
}

let cloudSyncStarted = false;
export function initCloudSync() {
  if (cloudSyncStarted) return;
  cloudSyncStarted = true;
  startCloudSync((collectionName, docId, data) => mergeRemoteRecord(collectionName, docId, data));
}

// --- ابعت كل البيانات الموجودة دلوقتي للسحابة (لداتا اتسجلت قبل ما
// المزامنة تتفعّل، أو لو حبيت تتأكد إن كل حاجة اتبعتت). ---
export function pushAllToCloud() {
  for (const p of state.partners) pushToCloud("partners", p.id, { name: p.name });
  for (const c of state.contractors) pushToCloud("contractors", c.id, { name: c.name });
  for (const e of state.employees)
    pushToCloud("employees", e.id, { name: e.name, wage_type: e.wage_type, rate: e.rate, fixed_salary: e.fixed_salary });
  for (const c of state.expense_categories)
    pushToCloud("expense_categories", c.id, { name: c.name, counts_as_commission: c.counts_as_commission });
  for (const eq of state.equipment)
    pushToCloud("equipment", eq.id, {
      name: eq.name,
      purchase_price: eq.purchase_price,
      shares: eq.shares.map((s) => ({ partner_name: partnerName(s.partner_id), percentage: s.percentage })),
    });
  for (const log of state.daily_logs) pushDailyLogToCloud(log);
  for (const exp of state.monthly_expenses)
    pushToCloud("monthly_expenses", exp.id, {
      equipment_name: equipmentName(exp.equipment_id),
      month: exp.month,
      date: exp.date,
      category_name: categoryName(exp.category_id),
      amount: exp.amount,
      payment_method: exp.payment_method,
      note: exp.note,
    });
  for (const entry of state.payroll_entries)
    pushToCloud("payroll_entries", entry.id, {
      employee_name: employeeName(entry.employee_id),
      kind: entry.kind,
      month: entry.month,
      date: entry.date,
      amount: entry.amount,
      payment_method: entry.payment_method,
      reason: entry.reason,
    });
  for (const payment of state.salary_payments)
    pushToCloud("salary_payments", payment.id, {
      employee_name: employeeName(payment.employee_id),
      month: payment.month,
      date: payment.date,
      amount: payment.amount,
      payment_method: payment.payment_method,
      note: payment.note,
    });
}
