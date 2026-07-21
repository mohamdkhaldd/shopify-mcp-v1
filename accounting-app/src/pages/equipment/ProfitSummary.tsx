import { useEffect, useState } from "react";
import { equipmentApi } from "../../api/client";
import { EquipmentSummary } from "../../api/types";
import { formatEGP } from "../../utils/format";

interface ProfitSummaryProps {
  equipmentId: number;
  month: string;
  refreshKey: number;
}

export default function ProfitSummary({ equipmentId, month, refreshKey }: ProfitSummaryProps) {
  const [summary, setSummary] = useState<EquipmentSummary | null>(null);

  useEffect(() => {
    equipmentApi.summary(equipmentId, month).then(setSummary);
  }, [equipmentId, month, refreshKey]);

  if (!summary) return <div className="text-sm text-slate-400">جاري الحساب...</div>;

  const shareTotal = summary.distribution.reduce((sum, d) => sum + d.percentage, 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-card shadow-card p-5">
          <div className="text-sm text-slate-500 font-semibold">دخل التشغيل (سركي + سركي سوق)</div>
          <div className="mt-2 text-xl font-extrabold text-slate-900">{formatEGP(summary.income)}</div>
          <div className="mt-1 text-xs text-slate-400">
            سركي: {formatEGP(summary.driverIncome)} — سركي سوق: {formatEGP(summary.marketIncome)}
          </div>
        </div>
        <div className="bg-white rounded-card shadow-card p-5">
          <div className="text-sm text-slate-500 font-semibold">إجمالي المصروفات</div>
          <div className="mt-2 text-xl font-extrabold text-rose-600">{formatEGP(summary.expenseTotal)}</div>
          <div className="mt-1 text-xs text-slate-400">
            مرتب السائق: {formatEGP(summary.driverSalaryExpense)} — مصروفات تانية: {formatEGP(summary.manualExpenseTotal)}
          </div>
        </div>
        <div className="bg-white rounded-card shadow-card p-5">
          <div className="text-sm text-slate-500 font-semibold">صافي الربح</div>
          <div className={`mt-2 text-xl font-extrabold ${summary.netProfit >= 0 ? "text-primary" : "text-rose-600"}`}>
            {formatEGP(summary.netProfit)}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-card shadow-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-slate-800">توزيع الأرباح على الشركاء</h2>
          {shareTotal > 0 && shareTotal !== 100 && (
            <span className="text-xs font-semibold text-amber-600">مجموع النسب {shareTotal}% (المفروض ١٠٠٪)</span>
          )}
        </div>
        {summary.distribution.length === 0 ? (
          <div className="text-sm text-slate-400">مفيش شركاء محددين لهذه المعدة — ضيفهم من الإعدادات.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-400 border-b border-slate-100">
                <th className="text-start font-semibold py-2">الشريك</th>
                <th className="text-start font-semibold py-2">النسبة</th>
                <th className="text-start font-semibold py-2">المستحق</th>
              </tr>
            </thead>
            <tbody>
              {summary.distribution.map((d) => (
                <tr key={d.partner_id} className="border-b border-slate-50 last:border-0">
                  <td className="py-2.5 font-semibold text-slate-700">{d.partner_name}</td>
                  <td className="py-2.5 text-slate-500">{d.percentage}%</td>
                  <td className="py-2.5 font-semibold text-primary-dark">{formatEGP(d.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
