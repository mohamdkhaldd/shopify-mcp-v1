import { computeDashboardSummary } from "../utils/dashboard";

function formatEGP(value: number): string {
  return `${Math.round(value).toLocaleString("ar-EG")} ج.م`;
}

export default function Dashboard() {
  const summary = computeDashboardSummary();
  const maxAbsProfit = Math.max(1, ...summary.monthlyProfitTrend.map((p) => Math.abs(p.profit)));

  return (
    <div>
      <div className="bg-primary text-white px-4 pt-6 pb-4">
        <div className="text-xs opacity-80 font-bold">دفتر البنيان</div>
        <div className="text-lg font-extrabold mt-0.5">لوحة التحكم — {summary.year}</div>
      </div>

      <div className="p-4 space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-white rounded-2xl shadow-card p-4">
            <div className="text-[11px] text-slate-500 font-semibold">صافي الربح السنوي</div>
            <div className={["mt-1 text-lg font-extrabold", summary.totalAnnualProfit >= 0 ? "text-primary-dark" : "text-rose-600"].join(" ")}>
              {formatEGP(summary.totalAnnualProfit)}
            </div>
          </div>
          <div className="bg-white rounded-2xl shadow-card p-4">
            <div className="text-[11px] text-slate-500 font-semibold">عدد المعدات</div>
            <div className="mt-1 text-lg font-extrabold text-slate-800">{summary.equipmentCount}</div>
          </div>
          <div className="bg-white rounded-2xl shadow-card p-4">
            <div className="text-[11px] text-slate-500 font-semibold">إجمالي المصروف السنوي</div>
            <div className="mt-1 text-lg font-extrabold text-rose-600">{formatEGP(summary.totalAnnualExpense)}</div>
          </div>
          <div className="bg-primary-light rounded-2xl p-4">
            <div className="text-[11px] text-slate-500 font-semibold">ربح {summary.currentMonthLabel}</div>
            <div className="mt-1 text-lg font-extrabold text-primary-dark">{formatEGP(summary.currentMonthProfit)}</div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-card p-4">
          <div className="text-sm font-extrabold text-slate-700 mb-3">اتجاه الربح الشهري</div>
          <div className="flex items-end gap-1.5 h-28">
            {summary.monthlyProfitTrend.map((p) => {
              const heightPct = Math.max(4, (Math.abs(p.profit) / maxAbsProfit) * 100);
              return (
                <div key={p.month} className="flex-1 flex flex-col items-center justify-end h-full">
                  <div
                    className={["w-full rounded-t-md", p.profit >= 0 ? "bg-primary" : "bg-rose-400"].join(" ")}
                    style={{ height: `${heightPct}%` }}
                    title={`${p.month}: ${formatEGP(p.profit)}`}
                  />
                  <div className="text-[9px] text-slate-400 mt-1">{p.month.slice(0, 3)}</div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-card p-4">
          <div className="text-sm font-extrabold text-slate-700 mb-2">ترتيب المعدات بالربح السنوي</div>
          <div className="space-y-1.5">
            {summary.equipmentBreakdown.map((e) => (
              <div key={e.equipment_name} className="flex items-center justify-between text-xs bg-slate-50 rounded-lg px-2.5 py-2">
                <div className="font-bold text-slate-700">{e.equipment_name}</div>
                <div className={["font-bold", e.annualProfit >= 0 ? "text-primary-dark" : "text-rose-600"].join(" ")}>
                  {formatEGP(e.annualProfit)}
                </div>
              </div>
            ))}
            {summary.equipmentBreakdown.length === 0 && <div className="text-xs text-slate-400">مفيش معدات مسجلة.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
