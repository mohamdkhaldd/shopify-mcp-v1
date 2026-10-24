import { FormEvent, useEffect, useState } from "react";
import { expenseCategoriesApi } from "../../api/client";
import { ExpenseCategory } from "../../api/types";
import Icon from "../../components/Icon";
import { useUndo } from "../../context/UndoContext";

export default function ExpenseCategoriesTab() {
  const [items, setItems] = useState<ExpenseCategory[]>([]);
  const [name, setName] = useState("");
  const [countsAsCommission, setCountsAsCommission] = useState(false);
  const [loading, setLoading] = useState(true);
  const { pushUndo } = useUndo();

  const refresh = () => expenseCategoriesApi.list().then(setItems);

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, []);

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    await expenseCategoriesApi.create(trimmed, countsAsCommission);
    setName("");
    setCountsAsCommission(false);
    await refresh();
  }

  async function handleToggleCommission(item: ExpenseCategory) {
    await expenseCategoriesApi.update(item.id, item.name, !item.counts_as_commission);
    await refresh();
  }

  async function handleDelete(id: number) {
    const item = items.find((i) => i.id === id);
    if (!item) return;
    await expenseCategoriesApi.remove(id);
    await refresh();
    pushUndo(`اتمسح نوع المصروف "${item.name}"`, async () => {
      await expenseCategoriesApi.create(item.name, item.counts_as_commission);
      await refresh();
    });
  }

  return (
    <div className="bg-white rounded-card shadow-card p-5">
      <h2 className="font-bold text-slate-800 mb-1">أنواع المصروفات</h2>
      <p className="text-xs text-slate-400 mb-4">
        علّم "يحسب في كوميشن حسن" على أي نوع زي المكنيكي أو السكن — أي مصروف من النوع ده على أي معدة يتضاف تلقائيًا
        لكوميشن حسن، من غير ما تسجله مرتين.
      </p>

      <form onSubmit={handleAdd} className="flex flex-wrap items-center gap-2 mb-5">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="اسم نوع المصروف (زي: صيانة، وقود)"
          className="flex-1 min-w-[160px] rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
        <label className="flex items-center gap-1.5 text-xs text-slate-500">
          <input
            type="checkbox"
            checked={countsAsCommission}
            onChange={(e) => setCountsAsCommission(e.target.checked)}
            className="w-4 h-4 accent-primary"
          />
          يحسب في كوميشن حسن
        </label>
        <button
          type="submit"
          className="shrink-0 flex items-center gap-1.5 bg-primary text-white rounded-xl px-4 py-2 text-sm font-semibold hover:bg-primary-dark transition-colors"
        >
          <Icon name="settings" className="w-4 h-4" />
          إضافة نوع
        </button>
      </form>

      {loading ? (
        <div className="text-sm text-slate-400">جاري التحميل...</div>
      ) : items.length === 0 ? (
        <div className="text-sm text-slate-400">لسه مفيش أنواع مصروفات مسجلة.</div>
      ) : (
        <ul className="divide-y divide-slate-50">
          {items.map((item) => (
            <li key={item.id} className="flex items-center justify-between py-2.5">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-primary-light text-primary flex items-center justify-center">
                  <Icon name="treasury" className="w-4 h-4" />
                </div>
                <span className="text-sm font-semibold text-slate-700">{item.name}</span>
              </div>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-1.5 text-xs text-slate-500">
                  <input
                    type="checkbox"
                    checked={item.counts_as_commission}
                    onChange={() => handleToggleCommission(item)}
                    className="w-4 h-4 accent-primary"
                  />
                  كوميشن حسن
                </label>
                <button
                  onClick={() => handleDelete(item.id)}
                  className="text-xs text-rose-500 hover:text-rose-700 font-semibold"
                >
                  حذف
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
