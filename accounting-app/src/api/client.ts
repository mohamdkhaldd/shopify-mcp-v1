import { mockInvoke } from "./mockDb";
import {
  Contractor,
  DailyLog,
  DailyLogRole,
  Driver,
  Equipment,
  EquipmentSummary,
  ExpenseCategory,
  MonthlyExpense,
  Partner,
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
  create: (log: Omit<DailyLog, "id" | "day_value">): Promise<DailyLog> => invoke("dailyLogs:create", log),
  remove: (id: number): Promise<void> => invoke("dailyLogs:delete", { id }),
};

export const monthlyExpensesApi = {
  list: (equipment_id: number, month: string): Promise<MonthlyExpense[]> =>
    invoke("monthlyExpenses:list", { equipment_id, month }),
  create: (expense: Omit<MonthlyExpense, "id" | "category_name">): Promise<MonthlyExpense> =>
    invoke("monthlyExpenses:create", expense),
  remove: (id: number): Promise<void> => invoke("monthlyExpenses:delete", { id }),
};
