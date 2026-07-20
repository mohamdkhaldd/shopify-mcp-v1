import { FormEvent, useEffect, useState } from "react";
import Icon from "../../components/Icon";
import { equipmentApi, partnersApi } from "../../api/client";
import { Equipment, Partner } from "../../api/types";

interface ShareDraft {
  partner_id: string;
  percentage: string;
}

export default function EquipmentTab() {
  const [items, setItems] = useState<Equipment[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [name, setName] = useState("");
  const [shares, setShares] = useState<ShareDraft[]>([{ partner_id: "", percentage: "" }]);
  const [loading, setLoading] = useState(true);

  const refresh = () => Promise.all([equipmentApi.list(), partnersApi.list()]).then(([eq, p]) => {
    setItems(eq);
    setPartners(p);
  });

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, []);

  function updateShare(index: number, patch: Partial<ShareDraft>) {
    setShares((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }

  function addShareRow() {
    setShares((prev) => [...prev, { partner_id: "", percentage: "" }]);
  }

  function removeShareRow(index: number) {
    setShares((prev) => prev.filter((_, i) => i !== index));
  }

  const shareTotal = shares.reduce((sum, s) => sum + (Number(s.percentage) || 0), 0);

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;

    const validShares = shares
      .filter((s) => s.partner_id && Number(s.percentage) > 0)
      .map((s) => ({ partner_id: Number(s.partner_id), percentage: Number(s.percentage) }));

    await equipmentApi.create({ name: trimmed, shares: validShares });
    setName("");
    setShares([{ partner_id: "", percentage: "" }]);
    await refresh();
  }

  async function handleDelete(id: number) {
    await equipmentApi.remove(id);
    await refresh();
  }

  function partnerName(id: number) {
    return partners.find((p) => p.id === id)?.name ?? "—";
  }

  return (
    <div className="bg-white rounded-card shadow-card p-5">
      <h2 className="font-bold text-slate-800 mb-4">المعدات</h2>

      {partners.length === 0 && (
        <div className="mb-4 text-xs bg-amber-50 text-amber-700 rounded-lg px-3 py-2">
          ضيف الشركاء الأول من تبويب "الشركاء" عشان تقدر تحدد نسبهم في المعدة.
        </div>
      )}

      <form onSubmit={handleAdd} className="space-y-3 mb-5">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="اسم المعدة"
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
        />

        <div className="space-y-2">
          <div className="text-xs font-semibold text-slate-500">نسب الشركاء في المعدة</div>
          {shares.map((share, i) => (
            <div key={i} className="flex gap-2">
              <select
                value={share.partner_id}
                onChange={(e) => updateShare(i, { partner_id: e.target.value })}
                className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                <option value="">اختر شريك</option>
                {partners.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <input
                value={share.percentage}
                onChange={(e) => updateShare(i, { percentage: e.target.value })}
                type="number"
                min="0"
                max="100"
                placeholder="النسبة %"
                className="w-28 rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
              {shares.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeShareRow(i)}
                  className="shrink-0 text-rose-500 hover:text-rose-700 px-2"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={addShareRow}
              className="text-xs font-semibold text-primary hover:text-primary-dark"
            >
              + إضافة شريك تاني
            </button>
            {shareTotal > 0 && (
              <span className={`text-xs font-semibold ${shareTotal === 100 ? "text-primary" : "text-amber-600"}`}>
                إجمالي النسب: {shareTotal}%{shareTotal !== 100 && " (المفروض تكون ١٠٠٪)"}
              </span>
            )}
          </div>
        </div>

        <button
          type="submit"
          className="flex items-center gap-1.5 bg-primary text-white rounded-xl px-4 py-2 text-sm font-semibold hover:bg-primary-dark transition-colors"
        >
          <Icon name="equipment" className="w-4 h-4" />
          إضافة المعدة
        </button>
      </form>

      {loading ? (
        <div className="text-sm text-slate-400">جاري التحميل...</div>
      ) : items.length === 0 ? (
        <div className="text-sm text-slate-400">لسه مفيش معدات مسجلة.</div>
      ) : (
        <ul className="divide-y divide-slate-50">
          {items.map((item) => (
            <li key={item.id} className="flex items-center justify-between py-2.5">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-primary-light text-primary flex items-center justify-center">
                  <Icon name="equipment" className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-700">{item.name}</div>
                  <div className="text-xs text-slate-400">
                    {item.shares.length === 0
                      ? "بدون شركاء محددين"
                      : item.shares.map((s) => `${partnerName(s.partner_id)} ${s.percentage}%`).join(" — ")}
                  </div>
                </div>
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
