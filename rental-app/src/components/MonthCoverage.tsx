import { Labeled, Select } from "./Field";
import { dateLabel, monthLabel, pounds } from "../utils/format";

// الدفعات شهر بشهر (للشركة ولصاحب المعدة): كل شهر عليه/له كام، واتدفع منه
// كام ومن أنهي دفعة، وناقص كام — وسطر بيلخص: "اتدفع كله: … — ناقص كذا من شهر كذا".

export interface MonthRow {
  month: string;
  duePt: number;
  paidPt: number;
  openPt: number;
  covered: { date: string; amountPt: number }[];
}

export function coverageSummary(months: MonthRow[]) {
  const full = months.filter((m) => m.duePt > 0 && m.openPt <= 0).map((m) => monthLabel(m.month));
  const short = months.filter((m) => m.openPt > 0).map((m) => `${pounds(m.openPt)} من ${monthLabel(m.month)}`);
  const parts: string[] = [];
  if (full.length) parts.push(`اتدفع كله: ${full.join("، ")}`);
  if (short.length) parts.push(`ناقص ${short.join(" و")}`);
  return parts.join(" — ") || "لسه مفيش حساب";
}

export default function MonthCoverage({ months, advancePt, dueLabel, paidLabel }: { months: MonthRow[]; advancePt: number; dueLabel: string; paidLabel: string }) {
  if (!months.length) return null;
  return (
    <div className="border-t border-line">
      <div className="px-4 py-2.5 font-bold text-[14px] bg-surface-2">
        {coverageSummary(months)}
        {advancePt > 0 && <span className="text-in"> — ومدفوع زيادة (مقدّم) {pounds(advancePt)}</span>}
      </div>
      <div className="overflow-x-auto">
        <table className="tbl">
          <thead>
            <tr>
              <th>الشهر</th>
              <th className="n">{dueLabel}</th>
              <th className="n">{paidLabel}</th>
              <th className="n">ناقص</th>
              <th>اتسدد من دفعة</th>
            </tr>
          </thead>
          <tbody>
            {[...months].reverse().map((m) => (
              <tr key={m.month}>
                <td className="font-bold">{monthLabel(m.month)}</td>
                <td className="n">{pounds(m.duePt)}</td>
                <td className="n text-in">{pounds(m.paidPt)}</td>
                <td className={`n font-bold ${m.openPt > 0 ? "text-out" : "text-in"}`}>{m.openPt > 0 ? pounds(m.openPt) : "خالص ✓"}</td>
                <td className="text-xs text-muted">
                  {m.covered.length === 0 ? "—" : m.covered.map((c, i) => <div key={i}>{pounds(c.amountPt)} — دفعة {dateLabel(c.date)}</div>)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** اختيار "الدفعة دي عن أنهي شهر" — فاضي = أقدم شهر لسه عليه حاجة. */
export function ForMonthSelect({ months, value, onChange }: { months: MonthRow[]; value: string; onChange: (v: string) => void }) {
  return (
    <Labeled label="عن أنهي شهر؟">
      <Select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">أقدم شهر لسه فيه باقي (تلقائي)</option>
        {[...months].reverse().map((m) => (
          <option key={m.month} value={m.month}>
            {monthLabel(m.month)}
            {m.openPt > 0 ? ` — ناقص ${pounds(m.openPt)}` : " — خالص"}
          </option>
        ))}
      </Select>
    </Labeled>
  );
}
