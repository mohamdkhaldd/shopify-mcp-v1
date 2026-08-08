import { DailyLog, Equipment } from "../types";
import { getState } from "../store";

export function computeDayValue(log: DailyLog): number {
  if (log.is_day_off) return 0;
  if (log.role === "market") return (log.fixed_value ?? 0) - (log.hassan_commission ?? 0);
  if (log.is_paid_leave) return 0;
  const dayRate = log.day_rate ?? 0;
  const baseHours = log.base_hours ?? 0;
  const hourlyRate = dayRate / (baseHours || 8);
  const actualHours = log.actual_hours ?? baseHours;
  const diffHours = actualHours - baseHours;
  return dayRate + diffHours * hourlyRate;
}

function computeDriverWageValue(log: DailyLog, employeeRate: number): number {
  if (log.is_paid_leave || log.is_day_off) return 0;
  const baseHours = log.base_hours ?? 0;
  const hourlyRate = employeeRate / (baseHours || 8);
  const overtimeHours = Math.max(0, (log.actual_hours ?? 0) - baseHours);
  return employeeRate + overtimeHours * hourlyRate;
}

// موظف بمرتب شهري: مرتبه بيتقسم على المعدات اللي اشتغل عليها الشهر ده حسب
// عدد الأيام — نفس منطق اللاب بالظبط. لو مفيش فلوس اتاخدت فعليًا (سلفة/حافز/
// دفعة مرتب) الشهر ده، مفيش مصروف بيتسجل خالص لحد ما تتاخد فلوس.
function monthlySalaryAllocationForEmployeeMonth(employeeId: number, employeeName: string, month: string): Map<number, number> {
  const state = getState();
  const logs = state.daily_logs.filter((l) => l.role === "driver" && l.person_name === employeeName && l.date.startsWith(month));
  const result = new Map<number, number>();
  if (logs.length === 0) return result;

  const daysByEquipment = new Map<number, number>();
  for (const l of logs) daysByEquipment.set(l.equipment_id, (daysByEquipment.get(l.equipment_id) ?? 0) + 1);

  const advancesTotal = state.payroll_entries
    .filter((e) => e.employee_id === employeeId && e.month === month && e.kind === "advance")
    .reduce((s, e) => s + e.amount, 0);
  const bonusesTotal = state.payroll_entries
    .filter((e) => e.employee_id === employeeId && e.month === month && e.kind === "bonus")
    .reduce((s, e) => s + e.amount, 0);
  const paidTotal = state.salary_payments
    .filter((p) => p.employee_id === employeeId && p.month === month)
    .reduce((s, p) => s + p.amount, 0);
  const totalTaken = advancesTotal + bonusesTotal + paidTotal;
  if (totalTaken === 0) return result;

  for (const [equipmentId, days] of daysByEquipment) {
    result.set(equipmentId, totalTaken * (days / logs.length));
  }
  return result;
}

function driverSalaryExpenseForEquipment(equipmentId: number, month: string): number {
  const state = getState();
  const logs = state.daily_logs.filter((l) => l.equipment_id === equipmentId && l.role === "driver" && l.date.startsWith(month));
  const names = new Set(logs.map((l) => l.person_name).filter(Boolean));
  let sum = 0;
  for (const name of names) {
    const employee = state.employees.find((e) => e.name === name);
    if (!employee) continue;
    if (employee.wage_type === "daily") {
      sum += logs.filter((l) => l.person_name === name).reduce((s, l) => s + computeDriverWageValue(l, employee.rate), 0);
    } else {
      const allocation = monthlySalaryAllocationForEmployeeMonth(employee.id, employee.name, month);
      sum += allocation.get(equipmentId) ?? 0;
    }
  }
  return sum;
}

export interface PartnerDistributionRow {
  partner_id: number;
  partner_name: string;
  percentage: number;
  amount: number;
}

export interface EquipmentProfitSummary {
  driverIncome: number;
  marketIncome: number;
  income: number;
  driverSalaryExpense: number;
  manualExpenseTotal: number;
  expenseTotal: number;
  netProfit: number;
  distribution: PartnerDistributionRow[];
}

export function computeEquipmentSummary(equipment: Equipment, month: string): EquipmentProfitSummary {
  const state = getState();
  const driverLogs = state.daily_logs.filter((l) => l.equipment_id === equipment.id && l.role === "driver" && l.date.startsWith(month));
  const marketLogs = state.daily_logs.filter((l) => l.equipment_id === equipment.id && l.role === "market" && l.date.startsWith(month));

  const driverIncome = driverLogs.reduce((s, l) => s + computeDayValue(l), 0);
  const marketIncome = marketLogs.reduce((s, l) => s + computeDayValue(l), 0);
  const income = driverIncome + marketIncome;

  const manualExpenseTotal = state.monthly_expenses
    .filter((e) => e.equipment_id === equipment.id && e.month === month)
    .reduce((s, e) => s + e.amount, 0);
  const driverSalaryExpense = driverSalaryExpenseForEquipment(equipment.id, month);
  const expenseTotal = manualExpenseTotal + driverSalaryExpense;
  const netProfit = income - expenseTotal;

  const distribution: PartnerDistributionRow[] = equipment.shares.map((s) => {
    const partner = state.partners.find((p) => p.id === s.partner_id);
    return {
      partner_id: s.partner_id,
      partner_name: partner?.name ?? "—",
      percentage: s.percentage,
      amount: (netProfit * s.percentage) / 100,
    };
  });

  return { driverIncome, marketIncome, income, driverSalaryExpense, manualExpenseTotal, expenseTotal, netProfit, distribution };
}
