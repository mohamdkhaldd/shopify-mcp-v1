import { getState } from "../store";
import { DailyLog } from "../types";

// معدات بتاخد نسبة مئوية من قيمة اليوم بدل فرق سعر المقاول عن السركي —
// نفس القائمة والنسب اللي في اللاب بالظبط.
const WINCH_PERCENTAGE_EQUIPMENT = ["ونش 5 طن دبوسة", "ونش 3 وصلة"];

function computePairedCommission(equipmentName: string, driverLog: DailyLog, contractorLog: DailyLog): number {
  if (WINCH_PERCENTAGE_EQUIPMENT.includes(equipmentName)) {
    const k = contractorLog.day_rate ?? 0;
    return k <= 2500 ? k * 0.2 : k * 0.175;
  }
  const k = contractorLog.day_rate ?? 0;
  const h = driverLog.day_rate ?? 0;
  const baseHours = contractorLog.base_hours || 8;
  const overtimeHours = Math.max(0, (contractorLog.actual_hours ?? 0) - (contractorLog.base_hours ?? 0));
  return k - h + overtimeHours * (k / baseHours - h / baseHours);
}

export interface CommissionRow {
  equipment_id: number;
  equipment_name: string;
  date: string;
  source: "paired" | "market" | "expense";
  category_name?: string;
  commission: number;
}

// كل كوميشن حسن — لو month اتبعت بيتفلتر عليه بس، لو من غيره (null) بيحسب
// كل الوقت من أول ما اتسجلت أي بيانات (نفس منطق اللاب بالظبط).
export function computeCommissionRows(month: string | null): { rows: CommissionRow[]; total: number } {
  const state = getState();
  const rows: CommissionRow[] = [];

  for (const equipment of state.equipment) {
    const logsFor = (role: DailyLog["role"]) =>
      state.daily_logs.filter((l) => l.equipment_id === equipment.id && l.role === role && (!month || l.date.startsWith(month)));
    const driverLogs = logsFor("driver");
    const contractorLogs = logsFor("contractor");
    const marketLogs = logsFor("market").filter((l) => l.hassan_commission != null);
    const commissionExpenses = state.monthly_expenses.filter((e) => {
      if (e.equipment_id !== equipment.id) return false;
      if (month && e.month !== month) return false;
      const category = state.expense_categories.find((c) => c.id === e.category_id);
      return !!category?.counts_as_commission;
    });

    const driverByDate = new Map(driverLogs.map((l) => [l.date, l]));
    for (const contractorLog of contractorLogs) {
      const driverLog = driverByDate.get(contractorLog.date);
      if (!driverLog) continue;
      rows.push({
        equipment_id: equipment.id,
        equipment_name: equipment.name,
        date: contractorLog.date,
        source: "paired",
        commission: computePairedCommission(equipment.name, driverLog, contractorLog),
      });
    }
    for (const marketLog of marketLogs) {
      rows.push({
        equipment_id: equipment.id,
        equipment_name: equipment.name,
        date: marketLog.date,
        source: "market",
        commission: marketLog.hassan_commission ?? 0,
      });
    }
    for (const expense of commissionExpenses) {
      const category = state.expense_categories.find((c) => c.id === expense.category_id);
      rows.push({
        equipment_id: equipment.id,
        equipment_name: equipment.name,
        date: expense.date ?? `${expense.month}-01`,
        source: "expense",
        category_name: category?.name,
        commission: expense.amount,
      });
    }
  }

  rows.sort((a, b) => a.date.localeCompare(b.date));
  const total = rows.reduce((sum, r) => sum + r.commission, 0);
  return { rows, total };
}

export interface CommissionDayRow {
  date: string;
  source: "paired" | "market" | "expense";
  category_name?: string;
  contractor_rate: number | null;
  driver_rate: number | null;
  commission: number;
}

// تفاصيل كوميشن معدة واحدة يوم بيوم على مدار السنة اللي فيها الشهر ده —
// نفس منطق hassan:equipmentCommission في اللاب.
export function computeEquipmentCommissionDetail(equipmentId: number, month: string) {
  const state = getState();
  const equipment = state.equipment.find((e) => e.id === equipmentId);
  const year = month.split("-")[0];
  const inYear = (date: string) => date.startsWith(`${year}-`);

  const driverLogs = state.daily_logs.filter((l) => l.equipment_id === equipmentId && l.role === "driver" && inYear(l.date));
  const contractorLogs = state.daily_logs.filter((l) => l.equipment_id === equipmentId && l.role === "contractor" && inYear(l.date));
  const marketLogs = state.daily_logs.filter(
    (l) => l.equipment_id === equipmentId && l.role === "market" && inYear(l.date) && l.hassan_commission != null
  );
  const commissionExpenses = state.monthly_expenses.filter((e) => {
    if (e.equipment_id !== equipmentId || !e.month.startsWith(`${year}-`)) return false;
    const category = state.expense_categories.find((c) => c.id === e.category_id);
    return !!category?.counts_as_commission;
  });

  const driverByDate = new Map(driverLogs.map((l) => [l.date, l]));
  const allRows: CommissionDayRow[] = [];
  for (const contractorLog of contractorLogs) {
    const driverLog = driverByDate.get(contractorLog.date);
    if (!driverLog) continue;
    allRows.push({
      date: contractorLog.date,
      source: "paired",
      contractor_rate: contractorLog.day_rate ?? 0,
      driver_rate: driverLog.day_rate ?? 0,
      commission: computePairedCommission(equipment?.name ?? "", driverLog, contractorLog),
    });
  }
  for (const marketLog of marketLogs) {
    allRows.push({
      date: marketLog.date,
      source: "market",
      contractor_rate: marketLog.fixed_value ?? 0,
      driver_rate: null,
      commission: marketLog.hassan_commission ?? 0,
    });
  }
  for (const expense of commissionExpenses) {
    const category = state.expense_categories.find((c) => c.id === expense.category_id);
    allRows.push({
      date: expense.date ?? `${expense.month}-01`,
      source: "expense",
      category_name: category?.name,
      contractor_rate: null,
      driver_rate: null,
      commission: expense.amount,
    });
  }
  allRows.sort((a, b) => a.date.localeCompare(b.date));

  const days = allRows.filter((r) => r.date.startsWith(month));
  const monthTotal = days.reduce((sum, r) => sum + r.commission, 0);
  const yearTotal = allRows.reduce((sum, r) => sum + r.commission, 0);

  return { equipment_id: equipmentId, equipment_name: equipment?.name ?? "", days, monthTotal, yearTotal };
}

// رصيد خزنة حسن الكامل: كوميشنه المتراكم من أول ما اتسجلت أي بيانات، ناقص
// أي فلوس دفعها من الخزنة دي — نفس منطق hassan:treasuryBalance في اللاب.
export function computeHassanTreasuryBalance(month: string) {
  const state = getState();
  const allTimeCommission = computeCommissionRows(null).total;
  const monthCommission = computeCommissionRows(month).total;
  const allTimeSpent = state.hassan_treasury_expenses.reduce((sum, e) => sum + e.amount, 0);
  const monthSpent = state.hassan_treasury_expenses.filter((e) => e.date.startsWith(month)).reduce((sum, e) => sum + e.amount, 0);
  return {
    balance: allTimeCommission - allTimeSpent,
    allTimeCommission,
    allTimeSpent,
    monthCommission,
    monthSpent,
  };
}
