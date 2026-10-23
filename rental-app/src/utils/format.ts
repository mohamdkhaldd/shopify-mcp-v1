// Display helpers. Money arrives as integer piasters from the core.

const ISO = (s: string) => `⁦${s}⁩`; // keep the sign glued to the number inside RTL text

/** 9700500 → "97,005" ; 300050 → "3,000.50" (no currency suffix). */
export function pounds(pt: number): string {
  const sign = pt < 0 ? "-" : "";
  const abs = Math.abs(pt);
  const whole = Math.trunc(abs / 100).toLocaleString("en-US");
  const frac = abs % 100;
  return ISO(`${sign}${whole}${frac ? "." + String(frac).padStart(2, "0") : ""}`);
}

export const percentFromBp = (bp: number) => `${(bp / 100).toLocaleString("en-US", { maximumFractionDigits: 2 })}٪`;

const MONTHS = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];

/** "2026-10" → "أكتوبر 2026" */
export const monthLabel = (m: string) => `${MONTHS[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`;

/** "2026-10-05" → "05/10/2026" */
export const dateLabel = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;

export const unitLabel = (u: "day" | "month") => (u === "day" ? "يوم" : "شهر");
