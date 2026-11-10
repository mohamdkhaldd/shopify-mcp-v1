import { useCallback, useEffect, useState } from "react";
import { api, Deletable, ManagementView } from "../../api/client";
import { ErrorBox, Kpi, Loading, Money, Note, PageHeader, Panel, Pill } from "../../components/ui";
import { Select } from "../../components/Field";
import { PrintButtons, PrintHeader } from "../../components/Print";
import ConfirmDelete from "../../components/ConfirmDelete";
import { TrashButton } from "../../components/party";
import { ExpenseEntry } from "../management/Management";
import { dateLabel, monthLabel, pounds } from "../../utils/format";

// الهالك: كل مصروفات الشركة في الشهر (على عقد أو عامة، من الخزنة أو من جيب
// شريك). بيتحسب لوحده في صفحة الإدارة (بيتخصم من الربح قبل التوزيع).

export default function Expenses() {
  const [month, setMonth] = useState<string | undefined>();
  const [v, setV] = useState<ManagementView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<{ entity: Deletable; id: number } | null>(null);
  const load = useCallback(() => {
    api.management(month).then(setV, (e) => setError((e as Error).message));
  }, [month]);
  useEffect(load, [load]);

  if (!v) return error ? <ErrorBox message={error} /> : <Loading />;
  const total = v.expenses.reduce((s, x) => s + x.amount_pt, 0);
  const onContracts = v.expenses.filter((x) => x.kind === "contract").reduce((s, x) => s + x.amount_pt, 0);
  const pocket = v.expenses.filter((x) => x.paid_by).reduce((s, x) => s + x.amount_pt, 0);
  const byCategory = [...v.expenses.reduce((m, x) => m.set(x.category ?? "من غير بند", (m.get(x.category ?? "من غير بند") ?? 0) + x.amount_pt), new Map<string, number>())].sort((a, b) => b[1] - a[1]);

  return (
    <div className="grid gap-5">
      <PrintHeader title="الهالك" subtitle={monthLabel(v.month)} />
      <PageHeader title="الهالك" subtitle={`مصروفات الشركة في ${monthLabel(v.month)} — بتتخصم من الربح في صفحة الإدارة`}>
        <Select aria-label="الشهر" value={v.month} onChange={(e) => setMonth(e.target.value)}>
          {[...v.months].reverse().map((m) => (
            <option key={m.month} value={m.month}>
              {monthLabel(m.month)}
              {m.closed ? " (مقفول)" : ""}
            </option>
          ))}
        </Select>
        <PrintButtons pdfName={`الهالك ${monthLabel(v.month)}`} singlePage={false} />
      </PageHeader>
      {error && <ErrorBox message={error} />}

      <div className="grid gap-3.5 grid-cols-4 max-[1000px]:grid-cols-2">
        <Kpi tone="hero" label="إجمالي الهالك" value={<Money pt={pounds(total)} />} />
        <Kpi label="على العقود" value={<Money pt={pounds(onContracts)} />} />
        <Kpi label="عامة للشركة" value={<Money pt={pounds(total - onContracts)} />} />
        <Kpi label="من جيب الشركاء" value={<Money pt={pounds(pocket)} />} />
      </div>

      <Panel title={`مصروفات ${monthLabel(v.month)}`}>
        {!v.closed && <ExpenseEntry key={v.month} v={v} onSaved={load} />}
        <div className="overflow-x-auto">
          <table className="tbl">
            <thead>
              <tr>
                <th>التاريخ</th>
                <th>النوع</th>
                <th>البند</th>
                <th>البيان</th>
                <th className="n">المبلغ</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {v.expenses.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center text-muted py-6">
                    مفيش مصروفات في الشهر ده.
                  </td>
                </tr>
              )}
              {v.expenses.map((x) => (
                <tr key={x.id}>
                  <td>{dateLabel(x.date)}</td>
                  <td>{x.kind === "contract" ? <Pill tone="amber">عقد {x.code}</Pill> : <Pill>عام</Pill>}</td>
                  <td>{x.category ?? "—"}</td>
                  <td>{x.note ?? ""}</td>
                  <td className="n font-bold text-out">{pounds(x.amount_pt)}</td>
                  <td className="text-end">{!v.closed && <TrashButton title="حذف المصروف" onClick={() => setDeleting({ entity: "expenses", id: x.id })} />}</td>
                </tr>
              ))}
            </tbody>
            {v.expenses.length > 0 && (
              <tfoot>
                <tr>
                  <td colSpan={4}>الإجمالي</td>
                  <td className="n">{pounds(total)}</td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        <Note>مصروف العقد بيتخصم من ربح العقد ده. المصروف العام بيتخصم من ربح الشهر كله قبل التوزيع. «من جيبه» = شريك دفعه من فلوسه، ومبيطلعش من الخزنة.</Note>
      </Panel>

      {byCategory.length > 1 && (
        <Panel title="حسب البند">
          <table className="tbl">
            <tbody>
              {byCategory.map(([name, pt]) => (
                <tr key={name}>
                  <td className="font-bold">{name}</td>
                  <td className="n">{pounds(pt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      )}

      {deleting && <ConfirmDelete entity={deleting.entity} id={deleting.id} onClose={() => setDeleting(null)} onDeleted={load} />}
    </div>
  );
}
