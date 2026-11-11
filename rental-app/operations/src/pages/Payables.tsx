import { useEffect, useState } from "react";
import MonthPicker from "../components/equipment/MonthPicker";
import PrintButton from "../components/PrintButton";
import { PrintHeader } from "../components/PrintSignoff";
import { payablesApi } from "../api/client";
import CreditorsSection from "./payables/CreditorsSection";
import { PayablesSummary } from "../api/types";
import { currentMonthKey, monthLabel } from "../utils/months";
import { formatEGP } from "../utils/format";

function SummaryBox({ label, value, tone, onClick }: { label: string; value: number; tone?: "rose" | "green"; onClick?: () => void }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      onClick={onClick}
      className={[
        "bg-white rounded-card shadow-card p-5 text-start",
        onClick ? "hover:ring-2 hover:ring-primary/30 transition-shadow" : "",
      ].join(" ")}
    >
      <div className="text-sm text-slate-500 font-semibold">{label}</div>
      <div className={`mt-2 text-2xl font-extrabold ${tone === "rose" ? "text-rose-600" : tone === "green" ? "text-primary" : "text-slate-800"}`}>
        {formatEGP(value)}
      </div>
      {onClick && <div className="no-print text-[11px] text-primary font-semibold mt-1">دوس للتفاصيل</div>}
    </Tag>
  );
}

// نصيب الشريك بالسالب معناه إن المعدة خسرانة في الفترة دي — مش دين علينا.
function PartnerDue({ value }: { value: number }) {
  if (value >= -0.005) return <>{formatEGP(Math.max(0, value))}</>;
  return <span className="text-slate-400 font-normal">0 (خسارة {formatEGP(-value)})</span>;
}

