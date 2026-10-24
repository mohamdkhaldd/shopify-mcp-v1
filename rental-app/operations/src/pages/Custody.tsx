import { FormEvent, useEffect, useState } from "react";
import PrintButton from "../components/PrintButton";
import { PrintHeader, PrintSignoff } from "../components/PrintSignoff";
import { custodyApi, equipmentApi, expenseCategoriesApi } from "../api/client";
import { Custody as CustodyRow, CustodyStatement, Equipment, ExpenseCategory } from "../api/types";
import { formatEGP } from "../utils/format";
import { PAYMENT_METHODS, paymentMethodLabel } from "../utils/paymentMethods";

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const errorText = (err: unknown) => String((err as Error)?.message ?? err).replace(/^Error invoking remote method '[^']+': (Error: )?/, "");

const inputCls = "rounded-lg border border-slate-200 px-2 py-1.5 text-sm bg-white";

function ProgressBar({ c }: { c: CustodyRow }) {
  const pct = c.given > 0 ? Math.max(0, Math.min(100, (c.remaining / c.given) * 100)) : 0;
  return (
    <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
      <div className={`h-full ${c.low ? "bg-rose-500" : "bg-primary"}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

// كشف العهدة: كل مصروف وزيادة ورجوع بتاريخه، والباقي بعد كل حركة — ومنه
// بيتسجل الصرف من العهدة.
function CustodyPanel({
  id,
  equipment,
  categories,
  onChanged,
  onNotice,
}: {
  id: number;
  equipment: Equipment[];
  categories: ExpenseCategory[];
  onChanged: () => void;
  onNotice: (n: { ok: boolean; low?: boolean; text: string }) => void;
}) {
  const [st, setSt] = useState<CustodyStatement | null>(null);
  const [date, setDate] = useState(todayISO());
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [equipmentId, setEquipmentId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [moveType, setMoveType] = useState<"topup" | "return">("topup");
  const [moveAmount, setMoveAmount] = useState("");
  const [moveMethod, setMoveMethod] = useState("cash");
  const [editing, setEditing] = useState(false);
  const [editHolder, setEditHolder] = useState("");
  const [editWarn, setEditWarn] = useState("");
  const [editNote, setEditNote] = useState("");

  const refresh = () => custodyApi.statement(id).then(setSt);
  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function addExpense(e: FormEvent) {
    e.preventDefault();
    if (!amount || !description.trim()) return;
    try {
      const c = await custodyApi.addEntry({
        custody_id: id,
        date,
        type: "expense",
        amount: Number(amount),
        description,
        equipment_id: equipmentId ? Number(equipmentId) : null,
        category_id: categoryId ? Number(categoryId) : null,
      });
      setAmount("");
      setDescription("");
      onNotice({
        ok: true,
        low: c.low,
        text: `اتسجل ${formatEGP(Number(amount))} من عهدة ${c.holder} — الباقي فيها ${formatEGP(c.remaining)}${c.low ? " ⚠ قربت تخلص" : ""}`,
      });
      await refresh();
      onChanged();
    } catch (err) {
      onNotice({ ok: false, text: errorText(err) });
    }
  }

  async function addMove(e: FormEvent) {
    e.preventDefault();
    if (!moveAmount) return;
    try {
      const c = await custodyApi.addEntry({
        custody_id: id,
        date: todayISO(),
        type: moveType,
        amount: Number(moveAmount),
        description: moveType === "topup" ? "زيادة على العهدة" : "رجّع الباقي للخزنة",
        method: moveMethod,
      });
      setMoveAmount("");
      onNotice({ ok: true, low: c.low, text: `اتسجل — الباقي في عهدة ${c.holder}: ${formatEGP(c.remaining)}` });
      await refresh();
      onChanged();
    } catch (err) {
      onNotice({ ok: false, text: errorText(err) });
    }
  }

  async function removeEntry(entryId: number) {
    if (!window.confirm("تمسح الحركة دي؟")) return;
    await custodyApi.removeEntry(entryId);
    await refresh();
    onChanged();
  }

  async function saveEdit() {
    await custodyApi.update({ id, holder: editHolder, warn_amount: Number(editWarn) || 0, note: editNote || null });
    setEditing(false);
    await refresh();
    onChanged();
  }

  if (!st) return <div className="text-sm text-slate-400 p-4">جاري التحميل...</div>;

  return (
    <div className="bg-white rounded-card shadow-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3 mb-3">
        <div>
          <div className="font-extrabold text-slate-900">عهدة {st.holder}</div>
          <div className="text-xs text-slate-400">
            اتسلمت يوم {st.date} من {paymentMethodLabel(st.method)}
            {st.note ? ` — ${st.note}` : ""}
            {st.closed ? " — مقفولة" : ""}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setEditing(!editing);
              setEditHolder(st.holder);
              setEditWarn(String(st.warn_amount));
              setEditNote(st.note ?? "");
            }}
            className="no-print text-xs font-semibold text-primary"
          >
            تعديل
          </button>
          <PrintButton />
        </div>
      </div>

      {editing && (
        <div className="no-print flex flex-wrap items-end gap-2 mb-4 bg-slate-50 rounded-xl p-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">الاسم</label>
            <input value={editHolder} onChange={(e) => setEditHolder(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">نبّهني لما الباقي يوصل</label>
            <input type="number" value={editWarn} onChange={(e) => setEditWarn(e.target.value)} className={`${inputCls} w-28`} />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">ملاحظة</label>
            <input value={editNote} onChange={(e) => setEditNote(e.target.value)} className={inputCls} />
          </div>
          <button onClick={saveEdit} className="bg-primary text-white rounded-lg px-3 py-1.5 text-sm font-semibold">
            حفظ
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-3">
        <div className="text-center bg-slate-50 rounded-xl py-2.5">
          <div className="text-xs text-slate-500">اتسلم (مع الزيادات)</div>
          <div className="font-bold text-slate-800">{formatEGP(st.given)}</div>
        </div>
        <div className="text-center bg-rose-50 rounded-xl py-2.5">
          <div className="text-xs text-slate-500">اتصرف</div>
          <div className="font-bold text-rose-600">{formatEGP(st.spent)}</div>
        </div>
        <div className="text-center bg-sky-50 rounded-xl py-2.5">
          <div className="text-xs text-slate-500">رجع للخزنة</div>
          <div className="font-bold text-sky-700">{formatEGP(st.returned)}</div>
        </div>
        <div className={`text-center rounded-xl py-2.5 ${st.low ? "bg-rose-600" : "bg-primary"}`}>
          <div className="text-xs text-white/80">الباقي في العهدة</div>
          <div className="font-extrabold text-white">{formatEGP(st.remaining)}</div>
        </div>
      </div>
      <div className="mb-4">
        <ProgressBar c={st} />
        <div className="text-[11px] text-slate-400 mt-1">بينبّهك في الصفحة الرئيسية لما الباقي يوصل {formatEGP(st.warn_amount)} أو أقل.</div>
      </div>

      {st.entries.length === 0 ? (
        <div className="text-sm text-slate-400 mb-4">لسه مفيش صرف من العهدة.</div>
      ) : (
        <table className="w-full text-sm mb-4">
          <thead>
            <tr className="text-slate-400 border-b border-slate-100">
              <th className="text-start font-semibold py-1.5">التاريخ</th>
              <th className="text-start font-semibold py-1.5">البيان</th>
              <th className="text-start font-semibold py-1.5">على</th>
              <th className="text-start font-semibold py-1.5">المبلغ</th>
              <th className="text-start font-semibold py-1.5">الباقي</th>
              <th className="no-print"></th>
            </tr>
          </thead>
          <tbody>
            {st.entries.map((e) => (
              <tr key={e.id} className="border-b border-slate-50 last:border-0">
                <td className="py-1.5 text-slate-500 whitespace-nowrap">{e.date}</td>
                <td className="py-1.5 text-slate-600">
                  {e.type === "expense" ? e.description ?? "مصروف" : e.type === "topup" ? `زيادة على العهدة (${paymentMethodLabel(e.method)})` : `رجوع للخزنة (${paymentMethodLabel(e.method)})`}
                  {e.category_name && <span className="text-xs text-slate-400"> — {e.category_name}</span>}
                </td>
                <td className="py-1.5 text-slate-500">{e.type === "expense" ? e.equipment_name ?? "عام" : "—"}</td>
                <td className={`py-1.5 font-semibold ${e.type === "topup" ? "text-primary-dark" : "text-rose-600"}`}>
                  {e.type === "topup" ? "+" : "−"} {formatEGP(e.amount)}
                </td>
                <td className="py-1.5 font-semibold text-slate-700">{formatEGP(e.balance)}</td>
                <td className="no-print py-1.5">
                  <button onClick={() => removeEntry(e.id)} className="text-xs text-rose-500 hover:text-rose-700 font-semibold">
                    حذف
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {!st.closed && (
        <div className="no-print space-y-3">
          <div>
            <div className="text-xs font-bold text-slate-500 mb-1.5">صرف من العهدة (مش من الخزنة)</div>
            <form onSubmit={addExpense} className="flex flex-wrap items-end gap-2">
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
              <input
                type="number"
                min="0"
                step="any"
                placeholder="المبلغ"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className={`${inputCls} w-28`}
              />
              <input placeholder="اتصرف في إيه؟" value={description} onChange={(e) => setDescription(e.target.value)} className={`${inputCls} min-w-[180px]`} />
              <select value={equipmentId} onChange={(e) => setEquipmentId(e.target.value)} className={inputCls}>
                <option value="">عام (مش على معدة)</option>
                {equipment.map((eq) => (
                  <option key={eq.id} value={eq.id}>
                    على {eq.name}
                  </option>
                ))}
              </select>
              {equipmentId && (
                <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={inputCls}>
                  <option value="">نوع المصروف</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              )}
              <button type="submit" className="bg-rose-600 text-white rounded-lg px-3 py-1.5 text-sm font-semibold hover:bg-rose-700">
                سجّل الصرف
              </button>
            </form>
            {equipmentId && <p className="text-[11px] text-slate-400 mt-1">هيظهر كمان في مصروفات المعدة (طريقة الدفع: عهدة) من غير ما يتخصم من الخزنة تاني.</p>}
          </div>
          <div>
            <div className="text-xs font-bold text-slate-500 mb-1.5">زيادة على العهدة / رجوع الباقي للخزنة</div>
            <form onSubmit={addMove} className="flex flex-wrap items-end gap-2">
              <select value={moveType} onChange={(e) => setMoveType(e.target.value as "topup" | "return")} className={inputCls}>
                <option value="topup">زيادة (طالعة من الخزنة)</option>
                <option value="return">رجّع الباقي (داخل الخزنة)</option>
              </select>
              <input
                type="number"
                min="0"
                step="any"
                placeholder={moveType === "return" ? String(Math.round(st.remaining)) : "المبلغ"}
                value={moveAmount}
                onChange={(e) => setMoveAmount(e.target.value)}
                className={`${inputCls} w-28`}
              />
              <select value={moveMethod} onChange={(e) => setMoveMethod(e.target.value)} className={inputCls}>
                {PAYMENT_METHODS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
              <button type="submit" className="bg-primary text-white rounded-lg px-3 py-1.5 text-sm font-semibold hover:bg-primary-dark">
                سجّل
              </button>
            </form>
          </div>
        </div>
      )}

      <PrintSignoff />
    </div>
  );
}

// صفحة العهد: بتسلّم عهدة لشخص (طالعة من الخزنة)، وهو بيصرف منها.
export default function Custody() {
  const [list, setList] = useState<CustodyRow[]>([]);
  const [openId, setOpenId] = useState<number | null>(null);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [holder, setHolder] = useState("");
  const [date, setDate] = useState(todayISO());
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");
  const [warn, setWarn] = useState("");
  const [note, setNote] = useState("");
  const [notice, setNotice] = useState<{ ok: boolean; low?: boolean; text: string } | null>(null);

  const refresh = () => custodyApi.list().then(setList);
  useEffect(() => {
    refresh();
    equipmentApi.list().then(setEquipment);
    expenseCategoriesApi.list().then(setCategories);
  }, []);

  async function create(e: FormEvent) {
    e.preventDefault();
    if (!holder.trim() || !amount) return;
    try {
      const c = await custodyApi.create({ holder, date, amount: Number(amount), method, warn_amount: warn === "" ? "" : Number(warn), note: note || null });
      setHolder("");
      setAmount("");
      setWarn("");
      setNote("");
      setNotice({ ok: true, text: `اتسلمت عهدة ${c.holder} بـ ${formatEGP(c.amount)} — اتخصمت من ${paymentMethodLabel(c.method)}` });
      refresh();
      setOpenId(c.id);
    } catch (err) {
      setNotice({ ok: false, text: errorText(err) });
    }
  }

  async function toggleClosed(c: CustodyRow) {
    if (!c.closed && c.remaining > 0.005 && !window.confirm(`لسه فيها ${formatEGP(c.remaining)} — تقفلها كده؟ (لو الفلوس رجعت سجّل "رجّع الباقي" الأول)`)) return;
    await custodyApi.setClosed(c.id, !c.closed);
    refresh();
  }

  async function remove(c: CustodyRow) {
    if (!window.confirm(`تمسح عهدة ${c.holder} وكل حركاتها؟ المبلغ هيرجع الخزنة، والمصروفات اللي اتسجلت منها على المعدات هتتمسح.`)) return;
    await custodyApi.remove(c.id);
    if (openId === c.id) setOpenId(null);
    refresh();
  }

  const open = list.find((c) => c.id === openId);

  return (
    <div className={`space-y-6${open ? " print-solo" : ""}`}>
      <PrintHeader title="العهد" subtitle={open ? `عهدة ${open.holder}` : ""} />
      <div className="no-print">
        <h1 className="text-2xl font-extrabold text-slate-900">العهد</h1>
        <p className="text-sm text-slate-500 mt-1">
          بتسلّم عهدة لشخص (بتتخصم كاملة من الخزنة)، وكل اللي بيصرفه بيتخصم من العهدة مش من الخزنة. لما تقرب تخلص بينبّهك في الصفحة الرئيسية.
        </p>
      </div>

      {notice && (
        <div
          className={[
            "no-print flex items-center justify-between rounded-xl px-4 py-2.5 text-sm font-semibold",
            !notice.ok ? "bg-rose-50 text-rose-700" : notice.low ? "bg-amber-50 text-amber-800" : "bg-primary-light text-primary-dark",
          ].join(" ")}
        >
          <span>{notice.text}</span>
          <button onClick={() => setNotice(null)} className="text-xs opacity-70">
            إخفاء
          </button>
        </div>
      )}

      <form onSubmit={create} className="no-print bg-white rounded-card shadow-card p-5 flex flex-wrap items-end gap-2">
        <div>
          <label className="block text-xs text-slate-400 mb-1">العهدة لمين</label>
          <input value={holder} onChange={(e) => setHolder(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">التاريخ</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">المبلغ</label>
          <input type="number" min="0" step="any" value={amount} onChange={(e) => setAmount(e.target.value)} className={`${inputCls} w-28`} />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">طالعة من</label>
          <select value={method} onChange={(e) => setMethod(e.target.value)} className={inputCls}>
            {PAYMENT_METHODS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">نبّهني لما الباقي يوصل</label>
          <input
            type="number"
            min="0"
            step="any"
            value={warn}
            onChange={(e) => setWarn(e.target.value)}
            placeholder={amount ? String(Math.round(Number(amount) * 0.2)) : "20%"}
            className={`${inputCls} w-28`}
          />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">ملاحظة</label>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="اختياري" className={inputCls} />
        </div>
        <button type="submit" disabled={!holder.trim() || !amount} className="bg-primary text-white rounded-lg px-4 py-1.5 text-sm font-semibold disabled:opacity-50">
          سلّم العهدة
        </button>
      </form>

      <div className="no-print grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {list.length === 0 && <div className="text-sm text-slate-400">لسه مفيش عهد.</div>}
        {list.map((c) => (
          <div
            key={c.id}
            className={[
              "bg-white rounded-card shadow-card p-4 space-y-2",
              openId === c.id ? "ring-2 ring-primary" : "",
              c.low ? "border border-rose-200" : "",
              c.closed ? "opacity-60" : "",
            ].join(" ")}
          >
            <button onClick={() => setOpenId(openId === c.id ? null : c.id)} className="w-full text-start">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800">{c.holder}</span>
                <span className="text-xs text-slate-400">{c.date}</span>
              </div>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-xs text-slate-500">الباقي</span>
                <span className={`text-xl font-extrabold ${c.low ? "text-rose-600" : "text-primary-dark"}`}>{formatEGP(c.remaining)}</span>
              </div>
              <div className="text-[11px] text-slate-400 mb-1">
                من {formatEGP(c.given)} — اتصرف {formatEGP(c.spent)}
                {c.closed ? " — مقفولة" : c.low ? " — ⚠ قربت تخلص" : ""}
              </div>
              <ProgressBar c={c} />
            </button>
            <div className="flex items-center gap-3 pt-1">
              <button onClick={() => setOpenId(openId === c.id ? null : c.id)} className="text-xs font-semibold text-primary">
                {openId === c.id ? "اقفل الكشف" : "افتح الكشف"}
              </button>
              <button onClick={() => toggleClosed(c)} className="text-xs font-semibold text-slate-500">
                {c.closed ? "افتحها تاني" : "اقفل العهدة"}
              </button>
              <button onClick={() => remove(c)} className="text-xs font-semibold text-rose-500 ms-auto">
                مسح
              </button>
            </div>
          </div>
        ))}
      </div>

      {open && (
        <div className="print-solo-keep">
          <CustodyPanel
            id={open.id}
            equipment={equipment}
            categories={categories}
            onChanged={refresh}
            onNotice={(n) => {
              setNotice(n);
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
          />
        </div>
      )}
    </div>
  );
}
