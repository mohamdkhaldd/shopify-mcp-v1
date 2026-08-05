import { useEffect, useMemo, useState } from "react";
import { dailyLogsApi } from "../../api/client";
import { DailyLog, DailyLogRole, WageType } from "../../api/types";
import { daysInMonth, weekdayLabel } from "../../utils/months";
import { formatEGP } from "../../utils/format";
import { useUndo } from "../../context/UndoContext";

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

// الساعات مشتركة بين السركي والمقاول لنفس المعدة واليوم — لو يوم اتمسح من
// شيت، بيتمسح من التاني بردو (السيرفر بيعمل ده تلقائيًا)، فلازم نحفظ نسخة
// من الاتنين قبل المسح عشان Ctrl+Z يرجّعهم مع بعض بدل ما يرجّع نص الصورة.
const OTHER_HOURS_ROLE: Partial<Record<DailyLogRole, DailyLogRole>> = {
  driver: "contractor",
  contractor: "driver",
};

interface RowDraft {
  id: number | null;
  person_name: string;
  actual_hours: string;
  base_hours: string;
  overtime_hours: string;
  day_rate: string;
  is_paid_leave: boolean;
  is_day_off: boolean;
  fixed_value: string;
  hassan_commission: string;
  note: string;
  day_value: number;
  saving: boolean;
}

function emptyRow(): RowDraft {
  return {
    id: null,
    person_name: "",
    actual_hours: "",
    base_hours: "8",
    overtime_hours: "",
    day_rate: "",
    is_paid_leave: false,
    is_day_off: false,
    fixed_value: "",
    hassan_commission: "",
    note: "",
    day_value: 0,
    saving: false,
  };
}

// عدد ساعات الأوفر تايم بيتحسب دايمًا من الفرق بين الساعات الفعلية والأساسية
// — الخانة دي مجرد طريقة تانية أسهل لملء "الساعات الفعلية" (أساسي + إضافي)
// بدل ما تجمعهم في دماغك، مش قيمة منفصلة متخزنة لوحدها.
function overtimeFromHours(actualHours: string, baseHours: string): string {
  const actual = Number(actualHours) || 0;
  const base = Number(baseHours) || 0;
  const overtime = actual - base;
  return overtime > 0 ? String(overtime) : "";
}

