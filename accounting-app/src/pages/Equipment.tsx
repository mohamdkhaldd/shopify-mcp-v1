import { useEffect, useState } from "react";
import Icon from "../components/Icon";
import { equipmentApi } from "../api/client";
import { Equipment as EquipmentType } from "../api/types";
import { formatEGP } from "../utils/format";
import EquipmentDetail from "./equipment/EquipmentDetail";

export default function Equipment() {
  const [items, setItems] = useState<EquipmentType[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<EquipmentType | null>(null);

  useEffect(() => {
    equipmentApi.list().then(setItems).finally(() => setLoading(false));
  }, []);

  if (selected) {
    return <EquipmentDetail equipment={selected} onBack={() => setSelected(null)} />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900">المعدات</h1>
        <p className="text-sm text-slate-500 mt-1">اختر معدة عشان تدخل السركي والمقاول والمصروفات وتشوف الأرباح.</p>
      </div>

      {loading ? (
        <div className="text-sm text-slate-400">جاري التحميل...</div>
      ) : items.length === 0 ? (
        <div className="bg-white rounded-card shadow-card p-8 text-center text-sm text-slate-400">
          لسه مفيش معدات مسجلة. ضيفها من صفحة الإعدادات الأول.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {items.map((eq) => (
            <button
              key={eq.id}
              onClick={() => setSelected(eq)}
              className="bg-white rounded-card shadow-card p-5 text-start hover:ring-2 hover:ring-primary/30 transition-shadow"
            >
              <div className="flex items-center justify-between">
                <div className="w-11 h-11 rounded-xl bg-primary-light text-primary flex items-center justify-center">
                  <Icon name="equipment" className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-3 font-bold text-slate-800">{eq.name}</div>
              <div className="mt-1 text-xs text-slate-400">
                {eq.shares.length === 0 ? "بدون شركاء محددين" : `${eq.shares.length} شركاء`}
              </div>
              {eq.purchase_price > 0 && (
                <div className="mt-1 text-xs text-slate-400">
                  سعر الشراء: {formatEGP(eq.purchase_price)} — رجّعت{" "}
                  <span className={eq.roiPercent != null && eq.roiPercent >= 100 ? "text-primary font-semibold" : "text-slate-500"}>
                    {(eq.roiPercent ?? 0).toFixed(1)}%
                  </span>
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
