import { FormEvent, useEffect, useState } from "react";
import { dailyLogsApi } from "../../api/client";
import { DailyLog, DailyLogRole } from "../../api/types";
import { formatEGP } from "../../utils/format";

interface Person {
  id: number;
  name: string;
}

interface DailyLogTableProps {
  equipmentId: number;
  month: string;
  role: DailyLogRole;
  mode: "hours" | "fixed";
  people: Person[];
  mismatchedDates?: Set<string>;
  onChanged?: () => void;
}

const todayIso = () => new Date().toISOString().slice(0, 10);

export default function DailyLogTable({
  equipmentId,
  month,
  role,
  mode,
  people,
  mismatchedDates,
  onChanged,
}: DailyLogTableProps) {
  const [logs, setLogs] = useState<DailyLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState(todayIso());
  const [personName, setPersonName] = useState("");
  const [actualHours, setActualHours] = useState("");
  const [baseHours, setBaseHours] = useState("8");
  const [dayRate, setDayRate] = useState("");
  const [fixedValue, setFixedValue] = useState("");

  const refresh = () => dailyLogsApi.list(equipmentId, month, role).then(setLogs);

  useEffect(() => {
    setLoading(true);
    refresh().finally(() => setLoading(false));
  }, [equipmentId, month, role]);

  function handlePersonChange(name: string) {
    setPersonName(name);
    const match = people.find((p) => p.name === name);
    if (match && "rate" in match) setDayRate(String((match as any).rate));
  }

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    if (!personName) return;

    if (mode === "hours") {
      if (!dayRate) return;
      await dailyLogsApi.create({
        equipment_id: equipmentId,
        date,
        role,
        person_name: personName,
        actual_hours: Number(actualHours) || 0,
        base_hours: Number(baseHours) || 0,
        day_rate: Number(dayRate),
        fixed_value: null,
      });
      setActualHours("");
    } else {
      if (!fixedValue) return;
      await dailyLogsApi.create({
        equipment_id: equipmentId,
        date,
        role,
        person_name: personName,
        actual_hours: null,
        base_hours: null,
        day_rate: null,
        fixed_value: Number(fixedValue),
      });
      setFixedValue("");
    }
    await refresh();
    onChanged?.();
  }

  async function handleDelete(id: number) {
    await dailyLogsApi.remove(id);
    await refresh();
    onChanged?.();
  }

  const monthTotal = logs.reduce((sum, l) => sum + l.day_value, 0);

  return (
    <div className="bg-white rounded-card shadow-card p-5">
      <form onSubmit={handleAdd} className="flex flex-wrap items-end gap-2 mb-4 pb-4 border-b border-slate-100">
        <div>
          <label className="block text-xs text-slate-400 mb-1">التاريخ</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">الاسم</label>
          <select
            value={personName}
            onChange={(e) => handlePersonChange(e.target.value)}
            className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          >
            <option value="">اختر</option>
            {people.map((p) => (
              <option key={p.id} value={p.name}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        {mode === "hours" ? (
          <>
            <div>
              <label className="block text-xs text-slate-400 mb-1">الساعات الفعلية</label>
              <input
                type="number"
                min="0"
                step="0.5"
                value={actualHours}
                onChange={(e) => setActualHours(e.target.value)}
                className="w-24 rounded-lg border border-slate-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">الساعات الأساسية</label>
              <input
                type="number"
                min="0"
                step="0.5"
                value={baseHours}
                onChange={(e) => setBaseHours(e.target.value)}
                className="w-24 rounded-lg border border-slate-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">اليومية</label>
              <input
                type="number"
                min="0"
                value={dayRate}
                onChange={(e) => setDayRate(e.target.value)}
                className="w-24 rounded-lg border border-slate-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
          </>
        ) : (
          <div>
            <label className="block text-xs text-slate-400 mb-1">قيمة اليوم</label>
            <input
              type="number"
              min="0"
              value={fixedValue}
              onChange={(e) => setFixedValue(e.target.value)}
              className="w-28 rounded-lg border border-slate-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
        )}
        <button
          type="submit"
          className="bg-primary text-white rounded-lg px-4 py-1.5 text-sm font-semibold hover:bg-primary-dark transition-colors"
        >
          إضافة
        </button>
      </form>

      {loading ? (
        <div className="text-sm text-slate-400">جاري التحميل...</div>
      ) : logs.length === 0 ? (
        <div className="text-sm text-slate-400">لسه مفيش تسجيلات لشهر {month}.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-400 border-b border-slate-100">
                <th className="text-start font-semibold py-2">التاريخ</th>
                <th className="text-start font-semibold py-2">الاسم</th>
                {mode === "hours" && (
                  <>
                    <th className="text-start font-semibold py-2">الساعات الفعلية</th>
                    <th className="text-start font-semibold py-2">الساعات الأساسية</th>
                    <th className="text-start font-semibold py-2">اليومية</th>
                  </>
                )}
                <th className="text-start font-semibold py-2">قيمة اليوم</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-b border-slate-50 last:border-0">
                  <td className="py-2 text-slate-600">
                    {log.date}
                    {mismatchedDates?.has(log.date) && (
                      <span
                        className="ms-2 inline-block w-2 h-2 rounded-full bg-rose-500 align-middle"
                        title="الساعات مش متطابقة بين السركي والمقاول في نفس اليوم"
                      />
                    )}
                  </td>
                  <td className="py-2 font-semibold text-slate-700">{log.person_name}</td>
                  {mode === "hours" && (
                    <>
                      <td className="py-2 text-slate-500">{log.actual_hours}</td>
                      <td className="py-2 text-slate-500">{log.base_hours}</td>
                      <td className="py-2 text-slate-500">{formatEGP(log.day_rate ?? 0)}</td>
                    </>
                  )}
                  <td className="py-2 font-semibold text-primary-dark">{formatEGP(log.day_value)}</td>
                  <td className="py-2">
                    <button
                      onClick={() => handleDelete(log.id)}
                      className="text-xs text-rose-500 hover:text-rose-700 font-semibold"
                    >
                      حذف
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={mode === "hours" ? 5 : 2} className="pt-3 text-sm font-bold text-slate-700">
                  إجمالي الشهر
                </td>
                <td className="pt-3 text-sm font-bold text-primary-dark">{formatEGP(monthTotal)}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
