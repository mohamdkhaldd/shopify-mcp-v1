import { useEffect, useState } from "react";
import MonthPicker from "../components/equipment/MonthPicker";
import PrintButton from "../components/PrintButton";
import { PrintHeader } from "../components/PrintSignoff";
import { reportsApi } from "../api/client";
import { MonthlyReport } from "../api/types";
import { currentMonthKey, monthLabel } from "../utils/months";
import { formatEGP } from "../utils/format";

export default function Reports() {
  const [month, setMonth] = useState(currentMonthKey());
  const [report, setReport] = useState<MonthlyReport | null>(null);

  useEffect(() => {
    reportsApi.monthly(month).then(setReport);
  }, [month]);

  if (!report) return <div className="text-sm text-slate-400">جاري التحميل...</div>;

  return (
    <div className="space-y-6">
      <PrintHeader title="التقرير الشهري الشامل" subtitle={`${monthLabel(month)} ${month.split("-")[0]}`} />

      <div className="no-print flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">التقارير</h1>
          <p className="text-sm text-slate-500 mt-1">ملخص شامل لكل أرقام الشركة الشهر ده في مكان واحد.</p>
        </div>
        <div className="flex items-center gap-2">
          <PrintButton />
          <MonthPicker month={month} onChange={setMonth} />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white rounded-card shadow-card p-5">
          <div className="text-sm text-slate-500 font-semibold">إجمالي الدخل</div>
          <div className="mt-2 text-xl font-extrabold text-slate-900">{formatEGP(report.totalIncome)}</div>
        </div>
        <div className="bg-white rounded-card shadow-card p-5">
          <div className="text-sm text-slate-500 font-semibold">إجمالي المصروفات</div>
          <div className="mt-2 text-xl font-extrabold text-rose-600">{formatEGP(report.totalExpense)}</div>
        </div>
        <div className="bg-white rounded-card shadow-card p-5">
          <div className="text-sm text-slate-500 font-semibold">صافي الربح</div>
          <div className={`mt-2 text-xl font-extrabold ${report.netProfit >= 0 ? "text-primary" : "text-rose-600"}`}>
            {formatEGP(report.netProfit)}
          </div>
        </div>
        <div className="bg-white rounded-card shadow-card p-5">
          <div className="text-sm text-slate-500 font-semibold">كوميشن حسن</div>
          <div className="mt-2 text-xl font-extrabold text-slate-900">{formatEGP(report.hassanCommissionTotal)}</div>
        </div>
      </div>

      <div className="bg-white rounded-card shadow-card p-5">
        <h2 className="font-bold text-slate-800 mb-4">الربح والمصروف لكل معدة</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-slate-400 border-b border-slate-100">
              <th className="text-start font-semibold py-2">المعدة</th>
              <th className="text-start font-semibold py-2">الدخل</th>
              <th className="text-start font-semibold py-2">المصروف</th>
              <th className="text-start font-semibold py-2">صافي الربح</th>
            </tr>
          </thead>
          <tbody>
            {report.equipmentRows.map((e) => (
              <tr key={e.equipment_name} className="border-b border-slate-50 last:border-0">
                <td className="py-2 font-semibold text-slate-700">{e.equipment_name}</td>
                <td className="py-2 text-slate-600">{formatEGP(e.income)}</td>
                <td className="py-2 text-rose-500">{formatEGP(e.expense)}</td>
                <td className={`py-2 font-semibold ${e.netProfit >= 0 ? "text-primary-dark" : "text-rose-600"}`}>{formatEGP(e.netProfit)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white rounded-card shadow-card p-5">
          <div className="text-sm text-slate-500 font-semibold">إجمالي صافي الرواتب</div>
          <div className="mt-2 text-xl font-extrabold text-slate-900">{formatEGP(report.payrollTotal)}</div>
        </div>
        <div className="bg-white rounded-card shadow-card p-5">
          <div className="text-sm text-slate-500 font-semibold mb-2">أرصدة الخزنة الحالية</div>
          <div className="space-y-1">
            {report.treasuryBalances.map((t) => (
              <div key={t.name} className="flex items-center justify-between text-sm">
                <span className="text-slate-600">{t.name_ar}</span>
                <span className="font-semibold text-slate-800">{formatEGP(t.balance)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
