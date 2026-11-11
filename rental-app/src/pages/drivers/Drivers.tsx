import { useCallback, useEffect, useState } from "react";
import { api, Deletable, DriversView } from "../../api/client";
import { Button, ErrorBox, Kpi, Loading, PageHeader, Panel } from "../../components/ui";
import { Labeled, Select, TextInput } from "../../components/Field";
import { PrintButtons, PrintHeader, PrintSignoff } from "../../components/Print";
import ConfirmDelete from "../../components/ConfirmDelete";
import { TrashButton } from "../../components/party";
import Modal from "../../components/Modal";
import MoneyEntry from "../../components/MoneyEntry";
import Icon from "../../components/Icon";
import { today } from "../../../core/db";
import { moneyToPt } from "../../utils/input";
import { dateLabel, monthLabel, pounds } from "../../utils/format";

// السواقين: كل سواق على معدة صاحب معدة وحسابه لوحده. أي فلوس بنديها للسواق
// بتتخصم من صاحب المعدة لوحدها (بتظهر في تصفيته "للسواق فلان").

type Driver = DriversView["drivers"][number];

/** آخر ١٢ شهر لحد الشهر ده */
const recentMonths = () => {
  const out: string[] = [];
  const d = new Date(`${today().slice(0, 7)}-01T00:00:00`);
  for (let i = 0; i < 12; i++) {
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    d.setMonth(d.getMonth() - 1);
  }
  return out;
};

const payLabel = (d: Pick<Driver, "payKind" | "ratePt" | "overtimeRatePt">) =>
  `${d.payKind === "month" ? "مرتب شهري" : "يومية"} ${pounds(d.ratePt)} · ساعة الأوفر ${pounds(d.overtimeRatePt)}`;

