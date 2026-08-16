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
  purchase_price: number;
  allTimeProfit: number;
  roiPercent: number | null;
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
  counts_as_commission: boolean;
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
  is_day_off: boolean;
  fixed_value: number | null;
  hassan_commission: number | null;
  note: string | null;
  shift_label: string;
  day_value: number;
}

export interface EquipmentShift {
  id: number;
  equipment_id: number;
  label: string;
}

export interface EquipmentShiftIncome {
  shift_label: string;
  income: number;
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
  note: string | null;
  receipt_image: string | null;
}

export interface PartnerDistributionRow {
  partner_id: number;
  partner_name: string;
  percentage: number;
  amount: number;
}

export interface DriverSalaryBreakdownRow {
  name: string;
  amount: number;
}

export interface EquipmentSummary {
  driverIncome: number;
  marketIncome: number;
  income: number;
  driverSalaryExpense: number;
  driverSalaryBreakdown: DriverSalaryBreakdownRow[];
  manualExpenseTotal: number;
  expenseTotal: number;
  netProfit: number;
  distribution: PartnerDistributionRow[];
}

export type PaymentMethod = "wallet" | "instapay" | "cash" | "vodafone_cash";

export interface EmployeeAdvance {
  id: number;
  employee_id: number;
  month: string;
  date: string;
  amount: number;
  payment_method: PaymentMethod;
  note: string | null;
}

export interface EmployeeBonus {
  id: number;
  employee_id: number;
  month: string;
  date: string;
  amount: number;
  payment_method: PaymentMethod;
  note: string | null;
}

export interface EmployeeDeduction {
  id: number;
  employee_id: number;
  month: string;
  date: string;
  amount: number;
  reason: string;
}

export interface SalaryPayment {
  id: number;
  employee_id: number;
  month: string;
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
  deductions_total: number;
  net_pay: number;
  paid_total: number;
  taken_total: number;
  remaining: number;
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
  deductions: EmployeeDeduction[];
  payments: SalaryPayment[];
  grossPay: number;
  advancesTotal: number;
  bonusesTotal: number;
  deductionsTotal: number;
  paidTotal: number;
  takenTotal: number;
  netPay: number;
  remaining: number;
}

export interface HassanCommissionRow {
  equipment_id: number;
  equipment_name: string;
  date: string;
  shift_label?: string;
  source: "paired" | "market" | "expense";
  category_name?: string | null;
  commission: number;
}

export interface HassanCommissionSummary {
  rows: HassanCommissionRow[];
  total: number;
}

export interface HassanEquipmentCommissionDay {
  date: string;
  shift_label?: string;
  source: "paired" | "market" | "expense";
  category_name?: string | null;
  contractor_rate: number | null;
  driver_rate: number | null;
  commission: number;
}

export interface HassanEquipmentCommissionDetail {
  equipment_id: number;
  equipment_name: string;
  days: HassanEquipmentCommissionDay[];
  monthTotal: number;
  yearTotal: number;
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

export interface HassanTreasuryExpense {
  id: number;
  date: string;
  amount: number;
  description: string;
}

export interface HassanTreasuryBalance {
  balance: number;
  allTimeCommission: number;
  allTimeSpent: number;
  monthCommission: number;
  monthSpent: number;
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
  shiftIncome: EquipmentShiftIncome[];
}

export interface PartnerEquipmentYearBreakdown {
  equipment_name: string;
  percentage: number;
  yearAmount: number;
}

export interface PartnerDetail {
  partner: Partner;
  monthDue: number;
  equipmentBreakdown: PartnerEquipmentBreakdown[];
  year: string;
  yearDue: number;
  yearlyEquipmentBreakdown: PartnerEquipmentYearBreakdown[];
  totalDue: number;
  totalPaid: number;
  remaining: number;
  payments: PartnerPayment[];
}

export type TreasuryAccountName = "wallet" | "instapay" | "cash" | "vodafone_cash";

export interface TreasuryAccount {
  id: number;
  name: TreasuryAccountName;
  name_ar: string;
  current_balance: number;
}

export interface TreasuryTransaction {
  date: string;
  direction: "in" | "out";
  label: string;
  amount: number;
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

export interface DashboardMonthlyProfit {
  month: string;
  profit: number;
}

export interface DashboardEquipmentExpense {
  name: string;
  annualExpense: number;
}

export interface DashboardSummary {
  totalAnnualProfit: number;
  totalAnnualExpense: number;
  equipmentCount: number;
  currentMonthLabel: string;
  currentMonthProfit: number;
  totalReceivables: number;
  totalPartnersDue: number;
  totalSuppliersDue: number;
  monthlyProfitTrend: DashboardMonthlyProfit[];
  equipmentExpenses: DashboardEquipmentExpense[];
}

export interface WasteEntry {
  id: number;
  date: string;
  amount: number;
  payment_method: string | null;
  note: string | null;
}

export interface OutgoingEquipmentExpenseRow {
  id: number;
  equipment_id: number;
  equipment_name: string;
  month: string;
  date: string | null;
  category_id: number | null;
  category_name: string | null;
  amount: number;
  payment_method: string | null;
}

export interface OutgoingCategoryTotal {
  category_name: string;
  total: number;
}

export interface OutgoingPartnerPaymentRow {
  id: number;
  partner_id: number;
  partner_name: string;
  date: string;
  amount: number;
  method: string;
  note: string | null;
}

export interface OutgoingSupplierPaymentRow {
  id: number;
  supplier_id: number;
  supplier_name: string;
  date: string;
  amount: number;
  method: string;
  note: string | null;
}

export interface OutgoingPayrollRow {
  id: number;
  employee_id: number;
  employee_name: string;
  date: string;
  amount: number;
  payment_method: PaymentMethod;
  note: string | null;
  kind: "advance" | "bonus" | "salary";
}

export interface OutgoingSummary {
  equipmentExpenses: OutgoingEquipmentExpenseRow[];
  categoryTotals: OutgoingCategoryTotal[];
  equipmentExpensesTotal: number;
  partnerPayments: OutgoingPartnerPaymentRow[];
  partnerPaymentsTotal: number;
  supplierPayments: OutgoingSupplierPaymentRow[];
  supplierPaymentsTotal: number;
  payroll: OutgoingPayrollRow[];
  payrollTotal: number;
  waste: WasteEntry[];
  wasteTotal: number;
  totalOutgoing: number;
}

export interface IncomingContractorPaymentRow {
  id: number;
  contractor_id: number;
  contractor_name: string;
  date: string;
  amount: number;
  method: string;
  note: string | null;
}

export interface IncomingSummary {
  contractorPayments: IncomingContractorPaymentRow[];
  totalIncoming: number;
}

export interface AppUpdateStatus {
  state: "dev" | "not-available" | "downloaded" | "error";
  version?: string;
  message?: string;
}
