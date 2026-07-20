import { FormEvent, useEffect, useState } from "react";
import { contractorsApi } from "../../api/client";
import { Contractor } from "../../api/types";
import Icon from "../../components/Icon";
import { formatEGP } from "../../utils/format";

function OpeningBalanceCell({ contractor, onSaved }: { contractor: Contractor; onSaved: () => void }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(contractor.opening_balance));

  async function save() {
    await contractorsApi.updateOpeningBalance(contractor.id, Number(value) || 0);
    setEditing(false);
    onSaved();
  }

  if (editing) {
    return (
      <div className="flex items-center gap-2">
        <input
          type="number"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="w-28 rounded-lg border border-slate-200 px-2 py-1 text-sm"
          autoFocus
        />
        <button onClick={save} className="text-xs font-semibold text-primary hover:text-primary-dark">
          حفظ
        </button>
      </div>
    );
  }

  return (
    <button onClick={() => setEditing(true)} className="text-sm font-bold text-slate-700 hover:text-primary">
      {formatEGP(contractor.opening_balance)}
    </button>
  );
}

export default function ContractorsTab() {
  const [items, setItems] = useState<Contractor[]>([]);
  const [name, setName] = useState("");
  const [openingBalance, setOpeningBalance] = useState("");
  const [loading, setLoading] = useState(true);

  const refresh = () => contractorsApi.list().then(setItems);

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, []);

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    await contractorsApi.create(trimmed, Number(openingBalance) || 0);
    setName("");
    setOpeningBalance("");
    await refresh();
  }

  async function handleDelete(id: number) {
    await contractorsApi.remove(id);
    await refresh();
  }

  return (
    <div className="bg-white rounded-card shadow-card p-5">
      <h2 className="font-bold text-slate-800 mb-1">المقاولين</h2>
      <p className="text-xs text-slate-400 mb-4">
        الرصيد الافتتاحي هو الفلوس المستحقة عليه من شهور سابقة لسه ما اتسجلتش — بتتضاف على المستحق عليه، وبتتخصم أول ما يدفع.
      </p>

      <form onSubmit={handleAdd} className="flex flex-wrap gap-2 mb-5">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="اسم المقاول"
          className="flex-1 min-w-[160px] rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
        <input
          type="number"
          value={openingBalance}
          onChange={(e) => setOpeningBalance(e.target.value)}
          placeholder="رصيد افتتاحي (اختياري)"
          className="w-48 rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
        <button
          type="submit"
          className="shrink-0 flex items-center gap-1.5 bg-primary text-white rounded-xl px-4 py-2 text-sm font-semibold hover:bg-primary-dark transition-colors"
        >
          <Icon name="settings" className="w-4 h-4" />
          إضافة مقاول
        </button>
      </form>

      {loading ? (
        <div className="text-sm text-slate-400">جاري التحميل...</div>
      ) : items.length === 0 ? (
        <div className="text-sm text-slate-400">لسه مفيش مقاولين مسجلين.</div>
      ) : (
        <ul className="divide-y divide-slate-50">
          {items.map((item) => (
            <li key={item.id} className="flex items-center justify-between py-2.5 gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-primary-light text-primary flex items-center justify-center">
                  <Icon name="contractors" className="w-4 h-4" />
                </div>
                <span className="text-sm font-semibold text-slate-700">{item.name}</span>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-end">
                  <div className="text-[11px] text-slate-400">رصيد افتتاحي</div>
                  <OpeningBalanceCell contractor={item} onSaved={refresh} />
                </div>
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
