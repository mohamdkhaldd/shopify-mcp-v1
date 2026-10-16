import { useEffect, useState } from "react";
import Icon from "../components/Icon";
import { equipmentApi } from "../api/client";
import { Equipment as EquipmentType, EquipmentSheetMismatch } from "../api/types";
import { formatEGP } from "../utils/format";
import { monthLabel } from "../utils/months";
import EquipmentDetail from "./equipment/EquipmentDetail";

export default function Equipment() {
  const [items, setItems] = useState<EquipmentType[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<EquipmentType | null>(null);
  const [mismatches, setMismatches] = useState<Map<number, EquipmentSheetMismatch["months"]>>(new Map());

  useEffect(() => {
    equipmentApi.list().then(setItems).finally(() => setLoading(false));
  }, []);

  // بيتحدّث كل ما ترجع للقائمة من صفحة معدة، عشان العلامة الحمرا تختفي أول
  // ما تكمّل الشيت الناقص.
  useEffect(() => {
    if (selected) return;
    equipmentApi.sheetMismatches().then((list) => setMismatches(new Map(list.map((m) => [m.equipment_id, m.months]))));
  }, [selected]);

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
          {items.map((eq) => {
            const missing = mismatches.get(eq.id);
            return (
            <button
              key={eq.id}
              onClick={() => setSelected(eq)}
              className={[
                "rounded-card shadow-card p-5 text-start transition-shadow",
                missing
                  ? "bg-rose-50 ring-2 ring-rose-400 hover:ring-rose-500"
                  : "bg-white hover:ring-2 hover:ring-primary/30",
              ].join(" ")}
            >
              <div className="flex items-center justify-between">
                <div
                  className={[
                    "w-11 h-11 rounded-xl flex items-center justify-center",
                    missing ? "bg-rose-500 text-white" : "bg-primary-light text-primary",
                  ].join(" ")}
                >
                  <Icon name="equipment" className="w-5 h-5" />
                </div>
                {missing && <span className="text-xs font-bold text-rose-600">شيت ناقص</span>}
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
              {missing && (
                <div className="mt-2 text-xs font-semibold text-rose-600">
                  متسجل في شيت واحد بس (مقاول أو سركي):{" "}
                  {missing.map((m) => `${monthLabel(m.month)} ${m.month.slice(0, 4)} (${m.days} يوم)`).join("، ")}
                </div>
              )}
            </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
