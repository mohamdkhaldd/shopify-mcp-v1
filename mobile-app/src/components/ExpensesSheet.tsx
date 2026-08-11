import { useEffect, useState } from "react";
import { daysInMonth } from "../utils/months";
import { addMonthlyExpense, deleteMonthlyExpense, listExpenseCategories, listMonthlyExpenses } from "../store";
import { MonthlyExpense } from "../types";

const PAYMENT_METHODS = [
  { value: "cash", label: "كاش" },
  { value: "wallet", label: "اكسيس باي" },
  { value: "instapay", label: "انستا باي" },
  { value: "vodafone_cash", label: "فودفون كاش" },
];

function handleImageSelect(file: File | null, onLoaded: (dataUrl: string) => void) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => onLoaded(reader.result as string);
  reader.readAsDataURL(file);
}

export default function ExpensesSheet({ equipmentId, month }: { equipmentId: number; month: string }) {
  const [expenses, setExpenses] = useState<MonthlyExpense[]>([]);
  const categories = listExpenseCategories();
  const [date, setDate] = useState(daysInMonth(month)[0]);
  const [categoryId, setCategoryId] = useState<string>(String(categories[0]?.id ?? ""));
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");
  const [note, setNote] = useState("");
  const [receiptImage, setReceiptImage] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const refresh = () => setExpenses(listMonthlyExpenses(equipmentId, month));
  useEffect(() => {
    refresh();
    setDate(daysInMonth(month)[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [equipmentId, month]);

  function save() {
    if (!amount) return;
    addMonthlyExpense({
      equipment_id: equipmentId,
      month,
      date,
      category_id: categoryId ? Number(categoryId) : null,
      amount: Number(amount) || 0,
      payment_method: method,
      note: note.trim() || null,
      receipt_image: receiptImage,
    });
    setAmount("");
    setNote("");
    setReceiptImage(null);
    refresh();
  }

  function remove(id: number) {
    deleteMonthlyExpense(id);
    refresh();
  }

  return (
    <div className="space-y-3">
      <div className="bg-white rounded-2xl shadow-card p-4 space-y-2">
        <div className="text-sm font-extrabold text-slate-700">مصروف على المعدة</div>
        <div>
          <label className="block text-[11px] text-slate-500 mb-1">التاريخ</label>
          <select value={date} onChange={(e) => setDate(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm">
            {daysInMonth(month).map((d) => (
              <option key={d} value={d}>
                {d.slice(-2)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[11px] text-slate-500 mb-1">النوع</label>
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm">
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[11px] text-slate-500 mb-1">المبلغ</label>
          <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-[11px] text-slate-500 mb-1">طريقة الدفع</label>
          <select value={method} onChange={(e) => setMethod(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm">
            {PAYMENT_METHODS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[11px] text-slate-500 mb-1">بيان</label>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="اختياري" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-[11px] text-slate-500 mb-1">صورة الإيصال</label>
          {receiptImage ? (
            <div className="flex items-center gap-2">
              <img src={receiptImage} alt="" className="w-14 h-14 rounded-lg object-cover border border-slate-200" />
              <button onClick={() => setReceiptImage(null)} className="text-xs text-rose-500 font-bold">
                مسح الصورة
              </button>
            </div>
          ) : (
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => handleImageSelect(e.target.files?.[0] ?? null, setReceiptImage)}
              className="w-full text-xs text-slate-500"
            />
          )}
        </div>
        <button onClick={save} disabled={!amount} className="w-full bg-primary text-white rounded-xl py-2.5 text-sm font-bold disabled:opacity-50">
          حفظ المصروف
        </button>
      </div>

      <div className="space-y-2">
        {expenses.map((e) => (
          <div key={e.id} className="bg-white rounded-xl border border-slate-200 px-3 py-2 flex items-center justify-between text-sm">
            {e.receipt_image ? (
              <button onClick={() => setPreviewImage(e.receipt_image)}>
                <img src={e.receipt_image} alt="" className="w-8 h-8 rounded object-cover border border-slate-200" />
              </button>
            ) : (
              <div className="text-slate-500">{e.date?.slice(-2)}</div>
            )}
            <div className="font-bold text-primary-dark">{e.amount} ج.م</div>
            <button onClick={() => remove(e.id)} className="text-rose-500 text-xs font-bold">
              مسح
            </button>
          </div>
        ))}
      </div>

      {previewImage && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-6" onClick={() => setPreviewImage(null)}>
          <img src={previewImage} alt="" className="max-w-full max-h-full rounded-xl" />
        </div>
      )}
    </div>
  );
}
