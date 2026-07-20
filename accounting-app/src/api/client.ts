import { mockInvoke } from "./mockDb";
import {
  Contractor,
  DailyLog,
  DailyLogRole,
  Driver,
  Equipment,
  EmployeeAdvance,
  EquipmentSummary,
  ExpenseCategory,
  HassanBalance,
  HassanCommissionSummary,
  HassanLedgerEntry,
  MonthlyExpense,
  Partner,
  PayrollDetail,
  PayrollRow,
} from "./types";

declare global {
  interface Window {
    api?: { invoke: (channel: string, payload?: unknown) => Promise<any> };
  }
}

function invoke(channel: string, payload?: unknown): Promise<any> {
  if (window.api) return window.api.invoke(channel, payload);
  return mockInvoke(channel, payload);
}

export const partnersApi = {
  list: (): Promise<Partner[]> => invoke("partners:list"),
  create: (name: string): Promise<Partner> => invoke("partners:create", { name }),
  remove: (id: number): Promise<void> => invoke("partners:delete", { id }),
};

export const employeesApi = {
  list: (): Promise<Driver[]> => invoke("employees:list"),
  create: (data: Omit<Driver, "id">): Promise<Driver> => invoke("employees:create", data),
  remove: (id: number): Promise<void> => invoke("employees:delete", { id }),
};

export const contractorsApi = {
  list: (): Promise<Contractor[]> => invoke("contractors:list"),
  create: (name: string): Promise<Contractor> => invoke("contractors:create", { name }),
  remove: (id: number): Promise<void> => invoke("contractors:delete", { id }),
};

export const expenseCategoriesApi = {
  list: (): Promise<ExpenseCategory[]> => invoke("expenseCategories:list"),
  create: (name: string): Promise<ExpenseCategory> => invoke("expenseCategories:create", { name }),
  remove: (id: number): Promise<void> => invoke("expenseCategories:delete", { id }),
};

export const equipmentApi = {
  list: (): Promise<Equipment[]> => invoke("equipment:list"),
  create: (data: { name: string; shares: { partner_id: number; percentage: number }[] }): Promise<Equipment> =>
    invoke("equipment:create", data),
  remove: (id: number): Promise<void> => invoke("equipment:delete", { id }),
  summary: (equipment_id: number, month: string): Promise<EquipmentSummary> =>
    invoke("equipment:summary", { equipment_id, month }),
};

export const dailyLogsApi = {
  list: (equipment_id: number, month: string, role: DailyLogRole): Promise<DailyLog[]> =>
    invoke("dailyLogs:list", { equipment_id, month, role }),
  upsert: (log: Omit<DailyLog, "id" | "day_value">): Promise<DailyLog> => invoke("dailyLogs:upsert", log),
  remove: (id: number): Promise<void> => invoke("dailyLogs:delete", { id }),
};

export const monthlyExpensesApi = {
  list: (equipment_id: number, month: string): Promise<MonthlyExpense[]> =>
    invoke("monthlyExpenses:list", { equipment_id, month }),
  create: (expense: Omit<MonthlyExpense, "id" | "category_name">): Promise<MonthlyExpense> =>
    invoke("monthlyExpenses:create", expense),
  remove: (id: number): Promise<void> => invoke("monthlyExpenses:delete", { id }),
};

export const employeeAdvancesApi = {
  list: (employee_id: number, month: string): Promise<EmployeeAdvance[]> =>
    invoke("employeeAdvances:list", { employee_id, month }),
  create: (advance: Omit<EmployeeAdvance, "id">): Promise<EmployeeAdvance> =>
    invoke("employeeAdvances:create", advance),
  remove: (id: number): Promise<void> => invoke("employeeAdvances:delete", { id }),
};

export const payrollApi = {
  summary: (month: string): Promise<PayrollRow[]> => invoke("payroll:summary", { month }),
  detail: (employee_id: number, month: string): Promise<PayrollDetail> =>
    invoke("payroll:detail", { employee_id, month }),
};

export const hassanApi = {
  commissionSummary: (month: string): Promise<HassanCommissionSummary> =>
    invoke("hassan:commissionSummary", { month }),
  ledgerList: (month: string): Promise<HassanLedgerEntry[]> => invoke("hassanLedger:list", { month }),
  ledgerCreate: (entry: Omit<HassanLedgerEntry, "id">): Promise<HassanLedgerEntry> =>
    invoke("hassanLedger:create", entry),
  ledgerRemove: (id: number): Promise<void> => invoke("hassanLedger:delete", { id }),
  balance: (): Promise<HassanBalance> => invoke("hassanLedger:balance"),
};