function DriverForm({ v, initial, onClose, onSaved }: { v: DriversView; initial?: Driver; onClose: () => void; onSaved: (id: number) => void }) {
  const [name, setName] = useState(initial?.name ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [supplierId, setSupplierId] = useState(initial ? String(initial.supplierId) : "");
  const [equipmentId, setEquipmentId] = useState(initial?.equipmentId ? String(initial.equipmentId) : "");
  const [payKind, setPayKind] = useState<"month" | "day">(initial?.payKind ?? "month");
  const [rate, setRate] = useState(initial?.ratePt ? String(initial.ratePt / 100) : "");
  const [otRate, setOtRate] = useState(initial?.overtimeRateSetPt != null ? String(initial.overtimeRateSetPt / 100) : "");
  const [startDate, setStartDate] = useState(initial?.startDate ?? today());
  const [error, setError] = useState<string | null>(null);
  const machines = v.equipment.filter((e) => String(e.supplierId) === supplierId);

  async function save() {
    setError(null);
    try {
      const input = {
        name,
        phone: phone.trim() || null,
        supplierId: Number(supplierId),
        equipmentId: equipmentId ? Number(equipmentId) : null,
        payKind,
        ratePt: moneyToPt(rate),
        overtimeRatePt: moneyToPt(otRate),
        startDate,
      };
      if (!supplierId) throw new Error("اختار صاحب المعدة");
      if (initial) {
        await api.updateDriver({ ...input, id: initial.id });
        onSaved(initial.id);
      } else onSaved(await api.createDriver(input));
      onClose();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <Modal
      title={initial ? "تعديل السواق" : "سواق جديد"}
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
      <div className="grid gap-3 sm:grid-cols-2">
        <Labeled label="اسم السواق">
          <TextInput value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </Labeled>
        <Labeled label="التليفون">
          <TextInput value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" />
        </Labeled>
        <Labeled label="صاحب المعدة">
          <Select
            value={supplierId}
            onChange={(e) => {
              setSupplierId(e.target.value);
              setEquipmentId("");
            }}
          >
            <option value="">اختار…</option>
            {v.suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </Labeled>
        <Labeled label="على أنهي معدة">
          <Select value={equipmentId} onChange={(e) => setEquipmentId(e.target.value)} disabled={!supplierId}>
            <option value="">—</option>
            {machines.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </Select>
        </Labeled>
        <Labeled label="المرتب">
          <Select value={payKind} onChange={(e) => setPayKind(e.target.value as "month" | "day")}>
            <option value="month">شهري</option>
            <option value="day">يومية (× أيام شغل المعدة)</option>
          </Select>
        </Labeled>
        <Labeled label={payKind === "month" ? "المرتب في الشهر (ج)" : "اليومية (ج)"}>
          <TextInput value={rate} onChange={(e) => setRate(e.target.value)} inputMode="decimal" />
        </Labeled>
        <Labeled label="سعر ساعة الأوفر (ج)">
          <TextInput value={otRate} onChange={(e) => setOtRate(e.target.value)} inputMode="decimal" placeholder={payKind === "month" ? "تلقائي: المرتب ÷ ٣٠ ÷ ٨" : "تلقائي: اليومية ÷ ٨"} />
        </Labeled>
        <Labeled label="بدأ الشغل يوم">
          <TextInput type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </Labeled>
      </div>
      <p className="mt-3 text-xs text-muted">أي يوم المعدة اشتغلت فيه في السركي = يوم كامل للسواق حتى لو ساعة، والأوفر بيتحسب فوقه. أي فلوس بتديها للسواق بتتخصم من صاحب المعدة.</p>
      {error && (
        <div className="mt-3">
          <ErrorBox message={error} />
        </div>
      )}
    </Modal>
  );
}

/** التصفية الشهرية — اللي بتتطبع وتتبعت للسواق PDF */
function Settlement({ d, v }: { d: Driver; v: DriversView }) {
  const rows: [string, string, string?][] = [
    ["السواق", d.name, "font-bold"],
    ["المعدة", `${d.equipmentName ?? "—"} — صاحبها ${d.supplierName}`],
    ["الشهر", monthLabel(v.month)],
    ["أيام الشغل", `${d.days} يوم`],
    d.payKind === "day" ? ["اليومية", `${d.days} يوم × ${pounds(d.ratePt)} = ${pounds(d.basePt)}`] : ["المرتب الشهري", pounds(d.basePt)],
    ["الأوفر", d.overtimeHours ? `${d.overtimeHours.toLocaleString("en-US")} ساعة × ${pounds(d.overtimeRatePt)} = ${pounds(d.overtimePt)}` : "—"],
    ["مستحق الشهر", pounds(d.earnedPt), "font-bold"],
  ];
  if (d.previousPt !== 0) rows.push([d.previousPt > 0 ? "باقي له من قبل كده" : "واخد زيادة من قبل كده", pounds(Math.abs(d.previousPt))]);
  rows.push(["اتصرف له الشهر ده", pounds(d.paidPt), "text-in"]);
  return (
    <div>
      <table className="tbl">
        <tbody>
          {rows.map(([k, val, cls]) => (
            <tr key={k}>
              <td>{k}</td>
              <td className={`num ${cls ?? ""}`}>{val}</td>
            </tr>
          ))}
          <tr>
            <td className="font-bold">الباقي له</td>
            <td className={`num font-extrabold text-lg ${d.remainingPt > 0 ? "text-out" : "text-in"}`}>{pounds(d.remainingPt)}</td>
          </tr>
        </tbody>
      </table>
      {v.payments.length > 0 && (
        <>
          <div className="px-4 pt-4 pb-2 font-display font-bold text-[15px]">الفلوس اللي خدها الشهر ده</div>
          <table className="tbl">
            <thead>
              <tr>
                <th>التاريخ</th>
                <th className="n">المبلغ</th>
                <th>البيان</th>
              </tr>
            </thead>
            <tbody>
              {v.payments.map((p) => (
                <tr key={p.id}>
                  <td className="num">{dateLabel(p.date)}</td>
                  <td className="n">{pounds(p.amountPt)}</td>
                  <td>{(p.note ?? "").replace(`للسواق ${d.name}`, "").replace(/^ — /, "") || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
      <PrintSignoff others={["توقيع السواق"]} />
    </div>
  );
}

export default function Drivers({ initialId, initialMonth }: { initialId?: number; initialMonth?: string } = {}) {
  const [month, setMonth] = useState(initialMonth ?? today().slice(0, 7));
  const [driverId, setDriverId] = useState<number | undefined>(initialId);
  const [v, setV] = useState<DriversView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<null | "new" | "edit">(null);
  const [tab, setTab] = useState<"settlement" | "pay">("settlement");
  const [deleting, setDeleting] = useState<{ entity: Deletable; id: number } | null>(null);

  const load = useCallback(() => {
    api.drivers(month, driverId).then(setV, (e) => setError((e as Error).message));
  }, [month, driverId]);
  useEffect(load, [load]);

  if (error) return <ErrorBox message={error} />;
  if (!v) return <Loading />;
  const d = v.selected;
  const owedTotal = v.drivers.reduce((s, x) => s + Math.max(0, x.remainingPt), 0);

  return (
    <div>
      <PageHeader title="السواقين" subtitle="السواقين اللي إحنا بنقبّضهم — أي فلوس بتديها للسواق بتتخصم من صاحب المعدة">
        <Select aria-label="الشهر" value={month} onChange={(e) => setMonth(e.target.value)}>
          {recentMonths().map((m) => (
            <option key={m} value={m}>
              {monthLabel(m)}
            </option>
          ))}
        </Select>
        <Button primary onClick={() => setForm("new")}>
          + سواق
        </Button>
      </PageHeader>

      {!d && (
        <>
          <div className="no-print grid grid-cols-2 gap-3 mb-4">
            <Kpi label="عدد السواقين" value={v.drivers.length} />
            <Kpi tone="tax" label="لسه ليهم عندنا" value={pounds(owedTotal)} />
          </div>
          <Panel title="السواقين">
            {v.drivers.length === 0 && <div className="px-4 py-8 text-center text-muted">لسه مفيش سواقين — اضغط «+ سواق».</div>}
            {v.drivers.map((x) => (
              <button key={x.id} onClick={() => setDriverId(x.id)} className="w-full text-start grid gap-0.5 px-4 py-3 border-b border-line last:border-b-0 hover:bg-surface-2">
                <b className="text-[15px]">{x.name}</b>
                <small className="text-muted">
                  {x.equipmentName ?? "من غير معدة"} — {x.supplierName}
                </small>
                <span className={`font-extrabold num ${x.remainingPt > 0 ? "text-out" : "text-in"}`}>باقي له {pounds(x.remainingPt)}</span>
              </button>
            ))}
          </Panel>
        </>
      )}

      {d && (
        <>
          <div className="no-print mb-3">
            <button className="font-bold text-amber-deep hover:underline" onClick={() => setDriverId(undefined)}>
              ‹ كل السواقين
            </button>
          </div>
          <div className="no-print grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
            <Kpi label={`مستحق ${monthLabel(v.month)}`} value={pounds(d.earnedPt)} sub={`${d.days} يوم${d.overtimeHours ? ` + ${d.overtimeHours.toLocaleString("en-US")} ساعة أوفر` : ""}`} />
            <Kpi tone="good" label="اتصرف له الشهر ده" value={pounds(d.paidPt)} />
            <Kpi tone={d.remainingPt > 0 ? "tax" : "good"} label="الباقي له" value={pounds(d.remainingPt)} />
          </div>
          <Panel
            title={d.name}
            hint={`${d.equipmentName ?? "من غير معدة"} — ${d.supplierName} · ${payLabel(d)}`}
            actions={
              <>
                <PrintButtons pdfName={`تصفية السواق ${d.name} ${monthLabel(v.month)}`} />
                <Button onClick={() => setForm("edit")}>تعديل</Button>
                <Button danger title="حذف السواق" onClick={() => setDeleting({ entity: "drivers", id: d.id })}>
                  <Icon name="trash" className="w-4 h-4" />
                </Button>
              </>
            }
          >
            <PrintHeader title={`تصفية السواق — ${d.name}`} subtitle={monthLabel(v.month)} />
            <div className="no-print flex gap-1 border-b border-line px-3 overflow-x-auto">
              {(
                [
                  ["settlement", "التصفية"],
                  ["pay", "اديله فلوس"],
                ] as const
              ).map(([id, label]) => (
                <button key={id} onClick={() => setTab(id)} className={`px-3 py-2.5 font-bold border-b-[3px] whitespace-nowrap ${tab === id ? "border-amber text-fg" : "border-transparent text-muted"}`}>
                  {label}
                </button>
              ))}
            </div>
            {tab === "settlement" && <Settlement d={d} v={v} />}
            {tab === "pay" && (
              <>
                <MoneyEntry
                  direction="out"
                  key={`p-${d.id}`}
                  title={`فلوس للسواق ${d.name} — بتتخصم من ${d.supplierName}`}
                  contracts={[]}
                  notePlaceholder="مرتب / سلفة / ..."
                  saveLabel="حفظ"
                  onSave={async (x) => {
                    await api.driverPayment({ driverId: d.id, date: x.date, amountPt: x.amountPt, note: x.note || undefined, confirmNegative: x.confirmNegative, ...x.money });
                    load();
                  }}
                />
                <div className="overflow-x-auto">
                  <table className="tbl">
                    <thead>
                      <tr>
                        <th>التاريخ</th>
                        <th className="n">المبلغ</th>
                        <th>البيان</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {v.payments.length === 0 && (
                        <tr>
                          <td colSpan={4} className="text-center text-muted py-6">
                            مفيش فلوس اتصرفت الشهر ده.
                          </td>
                        </tr>
                      )}
                      {v.payments.map((p) => (
                        <tr key={p.id}>
                          <td className="num">{dateLabel(p.date)}</td>
                          <td className="n">{pounds(p.amountPt)}</td>
                          <td>{p.note}</td>
                          <td className="text-end">
                            <TrashButton title="حذف" onClick={() => setDeleting({ entity: "supplier_deductions", id: p.id })} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </Panel>
        </>
      )}

      {form && <DriverForm v={v} initial={form === "edit" ? d ?? undefined : undefined} onClose={() => setForm(null)} onSaved={(id) => (setDriverId(id), load())} />}
      {deleting && (
        <ConfirmDelete
          entity={deleting.entity}
          id={deleting.id}
          onClose={() => setDeleting(null)}
          onDeleted={() => {
            if (deleting.entity === "drivers") setDriverId(undefined);
            load();
          }}
        />
      )}
    </div>
  );
}
