import { ReactNode, useCallback, useEffect, useState } from "react";
import { api, OpenSarki, SarkiView } from "../../api/client";
import { Button, Code, ErrorBox, Loading, PageHeader, Panel, Pill } from "../../components/ui";
import { Select } from "../../components/Field";
import { PrintButtons, PrintHeader, PrintSignoff } from "../../components/Print";
import ConfirmDelete from "../../components/ConfirmDelete";
import Icon from "../../components/Icon";
import { dateLabel, monthLabel, pounds, unitLabel } from "../../utils/format";
import { milliToHours } from "../../utils/input";
import { ClientSheet, SupplierSheet } from "./Sheets";
import { ClientBulk, SupplierBulk } from "./BulkTools";
import NewContract from "./NewContract";

type Tab = "client" | "supplier";
type Deleting = { entity: "work_logs" | "contracts"; id: number };

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="px-4 py-3 border-s border-line first:border-s-0">
      <span className="block text-xs font-semibold text-muted">{label}</span>
      <b className="text-[15px] num">{children}</b>
    </div>
  );
}

function ContractPanel({ v, onDelete, onDone, onError, reload }: { v: OpenSarki; onDelete: (d: Deleting) => void; onDone: (m: string) => void; onError: (m: string) => void; reload: () => void }) {
  const [tab, setTab] = useState<Tab>("client");
  const c = v.contract;
  const t = v.client.totals;
  return (
    <Panel
      title={
        <>
          عقد <Code>{c.code}</Code> — {c.equipment}
        </>
      }
      actions={
        <>
          {c.vatApplies || c.tax5Applies ? (
            <Pill tone="tax">عليه {[c.vatApplies && "١٤٪", c.tax5Applies && "٥٪"].filter(Boolean).join(" و ")}</Pill>
          ) : (
            <Pill>من غير ضرايب</Pill>
          )}
          <PrintButtons pdfName={`سركي ${c.code} ${monthLabel(v.month)}`} singlePage={false} />
          <Button danger onClick={() => onDelete({ entity: "contracts", id: c.id })} title="حذف العقد">
            <Icon name="trash" className="w-4 h-4" />
          </Button>
        </>
      }
    >
      <PrintHeader title={`سركي ${tab === "client" ? "الشركة" : "صاحب المعدة"} — ${c.equipment}`} subtitle={monthLabel(v.month)} />
      <div className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] border-b border-line">
        <Fact label="الشركة (العميل)">{c.client}</Fact>
        <Fact label="صاحب المعدة">{c.supplier}</Fact>
        <Fact label={`السعر / ${unitLabel(c.unit)}`}>
          {pounds(c.clientRatePt)} للشركة · {pounds(c.supplierRatePt)} لصاحبها
        </Fact>
        <Fact label="المدة">
          {dateLabel(c.startDate)} – {c.endDate ? dateLabel(c.endDate) : "مفتوح"}
        </Fact>
      </div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] border-b border-line">
        <Fact label="أيام الشغل">
          {t.workedDays} يوم{t.overtimeMilli > 0 && ` + ${milliToHours(t.overtimeMilli)} س أوفر`}
        </Fact>
        <Fact label="للشركة">{pounds(t.totalPt)}</Fact>
        <Fact label="لصاحب المعدة">{pounds(v.supplier.totals.totalPt)}</Fact>
        <Fact label="الفرق (قبل الـ ٥٪ والمصروفات)">{pounds(t.totalPt - v.supplier.totals.totalPt)}</Fact>
      </div>
      {v.closed && (
        <div className="no-print px-4 py-2.5 border-b border-line bg-amber-soft font-semibold text-sm">
          شهر {monthLabel(v.month)} اتقفل — السركي بتاعه للقراية بس. أي تصحيح بيتعمل بتسوية في شهر مفتوح.
        </div>
      )}
      <div className="no-print flex gap-1 border-b border-line px-3">
        {(
          [
            ["client", "سركي الشركة", "بستلمه من الشركة"],
            ["supplier", "سركي صاحب المعدة", "نسخة منه بسعر صاحب المعدة"],
          ] as const
        ).map(([id, label, hint]) => (
          <button key={id} onClick={() => setTab(id)} className={`px-3 py-2.5 font-bold border-b-[3px] ${tab === id ? "border-amber text-fg" : "border-transparent text-muted"}`}>
            {label} <small className="text-xs font-semibold text-muted">({hint})</small>
          </button>
        ))}
      </div>
      {tab === "client" ? (
        <>
          {!v.closed && <ClientBulk key={`${c.id}-${v.month}`} v={v} onDone={onDone} onError={onError} />}
          <div className="overflow-x-auto">
            <ClientSheet v={v} onSaved={reload} onError={onError} onDeleteDay={(id) => onDelete({ entity: "work_logs", id })} />
          </div>
        </>
      ) : (
        <>
          {!v.closed && <SupplierBulk key={`${c.id}-${v.month}`} v={v} onDone={onDone} onError={onError} />}
          <div className="overflow-x-auto">
            <SupplierSheet v={v} onSaved={reload} onError={onError} />
          </div>
        </>
      )}
      <PrintSignoff parties={["توقيع شركة البنيان", tab === "client" ? "توقيع مندوب الشركة" : "توقيع صاحب المعدة"]} />
      <div className="no-print text-xs text-muted px-4 py-2.5 border-t border-line">
        الدايرة الحمرا جنب اليوم = مشتغلش (اكتب السبب في البيان). الساعات الفعلية فاضية = يوم كامل. الأوفر تايم = الفعلية − الأساسية، وسعر ساعته لو فاضي = اليومية ÷ الساعات الأساسية.
      </div>
    </Panel>
  );
}

