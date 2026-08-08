import { useState } from "react";
import MonthBar from "../components/MonthBar";
import DailyLogSheet from "../components/DailyLogSheet";
import MarketSheet from "../components/MarketSheet";
import ExpensesSheet from "../components/ExpensesSheet";
import ProfitSheet from "../components/ProfitSheet";
import { listContractors, listEmployees } from "../store";
import { Equipment } from "../types";

type Tab = "driver" | "contractor" | "market" | "expense" | "profit";

const TABS: { id: Tab; label: string }[] = [
  { id: "driver", label: "السركي" },
  { id: "contractor", label: "المقاول" },
  { id: "market", label: "سركي سوق" },
  { id: "expense", label: "المصروفات" },
  { id: "profit", label: "الأرباح" },
];

export default function EquipmentDetail({
  equipment,
  month,
  onChangeMonth,
  onBack,
}: {
  equipment: Equipment;
  month: string;
  onChangeMonth: (month: string) => void;
  onBack: () => void;
}) {
  const [tab, setTab] = useState<Tab>("driver");
  const employees = listEmployees();
  const contractors = listContractors();

  return (
    <div>
      <div className="bg-primary text-white px-4 pt-6 pb-3 flex items-center gap-3">
        <button onClick={onBack} className="w-7 h-7 rounded-full bg-white/15 flex items-center justify-center text-sm">
          ←
        </button>
        <div>
          <div className="text-xs opacity-80 font-bold">دفتر البنيان</div>
          <div className="text-lg font-extrabold mt-0.5">{equipment.name}</div>
        </div>
      </div>
      <MonthBar month={month} onChange={onChangeMonth} />

      <div className="flex gap-1.5 overflow-x-auto px-4 py-3">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={[
              "shrink-0 rounded-full px-3.5 py-1.5 text-xs font-bold border",
              tab === t.id ? "bg-primary border-primary text-white" : "bg-white border-slate-200 text-slate-500",
            ].join(" ")}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="px-4 pb-6">
        {tab === "driver" && <DailyLogSheet equipmentId={equipment.id} month={month} role="driver" people={employees} />}
        {tab === "contractor" && <DailyLogSheet equipmentId={equipment.id} month={month} role="contractor" people={contractors} />}
        {tab === "market" && <MarketSheet equipmentId={equipment.id} month={month} />}
        {tab === "expense" && <ExpensesSheet equipmentId={equipment.id} month={month} />}
        {tab === "profit" && <ProfitSheet equipment={equipment} month={month} />}
      </div>
    </div>
  );
}
