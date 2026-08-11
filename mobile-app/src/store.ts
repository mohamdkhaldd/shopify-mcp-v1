import {
  Contractor,
  ContractorPayment,
  DailyLog,
  DailyLogRole,
  Driver,
  Equipment,
  ExpenseCategory,
  HassanLedgerEntry,
  HassanLedgerType,
  HassanTreasuryExpense,
  MonthlyExpense,
  Partner,
  PartnerPayment,
  PayrollEntry,
  PayrollKind,
  SalaryPayment,
  Supplier,
  SupplierPayment,
  SupplierPurchase,
  TreasuryAccount,
  TreasuryAccountName,
  WasteEntry,
} from "./types";
import {
  SEED_CONTRACTORS,
  SEED_EMPLOYEES,
  SEED_EQUIPMENT,
  SEED_EXPENSE_CATEGORIES,
  SEED_PARTNERS,
} from "./seed";
import { deleteFromCloud, pushToCloud, startCloudSync } from "./sync";
import { computeDayValue, partnerAllTimeSummary, PartnerAllTimeSummary } from "./utils/profit";

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
  hassan_ledger: HassanLedgerEntry[];
  hassan_treasury_expenses: HassanTreasuryExpense[];
  waste_entries: WasteEntry[];
  suppliers: Supplier[];
  supplier_purchases: SupplierPurchase[];
  supplier_payments: SupplierPayment[];
  contractor_payments: ContractorPayment[];
  partner_payments: PartnerPayment[];
  treasury_accounts: TreasuryAccount[];
  nextId: number;
}