export default function Sarki() {
  const [contractId, setContractId] = useState<number | undefined>();
  const [month, setMonth] = useState<string | undefined>();
  const [v, setV] = useState<SarkiView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [deleting, setDeleting] = useState<Deleting | null>(null);

  const load = useCallback(() => {
    api.sarki(contractId, month).then(setV, (e) => setError(e.message));
  }, [contractId, month]);

  useEffect(load, [load]);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 3000);
    return () => clearTimeout(t);
  }, [notice]);

  if (!v) return error ? <ErrorBox message={error} /> : <Loading />;
  const open = v.contract ? (v as OpenSarki) : null;
  const done = (m: string) => {
    setError(null);
    setNotice(m);
    load();
  };

  return (
    <div className="grid gap-5">
      <PageHeader title="السركي" subtitle="بتكتب سركي الشركة يوم بيوم، وسركي صاحب المعدة بيتملى لوحده — اللي بيختلف أسعاره بس (اليومية وساعة الأوفر)">
        {open && (
          <>
            <Select aria-label="العقد" value={open.contract.id} onChange={(e) => setContractId(Number(e.target.value))}>
              {open.contracts.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.code} · {x.equipment} · {x.client}
                  {x.status !== "active" ? " (منتهي)" : ""}
                </option>
              ))}
            </Select>
            <Select aria-label="الشهر" value={open.month} onChange={(e) => setMonth(e.target.value)}>
              {[...open.months].reverse().map((m) => (
                <option key={m} value={m}>
                  {monthLabel(m)}
                </option>
              ))}
            </Select>
          </>
        )}
        <Button primary onClick={() => setNewOpen(true)}>
          + عقد جديد
        </Button>
      </PageHeader>

      {error && (
        <div className="no-print flex items-center justify-between gap-3 rounded-card border border-out bg-out-soft px-4 py-2.5 font-semibold">
          <span>{error}</span>
          <button className="text-xs" onClick={() => setError(null)}>
            إخفاء
          </button>
        </div>
      )}
      {notice && <div className="no-print rounded-card border border-in bg-in-soft px-4 py-2.5 font-semibold">{notice}</div>}

      {open ? (
        <ContractPanel v={open} onDelete={setDeleting} onDone={done} onError={setError} reload={load} />
      ) : (
        <Panel>
          <div className="px-4 py-14 text-center grid gap-3 justify-items-center">
            <div className="text-muted">لسه مفيش عقود. أول عقد بيتعمل من هنا: الشركة، والمعدة وصاحبها، والسعرين.</div>
            <Button primary onClick={() => setNewOpen(true)}>
              + عقد جديد
            </Button>
          </div>
        </Panel>
      )}

      {newOpen && (
        <NewContract
          onClose={() => setNewOpen(false)}
          onCreated={(id) => {
            setNewOpen(false);
            setContractId(id);
            setMonth(undefined);
            setNotice("العقد اتعمل — ابدأ املا السركي");
          }}
        />
      )}
      {deleting && (
        <ConfirmDelete
          entity={deleting.entity}
          id={deleting.id}
          onClose={() => setDeleting(null)}
          onDeleted={() => {
            if (deleting.entity === "contracts") setContractId(undefined);
            load();
          }}
        />
      )}
    </div>
  );
}
