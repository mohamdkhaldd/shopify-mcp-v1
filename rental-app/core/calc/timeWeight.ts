// Time-weighted capital: Σ over each day of the month of the investor's balance
// that day. A deposit counts from its own date; a withdrawal stops counting on
// its own date ("يوم الإيداع بيتحسب، يوم السحب لأ").

export interface CapitalMovement {
  date: string; // YYYY-MM-DD
  /** + deposit, − withdrawal (piasters). */
  signedPt: number;
}

export function daysInMonth(month: string): number {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function monthDates(month: string): string[] {
  const n = daysInMonth(month);
  return Array.from({ length: n }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`);
}

export function capitalWeight(movements: CapitalMovement[], month: string): bigint {
  const sorted = [...movements].sort((a, b) => a.date.localeCompare(b.date));
  let weight = 0n;
  for (const day of monthDates(month)) {
    let balance = 0n;
    for (const m of sorted) {
      if (m.date > day) break;
      balance += BigInt(m.signedPt);
    }
    if (balance > 0n) weight += balance;
  }
  return weight;
}

/** Days in the month on which the investor had money with us. */
export function daysPresent(movements: CapitalMovement[], month: string): number {
  return monthDates(month).filter((day) => movements.filter((m) => m.date <= day).reduce((s, m) => s + m.signedPt, 0) > 0).length;
}

export function balanceOn(movements: CapitalMovement[], date: string): number {
  return movements.filter((m) => m.date <= date).reduce((s, m) => s + m.signedPt, 0);
}
