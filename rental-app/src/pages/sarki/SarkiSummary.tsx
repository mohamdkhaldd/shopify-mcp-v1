type Day = { date: string; overtimeMilli: number; row: { is_day_off: number; actual_hours_milli: number | null; base_hours_milli: number } | null };

const ar = (n: number) => n.toLocaleString("ar-EG", { maximumFractionDigits: 2 });
/** ١ ساعة / ساعتين / ٤ ساعات / ٤٫٥ ساعة */
const hours = (milli: number) => {
  const h = milli / 1000;
  return h === 1 ? "ساعة" : h === 2 ? "ساعتين" : Number.isInteger(h) && h <= 10 ? `${ar(h)} ساعات` : `${ar(h)} ساعة`;
};
const daysList = (ds: number[]) => (ds.length === 1 ? `يوم ${ar(ds[0])}` : `الأيام ${ds.map(ar).join(" و ")}`);

/**
 * ملخص السركي تحت الجدول: اشتغل كام يوم كامل، والأيام اللي اشتغلت ساعات بس
 * (متجمعة بعدد الساعات)، وإجمالي الأوفر تايم.
 */
export function SarkiSummary({ days }: { days: Day[] }) {
  const worked = days.filter((d) => d.row && !d.row.is_day_off);
  if (!worked.length) return null;
  const isShort = (d: Day) => d.row!.actual_hours_milli != null && d.row!.actual_hours_milli < d.row!.base_hours_milli;
  const full = worked.filter((d) => !isShort(d)).length;
  const short = new Map<number, number[]>();
  for (const d of worked.filter(isShort)) {
    const a = d.row!.actual_hours_milli!;
    short.set(a, [...(short.get(a) ?? []), Number(d.date.slice(8))]);
  }
  const off = days.filter((d) => d.row?.is_day_off).length;
  const ot = days.reduce((s, d) => s + d.overtimeMilli, 0);
  const lines = [
    `اشتغل ${ar(full)} يوم كامل`,
    ...[...short.entries()].sort((a, b) => b[0] - a[0]).map(([milli, ds]) => `و${daysList(ds)} ${hours(milli)} بس`),
    ...(ot > 0 ? [`و${hours(ot)} أوفر تايم`] : []),
    ...(off > 0 ? [`ومشتغلش ${ar(off)} يوم`] : []),
  ];
  return (
    <div className="px-4 py-3 border-t border-line text-sm leading-[2]">
      <b className="block text-xs text-muted">ملخص الشهر</b>
      {lines.map((l, i) => (
        <div key={i} className="font-semibold">
          {l}
        </div>
      ))}
    </div>
  );
}
