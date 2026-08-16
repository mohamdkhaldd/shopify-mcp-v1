import { useEffect, useState } from "react";
import Icon from "../../components/Icon";
import MonthPicker from "../../components/equipment/MonthPicker";
import PrintButton from "../../components/PrintButton";
import { PrintHeader, PrintSignoff } from "../../components/PrintSignoff";
import { contractorsApi, dailyLogsApi, employeesApi, equipmentShiftsApi } from "../../api/client";
import { Equipment, EquipmentShift, WageType } from "../../api/types";
import { currentMonthKey, monthLabel } from "../../utils/months";
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

// الشيفتات (سركي/مقاول) بتفرق بس في التابات دي — سركي السوق والمصروفات
// مستقلين عن مفهوم الشيفت خالص.
const SHIFT_AWARE_TABS: Tab[] = ["summary", "driver", "contractor"];

interface EquipmentDetailProps {
  equipment: Equipment;
  onBack: () => void;
}

export default function EquipmentDetail({ equipment, onBack }: EquipmentDetailProps) {
  const [tab, setTab] = useState<Tab>("summary");
  const [month, setMonth] = useState(currentMonthKey());
  const [employees, setEmployees] = useState<{ id: number; name: string; rate: number; wage_type: WageType }[]>([]);
  const [contractors, setContractors] = useState<{ id: number; name: string }[]>([]);
  const [mismatchedDates, setMismatchedDates] = useState<Set<string>>(new Set());
  const [refreshKey, setRefreshKey] = useState(0);
  const [shifts, setShifts] = useState<EquipmentShift[]>([]);
  const [activeShiftLabel, setActiveShiftLabel] = useState("");
  const [addingShift, setAddingShift] = useState(false);
  const [newShiftName, setNewShiftName] = useState("");

  useEffect(() => {
    employeesApi.list().then(setEmployees);
    contractorsApi.list().then(setContractors);
  }, []);

  useEffect(() => {
    setActiveShiftLabel("");
    refreshShifts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [equipment.id]);

  function refreshShifts() {
    equipmentShiftsApi.list(equipment.id).then(setShifts);
  }

  async function handleAddShift() {
    const trimmed = newShiftName.trim();
    if (!trimmed) return;
    const created = await equipmentShiftsApi.create(equipment.id, trimmed);
    setShifts((prev) => [...prev, created]);
    setActiveShiftLabel(created.label);
    setNewShiftName("");
    setAddingShift(false);
  }

  useEffect(() => {
    Promise.all([
      dailyLogsApi.list(equipment.id, month, "driver", activeShiftLabel),
      dailyLogsApi.list(equipment.id, month, "contractor", activeShiftLabel),
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
  }, [equipment.id, month, activeShiftLabel, refreshKey]);

  const activeTabLabel = tabs.find((t) => t.id === tab)!.label;
  const activeShiftName = activeShiftLabel || (shifts.length > 0 ? "أساسي" : "");
  const printTitle = activeShiftName
    ? `${equipment.name} — ${activeTabLabel} — ${activeShiftName}`
    : `${equipment.name} — ${activeTabLabel}`;

  return (
    <div className="space-y-6">
      <PrintHeader title={printTitle} subtitle={`${monthLabel(month)} ${month.split("-")[0]}`} />

      <div className="no-print flex items-center justify-between">
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
        <div className="flex items-center gap-2">
          <PrintButton />
          <MonthPicker month={month} onChange={setMonth} />
        </div>
      </div>

      {mismatchedDates.size > 0 && (tab === "driver" || tab === "contractor") && (
        <div className="no-print flex items-center gap-2 bg-rose-50 text-rose-700 text-sm rounded-xl px-4 py-2.5">
          <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
          فيه {mismatchedDates.size} يوم الساعات فيه مش متطابقة بين السركي والمقاول — محتاجة مراجعة (متعلّمة بنقطة حمرا
          في الجدول).
        </div>
      )}

      <div className="no-print flex flex-wrap gap-2">
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

      {SHIFT_AWARE_TABS.includes(tab) && (
        <div className="no-print flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => setActiveShiftLabel("")}
            className={[
              "rounded-lg px-3 py-1.5 text-xs font-bold transition-colors",
              activeShiftLabel === "" ? "bg-primary-dark text-white" : "bg-white text-slate-500 shadow-card hover:text-primary-dark",
            ].join(" ")}
          >
            أساسي
          </button>
          {shifts.map((s) => (
            <button
              key={s.id}
              onClick={() => setActiveShiftLabel(s.label)}
              className={[
                "rounded-lg px-3 py-1.5 text-xs font-bold transition-colors",
                activeShiftLabel === s.label ? "bg-primary-dark text-white" : "bg-white text-slate-500 shadow-card hover:text-primary-dark",
              ].join(" ")}
            >
              {s.label}
            </button>
          ))}
          {addingShift ? (
            <div className="flex items-center gap-1">
              <input
                autoFocus
                value={newShiftName}
                onChange={(e) => setNewShiftName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddShift()}
                placeholder="اسم الشيفت زي: وردية 2"
                className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs w-40"
              />
              <button onClick={handleAddShift} className="rounded-lg bg-primary text-white px-2.5 py-1.5 text-xs font-bold">
                إضافة
              </button>
              <button
                onClick={() => {
                  setAddingShift(false);
                  setNewShiftName("");
                }}
                className="rounded-lg bg-slate-100 text-slate-500 px-2.5 py-1.5 text-xs font-bold"
              >
                إلغاء
              </button>
            </div>
          ) : (
            <button
              onClick={() => setAddingShift(true)}
              className="rounded-lg border border-dashed border-slate-300 text-slate-400 px-3 py-1.5 text-xs font-bold hover:text-primary-dark hover:border-primary"
            >
              + شيفت جديد
            </button>
          )}
        </div>
      )}

      {tab === "summary" && <ProfitSummary equipmentId={equipment.id} month={month} refreshKey={refreshKey} />}

      {tab === "driver" && (
        <DailyLogTable
          equipmentId={equipment.id}
          month={month}
          role="driver"
          shiftLabel={activeShiftLabel}
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
          shiftLabel={activeShiftLabel}
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
          shiftLabel=""
          mode="fixed"
          people={employees}
          onChanged={() => setRefreshKey((k) => k + 1)}
        />
      )}

      {tab === "expenses" && (
        <ExpensesTable equipmentId={equipment.id} month={month} onChanged={() => setRefreshKey((k) => k + 1)} />
      )}

      <PrintSignoff />
    </div>
  );
}
