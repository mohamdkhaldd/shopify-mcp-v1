import { FormEvent, useEffect, useState } from "react";
import Icon from "../Icon";

interface Entity {
  id: number;
  name: string;
}

interface SimpleEntityManagerProps {
  title: string;
  addLabel: string;
  namePlaceholder: string;
  emptyMessage: string;
  icon: string;
  api: {
    list: () => Promise<Entity[]>;
    create: (name: string) => Promise<Entity>;
    remove: (id: number) => Promise<void>;
  };
}

export default function SimpleEntityManager({
  title,
  addLabel,
  namePlaceholder,
  emptyMessage,
  icon,
  api,
}: SimpleEntityManagerProps) {
  const [items, setItems] = useState<Entity[]>([]);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);

  const refresh = () => api.list().then(setItems);

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, []);

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    await api.create(trimmed);
    setName("");
    await refresh();
  }

  async function handleDelete(id: number) {
    await api.remove(id);
    await refresh();
  }

  return (
    <div className="bg-white rounded-card shadow-card p-5">
      <h2 className="font-bold text-slate-800 mb-4">{title}</h2>

      <form onSubmit={handleAdd} className="flex gap-2 mb-5">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={namePlaceholder}
          className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
        <button
          type="submit"
          className="shrink-0 flex items-center gap-1.5 bg-primary text-white rounded-xl px-4 py-2 text-sm font-semibold hover:bg-primary-dark transition-colors"
        >
          <Icon name="settings" className="w-4 h-4" />
          {addLabel}
        </button>
      </form>

      {loading ? (
        <div className="text-sm text-slate-400">جاري التحميل...</div>
      ) : items.length === 0 ? (
        <div className="text-sm text-slate-400">{emptyMessage}</div>
      ) : (
        <ul className="divide-y divide-slate-50">
          {items.map((item) => (
            <li key={item.id} className="flex items-center justify-between py-2.5">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-primary-light text-primary flex items-center justify-center">
                  <Icon name={icon} className="w-4 h-4" />
                </div>
                <span className="text-sm font-semibold text-slate-700">{item.name}</span>
              </div>
              <button
                onClick={() => handleDelete(item.id)}
                className="text-xs text-rose-500 hover:text-rose-700 font-semibold"
              >
                حذف
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
