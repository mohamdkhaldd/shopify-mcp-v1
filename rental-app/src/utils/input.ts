import { parsePounds } from "../../core/calc/money";

// Converting what people type into the core's integer units and back.

/** "10" / "7.5" / "٧٫٥" → milli-hours; "" → null. Throws on nonsense. */
export function hoursToMilli(text: string): number | null {
  const t = text.trim().replace(/[٠-٩]/g, (c) => String("٠١٢٣٤٥٦٧٨٩".indexOf(c))).replace("٫", ".");
  if (t === "") return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0 || n > 24) throw new Error("عدد ساعات مش صحيح");
  return Math.round(n * 1000);
}

export const milliToHours = (m: number | null | undefined) => (m == null ? "" : String(m / 1000));

/** "3,000" / "3000.5" → piasters; "" → null. */
export function moneyToPt(text: string): number | null {
  return text.trim() === "" ? null : parsePounds(text);
}

/** 300050 → "3000.5" (plain, for an input box) */
export const ptToInput = (pt: number | null | undefined) => (pt == null ? "" : String(pt / 100));
