import { useMemo } from "react";
import { DailyLog, DailyLogRole } from "../types";
import { daysInMonth, weekdayLabel } from "../utils/months";
import { listDailyLogs } from "../store";

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
}

export default function DailyLogSheet({ equipmentId, month, role }: DailyLogSheetProps) {
  const dates = useMemo(() => daysInMonth(month), [month]);
  const logs = listDailyLogs(equipmentId, month, role);
  const byDate = new Map(logs.map((l) => [l.date, l]));
  const isContractor = role === "contractor";
  const isDriver = role === "driver";

  // ملخص أيام الشهر: كام يوم اشتغل كامل، وكام يوم اشتغل جزء بس من ساعاته
  // الأساسية (مجمّعين بعدد الساعات اللي اشتغلوها) — الأيام اللي معلّمة
  // "مشتغلش" أو لسه فاضية متحسبش خالص.
  const workDaysSummary = useMemo(() => {
    let fullDays = 0;
    const partialGroups = new Map<number, string[]>();
    for (const date of dates) {
      const log = byDate.get(date);
      if (!log || log.is_day_off) continue;
      const base = log.base_hours ?? 0;
      const actual = log.actual_hours ?? base;
      if (base <= 0 || actual >= base) {
        fullDays++;
      } else {
        if (!partialGroups.has(actual)) partialGroups.set(actual, []);
        partialGroups.get(actual)!.push(date.slice(-2));
      }
    }
    return { fullDays, partialGroups };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logs, dates]);

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {dates.map((date) => {
          const log = byDate.get(date);
          const dayNum = date.slice(-2);
          const off = log?.is_day_off ?? false;
          const filled = !off && !!log;
          return (
            <div
              key={date}
              className={[
                "rounded-2xl border p-3",
                off ? "bg-rose-50 border-rose-200" : filled ? "bg-white border-slate-200 shadow-card" : "bg-slate-50/60 border-dashed border-slate-200",
              ].join(" ")}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="text-sm font-extrabold text-slate-700">
                  {dayNum} {weekdayLabel(date) && <span className="text-xs font-semibold text-slate-400">({weekdayLabel(date)})</span>}
                </div>
                {log?.day_rate != null && !off && <div className="text-sm font-bold text-primary-dark">{log.day_rate} ج.م</div>}
              </div>

              {off ? (
                <div className="text-xs font-bold text-rose-600">{isContractor ? "مشتغلش (متعلّم من شيت السركي)" : "مشتغلش"}</div>
              ) : !log ? (
                <div className="text-xs text-slate-400">مفيش بيانات مسجلة.</div>
              ) : (
                <div className="text-xs text-slate-500 space-y-0.5">
                  <div>{isContractor ? "المقاول" : "الاسم"}: <span className="font-semibold text-slate-700">{log.person_name || "—"}</span></div>
                  <div>
                    الساعات: <span className="font-semibold text-slate-700">{log.actual_hours ?? log.base_hours ?? "—"}</span>
                    {!isContractor && log.base_hours != null && log.actual_hours != null && log.actual_hours > log.base_hours && (
                      <span className="text-primary-dark"> (أوفر تايم {log.actual_hours - log.base_hours})</span>
                    )}
                  </div>
                  {log.note && <div>بيان: {log.note}</div>}
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
