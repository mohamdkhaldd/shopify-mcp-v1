export interface Partner {
  id: number;
  name: string;
  opening_balance: number;
}

export type WageType = "daily" | "monthly";

export interface Driver {
  id: number;
  name: string;
  wage_type: WageType;
  rate: number;
  fixed_salary: boolean;
}

export interface EquipmentPartnerShare {
  partner_id: number;
  percentage: number;
}

export interface Equipment {
  id: number;
  name: string;
  shares: EquipmentPartnerShare[];
}

export interface Contractor {
  id: number;
  name: string;
  opening_balance: number;
}

export interface ExpenseCategory {
  id: number;
  name: string;
}

export type DailyLogRole = "driver" | "contractor" | "market";

export interface DailyLog {
  id: number;
  equipment_id: number;
  date: string;
  role: DailyLogRole;
  person_name: string;
  actual_hours: number | null;
  base_hours: number | null;
  day_rate: number | null;
  is_paid_leave: boolean;
  fixed_value: number | null;
  hassan_commission: number | null;
  day_value: number;
}

export interface MonthlyExpense {
  id: number;
  equipment_id: number;
  month: string;
  date: string | null;
  category_id: number | null;
  category_name: string | null;
  amount: number;
  payment_method: string | null;
}

export interface PartnerDistributionRow {
  partner_id: number;
  partner_name: string;
  percentage: number;
  amount: number;
}

export interface EquipmentSummary {
  driverIncome: number;
  marketIncome: number;
  income: number;
  driverSalaryExpense: number;
  manualExpenseTotal: number;
  expenseTotal: number;
  netProfit: number;
  distribution: PartnerDistributionRow[];
}

export type PaymentMethod = "wallet" | "instapay" | "cash";

export interface EmployeeAdvance {
  id: number;
  employee_id: number;
  date: string;
  amount: number;
  payment_method: PaymentMethod;
  note: string | null;
}

export interface EmployeeBonus {
  id: number;
  employee_id: number;
  date: string;
  amount: number;
  payment_method: PaymentMethod;
  note: string | null;
}

export interface PayrollRow {
  id: number;
  name: string;
  wage_type: WageType;
  rate: number;
  fixed_salary: boolean;
  days_worked: number | null;
  gross_pay: number;
  advances_total: number;
  bonuses_total: number;
  net_pay: number;
}

export interface PayrollDayEntry {
  date: string;
  equipment_name: string;
  actual_hours: number | null;
  base_hours: number | null;
  day_rate: number | null;
  day_value: number;
}

export interface PayrollDetail {
  employee: Driver;
  days: PayrollDayEntry[];
  advances: EmployeeAdvance[];
  bonuses: EmployeeBonus[];
  grossPay: number;
  advancesTotal: number;
  bonusesTotal: number;
  netPay: number;
}

export interface HassanCommissionRow {
  equipment_id: number;
  equipment_name: string;
  date: string;
  source: "paired" | "market";
  commission: number;
}

export interface HassanCommissionSummary {
  rows: HassanCommissionRow[];
  total: number;
}

export type HassanLedgerType = "loan" | "repayment" | "due" | "collection";

export interface HassanLedgerEntry {
  id: number;
  date: string;
  type: HassanLedgerType;
  amount: number;
  party_name: string | null;
  description: string | null;
  note: string | null;
}

export interface HassanBalance {
  netDebt: number;
  netDue: number;
}

export interface HassanPartyBalance {
  party_name: string;
  netDebt: number;
  netDue: number;
}

export interface ContractorPayment {
  id: number;
  contractor_id: number;
  date: string;
  amount: number;
  method: string;
  note: string | null;
}

export interface ContractorSummary {
  id: number;
  name: string;
  opening_balance: number;
  totalWork: number;
  totalPaid: number;
  remaining: number;
}

export interface ContractorWorkByEquipment {
  equipment_name: string;
  days: number;
  totalValue: number;
}

export interface ContractorDetail {
  contractor: Contractor;
  workByEquipment: ContractorWorkByEquipment[];
  payments: ContractorPayment[];
  totalWork: number;
  totalPaid: number;
  remaining: number;
}

export interface PartnerPayment {
  id: number;
  partner_id: number;
  date: string;
  amount: number;
  method: string;
  note: string | null;
}

export interface PartnerSummary {
  id: number;
  name: string;
  opening_balance: number;
  totalDue: number;
  totalPaid: number;
  remaining: number;
}

export interface PartnerEquipmentBreakdown {
  equipment_name: string;
  percentage: number;
  monthAmount: number;
}

export interface PartnerDetail {
  partner: Partner;
  monthDue: number;
  equipmentBreakdown: PartnerEquipmentBreakdown[];
  totalDue: number;
  totalPaid: number;
  remaining: number;
  payments: PartnerPayment[];
}

export type TreasuryAccountName = "wallet" | "instapay" | "cash";

export interface TreasuryAccount {
  id: number;
  name: TreasuryAccountName;
  name_ar: string;
  current_balance: number;
}

export interface TreasurySummaryRow {
  id: number;
  name: TreasuryAccountName;
  name_ar: string;
  currentBalance: number;
  monthIncoming: number;
  monthOutgoing: number;
  netMovement: number;
  projectedBalance: number;
}

export interface SupplierPurchase {
  id: number;
  supplier_id: number;
  date: string;
  description: string | null;
  amount: number;
  note: string | null;
  supplier_name?: string;
}

export interface SupplierPayment {
  id: number;
  supplier_id: number;
  date: string;
  amount: number;
  method: string;
  note: string | null;
  supplier_name?: string;
}

export interface SupplierDashboardRow {
  id: number;
  name: string;
  purchaseCount: number;
  totalPurchases: number;
  totalPaid: number;
  remaining: number;
  purchases: SupplierPurchase[];
  payments: SupplierPayment[];
}

export interface ReportEquipmentRow {
  equipment_name: string;
  income: number;
  expense: number;
  netProfit: number;
}

export interface MonthlyReport {
  month: string;
  equipmentRows: ReportEquipmentRow[];
  totalIncome: number;
  totalExpense: number;
  netProfit: number;
  payrollTotal: number;
  hassanCommissionTotal: number;
  treasuryBalances: { name: TreasuryAccountName; name_ar: string; balance: number }[];
}
