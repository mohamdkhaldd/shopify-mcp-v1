import { useEffect, useState } from "react";
import { api, DashboardView } from "../api/client";
import { Code, ErrorBox, Kpi, Loading, Money, Note, PageHeader, Panel, Pill } from "../components/ui";
import { PrintButtons, PrintHeader } from "../components/Print";
import { monthLabel, percentFromBp, pounds, unitLabel } from "../utils/format";
import type { SectionId } from "../nav";

// One scale (0 → the client amount) for every bar on the ladder.
function Rung({ label, valuePt, fromPt, scalePt, color, tone, total }: { label: string; valuePt: number; fromPt: number; scalePt: number; color: string; tone?: string; total?: boolean }) {
  const pct = (x: number) => (scalePt > 0 ? Math.max(0, Math.min(100, (x / scalePt) * 100)) : 0);
  return (
    <div className={`grid items-center gap-2.5 grid-cols-[150px_minmax(0,1fr)_100px] ${total ? "border-t border-dashed border-line pt-2" : ""}`}>
      <span className="font-semibold">{total ? <b>{label}</b> : label}</span>
      <span className="relative h-3.5 rounded-[3px] bg-surface-2 overflow-hidden">
        <i className="absolute top-0 bottom-0 rounded-[3px]" style={{ insetInlineStart: `${pct(fromPt)}%`, width: `${pct(Math.abs(valuePt))}%`, background: color }} />
      </span>
      <span className={`text-end font-extrabold num ${tone ?? ""}`}>{pounds(valuePt)}</span>
    </div>
  );
}

function Ladder({ v }: { v: DashboardView }) {
  const l = v.ladder;
  const s = l.clientBasePt;
  const afterTax5 = l.marginPt - l.tax5Pt;
  return (
    <Panel title="من فاتورة العميل لحد التوزيع" hint={`${monthLabel(v.month)} · كل العقود`}>
      {s === 0 ? (
        <div className="px-4 py-8 text-center text-muted">مفيش سركي متسجل في الشهر ده لسه.</div>
      ) : (
        <div className="px-4 py-3.5 grid gap-2">
          <Rung label="المستحق من العملاء" valuePt={s} fromPt={0} scalePt={s} color="rgb(var(--fg) / 0.85)" />
          <Rung label="− المستحق للموردين" valuePt={l.supplierCostPt} fromPt={s - l.supplierCostPt} scalePt={s} color="rgb(var(--out))" tone="text-out" />
          <Rung label="= الهامش" valuePt={l.marginPt} fromPt={0} scalePt={s} color="rgb(var(--amber))" />
          <Rung label="− ٥٪ من الهامش" valuePt={l.tax5Pt} fromPt={afterTax5} scalePt={s} color="rgb(var(--tax))" tone="text-tax" />
          <Rung label="− المصروفات" valuePt={l.expensesPt} fromPt={afterTax5 - l.expensesPt} scalePt={s} color="rgb(var(--out))" tone="text-out" />
          {l.carryInPt > 0 && <Rung label="− خسارة متراحلة" valuePt={l.carryInPt} fromPt={l.netPt - l.carryInPt} scalePt={s} color="rgb(var(--out))" tone="text-out" />}
          <Rung label="= صافي الربح" valuePt={l.netPt - l.carryInPt} fromPt={0} scalePt={s} color="rgb(var(--in))" tone="text-in" total />
          <Rung label={`الإدارة ${percentFromBp(l.managementBp)}`} valuePt={l.managementPt} fromPt={0} scalePt={s} color="rgb(var(--muted))" />
          <Rung label={`المستثمرين ${percentFromBp(l.investorsBp)}`} valuePt={l.investorsPt} fromPt={0} scalePt={s} color="rgb(var(--amber))" />
        </div>
      )}
      <Note>ضريبة القيمة المضافة ({pounds(l.vatPt)}) مش داخلة هنا خالص — دي أمانة للضرايب، مش إيراد.</Note>
    </Panel>
  );
}

function TreasurySplit({ v }: { v: DashboardView }) {
  const t = v.treasury;
  const total = Math.max(1, Math.max(0, t.availablePt) + t.taxHeldPt + t.profitsDuePt);
  const w = (x: number) => `${(Math.max(0, x) / total) * 100}%`;
  const rows = [
    { label: "المتاح للتشغيل", pt: t.availablePt, color: "rgb(var(--in))" },
    { label: "فلوس ضرايب (مش بتاعتنا)", pt: t.taxHeldPt, color: "rgb(var(--tax))" },
    { label: "أرباح مستحقة الصرف", pt: t.profitsDuePt, color: "rgb(var(--amber))" },
  ];
  return (
    <Panel title="الخزنة متقسمة إزاي" hint={<Money pt={pounds(t.balancePt)} />}>
      <div className="px-4 py-3.5">
        <div className="flex h-[22px] rounded-md overflow-hidden bg-surface-2" role="img" aria-label="تقسيم الخزنة">
          {rows.map((r) => (
            <i key={r.label} className="block h-full" style={{ width: w(r.pt), background: r.color }} />
          ))}
        </div>
        <div className="grid gap-2 mt-3">
          {rows.map((r) => (
            <div key={r.label} className="flex items-center justify-between gap-2">
              <span>
                <span className="inline-block w-3 h-3 rounded-[3px] me-2 align-[-1px]" style={{ background: r.color }} />
                {r.label}
              </span>
              <b className={`num ${r.pt < 0 ? "text-out" : ""}`}>{pounds(r.pt)}</b>
            </div>
          ))}
        </div>
      </div>
      <Note>
        رأس مال المستثمرين {pounds(v.capital.totalPt)} — منه {pounds(v.capital.deployedPt)} شغال عند الموردين ولسه متحصّلش من العملاء.
      </Note>
    </Panel>
  );
}

