import { useCallback, useEffect, useState } from "react";
import { api, appApi, Deletable, SuppliersView } from "../../api/client";
import { Button, ErrorBox, Loading, PageHeader, Panel, Pill } from "../../components/ui";
import { Labeled, TextInput } from "../../components/Field";
import { PrintButtons, PrintHeader, PrintSignoff } from "../../components/Print";
import ConfirmDelete from "../../components/ConfirmDelete";
import { Fact, MoneyTable, PartySheetTab, TrashButton } from "../../components/party";
import Modal from "../../components/Modal";
import MoneyEntry from "../../components/MoneyEntry";
import Icon from "../../components/Icon";
import { dateLabel, monthLabel, pounds } from "../../utils/format";
import { moneyToPt, ptToInput } from "../../utils/input";

type Selected = NonNullable<SuppliersView["selected"]>;
type Tab = "statement" | "equipment" | "sheet" | "deductions" | "payments";

/** كشف الحساب: one "up to today" sentence + one row per month. Nothing about clients or margins. */
function Statement({ s }: { s: Selected }) {
  const t = s.totals;
  return (
    <div>
      <div className="px-4 py-3.5 text-[15px] leading-loose">
        لحد النهارده: من السركي ليه <b>{pounds(t.fromSarkiPt)}</b> — دفعنا عنه <b className="text-tax">{pounds(t.deductionsPt)}</b> — اتصرف له <b className="text-in">{pounds(t.paidPt)}</b> —{" "}
        <b>
          يبقى الباقي له <span className={t.remainingPt > 0 ? "text-out" : "text-in"}>{pounds(t.remainingPt)}</span>
        </b>
      </div>
      <div className="overflow-x-auto">
        <table className="tbl">
          <thead>
            <tr>
              <th>الشهر</th>
              <th className="n">من السركي</th>
              <th className="n">دفعنا عنه</th>
              <th className="n">اتصرف له</th>
              <th className="n">باقي الشهر</th>
              <th className="n">الباقي لحد آخر الشهر</th>
            </tr>
          </thead>
          <tbody>
            {s.rows.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center text-muted py-6">
                  لسه مفيش حساب.
                </td>
              </tr>
            )}
            {s.rows.map((r) => (
              <tr key={r.month}>
                <td>{monthLabel(r.month)}</td>
                <td className="n">{pounds(r.fromSarkiPt)}</td>
                <td className="n">{pounds(r.deductionsPt)}</td>
                <td className="n">{pounds(r.paidPt)}</td>
                <td className="n">{pounds(r.monthBalancePt)}</td>
                <td className={`n font-bold ${r.runningBalancePt > 0 ? "text-out" : ""}`}>{pounds(r.runningBalancePt)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td>الإجمالي</td>
              <td className="n">{pounds(t.fromSarkiPt)}</td>
              <td className="n">{pounds(t.deductionsPt)}</td>
              <td className="n">{pounds(t.paidPt)}</td>
              <td />
              <td className="n">{pounds(t.remainingPt)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      {s.byEquipment.length > 1 && (
        <>
          <div className="px-4 pt-4 pb-2 font-display font-bold text-[15px]">حسب المعدة</div>
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>المعدة</th>
                  <th className="n">من السركي</th>
                  <th className="n">دفعنا عنه</th>
                  <th className="n">اتصرف له</th>
                  <th className="n">الباقي</th>
                </tr>
              </thead>
              <tbody>
                {s.byEquipment.map((e) => (
                  <tr key={e.equipmentId ?? "none"}>
                    <td className={e.equipmentId == null ? "text-muted" : "font-bold"}>{e.name}</td>
                    <td className="n">{pounds(e.fromSarkiPt)}</td>
                    <td className="n">{pounds(e.deductionsPt)}</td>
                    <td className="n">{pounds(e.paidPt)}</td>
                    <td className="n font-bold">{pounds(e.remainingPt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function EquipmentForm({ supplierId, initial, onClose, onSaved }: { supplierId: number; initial?: Selected["equipment"][number]; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(initial?.name ?? "");
  const [site, setSite] = useState(initial?.site_name ?? "");
  const [rate, setRate] = useState(ptToInput(initial?.supplier_rate_pt));
  const [error, setError] = useState<string | null>(null);
  async function save() {
    try {
      const v = { name, siteName: site.trim() || null, supplierRatePt: moneyToPt(rate) };
      if (initial) await api.updateEquipment({ id: initial.id, ...v });
      else await api.createEquipment({ supplierId, name, siteName: v.siteName ?? undefined, supplierRatePt: v.supplierRatePt ?? undefined });
      onSaved();
      onClose();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <Modal
      title={initial ? "تعديل المعدة" : "معدة جديدة"}
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
        <Labeled label="اسم المعدة">
          <TextInput value={name} onChange={(e) => setName(e.target.value)} className="w-56" autoFocus />
        </Labeled>
        <Labeled label="الموقع">
          <TextInput value={site} onChange={(e) => setSite(e.target.value)} className="w-56" />
        </Labeled>
        <Labeled label="اليومية المتفق عليها">
          <TextInput value={rate} onChange={(e) => setRate(e.target.value)} inputMode="decimal" className="w-32" />
        </Labeled>
      </div>
      {error && <div className="mt-3"><ErrorBox message={error} /></div>}
    </Modal>
  );
}

function SupplierForm({ initial, onClose, onSaved }: { initial?: { id: number; name: string; phone: string | null }; onClose: () => void; onSaved: (id: number) => void }) {
  const [name, setName] = useState(initial?.name ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [error, setError] = useState<string | null>(null);
  async function save() {
    try {
      if (initial) {
        await api.updateSupplier(initial.id, name, phone.trim() || null);
        onSaved(initial.id);
      } else onSaved(await api.createSupplier(name, phone.trim() || undefined));
      onClose();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <Modal
      title={initial ? "تعديل صاحب المعدة" : "صاحب معدة جديد"}
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
        <Labeled label="الاسم">
          <TextInput value={name} onChange={(e) => setName(e.target.value)} className="w-60" autoFocus />
        </Labeled>
        <Labeled label="التليفون">
          <TextInput value={phone} onChange={(e) => setPhone(e.target.value)} className="w-40" />
        </Labeled>
      </div>
      {error && <div className="mt-3"><ErrorBox message={error} /></div>}
    </Modal>
  );
}

export default function Suppliers() {
  const [supplierId, setSupplierId] = useState<number | undefined>();
  const [v, setV] = useState<SuppliersView | null>(null);
  const [tab, setTab] = useState<Tab>("statement");
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<null | "newSupplier" | "editSupplier" | "newEquipment" | { equipment: Selected["equipment"][number] }>(null);
  const [deleting, setDeleting] = useState<{ entity: Deletable; id: number } | null>(null);

  const load = useCallback(() => {
    api.suppliers(supplierId).then(setV, (e) => setError(e.message));
  }, [supplierId]);
  useEffect(load, [load]);

  if (!v) return error ? <ErrorBox message={error} /> : <Loading />;
  const s = v.selected;
  const contractChoices = (s?.contracts ?? []).map((c) => ({ id: c.id, label: `${c.code} — ${c.equipment}` }));

  function exportStatement() {
    if (!s) return;
    appApi.exportExcel(`كشف حساب ${s.supplier.name}`, [
      {
        title: "كشف الحساب",
        columns: [
          { header: "الشهر", key: "month", width: 16 },
          { header: "من السركي", key: "fromSarkiPt", money: true },
          { header: "دفعنا عنه", key: "deductionsPt", money: true },
          { header: "اتصرف له", key: "paidPt", money: true },
          { header: "باقي الشهر", key: "monthBalancePt", money: true },
          { header: "الباقي لحد آخر الشهر", key: "runningBalancePt", money: true, width: 22 },
        ],
        rows: s.rows.map((r) => ({ ...r, month: monthLabel(r.month) })),
        totals: { month: "الإجمالي", fromSarkiPt: s.totals.fromSarkiPt, deductionsPt: s.totals.deductionsPt, paidPt: s.totals.paidPt, runningBalancePt: s.totals.remainingPt },
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
      {
        title: "الخصومات",
        columns: [
          { header: "التاريخ", key: "date" },
          { header: "البيان", key: "note", width: 30 },
          { header: "المبلغ", key: "amountPt", money: true },
        ],
        rows: s.deductions.map((d) => ({ date: d.date, note: d.note ?? "", amountPt: d.amountPt })),
      },
    ]);
  }

  const tabs: [Tab, string][] = [
    ["statement", "كشف الحساب"],
    ["equipment", "معداته"],
    ["sheet", "سركي صاحب المعدة"],
    ["deductions", "الخصومات"],
    ["payments", "الدفعات"],
  ];

  return (
    <div className="grid gap-5">
      <PageHeader title="أصحاب المعدات" subtitle="اللي بنأجر منهم المعدات — من غير ضريبة">
        <Button onClick={() => setForm("newSupplier")}>+ صاحب معدة</Button>
        {s && (
          <Button primary onClick={() => setTab("payments")}>
            + دفعة لصاحب معدة
          </Button>
        )}
      </PageHeader>
      {error && <ErrorBox message={error} />}

      {!s ? (
        <Panel>
          <div className="px-4 py-14 text-center grid gap-3 justify-items-center">
            <div className="text-muted">لسه مفيش أصحاب معدات. ضيف أول واحد، أو اعمل عقد جديد من صفحة السركي وهو هيتضاف لوحده.</div>
            <Button primary onClick={() => setForm("newSupplier")}>
              + صاحب معدة
            </Button>
          </div>
        </Panel>
      ) : (
        <div className="grid gap-4 items-start grid-cols-[250px_minmax(0,1fr)] max-[900px]:grid-cols-1">
          <Panel className="no-print grid">
            {v.list.map((x) => (
              <button
                key={x.id}
                onClick={() => setSupplierId(x.id)}
                className={`text-start grid gap-0.5 px-4 py-3 border-b border-line last:border-b-0 ${x.id === s.supplier.id ? "bg-amber-soft shadow-[inset_-4px_0_0_rgb(var(--amber))]" : "hover:bg-surface-2"}`}
              >
                <b>{x.name}</b>
                <small className="text-muted">
                  {x.equipmentCount === 1 ? "معدة واحدة" : `${x.equipmentCount} معدات`}
                  {x.phone ? ` · ${x.phone}` : ""}
                </small>
                <span className={`font-extrabold num ${x.remainingPt > 0 ? "text-out" : "text-in"}`}>باقي له {pounds(x.remainingPt)}</span>
              </button>
            ))}
          </Panel>

          <Panel
            title={s.supplier.name}
            actions={
              <>
                <PrintButtons pdfName={`كشف حساب ${s.supplier.name}`} singlePage={false} />
                <Button onClick={exportStatement}>Excel</Button>
                <Button onClick={() => setForm("editSupplier")}>تعديل</Button>
                <Button danger title="حذف صاحب المعدة" onClick={() => setDeleting({ entity: "suppliers", id: s.supplier.id })}>
                  <Icon name="trash" className="w-4 h-4" />
                </Button>
              </>
            }
          >
            <PrintHeader title={`كشف حساب صاحب المعدة — ${s.supplier.name}`} subtitle={dateLabel(new Date().toLocaleDateString("en-CA"))} />
            <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] border-b border-line">
              <Fact label="إجمالي المستحق له">{pounds(s.totals.fromSarkiPt)}</Fact>
              <Fact label="خصومات (دفعناها عنه)" tone="text-tax">
                {pounds(s.totals.deductionsPt)}
              </Fact>
              <Fact label="اتدفع له" tone="text-in">
                {pounds(s.totals.paidPt)}
              </Fact>
              <Fact label="الباقي له" tone={s.totals.remainingPt > 0 ? "text-out" : "text-in"}>
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
                <PrintSignoff others={["توقيع صاحب المعدة"]} />
                <div className="no-print text-xs text-muted px-4 py-2.5 border-t border-line">ده اللي بيتطبع لصاحب المعدة — مفيهوش أي حاجة عن الشركة أو ربحنا.</div>
              </>
            )}

            {tab === "equipment" && (
              <>
                <div className="no-print px-4 py-3 border-b border-line">
                  <Button onClick={() => setForm("newEquipment")}>+ معدة</Button>
                </div>
                <div className="overflow-x-auto">
                  <table className="tbl">
                    <thead>
                      <tr>
                        <th>المعدة</th>
                        <th>الموقع</th>
                        <th className="n">اليومية المتفق عليها</th>
                        <th>الحالة</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {s.equipment.length === 0 && (
                        <tr>
                          <td colSpan={5} className="text-center text-muted py-6">
                            مفيش معدات متسجلة.
                          </td>
                        </tr>
                      )}
                      {s.equipment.map((e) => (
                        <tr key={e.id}>
                          <td>
                            <b>{e.name}</b>
                          </td>
                          <td>{e.site_name ?? "—"}</td>
                          <td className="n">{e.supplier_rate_pt != null ? pounds(e.supplier_rate_pt) : "—"}</td>
                          <td>{e.working ? <Pill tone="in">شغالة</Pill> : <Pill>فاضية</Pill>}</td>
                          <td className="text-end whitespace-nowrap">
                            <button className="no-print text-xs font-bold text-amber-deep hover:underline me-3" onClick={() => setForm({ equipment: e })}>
                              تعديل
                            </button>
                            <TrashButton title="حذف المعدة" onClick={() => setDeleting({ entity: "equipment", id: e.id })} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {tab === "sheet" && <PartySheetTab key={s.supplier.id} contracts={s.contracts} side="supplier" partyName={s.supplier.name} />}

            {tab === "deductions" && (
              <>
                <MoneyEntry
                  key={`d-${s.supplier.id}`}
                  title="حاجة دفعناها عنه (بتتخصم من حسابه)"
                  contracts={contractChoices}
                  noteRequired
                  notePlaceholder="سولار / قطع غيار / ..."
                  saveLabel="حفظ الخصم"
                  onSave={async (x) => {
                    await api.supplierDeduction({ supplierId: s.supplier.id, contractId: x.contractId, date: x.date, amountPt: x.amountPt, note: x.note, confirmNegative: x.confirmNegative });
                    load();
                  }}
                />
                <MoneyTable rows={s.deductions} noteHeader="البيان" contracts={s.contracts} onDelete={(id) => setDeleting({ entity: "supplier_deductions", id })} />
              </>
            )}

            {tab === "payments" && (
              <>
                <MoneyEntry
                  key={`p-${s.supplier.id}`}
                  title="دفعة جديدة لصاحب المعدة"
                  contracts={contractChoices}
                  notePlaceholder="كاش / تحويل / شيك رقم ..."
                  saveLabel="حفظ الدفعة"
                  onSave={async (x) => {
                    await api.supplierPayment({ supplierId: s.supplier.id, contractId: x.contractId, date: x.date, amountPt: x.amountPt, note: x.note || undefined, confirmNegative: x.confirmNegative });
                    load();
                  }}
                />
                <MoneyTable rows={s.payments} noteHeader="ملاحظة" contracts={s.contracts} onDelete={(id) => setDeleting({ entity: "supplier_payments", id })} />
              </>
            )}
          </Panel>
        </div>
      )}

      {(form === "newSupplier" || (form === "editSupplier" && s)) && (
        <SupplierForm
          initial={form === "editSupplier" ? s!.supplier : undefined}
          onClose={() => setForm(null)}
          onSaved={(id) => {
            setSupplierId(id);
            load();
          }}
        />
      )}
      {s && (form === "newEquipment" || (form && typeof form === "object")) && (
        <EquipmentForm supplierId={s.supplier.id} initial={typeof form === "object" && form ? form.equipment : undefined} onClose={() => setForm(null)} onSaved={load} />
      )}
      {deleting && (
        <ConfirmDelete
          entity={deleting.entity}
          id={deleting.id}
          onClose={() => setDeleting(null)}
          onDeleted={() => {
            if (deleting.entity === "suppliers") setSupplierId(undefined);
            load();
          }}
        />
      )}
    </div>
  );
}
