import { useEffect, useMemo, useState } from "react";
import { dailyLogsApi } from "../../api/client";
import { DailyLog, DailyLogRole, WageType } from "../../api/types";
import { daysInMonth, weekdayLabel } from "../../utils/months";
import { formatEGP } from "../../utils/format";

interface Person {
  id: number;
  name: string;
  rate?: number;
  wage_type?: WageType;
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
  is_paid_leave: boolean;
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
    is_paid_leave: false,
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

  const [bulkFrom, setBulkFrom] = useState("1");
  const [bulkTo, setBulkTo] = useState(String(dates.length));
  const [bulkPerson, setBulkPerson] = useState("");
  const [bulkRate, setBulkRate] = useState("");
  const [bulkBaseHours, setBulkBaseHours] = useState("8");
  const [bulkApplying, setBulkApplying] = useState(false);

  const refresh = () =>
    dailyLogsApi.list(equipmentId, month, role).then((logs) => {
      const byDate = new Map(logs.map((l) => [l.date, l]));
      const next: Record<string, RowDraft> = {};
      for (const date of dates) {
        const log = byDate.get(date);
        next[date] = log ? draftFromLog(log) : emptyRow();
      }
      setRows(next);
    });

  useEffect(() => {
    setLoading(true);
    refresh().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [equipmentId, month, role]);

  useEffect(() => {
    setBulkFrom("1");
    setBulkTo(String(dates.length));
  }, [dates]);

  function draftFromLog(log: DailyLog): RowDraft {
    return {
      id: log.id,
      person_name: log.person_name,
      actual_hours: log.actual_hours?.toString() ?? "",
      base_hours: log.base_hours?.toString() ?? "8",
      day_rate: log.day_rate?.toString() ?? "",
      is_paid_leave: log.is_paid_leave ?? false,
      fixed_value: log.fixed_value?.toString() ?? "",
      hassan_commission: log.hassan_commission?.toString() ?? "",
      day_value: log.day_value,
      saving: false,
    };
  }

  function isMonthlyPerson(name: string): boolean {
    return people.find((p) => p.name === name)?.wage_type === "monthly";
  }

  function updateRow(date: string, patch: Partial<RowDraft>) {
    setRows((prev) => ({ ...prev, [date]: { ...prev[date], ...patch } }));
  }

  function handlePersonChange(date: string, name: string) {
    const match = people.find((p) => p.name === name);
    const patch: Partial<RowDraft> = { person_name: name };
    // سعر اليوم هنا معناه دخل المعدة، مش مرتب الشخص — نقترحه بس من سعر السائق
    // اليومي، لأن مرتب الموظف الشهري رقم شهري ومالوش علاقة بقيمة يوم شغل المعدة.
    if (match?.rate && match.wage_type !== "monthly" && mode === "hours") patch.day_rate = String(match.rate);
    if (match?.wage_type !== "monthly") patch.is_paid_leave = false;
    updateRow(date, patch);
  }

  async function saveRow(date: string, override?: Partial<RowDraft>) {
    const row = { ...(rows[date] ?? emptyRow()), ...override };
    if (!row) return;

    const hasContent =
      mode === "hours"
        ? row.person_name && (row.day_rate || row.is_paid_leave)
        : row.person_name && row.fixed_value;

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
      actual_hours: mode === "hours" && !row.is_paid_leave ? Number(row.actual_hours) || 0 : null,
      base_hours: mode === "hours" && !row.is_paid_leave ? Number(row.base_hours) || 0 : null,
      day_rate: mode === "hours" ? Number(row.day_rate) || 0 : null,
      is_paid_leave: row.is_paid_leave,
      fixed_value: mode === "fixed" ? Number(row.fixed_value) || 0 : null,
      hassan_commission: mode === "fixed" && row.hassan_commission ? Number(row.hassan_commission) : null,
    });
    updateRow(date, { id: saved.id, day_value: saved.day_value, saving: false });
    onChanged?.();
  }

  function toggleLeave(date: string, checked: boolean) {
    updateRow(date, { is_paid_leave: checked });
    saveRow(date, { is_paid_leave: checked });
  }

  function handleBulkPersonChange(name: string) {
    setBulkPerson(name);
    const match = people.find((p) => p.name === name);
    if (match?.rate && match.wage_type !== "monthly") setBulkRate(String(match.rate));
  }

  // Fills a whole date range with the same name/rate/base-hours in one go —
  // most days in a month share the same driver and rate, only the actual
  // hours change on the odd overtime day, so that's left per-day as usual.
  async function applyBulkFill() {
    const from = Number(bulkFrom);
    const to = Number(bulkTo);
    if (!bulkPerson || !bulkRate || !from || !to || from > to) return;

    setBulkApplying(true);
    const targetDates = dates.filter((date) => {
      const day = Number(date.slice(-2));
      return day >= from && day <= to;
    });

    for (const date of targetDates) {
      await dailyLogsApi.upsert({
        equipment_id: equipmentId,
        date,
        role,
        person_name: bulkPerson,
        actual_hours: Number(bulkBaseHours) || 0,
        base_hours: Number(bulkBaseHours) || 0,
        day_rate: Number(bulkRate) || 0,
        is_paid_leave: false,
        fixed_value: null,
        hassan_commission: null,
      });
    }

    await refresh();
    setBulkApplying(false);
    onChanged?.();
  }

  const monthTotal = Object.values(rows).reduce((sum, r) => sum + (r.id ? r.day_value : 0), 0);

  if (loading) {
    return <div className="bg-white rounded-card shadow-card p-5 text-sm text-slate-400">جاري التحميل...</div>;
  }

  return (
    <div className="bg-white rounded-card shadow-card p-5">
      {mode === "hours" && (
        <div className="no-print bg-slate-50 rounded-xl p-3 mb-4">
          <div className="text-xs font-bold text-slate-500 mb-2">تعبئة سريعة لمجموعة أيام دفعة واحدة</div>
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">من يوم</label>
              <select
                value={bulkFrom}
                onChange={(e) => setBulkFrom(e.target.value)}
                className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm bg-white"
              >
                {dates.map((d) => (
                  <option key={d} value={Number(d.slice(-2))}>
                    {d.slice(-2)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">إلى يوم</label>
              <select
                value={bulkTo}
                onChange={(e) => setBulkTo(e.target.value)}
                className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm bg-white"
              >
                {dates.map((d) => (
                  <option key={d} value={Number(d.slice(-2))}>
                    {d.slice(-2)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">الاسم</label>
              <select
                value={bulkPerson}
                onChange={(e) => handleBulkPersonChange(e.target.value)}
                className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm bg-white"
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
              <label className="block text-[11px] text-slate-400 mb-1">سعر اليوم</label>
              <input
                type="number"
                min="0"
                value={bulkRate}
                onChange={(e) => setBulkRate(e.target.value)}
                className="w-24 rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">الساعات الأساسية</label>
              <input
                type="number"
                min="0"
                step="0.5"
                value={bulkBaseHours}
                onChange={(e) => setBulkBaseHours(e.target.value)}
                className="w-20 rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
              />
            </div>
            <button
              onClick={applyBulkFill}
              disabled={bulkApplying || !bulkPerson || !bulkRate}
              className="bg-primary text-white rounded-lg px-4 py-1.5 text-sm font-semibold hover:bg-primary-dark disabled:opacity-50"
            >
              {bulkApplying ? "جاري التعبئة..." : "تطبيق على الأيام"}
            </button>
          </div>
          <div className="text-[11px] text-slate-400 mt-2">
            بيملأ الاسم وسعر اليوم والساعات الأساسية لكل الأيام في المدى ده، وبيفترض إن الساعات الفعلية زي الأساسية (من غير أوفر تايم) — لو يوم فيه أوفر تايم عدّل الساعات الفعلية بتاعته لوحده بعد التعبئة.
          </div>
        </div>
      )}

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
                  {role === "driver" && (
                    <th className="text-start font-semibold py-2 whitespace-nowrap">
                      <span className="no-print">إجازة مدفوعة</span>
                    </th>
                  )}
                </>
              ) : (
                // القيمة والكوميشن قبل الخصم يفضلوا مخفيين وقت الطباعة — الشيت
                // ده بيتبعت للشركاء، والقيمة النهائية بس (الإجمالي) اللي المفروض تبان.
                <>
                  <th className="text-start font-semibold py-2">
                    <span className="no-print">قيمة اليوم</span>
                  </th>
                  <th className="text-start font-semibold py-2">
                    <span className="no-print">كوميشن حسن</span>
                  </th>
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
                          disabled={row.is_paid_leave}
                          className="w-24 rounded-lg border border-slate-200 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:bg-slate-100 disabled:text-slate-400"
                        />
                      </td>
                      {role === "driver" && (
                        <td className="no-print py-1.5 text-center">
                          {isMonthlyPerson(row.person_name) && (
                            <input
                              type="checkbox"
                              checked={row.is_paid_leave}
                              onChange={(e) => toggleLeave(date, e.target.checked)}
                              className="w-4 h-4 accent-primary"
                              title="إجازة مدفوعة — مش هيتخصم من مرتبه الشهري"
                            />
                          )}
                        </td>
                      )}
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
                          className="no-print w-28 rounded-lg border border-slate-200 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                        />
                      </td>
                      <td className="py-1.5">
                        <input
                          type="number"
                          min="0"
                          value={row.hassan_commission}
                          onChange={(e) => updateRow(date, { hassan_commission: e.target.value })}
                          onBlur={() => saveRow(date)}
                          className="no-print w-24 rounded-lg border border-slate-200 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
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
              <td
                colSpan={mode === "hours" ? (role === "driver" ? 6 : 5) : 4}
                className="pt-3 text-sm font-bold text-slate-700"
              >
                إجمالي الشهر
              </td>
              <td className="pt-3 text-sm font-bold text-primary-dark whitespace-nowrap">{formatEGP(monthTotal)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
