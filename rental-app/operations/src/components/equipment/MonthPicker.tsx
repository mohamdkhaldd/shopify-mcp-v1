import { monthOptionsForYear, yearOf } from "../../utils/months";

interface MonthPickerProps {
  month: string;
  onChange: (month: string) => void;
}

// كل سنة بياناتها منفصلة تمامًا عن التانية — الشهر مفتاحه "YYYY-MM" في كل
// الجداول، فتغيير السنة هنا يعرض بيانات السنة دي بس من غير ما يخلط بأي سنة تانية.
export default function MonthPicker({ month, onChange }: MonthPickerProps) {
  const year = yearOf(month);
  const monthNum = month.split("-")[1];
  const options = monthOptionsForYear(year);

  function changeYear(delta: number) {
    const newYear = String(Number(year) + delta);
    onChange(`${newYear}-${monthNum}`);
  }

  return (
    <div className="flex items-center gap-1.5">
      <button
        onClick={() => changeYear(-1)}
        aria-label="السنة اللي فاتت"
        className="w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-500 hover:text-primary flex items-center justify-center"
      >
        ‹
      </button>
      <span className="text-sm font-bold text-slate-700 w-12 text-center">{year}</span>
      <button
        onClick={() => changeYear(1)}
        aria-label="السنة الجاية"
        className="w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-500 hover:text-primary flex items-center justify-center"
      >
        ›
      </button>
      <select
        value={month}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/40"
      >
        {options.map((o) => (
          <option key={o.key} value={o.key}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
