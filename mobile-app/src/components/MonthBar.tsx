import { currentMonthKey, monthLabel, shiftMonth } from "../utils/months";

export default function MonthBar({ month, onChange }: { month: string; onChange: (month: string) => void }) {
  const isPast = month < currentMonthKey();
  return (
    <div className="flex items-center justify-between bg-white border-b border-slate-100 px-4 py-2">
      <button
        onClick={() => onChange(shiftMonth(month, 1))}
        className="w-7 h-7 rounded-lg border border-slate-200 bg-slate-50 text-slate-500 flex items-center justify-center text-sm"
      >
        ›
      </button>
      <div className="text-center">
        <div className="text-sm font-extrabold text-slate-700">{monthLabel(month)}</div>
        {isPast && <div className="text-[10px] font-bold text-amber-600">شهر فات — بتعدّل بياناته</div>}
      </div>
      <button
        onClick={() => onChange(shiftMonth(month, -1))}
        className="w-7 h-7 rounded-lg border border-slate-200 bg-slate-50 text-slate-500 flex items-center justify-center text-sm"
      >
        ‹
      </button>
    </div>
  );
}
