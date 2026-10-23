import { Fraction, Piasters } from "./money";

// One day on a sarki sheet — same rules as the old app's sarki:
//   empty actual hours            → a full normal day (no overtime)
//   overtime hours                = MAX(0, actual − base)
//   overtime hourly rate (empty)  = day rate ÷ base hours
//   day total                     = day rate + overtime hours × overtime rate
export interface SarkiDay {
  isDayOff: boolean;
  actualHoursMilli: number | null;
  baseHoursMilli: number;
  /** Explicit day rate. null = the contract's default (monthly ÷ 30 for monthly contracts). */
  dayRatePt: number | null;
  overtimeRatePt: number | null;
}

/** The contract's default day rate as an exact fraction (monthly contracts: monthly ÷ 30). */
export interface DefaultRate {
  unit: "day" | "month";
  ratePt: Piasters;
}

export const MONTH_DAYS = 30;

export function dayRate(day: SarkiDay, def: DefaultRate): Fraction {
  if (day.dayRatePt != null) return Fraction.of(day.dayRatePt);
  return def.unit === "month" ? Fraction.of(def.ratePt, MONTH_DAYS) : Fraction.of(def.ratePt);
}

export function overtimeMilli(day: SarkiDay): number {
  if (day.isDayOff || day.actualHoursMilli == null) return 0;
  return Math.max(0, day.actualHoursMilli - day.baseHoursMilli);
}

/** Exact value of one day (no truncation). */
export function dayValue(day: SarkiDay, def: DefaultRate): Fraction {
  if (day.isDayOff) return Fraction.of(0);
  const rate = dayRate(day, def);
  const ot = overtimeMilli(day);
  if (ot === 0) return rate;
  if (day.overtimeRatePt != null) return rate.add(Fraction.of(BigInt(ot) * BigInt(day.overtimeRatePt), 1000));
  if (day.baseHoursMilli <= 0) return rate;
  // rate/base per hour × ot hours = rate × ot / base (both in milli-hours)
  return rate.add(new Fraction(rate.n * BigInt(ot), rate.d * BigInt(day.baseHoursMilli)));
}

export interface SheetTotals {
  workedDays: number;
  overtimeMilli: number;
  /** Month total for this sheet, truncated once. */
  totalPt: Piasters;
}

export function sheetTotals(days: SarkiDay[], def: DefaultRate): SheetTotals {
  let sum = Fraction.of(0);
  let worked = 0;
  let ot = 0;
  for (const d of days) {
    if (!d.isDayOff) worked++;
    ot += overtimeMilli(d);
    sum = sum.add(dayValue(d, def));
  }
  return { workedDays: worked, overtimeMilli: ot, totalPt: sum.toPiasters() };
}

/** Key used to flag days where the two sheets disagree (red dot in the UI). */
export function hoursKey(day: SarkiDay | undefined): string {
  if (!day) return "none";
  if (day.isDayOff) return "off";
  return `${day.actualHoursMilli ?? day.baseHoursMilli}/${day.baseHoursMilli}`;
}
