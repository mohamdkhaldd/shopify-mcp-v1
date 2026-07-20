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

// The current month's figure — more actionable on a live dashboard than a
// static "highest expense equipment" fact that's already visible in the table below.
export const currentMonthLabel = "يوليو";
export const currentMonthProfit =
  monthlyProfitTrend.find((m) => m.month === currentMonthLabel)?.profit ?? 0;

// Receivables / payables: not tracked anywhere yet in the Excel snapshot —
// these become live totals once the partner/contractor/supplier ledgers
// exist (Phase 2 onward). Zero here is a real "nothing recorded yet" value,
// not a placeholder bug.
export const totalReceivables = 0; // مستحق للشركة (من مقاولين، وغيره)
export const totalPayables = 0; // مستحق على الشركة (لشركاء، موردين، وغيره)
