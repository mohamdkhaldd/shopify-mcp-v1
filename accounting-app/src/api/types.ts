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
