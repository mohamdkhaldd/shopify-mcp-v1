export function formatEGP(value: number): string {
  const sign = value < 0 ? "-" : "";
  // Western digits + bidi isolation (U+2066/U+2069): keeps the sign glued to
  // the number instead of drifting across the RTL/LTR boundary.
  const amount = `${sign}${Math.abs(value).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  return `⁦${amount}⁩ ج.م`;
}
