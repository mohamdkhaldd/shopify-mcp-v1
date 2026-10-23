import { useCallback, useEffect, useState } from "react";
import { api, appApi, Deletable, TaxView } from "../../api/client";
import { Button, Code, ErrorBox, Kpi, Loading, Money, PageHeader, Panel } from "../../components/ui";
import { Labeled, Select, TextInput } from "../../components/Field";
import { PrintButtons, PrintHeader } from "../../components/Print";
import ConfirmDelete from "../../components/ConfirmDelete";
import { TrashButton } from "../../components/party";
import { dateLabel, monthLabel, pounds } from "../../utils/format";
import { moneyToPt } from "../../utils/input";
import { today } from "../../../core/db";

type Tab = "client" | "equipment" | "month" | "tax5" | "paid";

function TaxPaymentForm({ v, onSaved }: { v: TaxView; onSaved: () => void }) {
  const [tax, setTax] = useState<"vat" | "tax5">("vat");
  const [period, setPeriod] = useState(v.months[v.months.length - 1] ?? "");
  const [date, setDate] = useState(today());
  const [amount, setAmount] = useState("");
  const [receipt, setReceipt] = useState("");
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="no-print grid gap-2 px-4 py-3 border-b border-line bg-surface-2">
      <div className="flex flex-wrap items-end gap-2.5">
        <b className="w-full text-xs text-muted">دفعنا للضرايب</b>
        <Labeled label="الضريبة">
          <Select value={tax} onChange={(e) => setTax(e.target.value as "vat" | "tax5")}>
            <option value="vat">القيمة المضافة ١٤٪</option>
            <option value="tax5">٥٪ من الهامش</option>
          </Select>
        </Labeled>
        <Labeled label="عن شهر">
          <Select value={period} onChange={(e) => setPeriod(e.target.value)}>
            {[...v.months].reverse().map((m) => (
              <option key={m} value={m}>
                {monthLabel(m)}
              </option>
            ))}
          </Select>
        </Labeled>
        <Labeled label="تاريخ الدفع">
          <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-36" />
        </Labeled>
        <Labeled label="المبلغ">
          <TextInput value={amount} onChange={(e) => setAmount(e.target.value)} className="w-28" inputMode="decimal" />
        </Labeled>
        <Labeled label="رقم الإيصال">
          <TextInput value={receipt} onChange={(e) => setReceipt(e.target.value)} className="w-32" />
        </Labeled>
        <Button
          primary
          onClick={async () => {
            setError(null);
            try {
              const pt = moneyToPt(amount);
              if (!pt || pt <= 0) throw new Error("اكتب المبلغ");
              await api.taxPayment({ tax, periodMonth: period || undefined, date, amountPt: pt, receiptNo: receipt.trim() || undefined });
              setAmount("");
              setReceipt("");
              onSaved();
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          حفظ
        </Button>
      </div>
      {error && <ErrorBox message={error} />}
    </div>
  );
}

function Empty({ cols }: { cols: number }) {
  return (
    <tr>
      <td colSpan={cols} className="text-center text-muted py-6">
        لسه مفيش.
      </td>
    </tr>
  );
}

export default function Tax() {
  const [v, setV] = useState<TaxView | null>(null);
  const [tab, setTab] = useState<Tab>("client");
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<{ entity: Deletable; id: number } | null>(null);

  const load = useCallback(() => {
    api.tax().then(setV, (e) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  if (!v) return error ? <ErrorBox message={error} /> : <Loading />;
  const t = v.totals;
  const vatWithClients = t.vat.invoicedPt - t.vat.collectedPt;

  function exportExcel() {
    if (!v) return;
    appApi.exportExcel("الملف الضريبي", [
      {
        title: "الإجمالي",
        columns: [
          { header: "الضريبة", key: "name", width: 22 },
          { header: "مستحق", key: "owed", money: true },
          { header: "اتحصّل", key: "collected", money: true },
          { header: "اتدفع للضرايب", key: "paid", money: true },
          { header: "الباقي علينا", key: "left", money: true },
        ],
        rows: [
          { name: "القيمة المضافة ١٤٪", owed: t.vat.invoicedPt, collected: t.vat.collectedPt, paid: t.vat.paidPt, left: t.vat.owedPt },
          { name: "٥٪ من الهامش", owed: t.tax5.accruedPt, collected: null, paid: t.tax5.paidPt, left: t.tax5.owedPt },
        ],
        totals: { name: "الإجمالي", owed: t.vat.invoicedPt + t.tax5.accruedPt, collected: t.vat.collectedPt, paid: t.vat.paidPt + t.tax5.paidPt, left: t.owedPt },
      },
      {
        title: "١٤٪ لكل عميل",
        columns: [
          { header: "العميل", key: "name", width: 26 },
          { header: "الرقم الضريبي", key: "taxId", width: 16 },
          { header: "قيمة الشغل", key: "basePt", money: true },
          { header: "الضريبة", key: "vatPt", money: true },
          { header: "اتحصّل منها", key: "collectedVatPt", money: true },
        ],
        rows: v.vatByClient.map((g) => ({ name: g.name, taxId: g.taxId ?? "", basePt: g.basePt, vatPt: g.vatPt, collectedVatPt: g.collectedVatPt })),
      },
      {
        title: "١٤٪ لكل شهر",
        columns: [
          { header: "الشهر", key: "month", width: 16 },
          { header: "قيمة الشغل", key: "basePt", money: true },
          { header: "الضريبة", key: "vatPt", money: true },
          { header: "اتحصّل", key: "collectedVatPt", money: true },
          { header: "اتدفع", key: "paidPt", money: true },
        ],
        rows: v.vatByMonth.map((g) => ({ month: monthLabel(g.month), basePt: g.basePt, vatPt: g.vatPt, collectedVatPt: g.collectedVatPt, paidPt: g.paidPt })),
      },
      {
        title: "٥٪ لكل عقد",
        columns: [
          { header: "العقد", key: "code" },
          { header: "المعدة", key: "equipment", width: 20 },
          { header: "الشهر", key: "month", width: 16 },
          { header: "الهامش", key: "marginPt", money: true },
          { header: "٥٪", key: "tax5Pt", money: true },
        ],
        rows: v.tax5.map((r) => ({ code: r.code, equipment: r.equipment, month: monthLabel(r.month), marginPt: r.marginPt, tax5Pt: r.tax5Pt })),
      },
      {
        title: "المدفوع للضرايب",
        columns: [
          { header: "التاريخ", key: "date" },
          { header: "الضريبة", key: "tax", width: 18 },
          { header: "عن شهر", key: "period", width: 16 },
          { header: "رقم الإيصال", key: "receipt" },
          { header: "المبلغ", key: "amount_pt", money: true },
        ],
        rows: v.payments.map((p) => ({ date: p.date, tax: p.tax === "vat" ? "قيمة مضافة ١٤٪" : "٥٪ من الهامش", period: p.period_month ? monthLabel(p.period_month) : "", receipt: p.receipt_no ?? "", amount_pt: p.amount_pt })),
      },
    ]);
  }

  const tabs: [Tab, string][] = [
    ["client", "١٤٪ لكل عميل"],
    ["equipment", "١٤٪ لكل معدة"],
    ["month", "١٤٪ لكل شهر"],
    ["tax5", "٥٪ لكل عقد / شهر"],
    ["paid", "المدفوع للضرايب"],
  ];

  return (
    <div className="grid gap-5">
      <PrintHeader title="الملف الضريبي" subtitle={dateLabel(new Date().toLocaleDateString("en-CA"))} />
      <PageHeader title="الملف الضريبي" subtitle="ضريبة القيمة المضافة ١٤٪ و ٥٪ من الهامش">
        <Button primary onClick={() => setTab("paid")}>
          + دفع للضرايب
        </Button>
        <PrintButtons pdfName="الملف الضريبي" singlePage={false} />
        <Button onClick={exportExcel}>Excel</Button>
      </PageHeader>
      {error && <ErrorBox message={error} />}

      <div className="grid gap-3.5 grid-cols-4 max-[1000px]:grid-cols-2">
        <Kpi tone="tax" label="إجمالي الضرايب اللي علينا" value={<Money pt={pounds(t.owedPt)} />} sub={`١٤٪ ${pounds(t.vat.owedPt)} + ٥٪ ${pounds(t.tax5.owedPt)}`} />
        <Kpi label="اتدفع للضرايب" value={<Money pt={pounds(t.vat.paidPt + t.tax5.paidPt)} />} />
        <Kpi label="منها قاعد في الخزنة" value={<Money pt={pounds(t.heldInTreasuryPt)} />} sub={`١٤٪ اتحصّلت ${pounds(t.vat.heldPt)} + ٥٪ ${pounds(t.tax5.owedPt)}`} />
        <Kpi label="١٤٪ لسه عند العملاء" value={<Money pt={pounds(vatWithClients)} />} sub="بتتحجز أول ما تتحصّل" />
      </div>

      <Panel title='يعني إيه "فلوس ضرايب في الخزنة"؟'>
        <div className="px-4 py-3.5 leading-[2]">
          العملاء دفعوا لنا لحد النهارده، وجوه اللي دفعوه <b className="text-tax">{pounds(t.vat.collectedPt)}</b> ضريبة ١٤٪. دي فلوس الحكومة، وإحنا شايلينها لحد ما ندفعها.
          <br />
          وكمان <b className="text-tax">{pounds(t.tax5.accruedPt)}</b> ضريبة الـ ٥٪ على الهامش لازم نشيلها على جنب.
          <br />
          اللي اتدفع للضرايب لحد دلوقتي <b>{pounds(t.vat.paidPt + t.tax5.paidPt)}</b>، يبقى قاعد في الخزنة <b className="text-tax">{pounds(t.heldInTreasuryPt)}</b> <b>مش بتاعتنا</b>، والبرنامج مش هيخليك تصرف منهم للموردين.
          <br />
          {vatWithClients > 0 && (
            <>
              والـ <b>{pounds(vatWithClients)}</b> التانيين (ضريبة الفواتير اللي لسه متدفعتش) لسه عند العملاء، وهيدخلوا الخزنة لما يدفعوا.
            </>
          )}
        </div>
      </Panel>

      <Panel title="الإجمالي بالتفصيل">
        <div className="overflow-x-auto">
          <table className="tbl">
            <thead>
              <tr>
                <th>الضريبة</th>
                <th className="n">مستحق (على الفواتير)</th>
                <th className="n">اتحصّل</th>
                <th className="n">اتدفع للضرايب</th>
                <th className="n">الباقي علينا</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="font-bold">القيمة المضافة ١٤٪</td>
                <td className="n">{pounds(t.vat.invoicedPt)}</td>
                <td className="n">{pounds(t.vat.collectedPt)}</td>
                <td className="n">{pounds(t.vat.paidPt)}</td>
                <td className="n text-tax font-bold">{pounds(t.vat.owedPt)}</td>
              </tr>
              <tr>
                <td className="font-bold">٥٪ من الهامش</td>
                <td className="n">{pounds(t.tax5.accruedPt)}</td>
                <td className="n">—</td>
                <td className="n">{pounds(t.tax5.paidPt)}</td>
                <td className="n text-tax font-bold">{pounds(t.tax5.owedPt)}</td>
              </tr>
            </tbody>
            <tfoot>
              <tr>
                <td>الإجمالي</td>
                <td className="n">{pounds(t.vat.invoicedPt + t.tax5.accruedPt)}</td>
                <td className="n">{pounds(t.vat.collectedPt)}</td>
                <td className="n">{pounds(t.vat.paidPt + t.tax5.paidPt)}</td>
                <td className="n">{pounds(t.owedPt)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Panel>

      <Panel>
        <div className="no-print flex gap-1 border-b border-line px-3 overflow-x-auto">
          {tabs.map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)} className={`px-3 py-2.5 font-bold border-b-[3px] whitespace-nowrap ${tab === id ? "border-amber text-fg" : "border-transparent text-muted"}`}>
              {label}
            </button>
          ))}
        </div>
        <div className="overflow-x-auto">
          {tab === "client" && (
            <table className="tbl">
              <thead>
                <tr>
                  <th>العميل</th>
                  <th>الرقم الضريبي</th>
                  <th className="n">قيمة الشغل</th>
                  <th className="n">الضريبة</th>
                  <th className="n">اتحصّل منها</th>
                </tr>
              </thead>
              <tbody>
                {v.vatByClient.length === 0 && <Empty cols={5} />}
                {v.vatByClient.map((g) => (
                  <tr key={g.key}>
                    <td>{g.name}</td>
                    <td>{g.taxId ?? "—"}</td>
                    <td className="n">{pounds(g.basePt)}</td>
                    <td className="n text-tax font-bold">{pounds(g.vatPt)}</td>
                    <td className="n">{pounds(g.collectedVatPt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {tab === "equipment" && (
            <table className="tbl">
              <thead>
                <tr>
                  <th>المعدة</th>
                  <th>صاحبها</th>
                  <th className="n">قيمة الشغل</th>
                  <th className="n">الضريبة</th>
                  <th className="n">اتحصّل منها</th>
                </tr>
              </thead>
              <tbody>
                {v.vatByEquipment.length === 0 && <Empty cols={5} />}
                {v.vatByEquipment.map((g) => (
                  <tr key={g.key}>
                    <td>{g.name}</td>
                    <td>{g.supplier}</td>
                    <td className="n">{pounds(g.basePt)}</td>
                    <td className="n text-tax font-bold">{pounds(g.vatPt)}</td>
                    <td className="n">{pounds(g.collectedVatPt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {tab === "month" && (
            <table className="tbl">
              <thead>
                <tr>
                  <th>الشهر</th>
                  <th className="n">قيمة الشغل</th>
                  <th className="n">الضريبة</th>
                  <th className="n">اتحصّل</th>
                  <th className="n">اتدفع</th>
                </tr>
              </thead>
              <tbody>
                {v.vatByMonth.length === 0 && <Empty cols={5} />}
                {v.vatByMonth.map((g) => (
                  <tr key={g.month}>
                    <td>{monthLabel(g.month)}</td>
                    <td className="n">{pounds(g.basePt)}</td>
                    <td className="n text-tax font-bold">{pounds(g.vatPt)}</td>
                    <td className="n">{pounds(g.collectedVatPt)}</td>
                    <td className="n">{pounds(g.paidPt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {tab === "tax5" && (
            <table className="tbl">
              <thead>
                <tr>
                  <th>العقد</th>
                  <th>المعدة</th>
                  <th>الشهر</th>
                  <th className="n">الهامش</th>
                  <th className="n">٥٪</th>
                </tr>
              </thead>
              <tbody>
                {v.tax5.length === 0 && <Empty cols={5} />}
                {v.tax5.map((r) => (
                  <tr key={`${r.contractId}-${r.month}`}>
                    <td>
                      <Code>{r.code}</Code>
                    </td>
                    <td>{r.equipment}</td>
                    <td>{monthLabel(r.month)}</td>
                    <td className="n">{pounds(r.marginPt)}</td>
                    <td className="n text-tax font-bold">{pounds(r.tax5Pt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {tab === "paid" && (
            <>
              <TaxPaymentForm v={v} onSaved={load} />
              <table className="tbl">
                <thead>
                  <tr>
                    <th>التاريخ</th>
                    <th>الضريبة</th>
                    <th>عن شهر</th>
                    <th>رقم الإيصال</th>
                    <th className="n">المبلغ</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {v.payments.length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-center text-muted py-6">
                        لسه مفيش مدفوعات للضرايب.
                      </td>
                    </tr>
                  )}
                  {v.payments.map((p) => (
                    <tr key={p.id}>
                      <td>{dateLabel(p.date)}</td>
                      <td>{p.tax === "vat" ? "القيمة المضافة ١٤٪" : "٥٪ من الهامش"}</td>
                      <td>{p.period_month ? monthLabel(p.period_month) : "—"}</td>
                      <td>{p.receipt_no ?? "—"}</td>
                      <td className="n font-bold">{pounds(p.amount_pt)}</td>
                      <td className="text-end">
                        <TrashButton title="حذف" onClick={() => setDeleting({ entity: "tax_payments", id: p.id })} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      </Panel>
      {deleting && <ConfirmDelete entity={deleting.entity} id={deleting.id} onClose={() => setDeleting(null)} onDeleted={load} />}
    </div>
  );
}
