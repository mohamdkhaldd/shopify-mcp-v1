import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import KpiCard from "../components/KpiCard";
import { useTheme } from "../theme";
import {
  currentMonthLabel,
  currentMonthProfit,
  equipmentCount,
  equipmentExpenses,
  monthlyProfitTrend,
  totalAnnualExpense,
  totalAnnualProfit,
  totalPayables,
  totalReceivables,
} from "../data/dashboardData";
import { formatEGP } from "../utils/format";

export default function Dashboard() {
  const { theme } = useTheme();
  const gridStroke = theme === "dark" ? "#243057" : "#EEF2F0";
  const tickFill = theme === "dark" ? "#94A0C9" : "#64748B";
  const categoryTickFill = theme === "dark" ? "#D7DDF3" : "#334155";
  const tooltipStyle =
    theme === "dark"
      ? { direction: "rtl" as const, fontFamily: "Cairo", borderRadius: 12, border: "1px solid #2B3A63", background: "#121B3A", color: "#E7ECFB" }
      : { direction: "rtl" as const, fontFamily: "Cairo", borderRadius: 12, border: "1px solid #E2E8F0" };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900">لوحة التحكم الرئيسية</h1>
        <p className="text-sm text-slate-500 mt-1">
          نظرة عامة على أداء الشركة — الأرقام مأخوذة من ملف الإكسيل الحالي كنقطة بداية
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        <KpiCard
          label="صافي الربح السنوي"
          value={formatEGP(totalAnnualProfit)}
          icon={totalAnnualProfit >= 0 ? "trendUp" : "trendDown"}
          tone={totalAnnualProfit >= 0 ? "positive" : "negative"}
          sub="إجمالي كل المعدات — السنة الحالية"
        />
        <KpiCard
          label="عدد المعدات"
          value={equipmentCount.toLocaleString("en-US")}
          icon="equipment"
          tone="neutral"
          sub="معدات مسجلة في النظام"
        />
        <KpiCard
          label="إجمالي المصروف السنوي"
          value={formatEGP(totalAnnualExpense)}
          icon="treasury"
          tone="neutral"
          sub="كل بنود مصاريف المعدات"
        />
        <KpiCard
          label={`صافي ربح شهر ${currentMonthLabel}`}
          value={formatEGP(currentMonthProfit)}
          icon={currentMonthProfit >= 0 ? "trendUp" : "trendDown"}
          tone={currentMonthProfit >= 0 ? "positive" : "negative"}
          sub="أحدث شهر مسجّل"
        />
        <KpiCard
          label="مستحق للشركة"
          value={formatEGP(totalReceivables)}
          icon="partners"
          tone="neutral"
          sub="فلوس على المقاولين وغيرهم لحد النهاردة"
        />
        <KpiCard
          label="مستحق على الشركة"
          value={formatEGP(totalPayables)}
          icon="suppliers"
          tone="neutral"
          sub="فلوس للشركاء والموردين وغيرهم لحد النهاردة"
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
        <div className="xl:col-span-3 bg-white rounded-card shadow-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-slate-800">اتجاه صافي الربح الشهري</h2>
            <span className="text-xs text-slate-400">السنة الحالية</span>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={monthlyProfitTrend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="profitFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2F8F63" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#2F8F63" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridStroke} />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: tickFill }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: tickFill }} axisLine={false} tickLine={false} width={70} />
              <Tooltip formatter={(value: number) => formatEGP(value)} contentStyle={tooltipStyle} />
              <Area
                type="monotone"
                dataKey="profit"
                stroke="#2F8F63"
                strokeWidth={2.5}
                fill="url(#profitFill)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="xl:col-span-2 bg-white rounded-card shadow-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-slate-800">مصروف كل معدة (سنويًا)</h2>
          </div>
          <ResponsiveContainer width="100%" height={340}>
            <BarChart
              data={equipmentExpenses}
              layout="vertical"
              margin={{ top: 0, right: 10, left: 0, bottom: 0 }}
              barCategoryGap={10}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={gridStroke} />
              <XAxis type="number" tick={{ fontSize: 11, fill: tickFill }} axisLine={false} tickLine={false} />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fontSize: 10, fill: categoryTickFill }}
                axisLine={false}
                tickLine={false}
                width={110}
                interval={0}
              />
              <Tooltip formatter={(value: number) => formatEGP(value)} contentStyle={tooltipStyle} />
              <Bar dataKey="annualExpense" fill="#2F8F63" radius={[0, 6, 6, 0]} barSize={14} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white rounded-card shadow-card p-5">
        <h2 className="font-bold text-slate-800 mb-4">قائمة المعدات</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-400 border-b border-slate-100">
                <th className="text-start font-semibold py-2">المعدة</th>
                <th className="text-start font-semibold py-2">المصروف السنوي</th>
              </tr>
            </thead>
            <tbody>
              {equipmentExpenses.map((eq) => (
                <tr key={eq.name} className="border-b border-slate-50 last:border-0">
                  <td className="py-2.5 font-semibold text-slate-700">{eq.name}</td>
                  <td className="py-2.5 text-slate-500">{formatEGP(eq.annualExpense)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
