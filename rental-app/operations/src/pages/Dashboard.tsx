import { useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import DayCountBadge from "../components/DayCountBadge";
import EquipmentTick from "../components/EquipmentTick";
import { Blurrable, EyeAllButton, PrivacyProvider } from "../components/Privacy";
import DashboardAlerts from "../components/DashboardAlerts";
import DashboardPeriods from "../components/DashboardPeriods";
import { useTheme } from "../theme";
import { dashboardApi } from "../api/client";
import { DashboardSummary } from "../api/types";
import { formatEGP } from "../utils/format";
import { SectionId } from "../nav";

export default function Dashboard({ onNavigate }: { onNavigate?: (id: SectionId) => void }) {
  const { theme } = useTheme();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);


  useEffect(() => {
    dashboardApi.summary().then(setSummary);
  }, []);


  const gridStroke = theme === "dark" ? "#243057" : "#EEF2F0";
  const tickFill = theme === "dark" ? "#94A0C9" : "#64748B";
  const categoryTickFill = theme === "dark" ? "#D7DDF3" : "#334155";
  const tooltipStyle =
    theme === "dark"
      ? { direction: "rtl" as const, fontFamily: "Cairo", borderRadius: 12, border: "1px solid #2B3A63", background: "#121B3A", color: "#E7ECFB" }
      : { direction: "rtl" as const, fontFamily: "Cairo", borderRadius: 12, border: "1px solid #E2E8F0" };

  if (!summary) {
    return <div className="text-sm text-slate-400">جاري التحميل...</div>;
  }

  const equipmentChartHeight = Math.max(240, summary.equipmentExpenses.length * 38);

  return (
    <PrivacyProvider>
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">لوحة التحكم الرئيسية</h1>
          <p className="text-sm text-slate-500 mt-1">نظرة عامة على أداء الشركة — أرقام حية من بيانات النظام الفعلية</p>
        </div>
        <EyeAllButton />
      </div>

      <DashboardAlerts onNavigate={onNavigate} />

      <DashboardPeriods />

      <Blurrable id="sec142" className="bg-white rounded-card shadow-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-slate-800">اتجاه صافي الربح الشهري</h2>
          <span className="text-xs text-slate-400">السنة الحالية</span>
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={summary.monthlyProfitTrend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="profitFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#1D4E89" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#1D4E89" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridStroke} />
            <XAxis dataKey="month" tick={{ fontSize: 12, fill: tickFill }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 12, fill: tickFill }} axisLine={false} tickLine={false} width={70} />
            <Tooltip formatter={(value: number) => formatEGP(value)} contentStyle={tooltipStyle} />
            <Area type="monotone" dataKey="profit" stroke="#1D4E89" strokeWidth={2.5} fill="url(#profitFill)" />
          </AreaChart>
        </ResponsiveContainer>
      </Blurrable>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Blurrable id="sec165" className="bg-white rounded-card shadow-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-slate-800">مصروف كل معدة (سنويًا)</h2>
          </div>
          <ResponsiveContainer width="100%" height={equipmentChartHeight}>
            <BarChart data={summary.equipmentExpenses} layout="vertical" margin={{ top: 0, right: 10, left: 0, bottom: 0 }} barCategoryGap={10}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={gridStroke} />
              <XAxis type="number" tick={{ fontSize: 11, fill: tickFill }} axisLine={false} tickLine={false} />
              <YAxis
                type="category"
                dataKey="name"
                tick={<EquipmentTick fill={categoryTickFill} />}
                axisLine={false}
                tickLine={false}
                width={120}
                interval={0}
              />
              <Tooltip formatter={(value: number) => [formatEGP(value), "المصروف"]} contentStyle={tooltipStyle} />
              <Bar dataKey="annualExpense" fill="#C2853A" radius={[0, 6, 6, 0]} barSize={14} />
            </BarChart>
          </ResponsiveContainer>
        </Blurrable>

        <Blurrable id="sec188" className="bg-white rounded-card shadow-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-slate-800">صافي ربح كل معدة (سنويًا)</h2>
            <span className="text-xs text-slate-400">الدخل − المصروف</span>
          </div>
          <ResponsiveContainer width="100%" height={equipmentChartHeight}>
            <BarChart data={summary.equipmentExpenses} layout="vertical" margin={{ top: 0, right: 10, left: 0, bottom: 0 }} barCategoryGap={10}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={gridStroke} />
              <XAxis type="number" tick={{ fontSize: 11, fill: tickFill }} axisLine={false} tickLine={false} />
              <YAxis
                type="category"
                dataKey="name"
                tick={<EquipmentTick fill={categoryTickFill} />}
                axisLine={false}
                tickLine={false}
                width={120}
                interval={0}
              />
              <ReferenceLine x={0} stroke={tickFill} strokeOpacity={0.5} />
              <Tooltip formatter={(value: number) => [formatEGP(value), "صافي الربح"]} contentStyle={tooltipStyle} />
              <Bar dataKey="annualProfit" radius={[0, 6, 6, 0]} barSize={14}>
                {summary.equipmentExpenses.map((eq) => (
                  <Cell key={eq.name} fill={eq.annualProfit >= 0 ? "#2F8F63" : "#E11D48"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Blurrable>
      </div>

      <Blurrable id="sec218" className="bg-white rounded-card shadow-card p-5">
        <h2 className="font-bold text-slate-800 mb-4">قائمة المعدات</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-400 border-b border-slate-100">
                <th className="text-start font-semibold py-2">المعدة</th>
                <th className="text-start font-semibold py-2">الدخل السنوي</th>
                <th className="text-start font-semibold py-2">المصروف السنوي</th>
                <th className="text-start font-semibold py-2">صافي الربح</th>
                <th className="text-start font-semibold py-2">أيام الشغل</th>
                <th className="text-start font-semibold py-2">أيام الإجازة</th>
              </tr>
            </thead>
            <tbody>
              {summary.equipmentExpenses.map((eq) => (
                <tr key={eq.name} className="border-b border-slate-50 last:border-0">
                  <td className="py-2.5 font-semibold text-slate-700">{eq.name}</td>
                  <td className="py-2.5 text-slate-500">{formatEGP(eq.annualIncome)}</td>
                  <td className="py-2.5 text-slate-500">{formatEGP(eq.annualExpense)}</td>
                  <td className={["py-2.5 font-semibold", eq.annualProfit >= 0 ? "text-primary-dark" : "text-rose-600"].join(" ")}>
                    {formatEGP(eq.annualProfit)}
                  </td>
                  <td className="py-2.5">
                    <DayCountBadge count={eq.workDays} tone="work" />
                  </td>
                  <td className="py-2.5">
                    <DayCountBadge count={eq.offDays} tone="off" />
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-slate-100">
                <td className="pt-3 font-bold text-slate-700">الإجمالي</td>
                <td className="pt-3 font-bold text-slate-600">
                  {formatEGP(summary.equipmentExpenses.reduce((sum, eq) => sum + eq.annualIncome, 0))}
                </td>
                <td className="pt-3 font-bold text-slate-600">
                  {formatEGP(summary.equipmentExpenses.reduce((sum, eq) => sum + eq.annualExpense, 0))}
                </td>
                <td className="pt-3 font-bold text-primary-dark">
                  {formatEGP(summary.equipmentExpenses.reduce((sum, eq) => sum + eq.annualProfit, 0))}
                </td>
                <td className="pt-3">
                  <DayCountBadge count={summary.equipmentExpenses.reduce((sum, eq) => sum + eq.workDays, 0)} tone="work" />
                </td>
                <td className="pt-3">
                  <DayCountBadge count={summary.equipmentExpenses.reduce((sum, eq) => sum + eq.offDays, 0)} tone="off" />
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Blurrable>

    </div>
    </PrivacyProvider>
  );
}