// خانة فاضية معناها "الساعات متكتبتش" (يوم عادي كامل) — مش صفر ساعة عمل،
// عشان محسوب القيمة يفضل يعتبرها يوم كامل لحد ما تتكتب فعلاً، مش يصفّرها.
function hoursOrNull(value: string): number | null {
  return value.trim() === "" ? null : Number(value) || 0;
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
  const [bulkClearing, setBulkClearing] = useState(false);
  const { pushUndo } = useUndo();

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
    const actual_hours = log.actual_hours?.toString() ?? "";
    const base_hours = log.base_hours?.toString() ?? "8";
    return {
      id: log.id,
      person_name: log.person_name,
      actual_hours,
      base_hours,
      overtime_hours: overtimeFromHours(actual_hours, base_hours),
      day_rate: log.day_rate?.toString() ?? "",
      is_paid_leave: log.is_paid_leave ?? false,
      is_day_off: log.is_day_off ?? false,
      fixed_value: log.fixed_value?.toString() ?? "",
      hassan_commission: log.hassan_commission?.toString() ?? "",
      note: log.note ?? "",
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

  function restoreDailyLog(log: DailyLog) {
    return dailyLogsApi.upsert({
      equipment_id: log.equipment_id,
      date: log.date,
      role: log.role,
      person_name: log.person_name,
      actual_hours: log.actual_hours,
      base_hours: log.base_hours,
      day_rate: log.day_rate,
      is_paid_leave: log.is_paid_leave,
      is_day_off: log.is_day_off,
      fixed_value: log.fixed_value,
      hassan_commission: log.hassan_commission,
      note: log.note,
    });
  }

  // خانة الأوفر تايم بديل أسهل لكتابة "الساعات الفعلية" في يوم زاد فيه —
  // بيحسب الساعات الفعلية = الأساسية + الإضافية تلقائيًا بدل ما تجمعهم بنفسك.
  function handleOvertimeChange(date: string, value: string) {
    const row = rows[date] ?? emptyRow();
    const base = Number(row.base_hours) || 0;
    const overtime = Number(value) || 0;
    updateRow(date, { overtime_hours: value, actual_hours: String(base + overtime) });
  }

  // تعديل الساعات الفعلية مباشرة (يوم اشتغل أقل من الأساسي مثلاً) بيصفّر
  // خانة الأوفر تايم عشان الاتنين ميفضلوش متناقضين.
  function handleActualHoursChange(date: string, value: string) {
    const row = rows[date] ?? emptyRow();
    updateRow(date, { actual_hours: value, overtime_hours: overtimeFromHours(value, row.base_hours) });
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

    // بيان لوحده (يوم مشتغلش خالص، بس لازم السبب يتسجل) كافي يخلي الصف يتحفظ
    // من غير ما يحتاج اسم أو سعر — مفيد بس في شيتي السركي والمقاول. وكمان
    // الساعات الفعلية لوحدها (اتكتبت مباشرة أو عن طريق خانة الأوفر تايم)
    // كافية تحفظ الصف من غير شخص، عشان تقدر تدخل الساعات مرة واحدة وتسمع
    // في الشيت التاني قبل ما تحدد السواق/المقاول وسعره.
    const hasNote = mode === "hours" && row.note.trim().length > 0;
    const hasHours = mode === "hours" && row.actual_hours.trim() !== "";
    const hasContent =
      mode === "hours"
        ? Boolean(row.person_name && (row.day_rate || row.is_paid_leave)) || hasNote || hasHours || row.is_day_off
        : Boolean(row.person_name && row.fixed_value);

    if (!hasContent) {
      if (row.id) {
        // بيقرا الصف الأصلي من السيرفر قبل المسح — مش من الدرافت المحلي، لأنه
        // ممكن يكون اتمسح منه الاسم فعلاً (زي هنا بالظبط) قبل ما onBlur يشتغل.
        // الساعات مشتركة مع الشيت التاني (سركي/مقاول) — مسح اليوم هنا بيمسحه
        // هناك بردو من السيرفر تلقائيًا، فلازم نحفظ نسخة من صف الشيت التاني
        // قبل المسح عشان Ctrl+Z يرجّع الاتنين مع بعض.
        const original = (await dailyLogsApi.list(equipmentId, month, role)).find((l) => l.date === date) ?? null;
        const otherRole = OTHER_HOURS_ROLE[role];
        const counterpart = otherRole
          ? (await dailyLogsApi.list(equipmentId, month, otherRole)).find((l) => l.date === date) ?? null
          : null;
        await dailyLogsApi.remove(row.id);
        updateRow(date, { id: null, day_value: 0 });
        onChanged?.();
        pushUndo(`اتمسح يوم ${date.slice(-2)}`, async () => {
          if (original) await restoreDailyLog(original);
          if (counterpart) await restoreDailyLog(counterpart);
          await refresh();
          onChanged?.();
        });
      }
      return;
    }

    updateRow(date, { saving: true });
    const saved = await dailyLogsApi.upsert({
      equipment_id: equipmentId,
      date,
      role,
      person_name: row.person_name,
      actual_hours: mode === "hours" && !row.is_paid_leave ? hoursOrNull(row.actual_hours) : null,
      base_hours: mode === "hours" && !row.is_paid_leave ? hoursOrNull(row.base_hours) : null,
      day_rate: mode === "hours" ? Number(row.day_rate) || 0 : null,
      is_paid_leave: row.is_paid_leave,
      is_day_off: row.is_day_off,
      fixed_value: mode === "fixed" ? Number(row.fixed_value) || 0 : null,
      hassan_commission: mode === "fixed" && row.hassan_commission ? Number(row.hassan_commission) : null,
      note: row.note.trim() || null,
    });
    updateRow(date, { id: saved.id, day_value: saved.day_value, saving: false });
    onChanged?.();
  }

  function toggleLeave(date: string, checked: boolean) {
    updateRow(date, { is_paid_leave: checked });
    saveRow(date, { is_paid_leave: checked });
  }

  // زرار "مشتغلش" — بيعلّم اليوم إنه معدة/سائق ما اشتغلوش من غير ما يمسح أي
  // بيانات مكتوبة (لو رجع يشتغل تاني تقدر تشيل العلامة والبيانات ترجع زي
  // ما هي). العلامة بتتزامن مع الشيت التاني (سركي/مقاول) تلقائيًا من السيرفر.
  function toggleDayOff(date: string) {
    const row = rows[date] ?? emptyRow();
    const next = !row.is_day_off;
    updateRow(date, { is_day_off: next });
    saveRow(date, { is_day_off: next });
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
        is_day_off: false,
        fixed_value: null,
        hassan_commission: null,
        note: rows[date]?.note.trim() || null,
      });
    }

    await refresh();
    setBulkApplying(false);
    onChanged?.();
  }

  // بيفرّغ مجموعة أيام دفعة واحدة (يعني الشخص دا مشتغلش الأيام دي) — بديل
  // سريع لمسح كل يوم لوحده يدويًا. بيسيب نسخة من الأيام اللي اتمسحت في نظام
  // التراجع العام عشان لو غلط في المدى يرجّعها بسهولة.
  async function applyBulkClear() {
    const from = Number(bulkFrom);
    const to = Number(bulkTo);
    if (!from || !to || from > to) return;

    const targetDates = dates.filter((date) => {
      const day = Number(date.slice(-2));
      return day >= from && day <= to && rows[date]?.id;
    });
    if (targetDates.length === 0) return;

    // الأيام دي هتتمسح من الشيت التاني (سركي/مقاول) بردو تلقائيًا، فلازم
    // نحفظ نسخة من صفوفه هو كمان قبل المسح عشان Ctrl+Z يرجّع الاتنين.
    const otherRole = OTHER_HOURS_ROLE[role];
    const otherLogs = otherRole ? await dailyLogsApi.list(equipmentId, month, otherRole) : [];
    const otherByDate = new Map(otherLogs.map((l) => [l.date, l]));
    const counterpartSnapshot = targetDates
      .map((date) => otherByDate.get(date))
      .filter((l): l is DailyLog => !!l);

    const snapshot = targetDates.map((date) => ({ date, row: rows[date] }));
    setBulkClearing(true);
    for (const date of targetDates) {
      const id = rows[date].id;
      if (id) await dailyLogsApi.remove(id);
    }
    await refresh();
    setBulkClearing(false);
    onChanged?.();

    pushUndo(`اتفرّغت الأيام من ${from} لـ ${to} (${snapshot.length} يوم)`, async () => {
      for (const { date, row } of snapshot) {
        await dailyLogsApi.upsert({
          equipment_id: equipmentId,
          date,
          role,
          person_name: row.person_name,
          actual_hours: mode === "hours" && !row.is_paid_leave ? hoursOrNull(row.actual_hours) : null,
          base_hours: mode === "hours" && !row.is_paid_leave ? hoursOrNull(row.base_hours) : null,
          day_rate: mode === "hours" ? Number(row.day_rate) || 0 : null,
          is_paid_leave: row.is_paid_leave,
          is_day_off: row.is_day_off,
          fixed_value: mode === "fixed" ? Number(row.fixed_value) || 0 : null,
          hassan_commission: mode === "fixed" && row.hassan_commission ? Number(row.hassan_commission) : null,
          note: row.note.trim() || null,
        });
      }
      for (const log of counterpartSnapshot) await restoreDailyLog(log);
      await refresh();
      onChanged?.();
    });
  }

  const monthTotal = Object.values(rows).reduce((sum, r) => sum + (r.id ? r.day_value : 0), 0);
  const monthOvertimeHours = Object.values(rows).reduce((sum, r) => sum + (r.id ? Number(r.overtime_hours) || 0 : 0), 0);

  // ملخص أيام الشهر: كام يوم اشتغل كامل، وكام يوم اشتغل جزء بس من ساعاته
  // الأساسية (مجمّعين بعدد الساعات اللي اشتغلوها، زي "3 أيام اشتغلوا 4
  // ساعات بس") — الأيام اللي معلّمة "مشتغلش" أو لسه فاضية متحسبش خالص.
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
                step="any"
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
            <button
              onClick={applyBulkClear}
              disabled={bulkClearing}
              className="bg-white border border-rose-200 text-rose-600 rounded-lg px-4 py-1.5 text-sm font-semibold hover:bg-rose-50 disabled:opacity-50"
            >
              {bulkClearing ? "جاري الإفراغ..." : "افرغ الأيام دي (مشتغلش)"}
            </button>
          </div>
          <div className="text-[11px] text-slate-400 mt-2">
            "تطبيق على الأيام" بيملأ الاسم وسعر اليوم والساعات الأساسية لكل الأيام في المدى ده (من غير أوفر تايم). "افرغ الأيام دي" بيمسح أي بيانات مسجلة في المدى ده من غير ما تحتاج اسم أو سعر — يعني الشخص مشتغلش الأيام دي، وتقدر ترجعها بـ Ctrl+Z لو غلطت. الساعات والأساسية والبيان بتتسجل في شيت {role === "driver" ? "المقاول" : "السركي"} تلقائيًا لنفس الأيام — تدخلها هنا مرة واحدة بس، وبعدين تحدد {role === "driver" ? "المقاول وسعره" : "السواق وسعره"} من هناك.
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
                  <th className="text-start font-semibold py-2">أوفر تايم</th>
                  <th className="text-start font-semibold py-2">الساعات الأساسية</th>
                  <th className="text-start font-semibold py-2">اليومية</th>
                  {role === "driver" && (
                    <th className="text-start font-semibold py-2 whitespace-nowrap">
                      <span className="no-print">إجازة مدفوعة</span>
                    </th>
                  )}
                  <th className="text-start font-semibold py-2 min-w-[140px]">بيان</th>
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
                    row.is_day_off ? "bg-rose-50" : row.id ? "bg-white" : "bg-slate-50/40",
                  ].join(" ")}
                >
                  <td className="py-1.5 text-slate-500 whitespace-nowrap">
                    {mode === "hours" && (
                      <button
                        type="button"
                        onClick={() => toggleDayOff(date)}
                        title={row.is_day_off ? "اتعلّم إن اليوم ده مشتغلش — دوس تاني عشان تشيل العلامة" : "علّم إن اليوم ده مشتغلش"}
                        className={[
                          "no-print inline-block w-3.5 h-3.5 rounded-full border align-middle me-1.5",
                          row.is_day_off ? "bg-rose-500 border-rose-500" : "border-rose-300 hover:bg-rose-100",
                        ].join(" ")}
                      />
                    )}
                    {isFlagged && (
                      <span className="inline-block w-2 h-2 rounded-full bg-rose-500 align-middle me-1.5" title="الساعات مش متطابقة بين السركي والمقاول" />
                    )}
                    {dayNum}
                    <span className="text-xs text-slate-400"> ({weekdayLabel(date)})</span>
                    {row.is_day_off && <span className="print-only">مشتغلش</span>}
                  </td>
                  <td className="py-1.5">
                    <select
                      value={row.person_name}
                      onChange={(e) => handlePersonChange(date, e.target.value)}
                      onBlur={() => saveRow(date)}
                      className={[
                        "w-full rounded-lg border border-slate-200 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 bg-white",
                        row.is_paid_leave ? "no-print" : "",
                      ].join(" ")}
                    >
                      <option value=""></option>
                      {people.map((p) => (
                        <option key={p.id} value={p.name}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                    {row.is_paid_leave && <span className="print-only">&nbsp;</span>}
                  </td>
                  {mode === "hours" ? (
                    <>
                      <td className="py-1.5">
                        <input
                          type="number"
                          min="0"
                          step="0.5"
                          value={row.actual_hours}
                          onChange={(e) => handleActualHoursChange(date, e.target.value)}
                          onBlur={() => saveRow(date)}
                          className="w-20 rounded-lg border border-slate-200 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                        />
                      </td>
                      <td className="py-1.5">
                        <input
                          type="number"
                          min="0"
                          step="0.5"
                          placeholder="—"
                          value={row.overtime_hours}
                          onChange={(e) => handleOvertimeChange(date, e.target.value)}
                          onBlur={() => saveRow(date)}
                          disabled={row.is_paid_leave}
                          className="w-20 rounded-lg border border-slate-200 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:bg-slate-100 disabled:text-slate-400"
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
                          step="any"
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
                      <td className="py-1.5">
                        <input
                          type="text"
                          placeholder="لو مشتغلش، ليه؟"
                          value={row.note}
                          onChange={(e) => updateRow(date, { note: e.target.value })}
                          onBlur={() => saveRow(date)}
                          className="w-full rounded-lg border border-slate-200 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                        />
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="py-1.5">
                        <input
                          type="number"
                          min="0"
                          step="any"
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
                          step="any"
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
            {mode === "hours" && (
              <tr>
                <td colSpan={2} className="pt-3 text-sm font-bold text-slate-700">
                  إجمالي الأوفر تايم
                </td>
                <td colSpan={role === "driver" ? 5 : 4} className="pt-3 text-sm font-bold text-slate-600">
                  {monthOvertimeHours} ساعة
                </td>
              </tr>
            )}
            <tr>
              <td
                colSpan={mode === "hours" ? (role === "driver" ? 7 : 6) : 4}
                className="pt-3 text-sm font-bold text-slate-700"
              >
                إجمالي الشهر
              </td>
              <td className="pt-3 text-sm font-bold text-primary-dark whitespace-nowrap">{formatEGP(monthTotal)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {mode === "hours" && role === "driver" && (
        <div className="mt-4 bg-slate-50 rounded-xl p-3 text-sm">
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
