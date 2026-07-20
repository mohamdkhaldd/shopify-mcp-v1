import { useEffect, useMemo, useState } from "react";
import { dailyLogsApi } from "../../api/client";
import { DailyLog, DailyLogRole } from "../../api/types";
import { daysInMonth, weekdayLabel } from "../../utils/months";
import { formatEGP } from "../../utils/format";

interface Person {
  id: number;
  name: string;
  rate?: number;
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

interface RowDraft {
  id: number | null;
  person_name: string;
  actual_hours: string;
  base_hours: string;
  day_rate: string;
  fixed_value: string;
  hassan_commission: string;
  day_value: number;
  saving: boolean;
}

function emptyRow(): RowDraft {
  return {
    id: null,
    person_name: "",
    actual_hours: "",
    base_hours: "8",
    day_rate: "",
    fixed_value: "",
    hassan_commission: "",
    day_value: 0,
    saving: false,
  };
}

export default function DailyLogTable({
  equipmentId,
  month,
  role,
  mode,
  people,
  mismatchedDates,
  onChanged,
}: DailyLogTableProps) {
  const dates = useMemo(() => daysInMonth(month), [month]);
  const [rows, setRows] = useState<Record<string, RowDraft>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    dailyLogsApi.list(equipmentId, month, role).then((logs) => {
      const byDate = new Map(logs.map((l) => [l.date, l]));
      const next: Record<string, RowDraft> = {};
      for (const date of dates) {
        const log = byDate.get(date);
        next[date] = log ? draftFromLog(log) : emptyRow();
      }
      setRows(next);
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [equipmentId, month, role]);

  function draftFromLog(log: DailyLog): RowDraft {
    return {
      id: log.id,
      person_name: log.person_name,
      actual_hours: log.actual_hours?.toString() ?? "",
      base_hours: log.base_hours?.toString() ?? "8",
      day_rate: log.day_rate?.toString() ?? "",
      fixed_value: log.fixed_value?.toString() ?? "",
      hassan_commission: log.hassan_commission?.toString() ?? "",
      day_value: log.day_value,
      saving: false,
    };
  }

  function updateRow(date: string, patch: Partial<RowDraft>) {
    setRows((prev) => ({ ...prev, [date]: { ...prev[date], ...patch } }));
  }

  function handlePersonChange(date: string, name: string) {
    const match = people.find((p) => p.name === name);
    const patch: Partial<RowDraft> = { person_name: name };
    if (match?.rate && mode === "hours") patch.day_rate = String(match.rate);
    updateRow(date, patch);
  }

  async function saveRow(date: string) {
    const row = rows[date];
    if (!row) return;

    const hasContent = mode === "hours" ? row.person_name && row.day_rate : row.person_name && row.fixed_value;

    if (!hasContent) {
      if (row.id) {
        await dailyLogsApi.remove(row.id);
        updateRow(date, { id: null, day_value: 0 });
        onChanged?.();
      }
      return;
    }

    updateRow(date, { saving: true });
    const saved = await dailyLogsApi.upsert({
      equipment_id: equipmentId,
      date,
      role,
      person_name: row.person_name,
      actual_hours: mode === "hours" ? Number(row.actual_hours) || 0 : null,
      base_hours: mode === "hours" ? Number(row.base_hours) || 0 : null,
      day_rate: mode === "hours" ? Number(row.day_rate) || 0 : null,
      fixed_value: mode === "fixed" ? Number(row.fixed_value) || 0 : null,
      hassan_commission: mode === "fixed" && row.hassan_commission ? Number(row.hassan_commission) : null,
    });
    updateRow(date, { id: saved.id, day_value: saved.day_value, saving: false });
    onChanged?.();
  }

  const monthTotal = Object.values(rows).reduce((sum, r) => sum + (r.id ? r.day_value : 0), 0);
  const commissionTotal = Object.values(rows).reduce(
    (sum, r) => sum + (r.id && r.hassan_commission ? Number(r.hassan_commission) : 0),
    0
  );

  if (loading) {
    return <div className="bg-white rounded-card shadow-card p-5 text-sm text-slate-400">جاري التحميل...</div>;
  }

  return (
    <div className="bg-white rounded-card shadow-card p-5">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-slate-400 border-b border-slate-100">
              <th className="text-start font-semibold py-2 whitespace-nowrap">اليوم</th>
              <th className="text-start font-semibold py-2 min-w-[140px]">الاسم</th>
              {mode === "hours" ? (
                <>
                  <th className="text-start font-semibold py-2">الساعات الفعلية</th>
                  <th className="text-start font-semibold py-2">الساعات الأساسية</th>
                  <th className="text-start font-semibold py-2">اليومية</th>
                </>
              ) : (
                <>
                  <th className="text-start font-semibold py-2">قيمة اليوم</th>
                  <th className="text-start font-semibold py-2">كوميشن حسن</th>
                </>
              )}
              <th className="text-start font-semibold py-2 whitespace-nowrap">الإجمالي</th>
            </tr>
          </thead>
          <tbody>
            {dates.map((date) => {
              const row = rows[date] ?? emptyRow();
              const dayNum = date.slice(-2);
              const isFlagged = mismatchedDates?.has(date);
              return (
                <tr
                  key={date}
                  className={[
                    "border-b border-slate-50 last:border-0",
                    row.id ? "bg-white" : "bg-slate-50/40",
                  ].join(" ")}
                >
                  <td className="py-1.5 text-slate-500 whitespace-nowrap">
                    {isFlagged && (
                      <span className="inline-block w-2 h-2 rounded-full bg-rose-500 align-middle me-1.5" title="الساعات مش متطابقة بين السركي والمقاول" />
                    )}
                    {dayNum}
                    <span className="text-xs text-slate-400"> ({weekdayLabel(date)})</span>
                  </td>
                  <td className="py-1.5">
                    <select
                      value={row.person_name}
                      onChange={(e) => handlePersonChange(date, e.target.value)}
                      onBlur={() => saveRow(date)}
                      className="w-full rounded-lg border border-slate-200 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 bg-white"
                    >
                      <option value=""></option>
                      {people.map((p) => (
                        <option key={p.id} value={p.name}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  {mode === "hours" ? (
                    <>
                      <td className="py-1.5">
                        <input
                          type="number"
                          min="0"
                          step="0.5"
                          value={row.actual_hours}
                          onChange={(e) => updateRow(date, { actual_hours: e.target.value })}
                          onBlur={() => saveRow(date)}
                          className="w-20 rounded-lg border border-slate-200 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                        />
                      </td>
                      <td className="py-1.5">
                        <input
                          type="number"
                          min="0"
                          step="0.5"
                          value={row.base_hours}
                          onChange={(e) => updateRow(date, { base_hours: e.target.value })}
                          onBlur={() => saveRow(date)}
                          className="w-20 rounded-lg border border-slate-200 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                        />
                      </td>
                      <td className="py-1.5">
                        <input
                          type="number"
                          min="0"
                          value={row.day_rate}
                          onChange={(e) => updateRow(date, { day_rate: e.target.value })}
                          onBlur={() => saveRow(date)}
                          className="w-24 rounded-lg border border-slate-200 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                        />
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="py-1.5">
                        <input
                          type="number"
                          min="0"
                          value={row.fixed_value}
                          onChange={(e) => updateRow(date, { fixed_value: e.target.value })}
                          onBlur={() => saveRow(date)}
                          className="w-28 rounded-lg border border-slate-200 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                        />
                      </td>
                      <td className="py-1.5">
                        <input
                          type="number"
                          min="0"
                          value={row.hassan_commission}
                          onChange={(e) => updateRow(date, { hassan_commission: e.target.value })}
                          onBlur={() => saveRow(date)}
                          className="w-24 rounded-lg border border-slate-200 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                        />
                      </td>
                    </>
                  )}
                  <td className="py-1.5 font-semibold text-primary-dark whitespace-nowrap">
                    {row.id ? formatEGP(row.day_value) : ""}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={mode === "hours" ? 5 : 4} className="pt-3 text-sm font-bold text-slate-700">
                إجمالي الشهر{mode === "fixed" && commissionTotal > 0 && " (وكوميشن حسن)"}
              </td>
              <td className="pt-3 text-sm font-bold text-primary-dark whitespace-nowrap">
                {formatEGP(monthTotal)}
                {mode === "fixed" && commissionTotal > 0 && (
                  <div className="text-xs font-semibold text-slate-500">كوميشن: {formatEGP(commissionTotal)}</div>
                )}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