export default function Dashboard({ onNavigate }: { onNavigate: (id: SectionId) => void }) {
  const [month, setMonth] = useState<string | undefined>(undefined);
  const [v, setV] = useState<DashboardView | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.dashboard(month).then(setV, (e) => setError(e.message));
  }, [month]);

  if (error) return <ErrorBox message={error} />;
  if (!v) return <Loading />;
  const k = v.kpis;
  const months = v.months.some((m) => m.month === v.month) ? v.months : [...v.months, { month: v.month, closed: false }];

  return (
    <div className="grid gap-5">
      <PrintHeader title="ملخص الشهر" subtitle={monthLabel(v.month)} />
      <PageHeader title="الرئيسية" subtitle={`ملخص شهر ${monthLabel(v.month)}${v.closed ? " — الشهر ده اتقفل" : ""}`}>
        <select
          aria-label="الشهر"
          value={v.month}
          onChange={(e) => setMonth(e.target.value)}
          className="font-bold border border-line bg-surface text-fg rounded-lg px-2.5 py-1.5"
        >
          {[...months].reverse().map((m) => (
            <option key={m.month} value={m.month}>
              {monthLabel(m.month)}
              {m.closed ? " (مقفول)" : ""}
            </option>
          ))}
        </select>
        <PrintButtons pdfName={`ملخص ${monthLabel(v.month)}`} />
      </PageHeader>

      <div className="grid gap-3.5 grid-cols-3 max-[900px]:grid-cols-2">
        <Kpi tone="hero" label="رصيد الخزنة" value={<Money pt={pounds(k.balancePt)} />} sub={<>المتاح للتشغيل {pounds(k.availablePt)}</>} />
        <Kpi tone="tax" label="فلوس ضرايب في الخزنة" value={<Money pt={pounds(k.taxHeldPt)} />} sub="مش بتاعتنا — ممنوع تتصرف" />
        <Kpi label="مستحق من العملاء" value={<Money pt={pounds(k.receivablesPt)} />} sub={<>من فواتير {pounds(k.invoicedPt)}</>} />
        <Kpi label="علينا للموردين" value={<Money pt={pounds(k.payablesPt)} />} sub={<>بعد خصومات {pounds(k.deductionsPt)}</>} />
        <Kpi label="ربح الشهر" value={<Money pt={pounds(k.monthProfitPt)} />} sub={<>المحصّل منه {pounds(k.monthCollectedProfitPt)}</>} />
        <Kpi label="عقود شغالة" value={k.activeContracts} sub={k.activeContracts === 1 ? "معدة واحدة في الشغل" : `${k.activeContracts} معدات في الشغل`} />
      </div>

      <div className="grid gap-3.5 items-start grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] max-[1050px]:grid-cols-1">
        <Ladder v={v} />
        <TreasurySplit v={v} />
      </div>

      <Panel title="العقود الشغالة" actions={<button className="text-xs font-bold text-amber-deep hover:underline" onClick={() => onNavigate("sarki")}>افتح السركي ←</button>}>
        {v.activeContracts.length === 0 ? (
          <div className="px-4 py-8 text-center text-muted">مفيش عقود شغالة. ابدأ بعقد جديد من صفحة السركي.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>العقد</th>
                  <th>العميل</th>
                  <th>المعدة</th>
                  <th>صاحب المعدة</th>
                  <th className="n">سعر العميل</th>
                  <th className="n">سعر المورد</th>
                  <th className="n">أيام الشهر</th>
                  <th className="n">صافي الشهر</th>
                  <th>الحالة</th>
                </tr>
              </thead>
              <tbody>
                {v.activeContracts.map((c) => (
                  <tr key={c.contractId}>
                    <td>
                      <Code>{c.code}</Code>
                    </td>
                    <td>{c.client}</td>
                    <td>{c.equipment}</td>
                    <td>{c.supplier}</td>
                    <td className="n">
                      {pounds(c.clientRatePt)} / {unitLabel(c.unit)}
                    </td>
                    <td className="n">
                      {pounds(c.supplierRatePt)} / {unitLabel(c.unit)}
                    </td>
                    <td className="n">{c.daysThisMonth}</td>
                    <td className={`n font-bold ${c.netThisMonthPt >= 0 ? "text-in" : "text-out"}`}>{pounds(c.netThisMonthPt)}</td>
                    <td>
                      <Pill tone="in">شغال</Pill>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
