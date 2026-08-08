import { computeEquipmentSummary } from "../utils/profit";
import { Equipment } from "../types";

function formatEGP(value: number): string {
  return `${Math.round(value).toLocaleString("ar-EG")} ج.م`;
}

export default function ProfitSheet({ equipment, month }: { equipment: Equipment; month: string }) {
  const summary = computeEquipmentSummary(equipment, month);
  const shareTotal = summary.distribution.reduce((sum, d) => sum + d.percentage, 0);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-2">
        <div className="bg-white rounded-2xl shadow-card p-4">
          <div className="text-xs text-slate-500 font-semibold">دخل التشغيل (سركي + سركي سوق)</div>
          <div className="mt-1.5 text-lg font-extrabold text-slate-800">{formatEGP(summary.income)}</div>
          <div className="mt-1 text-[11px] text-slate-400">
            سركي: {formatEGP(summary.driverIncome)} — سركي سوق: {formatEGP(summary.marketIncome)}
          </div>
        </div>
        <div className="bg-white rounded-2xl shadow-card p-4">
          <div className="text-xs text-slate-500 font-semibold">إجمالي المصروفات</div>
          <div className="mt-1.5 text-lg font-extrabold text-rose-600">{formatEGP(summary.expenseTotal)}</div>
          <div className="mt-1 text-[11px] text-slate-400">
            مرتب السائق: {formatEGP(summary.driverSalaryExpense)} — مصروفات تانية: {formatEGP(summary.manualExpenseTotal)}
          </div>
        </div>
        <div className="bg-primary-light rounded-2xl p-4">
          <div className="text-xs text-slate-500 font-semibold">صافي الربح</div>
          <div className={["mt-1.5 text-lg font-extrabold", summary.netProfit >= 0 ? "text-primary-dark" : "text-rose-600"].join(" ")}>
            {formatEGP(summary.netProfit)}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-card p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-extrabold text-slate-700">توزيع الأرباح على الشركاء</div>
          {shareTotal > 0 && shareTotal !== 100 && (
            <span className="text-[11px] font-bold text-amber-600">مجموع النسب {shareTotal}%</span>
          )}
        </div>
        {summary.distribution.length === 0 ? (
          <div className="text-xs text-slate-400">مفيش شركاء محددين لهذه المعدة — ضيفهم من الإعدادات.</div>
        ) : (
          <div className="space-y-1.5">
            {summary.distribution.map((d) => (
              <div key={d.partner_id} className="flex items-center justify-between text-xs bg-slate-50 rounded-lg px-2.5 py-2">
                <div className="font-bold text-slate-700">{d.partner_name}</div>
                <div className="text-slate-400">{d.percentage}%</div>
                <div className="font-bold text-primary-dark">{formatEGP(d.amount)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
