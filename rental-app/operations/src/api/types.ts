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
  site_name: string | null;
  overtime_rate: number | null;
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
  // null = اتدفع كله وقت التسجيل؛ غير كده اللي اتدفع والباقي في الآجل.
  paid_amount: number | null;
  payee: string | null;
  paid_total?: number;
  remaining?: number;
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
  id: number | string;
  date: string;
  amount: number;
  description: string;
  /** البند (إيجار، قسط، أكل...) — في القايمة: البند ده أو البيان لو مفيش */
  category?: string | null;
  // سطر محسوب (الخاص من العربية الملاكي) — مبيتمسحش من هنا.
  computed?: boolean;
}

export interface HassanTreasuryBalance {
  balance: number;
  allTimeCommission: number;
  allTimeSpent: number;
  monthCommission: number;
  monthSpent: number;
  monthPenalties: number;
  allTimePenalties: number;
}

export interface HassanPenalty {
  id: number;
  date: string;
  amount: number;
  reason: string | null;
}

export interface HassanWorker {
  id: number;
  name: string;
  job: string | null;
  monthly_salary: number;
  start_month: string;
  active: number;
  // باليومية — المرتب من شيت الحضور (لو فاضي: مرتب شهري ثابت).
  day_rate: number | null;
  leave_rate: number | null;
}

export type HassanWorkerEntryType = "payment" | "advance" | "bonus" | "deduction";

export interface HassanWorkerEntry {
  id: number;
  worker_id: number;
  worker_name: string;
  month: string;
  date: string;
  type: HassanWorkerEntryType;
  amount: number;
  note: string | null;
}

export interface HassanWorkerPayrollRow {
  worker_id: number;
  name: string;
  job: string | null;
  active: boolean;
  monthly_salary: number;
  daily: boolean;
  day_rate: number | null;
  leave_rate: number | null;
  days_worked: number;
  paid_leave_days: number;
  unpaid_days: number;
  bonuses: number;
  deductions: number;
  net: number;
  payments: number;
  advances: number;
  paid: number;
  remaining: number;
}

export interface HassanWorkerPayroll {
  month: string;
  rows: HassanWorkerPayrollRow[];
  totalNet: number;
  totalPaid: number;
  totalRemaining: number;
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
  balance: number | null;
  transfer_id?: number;
  other_income_id?: number;
  adjustment_id?: number;
}

export interface TreasuryStatement {
  openingForMonth: number;
  rows: TreasuryTransaction[];
  closing: number;
}

export interface TreasurySummaryRow {
  id: number;
  name: TreasuryAccountName;
  name_ar: string;
  openingBalance: number;
  openingDate: string | null;
  balance: number;
  monthIncoming: number;
  monthOutgoing: number;
  netMovement: number;
  lastCountDate: string | null;
}

export interface TreasuryExtras {
  transfers: { id: number; date: string; from_account: string; to_account: string; amount: number; note: string | null }[];
  otherIncome: { id: number; date: string; amount: number; method: string; description: string | null }[];
  adjustments: { id: number; account: string; date: string; amount: number; expected: number | null; counted: number | null; note: string | null }[];
}

export interface PayableExpense {
  id: number;
  equipment_name: string;
  category_name: string | null;
  payee: string | null;
  date: string;
  note: string | null;
  amount: number;
  paid: number;
  remaining: number;
}

export interface PayablesSummary {
  month: string;
  expenses: PayableExpense[];
  partners: { id: number; name: string; monthDue: number; yearDue: number; openingBalance: number; totalDue: number }[];
  receivables: { id: number; name: string; openingBalance: number; work: number; paid: number; remaining: number }[];
  suppliersDue: number;
  recentPayments: {
    id: number;
    expense_id: number;
    date: string;
    amount: number;
    method: string;
    note: string | null;
    equipment_name: string;
    category_name: string | null;
    payee: string | null;
  }[];
  expensesDue: number;
  partnersMonthDue: number;
  partnersYearDue: number;
  partnersOpening: number;
  partnersTotalDue: number;
  receivablesTotal: number;
  creditors?: CreditorBalance[];
  creditorsDue?: number;
  totalDue: number;
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
  workDays: number;
  offDays: number;
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
  annualIncome: number;
  annualProfit: number;
  workDays: number;
  offDays: number;
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
  creditorPayments?: CreditorEntry[];
  creditorPaymentsTotal?: number;
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
  // "apk" = نسخة تابلت أحدث متاحة للتنزيل من url.
  state: "dev" | "not-available" | "downloaded" | "error" | "apk";
  version?: string;
  message?: string;
  url?: string;
}

