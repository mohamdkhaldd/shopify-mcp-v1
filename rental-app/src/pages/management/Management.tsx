import { useCallback, useEffect, useState } from "react";
import { api, ApiError, appApi, Deletable, ManagementView } from "../../api/client";
import { Button, Code, ErrorBox, Kpi, Loading, Money, Note, PageHeader, Panel, Pill } from "../../components/ui";
import { Labeled, Select, TextInput } from "../../components/Field";
import { PrintButtons, PrintHeader } from "../../components/Print";
import ConfirmDelete from "../../components/ConfirmDelete";
import Modal from "../../components/Modal";
import MoneyEntry from "../../components/MoneyEntry";
import { MoneyTable, TrashButton } from "../../components/party";
import { dateLabel, monthLabel, percentFromBp, pounds } from "../../utils/format";
import { moneyToPt } from "../../utils/input";
import { today } from "../../../core/db";

function ContractsTable({ v }: { v: ManagementView }) {
  const t = v.totals;
  const distributable = t.monthNetPt - t.carryInPt;
  return (
    <Panel title="العقود" hint={monthLabel(v.month)}>
      <div className="overflow-x-auto">
        <table className="tbl">
          <thead>
            <tr>
              <th>العقد</th>
              <th>المعدة</th>
              <th>صاحبها</th>
              <th>مع مين</th>
              <th className="n">للشركة</th>
              <th className="n">لصاحب المعدة</th>
              <th className="n">الهامش</th>
              <th className="n">٥٪</th>
              <th className="n">مصروفات</th>
              <th className="n">الصافي</th>
            </tr>
          </thead>
          <tbody>
            {v.rows.length === 0 && (
              <tr>
                <td colSpan={10} className="text-center text-muted py-6">
                  مفيش سركي في الشهر ده.
                </td>
              </tr>
            )}
            {v.rows.map((r) => (
              <tr key={r.contractId}>
                <td>
                  <Code>{r.code}</Code>
                </td>
                <td>{r.equipment}</td>
                <td>{r.supplier}</td>
                <td>{r.client}</td>
                <td className="n">{pounds(r.clientBasePt)}</td>
                <td className="n">{pounds(r.supplierCostPt)}</td>
                <td className="n">{pounds(r.marginPt)}</td>
                <td className="n text-tax">{pounds(r.tax5Pt)}</td>
                <td className="n text-out">{pounds(r.expensesPt)}</td>
                <td className={`n font-bold ${r.netPt >= 0 ? "text-in" : "text-out"}`}>{pounds(r.netPt)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={4}>إجمالي العقود</td>
              <td className="n">{pounds(t.clientBasePt)}</td>
              <td className="n">{pounds(t.supplierCostPt)}</td>
              <td className="n">{pounds(t.marginPt)}</td>
              <td className="n">{pounds(t.tax5Pt)}</td>
              <td className="n">{pounds(t.contractExpensesPt)}</td>
              <td className="n">{pounds(t.monthNetPt + t.generalExpensesPt)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <div className="grid gap-1.5 px-4 py-3 border-t border-line text-[14px] max-w-[520px]">
        <Line label="− مصروفات عامة" pt={-t.generalExpensesPt} />
        <Line label="= صافي ربح الشهر" pt={t.monthNetPt} bold />
        {t.carryInPt > 0 && <Line label="− خسارة متراحلة من قبل كده" pt={-t.carryInPt} />}
        {t.carryInPt > 0 && <Line label="= اللي بيتقسم" pt={distributable} bold />}
        <Line label={`الإدارة ${v.rates ? percentFromBp(v.rates.management) : ""}`} pt={t.managementPt} />
        <Line label={`المستثمرين ${v.rates ? percentFromBp(v.rates.investors) : ""}`} pt={t.investorsPt} />
        {t.carryOutPt > 0 && <div className="text-out font-semibold">الشهر ده خسران — {pounds(t.carryOutPt)} هتتخصم من أرباح الشهور الجاية.</div>}
      </div>
    </Panel>
  );
}

function Line({ label, pt, bold }: { label: string; pt: number; bold?: boolean }) {
  return (
    <div className={`flex justify-between gap-4 ${bold ? "font-extrabold border-t border-dashed border-line pt-1.5" : ""}`}>
      <span>{label}</span>
      <span className="num">{pounds(pt)}</span>
    </div>
  );
}

/** Expenses: on a contract (comes off that contract) or general (comes off the whole month). */
function ExpenseEntry({ v, onSaved }: { v: ManagementView; onSaved: () => void }) {
  const [kind, setKind] = useState<"contract" | "general">("contract");
  const [contract, setContract] = useState(String(v.contracts.find((c) => c.active)?.id ?? v.contracts[0]?.id ?? ""));
  const [category, setCategory] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [date, setDate] = useState(today());
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirmCash, setConfirmCash] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save(confirmNegative = false) {
    setError(null);
    setBusy(true);
    try {
      const amountPt = moneyToPt(amount);
      if (!amountPt || amountPt <= 0) throw new Error("اكتب المبلغ");
      let categoryId: number | null = category && category !== "new" ? Number(category) : null;
      if (category === "new" && newCategory.trim()) categoryId = await api.createExpenseCategory(newCategory.trim());
      await api.expense({ kind, contractId: kind === "contract" ? Number(contract) : null, categoryId, date, amountPt, note: note.trim() || undefined, confirmNegative });
      setAmount("");
      setNote("");
      setNewCategory("");
      setConfirmCash(null);
      onSaved();
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
        <Labeled label="النوع">
          <Select value={kind} onChange={(e) => setKind(e.target.value as "contract" | "general")}>
            <option value="contract">مصروف عقد</option>
            <option value="general">مصروف عام للشركة</option>
          </Select>
        </Labeled>
        {kind === "contract" && (
          <Labeled label="على أنهي عقد">
            <Select value={contract} onChange={(e) => setContract(e.target.value)}>
              {v.contracts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} · {c.equipment}
                </option>
              ))}
            </Select>
          </Labeled>
        )}
        <Labeled label="البند">
          <Select value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">— من غير بند —</option>
            {v.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
            <option value="new">+ بند جديد</option>
          </Select>
        </Labeled>
        {category === "new" && (
          <Labeled label="اسم البند">
            <TextInput value={newCategory} onChange={(e) => setNewCategory(e.target.value)} className="w-32" placeholder="نقل / إيجار / ..." />
          </Labeled>
        )}
        <Labeled label="التاريخ">
          <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-36" />
        </Labeled>
        <Labeled label="المبلغ">
          <TextInput value={amount} onChange={(e) => setAmount(e.target.value)} className="w-24" inputMode="decimal" />
        </Labeled>
        <Labeled label="البيان">
          <TextInput value={note} onChange={(e) => setNote(e.target.value)} className="w-40" />
        </Labeled>
        <Button primary onClick={() => save()} disabled={busy}>
          حفظ المصروف
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

function CloseMonthDialog({ month, onClose, onDone }: { month: string; onClose: () => void; onDone: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <Modal
      title={`قفل شهر ${monthLabel(month)}`}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>لأ، لسه</Button>
          <Button
            primary
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await api.closeMonth(month);
                onDone();
                onClose();
              } catch (e) {
                setError((e as Error).message);
                setBusy(false);
              }
            }}
          >
            أيوه، اقفل الشهر
          </Button>
        </>
      }
    >
      <div className="grid gap-2 leading-relaxed">
        <div>لما تقفل الشهر:</div>
        <ul className="m-0 ps-5 grid gap-1">
          <li>ربح الشهر ونصيب الإدارة ونصيب كل مستثمر بيتثبتوا.</li>
          <li>فواتير الشهر بتاخد أرقام.</li>
          <li>محدش يقدر يعدّل أو يحذف حاجة في الشهر ده — أي غلطة بعد كده بتتصلح بتسوية في الشهر المفتوح.</li>
        </ul>
        <div className="text-muted text-sm">اتأكد إن السركي والمصروفات بتوع {monthLabel(month)} خلصوا.</div>
        {error && <ErrorBox message={error} />}
      </div>
    </Modal>
  );
}

function AdjustmentEntry({ v, onSaved }: { v: ManagementView; onSaved: () => void }) {
  const [target, setTarget] = useState(v.closedMonths[v.closedMonths.length - 1] ?? "");
  const [contract, setContract] = useState(String(v.contracts[0]?.id ?? ""));
  const [kind, setKind] = useState<"client_base" | "supplier_cost">("client_base");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="no-print grid gap-2 px-4 py-3 border-b border-line bg-surface-2">
      <div className="flex flex-wrap items-end gap-2.5">
        <Labeled label="عن شهر (مقفول)">
          <Select value={target} onChange={(e) => setTarget(e.target.value)}>
            {[...v.closedMonths].reverse().map((m) => (
              <option key={m} value={m}>
                {monthLabel(m)}
              </option>
            ))}
          </Select>
        </Labeled>
        <Labeled label="العقد">
          <Select value={contract} onChange={(e) => setContract(e.target.value)}>
            {v.contracts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} · {c.equipment}
              </option>
            ))}
          </Select>
        </Labeled>
        <Labeled label="على حساب مين">
          <Select value={kind} onChange={(e) => setKind(e.target.value as "client_base" | "supplier_cost")}>
            <option value="client_base">الشركة (العميل)</option>
            <option value="supplier_cost">صاحب المعدة</option>
          </Select>
        </Labeled>
        <Labeled label="المبلغ (− للتخفيض)">
          <TextInput value={amount} onChange={(e) => setAmount(e.target.value)} className="w-28" placeholder="-3000" />
        </Labeled>
        <Labeled label="السبب">
          <TextInput value={reason} onChange={(e) => setReason(e.target.value)} className="w-56" placeholder="يوم ١٢ المعدة كانت عطلانة" />
        </Labeled>
        <Button
          primary
          onClick={async () => {
            setError(null);
            try {
              const pt = moneyToPt(amount);
              if (!pt) throw new Error("اكتب المبلغ");
              await api.adjustment({ targetMonth: target, contractId: Number(contract), kind, amountPt: pt, reason });
              setAmount("");
              setReason("");
              onSaved();
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          حفظ التسوية
        </Button>
      </div>
      {error && <ErrorBox message={error} />}
    </div>
  );
}

export default function Management() {
  const [month, setMonth] = useState<string | undefined>();
  const [v, setV] = useState<ManagementView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [closing, setClosing] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<{ entity: Deletable; id: number } | null>(null);

  const load = useCallback(() => {
    api.management(month).then(setV, (e) => setError(e.message));
  }, [month]);
  useEffect(load, [load]);

  if (!v) return error ? <ErrorBox message={error} /> : <Loading />;
  const t = v.totals;

  function exportExcel() {
    if (!v) return;
    appApi.exportExcel(`الإدارة ${monthLabel(v.month)}`, [
      {
        title: "العقود",
        columns: [
          { header: "العقد", key: "code" },
          { header: "المعدة", key: "equipment", width: 20 },
          { header: "صاحبها", key: "supplier", width: 20 },
          { header: "مع مين", key: "client", width: 22 },
          { header: "للشركة", key: "clientBasePt", money: true },
          { header: "لصاحب المعدة", key: "supplierCostPt", money: true },
          { header: "الهامش", key: "marginPt", money: true },
          { header: "٥٪", key: "tax5Pt", money: true },
          { header: "مصروفات", key: "expensesPt", money: true },
          { header: "الصافي", key: "netPt", money: true },
        ],
        rows: v.rows.map((r) => ({ ...r })),
        totals: { code: "الإجمالي", clientBasePt: t.clientBasePt, supplierCostPt: t.supplierCostPt, marginPt: t.marginPt, tax5Pt: t.tax5Pt, expensesPt: t.contractExpensesPt, netPt: t.monthNetPt + t.generalExpensesPt },
      },
      {
        title: "المصروفات",
        columns: [
          { header: "التاريخ", key: "date" },
          { header: "النوع", key: "kind" },
          { header: "العقد", key: "code" },
          { header: "البند", key: "category" },
          { header: "البيان", key: "note", width: 30 },
          { header: "المبلغ", key: "amount_pt", money: true },
        ],
        rows: v.expenses.map((x) => ({ ...x, kind: x.kind === "contract" ? "مصروف عقد" : "مصروف عام", code: x.code ?? "", category: x.category ?? "", note: x.note ?? "" })),
      },
      {
        title: "نصيب الإدارة",
        columns: [
          { header: "الشهر", key: "month", width: 16 },
          { header: "صافي الربح", key: "netPt", money: true },
          { header: "نصيب الإدارة", key: "managementPt", money: true },
          { header: "المحصّل", key: "releasablePt", money: true },
        ],
        rows: v.history.map((h) => ({ month: monthLabel(h.month), netPt: h.netPt, managementPt: h.managementPt, releasablePt: h.releasablePt })),
      },
    ]);
  }

  return (
    <div className="grid gap-5">
      <PrintHeader title="تقرير الإدارة" subtitle={monthLabel(v.month)} />
      <PageHeader title="الإدارة" subtitle={`ربح كل عقد وكل معدة، والمصروفات، ونصيب الإدارة — ${monthLabel(v.month)}${v.closed ? " (مقفول)" : ""}`}>
        <Select aria-label="الشهر" value={v.month} onChange={(e) => setMonth(e.target.value)}>
          {[...v.months].reverse().map((m) => (
            <option key={m.month} value={m.month}>
              {monthLabel(m.month)}
              {m.closed ? " (مقفول)" : ""}
            </option>
          ))}
        </Select>
        <PrintButtons pdfName={`الإدارة ${monthLabel(v.month)}`} singlePage={false} />
        <Button onClick={exportExcel}>Excel</Button>
      </PageHeader>
      {notice && <div className="no-print rounded-card border border-in bg-in-soft px-4 py-2.5 font-semibold">{notice}</div>}
      {error && <ErrorBox message={error} />}

      <div className="grid gap-3.5 grid-cols-4 max-[1000px]:grid-cols-2">
        <Kpi label="إجمالي الهامش" value={<Money pt={pounds(t.marginPt)} />} />
        <Kpi tone="tax" label="٥٪ من الهامش" value={<Money pt={pounds(t.tax5Pt)} />} />
        <Kpi label="مصروفات (عقود + عامة)" value={<Money pt={pounds(t.contractExpensesPt + t.generalExpensesPt)} />} sub={`عقود ${pounds(t.contractExpensesPt)} · عامة ${pounds(t.generalExpensesPt)}`} />
        <Kpi tone="hero" label={`نصيب الإدارة ${v.rates ? percentFromBp(v.rates.management) : ""}`} value={<Money pt={pounds(t.managementPt)} />} sub={<>المحصّل منه {pounds(t.releasableManagementPt)}</>} />
      </div>

      <ContractsTable v={v} />

      {v.byEquipment.length > 0 && (
        <Panel title="حسب المعدة">
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>المعدة</th>
                  <th>صاحبها</th>
                  <th>شغالة عند</th>
                  <th className="n">الهامش</th>
                  <th className="n">٥٪</th>
                  <th className="n">مصروفات</th>
                  <th className="n">الصافي</th>
                </tr>
              </thead>
              <tbody>
                {v.byEquipment.map((e) => (
                  <tr key={e.equipmentId}>
                    <td className="font-bold">{e.equipment}</td>
                    <td>{e.supplier}</td>
                    <td>{e.clients}</td>
                    <td className="n">{pounds(e.marginPt)}</td>
                    <td className="n text-tax">{pounds(e.tax5Pt)}</td>
                    <td className="n text-out">{pounds(e.expensesPt)}</td>
                    <td className="n font-bold text-in">{pounds(e.netPt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      <div className="grid gap-3.5 items-start grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] max-[1100px]:grid-cols-1">
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
            </table>
          </div>
          <Note>مصروف العقد بيتخصم من ربح العقد ده. المصروف العام بيتخصم من ربح الشهر كله قبل التوزيع.</Note>
        </Panel>

        <Panel title="نصيب الإدارة كل شهر">
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>الشهر</th>
                  <th className="n">صافي الربح</th>
                  <th className="n">نصيب الإدارة</th>
                  <th className="n">المحصّل</th>
                  <th>الحالة</th>
                </tr>
              </thead>
              <tbody>
                {v.history.map((h) => (
                  <tr key={h.month}>
                    <td>{monthLabel(h.month)}</td>
                    <td className="n">{pounds(h.netPt)}</td>
                    <td className="n font-bold">{pounds(h.managementPt)}</td>
                    <td className="n">{pounds(h.releasablePt)}</td>
                    <td>{h.closed ? <Pill tone="in">اتقفل</Pill> : <Pill tone="amber">لسه بيتعدل</Pill>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="no-print px-4 py-3 border-t border-line grid gap-2">
            {v.closable ? (
              <div className="flex flex-wrap items-center gap-3">
                <Button primary onClick={() => setClosing(v.closable)}>
                  قفل شهر {monthLabel(v.closable)}
                </Button>
                <span className="text-xs text-muted">بعد القفل الأرقام بتتثبت، وأي تصحيح بيبقى تسوية.</span>
              </div>
            ) : (
              <span className="text-xs text-muted">مفيش شهر خلص ولسه مقفلش.</span>
            )}
          </div>
          <div className="px-4 py-2.5 border-t border-line text-sm">
            نصيب الإدارة لحد النهارده {pounds(v.management.accruedPt)} — اتحصّل منه {pounds(v.management.releasablePt)} — اتصرف {pounds(v.management.paidPt)} —{" "}
            <b>ينفع يتصرف دلوقتي {pounds(v.management.payableNowPt)}</b>
          </div>
          <MoneyEntry
            title="صرف من نصيب الإدارة"
            contracts={[]}
            saveLabel="صرف"
            onSave={async (x) => {
              await api.managementPayout({ date: x.date, amountPt: x.amountPt, note: x.note || undefined, confirmNegative: x.confirmNegative });
              load();
            }}
          />
          <MoneyTable rows={v.payouts} noteHeader="ملاحظة" contracts={[]} onDelete={(id) => setDeleting({ entity: "profit_payouts", id })} />
        </Panel>
      </div>

      {v.closedMonths.length > 0 && (
        <Panel title="التسويات" hint="تصحيح لشهر مقفول، بيتسجل في الشهر المفتوح">
          <AdjustmentEntry v={v} onSaved={load} />
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>اتسجلت في</th>
                  <th>عن شهر</th>
                  <th>العقد</th>
                  <th>على حساب</th>
                  <th>السبب</th>
                  <th className="n">المبلغ</th>
                </tr>
              </thead>
              <tbody>
                {v.adjustments.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center text-muted py-6">
                      مفيش تسويات.
                    </td>
                  </tr>
                )}
                {v.adjustments.map((a) => (
                  <tr key={a.id}>
                    <td>{monthLabel(a.applied_month)}</td>
                    <td>{monthLabel(a.target_month)}</td>
                    <td>
                      <Code>{a.code}</Code>
                    </td>
                    <td>{a.kind === "client_base" ? "الشركة" : "صاحب المعدة"}</td>
                    <td>{a.reason}</td>
                    <td className={`n font-bold ${a.amount_pt < 0 ? "text-out" : "text-in"}`}>{pounds(a.amount_pt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      {closing && (
        <CloseMonthDialog
          month={closing}
          onClose={() => setClosing(null)}
          onDone={() => {
            setNotice(`شهر ${monthLabel(closing)} اتقفل`);
            load();
          }}
        />
      )}
      {deleting && <ConfirmDelete entity={deleting.entity} id={deleting.id} onClose={() => setDeleting(null)} onDeleted={load} />}
    </div>
  );
}
