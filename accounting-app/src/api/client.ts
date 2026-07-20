import { mockInvoke } from "./mockDb";
import { Contractor, Driver, Equipment, ExpenseCategory, Partner } from "./types";

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
};
