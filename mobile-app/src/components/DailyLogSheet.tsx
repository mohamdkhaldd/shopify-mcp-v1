import { useEffect, useMemo, useState } from "react";
import { DailyLog, DailyLogRole } from "../types";
import { daysInMonth, weekdayLabel } from "../utils/months";
import { parseDayNumbers } from "../utils/dayNumbers";
import { deleteDailyLog, listDailyLogs, upsertDailyLog } from "../store";

interface Person {
  id: number;
  name: string;
  rate?: number;
}

interface DailyLogSheetProps {
  equipmentId: number;
  month: string;
  role: DailyLogRole;
  people: Person[];
  onChanged?: () => void;
}

interface RowDraft {
  id: number | null;
  person_name: string;
  actual_hours: string;
  base_hours: string;
  overtime_hours: string;
  day_rate: string;
  is_day_off: boolean;
  note: string;
}

function emptyRow(): RowDraft {
  return {
    id: null,
    person_name: "",
    actual_hours: "",
    base_hours: "8",
    overtime_hours: "",
    day_rate: "",
    is_day_off: false,
    note: "",
  };
}

function overtimeFromHours(actualHours: string, baseHours: string): string {
  const actual = Number(actualHours) || 0;
  const base = Number(baseHours) || 0;
  const overtime = actual - base;
  return overtime > 0 ? String(overtime) : "";
}

function hoursOrNull(value: string): number | null {
  return value.trim() === "" ? null : Number(value) || 0;
}

function draftFromLog(log: DailyLog): RowDraft {
  const actual_hours = log.actual_hours?.toString() ?? "";
  const base_hours = log.is_day_off ? "" : log.base_hours?.toString() ?? "8";
  return {
    id: log.id,
    person_name: log.person_name,
    actual_hours,
    base_hours,
    overtime_hours: overtimeFromHours(actual_hours, base_hours),
    day_rate: log.day_rate?.toString() ?? "",
    is_day_off: log.is_day_off,
    note: log.note ?? "",
  };
}

