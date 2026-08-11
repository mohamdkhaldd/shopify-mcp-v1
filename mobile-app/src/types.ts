export type WageType = "daily" | "monthly";

export interface Driver {
  id: number;
  name: string;
  wage_type: WageType;
  rate: number;
  fixed_salary: boolean;
  addedOnMobile?: boolean;
}

export interface Contractor {
  id: number;
  name: string;
  opening_balance: number;
  addedOnMobile?: boolean;
}

export interface Partner {
  id: number;
  name: string;
  opening_balance: number;
  addedOnMobile?: boolean;
}

export interface ExpenseCategory {
  id: number;
  name: string;
  counts_as_commission: boolean;
  addedOnMobile?: boolean;
}

export interface EquipmentShare {
  partner_id: number;
  percentage: number;
}

export interface Equipment {
  id: number;
  name: string;
  purchase_price: number;
  shares: EquipmentShare[];
  addedOnMobile?: boolean;
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
}

export interface MonthlyExpense {
  id: number;
  equipment_id: number;
  month: string;
  date: string | null;
  category_id: number | null;
  amount: number;
  payment_method: string | null;
  note: string | null;
  receipt_image: string | null;
}

export type PaymentMethodLike = "cash" | "wallet" | "instapay" | "vodafone_cash";

export type PayrollKind = "advance" | "bonus" | "deduction";

export interface PayrollEntry {
  id: number;
  employee_id: number;
  kind: PayrollKind;
  month: string;
  date: string;
  amount: number;
  payment_method: string | null;
  reason: string | null;
}

export interface SalaryPayment {
  id: number;
  employee_id: number;
  month: string;
  date: string;
  amount: number;
  payment_method: string;
  note: string | null;
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

export interface HassanTreasuryExpense {
  id: number;
  date: string;
  amount: number;
  description: string;
}

export interface WasteEntry {
  id: number;
  date: string;
  amount: number;
  payment_method: string | null;
  note: string | null;
}

export interface Supplier {
  id: number;
  name: string;
}

export interface SupplierPurchase {
  id: number;
  supplier_id: number;
  date: string;
  description: string | null;
  amount: number;
  note: string | null;
}

export interface SupplierPayment {
  id: number;
  supplier_id: number;
  date: string;
  amount: number;
  method: string | null;
  note: string | null;
}

export interface ContractorPayment {
  id: number;
  contractor_id: number;
  date: string;
  amount: number;
  method: string | null;
  note: string | null;
}

export interface PartnerPayment {
  id: number;
  partner_id: number;
  date: string;
  amount: number;
  method: string | null;
  note: string | null;
}

export type TreasuryAccountName = "cash" | "wallet" | "instapay" | "vodafone_cash";

export interface TreasuryAccount {
  name: TreasuryAccountName;
  balance: number;
}
