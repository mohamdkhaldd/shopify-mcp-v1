import { useCallback, useEffect, useState } from "react";
import { api, ApiError, appApi, Deletable, InvestorsView } from "../../api/client";
import { Button, ErrorBox, Kpi, Loading, Money, Note, PageHeader, Panel, Pill } from "../../components/ui";
import { Labeled, Select, TextInput } from "../../components/Field";
import { PrintButtons, PrintHeader } from "../../components/Print";
import ConfirmDelete from "../../components/ConfirmDelete";
import Modal from "../../components/Modal";
import { TrashButton } from "../../components/party";
import { dateLabel, monthLabel, percentFromBp, pounds } from "../../utils/format";
import { moneyToPt } from "../../utils/input";
import { today } from "../../../core/db";

type Investor = InvestorsView["investors"][number];

function InvestorForm({ initial, onClose, onSaved }: { initial?: Investor; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(initial?.name ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [error, setError] = useState<string | null>(null);
  return (
    <Modal
      title={initial ? "تعديل المستثمر" : "مستثمر جديد"}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>إلغاء</Button>
          <Button
            primary
            onClick={async () => {
              try {
                if (initial) await api.updateInvestor(initial.investorId, name, phone.trim() || null);
                else await api.createInvestor(name, phone.trim() || undefined);
                onSaved();
                onClose();
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
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
      <div className="text-xs text-muted mt-3">رأس المال بيتسجل بعد كده من "إيداع / سحب".</div>
      {error && (
        <div className="mt-3">
          <ErrorBox message={error} />
        </div>
      )}
    </Modal>
  );
}

/** Deposit / withdrawal, or a profit payout (optionally put back into his capital). */
function MoneyForm({ mode, v, onSaved }: { mode: "capital" | "payout"; v: InvestorsView; onSaved: (msg: string) => void }) {
  const [investor, setInvestor] = useState(String(v.investors[0]?.investorId ?? ""));
  const [kind, setKind] = useState<"deposit" | "withdrawal">("deposit");
  const [date, setDate] = useState(today());
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [reinvest, setReinvest] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmCash, setConfirmCash] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inv = v.investors.find((i) => String(i.investorId) === investor);

  async function save(confirmNegative = false) {
    setError(null);
    setBusy(true);
    try {
      const amountPt = moneyToPt(amount);
      if (!amountPt || amountPt <= 0) throw new Error("اكتب المبلغ");
      const investorId = Number(investor);
      if (mode === "capital") {
        await api.capital({ investorId, kind, date, amountPt, note: note.trim() || undefined, confirmNegative });
        onSaved(kind === "deposit" ? "الإيداع اتسجل" : "السحب اتسجل");
      } else if (reinvest) {
        await api.reinvest({ investorId, date, amountPt });
        onSaved("الأرباح اتحطت في رأس ماله");
      } else {
        await api.investorPayout({ investorId, date, amountPt, note: note.trim() || undefined, confirmNegative });
        onSaved("الصرف اتسجل");
      }
      setAmount("");
      setNote("");
      setConfirmCash(null);
    } catch (e) {
      if (e instanceof ApiError && e.code === "cash_negative") setConfirmCash(e.message);
      else setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="no-print grid gap-2 px-4 py-3 border-b border-line bg-surface-2">
      <div className="flex flex-wrap items-end gap-2.5">
        <Labeled label="المستثمر">
          <Select value={investor} onChange={(e) => setInvestor(e.target.value)}>
            {v.investors.map((i) => (
              <option key={i.investorId} value={i.investorId}>
                {i.name}
              </option>
            ))}
          </Select>
        </Labeled>
        {mode === "capital" && (
          <Labeled label="النوع">
            <Select value={kind} onChange={(e) => setKind(e.target.value as "deposit" | "withdrawal")}>
              <option value="deposit">إيداع</option>
              <option value="withdrawal">سحب</option>
            </Select>
          </Labeled>
        )}
        <Labeled label="التاريخ">
          <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-36" />
        </Labeled>
        <Labeled label={mode === "payout" && inv ? `المبلغ (ينفع لحد ${pounds(inv.payableNowPt)})` : "المبلغ"}>
          <TextInput value={amount} onChange={(e) => setAmount(e.target.value)} className="w-32" inputMode="decimal" />
        </Labeled>
        {!(mode === "payout" && reinvest) && (
          <Labeled label="ملاحظة">
            <TextInput value={note} onChange={(e) => setNote(e.target.value)} className="w-44" />
          </Labeled>
        )}
        {mode === "payout" && (
          <label className="flex items-center gap-1.5 text-sm font-semibold self-center">
            <input type="checkbox" checked={reinvest} onChange={(e) => setReinvest(e.target.checked)} /> حطها في رأس ماله بدل ما ياخدها
          </label>
        )}
        <Button primary onClick={() => save()} disabled={busy || !investor}>
          حفظ
        </Button>
      </div>
      {error && <ErrorBox message={error} />}
      {confirmCash && (
        <div className="flex flex-wrap items-center gap-3 rounded-card border border-amber bg-amber-soft px-4 py-2.5 font-semibold">
          <span>⚠ {confirmCash}</span>
          <Button danger onClick={() => save(true)} disabled={busy}>
            أيوه، اصرف
          </Button>
          <Button onClick={() => setConfirmCash(null)}>لأ</Button>
        </div>
      )}
    </div>
  );
}

export default function Investors() {
  const [month, setMonth] = useState<string | undefined>();
  const [v, setV] = useState<InvestorsView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [form, setForm] = useState<null | "new" | { edit: Investor }>(null);
  const [deleting, setDeleting] = useState<{ entity: Deletable; id: number } | null>(null);

  const load = useCallback(() => {
    api.investors(month).then(setV, (e) => setError(e.message));
  }, [month]);
  useEffect(load, [load]);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 3000);
    return () => clearTimeout(t);
  }, [notice]);

  if (!v) return error ? <ErrorBox message={error} /> : <Loading />;
  const t = v.totals;
  const saved = (msg: string) => {
    setNotice(msg);
    load();
  };

  function exportExcel() {
    if (!v) return;
    appApi.exportExcel("المستثمرين", [
      {
        title: "المستثمرين",
        columns: [
          { header: "المستثمر", key: "name", width: 22 },
          { header: "رأس المال", key: "capitalPt", money: true },
          { header: "نسبته ٪", key: "share" },
          { header: "فلوسه الشغالة", key: "inUsePt", money: true },
          { header: "ربح مستحق", key: "accruedPt", money: true },
          { header: "ينفع يتصرف", key: "payableNowPt", money: true },
          { header: "اتصرف له", key: "paidPt", money: true },
          { header: "الباقي له", key: "owedPt", money: true },
        ],
        rows: v.investors.map((i) => ({ name: i.name, capitalPt: i.capitalPt, share: i.shareBp / 100, inUsePt: i.inUsePt, accruedPt: i.accruedPt, payableNowPt: i.payableNowPt, paidPt: i.paidPt, owedPt: i.owedPt })),
      },
      {
        title: "حركة رأس المال",
        columns: [
          { header: "التاريخ", key: "date" },
          { header: "المستثمر", key: "name", width: 22 },
          { header: "النوع", key: "kind" },
          { header: "المبلغ", key: "amount_pt", money: true },
        ],
        rows: v.movements.map((m) => ({ date: m.date, name: m.name, kind: m.kind === "deposit" ? "إيداع" : "سحب", amount_pt: m.amount_pt })),
      },
      {
        title: "صرف الأرباح",
        columns: [
          { header: "التاريخ", key: "date" },
          { header: "المستثمر", key: "name", width: 22 },
          { header: "ملاحظة", key: "note", width: 26 },
          { header: "المبلغ", key: "amount_pt", money: true },
        ],
        rows: v.payouts.map((p) => ({ date: p.date, name: p.name, note: p.note ?? "", amount_pt: p.amount_pt })),
      },
    ]);
  }

  return (
    <div className="grid gap-5">
      <PrintHeader title="المستثمرين" subtitle={dateLabel(new Date().toLocaleDateString("en-CA"))} />
      <PageHeader title="المستثمرين" subtitle="رأس المال والأرباح — الأرباح بتتصرف كل ٣ شهور">
        <Button onClick={() => setForm("new")}>+ مستثمر</Button>
        <PrintButtons pdfName="المستثمرين" singlePage={false} />
        <Button onClick={exportExcel}>Excel</Button>
      </PageHeader>
      {notice && <div className="no-print rounded-card border border-in bg-in-soft px-4 py-2.5 font-semibold">{notice}</div>}
      {error && <ErrorBox message={error} />}

      <div className="grid gap-3.5 grid-cols-4 max-[1000px]:grid-cols-2">
        <Kpi label="إجمالي رأس المال" value={<Money pt={pounds(t.capitalPt)} />} sub={<>في الخزنة {pounds(t.inTreasuryPt)}</>} />
        <Kpi label="منه شغال عند الموردين" value={<Money pt={pounds(t.deployedPt)} />} sub="اتدفع للموردين ولسه متحصّلش" />
        <Kpi tone="hero" label="أرباح المستثمرين لحد النهارده" value={<Money pt={pounds(t.accruedPt)} />} sub={<>ينفع يتصرف منها دلوقتي {pounds(t.payableNowPt)}</>} />
        <Kpi label="الصرف الجاي" value={<span className="text-lg">آخر {monthLabel(v.nextPayoutMonth)}</span>} sub="الأرباح بتتصرف كل ٣ شهور" />
      </div>

      <Panel title="المستثمرين" hint="الربح بيتقسم بالفلوس × عدد الأيام في الشهر">
        {v.investors.length === 0 ? (
          <div className="px-4 py-12 text-center grid gap-3 justify-items-center">
            <div className="text-muted">لسه مفيش مستثمرين. ضيف أول مستثمر وبعدين سجّل إيداعه.</div>
            <Button primary onClick={() => setForm("new")}>
              + مستثمر
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>المستثمر</th>
                  <th className="n">رأس المال</th>
                  <th className="n">نسبته</th>
                  <th className="n">فلوسه الشغالة</th>
                  <th className="n">ربح مستحق</th>
                  <th className="n">ينفع يتصرف</th>
                  <th className="n">اتصرف له</th>
                  <th className="n">الباقي له</th>
                  <th className="n">العائد الشهري</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {v.investors.map((i) => (
                  <tr key={i.investorId}>
                    <td>
                      <b>{i.name}</b>
                      {i.phone && <div className="text-xs text-muted">{i.phone}</div>}
                    </td>
                    <td className="n">{pounds(i.capitalPt)}</td>
                    <td className="n">{percentFromBp(i.shareBp)}</td>
                    <td className="n">{pounds(i.inUsePt)}</td>
                    <td className="n font-bold">{pounds(i.accruedPt)}</td>
                    <td className="n text-in font-bold">{pounds(i.payableNowPt)}</td>
                    <td className="n">{pounds(i.paidPt)}</td>
                    <td className="n">{pounds(i.owedPt)}</td>
                    <td className="n">{percentFromBp(i.monthlyReturnBp)}</td>
                    <td className="text-end whitespace-nowrap">
                      <button className="no-print text-xs font-bold text-amber-deep hover:underline me-3" onClick={() => setForm({ edit: i })}>
                        تعديل
                      </button>
                      <TrashButton title="حذف المستثمر" onClick={() => setDeleting({ entity: "investors", id: i.investorId })} />
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td>الإجمالي</td>
                  <td className="n">{pounds(t.capitalPt)}</td>
                  <td className="n">100٪</td>
                  <td className="n">{pounds(t.deployedPt)}</td>
                  <td className="n">{pounds(t.accruedPt)}</td>
                  <td className="n">{pounds(t.payableNowPt)}</td>
                  <td className="n">{pounds(t.paidPt)}</td>
                  <td className="n">{pounds(t.accruedPt - t.paidPt)}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
        <Note>"ينفع يتصرف" = نصيبه × اللي العملاء دفعوه من فواتير الشهر (دفعوا ٥٠٪ → يتصرف نص النصيب). الباقي يتصرف لما العملاء يكمّلوا.</Note>
      </Panel>

      <Panel
        title="نصيب كل مستثمر اتحسب إزاي؟"
        actions={
          <Select aria-label="الشهر" value={v.month} onChange={(e) => setMonth(e.target.value)}>
            {[...v.months].reverse().map((m) => (
              <option key={m.month} value={m.month}>
                {monthLabel(m.month)}
                {m.closed ? " (مقفول)" : ""}
              </option>
            ))}
          </Select>
        }
      >
        <div className="px-4 py-3 text-[13px] leading-[1.9] text-muted">
          نصيب المستثمرين في {monthLabel(v.month)} <b className="text-fg">{pounds(v.month_?.poolPt ?? 0)}</b>. بيتقسم على قد فلوس كل واحد <b className="text-fg">وعدد الأيام اللي فلوسه قعدتها معانا في الشهر</b> — يوم الإيداع بيتحسب، ويوم السحب لأ.
        </div>
        <div className="overflow-x-auto">
          <table className="tbl">
            <thead>
              <tr>
                <th>المستثمر</th>
                <th className="n">فلوسه آخر الشهر</th>
                <th className="n">أيامها في الشهر</th>
                <th className="n">النسبة</th>
                <th className="n">النصيب</th>
              </tr>
            </thead>
            <tbody>
              {v.split.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center text-muted py-6">
                    مفيش أرباح بتتقسم في الشهر ده.
                  </td>
                </tr>
              )}
              {v.split.map((s) => (
                <tr key={s.investorId}>
                  <td>{s.name}</td>
                  <td className="n">{pounds(s.capitalAtEndPt)}</td>
                  <td className="n">{s.daysPresent}</td>
                  <td className="n">{percentFromBp(s.shareBp)}</td>
                  <td className="n font-bold">{pounds(s.sharePt)}</td>
                </tr>
              ))}
            </tbody>
            {v.split.length > 0 && (
              <tfoot>
                <tr>
                  <td colSpan={4}>الإجمالي {v.month_ && v.month_.remainderToManagementPt > 0 ? `(كسور القروش للإدارة: ${pounds(v.month_.remainderToManagementPt)})` : ""}</td>
                  <td className="n">{pounds(v.split.reduce((a, s) => a + s.sharePt, 0))}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </Panel>

      {v.investors.length > 0 && (
        <div className="grid gap-3.5 items-start grid-cols-2 max-[1100px]:grid-cols-1">
          <Panel title="إيداع / سحب رأس مال">
            <MoneyForm mode="capital" v={v} onSaved={saved} />
            <div className="overflow-x-auto">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>التاريخ</th>
                    <th>المستثمر</th>
                    <th>النوع</th>
                    <th className="n">المبلغ</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {v.movements.map((m) => (
                    <tr key={m.id}>
                      <td>{dateLabel(m.date)}</td>
                      <td>{m.name}</td>
                      <td>{m.kind === "deposit" ? <Pill tone="in">إيداع</Pill> : <Pill tone="out">سحب</Pill>}</td>
                      <td className="n font-bold">{pounds(m.amount_pt)}</td>
                      <td className="text-end">
                        <TrashButton title="حذف" onClick={() => setDeleting({ entity: "capital_movements", id: m.id })} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
          <Panel title="صرف أرباح" hint={`الصرف الجاي آخر ${monthLabel(v.nextPayoutMonth)}`}>
            <MoneyForm mode="payout" v={v} onSaved={saved} />
            <div className="overflow-x-auto">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>التاريخ</th>
                    <th>المستثمر</th>
                    <th>ملاحظة</th>
                    <th className="n">المبلغ</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {v.payouts.length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-center text-muted py-6">
                        لسه مفيش صرف أرباح.
                      </td>
                    </tr>
                  )}
                  {v.payouts.map((p) => (
                    <tr key={p.id}>
                      <td>{dateLabel(p.date)}</td>
                      <td>{p.name}</td>
                      <td>{p.note ?? ""}</td>
                      <td className="n font-bold">{pounds(p.amount_pt)}</td>
                      <td className="text-end">
                        <TrashButton title="حذف" onClick={() => setDeleting({ entity: "profit_payouts", id: p.id })} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>
      )}

      {form && <InvestorForm initial={form === "new" ? undefined : form.edit} onClose={() => setForm(null)} onSaved={load} />}
      {deleting && <ConfirmDelete entity={deleting.entity} id={deleting.id} onClose={() => setDeleting(null)} onDeleted={load} />}
    </div>
  );
}
