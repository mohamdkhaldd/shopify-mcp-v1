import { FormEvent, useEffect, useState } from "react";
import Icon from "../../components/Icon";
import { employeesApi } from "../../api/client";
import { Driver, WageType } from "../../api/types";

function EditRow({ item, onSaved, onCancel }: { item: Driver; onSaved: () => void; onCancel: () => void }) {
  const [name, setName] = useState(item.name);
  const [wageType, setWageType] = useState<WageType>(item.wage_type);
  const [rate, setRate] = useState(String(item.rate));
  const [fixedSalary, setFixedSalary] = useState(item.fixed_salary);

  async function save(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    const rateValue = Number(rate);
    if (!trimmed || !rateValue) return;
    await employeesApi.update(item.id, {
      name: trimmed,
      wage_type: wageType,
      rate: rateValue,
      fixed_salary: wageType === "monthly" && fixedSalary,
    });
    onSaved();
  }

  return (
    <form onSubmit={save} className="grid grid-cols-1 sm:grid-cols-4 gap-2 py-2.5">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="sm:col-span-2 rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
      />
      <select
        value={wageType}
        onChange={(e) => setWageType(e.target.value as WageType)}
        className="rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
      >
        <option value="daily">أجر يومي</option>
        <option value="monthly">مرتب شهري</option>
      </select>
      <div className="flex gap-2">
        <input
          value={rate}
          onChange={(e) => setRate(e.target.value)}
          type="number"
          min="0"
          className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
        <button
          type="submit"
          className="shrink-0 bg-primary text-white rounded-xl px-3 py-2 text-sm font-semibold hover:bg-primary-dark transition-colors"
        >
          حفظ
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="shrink-0 text-xs text-slate-500 hover:text-slate-700 font-semibold px-2"
        >
          إلغاء
        </button>
      </div>
      {wageType === "monthly" && (
        <label className="sm:col-span-4 flex items-center gap-2 text-xs text-slate-500">
          <input
            type="checkbox"
            checked={fixedSalary}
            onChange={(e) => setFixedSalary(e.target.checked)}
            className="w-4 h-4 accent-primary"
          />
          مرتب ثابت مهما حصل (مش مرتبط بحضوره في السركي — زي المكنيكي)
        </label>
      )}
    </form>
  );
}

export default function DriversTab() {
  const [items, setItems] = useState<Driver[]>([]);
  const [name, setName] = useState("");
  const [wageType, setWageType] = useState<WageType>("daily");
  const [rate, setRate] = useState("");
  const [fixedSalary, setFixedSalary] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);

  const refresh = () => employeesApi.list().then(setItems);

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, []);

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    const rateValue = Number(rate);
    if (!trimmed || !rateValue) return;
    await employeesApi.create({
      name: trimmed,
      wage_type: wageType,
      rate: rateValue,
      fixed_salary: wageType === "monthly" && fixedSalary,
    });
    setName("");
    setRate("");
    setFixedSalary(false);
    await refresh();
  }

  async function handleDelete(id: number) {
    await employeesApi.remove(id);
    await refresh();
  }

  async function handleSaved() {
    setEditingId(null);
    await refresh();
  }

  return (
    <div className="bg-white rounded-card shadow-card p-5">
      <h2 className="font-bold text-slate-800 mb-1">السائقين والموظفين</h2>
      <p className="text-xs text-slate-400 mb-4">
        عايز تزود مرتب حد؟ دوس "تعديل" جنب اسمه وغيّر الرقم — مش محتاج تحذفه وتضيفه من الأول.
      </p>

      <form onSubmit={handleAdd} className="grid grid-cols-1 sm:grid-cols-4 gap-2 mb-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="اسم السائق أو الموظف"
          className="sm:col-span-2 rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
        <select
          value={wageType}
          onChange={(e) => setWageType(e.target.value as WageType)}
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
        >
          <option value="daily">أجر يومي</option>
          <option value="monthly">مرتب شهري</option>
        </select>
        <div className="flex gap-2">
          <input
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            type="number"
            min="0"
            placeholder={wageType === "daily" ? "اليومية" : "المرتب"}
            className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
          <button
            type="submit"
            className="shrink-0 bg-primary text-white rounded-xl px-4 py-2 text-sm font-semibold hover:bg-primary-dark transition-colors"
          >
            إضافة
          </button>
        </div>
      </form>

      {wageType === "monthly" && (
        <label className="flex items-center gap-2 text-xs text-slate-500 mb-5">
          <input
            type="checkbox"
            checked={fixedSalary}
            onChange={(e) => setFixedSalary(e.target.checked)}
            className="w-4 h-4 accent-primary"
          />
          مرتب ثابت مهما حصل (مش مرتبط بحضوره في السركي — زي المكنيكي)
        </label>
      )}
      {wageType !== "monthly" && <div className="mb-5" />}

      {loading ? (
        <div className="text-sm text-slate-400">جاري التحميل...</div>
      ) : items.length === 0 ? (
        <div className="text-sm text-slate-400">لسه مفيش سائقين أو موظفين مسجلين.</div>
      ) : (
        <ul className="divide-y divide-slate-50">
          {items.map((item) =>
            editingId === item.id ? (
              <li key={item.id}>
                <EditRow item={item} onSaved={handleSaved} onCancel={() => setEditingId(null)} />
              </li>
            ) : (
              <li key={item.id} className="flex items-center justify-between py-2.5">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-primary-light text-primary flex items-center justify-center">
                    <Icon name="salaries" className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-slate-700">{item.name}</div>
                    <div className="text-xs text-slate-400">
                      {item.wage_type === "daily" ? "يومي" : "شهري"} — {item.rate.toLocaleString("en-US")} ج.م
                      {item.wage_type === "monthly" && item.fixed_salary && " — مرتب ثابت مهما حصل"}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setEditingId(item.id)}
                    className="text-xs text-primary hover:text-primary-dark font-semibold"
                  >
                    تعديل
                  </button>
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="text-xs text-rose-500 hover:text-rose-700 font-semibold"
                  >
                    حذف
                  </button>
                </div>
              </li>
            )
          )}
        </ul>
      )}
    </div>
  );
}
