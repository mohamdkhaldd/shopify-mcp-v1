import { useState } from "react";
import { TaxView } from "../../api/client";
import { Panel } from "../../components/ui";
import { Labeled, Select } from "../../components/Field";
import { PrintButtons, PrintHeader } from "../../components/Print";
import { monthLabel, pounds } from "../../utils/format";

// ورق الإقرارات اللي بيتطبع لوحده: ملخص إقرار الـ ١٤٪ الشهري (الفواتير اللي
// طلعت: لأنهي شركة وبكام والضريبة عليها)، وإقرار الـ ٣٪ السنوي (اشتغلت بكام
// مع كل شركة، واتخصم منك كام تحت بند الأرباح التجارية).

export function VatDeclaration({ v }: { v: TaxView }) {
  const [month, setMonth] = useState(v.vatDeclarations[0]?.month ?? "");
  const d = v.vatDeclarations.find((x) => x.month === month);
  if (!v.vatDeclarations.length) return <Panel title="إقرار ١٤٪ الشهري"><div className="px-4 py-8 text-center text-muted">لسه مفيش فواتير عليها ١٤٪.</div></Panel>;
  const owed = d ? d.vatPt - d.paidPt : 0;
  return (
    <Panel
      title="ملخص إقرار القيمة المضافة ١٤٪"
      actions={
        <div className="no-print flex flex-wrap items-end gap-2">
          <Labeled label="الشهر">
            <Select value={month} onChange={(e) => setMonth(e.target.value)}>
              {v.vatDeclarations.map((x) => (
                <option key={x.month} value={x.month}>
                  {monthLabel(x.month)}
                </option>
              ))}
            </Select>
          </Labeled>
          <PrintButtons pdfName={`إقرار ١٤٪ ${monthLabel(month)}`} />
        </div>
      }
    >
      <PrintHeader title="ملخص إقرار القيمة المضافة ١٤٪" subtitle={monthLabel(month)} />
      {d && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 border-b border-line">
            <Box label="عدد الفواتير">{d.invoices.length}</Box>
            <Box label="قيمة الشغل">{pounds(d.basePt)}</Box>
            <Box label="الضريبة ١٤٪" tone="text-tax">{pounds(d.vatPt)}</Box>
            <Box label={owed > 0 ? "لسه عليك تدفع" : "اتدفعت"} tone={owed > 0 ? "text-out" : "text-in"}>
              {pounds(owed > 0 ? owed : d.paidPt)}
            </Box>
          </div>
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>رقم الفاتورة</th>
                  <th>الشركة</th>
                  <th>الرقم الضريبي</th>
                  <th>المعدة</th>
                  <th className="n">قيمة الشغل</th>
                  <th className="n">١٤٪</th>
                  <th className="n">خصم ٣٪</th>
                  <th className="n">إجمالي الفاتورة</th>
                </tr>
              </thead>
              <tbody>
                {d.invoices.map((i, k) => (
                  <tr key={k}>
                    <td className="num">{i.serial ?? "—"}</td>
                    <td className="font-bold">{i.client}</td>
                    <td className="num">{i.taxId ?? "—"}</td>
                    <td>{i.equipment}</td>
                    <td className="n">{pounds(i.basePt)}</td>
                    <td className="n text-tax">{pounds(i.vatPt)}</td>
                    <td className="n">{i.whtPt ? pounds(i.whtPt) : "—"}</td>
                    <td className="n font-bold">{pounds(i.totalPt)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={4}>الإجمالي</td>
                  <td className="n">{pounds(d.basePt)}</td>
                  <td className="n">{pounds(d.vatPt)}</td>
                  <td className="n">{pounds(d.whtPt)}</td>
                  <td className="n">{pounds(d.totalPt)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <div className="px-4 py-3 border-t border-line text-sm leading-relaxed">
            عليك للضرايب عن {monthLabel(d.month)}: <b className="text-tax">{pounds(d.vatPt)}</b> — اتدفع منها <b>{pounds(d.paidPt)}</b> — الباقي{" "}
            <b className={owed > 0 ? "text-out" : "text-in"}>{pounds(Math.max(0, owed))}</b>
          </div>
        </>
      )}
    </Panel>
  );
}

export function WhtDeclaration({ v }: { v: TaxView }) {
  const [year, setYear] = useState(v.whtDeclarations[0]?.year ?? "");
  const d = v.whtDeclarations.find((x) => x.year === year);
  if (!v.whtDeclarations.length) return <Panel title="إقرار ٣٪ السنوي"><div className="px-4 py-8 text-center text-muted">لسه مفيش شغل اتخصم عليه ٣٪.</div></Panel>;
  return (
    <Panel
      title="إقرار الأرباح التجارية — استقطاع ٣٪"
      actions={
        <div className="no-print flex flex-wrap items-end gap-2">
          <Labeled label="السنة">
            <Select value={year} onChange={(e) => setYear(e.target.value)}>
              {v.whtDeclarations.map((x) => (
                <option key={x.year} value={x.year}>
                  {x.year}
                </option>
              ))}
            </Select>
          </Labeled>
          <PrintButtons pdfName={`إقرار ٣٪ سنة ${year}`} />
        </div>
      }
    >
      <PrintHeader title="إقرار الأرباح التجارية — استقطاع ٣٪" subtitle={`سنة ${year}`} />
      {d && (
        <>
          <div className="grid grid-cols-3 border-b border-line">
            <Box label="عدد الشركات">{d.clients.length}</Box>
            <Box label="اشتغلت بكام">{pounds(d.basePt)}</Box>
            <Box label="اتخصم ٣٪" tone="text-tax">{pounds(d.whtPt)}</Box>
          </div>
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>الشركة</th>
                  <th>الرقم الضريبي</th>
                  <th className="n">شهور الشغل</th>
                  <th className="n">قيمة الشغل</th>
                  <th className="n">اتخصم ٣٪</th>
                </tr>
              </thead>
              <tbody>
                {d.clients.map((c) => (
                  <tr key={c.clientId}>
                    <td className="font-bold">{c.client}</td>
                    <td className="num">{c.taxId ?? "—"}</td>
                    <td className="n">{c.months}</td>
                    <td className="n">{pounds(c.basePt)}</td>
                    <td className="n text-tax font-bold">{pounds(c.whtPt)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3}>الإجمالي</td>
                  <td className="n">{pounds(d.basePt)}</td>
                  <td className="n">{pounds(d.whtPt)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <div className="px-4 py-3 border-t border-line text-sm leading-relaxed">
            الـ ٣٪ دي الشركات خصمتها من فواتيرك ودفعتها للضرايب باسمك — بتتخصم من ضريبة الأرباح التجارية بتاعة السنة. اطلب من كل شركة شهادة الخصم (نموذج ٤١).
          </div>
        </>
      )}
    </Panel>
  );
}

function Box({ label, children, tone = "" }: { label: string; children: React.ReactNode; tone?: string }) {
  return (
    <div className="px-4 py-3 border-s border-line first:border-s-0">
      <span className="block text-xs font-semibold text-muted">{label}</span>
      <b className={`text-lg num ${tone}`}>{children}</b>
    </div>
  );
}
