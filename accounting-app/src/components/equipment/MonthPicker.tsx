import { monthOptionsForYear, yearOf } from "../../utils/months";

interface MonthPickerProps {
  month: string;
  onChange: (month: string) => void;
}

export default function MonthPicker({ month, onChange }: MonthPickerProps) {
  const year = yearOf(month);
  const options = monthOptionsForYear(year);

  return (
    <select
      value={month}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/40"
    >
      {options.map((o) => (
        <option key={o.key} value={o.key}>
          {o.label} {year}
        </option>
      ))}
    </select>
  );
}
