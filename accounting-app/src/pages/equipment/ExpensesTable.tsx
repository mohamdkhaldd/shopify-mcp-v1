import { FormEvent, useEffect, useState } from "react";
import { equipmentApi, expenseCategoriesApi, monthlyExpensesApi } from "../../api/client";
import { DriverSalaryBreakdownRow, ExpenseCategory, MonthlyExpense } from "../../api/types";
import { formatEGP } from "../../utils/format";
import { PAYMENT_METHODS, paymentMethodLabel } from "../../utils/paymentMethods";
import { daysInMonth } from "../../utils/months";

// المصروف بيتفلتر حسب الشهر المعروض، فلازم تاريخه يقع جوه نفس الشهر ده —
// وإلا كان هيتسجل وميظهرش أبدًا في أي شهر بتتصفحه.
function defaultDateForMonth(month: string): string {
  const dates = daysInMonth(month);
  const today = new Date().toISOString().slice(0, 10);
  return dates.includes(today) ? today : dates[0];
}

interface ExpensesTableProps {
  equipmentId: number;
  month: string;
  onChanged?: () => void;
}

export default function ExpensesTable({ equipmentId, month, onChanged }: ExpensesTableProps) {
  const [expenses, setExpenses] = useState<MonthlyExpense[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [driverSalaryBreakdown, setDriverSalaryBreakdown] = useState<DriverSalaryBreakdownRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryId, setCategoryId] = useState("");
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [date, setDate] = useState(() => defaultDateForMonth(month));
  const [note, setNote] = useState("");
  const [receiptImage, setReceiptImage] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const refresh = () => monthlyExpensesApi.list(equipmentId, month).then(setExpenses);
  const refreshDriverSalary = () =>
    equipmentApi.summary(equipmentId, month).then((s) => setDriverSalaryBreakdown(s.driverSalaryBreakdown));

  useEffect(() => {
    setLoading(true);
    Promise.all([refresh(), refreshDriverSalary(), expenseCategoriesApi.list().then(setCategories)]).finally(() =>
      setLoading(false)
    );
  }, [equipmentId, month]);

  useEffect(() => {
    setDate(defaultDateForMonth(month));
  }, [month]);

  const monthDates = daysInMonth(month);

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    if (!categoryId || !amount) return;
    await monthlyExpensesApi.create({
      equipment_id: equipmentId,
      month,
      date,
      category_id: Number(categoryId),
      amount: Number(amount),
      payment_method: paymentMethod,
      note: note.trim() || null,
      receipt_image: receiptImage,
    });
    setAmount("");
    setNote("");
    setReceiptImage(null);
    await refresh();
    onChanged?.();
  }

  // بيحول صورة الفاتورة لنص (data URL) عشان تتخزن مع بيانات المصروف في نفس
  // القاعدة، من غير ما نحتاج نتعامل مع ملفات منفصلة على الجهاز.
  function handleImageSelect(file: File | null) {
    if (!file) {
      setReceiptImage(null);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setReceiptImage(reader.result as string);
    reader.readAsDataURL(file);
  }

  async function handleDelete(id: number) {
    await monthlyExpensesApi.remove(id);
    await refresh();
    onChanged?.();
  }

  const driverSalaryTotal = driverSalaryBreakdown.reduce((sum, d) => sum + d.amount, 0);
  const total = expenses.reduce((sum, e) => sum + e.amount, 0) + driverSalaryTotal;

  return (
    <div className="bg-white rounded-card shadow-card p-5">
      <form onSubmit={handleAdd} className="no-print flex flex-wrap items-end gap-2 mb-4 pb-4 border-b border-slate-100">
        <div>
          <label className="block text-xs text-slate-400 mb-1">التاريخ</label>
          <input
            type="date"
            value={date}
            min={monthDates[0]}
            max={monthDates[monthDates.length - 1]}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">نوع المصروف</label>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          >
            <option value="">اختر</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">القيمة</label>
          <input
            type="number"
            min="0"
            step="any"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-28 rounded-lg border border-slate-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">طريقة الدفع</label>
          <select
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}
            className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          >
            {PAYMENT_METHODS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">بيان</label>
          <input
            type="text"
            placeholder="مثلاً: قطعة الغيار اللي اتشترت"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">صورة الفاتورة (اختياري)</label>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => handleImageSelect(e.target.files?.[0] ?? null)}
            className="text-xs w-40"
          />
        </div>
        <button
          type="submit"
          className="bg-primary text-white rounded-lg px-4 py-1.5 text-sm font-semibold hover:bg-primary-dark transition-colors"
        >
          إضافة
        </button>
      </form>

      {previewImage && (
        <div className="no-print fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-6" onClick={() => setPreviewImage(null)}>
          <img src={previewImage} alt="صورة الفاتورة" className="max-w-full max-h-full rounded-xl shadow-2xl" />
        </div>
      )}

      {loading ? (
        <div className="text-sm text-slate-400">جاري التحميل...</div>
      ) : expenses.length === 0 && driverSalaryBreakdown.length === 0 ? (
        <div className="text-sm text-slate-400">لسه مفيش مصروفات مسجلة لشهر {month}.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-400 border-b border-slate-100">
                <th className="text-start font-semibold py-2">التاريخ</th>
                <th className="text-start font-semibold py-2">نوع المصروف</th>
                <th className="text-start font-semibold py-2">القيمة</th>
                <th className="text-start font-semibold py-2">طريقة الدفع</th>
                <th className="text-start font-semibold py-2">بيان</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {driverSalaryBreakdown.map((d) => (
                <tr key={d.name} className="border-b border-slate-50 last:border-0 bg-slate-50/60">
                  <td className="py-2 text-slate-400">—</td>
                  <td className="py-2 font-semibold text-slate-700">مرتب سائق: {d.name}</td>
                  <td className="py-2 text-slate-600">{formatEGP(d.amount)}</td>
                  <td className="py-2 text-slate-400">—</td>
                  <td className="py-2 text-slate-400">—</td>
                  <td className="py-2"></td>
                </tr>
              ))}
              {expenses.map((exp) => (
                <tr key={exp.id} className="border-b border-slate-50 last:border-0">
                  <td className="py-2 text-slate-500">{exp.date ?? "—"}</td>
                  <td className="py-2 font-semibold text-slate-700">{exp.category_name ?? "—"}</td>
                  <td className="py-2 text-slate-600">{formatEGP(exp.amount)}</td>
                  <td className="py-2 text-slate-500">{paymentMethodLabel(exp.payment_method)}</td>
                  <td className="py-2 text-slate-500">
                    {exp.note && <span>{exp.note}</span>}
                    {exp.receipt_image && (
                      <button
                        onClick={() => setPreviewImage(exp.receipt_image)}
                        className="no-print text-primary hover:text-primary-dark font-semibold ms-1.5 underline"
                      >
                        عرض الفاتورة
                      </button>
                    )}
                    {!exp.note && !exp.receipt_image && "—"}
                  </td>
                  <td className="py-2">
                    <button
                      onClick={() => handleDelete(exp.id)}
                      className="no-print text-xs text-rose-500 hover:text-rose-700 font-semibold"
                    >
                      حذف
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td className="pt-3 text-sm font-bold text-slate-700" colSpan={2}>إجمالي الشهر</td>
                <td className="pt-3 text-sm font-bold text-rose-600">{formatEGP(total)}</td>
                <td colSpan={3}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
