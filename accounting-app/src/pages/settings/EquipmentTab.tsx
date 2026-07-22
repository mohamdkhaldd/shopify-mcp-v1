import { FormEvent, useEffect, useState } from "react";
import Icon from "../../components/Icon";
import { equipmentApi, partnersApi } from "../../api/client";
import { Equipment, Partner } from "../../api/types";
import { formatEGP } from "../../utils/format";

interface ShareDraft {
  partner_id: string;
  percentage: string;
}

function SharesEditor({
  partners,
  shares,
  onChange,
}: {
  partners: Partner[];
  shares: ShareDraft[];
  onChange: (shares: ShareDraft[]) => void;
}) {
  function updateShare(index: number, patch: Partial<ShareDraft>) {
    onChange(shares.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }

  function addShareRow() {
    onChange([...shares, { partner_id: "", percentage: "" }]);
  }

  function removeShareRow(index: number) {
    onChange(shares.filter((_, i) => i !== index));
  }

  const shareTotal = shares.reduce((sum, s) => sum + (Number(s.percentage) || 0), 0);

  return (
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
            step="0.01"
            placeholder="النسبة % (زي 12.5)"
            className="w-28 rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
          {shares.length > 1 && (
            <button type="button" onClick={() => removeShareRow(i)} className="shrink-0 text-rose-500 hover:text-rose-700 px-2">
              ✕
            </button>
          )}
        </div>
      ))}
      <div className="flex items-center justify-between">
        <button type="button" onClick={addShareRow} className="text-xs font-semibold text-primary hover:text-primary-dark">
          + إضافة شريك تاني
        </button>
        {shareTotal > 0 && (
          <span className={`text-xs font-semibold ${shareTotal === 100 ? "text-primary" : "text-amber-600"}`}>
            إجمالي النسب: {shareTotal}%{shareTotal !== 100 && " (المفروض تكون ١٠٠٪)"}
          </span>
        )}
      </div>
    </div>
  );
}

function EditRow({
  item,
  partners,
  onSaved,
  onCancel,
}: {
  item: Equipment;
  partners: Partner[];
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [purchasePrice, setPurchasePrice] = useState(String(item.purchase_price || ""));
  const [shares, setShares] = useState<ShareDraft[]>(
    item.shares.length > 0
      ? item.shares.map((s) => ({ partner_id: String(s.partner_id), percentage: String(s.percentage) }))
      : [{ partner_id: "", percentage: "" }]
  );

  async function save(e: FormEvent) {
    e.preventDefault();
    const validShares = shares
      .filter((s) => s.partner_id && Number(s.percentage) > 0)
      .map((s) => ({ partner_id: Number(s.partner_id), percentage: Number(s.percentage) }));
    await equipmentApi.update(item.id, { purchase_price: Number(purchasePrice) || 0, shares: validShares });
    onSaved();
  }

  return (
    <form onSubmit={save} className="py-3 space-y-3 bg-slate-50 rounded-xl px-3 my-1.5">
      <div className="font-semibold text-sm text-slate-700">{item.name}</div>
      <div>
        <label className="block text-xs text-slate-400 mb-1">سعر الشراء (اختياري — عشان تحسب نسبة استرداد السعر)</label>
        <input
          value={purchasePrice}
          onChange={(e) => setPurchasePrice(e.target.value)}
          type="number"
          min="0"
          step="any"
          placeholder="سعر الشراء"
          className="w-48 rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
      </div>
      <SharesEditor partners={partners} shares={shares} onChange={setShares} />
      <div className="flex gap-2">
        <button type="submit" className="bg-primary text-white rounded-xl px-4 py-2 text-sm font-semibold hover:bg-primary-dark transition-colors">
          حفظ
        </button>
        <button type="button" onClick={onCancel} className="text-xs text-slate-500 hover:text-slate-700 font-semibold px-2">
          إلغاء
        </button>
      </div>
    </form>
  );
}

export default function EquipmentTab() {
  const [items, setItems] = useState<Equipment[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [name, setName] = useState("");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [shares, setShares] = useState<ShareDraft[]>([{ partner_id: "", percentage: "" }]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);

  const refresh = () => Promise.all([equipmentApi.list(), partnersApi.list()]).then(([eq, p]) => {
    setItems(eq);
    setPartners(p);
  });

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, []);

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;

    const validShares = shares
      .filter((s) => s.partner_id && Number(s.percentage) > 0)
      .map((s) => ({ partner_id: Number(s.partner_id), percentage: Number(s.percentage) }));

    await equipmentApi.create({ name: trimmed, purchase_price: Number(purchasePrice) || 0, shares: validShares });
    setName("");
    setPurchasePrice("");
    setShares([{ partner_id: "", percentage: "" }]);
    await refresh();
  }

  async function handleDelete(id: number) {
    await equipmentApi.remove(id);
    await refresh();
  }

  async function handleSaved() {
    setEditingId(null);
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
        <input
          value={purchasePrice}
          onChange={(e) => setPurchasePrice(e.target.value)}
          type="number"
          min="0"
          step="any"
          placeholder="سعر الشراء (اختياري)"
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
        />

        <SharesEditor partners={partners} shares={shares} onChange={setShares} />

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
          {items.map((item) =>
            editingId === item.id ? (
              <li key={item.id}>
                <EditRow item={item} partners={partners} onSaved={handleSaved} onCancel={() => setEditingId(null)} />
              </li>
            ) : (
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
                    <div className="text-xs text-slate-400">
                      {item.purchase_price > 0 ? (
                        <>
                          سعر الشراء: {formatEGP(item.purchase_price)} — رجّعت{" "}
                          <span className={item.roiPercent != null && item.roiPercent >= 100 ? "text-primary font-semibold" : ""}>
                            {(item.roiPercent ?? 0).toFixed(1)}%
                          </span>{" "}
                          من سعرها
                        </>
                      ) : (
                        "لسه محدّدش سعر الشراء"
                      )}
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
