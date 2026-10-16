import { FormEvent, Fragment, useEffect, useState } from "react";
import PrintButton from "../../components/PrintButton";
import { PrintSignoff } from "../../components/PrintSignoff";
import { creditorsApi } from "../../api/client";
import { CreditorBalance, CreditorStatement } from "../../api/types";
import { formatEGP } from "../../utils/format";
import { PAYMENT_METHODS, paymentMethodLabel } from "../../utils/paymentMethods";

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const errorText = (err: unknown) => String((err as Error)?.message ?? err).replace(/^Error invoking remote method '[^']+': (Error: )?/, "");

// كشف حساب جهة: كل دين وكل سداد بتاريخه وسببه، والباقي بعد كل حركة —
// ومنه بتسجل دين جديد أو سداد، وبيتطبع لوحده.
function CreditorStatementPanel({ id, onChanged }: { id: number; onChanged: () => void }) {
  const [st, setSt] = useState<CreditorStatement | null>(null);
  const [debtDate, setDebtDate] = useState(todayISO());
  const [debtAmount, setDebtAmount] = useState("");
  const [debtNote, setDebtNote] = useState("");
  const [payDate, setPayDate] = useState(todayISO());
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("cash");
  const [payNote, setPayNote] = useState("");
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editOpening, setEditOpening] = useState("");
  const [editNote, setEditNote] = useState("");
  const [error, setError] = useState("");

  const refresh = () => creditorsApi.statement(id).then(setSt);
  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const after = async () => {
    await refresh();
    onChanged();
  };

  async function addDebt(e: FormEvent) {
    e.preventDefault();
    if (!debtAmount || !debtNote.trim()) return;
    await creditorsApi.addEntry({ creditor_id: id, date: debtDate, type: "debt", amount: Number(debtAmount), method: null, note: debtNote });
    setDebtAmount("");
    setDebtNote("");
    after();
  }

  async function addPayment(e: FormEvent) {
    e.preventDefault();
    if (!payAmount) return;
    await creditorsApi.addEntry({ creditor_id: id, date: payDate, type: "payment", amount: Number(payAmount), method: payMethod, note: payNote || null });
    setPayAmount("");
    setPayNote("");
    after();
  }

  async function removeEntry(entryId: number, type: string) {
    if (!window.confirm(type === "payment" ? "تمسح السداد ده؟ الفلوس هترجع الخزنة." : "تمسح الدين ده؟")) return;
    await creditorsApi.removeEntry(entryId);
    after();
  }

  async function saveEdit() {
    setError("");
    try {
      await creditorsApi.update({ id, name: editName, opening_balance: Number(editOpening) || 0, note: editNote || null });
      setEditing(false);
      after();
    } catch (err) {
      setError(errorText(err));
    }
  }

  if (!st) return <div className="text-sm text-slate-400 p-4">جاري التحميل...</div>;

  return (
    <div className="bg-white rounded-card shadow-card p-5 max-w-3xl">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
        <div>
          <div className="font-extrabold text-slate-900">كشف حساب: {st.name}</div>
          <div className="text-xs text-slate-400">
            فلوس على الشركة — شركة البنيان لتأجير المعدات الثقيلة{st.note ? ` — ${st.note}` : ""}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setEditing(!editing);
              setEditName(st.name);
              setEditOpening(String(st.openingBalance));
              setEditNote(st.note ?? "");
            }}
            className="no-print text-xs font-semibold text-primary"
          >
            تعديل البيانات
          </button>
          <PrintButton />
        </div>
      </div>

      {editing && (
        <div className="no-print flex flex-wrap items-end gap-2 mb-4 bg-slate-50 rounded-xl p-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">الاسم</label>
            <input value={editName} onChange={(e) => setEditName(e.target.value)} className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm" />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">رصيد افتتاحي (قديم علينا)</label>
            <input
              type="number"
              step="any"
              value={editOpening}
              onChange={(e) => setEditOpening(e.target.value)}
              className="w-28 rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">ملاحظة</label>
            <input value={editNote} onChange={(e) => setEditNote(e.target.value)} className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm" />
          </div>
          <button onClick={saveEdit} className="bg-primary text-white rounded-lg px-3 py-1.5 text-sm font-semibold">
            حفظ
          </button>
          {error && <span className="text-xs text-rose-600 font-semibold">{error}</span>}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-4">
        <div className="text-center bg-slate-50 rounded-xl py-2.5">
          <div className="text-xs text-slate-500">رصيد افتتاحي</div>
          <div className="font-bold text-slate-800">{formatEGP(st.openingBalance)}</div>
        </div>
        <div className="text-center bg-rose-50 rounded-xl py-2.5">
          <div className="text-xs text-slate-500">ديون علينا</div>
          <div className="font-bold text-rose-600">{formatEGP(st.debts)}</div>
        </div>
        <div className="text-center bg-emerald-50 rounded-xl py-2.5">
          <div className="text-xs text-slate-500">اتسدد</div>
          <div className="font-bold text-emerald-600">{formatEGP(st.paid)}</div>
        </div>
        <div className={`text-center rounded-xl py-2.5 ${st.remaining > 0.005 ? "bg-rose-600" : "bg-primary"}`}>
          <div className="text-xs text-white/80">الباقي علينا</div>
          <div className="font-extrabold text-white">{formatEGP(st.remaining)}</div>
        </div>
      </div>

      {st.entries.length === 0 ? (
        <div className="text-sm text-slate-400 mb-4">لسه مفيش حركات.</div>
      ) : (
        <table className="w-full text-sm mb-4">
          <thead>
            <tr className="text-slate-400 border-b border-slate-100">
              <th className="text-start font-semibold py-1.5">التاريخ</th>
              <th className="text-start font-semibold py-1.5">البيان</th>
              <th className="text-start font-semibold py-1.5">دين علينا</th>
              <th className="text-start font-semibold py-1.5">سداد</th>
              <th className="text-start font-semibold py-1.5">الباقي</th>
              <th className="no-print"></th>
            </tr>
          </thead>
          <tbody>
            {st.openingBalance !== 0 && (
              <tr className="border-b border-slate-50">
                <td className="py-1.5 text-slate-400">—</td>
                <td className="py-1.5 text-slate-500">رصيد افتتاحي</td>
                <td className="py-1.5 text-rose-600">{formatEGP(st.openingBalance)}</td>
                <td></td>
                <td className="py-1.5 font-semibold text-slate-700">{formatEGP(st.openingBalance)}</td>
                <td className="no-print"></td>
              </tr>
            )}
            {st.entries.map((e) => (
              <tr key={e.id} className="border-b border-slate-50 last:border-0">
                <td className="py-1.5 text-slate-500 whitespace-nowrap">{e.date}</td>
                <td className="py-1.5 text-slate-600">
                  {e.type === "debt" ? e.note ?? "دين" : `سداد — ${paymentMethodLabel(e.method)}${e.note ? ` (${e.note})` : ""}`}
                </td>
                <td className="py-1.5 text-rose-600">{e.type === "debt" ? formatEGP(e.amount) : ""}</td>
                <td className="py-1.5 text-emerald-600">{e.type === "payment" ? formatEGP(e.amount) : ""}</td>
                <td className="py-1.5 font-semibold text-slate-700">{formatEGP(e.balance ?? 0)}</td>
                <td className="no-print py-1.5">
                  <button onClick={() => removeEntry(e.id, e.type)} className="text-xs text-rose-500 hover:text-rose-700 font-semibold">
                    حذف
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="no-print space-y-3">
        <div>
          <div className="text-xs font-bold text-slate-500 mb-1.5">دين جديد علينا</div>
          <form onSubmit={addDebt} className="flex flex-wrap items-end gap-2">
            <input type="date" value={debtDate} onChange={(e) => setDebtDate(e.target.value)} className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm" />
            <input
              type="number"
              min="0"
              step="any"
              placeholder="المبلغ"
              value={debtAmount}
              onChange={(e) => setDebtAmount(e.target.value)}
              className="w-28 rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
            />
            <input
              type="text"
              placeholder="الدين ده عشان إيه؟"
              value={debtNote}
              onChange={(e) => setDebtNote(e.target.value)}
              className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm min-w-[200px]"
            />
            <button type="submit" className="bg-rose-600 text-white rounded-lg px-3 py-1.5 text-sm font-semibold hover:bg-rose-700">
              إضافة دين
            </button>
          </form>
        </div>
        <div>
          <div className="text-xs font-bold text-slate-500 mb-1.5">سداد (بيتخصم من الخزنة)</div>
          <form onSubmit={addPayment} className="flex flex-wrap items-end gap-2">
            <input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm" />
            <input
              type="number"
              min="0"
              step="any"
              placeholder="المبلغ"
              value={payAmount}
              onChange={(e) => setPayAmount(e.target.value)}
              className="w-28 rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
            />
            <select value={payMethod} onChange={(e) => setPayMethod(e.target.value)} className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm bg-white">
              {PAYMENT_METHODS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
            <input
              type="text"
              placeholder="ملاحظة (اختياري)"
              value={payNote}
              onChange={(e) => setPayNote(e.target.value)}
              className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
            />
            <button type="submit" className="bg-primary text-white rounded-lg px-3 py-1.5 text-sm font-semibold hover:bg-primary-dark">
              سددت
            </button>
          </form>
        </div>
      </div>

      <PrintSignoff />
    </div>
  );
}

// خانة "فلوس علينا لجهات تانية" في صفحة الرصيد.
export default function CreditorsSection({
  creditorsDue,
  onChanged,
  onSoloPrint,
}: {
  creditorsDue: number;
  onChanged: () => void;
  onSoloPrint: (on: boolean) => void;
}) {
  const [list, setList] = useState<CreditorBalance[]>([]);
  const [openId, setOpenId] = useState<number | null>(null);
  const [newName, setNewName] = useState("");
  const [newOpening, setNewOpening] = useState("");
  const [newNote, setNewNote] = useState("");
  const [error, setError] = useState("");

  const refresh = () => creditorsApi.list().then(setList);
  useEffect(() => {
    refresh();
  }, []);
  useEffect(() => {
    onSoloPrint(openId != null);
    return () => onSoloPrint(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openId]);

  const changed = () => {
    refresh();
    onChanged();
  };

  async function addCreditor(e: FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setError("");
    try {
      await creditorsApi.create({ name: newName, opening_balance: Number(newOpening) || 0, note: newNote || null });
      setNewName("");
      setNewOpening("");
      setNewNote("");
      changed();
    } catch (err) {
      setError(errorText(err));
    }
  }

  async function removeCreditor(c: CreditorBalance) {
    if (!window.confirm(`تمسح "${c.name}" وكل حركاته؟ السدادات اللي اتسجلت هترجع الخزنة.`)) return;
    await creditorsApi.remove(c.id);
    if (openId === c.id) setOpenId(null);
    changed();
  }

  const solo = openId != null;

  return (
    <div className="bg-white rounded-card shadow-card p-5">
      <div className={`${solo ? "no-print " : ""}flex items-center justify-between mb-1`}>
        <h2 className="font-bold text-slate-800">فلوس علينا لجهات تانية</h2>
        <span className="text-lg font-extrabold text-rose-600">{formatEGP(creditorsDue)}</span>
      </div>
      <p className={`${solo ? "no-print " : ""}text-xs text-slate-400 mb-4`}>
        أي فلوس على الشركة لحد غير الموردين والشركاء — قرض، محامي، إيجار متأخر... دوس على الاسم تفتح كشف حسابه وتسجل دين أو سداد.
      </p>

      {list.length === 0 ? (
        <div className="text-sm text-slate-400 mb-4">لسه مفيش جهات — ضيف من تحت.</div>
      ) : (
        <div className="overflow-x-auto mb-4">
          <table className="w-full text-sm">
            <thead className={solo ? "no-print" : ""}>
              <tr className="text-slate-400 border-b border-slate-100">
                <th className="text-start font-semibold py-2">الجهة</th>
                <th className="text-start font-semibold py-2">رصيد افتتاحي</th>
                <th className="text-start font-semibold py-2">ديون</th>
                <th className="text-start font-semibold py-2">اتسدد</th>
                <th className="text-start font-semibold py-2">الباقي علينا</th>
                <th className="no-print"></th>
              </tr>
            </thead>
            <tbody>
              {list.map((c) => (
                <Fragment key={c.id}>
                  <tr className={`${solo ? "no-print " : ""}border-b border-slate-50 last:border-0`}>
                    <td className="py-2">
                      <button
                        onClick={() => setOpenId(openId === c.id ? null : c.id)}
                        className="font-semibold text-slate-700 hover:text-primary text-start"
                      >
                        {c.name}
                        {c.note && <span className="text-xs text-slate-400"> ({c.note})</span>}
                      </button>
                    </td>
                    <td className="py-2 text-slate-600">{formatEGP(c.openingBalance)}</td>
                    <td className="py-2 text-slate-600">{formatEGP(c.debts)}</td>
                    <td className="py-2 text-emerald-600">{formatEGP(c.paid)}</td>
                    <td className={`py-2 font-bold ${c.remaining > 0.005 ? "text-rose-600" : "text-slate-400"}`}>{formatEGP(c.remaining)}</td>
                    <td className="no-print py-2">
                      <button onClick={() => removeCreditor(c)} className="text-xs text-rose-500 hover:text-rose-700 font-semibold">
                        مسح
                      </button>
                    </td>
                  </tr>
                  {openId === c.id && (
                    <tr>
                      <td colSpan={6} className="bg-slate-50 px-3 py-4 rounded-xl">
                        <CreditorStatementPanel id={c.id} onChanged={changed} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <form onSubmit={addCreditor} className="no-print flex flex-wrap items-end gap-2 pt-3 border-t border-slate-100">
        <div>
          <label className="block text-xs text-slate-400 mb-1">اسم الجهة / الشخص</label>
          <input value={newName} onChange={(e) => setNewName(e.target.value)} className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">رصيد افتتاحي (لو فيه قديم)</label>
          <input
            type="number"
            step="any"
            value={newOpening}
            onChange={(e) => setNewOpening(e.target.value)}
            placeholder="0"
            className="w-28 rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">ملاحظة</label>
          <input value={newNote} onChange={(e) => setNewNote(e.target.value)} placeholder="اختياري" className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm" />
        </div>
        <button
          type="submit"
          disabled={!newName.trim()}
          className="bg-primary text-white rounded-lg px-4 py-1.5 text-sm font-semibold hover:bg-primary-dark disabled:opacity-50"
        >
          إضافة جهة
        </button>
        {error && <span className="text-xs text-rose-600 font-semibold">{error}</span>}
      </form>
    </div>
  );
}
