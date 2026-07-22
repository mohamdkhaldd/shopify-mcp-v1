import { mockInvoke } from "./mockDb";
import {
  Contractor,
  ContractorDetail,
  ContractorPayment,
  ContractorSummary,
  DailyLog,
  DailyLogRole,
  DashboardSummary,
  Driver,
  Equipment,
  EmployeeAdvance,
  EmployeeBonus,
  EquipmentSummary,
  ExpenseCategory,
  HassanBalance,
  HassanCommissionSummary,
  HassanEquipmentCommissionDetail,
  HassanLedgerEntry,
  HassanPartyBalance,
  MonthlyExpense,
  MonthlyReport,
  Partner,
  PartnerDetail,
  PartnerPayment,
  PartnerSummary,
  PayrollDetail,
  PayrollRow,
  SupplierDashboardRow,
  SupplierPayment,
  SupplierPurchase,
  TreasuryAccount,
  TreasurySummaryRow,
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
  create: (name: string, opening_balance = 0): Promise<Partner> =>
    invoke("partners:create", { name, opening_balance }),
  remove: (id: number): Promise<void> => invoke("partners:delete", { id }),
  updateOpeningBalance: (id: number, opening_balance: number): Promise<Partner> =>
    invoke("partners:updateOpeningBalance", { id, opening_balance }),
};

export const employeesApi = {
  list: (): Promise<Driver[]> => invoke("employees:list"),
  create: (data: Omit<Driver, "id">): Promise<Driver> => invoke("employees:create", data),
  update: (id: number, data: Omit<Driver, "id">): Promise<Driver> => invoke("employees:update", { id, ...data }),
  remove: (id: number): Promise<void> => invoke("employees:delete", { id }),
};

export const contractorsApi = {
  list: (): Promise<Contractor[]> => invoke("contractors:list"),
  create: (name: string, opening_balance = 0): Promise<Contractor> =>
    invoke("contractors:create", { name, opening_balance }),
  remove: (id: number): Promise<void> => invoke("contractors:delete", { id }),
  updateOpeningBalance: (id: number, opening_balance: number): Promise<Contractor> =>
    invoke("contractors:updateOpeningBalance", { id, opening_balance }),
};

export const expenseCategoriesApi = {
  list: (): Promise<ExpenseCategory[]> => invoke("expenseCategories:list"),
  create: (name: string): Promise<ExpenseCategory> => invoke("expenseCategories:create", { name }),
  remove: (id: number): Promise<void> => invoke("expenseCategories:delete", { id }),
};

export const equipmentApi = {
  list: (): Promise<Equipment[]> => invoke("equipment:list"),
  create: (data: {
    name: string;
    purchase_price: number;
    shares: { partner_id: number; percentage: number }[];
  }): Promise<Equipment> => invoke("equipment:create", data),
  update: (
    id: number,
    data: { purchase_price: number; shares: { partner_id: number; percentage: number }[] }
  ): Promise<Equipment> => invoke("equipment:update", { id, ...data }),
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

export const employeeBonusesApi = {
  list: (employee_id: number, month: string): Promise<EmployeeBonus[]> =>
    invoke("employeeBonuses:list", { employee_id, month }),
  create: (bonus: Omit<EmployeeBonus, "id">): Promise<EmployeeBonus> =>
    invoke("employeeBonuses:create", bonus),
  remove: (id: number): Promise<void> => invoke("employeeBonuses:delete", { id }),
};

export const payrollApi = {
  summary: (month: string): Promise<PayrollRow[]> => invoke("payroll:summary", { month }),
  detail: (employee_id: number, month: string): Promise<PayrollDetail> =>
    invoke("payroll:detail", { employee_id, month }),
};

export const systemApi = {
  resetAll: (): Promise<void> => invoke("system:resetAll"),
};

export const hassanApi = {
  commissionSummary: (month: string): Promise<HassanCommissionSummary> =>
    invoke("hassan:commissionSummary", { month }),
  equipmentCommission: (equipment_id: number, month: string): Promise<HassanEquipmentCommissionDetail> =>
    invoke("hassan:equipmentCommission", { equipment_id, month }),
  ledgerList: (month: string): Promise<HassanLedgerEntry[]> => invoke("hassanLedger:list", { month }),
  ledgerCreate: (entry: Omit<HassanLedgerEntry, "id">): Promise<HassanLedgerEntry> =>
    invoke("hassanLedger:create", entry),
  ledgerRemove: (id: number): Promise<void> => invoke("hassanLedger:delete", { id }),
  balance: (): Promise<HassanBalance> => invoke("hassanLedger:balance"),
  balanceByParty: (): Promise<HassanPartyBalance[]> => invoke("hassanLedger:balanceByParty"),
};

export const contractorPaymentsApi = {
  list: (contractor_id: number): Promise<ContractorPayment[]> =>
    invoke("contractorPayments:list", { contractor_id }),
  create: (payment: Omit<ContractorPayment, "id">): Promise<ContractorPayment> =>
    invoke("contractorPayments:create", payment),
  remove: (id: number): Promise<void> => invoke("contractorPayments:delete", { id }),
};

export const contractorsDashboardApi = {
  summary: (): Promise<ContractorSummary[]> => invoke("contractors:summary"),
  detail: (contractor_id: number): Promise<ContractorDetail> => invoke("contractors:detail", { contractor_id }),
};

export const partnerPaymentsApi = {
  list: (partner_id: number): Promise<PartnerPayment[]> => invoke("partnerPayments:list", { partner_id }),
  create: (payment: Omit<PartnerPayment, "id">): Promise<PartnerPayment> =>
    invoke("partnerPayments:create", payment),
  remove: (id: number): Promise<void> => invoke("partnerPayments:delete", { id }),
};

export const partnersDashboardApi = {
  summary: (): Promise<PartnerSummary[]> => invoke("partners:summary"),
  detail: (partner_id: number, month: string): Promise<PartnerDetail> =>
    invoke("partners:detail", { partner_id, month }),
};

export const treasuryApi = {
  list: (): Promise<TreasuryAccount[]> => invoke("treasury:list"),
  updateBalance: (id: number, current_balance: number): Promise<TreasuryAccount> =>
    invoke("treasury:updateBalance", { id, current_balance }),
  summary: (month: string): Promise<TreasurySummaryRow[]> => invoke("treasury:summary", { month }),
};

export const suppliersApi = {
  names: (): Promise<string[]> => invoke("suppliers:names"),
  dashboard: (): Promise<SupplierDashboardRow[]> => invoke("suppliers:dashboard"),
  createPurchase: (purchase: {
    supplier_name: string;
    date: string;
    description: string | null;
    amount: number;
    note: string | null;
  }): Promise<SupplierPurchase> => invoke("supplierPurchases:create", purchase),
  removePurchase: (id: number): Promise<void> => invoke("supplierPurchases:delete", { id }),
  createPayment: (payment: {
    supplier_name: string;
    date: string;
    amount: number;
    method: string;
    note: string | null;
  }): Promise<SupplierPayment> => invoke("supplierPayments:create", payment),
  removePayment: (id: number): Promise<void> => invoke("supplierPayments:delete", { id }),
};

export const reportsApi = {
  monthly: (month: string): Promise<MonthlyReport> => invoke("reports:monthly", { month }),
};

export const dashboardApi = {
  summary: (): Promise<DashboardSummary> => invoke("dashboard:summary"),
};
