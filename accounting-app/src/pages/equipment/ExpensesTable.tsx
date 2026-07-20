import { FormEvent, useEffect, useState } from "react";
import { expenseCategoriesApi, monthlyExpensesApi } from "../../api/client";
import { ExpenseCategory, MonthlyExpense } from "../../api/types";
import { formatEGP } from "../../utils/format";
import { PAYMENT_METHODS, paymentMethodLabel } from "../../utils/paymentMethods";

interface ExpensesTableProps {
  equipmentId: number;
  month: string;
  onChanged?: () => void;
}

export default function ExpensesTable({ equipmentId, month, onChanged }: ExpensesTableProps) {
  const [expenses, setExpenses] = useState<MonthlyExpense[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryId, setCategoryId] = useState("");
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");

  const refresh = () => monthlyExpensesApi.list(equipmentId, month).then(setExpenses);

  useEffect(() => {
    setLoading(true);
    Promise.all([refresh(), expenseCategoriesApi.list().then(setCategories)]).finally(() => setLoading(false));
  }, [equipmentId, month]);

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    if (!categoryId || !amount) return;
    await monthlyExpensesApi.create({
      equipment_id: equipmentId,
      month,
      category_id: Number(categoryId),
      amount: Number(amount),
      payment_method: paymentMethod,
    });
    setAmount("");
    await refresh();
    onChanged?.();
  }

  async function handleDelete(id: number) {
    await monthlyExpensesApi.remove(id);
    await refresh();
    onChanged?.();
  }

  const total = expenses.reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className="bg-white rounded-card shadow-card p-5">
      <form onSubmit={handleAdd} className="no-print flex flex-wrap items-end gap-2 mb-4 pb-4 border-b border-slate-100">
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
        <button
          type="submit"
          className="bg-primary text-white rounded-lg px-4 py-1.5 text-sm font-semibold hover:bg-primary-dark transition-colors"
        >
          إضافة
        </button>
      </form>

      {loading ? (
        <div className="text-sm text-slate-400">جاري التحميل...</div>
      ) : expenses.length === 0 ? (
        <div className="text-sm text-slate-400">لسه مفيش مصروفات مسجلة لشهر {month}.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-400 border-b border-slate-100">
                <th className="text-start font-semibold py-2">نوع المصروف</th>
                <th className="text-start font-semibold py-2">القيمة</th>
                <th className="text-start font-semibold py-2">طريقة الدفع</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((exp) => (
                <tr key={exp.id} className="border-b border-slate-50 last:border-0">
                  <td className="py-2 font-semibold text-slate-700">{exp.category_name ?? "—"}</td>
                  <td className="py-2 text-slate-600">{formatEGP(exp.amount)}</td>
                  <td className="py-2 text-slate-500">{paymentMethodLabel(exp.payment_method)}</td>
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
                <td className="pt-3 text-sm font-bold text-slate-700">إجمالي الشهر</td>
                <td className="pt-3 text-sm font-bold text-rose-600">{formatEGP(total)}</td>
                <td colSpan={2}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
