import MonthBar from "../components/MonthBar";
import { listEquipment } from "../store";
import { Equipment } from "../types";

export default function Home({
  month,
  onChangeMonth,
  onOpenEquipment,
}: {
  month: string;
  onChangeMonth: (month: string) => void;
  onOpenEquipment: (equipment: Equipment) => void;
}) {
  const equipment = listEquipment();

  return (
    <div>
      <div className="bg-primary text-white px-4 pt-6 pb-3">
        <div className="text-xs opacity-80 font-bold">دفتر البنيان</div>
        <div className="text-lg font-extrabold mt-0.5">المعدات</div>
      </div>
      <MonthBar month={month} onChange={onChangeMonth} />
      <div className="p-4 grid grid-cols-2 gap-3">
        {equipment.map((eq) => (
          <button
            key={eq.id}
            onClick={() => onOpenEquipment(eq)}
            className="bg-white rounded-2xl shadow-card p-3.5 text-start"
          >
            <div className="w-9 h-9 rounded-xl bg-primary-light text-primary-dark flex items-center justify-center text-sm mb-2">
              🏗️
            </div>
            <div className="text-sm font-bold text-slate-800 leading-tight">{eq.name}</div>
            <div className="text-[10px] text-slate-400 mt-1">دوس تفتح شيته</div>
          </button>
        ))}
      </div>
    </div>
  );
}
