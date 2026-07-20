export interface Partner {
  id: number;
  name: string;
}

export type WageType = "daily" | "monthly";

export interface Driver {
  id: number;
  name: string;
  wage_type: WageType;
  rate: number;
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
  fixed_value: number | null;
  day_value: number;
}

export interface MonthlyExpense {
  id: number;
  equipment_id: number;
  month: string;
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
  expenseTotal: number;
  netProfit: number;
  distribution: PartnerDistributionRow[];
}
