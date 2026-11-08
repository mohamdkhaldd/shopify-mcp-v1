import { useCallback, useEffect, useState } from "react";
import { api, appApi, TreasuryFilters, TreasuryView } from "../../api/client";
import { ErrorBox, Kpi, Loading, Money, Note, PageHeader, Panel, Pill, Button } from "../../components/ui";
import { Labeled, Select, TextInput } from "../../components/Field";
import { PrintButtons, PrintHeader } from "../../components/Print";
import { dateLabel, pounds } from "../../utils/format";
import { moneyToPt } from "../../utils/input";
import { today } from "../../../core/db";
import { feeOf, reloadAccounts } from "../../components/AccountFields";
import ConfirmDelete from "../../components/ConfirmDelete";
import { TrashButton } from "../../components/party";

/** نقل فلوس من حساب لحساب (من انستا باي للمحفظة مثلًا) — "تحويل" عليه عمولة الحساب. */
function TransferForm({ v, onSaved }: { v: TreasuryView; onSaved: () => void }) {
  const [from, setFrom] = useState(v.accounts[0]?.key ?? "");
  const [to, setTo] = useState(v.accounts[1]?.key ?? "");
  const [date, setDate] = useState(today());
  const [amount, setAmount] = useState("");
  const [kind, setKind] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const acc = v.accounts.find((a) => a.key === from);
  const hasFee = !!acc && (acc.feeBp > 0 || acc.feeMinPt > 0);
  let amountPt = 0;
  try {
    amountPt = moneyToPt(amount) ?? 0;
  } catch {
    /* typing */
  }
  async function save() {
    setError(null);
    try {
      if (!(amountPt > 0)) throw new Error("اكتب المبلغ");
      if (hasFee && !kind) throw new Error("اختار: تحويل ولا دفع؟");
      await api.transfer({ date, from, to, amountPt, note: note.trim() || undefined, transferFee: kind === "transfer" });
      setAmount("");
      setNote("");
      setKind("");
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <div className="no-print grid gap-2 px-4 py-3">
      <div className="flex flex-wrap items-end gap-2.5">
        <Labeled label="من">
          <Select value={from} onChange={(e) => setFrom(e.target.value)}>
            {v.accounts.map((a) => (
              <option key={a.key} value={a.key}>
                {a.name}
              </option>
            ))}
          </Select>
        </Labeled>
        <Labeled label="إلى">
          <Select value={to} onChange={(e) => setTo(e.target.value)}>
            {v.accounts.map((a) => (
              <option key={a.key} value={a.key}>
                {a.name}
              </option>
            ))}
          </Select>
        </Labeled>
        <Labeled label="التاريخ">
          <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-36" />
        </Labeled>
        <Labeled label="المبلغ">
          <TextInput value={amount} onChange={(e) => setAmount(e.target.value)} className="w-28" inputMode="decimal" />
        </Labeled>
        {hasFee && (
          <Labeled label="تحويل ولا دفع؟">
            <Select value={kind} onChange={(e) => setKind(e.target.value)}>
              <option value="">— اختار —</option>
              <option value="transfer">تحويل (عليه عمولة{feeOf(acc, amountPt) ? ` ${pounds(feeOf(acc, amountPt))}` : ""})</option>
              <option value="pay">من غير عمولة</option>
            </Select>
          </Labeled>
        )}
        <Labeled label="ملاحظة">
          <TextInput value={note} onChange={(e) => setNote(e.target.value)} className="w-40" />
        </Labeled>
        <Button primary onClick={save}>
          حوّل
        </Button>
      </div>
      {error && <ErrorBox message={error} />}
    </div>
  );
}

/** فلوس موجودة في الخزنة بس مش في إيدك (مع شريك…) — بتطلع من الرصيد لحد ما ترجع. */
function HoldForm({ v, onSaved }: { v: TreasuryView; onSaved: () => void }) {
  const [account, setAccount] = useState(v.accounts[0]?.key ?? "");
  const [date, setDate] = useState(today());
  const [amount, setAmount] = useState("");
  const [who, setWho] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  async function save() {
    setError(null);
    try {
      const amountPt = moneyToPt(amount);
      if (!amountPt || amountPt <= 0) throw new Error("اكتب المبلغ");
      if (!who.trim()) throw new Error("اكتب الفلوس مع مين");
      await api.hold({ date, account, amountPt, heldBy: who.trim(), note: note.trim() || undefined });
      setAmount("");
      setWho("");
      setNote("");
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <div className="no-print grid gap-2 px-4 py-3 border-b border-line bg-surface-2">
      <div className="flex flex-wrap items-end gap-2.5">
        <b className="w-full text-xs text-muted">فلوس من الخزنة بس مش معاك دلوقتي (مع شريك / مندوب) — بتطلع من الرصيد لحد ما ترجع</b>
        <Labeled label="من حساب">
          <Select value={account} onChange={(e) => setAccount(e.target.value)}>
            {v.accounts.map((a) => (
              <option key={a.key} value={a.key}>
                {a.name}
              </option>
            ))}
          </Select>
        </Labeled>
        <Labeled label="المبلغ">
          <TextInput value={amount} onChange={(e) => setAmount(e.target.value)} className="w-28" inputMode="decimal" />
        </Labeled>
        <Labeled label="مع مين؟">
          <TextInput value={who} onChange={(e) => setWho(e.target.value)} className="w-40" placeholder="م. كريم" />
        </Labeled>
        <Labeled label="من يوم">
          <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-36" />
        </Labeled>
        <Labeled label="ملاحظة">
          <TextInput value={note} onChange={(e) => setNote(e.target.value)} className="w-40" />
        </Labeled>
        <Button primary onClick={save}>
          سجّل
        </Button>
      </div>
      {error && <ErrorBox message={error} />}
    </div>
  );
}

/** نسبة عمولة التحويل لكل حساب (انستا باي: ٠٫١٪، أقل حاجة ٠٫٥ ج، أقصى ٢٠ ج). */
function FeeSettings({ v, onSaved }: { v: TreasuryView; onSaved: () => void }) {
  const [rows, setRows] = useState(v.accounts.map((a) => ({ key: a.key, name: a.name, pct: String(a.feeBp / 100), min: String(a.feeMinPt / 100), max: a.feeMaxPt == null ? "" : String(a.feeMaxPt / 100) })));
  const [msg, setMsg] = useState<string | null>(null);
  const set = (i: number, patch: Partial<(typeof rows)[number]>) => setRows((r) => r.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  async function save() {
    setMsg(null);
    try {
      for (const r of rows)
        await api.saveAccount({ key: r.key, name: r.name, feeBp: Math.round(Number(r.pct || 0) * 100), feeMinPt: moneyToPt(r.min) ?? 0, feeMaxPt: r.max.trim() ? moneyToPt(r.max) : null });
      await reloadAccounts();
      setMsg("اتحفظ");
      onSaved();
    } catch (e) {
      setMsg((e as Error).message);
    }
  }
  return (
    <div className="no-print px-4 py-3 grid gap-2">
      {rows.map((r, i) => (
        <div key={r.key} className="flex flex-wrap items-end gap-2.5">
          <Labeled label="اسم الحساب">
            <TextInput value={r.name} onChange={(e) => set(i, { name: e.target.value })} className="w-36" />
          </Labeled>
          <Labeled label="عمولة التحويل ٪">
            <TextInput value={r.pct} onChange={(e) => set(i, { pct: e.target.value })} className="w-20" inputMode="decimal" />
          </Labeled>
          <Labeled label="أقل عمولة (ج)">
            <TextInput value={r.min} onChange={(e) => set(i, { min: e.target.value })} className="w-20" inputMode="decimal" />
          </Labeled>
          <Labeled label="أقصى عمولة (ج)">
            <TextInput value={r.max} onChange={(e) => set(i, { max: e.target.value })} className="w-20" inputMode="decimal" placeholder="من غير حد" />
          </Labeled>
        </div>
      ))}
      <div className="flex items-center gap-3">
        <Button primary onClick={save}>
          حفظ العمولات
        </Button>
        {msg && <span className="text-sm font-semibold">{msg}</span>}
      </div>
    </div>
  );
}

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
  const [deleting, setDeleting] = useState<number | null>(null);
  const [deletingHold, setDeletingHold] = useState<number | null>(null);

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
        rows: v.rows.map((r) => ({ date: r.date, typeLabel: r.typeLabel, party: r.party, note: r.note ?? "", inPt: r.inPt || null, outPt: r.outPt || null, balancePt: r.balancePt })),
        totals: { date: "الإجمالي", inPt: v.totals.inPt, outPt: v.totals.outPt },
      },
    ]);
  }

  return (
    <div className="grid gap-5">
      <PrintHeader title="حركة الخزنة" subtitle={filters.from || filters.to ? `${filters.from ? dateLabel(filters.from) : ""} — ${filters.to ? dateLabel(filters.to) : ""}` : undefined} />
      <PageHeader title="الخزنة" subtitle="كل جنيه داخل أو خارج — متقسمة على حساباتها">
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

      <div className="grid gap-3.5 grid-cols-4 max-[1000px]:grid-cols-2">
        {v.accounts.map((a) => (
          <button key={a.key} type="button" onClick={() => set({ account: filters.account === a.key ? undefined : a.key })} className="text-start">
            <Kpi
              label={`${a.name}${filters.account === a.key ? " ✓" : ""}`}
              value={<Money pt={pounds(a.balancePt)} className={a.balancePt < 0 ? "text-out" : ""} />}
              sub={a.feeBp || a.feeMinPt ? `عمولة التحويل ${a.feeBp / 100}٪ — دوس عشان تشوف حركته` : "دوس عشان تشوف حركته"}
            />
          </button>
        ))}
        <Kpi
          tone={s.heldPt > 0 ? "tax" : "plain"}
          label="فلوس لسه مع حد"
          value={<Money pt={pounds(s.heldPt)} />}
          sub="مع شريك أو حد تاني — مش محسوبة في الرصيد"
        />
      </div>

      <Panel title="فلوس لسه برا الخزنة" hint="أول ما توصل دوس «وصلت» وهتدخل الرصيد">
          <HoldForm key={v.accounts.map((a) => a.key).join()} v={v} onSaved={load} />
          {v.held.length > 0 && (
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>التاريخ</th>
                  <th>مع مين</th>
                  <th>من</th>
                  <th>هتدخل على</th>
                  <th>البيان</th>
                  <th className="n">المبلغ</th>
                  <th className="no-print" />
                </tr>
              </thead>
              <tbody>
                {v.held.map((h) => (
                  <tr key={`${h.source}-${h.id}`}>
                    <td>{dateLabel(h.date)}</td>
                    <td className="font-bold">{h.heldBy}</td>
                    <td>{h.party || h.typeLabel}</td>
                    <td>{h.accountName}</td>
                    <td>{h.note ?? ""}</td>
                    <td className="n font-bold">{pounds(h.amountPt)}</td>
                    <td className="no-print text-end">
                      <Button
                        primary
                        onClick={async () => {
                          const d = window.prompt("وصلت الخزنة يوم كام؟ (YYYY-MM-DD)", today());
                          if (!d) return;
                          try {
                            if (h.source === "hold") await api.returnHold(h.id, d);
                            else await api.markDelivered(h.id, d);
                            load();
                          } catch (e) {
                            setError((e as Error).message);
                          }
                        }}
                      >
                        وصلت
                      </Button>
                      {h.source === "hold" && <TrashButton title="حذف" onClick={() => setDeletingHold(h.id)} />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          )}
      </Panel>

      <div className="grid gap-3.5 items-start grid-cols-2 max-[1000px]:grid-cols-1">
        <Panel title="تحويل بين الحسابات">
          <TransferForm key={v.accounts.map((a) => a.key).join()} v={v} onSaved={load} />
          {v.transfers.length > 0 && (
            <div className="overflow-x-auto border-t border-line">
              <table className="tbl">
                <tbody>
                  {v.transfers.slice(0, 8).map((t) => (
                    <tr key={t.id}>
                      <td>{dateLabel(t.date)}</td>
                      <td>
                        {t.from} ← {t.to}
                      </td>
                      <td>{t.note ?? ""}</td>
                      <td className="n font-bold">{pounds(t.amountPt)}</td>
                      <td className="no-print text-end">
                        <TrashButton title="حذف التحويل" onClick={() => setDeleting(t.id)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
        <Panel title="عمولة التحويل لكل حساب" hint="بتتخصم لما تختار «تحويل» — «دفع» من غير عمولة">
          <FeeSettings key={v.accounts.map((a) => `${a.key}${a.feeBp}${a.feeMinPt}${a.feeMaxPt}${a.name}`).join()} v={v} onSaved={load} />
        </Panel>
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
          <Labeled label="الحساب">
            <Select value={filters.account ?? ""} onChange={(e) => set({ account: e.target.value || undefined })}>
              <option value="">كل الحسابات</option>
              {v.accounts.map((a) => (
                <option key={a.key} value={a.key}>
                  {a.name}
                </option>
              ))}
            </Select>
          </Labeled>
          {(filters.from || filters.to || filters.type || filters.party || filters.account) && <Button onClick={() => setFilters({})}>مسح الفلاتر</Button>}
        </div>
        <div className="overflow-x-auto">
          <table className="tbl">
            <thead>
              <tr>
                <th>التاريخ</th>
                <th>النوع</th>
                <th>الطرف</th>
                <th>البيان</th>
                <th>الحساب</th>
                <th className="n">داخل</th>
                <th className="n">خارج</th>
                <th className="n">الرصيد</th>
              </tr>
            </thead>
            <tbody>
              {v.rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center text-muted py-6">
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
                  <td>{r.account}</td>
                  <td className="n text-in font-bold">{r.inPt ? pounds(r.inPt) : ""}</td>
                  <td className="n text-out font-bold">{r.outPt ? pounds(r.outPt) : ""}</td>
                  <td className="n">{pounds(r.balancePt)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={5}>{v.totals.count} حركة</td>
                <td className="n">{pounds(v.totals.inPt)}</td>
                <td className="n">{pounds(v.totals.outPt)}</td>
                <td className="n">{pounds(v.totals.inPt - v.totals.outPt)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        {deleting != null && <ConfirmDelete entity="treasury_transfers" id={deleting} onClose={() => setDeleting(null)} onDeleted={load} />}
        {deletingHold != null && <ConfirmDelete entity="treasury_holds" id={deletingHold} onClose={() => setDeletingHold(null)} onDeleted={load} />}
        <Note>الحركات بتتسجل من صفحاتها (دفعة عميل، دفعة لصاحب معدة، مصروف، إيداع مستثمر…) وبتظهر هنا لوحدها. مفيش حركة بتتمسح من الخزنة غير لما تحذفها من مكانها.</Note>
      </Panel>
    </div>
  );
}