export default function Payables({ onGoToSuppliers }: { onGoToSuppliers: () => void }) {
  const [month, setMonth] = useState(currentMonthKey());
  const [data, setData] = useState<PayablesSummary | null>(null);
  // كشف حساب جهة مفتوح = الطباعة تطلعه هو بس.
  const [soloPrint, setSoloPrint] = useState(false);

  const refresh = () => payablesApi.summary(month).then(setData);

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);


  if (!data) return <div className="text-sm text-slate-400">جاري التحميل...</div>;


  return (
    <div className={`space-y-6${soloPrint ? " print-solo" : ""}`}>
      <PrintHeader title="الرصيد — اللي لينا واللي علينا" subtitle={`${monthLabel(month)} ${month.slice(0, 4)}`} />

      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">الرصيد</h1>
          <p className="text-sm text-slate-500 mt-1">
            اللي لينا عند المقاولين، واللي علينا (الشركاء، الموردين ومصروفات المعدات الآجلة، وأي جهة تانية)، والصافي بينهم.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <PrintButton />
          <MonthPicker month={month} onChange={setMonth} />
        </div>
      </div>

      {/* الصافي = اللي لينا عند الناس − اللي علينا للناس: الفلوس اللي المفروض
          تبقى معانا كأرقام لو الكل دفع اللي عليه واحنا دفعنا اللي علينا. */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SummaryBox label="اللي لينا عند الناس" value={data.receivablesTotal} tone="green" />
        <SummaryBox label="اللي علينا للناس" value={data.totalDue} tone="rose" />
        <div
          className={[
            "rounded-card shadow-card p-5 text-white",
            data.receivablesTotal - data.totalDue >= 0 ? "bg-primary" : "bg-rose-600",
          ].join(" ")}
        >
          <div className="text-sm font-semibold opacity-90">الصافي (لينا − علينا)</div>
          <div className="mt-2 text-2xl font-extrabold">{formatEGP(data.receivablesTotal - data.totalDue)}</div>
          <div className="text-[11px] opacity-80 mt-1">الفلوس اللي المفروض تفضل معانا لو الكل دفع واحنا دفعنا كل اللي علينا</div>
        </div>
      </div>

      <h2 className="font-bold text-slate-700 -mb-2">تفصيل اللي علينا</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <SummaryBox label="باقي مصروفات المعدات (في الموردين)" value={data.expensesDue} onClick={onGoToSuppliers} />
        <SummaryBox label="للشركاء (الإجمالي مع الرصيد الافتتاحي)" value={data.partnersTotalDue} />
        <SummaryBox label="للموردين" value={data.suppliersDue} onClick={onGoToSuppliers} />
        <SummaryBox label="لجهات تانية" value={data.creditorsDue ?? 0} />
      </div>

      <div className="print-solo-keep">
        <CreditorsSection creditorsDue={data.creditorsDue ?? 0} onChanged={refresh} onSoloPrint={setSoloPrint} />
      </div>

      <div className="bg-white rounded-card shadow-card p-5">
        <h2 className="font-bold text-slate-800 mb-4">إجمالي اللي علينا</h2>

        <h3 className="text-sm font-bold text-slate-600 mb-2">للشركاء</h3>
        {data.partners.length === 0 ? (
          <div className="text-sm text-slate-400 mb-5">مفيش حاجة للشركاء.</div>
        ) : (
          <table className="w-full text-sm mb-6">
            <thead>
              <tr className="text-slate-400 border-b border-slate-100">
                <th className="text-start font-semibold py-2">الشريك</th>
                <th className="text-start font-semibold py-2">علينا — {monthLabel(month)}</th>
                <th className="text-start font-semibold py-2">علينا — سنة {month.slice(0, 4)}</th>
                <th className="text-start font-semibold py-2">الرصيد الافتتاحي</th>
                <th className="text-start font-semibold py-2">الإجمالي المستحق له</th>
              </tr>
            </thead>
            <tbody>
              {data.partners.map((p) => (
                <tr key={p.id} className="border-b border-slate-50 last:border-0">
                  <td className="py-2 font-semibold text-slate-700">{p.name}</td>
                  <td className="py-2 font-semibold text-slate-700">
                    <PartnerDue value={p.monthDue} />
                  </td>
                  <td className="py-2 font-semibold text-slate-800">
                    <PartnerDue value={p.yearDue} />
                  </td>
                  <td className="py-2 text-slate-600">{formatEGP(p.openingBalance)}</td>
                  <td className="py-2 font-bold text-rose-600">
                    <PartnerDue value={p.totalDue} />
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-slate-100">
                <td className="pt-2 font-bold text-slate-700">الإجمالي</td>
                <td className="pt-2 font-bold text-slate-700">
                  <PartnerDue value={data.partnersMonthDue} />
                </td>
                <td className="pt-2 font-bold text-slate-800">
                  <PartnerDue value={data.partnersYearDue} />
                </td>
                <td className="pt-2 font-bold text-slate-600">{formatEGP(data.partnersOpening)}</td>
                <td className="pt-2 font-bold text-rose-600">{formatEGP(data.partnersTotalDue)}</td>
              </tr>
            </tfoot>
          </table>
        )}
        <p className="text-[11px] text-slate-400 -mt-4 mb-6">
          الإجمالي المستحق = الرصيد الافتتاحي (فلوس قديمة ليه قبل السيستم) + نصيبه من كل الأرباح من الأول − كل اللي اتدفعله.
        </p>

        <h3 className="text-sm font-bold text-slate-600 mb-2">للموردين</h3>
        <div className="flex items-center justify-between bg-slate-50 rounded-xl px-4 py-3 mb-6 text-sm">
          <span className="text-slate-600">إجمالي المستحق للموردين (التفاصيل في صفحة الموردين)</span>
          <span className="flex items-center gap-3">
            <span className="font-bold text-slate-800">{formatEGP(data.suppliersDue)}</span>
            <button onClick={onGoToSuppliers} className="no-print text-xs font-semibold text-primary hover:text-primary-dark">
              افتح الموردين ←
            </button>
          </span>
        </div>

      </div>

      <div className="bg-white rounded-card shadow-card p-5">
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-bold text-slate-800">لينا عند المقاولين</h2>
          <span className="text-lg font-extrabold text-primary">{formatEGP(data.receivablesTotal)}</span>
        </div>
        <p className="text-xs text-slate-400 mb-4">
          الرصيد الافتتاحي (فلوس قديمة عليهم قبل السيستم) + قيمة كل شغلهم − كل اللي دفعوه.
        </p>
        {data.receivables.length === 0 ? (
          <div className="text-sm text-slate-400">مفيش فلوس لينا عند حد.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-400 border-b border-slate-100">
                <th className="text-start font-semibold py-2">المقاول</th>
                <th className="text-start font-semibold py-2">الرصيد الافتتاحي</th>
                <th className="text-start font-semibold py-2">قيمة الشغل</th>
                <th className="text-start font-semibold py-2">دفع</th>
                <th className="text-start font-semibold py-2">الباقي لينا</th>
              </tr>
            </thead>
            <tbody>
              {data.receivables.map((c) => (
                <tr key={c.id} className="border-b border-slate-50 last:border-0">
                  <td className="py-2 font-semibold text-slate-700">{c.name}</td>
                  <td className="py-2 text-slate-600">{formatEGP(c.openingBalance)}</td>
                  <td className="py-2 text-slate-600">{formatEGP(c.work)}</td>
                  <td className="py-2 text-slate-600">{formatEGP(c.paid)}</td>
                  <td className={`py-2 font-bold ${c.remaining >= 0 ? "text-primary-dark" : "text-rose-600"}`}>
                    {c.remaining >= 0 ? formatEGP(c.remaining) : `دفع زيادة ${formatEGP(-c.remaining)}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

    </div>
  );
}
