import { FormEvent, useEffect, useState } from "react";
import MonthPicker from "../components/equipment/MonthPicker";
import PrintButton from "../components/PrintButton";
import { wasteApi } from "../api/client";
import { WasteEntry } from "../api/types";
import { currentMonthKey } from "../utils/months";
import { formatEGP } from "../utils/format";
import { PAYMENT_METHODS, paymentMethodLabel } from "../utils/paymentMethods";
import { useUndo } from "../context/UndoContext";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function WasteForm({ onSaved }: { onSaved: () => void }) {
  const [date, setDate] = useState(todayIso());
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [note, setNote] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!amount) return;
    await wasteApi.create({ date, amount: Number(amount), payment_method: paymentMethod, note: note || null });
    setAmount("");
    setNote("");
    onSaved();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2">
      <div>
        <label className="block text-xs text-slate-400 mb-1">التاريخ</label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
        />
      </div>
      <div>
        <label className="block text-xs text-slate-400 mb-1">المبلغ</label>
        <input
          type="number"
          min="0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-28 rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
        />
      </div>
      <div>
        <label className="block text-xs text-slate-400 mb-1">طريقة الدفع</label>
        <select
          value={paymentMethod}
          onChange={(e) => setPaymentMethod(e.target.value)}
          className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
        >
          {PAYMENT_METHODS.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
      </div>
      <div className="flex-1 min-w-[180px]">
        <label className="block text-xs text-slate-400 mb-1">البيان (إيه هو الهالك ده)</label>
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="مثلاً: قطعة غيار اتكسرت"
          className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
        />
      </div>
      <button type="submit" className="bg-primary text-white rounded-lg px-4 py-1.5 text-sm font-semibold hover:bg-primary-dark">
        تسجيل هالك
      </button>
    </form>
  );
}

export default function Waste() {
  const [month, setMonth] = useState(currentMonthKey());
  const [items, setItems] = useState<WasteEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const { pushUndo } = useUndo();

  const refresh = () => wasteApi.list(month).then(setItems);

  useEffect(() => {
    setLoading(true);
    refresh().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

  async function handleDelete(id: number) {
    const item = items.find((i) => i.id === id);
    if (!item) return;
    await wasteApi.remove(id);
    await refresh();
    pushUndo("اتمسح قيد هالك", async () => {
      await wasteApi.create({ date: item.date, amount: item.amount, payment_method: item.payment_method, note: item.note });
      await refresh();
    });
  }

  const total = items.reduce((sum, i) => sum + i.amount, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">الهالك</h1>
          <p className="text-sm text-slate-500 mt-1">أي فلوس اتصرفت كهالك — بتاريخها وطريقة دفعها وبيان بإيه هو. بتظهر بردو في شيت الصادر.</p>
        </div>
        <div className="no-print flex items-center gap-2">
          <MonthPicker month={month} onChange={setMonth} />
          <PrintButton />
        </div>
      </div>

      <div className="no-print bg-white rounded-card shadow-card p-5">
        <h2 className="font-bold text-slate-800 mb-3">تسجيل هالك جديد</h2>
        <WasteForm onSaved={refresh} />
      </div>

      <div className="bg-white rounded-card shadow-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-slate-800">سجل الهالك</h2>
          <span className="text-sm font-bold text-rose-600">{formatEGP(total)}</span>
        </div>
        {loading ? (
          <div className="text-sm text-slate-400">جاري التحميل...</div>
        ) : items.length === 0 ? (
          <div className="text-sm text-slate-400">لسه مفيش هالك مسجل الشهر ده.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-400 border-b border-slate-100">
                <th className="text-start font-semibold py-2">التاريخ</th>
                <th className="text-start font-semibold py-2">طريقة الدفع</th>
                <th className="text-start font-semibold py-2">البيان</th>
                <th className="text-start font-semibold py-2">المبلغ</th>
                <th className="no-print text-start font-semibold py-2"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b border-slate-50 last:border-0">
                  <td className="py-2 text-slate-500">{item.date}</td>
                  <td className="py-2 text-slate-500">{paymentMethodLabel(item.payment_method)}</td>
                  <td className="py-2 text-slate-700">{item.note ?? "—"}</td>
                  <td className="py-2 font-semibold text-slate-700">{formatEGP(item.amount)}</td>
                  <td className="no-print py-2 text-end">
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="text-xs text-rose-500 hover:text-rose-700 font-semibold"
                    >
                      حذف
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
