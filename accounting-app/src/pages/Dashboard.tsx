import { useEffect, useState } from "react";
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
import Modal from "../components/Modal";
import { useTheme } from "../theme";
import { contractorsDashboardApi, dashboardApi, partnersDashboardApi, suppliersApi } from "../api/client";
import { ContractorSummary, DashboardSummary, PartnerSummary, SupplierDashboardRow } from "../api/types";
import { formatEGP } from "../utils/format";

type DrilldownKind = "expense" | "contractors" | "partners" | "suppliers" | null;

export default function Dashboard() {
  const { theme } = useTheme();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [drilldown, setDrilldown] = useState<DrilldownKind>(null);
  const [contractorRows, setContractorRows] = useState<ContractorSummary[] | null>(null);
  const [partnerRows, setPartnerRows] = useState<PartnerSummary[] | null>(null);
  const [supplierRows, setSupplierRows] = useState<SupplierDashboardRow[] | null>(null);

  useEffect(() => {
    dashboardApi.summary().then(setSummary);
  }, []);

  function openDrilldown(kind: DrilldownKind) {
    setDrilldown(kind);
    if (kind === "contractors" && !contractorRows) contractorsDashboardApi.summary().then(setContractorRows);
    if (kind === "partners" && !partnerRows) partnersDashboardApi.summary().then(setPartnerRows);
    if (kind === "suppliers" && !supplierRows) suppliersApi.dashboard().then(setSupplierRows);
  }

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900">لوحة التحكم الرئيسية</h1>
        <p className="text-sm text-slate-500 mt-1">نظرة عامة على أداء الشركة — أرقام حية من بيانات النظام الفعلية</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        <KpiCard
          label="صافي الربح السنوي"
          value={formatEGP(summary.totalAnnualProfit)}
          icon={summary.totalAnnualProfit >= 0 ? "trendUp" : "trendDown"}
          tone={summary.totalAnnualProfit >= 0 ? "positive" : "negative"}
          sub="إجمالي كل المعدات — السنة الحالية"
        />
        <KpiCard
          label="عدد المعدات"
          value={summary.equipmentCount.toLocaleString("en-US")}
          icon="equipment"
          tone="neutral"
          sub="معدات مسجلة في النظام"
        />
        <KpiCard
          label="إجمالي المصروف السنوي"
          value={formatEGP(summary.totalAnnualExpense)}
          icon="treasury"
          tone="neutral"
          sub="كل بنود مصاريف المعدات"
          onClick={() => openDrilldown("expense")}
        />
        <KpiCard
          label={`صافي ربح شهر ${summary.currentMonthLabel}`}
          value={formatEGP(summary.currentMonthProfit)}
          icon={summary.currentMonthProfit >= 0 ? "trendUp" : "trendDown"}
          tone={summary.currentMonthProfit >= 0 ? "positive" : "negative"}
          sub="أحدث شهر مسجّل"
        />
        <KpiCard
          label="مستحق للشركة"
          value={formatEGP(summary.totalReceivables)}
          icon="contractors"
          tone="neutral"
          sub="فلوس على المقاولين لحد النهاردة"
          onClick={() => openDrilldown("contractors")}
        />
        <KpiCard
          label="مستحق للشركاء"
          value={formatEGP(summary.totalPartnersDue)}
          icon="partners"
          tone="neutral"
          sub="نصيب الشركاء من الأرباح لحد النهاردة"
          onClick={() => openDrilldown("partners")}
        />
        <KpiCard
          label="مستحق للموردين"
          value={formatEGP(summary.totalSuppliersDue)}
          icon="suppliers"
          tone="neutral"
          sub="مشتريات من الموردين لسه ما اتدفعتش"
          onClick={() => openDrilldown("suppliers")}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
        <div className="xl:col-span-3 bg-white rounded-card shadow-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-slate-800">اتجاه صافي الربح الشهري</h2>
            <span className="text-xs text-slate-400">السنة الحالية</span>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={summary.monthlyProfitTrend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
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
              data={summary.equipmentExpenses}
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
              {summary.equipmentExpenses.map((eq) => (
                <tr key={eq.name} className="border-b border-slate-50 last:border-0">
                  <td className="py-2.5 font-semibold text-slate-700">{eq.name}</td>
                  <td className="py-2.5 text-slate-500">{formatEGP(eq.annualExpense)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {drilldown === "expense" && (
        <Modal title="مصروف كل معدة (سنويًا)" onClose={() => setDrilldown(null)}>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-400 border-b border-slate-100">
                <th className="text-start font-semibold py-2">المعدة</th>
                <th className="text-start font-semibold py-2">المصروف السنوي</th>
              </tr>
            </thead>
            <tbody>
              {summary.equipmentExpenses.map((eq) => (
                <tr key={eq.name} className="border-b border-slate-50 last:border-0">
                  <td className="py-2.5 font-semibold text-slate-700">{eq.name}</td>
                  <td className="py-2.5 text-slate-500">{formatEGP(eq.annualExpense)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Modal>
      )}

      {drilldown === "contractors" && (
        <Modal title="المستحق من كل مقاول" onClose={() => setDrilldown(null)}>
          {!contractorRows ? (
            <div className="text-sm text-slate-400">جاري التحميل...</div>
          ) : contractorRows.length === 0 ? (
            <div className="text-sm text-slate-400">لسه مفيش مقاولين مسجلين.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-400 border-b border-slate-100">
                  <th className="text-start font-semibold py-2">المقاول</th>
                  <th className="text-start font-semibold py-2">عليه</th>
                  <th className="text-start font-semibold py-2">دفع</th>
                  <th className="text-start font-semibold py-2">الباقي</th>
                </tr>
              </thead>
              <tbody>
                {contractorRows.map((c) => (
                  <tr key={c.id} className="border-b border-slate-50 last:border-0">
                    <td className="py-2.5 font-semibold text-slate-700">{c.name}</td>
                    <td className="py-2.5 text-slate-500">{formatEGP(c.totalWork)}</td>
                    <td className="py-2.5 text-slate-500">{formatEGP(c.totalPaid)}</td>
                    <td className="py-2.5 font-semibold text-primary-dark">{formatEGP(c.remaining)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Modal>
      )}

      {drilldown === "partners" && (
        <Modal title="المستحق لكل شريك" onClose={() => setDrilldown(null)}>
          {!partnerRows ? (
            <div className="text-sm text-slate-400">جاري التحميل...</div>
          ) : partnerRows.length === 0 ? (
            <div className="text-sm text-slate-400">لسه مفيش شركاء مسجلين.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-400 border-b border-slate-100">
                  <th className="text-start font-semibold py-2">الشريك</th>
                  <th className="text-start font-semibold py-2">له</th>
                  <th className="text-start font-semibold py-2">اتدفع له</th>
                  <th className="text-start font-semibold py-2">الباقي</th>
                </tr>
              </thead>
              <tbody>
                {partnerRows.map((p) => (
                  <tr key={p.id} className="border-b border-slate-50 last:border-0">
                    <td className="py-2.5 font-semibold text-slate-700">{p.name}</td>
                    <td className="py-2.5 text-slate-500">{formatEGP(p.totalDue)}</td>
                    <td className="py-2.5 text-slate-500">{formatEGP(p.totalPaid)}</td>
                    <td className="py-2.5 font-semibold text-primary-dark">{formatEGP(p.remaining)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Modal>
      )}

      {drilldown === "suppliers" && (
        <Modal title="المستحق لكل مورد" onClose={() => setDrilldown(null)}>
          {!supplierRows ? (
            <div className="text-sm text-slate-400">جاري التحميل...</div>
          ) : supplierRows.length === 0 ? (
            <div className="text-sm text-slate-400">لسه مفيش موردين مسجلين.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-400 border-b border-slate-100">
                  <th className="text-start font-semibold py-2">المورد</th>
                  <th className="text-start font-semibold py-2">المشتريات</th>
                  <th className="text-start font-semibold py-2">اتدفع</th>
                  <th className="text-start font-semibold py-2">الباقي</th>
                </tr>
              </thead>
              <tbody>
                {supplierRows.map((s) => (
                  <tr key={s.id} className="border-b border-slate-50 last:border-0">
                    <td className="py-2.5 font-semibold text-slate-700">{s.name}</td>
                    <td className="py-2.5 text-slate-500">{formatEGP(s.totalPurchases)}</td>
                    <td className="py-2.5 text-slate-500">{formatEGP(s.totalPaid)}</td>
                    <td className="py-2.5 font-semibold text-primary-dark">{formatEGP(s.remaining)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Modal>
      )}
    </div>
  );
}
