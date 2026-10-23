import { useCallback, useEffect, useState } from "react";
import { api, appApi, ClientsView, Deletable } from "../../api/client";
import { Button, Code, ErrorBox, Loading, PageHeader, Panel, Pill } from "../../components/ui";
import { Labeled, Select, TextInput } from "../../components/Field";
import { PrintButtons, PrintHeader, PrintSignoff } from "../../components/Print";
import ConfirmDelete from "../../components/ConfirmDelete";
import Modal from "../../components/Modal";
import MoneyEntry from "../../components/MoneyEntry";
import { Fact, MoneyTable, PartySheetTab } from "../../components/party";
import Icon from "../../components/Icon";
import { dateLabel, monthLabel, pounds } from "../../utils/format";

type Selected = NonNullable<ClientsView["selected"]>;
type Tab = "statement" | "invoices" | "sheet" | "payments";

/** كشف الحساب: "up to today" line + one row per month. Nothing about equipment owners or costs. */
function Statement({ s }: { s: Selected }) {
  const t = s.totals;
  return (
    <div>
      <div className="px-4 py-3.5 text-[15px] leading-loose">
        لحد النهارده: الفواتير <b>{pounds(t.invoicedPt)}</b> (منها ضريبة ١٤٪ <b className="text-tax">{pounds(t.vatPt)}</b>) — دفع <b className="text-in">{pounds(t.paidPt)}</b> —{" "}
        <b>
          يبقى الباقي عليه <span className={t.remainingPt > 0 ? "text-out" : "text-in"}>{pounds(t.remainingPt)}</span>
        </b>
        {t.creditPt > 0 && <> — ليه رصيد زيادة {pounds(t.creditPt)}</>}
      </div>
      <div className="overflow-x-auto">
        <table className="tbl">
          <thead>
            <tr>
              <th>الشهر</th>
              <th className="n">الفواتير (بالضريبة)</th>
              <th className="n">دفع</th>
              <th className="n">الباقي عليه لحد آخر الشهر</th>
            </tr>
          </thead>
          <tbody>
            {s.rows.length === 0 && (
              <tr>
                <td colSpan={4} className="text-center text-muted py-6">
                  لسه مفيش حساب.
                </td>
              </tr>
            )}
            {s.rows.map((r) => (
              <tr key={r.month}>
                <td>{monthLabel(r.month)}</td>
                <td className="n">{pounds(r.invoicedPt)}</td>
                <td className="n">{pounds(r.paidPt)}</td>
                <td className={`n font-bold ${r.runningPt > 0 ? "text-out" : ""}`}>{pounds(r.runningPt)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td>الإجمالي</td>
              <td className="n">{pounds(t.invoicedPt)}</td>
              <td className="n">{pounds(t.paidPt)}</td>
              <td className="n">{pounds(t.remainingPt)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

const STATUS = { paid: ["مدفوعة", "in"], partial: ["جزء", "amber"], unpaid: ["متدفعتش", "out"] } as const;

function Invoices({ s }: { s: Selected }) {
  return (
    <div className="overflow-x-auto">
      <table className="tbl">
        <thead>
          <tr>
            <th>رقم الفاتورة</th>
            <th>الشهر</th>
            <th>العقد</th>
            <th className="n">قيمة الشغل</th>
            <th className="n">ضريبة ١٤٪</th>
            <th className="n">الإجمالي</th>
            <th className="n">اتحصّل</th>
            <th className="n">الباقي</th>
            <th>الحالة</th>
          </tr>
        </thead>
        <tbody>
          {s.invoices.length === 0 && (
            <tr>
              <td colSpan={9} className="text-center text-muted py-6">
                لسه مفيش فواتير — الفاتورة بتطلع من سركي الشهر.
              </td>
            </tr>
          )}
          {s.invoices.map((i) => {
            const [label, tone] = STATUS[i.status];
            return (
              <tr key={`${i.contractId}-${i.month}`}>
                <td>{i.serial ? <Code>{i.serial}</Code> : <span className="text-muted text-xs" title="الفاتورة بتاخد رقم لما الشهر يتقفل">لسه</span>}</td>
                <td>{monthLabel(i.month)}</td>
                <td title={i.equipment}>
                  <Code>{i.code}</Code>
                </td>
                <td className="n">{pounds(i.basePt)}</td>
                <td className="n text-tax font-bold">{pounds(i.vatPt)}</td>
                <td className="n font-bold">{pounds(i.totalPt)}</td>
                <td className="n">{pounds(i.collectedPt)}</td>
                <td className="n">{pounds(i.openPt)}</td>
                <td>
                  <Pill tone={tone}>{label}</Pill>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ClientForm({ initial, onClose, onSaved }: { initial?: Selected["client"]; onClose: () => void; onSaved: (id: number) => void }) {
  const [kind, setKind] = useState<"company" | "individual">(initial?.kind ?? "company");
  const [name, setName] = useState(initial?.name ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [taxId, setTaxId] = useState(initial?.tax_id ?? "");
  const [vat, setVat] = useState(true);
  const [tax5, setTax5] = useState(true);
  const [error, setError] = useState<string | null>(null);
  async function save() {
    try {
      if (initial) {
        await api.updateClient({ id: initial.id, kind, name, phone: phone.trim() || null, taxId: taxId.trim() || null });
        onSaved(initial.id);
      } else onSaved(await api.createClient({ kind, name, phone: phone.trim() || undefined, taxId: taxId.trim() || undefined, vatApplies: vat, tax5Applies: tax5 }));
      onClose();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <Modal
      title={initial ? "تعديل العميل" : "عميل جديد"}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>إلغاء</Button>
          <Button primary onClick={save}>
            حفظ
          </Button>
        </>
      }
    >
      <div className="flex flex-wrap gap-3 items-end">
        <Labeled label="النوع">
          <Select
            value={kind}
            onChange={(e) => {
              const k = e.target.value as "company" | "individual";
              setKind(k);
              setVat(k === "company");
              setTax5(k === "company");
            }}
          >
            <option value="company">شركة</option>
            <option value="individual">فرد</option>
          </Select>
        </Labeled>
        <Labeled label="الاسم">
          <TextInput value={name} onChange={(e) => setName(e.target.value)} className="w-60" autoFocus />
        </Labeled>
        <Labeled label="التليفون">
          <TextInput value={phone} onChange={(e) => setPhone(e.target.value)} className="w-36" />
        </Labeled>
        <Labeled label="الرقم الضريبي (اختياري)">
          <TextInput value={taxId} onChange={(e) => setTaxId(e.target.value)} className="w-36" />
        </Labeled>
        {!initial && (
          <>
            <label className="flex items-center gap-1.5 text-sm font-semibold">
              <input type="checkbox" checked={vat} onChange={(e) => setVat(e.target.checked)} /> عليه ١٤٪
            </label>
            <label className="flex items-center gap-1.5 text-sm font-semibold">
              <input type="checkbox" checked={tax5} onChange={(e) => setTax5(e.target.checked)} /> عليه ٥٪
            </label>
          </>
        )}
      </div>
      {error && (
        <div className="mt-3">
          <ErrorBox message={error} />
        </div>
      )}
    </Modal>
  );
}

function TaxSwitch({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className="no-print inline-flex items-center gap-2 font-bold text-[13px]">
      <span className={`relative w-[38px] h-[22px] rounded-full transition-colors ${checked ? "bg-in" : "bg-line"}`}>
        <span className={`absolute top-[3px] w-4 h-4 rounded-full bg-white shadow transition-all ${checked ? "start-[19px]" : "start-[3px]"}`} />
      </span>
      {label}
    </button>
  );
}

export default function Clients() {
  const [clientId, setClientId] = useState<number | undefined>();
  const [v, setV] = useState<ClientsView | null>(null);
  const [tab, setTab] = useState<Tab>("statement");
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<null | "new" | "edit">(null);
  const [deleting, setDeleting] = useState<{ entity: Deletable; id: number } | null>(null);

  const load = useCallback(() => {
    api.clients(clientId).then(setV, (e) => setError(e.message));
  }, [clientId]);
  useEffect(load, [load]);

  if (!v) return error ? <ErrorBox message={error} /> : <Loading />;
  const s = v.selected;
  const c = s?.client;
  const contractChoices = (s?.contracts ?? []).map((x) => ({ id: x.id, label: `${x.code} — ${x.equipment}` }));

  const setTaxes = (vat: boolean, tax5: boolean) =>
    c &&
    api.setClientTaxes(c.id, vat, tax5).then(load, (e) => setError(e.message));

  function exportStatement() {
    if (!s || !c) return;
    appApi.exportExcel(`كشف حساب ${c.name}`, [
      {
        title: "كشف الحساب",
        columns: [
          { header: "الشهر", key: "month", width: 16 },
          { header: "الفواتير (بالضريبة)", key: "invoicedPt", money: true, width: 20 },
          { header: "دفع", key: "paidPt", money: true },
          { header: "الباقي عليه", key: "runningPt", money: true },
        ],
        rows: s.rows.map((r) => ({ ...r, month: monthLabel(r.month) })),
        totals: { month: "الإجمالي", invoicedPt: s.totals.invoicedPt, paidPt: s.totals.paidPt, runningPt: s.totals.remainingPt },
      },
      {
        title: "الفواتير",
        columns: [
          { header: "رقم الفاتورة", key: "serial", width: 16 },
          { header: "الشهر", key: "month", width: 14 },
          { header: "العقد", key: "code" },
          { header: "قيمة الشغل", key: "basePt", money: true },
          { header: "ضريبة ١٤٪", key: "vatPt", money: true },
          { header: "الإجمالي", key: "totalPt", money: true },
          { header: "اتحصّل", key: "collectedPt", money: true },
        ],
        rows: s.invoices.map((i) => ({ serial: i.serial ?? "", month: monthLabel(i.month), code: i.code, basePt: i.basePt, vatPt: i.vatPt, totalPt: i.totalPt, collectedPt: i.collectedPt })),
      },
      {
        title: "الدفعات",
        columns: [
          { header: "التاريخ", key: "date" },
          { header: "ملاحظة", key: "note", width: 30 },
          { header: "المبلغ", key: "amountPt", money: true },
        ],
        rows: s.payments.map((p) => ({ date: p.date, note: p.note ?? "", amountPt: p.amountPt })),
      },
    ]);
  }

  const tabs: [Tab, string][] = [
    ["statement", "كشف الحساب"],
    ["invoices", "الفواتير"],
    ["sheet", "سركي الشركة"],
    ["payments", "الدفعات"],
  ];

  return (
    <div className="grid gap-5">
      <PageHeader title="الشركات والأفراد" subtitle="العملاء اللي واخدين المعدات">
        <Button onClick={() => setForm("new")}>+ عميل</Button>
        {s && (
          <Button primary onClick={() => setTab("payments")}>
            + دفعة من عميل
          </Button>
        )}
      </PageHeader>
      {error && <ErrorBox message={error} />}

      {!s || !c ? (
        <Panel>
          <div className="px-4 py-14 text-center grid gap-3 justify-items-center">
            <div className="text-muted">لسه مفيش عملاء. ضيف أول واحد، أو اعمل عقد جديد من صفحة السركي.</div>
            <Button primary onClick={() => setForm("new")}>
              + عميل
            </Button>
          </div>
        </Panel>
      ) : (
        <div className="grid gap-4 items-start grid-cols-[250px_minmax(0,1fr)] max-[900px]:grid-cols-1">
          <Panel className="no-print grid">
            {v.list.map((x) => (
              <button
                key={x.id}
                onClick={() => setClientId(x.id)}
                className={`text-start grid gap-0.5 px-4 py-3 border-b border-line last:border-b-0 ${x.id === c.id ? "bg-amber-soft shadow-[inset_-4px_0_0_rgb(var(--amber))]" : "hover:bg-surface-2"}`}
              >
                <b>{x.name}</b>
                <small className="text-muted flex items-center gap-1.5">
                  <Pill>{x.kind === "company" ? "شركة" : "فرد"}</Pill>
                  {x.vat_applies || x.tax5_applies ? [x.vat_applies && "١٤٪", x.tax5_applies && "٥٪"].filter(Boolean).join(" + ") : "من غير ضرايب"}
                </small>
                <span className={`font-extrabold num ${x.remainingPt > 0 ? "text-out" : ""}`}>باقي عليه {pounds(x.remainingPt)}</span>
              </button>
            ))}
          </Panel>

          <Panel
            title={c.name}
            actions={
              <>
                <TaxSwitch label="عليه ١٤٪ قيمة مضافة" checked={!!c.vat_applies} onChange={(x) => setTaxes(x, !!c.tax5_applies)} />
                <TaxSwitch label="عليه ٥٪ من الهامش" checked={!!c.tax5_applies} onChange={(x) => setTaxes(!!c.vat_applies, x)} />
                <PrintButtons pdfName={`كشف حساب ${c.name}`} singlePage={false} />
                <Button onClick={exportStatement}>Excel</Button>
                <Button onClick={() => setForm("edit")}>تعديل</Button>
                <Button danger title="حذف العميل" onClick={() => setDeleting({ entity: "clients", id: c.id })}>
                  <Icon name="trash" className="w-4 h-4" />
                </Button>
              </>
            }
          >
            <PrintHeader title={`كشف حساب — ${c.name}${c.tax_id ? ` · رقم ضريبي ${c.tax_id}` : ""}`} subtitle={dateLabel(new Date().toLocaleDateString("en-CA"))} />
            <div className="grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] border-b border-line">
              <Fact label="قيمة الشغل">{pounds(s.totals.basePt)}</Fact>
              <Fact label="ضريبة ١٤٪" tone="text-tax">
                {pounds(s.totals.vatPt)}
              </Fact>
              <Fact label="إجمالي الفواتير">{pounds(s.totals.invoicedPt)}</Fact>
              <Fact label="دفع" tone="text-in">
                {pounds(s.totals.paidPt)}
              </Fact>
              <Fact label="الباقي عليه" tone={s.totals.remainingPt > 0 ? "text-out" : "text-in"}>
                {pounds(s.totals.remainingPt)}
              </Fact>
            </div>
            <div className="no-print flex gap-1 border-b border-line px-3 overflow-x-auto">
              {tabs.map(([id, label]) => (
                <button key={id} onClick={() => setTab(id)} className={`px-3 py-2.5 font-bold border-b-[3px] whitespace-nowrap ${tab === id ? "border-amber text-fg" : "border-transparent text-muted"}`}>
                  {label}
                </button>
              ))}
            </div>

            {tab === "statement" && (
              <>
                <Statement s={s} />
                <PrintSignoff parties={["توقيع شركة البنيان", "توقيع العميل"]} />
                <div className="no-print text-xs text-muted px-4 py-2.5 border-t border-line">ده اللي بيتطبع للعميل — مفيهوش أي حاجة عن أصحاب المعدات أو ربحنا.</div>
              </>
            )}
            {tab === "invoices" && <Invoices s={s} />}
            {tab === "sheet" && <PartySheetTab key={c.id} contracts={s.contracts} side="client" partyName={c.name} />}
            {tab === "payments" && (
              <>
                <MoneyEntry
                  key={`p-${c.id}`}
                  title="دفعة من العميل (بتتوزع على أقدم فاتورة مفتوحة)"
                  contracts={contractChoices}
                  notePlaceholder="تحويل بنكي / شيك رقم / كاش ..."
                  saveLabel="حفظ الدفعة"
                  onSave={async (x) => {
                    await api.clientPayment({ clientId: c.id, contractId: x.contractId, date: x.date, amountPt: x.amountPt, note: x.note || undefined });
                    load();
                  }}
                />
                <MoneyTable rows={s.payments} noteHeader="ملاحظة" contracts={s.contracts} onDelete={(id) => setDeleting({ entity: "client_payments", id })} />
              </>
            )}
          </Panel>
        </div>
      )}

      {(form === "new" || (form === "edit" && c)) && (
        <ClientForm
          initial={form === "edit" ? c : undefined}
          onClose={() => setForm(null)}
          onSaved={(id) => {
            setClientId(id);
            load();
          }}
        />
      )}
      {deleting && (
        <ConfirmDelete
          entity={deleting.entity}
          id={deleting.id}
          onClose={() => setDeleting(null)}
          onDeleted={() => {
            if (deleting.entity === "clients") setClientId(undefined);
            load();
          }}
        />
      )}
    </div>
  );
}
