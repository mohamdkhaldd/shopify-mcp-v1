// All money is stored and passed around as integer piasters (1 EGP = 100 pt).
// Percentages are basis points (14% = 1400). Hours are milli-hours (7.5 h = 7500).
//
// This file is the ONLY place where a fraction of a piaster is ever dropped.
// Every other module computes exactly (BigInt fractions) and calls `portion`
// or `Fraction.toPiasters` once at the end of a document line.

export const BP = 10_000;

export type Piasters = number;

function assertInt(name: string, v: number | bigint) {
  if (typeof v === "number" && !Number.isSafeInteger(v)) throw new Error(`${name} must be a safe integer, got ${v}`);
}

/** Truncates toward zero, so a reversal (negative) is always the exact mirror of the original. */
function truncDiv(n: bigint, d: bigint): bigint {
  if (d === 0n) throw new Error("division by zero");
  return n / d; // BigInt division already truncates toward zero
}

/** amount × num ÷ den, dropping only the sub-piaster remainder. */
export function portion(amount: number | bigint, num: number | bigint, den: number | bigint): Piasters {
  assertInt("amount", amount);
  assertInt("num", num);
  assertInt("den", den);
  return toSafe(truncDiv(BigInt(amount) * BigInt(num), BigInt(den)));
}

/** amount × bp ÷ 10,000 (e.g. VAT, the 5% tax, a profit share). */
export function percent(amount: Piasters, bp: number): Piasters {
  return portion(amount, bp, BP);
}

export function toSafe(v: bigint): number {
  if (v > BigInt(Number.MAX_SAFE_INTEGER) || v < BigInt(Number.MIN_SAFE_INTEGER)) throw new Error("amount out of range");
  return Number(v);
}

/** Exact rational used to add up a month of sarki days before truncating once. */
export class Fraction {
  constructor(readonly n: bigint, readonly d: bigint = 1n) {
    if (d === 0n) throw new Error("zero denominator");
  }
  static of(n: number | bigint, d: number | bigint = 1): Fraction {
    assertInt("n", n);
    assertInt("d", d);
    return new Fraction(BigInt(n), BigInt(d));
  }
  add(o: Fraction): Fraction {
    if (this.d === o.d) return new Fraction(this.n + o.n, this.d);
    return new Fraction(this.n * o.d + o.n * this.d, this.d * o.d).reduce();
  }
  reduce(): Fraction {
    const g = gcd(this.n < 0n ? -this.n : this.n, this.d);
    return g > 1n ? new Fraction(this.n / g, this.d / g) : this;
  }
  toPiasters(): Piasters {
    return toSafe(truncDiv(this.n, this.d));
  }
}

function gcd(a: bigint, b: bigint): bigint {
  while (b) [a, b] = [b, a % b];
  return a || 1n;
}

/** "3,000.50" / "٣٠٠٠٫٥" / 3000.5 → 300050 pt. Throws on anything that isn't a plain amount. */
export function parsePounds(input: string | number): Piasters {
  const raw = String(input)
    .trim()
    .replace(/[٠-٩]/g, (c) => String("٠١٢٣٤٥٦٧٨٩".indexOf(c)))
    .replace(/٫/g, ".")
    .replace(/[,،\s]/g, "");
  const m = raw.match(/^(-)?(\d+)(?:\.(\d{1,2}))?$/);
  if (!m) throw new Error(`مبلغ مش صحيح: ${input}`);
  const pt = Number(m[2]) * 100 + Number((m[3] ?? "").padEnd(2, "0"));
  return m[1] ? -pt : pt;
}

/** 300050 → "3,000.50", 300000 → "3,000". */
export function formatPounds(pt: Piasters): string {
  const sign = pt < 0 ? "-" : "";
  const abs = Math.abs(pt);
  const whole = Math.trunc(abs / 100).toLocaleString("en-US");
  const frac = abs % 100;
  return `${sign}${whole}${frac ? "." + String(frac).padStart(2, "0") : ""}`;
}