export interface MonthDueRow {
  id: number;
  name: string;
  due: number;
  paid: number;
  remaining: number;
}

export interface DashboardMonthDues {
  month: string;
  contractors: MonthDueRow[];
  partners: MonthDueRow[];
  contractorsRemaining: number;
  partnersRemaining: number;
}

export interface EquipmentSheetMismatch {
  equipment_id: number;
  months: { month: string; days: number }[];
}

export interface SyncStatus {
  deviceId: string;
  deviceName: string;
  pending: number;
  deferred: number;
  online: boolean;
  // الجهاز محتاج باسورد المزامنة (أول مرة، أو بعد ما الباسورد اتغير).
  needsLogin?: boolean;
  lastError: string | null;
  lastSyncAt: string | null;
}

export interface SyncActivityRow {
  id: number | string;
  tbl: string;
  gid: string;
  op: "insert" | "update" | "delete" | string;
  data: Record<string, any>;
  refs: Record<string, string>;
  device_id: string;
  device_name: string;
  at: string;
  pending: boolean;
  // اتعمله "تراجع" من الجهاز ده.
  undone?: boolean;
}

export interface SyncActivity {
  rows: SyncActivityRow[];
  pending: SyncActivityRow[];
  devices: string[];
}

// فلوس علينا لجهات تانية (غير الموردين والشركاء).
export interface CreditorBalance {
  id: number;
  name: string;
  note: string | null;
  openingBalance: number;
  debts: number;
  paid: number;
  remaining: number;
}

export interface CreditorEntry {
  id: number;
  creditor_id: number;
  creditor_name?: string;
  date: string;
  type: "debt" | "payment";
  amount: number;
  method: string | null;
  note: string | null;
  balance?: number;
}

export interface CreditorStatement extends CreditorBalance {
  entries: CreditorEntry[];
}

// العهد
export interface Custody {
  id: number;
  holder: string;
  date: string;
  amount: number;
  method: string;
  warn_amount: number;
  note: string | null;
  closed: boolean;
  given: number;
  topups: number;
  spent: number;
  returned: number;
  remaining: number;
  low: boolean;
}

export interface CustodyEntry {
  id: number;
  custody_id: number;
  date: string;
  type: "expense" | "topup" | "return";
  amount: number;
  description: string | null;
  method: string | null;
  expense_id: number | null;
  equipment_name: string | null;
  category_name: string | null;
  balance: number;
}

export interface CustodyStatement extends Custody {
  entries: CustodyEntry[];
}

// العربية الملاكي
export interface CarFuel {
  id: number;
  date: string;
  kind: string;
  amount: number;
  note: string | null;
}

export interface CarSummary {
  month: string;
  fuel: CarFuel[];
  trips: { id: number; date: string | null; month: string; amount: number; note: string | null; equipment_name: string }[];
  byEquipment: { equipment_name: string; amount: number }[];
  fuelTotal: number;
  tripsTotal: number;
  personal: number;
  over: number;
  categoryId: number | null;
  yearPersonal: number;
}

// الالتزامات
export interface Obligation {
  id: number;
  title: string;
  kind: string;
  amount: number | null;
  due_date: string;
  repeat_monthly: number;
  done_at: string | null;
  note: string | null;
  /** مرتبات / شركاء من غير مبلغ مكتوب: اللي عليك دلوقتي، محسوب لوحده */
  auto_amount?: number;
  /** المرتبات: الشهر اللي المبلغ ده بتاعه */
  for_month?: string;
}

export interface DashboardAlert {
  kind: "custody" | "obligation";
  level: "warn" | "danger";
  id: number;
  title: string;
  amount: number | null;
  due_date?: string;
  days?: number;
}

export type AttendanceStatus = "present" | "absent" | "leave_paid" | "leave_unpaid";
export interface AttendanceRow {
  id: number;
  worker_id: number;
  date: string;
  status: AttendanceStatus;
}
