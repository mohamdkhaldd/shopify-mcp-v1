import { useCallback, useEffect, useState } from "react";
import { api, appApi, TreasuryFilters, TreasuryView } from "../../api/client";
import { ErrorBox, Kpi, Loading, Money, Note, PageHeader, Panel, Pill, Button } from "../../components/ui";
import { Labeled, Select, TextInput } from "../../components/Field";
import { PrintButtons, PrintHeader } from "../../components/Print";
import { dateLabel, pounds } from "../../utils/format";

const IN_TYPES = new Set(["investor_deposit", "client_collection"]);

function Bar({ parts }: { parts: { label: string; pt: number; color: string }[] }) {
  const total = Math.max(1, parts.reduce((s, p) => s + Math.max(0, p.pt), 0));
  return (
    <>
      <div className="flex h-[22px] rounded-md overflow-hidden bg-surface-2" role="img">
        {parts.map((p) => (
          <i key={p.label} className="block h-full" style={{ width: `${(Math.max(0, p.pt) / total) * 100}%`, background: p.color }} />
        ))}
      </div>
      <div className="grid gap-2 mt-3">
        {parts.map((p) => (
          <div key={p.label} className="flex items-center justify-between gap-2">
            <span>
              <span className="inline-block w-3 h-3 rounded-[3px] me-2 align-[-1px]" style={{ background: p.color }} />
              {p.label}
            </span>
            <b className={`num ${p.pt < 0 ? "text-out" : ""}`}>{pounds(p.pt)}</b>
          </div>
        ))}
      </div>
    </>
  );
}

