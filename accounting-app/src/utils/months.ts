export const ARABIC_MONTHS = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

export function currentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function monthLabel(monthKey: string): string {
  const [, monthNum] = monthKey.split("-");
  return ARABIC_MONTHS[Number(monthNum) - 1] ?? monthKey;
}

export function yearOf(monthKey: string): string {
  return monthKey.split("-")[0];
}

export function monthOptionsForYear(year: string): { key: string; label: string }[] {
  return ARABIC_MONTHS.map((label, i) => ({ key: `${year}-${String(i + 1).padStart(2, "0")}`, label }));
}