export default function DailyLogSheet({ equipmentId, month, role, people, onChanged }: DailyLogSheetProps) {
  const dates = useMemo(() => daysInMonth(month), [month]);
  const [rows, setRows] = useState<Record<string, RowDraft>>({});
  const isContractor = role === "contractor";
  const isDriver = role === "driver";

  const [fillDays, setFillDays] = useState("");
  const [fillPerson, setFillPerson] = useState("");
  const [fillRate, setFillRate] = useState("");
  const [fillBaseHours, setFillBaseHours] = useState("8");
  const [overtimeDays, setOvertimeDays] = useState("");
  const [overtimeValue, setOvertimeValue] = useState("");

  const refresh = () => {
    const logs = listDailyLogs(equipmentId, month, role);
    const byDate = new Map(logs.map((l) => [l.date, l]));
    const next: Record<string, RowDraft> = {};
    for (const date of dates) {
      const log = byDate.get(date);
      next[date] = log ? draftFromLog(log) : emptyRow();
    }
    setRows(next);
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [equipmentId, month, role]);

  function updateRow(date: string, patch: Partial<RowDraft>) {
    setRows((prev) => ({ ...prev, [date]: { ...prev[date], ...patch } }));
  }

  function saveRow(date: string, override?: Partial<RowDraft>) {
    const row = { ...(rows[date] ?? emptyRow()), ...override };
    const hasHours = row.actual_hours.trim() !== "";
    const hasContent = Boolean(row.person_name && row.day_rate) || hasHours || row.is_day_off || row.note.trim();

    if (!hasContent) {
      if (row.id) {
        deleteDailyLog(row.id);
        updateRow(date, { id: null });
        onChanged?.();
      }
      return;
    }

    const saved = upsertDailyLog({
      equipment_id: equipmentId,
      date,
      role,
      person_name: row.is_day_off ? "" : row.person_name,
      actual_hours: hoursOrNull(row.actual_hours),
      base_hours: hoursOrNull(row.base_hours),
      day_rate: row.is_day_off ? null : Number(row.day_rate) || 0,
      is_paid_leave: false,
      is_day_off: row.is_day_off,
      fixed_value: null,
      hassan_commission: null,
      note: row.note.trim() || null,
    });
    updateRow(date, { id: saved.id });
    onChanged?.();
  }

  function handleActualHoursChange(date: string, value: string) {
    const row = rows[date] ?? emptyRow();
    updateRow(date, { actual_hours: value, overtime_hours: overtimeFromHours(value, row.base_hours) });
  }

  function handleOvertimeChange(date: string, value: string) {
    const row = rows[date] ?? emptyRow();
    const base = Number(row.base_hours) || 0;
    const overtime = Number(value) || 0;
    updateRow(date, { overtime_hours: value, actual_hours: String(base + overtime) });
  }

  function toggleDayOff(date: string) {
    const row = rows[date] ?? emptyRow();
    const next = !row.is_day_off;
    if (!next) {
      updateRow(date, { is_day_off: false });
      saveRow(date, { is_day_off: false });
      return;
    }
    const cleared: Partial<RowDraft> = {
      is_day_off: true,
      person_name: "",
      day_rate: "",
      actual_hours: "",
      overtime_hours: "",
      base_hours: "",
    };
    updateRow(date, cleared);
    saveRow(date, cleared);
  }

  function applyFill() {
    const dayNumbers = parseDayNumbers(fillDays);
    if (dayNumbers.size === 0 || !fillPerson || !fillRate) return;
    const targetDates = dates.filter((date) => dayNumbers.has(Number(date.slice(-2))));
    for (const date of targetDates) {
      const existing = rows[date];
      const preserveHours = isContractor;
      upsertDailyLog({
        equipment_id: equipmentId,
        date,
        role,
        person_name: fillPerson,
        actual_hours: preserveHours ? hoursOrNull(existing?.actual_hours ?? "") : Number(fillBaseHours) || 0,
        base_hours: preserveHours ? hoursOrNull(existing?.base_hours ?? "") : Number(fillBaseHours) || 0,
        day_rate: Number(fillRate) || 0,
        is_paid_leave: false,
        is_day_off: existing?.is_day_off ?? false,
        fixed_value: null,
        hassan_commission: null,
        note: existing?.note.trim() || null,
      });
    }
    refresh();
    onChanged?.();
    setFillDays("");
  }

  function applyOvertime() {
    const dayNumbers = parseDayNumbers(overtimeDays);
    const overtime = Number(overtimeValue);
    if (dayNumbers.size === 0 || !overtimeValue || Number.isNaN(overtime)) return;
    const targetDates = dates.filter((date) => dayNumbers.has(Number(date.slice(-2))) && rows[date]?.id && !rows[date]?.is_day_off);
    for (const date of targetDates) {
      const row = rows[date];
      const base = Number(row.base_hours) || 0;
      const patch = { actual_hours: String(base + overtime), overtime_hours: String(overtime) };
      updateRow(date, patch);
      saveRow(date, patch);
    }
    setOvertimeDays("");
    setOvertimeValue("");
  }

  // ملخص أيام الشهر: كام يوم اشتغل كامل، وكام يوم اشتغل جزء بس من ساعاته
  // الأساسية (مجمّعين بعدد الساعات اللي اشتغلوها) — الأيام اللي معلّمة
  // "مشتغلش" أو لسه فاضية متحسبش خالص.
  const workDaysSummary = useMemo(() => {
    let fullDays = 0;
    const partialGroups = new Map<number, string[]>();
    for (const date of dates) {
      const row = rows[date];
      if (!row?.id || row.is_day_off) continue;
      const base = Number(row.base_hours) || 0;
      const actual = row.actual_hours.trim() === "" ? base : Number(row.actual_hours) || 0;
      if (base <= 0 || actual >= base) {
        fullDays++;
      } else {
        if (!partialGroups.has(actual)) partialGroups.set(actual, []);
        partialGroups.get(actual)!.push(date.slice(-2));
      }
    }
    return { fullDays, partialGroups };
  }, [rows, dates]);

  return (
    <div className="space-y-3">
      <div className="bg-primary-light border border-primary/30 rounded-2xl p-3">
        <div className="text-xs font-extrabold text-primary-dark mb-2">
          تطبيق على مجموعة أيام{isContractor ? " (اسم ورقم بس)" : " (اسم + سعر + ساعات أساسية)"}
        </div>
        <div className="space-y-2">
          <div>
            <label className="block text-[11px] text-slate-500 mb-1">الأيام (مثلاً: 1-5, 7-10)</label>
            <input
              value={fillDays}
              onChange={(e) => setFillDays(e.target.value)}
              placeholder="1-5, 7-10"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white"
            />
          </div>
          <div>
            <label className="block text-[11px] text-slate-500 mb-1">{isContractor ? "المقاول" : "الاسم"}</label>
            <select
              value={fillPerson}
              onChange={(e) => setFillPerson(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white"
            >
              <option value=""></option>
              {people.map((p) => (
                <option key={p.id} value={p.name}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] text-slate-500 mb-1">سعر اليوم</label>
            <input
              type="number"
              value={fillRate}
              onChange={(e) => setFillRate(e.target.value)}
              inputMode="decimal"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white"
            />
          </div>
          {!isContractor && (
            <div>
              <label className="block text-[11px] text-slate-500 mb-1">الساعات الأساسية</label>
              <input
                type="number"
                value={fillBaseHours}
                onChange={(e) => setFillBaseHours(e.target.value)}
                inputMode="decimal"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white"
              />
            </div>
          )}
          <button
            onClick={applyFill}
            disabled={!fillDays.trim() || !fillPerson || !fillRate}
            className="w-full bg-primary text-white rounded-xl py-2.5 text-sm font-bold disabled:opacity-50"
          >
            طبّق على الأيام
          </button>
        </div>
      </div>

      {!isContractor && (
        <div className="bg-primary-light border border-primary/30 rounded-2xl p-3">
          <div className="text-xs font-extrabold text-primary-dark mb-2">أوفر تايم على أيام معيّنة</div>
          <div className="space-y-2">
            <div>
              <label className="block text-[11px] text-slate-500 mb-1">الأيام (مثلاً: 1-3, 4-7)</label>
              <input
                value={overtimeDays}
                onChange={(e) => setOvertimeDays(e.target.value)}
                placeholder="1-3, 4-7"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white"
              />
            </div>
            <div>
              <label className="block text-[11px] text-slate-500 mb-1">عدد ساعات الأوفر تايم</label>
              <input
                type="number"
                value={overtimeValue}
                onChange={(e) => setOvertimeValue(e.target.value)}
                inputMode="decimal"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white"
              />
            </div>
            <button
              onClick={applyOvertime}
              disabled={!overtimeDays.trim() || !overtimeValue}
              className="w-full bg-primary text-white rounded-xl py-2.5 text-sm font-bold disabled:opacity-50"
            >
              طبّق الأوفر تايم
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {dates.map((date) => {
          const row = rows[date] ?? emptyRow();
          const dayNum = date.slice(-2);
          const off = row.is_day_off;
          const filled = !off && Boolean(row.person_name || row.id);
          return (
            <div
              key={date}
              className={[
                "rounded-2xl border p-3",
                off ? "bg-rose-50 border-rose-200" : filled ? "bg-white border-slate-200 shadow-card" : "bg-slate-50/60 border-dashed border-slate-200",
              ].join(" ")}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-extrabold text-slate-700">
                  {dayNum} {weekdayLabel(date) && <span className="text-xs font-semibold text-slate-400">({weekdayLabel(date)})</span>}
                </div>
                {!isContractor && (
                  <button
                    onClick={() => toggleDayOff(date)}
                    className={[
                      "w-7 h-7 rounded-full border flex items-center justify-center text-xs font-bold",
                      off ? "bg-rose-500 border-rose-500 text-white" : "border-rose-300 text-rose-500",
                    ].join(" ")}
                    title="علّم إن اليوم ده مشتغلش"
                  >
                    ✕
                  </button>
                )}
              </div>

              {off ? (
                <div className="text-xs font-bold text-rose-600">
                  {isContractor ? "مشتغلش (متعلّم من شيت السركي)" : "مشتغلش — الاسم والسعر والساعات متقفلة"}
                </div>
              ) : (
                <div className="space-y-2">
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">{isContractor ? "المقاول" : "الاسم"}</label>
                    <select
                      value={row.person_name}
                      onChange={(e) => updateRow(date, { person_name: e.target.value })}
                      onBlur={() => saveRow(date)}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    >
                      <option value=""></option>
                      {people.map((p) => (
                        <option key={p.id} value={p.name}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  {isContractor ? (
                    <div>
                      <label className="block text-[11px] text-slate-500 mb-1">الساعات 🔒 جايه من السركي</label>
                      <input value={row.actual_hours || "—"} disabled className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm bg-slate-100 text-slate-400" />
                    </div>
                  ) : (
                    <>
                      <div>
                        <label className="block text-[11px] text-slate-500 mb-1">الساعات الفعلية</label>
                        <input
                          type="number"
                          value={row.actual_hours}
                          onChange={(e) => handleActualHoursChange(date, e.target.value)}
                          onBlur={() => saveRow(date)}
                          inputMode="decimal"
                          placeholder="يوم كامل لو فاضية"
                          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-slate-500 mb-1">أوفر تايم</label>
                        <input
                          type="number"
                          value={row.overtime_hours}
                          onChange={(e) => handleOvertimeChange(date, e.target.value)}
                          onBlur={() => saveRow(date)}
                          inputMode="decimal"
                          placeholder="—"
                          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-slate-500 mb-1">الساعات الأساسية</label>
                        <input
                          type="number"
                          value={row.base_hours}
                          onChange={(e) => updateRow(date, { base_hours: e.target.value })}
                          onBlur={() => saveRow(date)}
                          inputMode="decimal"
                          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                        />
                      </div>
                    </>
                  )}
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">سعر اليوم</label>
                    <input
                      type="number"
                      value={row.day_rate}
                      onChange={(e) => updateRow(date, { day_rate: e.target.value })}
                      onBlur={() => saveRow(date)}
                      inputMode="decimal"
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    />
                  </div>
                  {!isContractor && (
                    <div>
                      <label className="block text-[11px] text-slate-500 mb-1">بيان</label>
                      <input
                        value={row.note}
                        onChange={(e) => updateRow(date, { note: e.target.value })}
                        onBlur={() => saveRow(date)}
                        placeholder="لو مشتغلش، ليه؟"
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {isDriver && (
        <div className="bg-slate-50 rounded-2xl p-3 text-sm">
          <div className="font-bold text-slate-600 mb-1">أيام الشغل في الشهر</div>
          <div className="text-slate-600">
            عدد الأيام اللي اشتغلت كامل: <span className="font-semibold text-primary-dark">{workDaysSummary.fullDays}</span> يوم
          </div>
          {workDaysSummary.partialGroups.size > 0 && (
            <div className="mt-1 space-y-0.5">
              {[...workDaysSummary.partialGroups.entries()]
                .sort((a, b) => b[0] - a[0])
                .map(([hours, days]) => (
                  <div key={hours} className="text-slate-500">
                    {days.length} {days.length === 1 ? "يوم اشتغل" : "أيام اشتغلوا"} {hours} {hours === 1 ? "ساعة" : "ساعات"} بس (يوم {days.join("، ")})
                  </div>
                ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
