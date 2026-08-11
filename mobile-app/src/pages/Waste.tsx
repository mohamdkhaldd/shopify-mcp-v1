import { useState } from "react";
import MonthBar from "../components/MonthBar";
import { addWasteEntry, deleteWasteEntry, listWasteEntries } from "../store";
import { pushUndo } from "../undo";

function formatEGP(value: number): string {
  return `${Math.round(value).toLocaleString("ar-EG")} ج.م`;
}

const PAYMENT_METHODS = [
  { value: "cash", label: "كاش" },
  { value: "wallet", label: "اكسيس باي" },
  { value: "instapay", label: "انستا باي" },
  { value: "vodafone_cash", label: "فودفون كاش" },
];

function paymentMethodLabel(v: string | null) {
  return PAYMENT_METHODS.find((m) => m.value === v)?.label ?? v ?? "—";
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default function Waste({ month, onChangeMonth, onBack }: { month: string; onChangeMonth: (m: string) => void; onBack: () => void }) {
  const [entries, setEntries] = useState(() => listWasteEntries(month));
  const [date, setDate] = useState(todayIso());
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [note, setNote] = useState("");

  function refresh() {
    setEntries(listWasteEntries(month));
  }

  function save() {
    if (!amount) return;
    addWasteEntry({ date, amount: Number(amount), payment_method: paymentMethod, note: note.trim() || null });
    setAmount("");
    setNote("");
    refresh();
  }

  function remove(id: number) {
    const entry = entries.find((e) => e.id === id);
    if (!entry) return;
    deleteWasteEntry(id);
    refresh();
    pushUndo("اتمسح قيد هالك", () => {
      addWasteEntry({ date: entry.date, amount: entry.amount, payment_method: entry.payment_method, note: entry.note });
      refresh();
    });
  }

  const total = entries.reduce((sum, e) => sum + e.amount, 0);

  return (
    <div>
      <div className="bg-primary text-white px-4 pt-6 pb-3 flex items-center gap-2">
        <button onClick={onBack} className="text-white/80 text-lg">
          ‹
        </button>
        <div>
          <div className="text-xs opacity-80 font-bold">دفتر البنيان</div>
          <div className="text-lg font-extrabold mt-0.5">الهالك</div>
        </div>
      </div>
      <MonthBar month={month} onChange={onChangeMonth} />

      <div className="p-4 space-y-3">
        <div className="bg-white rounded-2xl shadow-card p-3.5 flex items-center justify-between">
          <span className="text-sm text-slate-500 font-semibold">إجمالي الهالك — الشهر ده</span>
          <span className="font-extrabold text-rose-600">{formatEGP(total)}</span>
        </div>

        <div className="bg-white rounded-2xl shadow-card p-4 space-y-2">
          <div className="text-sm font-extrabold text-slate-700">تسجيل هالك</div>
          <div>
            <label className="block text-[11px] text-slate-500 mb-1">التاريخ</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-[11px] text-slate-500 mb-1">المبلغ</label>
            <input type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-[11px] text-slate-500 mb-1">طريقة الدفع</label>
            <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm">
              {PAYMENT_METHODS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] text-slate-500 mb-1">البيان (إيه هو الهالك ده)</label>
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="مثلاً: قطعة غيار اتكسرت" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
          </div>
          <button onClick={save} disabled={!amount} className="w-full bg-primary text-white rounded-xl py-2.5 text-sm font-bold disabled:opacity-50">
            تسجيل هالك
          </button>
        </div>

        <div className="space-y-2">
          {entries.length === 0 ? (
            <div className="text-sm text-slate-400 text-center py-4">لسه مفيش هالك مسجل الشهر ده.</div>
          ) : (
            entries.map((e) => (
              <div key={e.id} className="bg-white rounded-xl border border-slate-200 px-3 py-2.5 flex items-center justify-between text-sm">
                <div>
                  <div className="text-slate-700 font-semibold">{e.note ?? "—"}</div>
                  <div className="text-[11px] text-slate-400">
                    {e.date} — {paymentMethodLabel(e.payment_method)}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-rose-600">{formatEGP(e.amount)}</span>
                  <button onClick={() => remove(e.id)} className="text-rose-500 text-xs font-bold">
                    مسح
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
