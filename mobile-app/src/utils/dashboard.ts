import { getState } from "../store";
import { computeEquipmentSummary } from "./profit";
import { ARABIC_MONTHS, currentMonthKey } from "./months";

export interface EquipmentAnnualRow {
  equipment_name: string;
  annualExpense: number;
  annualProfit: number;
}

export interface MonthlyProfitPoint {
  month: string;
  profit: number;
}

export interface DashboardSummary {
  year: number;
  totalAnnualProfit: number;
  totalAnnualExpense: number;
  equipmentCount: number;
  currentMonthLabel: string;
  currentMonthProfit: number;
  monthlyProfitTrend: MonthlyProfitPoint[];
  equipmentBreakdown: EquipmentAnnualRow[];
}

export function computeDashboardSummary(): DashboardSummary {
  const state = getState();
  const year = new Date().getFullYear();
  const thisMonth = currentMonthKey();

  const monthlyProfitTrend: MonthlyProfitPoint[] = [];
  const equipmentAnnual = new Map<string, EquipmentAnnualRow>();
  for (const eq of state.equipment) equipmentAnnual.set(eq.name, { equipment_name: eq.name, annualExpense: 0, annualProfit: 0 });

  let totalAnnualProfit = 0;
  let totalAnnualExpense = 0;
  let currentMonthProfit = 0;

  for (let m = 0; m < 12; m++) {
    const monthKey = `${year}-${String(m + 1).padStart(2, "0")}`;
    let monthProfit = 0;
    for (const eq of state.equipment) {
      const s = computeEquipmentSummary(eq, monthKey);
      monthProfit += s.netProfit;
      totalAnnualExpense += s.expenseTotal;
      const row = equipmentAnnual.get(eq.name)!;
      row.annualExpense += s.expenseTotal;
      row.annualProfit += s.netProfit;
    }
    monthlyProfitTrend.push({ month: ARABIC_MONTHS[m], profit: monthProfit });
    totalAnnualProfit += monthProfit;
    if (monthKey === thisMonth) currentMonthProfit = monthProfit;
  }

  return {
    year,
    totalAnnualProfit,
    totalAnnualExpense,
    equipmentCount: state.equipment.length,
    currentMonthLabel: `${ARABIC_MONTHS[Number(thisMonth.slice(5, 7)) - 1]} ${thisMonth.slice(0, 4)}`,
    currentMonthProfit,
    monthlyProfitTrend,
    equipmentBreakdown: [...equipmentAnnual.values()].sort((a, b) => b.annualProfit - a.annualProfit),
  };
}
