import { useEffect, useState } from "react";
import KpiCard from "./KpiCard";
import Modal from "./Modal";
import MonthPicker from "./equipment/MonthPicker";
import { dashboardApi } from "../api/client";
import { DashboardPeriod, DashboardPeriods as Periods } from "../api/types";
import { currentMonthKey, monthLabel } from "../utils/months";
import { formatEGP } from "../utils/format";
import { person } from "../person";

type Detail = { title: string; items: { label: string; amount: number }[]; total: number } | null;

// الرئيسية: أرقام الشهر الأول، وتحتها خط، وبعدين نفس الأرقام من أول السنة.
// كل مربع بتدوس عليه بيطلّع تفاصيله.
export default function DashboardPeriods() {
  const [month, setMonth] = useState(currentMonthKey());
  const [data, setData] = useState<Periods | null>(null);
  const [detail, setDetail] = useState<Detail>(null);

  useEffect(() => {
    setData(null);
    dashboardApi.period(month).then(setData);
  }, [month]);

  if (!data) return <div className="text-sm text-slate-400">جاري التحميل...</div>;
  const year = month.slice(0, 4);
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-extrabold text-slate-800">شهر {monthLabel(month)} {year}</h2>
        <MonthPicker month={month} onChange={setMonth} />
      </div>
      <Period p={data.monthly} tag="m" sub={`شهر ${monthLabel(month)}`} onDetail={setDetail} />

      <div className="flex items-center gap-3 pt-2">
        <div className="h-px flex-1 bg-slate-300" />
        <h2 className="text-lg font-extrabold text-slate-800">سنة {year} — من يناير لحد {monthLabel(month)}</h2>
        <div className="h-px flex-1 bg-slate-300" />
      </div>
      <Period p={data.yearly} tag="y" sub={`من أول ${year}`} onDetail={setDetail} />

      {detail && (
        <Modal title={detail.title} onClose={() => setDetail(null)}>
          {detail.items.length === 0 ? (
            <div className="text-sm text-slate-400">مفيش حاجة.</div>
          ) : (
            <table className="w-full text-sm">
              <tbody>
                {detail.items.map((x) => (
                  <tr key={x.label} className="border-b border-slate-100">
                    <td className="py-2 font-semibold text-slate-700">{x.label}</td>
                    <td className={`py-2 text-end font-bold ${x.amount < 0 ? "text-rose-600" : "text-slate-900"}`}>{formatEGP(x.amount)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td className="pt-3 font-extrabold">الإجمالي</td>
                  <td className="pt-3 text-end font-extrabold">{formatEGP(detail.total)}</td>
                </tr>
              </tfoot>
            </table>
          )}
        </Modal>
      )}
    </div>
  );
}

function Period({ p, tag, sub, onDetail }: { p: DashboardPeriod; tag: string; sub: string; onDetail: (d: Detail) => void }) {
  const open = (title: string, items: { label: string; amount: number }[], total: number) => onDetail({ title: `${title} — ${sub}`, items, total });
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
      <KpiCard
        privacyId={`${tag}-eq`}
        label="عدد المعدات"
        value={p.equipmentCount.toLocaleString("en-US")}
        icon="equipment"
        sub={`${p.working.toLocaleString("en-US")} اشتغلت — ${sub}`}
      />
      <KpiCard
        privacyId={`${tag}-gross`}
        label="الدخل (قبل الكوميشن)"
        value={formatEGP(p.gross)}
        icon="trendUp"
        tone="positive"
        sub="المعدات اشتغلت بكام توتال"
        onClick={() =>
          open(
            "الدخل",
            [
              { label: "اللي المعدات اشتغلت بيه (توتال)", amount: p.gross },
              { label: `− كوميشن ${person()}`, amount: -p.commission },
              { label: "= دخل الشركة بعد الكوميشن", amount: p.companyIncome },
            ],
            p.companyIncome,
          )
        }
      />
      <KpiCard
        privacyId={`${tag}-exp`}
        label="المصروفات"
        value={formatEGP(p.expenses.total)}
        icon="treasury"
        sub="مصاريف المعدات ومرتبات السواقين"
        onClick={() => open("المصروفات", p.expenses.items, p.expenses.total)}
      />
      <KpiCard
        privacyId={`${tag}-net`}
        label="صافي الربح"
        value={formatEGP(p.net.total)}
        icon={p.net.total >= 0 ? "trendUp" : "trendDown"}
        tone={p.net.total >= 0 ? "positive" : "negative"}
        sub="بعد الكوميشن والمصروفات — بالمعدة"
        onClick={() => open("صافي الربح", p.net.items, p.net.total)}
      />
      {p.dues.map((d) => (
        <KpiCard
          key={d.key}
          privacyId={`${tag}-${d.key}`}
          label={d.label}
          value={formatEGP(d.amount)}
          icon={d.key === "company" ? "contractors" : d.key === "partners" ? "partners" : d.key === "drivers" ? "salaries" : "suppliers"}
          sub="لسه متدفعش"
          onClick={() => open(d.label, d.items, d.amount)}
        />
      ))}
    </div>
  );
}
