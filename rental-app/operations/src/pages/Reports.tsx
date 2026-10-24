import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Legend, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import DayCountBadge from "../components/DayCountBadge";
import EquipmentTick from "../components/EquipmentTick";
import MonthPicker from "../components/equipment/MonthPicker";
import PrintButton from "../components/PrintButton";
import { PrintHeader } from "../components/PrintSignoff";
import { reportsApi } from "../api/client";
import { MonthlyReport } from "../api/types";
import { currentMonthKey, elapsedDaysInMonth, monthLabel } from "../utils/months";
import { useTheme } from "../theme";
import { formatEGP } from "../utils/format";
import { person } from "../person";

export default function Reports() {
  const [month, setMonth] = useState(currentMonthKey());
  const [report, setReport] = useState<MonthlyReport | null>(null);
  const { theme } = useTheme();

  useEffect(() => {
    reportsApi.monthly(month).then(setReport);
  }, [month]);

  if (!report) return <div className="text-sm text-slate-400">جاري التحميل...</div>;

  const gridStroke = theme === "dark" ? "#243057" : "#EEF2F0";
  const tickFill = theme === "dark" ? "#94A0C9" : "#64748B";
  const categoryTickFill = theme === "dark" ? "#D7DDF3" : "#334155";
  const tooltipStyle =
    theme === "dark"
      ? { direction: "rtl" as const, fontFamily: "Cairo", borderRadius: 12, border: "1px solid #2B3A63", background: "#121B3A", color: "#E7ECFB" }
      : { direction: "rtl" as const, fontFamily: "Cairo", borderRadius: 12, border: "1px solid #E2E8F0" };
  const chartHeight = Math.max(220, report.equipmentRows.length * 44);
  const elapsedDays = elapsedDaysInMonth(month);

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
          <div className="text-sm text-slate-500 font-semibold">كوميشن {person()} (بعد الجزاءات)</div>
          <div className="mt-2 text-xl font-extrabold text-slate-900">{formatEGP(report.hassanCommissionTotal)}</div>
        </div>
      </div>

      {/* الرسوم للشاشة بس — الجدول تحت فيه نفس الأرقام وهو اللي بيتطبع. */}
      <div className="no-print grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="bg-white rounded-card shadow-card p-5">
          <h2 className="font-bold text-slate-800 mb-4">دخل ومصروف كل معدة — {monthLabel(month)}</h2>
          <ResponsiveContainer width="100%" height={chartHeight}>
            <BarChart data={report.equipmentRows} layout="vertical" margin={{ top: 0, right: 10, left: 0, bottom: 0 }} barCategoryGap={8}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={gridStroke} />
              <XAxis type="number" tick={{ fontSize: 11, fill: tickFill }} axisLine={false} tickLine={false} />
              <YAxis
                type="category"
                dataKey="equipment_name"
                tick={<EquipmentTick fill={categoryTickFill} />}
                axisLine={false}
                tickLine={false}
                width={120}
                interval={0}
              />
              <Tooltip formatter={(value: number) => formatEGP(value)} contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontFamily: "Cairo", fontSize: 12 }} />
              <Bar dataKey="income" name="الدخل" fill="#2F8F63" radius={[0, 5, 5, 0]} barSize={10} />
              <Bar dataKey="expense" name="المصروف" fill="#C2853A" radius={[0, 5, 5, 0]} barSize={10} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-card shadow-card p-5">
          <h2 className="font-bold text-slate-800 mb-4">صافي ربح كل معدة — {monthLabel(month)}</h2>
          <ResponsiveContainer width="100%" height={chartHeight}>
            <BarChart data={report.equipmentRows} layout="vertical" margin={{ top: 0, right: 10, left: 0, bottom: 0 }} barCategoryGap={10}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={gridStroke} />
              <XAxis type="number" tick={{ fontSize: 11, fill: tickFill }} axisLine={false} tickLine={false} />
              <YAxis
                type="category"
                dataKey="equipment_name"
                tick={<EquipmentTick fill={categoryTickFill} />}
                axisLine={false}
                tickLine={false}
                width={120}
                interval={0}
              />
              <ReferenceLine x={0} stroke={tickFill} strokeOpacity={0.5} />
              <Tooltip formatter={(value: number) => [formatEGP(value), "صافي الربح"]} contentStyle={tooltipStyle} />
              <Bar dataKey="netProfit" radius={[0, 5, 5, 0]} barSize={14}>
                {report.equipmentRows.map((e) => (
                  <Cell key={e.equipment_name} fill={e.netProfit >= 0 ? "#2F8F63" : "#E11D48"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
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
              <th className="text-start font-semibold py-2">أيام الشغل</th>
              <th className="text-start font-semibold py-2">أيام الإجازة</th>
              <th className="text-start font-semibold py-2">لسه متسجلتش</th>
            </tr>
          </thead>
          <tbody>
            {report.equipmentRows.map((e) => (
              <tr key={e.equipment_name} className="border-b border-slate-50 last:border-0">
                <td className="py-2 font-semibold text-slate-700">{e.equipment_name}</td>
                <td className="py-2 text-slate-600">{formatEGP(e.income)}</td>
                <td className="py-2 text-rose-500">{formatEGP(e.expense)}</td>
                <td className={`py-2 font-semibold ${e.netProfit >= 0 ? "text-primary-dark" : "text-rose-600"}`}>{formatEGP(e.netProfit)}</td>
                <td className="py-2">
                  <DayCountBadge count={e.workDays} tone="work" />
                </td>
                <td className="py-2">
                  <DayCountBadge count={e.offDays} tone="off" />
                </td>
                <td className="py-2">
                  {Math.max(0, elapsedDays - e.workDays - e.offDays) > 0 ? (
                    <DayCountBadge count={Math.max(0, elapsedDays - e.workDays - e.offDays)} tone="missing" />
                  ) : (
                    <span className="text-xs font-semibold text-emerald-700">✓ كامل</span>
                  )}
                </td>
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
