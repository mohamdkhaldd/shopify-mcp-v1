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

const WEEKDAY_NAMES_AR = ["أحد", "اثنين", "ثلاثاء", "أربعاء", "خميس", "جمعة", "سبت"];

export function daysInMonth(monthKey: string): string[] {
  const [year, month] = monthKey.split("-").map(Number);
  const count = new Date(year, month, 0).getDate();
  return Array.from({ length: count }, (_, i) => {
    const day = String(i + 1).padStart(2, "0");
    return `${monthKey}-${day}`;
  });
}

export function weekdayLabel(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  return WEEKDAY_NAMES_AR[new Date(year, month - 1, day).getDay()];
}
