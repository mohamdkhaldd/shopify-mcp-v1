import { useEffect, useState } from "react";
import Icon from "../../components/Icon";
import MonthPicker from "../../components/equipment/MonthPicker";
import { contractorsApi, dailyLogsApi, employeesApi } from "../../api/client";
import { Equipment } from "../../api/types";
import { currentMonthKey } from "../../utils/months";
import DailyLogTable from "./DailyLogTable";
import ExpensesTable from "./ExpensesTable";
import ProfitSummary from "./ProfitSummary";

type Tab = "summary" | "driver" | "contractor" | "market" | "expenses";

const tabs: { id: Tab; label: string; icon: string }[] = [
  { id: "summary", label: "الأرباح وتوزيع الشركاء", icon: "reports" },
  { id: "driver", label: "السركي", icon: "salaries" },
  { id: "contractor", label: "المقاول", icon: "contractors" },
  { id: "market", label: "سركي سوق", icon: "equipment" },
  { id: "expenses", label: "المصروفات", icon: "treasury" },
];

interface EquipmentDetailProps {
  equipment: Equipment;
  onBack: () => void;
}

export default function EquipmentDetail({ equipment, onBack }: EquipmentDetailProps) {
  const [tab, setTab] = useState<Tab>("summary");
  const [month, setMonth] = useState(currentMonthKey());
  const [employees, setEmployees] = useState<{ id: number; name: string; rate: number }[]>([]);
  const [contractors, setContractors] = useState<{ id: number; name: string }[]>([]);
  const [mismatchedDates, setMismatchedDates] = useState<Set<string>>(new Set());
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    employeesApi.list().then(setEmployees);
    contractorsApi.list().then(setContractors);
  }, []);

  useEffect(() => {
    Promise.all([
      dailyLogsApi.list(equipment.id, month, "driver"),
      dailyLogsApi.list(equipment.id, month, "contractor"),
    ]).then(([driverLogs, contractorLogs]) => {
      const driverHoursByDate = new Map<string, number>();
      driverLogs.forEach((l) => driverHoursByDate.set(l.date, (l.actual_hours ?? 0)));
      const mismatches = new Set<string>();
      contractorLogs.forEach((l) => {
        const driverHours = driverHoursByDate.get(l.date);
        if (driverHours !== undefined && driverHours !== (l.actual_hours ?? 0)) {
          mismatches.add(l.date);
        }
      });
      setMismatchedDates(mismatches);
    });
  }, [equipment.id, month, refreshKey]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="w-9 h-9 rounded-xl bg-white shadow-card flex items-center justify-center text-slate-500 hover:text-primary"
          >
            ←
          </button>
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900">{equipment.name}</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              {equipment.shares.length === 0 ? "بدون شركاء محددين" : `${equipment.shares.length} شركاء`}
            </p>
          </div>
        </div>
        <MonthPicker month={month} onChange={setMonth} />
      </div>

      {mismatchedDates.size > 0 && (tab === "driver" || tab === "contractor") && (
        <div className="flex items-center gap-2 bg-rose-50 text-rose-700 text-sm rounded-xl px-4 py-2.5">
          <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
          فيه {mismatchedDates.size} يوم الساعات فيه مش متطابقة بين السركي والمقاول — محتاجة مراجعة (متعلّمة بنقطة حمرا
          في الجدول).
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => {
          const isActive = t.id === tab;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={[
                "flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-colors",
                isActive
                  ? "bg-primary text-white shadow-sm"
                  : "bg-white text-slate-600 hover:bg-primary-light hover:text-primary-dark shadow-card",
              ].join(" ")}
            >
              <Icon name={t.icon} className="w-4 h-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === "summary" && <ProfitSummary equipmentId={equipment.id} month={month} refreshKey={refreshKey} />}

      {tab === "driver" && (
        <DailyLogTable
          equipmentId={equipment.id}
          month={month}
          role="driver"
          mode="hours"
          people={employees}
          mismatchedDates={mismatchedDates}
          onChanged={() => setRefreshKey((k) => k + 1)}
        />
      )}

      {tab === "contractor" && (
        <DailyLogTable
          equipmentId={equipment.id}
          month={month}
          role="contractor"
          mode="hours"
          people={contractors}
          mismatchedDates={mismatchedDates}
          onChanged={() => setRefreshKey((k) => k + 1)}
        />
      )}

      {tab === "market" && (
        <DailyLogTable
          equipmentId={equipment.id}
          month={month}
          role="market"
          mode="fixed"
          people={employees}
          onChanged={() => setRefreshKey((k) => k + 1)}
        />
      )}

      {tab === "expenses" && (
        <ExpensesTable equipmentId={equipment.id} month={month} onChanged={() => setRefreshKey((k) => k + 1)} />
      )}
    </div>
  );
}
