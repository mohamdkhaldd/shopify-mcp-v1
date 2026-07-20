// Snapshot pulled from the existing Excel system ("الرئيسية" sheet) as of the
// last recorded month. Once the SQLite database lands in Phase 2, this file
// is replaced by live queries.

export interface MonthlyProfit {
  month: string;
  profit: number;
}

export interface EquipmentExpense {
  name: string;
  annualExpense: number;
}

export const monthlyProfitTrend: MonthlyProfit[] = [
  { month: "يناير", profit: 0 },
  { month: "فبراير", profit: 0 },
  { month: "مارس", profit: 0 },
  { month: "أبريل", profit: 0 },
  { month: "مايو", profit: 0 },
  { month: "يونيو", profit: 0 },
  { month: "يوليو", profit: -710 },
  { month: "أغسطس", profit: 0 },
  { month: "سبتمبر", profit: 0 },
  { month: "أكتوبر", profit: 0 },
  { month: "نوفمبر", profit: 0 },
  { month: "ديسمبر", profit: 0 },
];

export const equipmentExpenses: EquipmentExpense[] = [
  { name: "مان لفت 42", annualExpense: 0 },
  { name: "مان لفت 28 أزرق", annualExpense: 0 },
  { name: "مان لفت 28 أصفر", annualExpense: 0 },
  { name: "بوكيت أزرق", annualExpense: 0 },
  { name: "بوكيت أوتوماتيك", annualExpense: 0 },
  { name: "بوكيت ميتسوبيشي", annualExpense: 0 },
  { name: "بوكيت أخضر", annualExpense: 0 },
  { name: "بوكيت كامل", annualExpense: 0 },
  { name: "ونش 5 طن دبوسة", annualExpense: 710 },
  { name: "ونش 3 وصلة", annualExpense: 0 },
];

export const totalAnnualProfit = monthlyProfitTrend.reduce((sum, m) => sum + m.profit, 0);
export const totalAnnualExpense = equipmentExpenses.reduce((sum, e) => sum + e.annualExpense, 0);
export const equipmentCount = equipmentExpenses.length;
export const highestExpenseEquipment = equipmentExpenses.reduce((max, e) =>
  e.annualExpense > max.annualExpense ? e : max
);