export default function Treasury() {
  const [filters, setFilters] = useState<TreasuryFilters>({});
  const [v, setV] = useState<TreasuryView | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    api.treasury(filters).then(setV, (e) => setError(e.message));
  }, [filters]);
  useEffect(load, [load]);

  if (!v) return error ? <ErrorBox message={error} /> : <Loading />;
  const s = v.split;
  const set = (patch: TreasuryFilters) => setFilters((f) => ({ ...f, ...patch }));

  function exportExcel() {
    if (!v) return;
    appApi.exportExcel("حركة الخزنة", [
      {
        title: "حركة الخزنة",
        columns: [
          { header: "التاريخ", key: "date" },
          { header: "النوع", key: "typeLabel", width: 20 },
          { header: "الطرف", key: "party", width: 24 },
          { header: "البيان", key: "note", width: 28 },
          { header: "داخل", key: "inPt", money: true },
          { header: "خارج", key: "outPt", money: true },
          { header: "الرصيد", key: "balancePt", money: true },
        ],
        rows: [...v.rows].reverse().map((r) => ({ date: r.date, typeLabel: r.typeLabel, party: r.party, note: r.note ?? "", inPt: r.inPt || null, outPt: r.outPt || null, balancePt: r.balancePt })),
        totals: { date: "الإجمالي", inPt: v.totals.inPt, outPt: v.totals.outPt },
      },
    ]);
  }

  return (
    <div className="grid gap-5">
      <PrintHeader title="حركة الخزنة" subtitle={filters.from || filters.to ? `${filters.from ? dateLabel(filters.from) : ""} — ${filters.to ? dateLabel(filters.to) : ""}` : undefined} />
      <PageHeader title="الخزنة" subtitle="كل جنيه داخل أو خارج — خزنة واحدة">
        <PrintButtons pdfName="حركة الخزنة" singlePage={false} />
        <Button onClick={exportExcel}>Excel</Button>
      </PageHeader>
      {error && <ErrorBox message={error} />}

      <div className="grid gap-3.5 grid-cols-4 max-[1000px]:grid-cols-2">
        <Kpi tone="hero" label="الرصيد الكلي" value={<Money pt={pounds(s.balancePt)} />} />
        <Kpi tone="tax" label="فلوس ضرايب في الخزنة" value={<Money pt={pounds(s.taxHeldPt)} />} sub="مش بتاعتنا — ممنوع تتدفع منها للموردين" />
        <Kpi label="أرباح مستحقة ومتصرفتش" value={<Money pt={pounds(s.profitsDuePt)} />} sub={`مستثمرين ${pounds(s.investorsDuePt)} · إدارة ${pounds(s.managementDuePt)}`} />
        <Kpi tone={s.availablePt < 0 ? "plain" : "good"} label="المتاح للتشغيل" value={<Money pt={pounds(s.availablePt)} className={s.availablePt < 0 ? "text-out" : ""} />} sub={`${pounds(s.balancePt)} − ${pounds(s.taxHeldPt)} − ${pounds(s.profitsDuePt)}`} />
      </div>

      <div className="grid gap-3.5 items-start grid-cols-2 max-[1000px]:grid-cols-1">
        <Panel title="الخزنة متقسمة إزاي">
          <div className="px-4 py-3.5">
            <Bar
              parts={[
                { label: "المتاح للتشغيل", pt: s.availablePt, color: "rgb(var(--in))" },
                { label: `ضريبة ١٤٪ اتحصّلت (${pounds(s.vatHeldPt)}) + ٥٪ (${pounds(s.tax5HeldPt)})`, pt: s.taxHeldPt, color: "rgb(var(--tax))" },
                { label: "أرباح مستحقة الصرف", pt: s.profitsDuePt, color: "rgb(var(--amber))" },
              ]}
            />
          </div>
          <Note>فلوس الضرايب والأرباح اللي اتحصّلت قاعدين في الخزنة بس مش متاحين — البرنامج بيحذّرك لو أي صرف هيخلّي المتاح بالسالب.</Note>
        </Panel>
        <Panel title="رأس مال المستثمرين">
          <div className="px-4 py-3.5">
            <Bar
              parts={[
                { label: "في الخزنة", pt: v.capital.inTreasuryPt, color: "rgb(var(--in))" },
                { label: "شغال عند الموردين (اتدفع ولسه متحصّلش)", pt: v.capital.deployedPt, color: "rgb(var(--out))" },
              ]}
            />
            <div className="flex justify-between mt-2 pt-2 border-t border-dashed border-line font-extrabold">
              <span>الإجمالي</span>
              <span className="num">{pounds(v.capital.totalPt)}</span>
            </div>
          </div>
        </Panel>
      </div>

      <Panel title="الحركات">
        <div className="no-print flex flex-wrap items-end gap-2.5 px-4 py-3 border-b border-line">
          <Labeled label="من">
            <TextInput type="date" value={filters.from ?? ""} onChange={(e) => set({ from: e.target.value || undefined })} className="w-36" />
          </Labeled>
          <Labeled label="لحد">
            <TextInput type="date" value={filters.to ?? ""} onChange={(e) => set({ to: e.target.value || undefined })} className="w-36" />
          </Labeled>
          <Labeled label="النوع">
            <Select value={filters.type ?? ""} onChange={(e) => set({ type: e.target.value || undefined })}>
              <option value="">كل الأنواع</option>
              {v.types.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.label}
                </option>
              ))}
            </Select>
          </Labeled>
          <Labeled label="الطرف">
            <Select value={filters.party ?? ""} onChange={(e) => set({ party: e.target.value || undefined })}>
              <option value="">كل الأطراف</option>
              {v.parties.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.label}
                </option>
              ))}
            </Select>
          </Labeled>
          {(filters.from || filters.to || filters.type || filters.party) && <Button onClick={() => setFilters({})}>مسح الفلاتر</Button>}
        </div>
        <div className="overflow-x-auto">
          <table className="tbl">
            <thead>
              <tr>
                <th>التاريخ</th>
                <th>النوع</th>
                <th>الطرف</th>
                <th>البيان</th>
                <th className="n">داخل</th>
                <th className="n">خارج</th>
                <th className="n">الرصيد</th>
              </tr>
            </thead>
            <tbody>
              {v.rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center text-muted py-6">
                    مفيش حركات.
                  </td>
                </tr>
              )}
              {v.rows.map((r) => (
                <tr key={r.id} className={r.cancelled ? "text-muted" : ""}>
                  <td>{dateLabel(r.date)}</td>
                  <td>
                    <Pill tone={r.cancelled ? "muted" : IN_TYPES.has(r.type) ? "in" : r.type === "tax_payment" ? "tax" : "out"}>{r.typeLabel}</Pill>
                  </td>
                  <td>{r.party}</td>
                  <td>{r.note ?? ""}</td>
                  <td className="n text-in font-bold">{r.inPt ? pounds(r.inPt) : ""}</td>
                  <td className="n text-out font-bold">{r.outPt ? pounds(r.outPt) : ""}</td>
                  <td className="n">{pounds(r.balancePt)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={4}>{v.totals.count} حركة</td>
                <td className="n">{pounds(v.totals.inPt)}</td>
                <td className="n">{pounds(v.totals.outPt)}</td>
                <td className="n">{pounds(v.totals.inPt - v.totals.outPt)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        <Note>الحركات بتتسجل من صفحاتها (دفعة عميل، دفعة لصاحب معدة، مصروف، إيداع مستثمر…) وبتظهر هنا لوحدها. مفيش حركة بتتمسح من الخزنة غير لما تحذفها من مكانها.</Note>
      </Panel>
    </div>
  );
}