const TREASURY_ACCOUNT_NAMES: TreasuryAccountName[] = ["cash", "wallet", "instapay", "vodafone_cash"];

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
    hassan_ledger: [],
    hassan_treasury_expenses: [],
    waste_entries: [],
    suppliers: [],
    supplier_purchases: [],
    supplier_payments: [],
    contractor_payments: [],
    partner_payments: [],
    treasury_accounts: TREASURY_ACCOUNT_NAMES.map((name) => ({ name, balance: 0 })),
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
  const parsed = JSON.parse(raw);
  // نسخ أقدم من التخزين معندهاش الحقول دي — نضيفها فاضية عشان الكود الجديد
  // ميكسرش لو لقاها undefined.
  parsed.hassan_ledger ??= [];
  parsed.hassan_treasury_expenses ??= [];
  parsed.waste_entries ??= [];
  parsed.suppliers ??= [];
  parsed.supplier_purchases ??= [];
  parsed.supplier_payments ??= [];
  parsed.contractor_payments ??= [];
  parsed.partner_payments ??= [];
  parsed.treasury_accounts ??= TREASURY_ACCOUNT_NAMES.map((name) => ({ name, balance: 0 }));
  return parsed;
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
function contractorName(id: number): string {
  return state.contractors.find((c) => c.id === id)?.name ?? "";
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
    const eqName = equipmentName(log.equipment_id);
    deleteFromCloud("daily_logs", id, { equipment_name: eqName, date: log.date, role: log.role });
    const otherRole = OTHER_HOURS_ROLE[log.role];
    if (otherRole) {
      const counterpart = state.daily_logs.find(
        (l) => l.equipment_id === log.equipment_id && l.date === log.date && l.role === otherRole
      );
      state.daily_logs = state.daily_logs.filter(
        (l) => !(l.equipment_id === log.equipment_id && l.date === log.date && l.role === otherRole)
      );
      if (counterpart) deleteFromCloud("daily_logs", counterpart.id, { equipment_name: eqName, date: log.date, role: otherRole });
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

// --- خزنة حسن (شخصية) ---
export function listHassanLedger(month: string): HassanLedgerEntry[] {
  return state.hassan_ledger.filter((e) => e.date.startsWith(month)).sort((a, b) => b.date.localeCompare(a.date));
}
export function addHassanLedgerEntry(entry: Omit<HassanLedgerEntry, "id">): HassanLedgerEntry {
  const record: HassanLedgerEntry = { id: state.nextId++, ...entry };
  state.hassan_ledger.push(record);
  save();
  pushToCloud("hassan_ledger", record.id, { ...record });
  return record;
}
export function deleteHassanLedgerEntry(id: number) {
  state.hassan_ledger = state.hassan_ledger.filter((e) => e.id !== id);
  save();
  deleteFromCloud("hassan_ledger", id);
}

export function listHassanTreasuryExpenses(month: string): HassanTreasuryExpense[] {
  return state.hassan_treasury_expenses.filter((e) => e.date.startsWith(month)).sort((a, b) => b.date.localeCompare(a.date));
}
export function addHassanTreasuryExpense(expense: Omit<HassanTreasuryExpense, "id">): HassanTreasuryExpense {
  const record: HassanTreasuryExpense = { id: state.nextId++, ...expense };
  state.hassan_treasury_expenses.push(record);
  save();
  pushToCloud("hassan_treasury_expenses", record.id, { ...record });
  return record;
}
export function deleteHassanTreasuryExpense(id: number) {
  state.hassan_treasury_expenses = state.hassan_treasury_expenses.filter((e) => e.id !== id);
  save();
  deleteFromCloud("hassan_treasury_expenses", id);
}

// --- الهالك ---
export function listWasteEntries(month: string): WasteEntry[] {
  return state.waste_entries.filter((e) => e.date.startsWith(month)).sort((a, b) => b.date.localeCompare(a.date));
}
export function addWasteEntry(entry: Omit<WasteEntry, "id">): WasteEntry {
  const record: WasteEntry = { id: state.nextId++, ...entry };
  state.waste_entries.push(record);
  save();
  pushToCloud("waste_entries", record.id, { ...record });
  return record;
}
export function deleteWasteEntry(id: number) {
  state.waste_entries = state.waste_entries.filter((e) => e.id !== id);
  save();
  deleteFromCloud("waste_entries", id);
}

// --- الموردين ---
export function listSuppliers(): Supplier[] {
  return [...state.suppliers];
}
function findOrCreateSupplierByName(name: string): Supplier {
  const trimmed = name.trim();
  let s = state.suppliers.find((x) => x.name === trimmed);
  if (!s) {
    s = { id: state.nextId++, name: trimmed };
    state.suppliers.push(s);
  }
  return s;
}
function supplierName(id: number): string {
  return state.suppliers.find((s) => s.id === id)?.name ?? "";
}
export function listSupplierPurchases(supplier_id: number): SupplierPurchase[] {
  return state.supplier_purchases.filter((p) => p.supplier_id === supplier_id).sort((a, b) => b.date.localeCompare(a.date));
}
export function listSupplierPayments(supplier_id: number): SupplierPayment[] {
  return state.supplier_payments.filter((p) => p.supplier_id === supplier_id).sort((a, b) => b.date.localeCompare(a.date));
}
export function addSupplierPurchase(supplierName: string, purchase: Omit<SupplierPurchase, "id" | "supplier_id">): SupplierPurchase {
  const supplier = findOrCreateSupplierByName(supplierName);
  const record: SupplierPurchase = { id: state.nextId++, supplier_id: supplier.id, ...purchase };
  state.supplier_purchases.push(record);
  save();
  pushToCloud("supplier_purchases", record.id, { ...record, supplier_name: supplier.name });
  return record;
}
export function addSupplierPayment(supplierNameArg: string, payment: Omit<SupplierPayment, "id" | "supplier_id">): SupplierPayment {
  const supplier = findOrCreateSupplierByName(supplierNameArg);
  const record: SupplierPayment = { id: state.nextId++, supplier_id: supplier.id, ...payment };
  state.supplier_payments.push(record);
  save();
  pushToCloud("supplier_payments", record.id, { ...record, supplier_name: supplier.name });
  return record;
}
export function deleteSupplierPurchase(id: number) {
  state.supplier_purchases = state.supplier_purchases.filter((p) => p.id !== id);
  save();
  deleteFromCloud("supplier_purchases", id);
}
export function deleteSupplierPayment(id: number) {
  state.supplier_payments = state.supplier_payments.filter((p) => p.id !== id);
  save();
  deleteFromCloud("supplier_payments", id);
}

// --- دفعات المقاولين (فلوس المقاول دفعها للشركة) ---
export function listContractorPayments(contractor_id: number): ContractorPayment[] {
  return state.contractor_payments.filter((p) => p.contractor_id === contractor_id).sort((a, b) => b.date.localeCompare(a.date));
}
export function addContractorPayment(contractor_id: number, payment: Omit<ContractorPayment, "id" | "contractor_id">): ContractorPayment {
  const record: ContractorPayment = { id: state.nextId++, contractor_id, ...payment };
  state.contractor_payments.push(record);
  save();
  pushToCloud("contractor_payments", record.id, { ...record, contractor_name: contractorName(contractor_id) });
  return record;
}
export function deleteContractorPayment(id: number) {
  state.contractor_payments = state.contractor_payments.filter((p) => p.id !== id);
  save();
  deleteFromCloud("contractor_payments", id);
}

// --- دفعات الشركاء (فلوس اتدفعت للشريك) ---
export function listPartnerPayments(partner_id: number): PartnerPayment[] {
  return state.partner_payments.filter((p) => p.partner_id === partner_id).sort((a, b) => b.date.localeCompare(a.date));
}
export function addPartnerPayment(partner_id: number, payment: Omit<PartnerPayment, "id" | "partner_id">): PartnerPayment {
  const record: PartnerPayment = { id: state.nextId++, partner_id, ...payment };
  state.partner_payments.push(record);
  save();
  pushToCloud("partner_payments", record.id, { ...record, partner_name: partnerName(partner_id) });
  return record;
}
export function deletePartnerPayment(id: number) {
  state.partner_payments = state.partner_payments.filter((p) => p.id !== id);
  save();
  deleteFromCloud("partner_payments", id);
}

// --- الخزنة: رصيد يدوي محلي لكل جهاز بس (زي اللاب بالظبط) — كل جهاز بيعكس
// الكاش/المحفظة الموجودة فعليًا وقت ما بتتفتح منه، فمش حاجة تتزامن بين
// الأجهزة، بس الحركة (الوارد/الصادر) بتتحسب من بيانات متزامنة فعلًا.
export function listTreasuryAccounts(): TreasuryAccount[] {
  return [...state.treasury_accounts];
}
export function updateTreasuryAccountBalance(name: TreasuryAccountName, balance: number) {
  const account = state.treasury_accounts.find((a) => a.name === name);
  if (account) account.balance = balance;
  save();
}

// --- ملخصات المقاولين/الشركاء — رصيد شغال على كل الوقت (زي اللاب بالظبط)،
// مش شهر واحد بس.
export interface ContractorAllTimeSummary {
  id: number;
  name: string;
  opening_balance: number;
  totalWork: number;
  totalPaid: number;
  remaining: number;
}
export function listContractorSummaries(): ContractorAllTimeSummary[] {
  return state.contractors.map((c) => {
    const totalWork =
      c.opening_balance +
      state.daily_logs
        .filter((l) => l.role === "contractor" && l.person_name === c.name)
        .reduce((sum, l) => sum + computeDayValue(l), 0);
    const totalPaid = state.contractor_payments.filter((p) => p.contractor_id === c.id).reduce((sum, p) => sum + p.amount, 0);
    return { id: c.id, name: c.name, opening_balance: c.opening_balance, totalWork, totalPaid, remaining: totalWork - totalPaid };
  });
}
export function listPartnerSummaries(): PartnerAllTimeSummary[] {
  return state.partners.map((p) => {
    const totalPaid = state.partner_payments.filter((pp) => pp.partner_id === p.id).reduce((sum, pp) => sum + pp.amount, 0);
    return partnerAllTimeSummary(p, totalPaid);
  });
}

// --- تجميعات لتقرير الصادر: زي دي بتلم كل المعدات/الموظفين مع بعض، مش
// معدة أو موظف واحد بس زي الدوال التانية فوق.
export function listAllMonthlyExpenses(month: string): (MonthlyExpense & { equipment_name: string; category_name: string })[] {
  return state.monthly_expenses
    .filter((e) => e.month === month)
    .map((e) => ({ ...e, equipment_name: equipmentName(e.equipment_id), category_name: categoryName(e.category_id) }))
    .sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));
}
export function listAllPayrollEntries(month: string): (PayrollEntry & { employee_name: string })[] {
  return state.payroll_entries
    .filter((e) => e.month === month)
    .map((e) => ({ ...e, employee_name: employeeName(e.employee_id) }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
export function listAllSalaryPayments(month: string): (SalaryPayment & { employee_name: string })[] {
  return state.salary_payments
    .filter((p) => p.month === month)
    .map((p) => ({ ...p, employee_name: employeeName(p.employee_id) }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
export function listAllSupplierPayments(month: string): (SupplierPayment & { supplier_name: string })[] {
  return state.supplier_payments
    .filter((p) => p.date.startsWith(month))
    .map((p) => ({ ...p, supplier_name: state.suppliers.find((s) => s.id === p.supplier_id)?.name ?? "" }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
export function listAllContractorPayments(month: string): (ContractorPayment & { contractor_name: string })[] {
  return state.contractor_payments
    .filter((p) => p.date.startsWith(month))
    .map((p) => ({ ...p, contractor_name: contractorName(p.contractor_id) }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
export function listAllPartnerPayments(month: string): (PartnerPayment & { partner_name: string })[] {
  return state.partner_payments
    .filter((p) => p.date.startsWith(month))
    .map((p) => ({ ...p, partner_name: partnerName(p.partner_id) }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

// صافي المديونية/المستحق لحسن — كل الوقت، مش شهر بعينه (زي اللاب بالظبط).
export function hassanLedgerBalance(): { netDebt: number; netDue: number } {
  let netDebt = 0;
  let netDue = 0;
  for (const e of state.hassan_ledger) {
    if (e.type === "loan") netDebt += e.amount;
    else if (e.type === "repayment") netDebt -= e.amount;
    else if (e.type === "due") netDue += e.amount;
    else if (e.type === "collection") netDue -= e.amount;
  }
  return { netDebt, netDue };
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
function findOrCreateContractorByName(name: string): number {
  const trimmed = name.trim();
  let c = state.contractors.find((x) => x.name === trimmed);
  if (!c) {
    c = { id: state.nextId++, name: trimmed, opening_balance: 0 };
    state.contractors.push(c);
  }
  return c.id;
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
    case "hassan_ledger": {
      if (seenRemoteKeys.has(docId)) break;
      seenRemoteKeys.add(docId);
      saveSeenRemoteKeys();
      if (!data.date || !data.type) break;
      state.hassan_ledger.push({
        id: state.nextId++,
        date: data.date,
        type: data.type,
        amount: Number(data.amount) || 0,
        party_name: data.party_name ?? null,
        description: data.description ?? null,
        note: data.note ?? null,
      });
      break;
    }
    case "hassan_treasury_expenses": {
      if (seenRemoteKeys.has(docId)) break;
      seenRemoteKeys.add(docId);
      saveSeenRemoteKeys();
      if (!data.date) break;
      state.hassan_treasury_expenses.push({
        id: state.nextId++,
        date: data.date,
        amount: Number(data.amount) || 0,
        description: data.description ?? "",
      });
      break;
    }
    case "waste_entries": {
      if (seenRemoteKeys.has(docId)) break;
      seenRemoteKeys.add(docId);
      saveSeenRemoteKeys();
      if (!data.date) break;
      state.waste_entries.push({
        id: state.nextId++,
        date: data.date,
        amount: Number(data.amount) || 0,
        payment_method: data.payment_method ?? null,
        note: data.note ?? null,
      });
      break;
    }
    case "supplier_purchases": {
      if (seenRemoteKeys.has(docId)) break;
      seenRemoteKeys.add(docId);
      saveSeenRemoteKeys();
      const supplierNameVal = (data.supplier_name ?? "").trim();
      if (!supplierNameVal || !data.date) break;
      const supplier = findOrCreateSupplierByName(supplierNameVal);
      state.supplier_purchases.push({
        id: state.nextId++,
        supplier_id: supplier.id,
        date: data.date,
        description: data.description ?? null,
        amount: Number(data.amount) || 0,
        note: data.note ?? null,
      });
      break;
    }
    case "supplier_payments": {
      if (seenRemoteKeys.has(docId)) break;
      seenRemoteKeys.add(docId);
      saveSeenRemoteKeys();
      const supplierNameVal = (data.supplier_name ?? "").trim();
      if (!supplierNameVal || !data.date) break;
      const supplier = findOrCreateSupplierByName(supplierNameVal);
      state.supplier_payments.push({
        id: state.nextId++,
        supplier_id: supplier.id,
        date: data.date,
        amount: Number(data.amount) || 0,
        method: data.method ?? null,
        note: data.note ?? null,
      });
      break;
    }
    case "contractor_payments": {
      if (seenRemoteKeys.has(docId)) break;
      seenRemoteKeys.add(docId);
      saveSeenRemoteKeys();
      const contractorNameVal = (data.contractor_name ?? "").trim();
      if (!contractorNameVal || !data.date) break;
      state.contractor_payments.push({
        id: state.nextId++,
        contractor_id: findOrCreateContractorByName(contractorNameVal),
        date: data.date,
        amount: Number(data.amount) || 0,
        method: data.method ?? null,
        note: data.note ?? null,
      });
      break;
    }
    case "partner_payments": {
      if (seenRemoteKeys.has(docId)) break;
      seenRemoteKeys.add(docId);
      saveSeenRemoteKeys();
      const partnerNameVal = (data.partner_name ?? "").trim();
      if (!partnerNameVal || !data.date) break;
      state.partner_payments.push({
        id: state.nextId++,
        partner_id: findOrCreatePartnerByName(partnerNameVal),
        date: data.date,
        amount: Number(data.amount) || 0,
        method: data.method ?? null,
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

const BOOTSTRAPPED_KEY = "al-bunyan-cloud-bootstrapped";
let cloudSyncStarted = false;
export function initCloudSync() {
  if (cloudSyncStarted) return;
  cloudSyncStarted = true;
  startCloudSync((collectionName, docId, data) => mergeRemoteRecord(collectionName, docId, data));
  // أول مرة بس: ابعت كل حاجة موجودة محليًا (زي الداتا الأساسية للمعدات
  // والسواقين) عشان اللاب والموبايلات التانية يلاقوا نفس المرجع من غير ما
  // ننتظر تعديل يدوي عليها.
  if (!localStorage.getItem(BOOTSTRAPPED_KEY)) {
    localStorage.setItem(BOOTSTRAPPED_KEY, "1");
    pushAllToCloud();
  }
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
  for (const entry of state.hassan_ledger) pushToCloud("hassan_ledger", entry.id, { ...entry });
  for (const exp of state.hassan_treasury_expenses) pushToCloud("hassan_treasury_expenses", exp.id, { ...exp });
  for (const w of state.waste_entries) pushToCloud("waste_entries", w.id, { ...w });
  for (const p of state.supplier_purchases) pushToCloud("supplier_purchases", p.id, { ...p, supplier_name: supplierName(p.supplier_id) });
  for (const p of state.supplier_payments) pushToCloud("supplier_payments", p.id, { ...p, supplier_name: supplierName(p.supplier_id) });
  for (const p of state.contractor_payments) pushToCloud("contractor_payments", p.id, { ...p, contractor_name: contractorName(p.contractor_id) });
  for (const p of state.partner_payments) pushToCloud("partner_payments", p.id, { ...p, partner_name: partnerName(p.partner_id) });
}
