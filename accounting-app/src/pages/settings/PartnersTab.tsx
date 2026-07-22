import { FormEvent, useEffect, useState } from "react";
import { equipmentApi, partnerPaymentsApi, partnersApi } from "../../api/client";
import { Partner } from "../../api/types";
import Icon from "../../components/Icon";
import { formatEGP } from "../../utils/format";
import { useUndo } from "../../context/UndoContext";

function OpeningBalanceCell({ partner, onSaved }: { partner: Partner; onSaved: () => void }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(partner.opening_balance));

  async function save() {
    await partnersApi.updateOpeningBalance(partner.id, Number(value) || 0);
    setEditing(false);
    onSaved();
  }

  if (editing) {
    return (
      <div className="flex items-center gap-2">
        <input
          type="number"
          step="0.01"
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
    <button
      onClick={() => setEditing(true)}
      className="text-sm font-bold text-slate-700 hover:text-primary underline decoration-dashed decoration-slate-300 underline-offset-4 hover:decoration-primary"
      title="دوس تعدّل الرصيد الافتتاحي"
    >
      {formatEGP(partner.opening_balance)}
    </button>
  );
}

export default function PartnersTab() {
  const [items, setItems] = useState<Partner[]>([]);
  const [name, setName] = useState("");
  const [openingBalance, setOpeningBalance] = useState("");
  const [loading, setLoading] = useState(true);
  const { pushUndo } = useUndo();

  const refresh = () => partnersApi.list().then(setItems);

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, []);

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    await partnersApi.create(trimmed, Number(openingBalance) || 0);
    setName("");
    setOpeningBalance("");
    await refresh();
  }

  async function handleDelete(id: number) {
    const partner = items.find((p) => p.id === id);
    if (!partner) return;

    const equipmentList = await equipmentApi.list();
    const affectedEquipment = equipmentList
      .filter((eq) => eq.shares.some((s) => s.partner_id === id))
      .map((eq) => ({ id: eq.id, purchase_price: eq.purchase_price, shares: eq.shares }));
    const payments = await partnerPaymentsApi.list(id);

    await partnersApi.remove(id);
    await refresh();

    pushUndo(`اتمسح الشريك "${partner.name}"`, async () => {
      const restored = await partnersApi.create(partner.name, partner.opening_balance);
      for (const eq of affectedEquipment) {
        const restoredShares = eq.shares.map((s) =>
          s.partner_id === id ? { partner_id: restored.id, percentage: s.percentage } : s
        );
        await equipmentApi.update(eq.id, { purchase_price: eq.purchase_price, shares: restoredShares });
      }
      for (const payment of payments) {
        await partnerPaymentsApi.create({
          partner_id: restored.id,
          date: payment.date,
          amount: payment.amount,
          method: payment.method,
          note: payment.note,
        });
      }
      await refresh();
    });
  }

  return (
    <div className="bg-white rounded-card shadow-card p-5">
      <h2 className="font-bold text-slate-800 mb-1">الشركاء</h2>
      <p className="text-xs text-slate-400 mb-4">
        الرصيد الافتتاحي هو الفلوس المستحقة له من شهور سابقة لسه ما اتسجلتش — بتتضاف على المستحق له، وبتتخصم أول ما يتاخد له دفعة.
      </p>

      <form onSubmit={handleAdd} className="flex flex-wrap gap-2 mb-5">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="اسم الشريك"
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
          إضافة شريك
        </button>
      </form>

      {loading ? (
        <div className="text-sm text-slate-400">جاري التحميل...</div>
      ) : items.length === 0 ? (
        <div className="text-sm text-slate-400">لسه مفيش شركاء مسجلين.</div>
      ) : (
        <ul className="divide-y divide-slate-50">
          {items.map((item) => (
            <li key={item.id} className="flex items-center justify-between py-2.5 gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-primary-light text-primary flex items-center justify-center">
                  <Icon name="partners" className="w-4 h-4" />
                </div>
                <span className="text-sm font-semibold text-slate-700">{item.name}</span>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-end">
                  <div className="text-[11px] text-slate-400">رصيد افتتاحي</div>
                  <OpeningBalanceCell partner={item} onSaved={refresh} />
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
