import { useEffect, useState } from "react";
import { dailyLogsApi, equipmentApi, equipmentShiftsApi, monthlyExpensesApi } from "../../api/client";
import { DailyLog, Equipment, EquipmentSummary, MonthlyExpense } from "../../api/types";
import { formatEGP } from "../../utils/format";
import { monthLabel } from "../../utils/months";
import { person } from "../../person";
import { PackageShell, Page } from "./PartnerPackage";

// تقرير المعدة في ورقة A4 واحدة: السركي والمقاول يوم بيوم جنب بعض، المصروفات،
// صافي الربح، وتوزيعه على الشركاء. لو الشهر طويل الصفحة بتصغر لوحدها.
interface Data {
  summary: EquipmentSummary;
  driver: DailyLog[];
  contractor: DailyLog[];
  market: DailyLog[];
  expenses: MonthlyExpense[];
}

const n = (v: number) => Math.round(v).toLocaleString("en-US");
const worked = (l: DailyLog) => !l.is_day_off && !l.is_paid_leave && l.day_value > 0;
const hours = (l?: DailyLog) => (!l ? "" : l.is_day_off ? "—" : l.is_paid_leave ? "إجازة" : String(l.actual_hours ?? l.base_hours ?? ""));

function byDate(logs: DailyLog[]) {
  // كذا وردية في نفس اليوم: بتتجمع في سطر اليوم
  const m = new Map<string, DailyLog>();
  for (const l of logs) {
    const x = m.get(l.date);
    if (!x) m.set(l.date, { ...l });
    else {
      x.day_value += l.day_value;
      x.actual_hours = (x.actual_hours ?? x.base_hours ?? 0) + (l.actual_hours ?? l.base_hours ?? 0);
      x.is_day_off = x.is_day_off && l.is_day_off;
    }
  }
  return m;
}

function OnePage({ equipment, month, onReady }: { equipment: Equipment; month: string; onReady: () => void }) {
  const [d, setD] = useState<Data | null>(null);
  useEffect(() => {
    (async () => {
      const labels = ["", ...(await equipmentShiftsApi.list(equipment.id)).map((s) => s.label)];
      const all = async (role: "driver" | "contractor") => (await Promise.all(labels.map((lb) => dailyLogsApi.list(equipment.id, month, role, lb)))).flat();
      const [summary, driver, contractor, market, expenses] = await Promise.all([
        equipmentApi.summary(equipment.id, month),
        all("driver"),
        all("contractor"),
        dailyLogsApi.list(equipment.id, month, "market", ""),
        monthlyExpensesApi.list(equipment.id, month),
      ]);
      setD({
        summary,
        driver: driver.filter((l) => l.person_name || l.day_rate || l.is_day_off),
        contractor: contractor.filter((l) => l.person_name || l.day_rate || l.is_day_off),
        market: market.filter((l) => l.fixed_value),
        expenses,
      });
    })();
  }, [equipment.id, month]);
  useEffect(() => {
    if (d) onReady();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d]);
  if (!d) return <div className="p-6 text-center text-slate-500">جاري تجهيز {equipment.name}...</div>;

  const s = d.summary;
  const drv = byDate(d.driver);
  const con = byDate(d.contractor);
  const dates = [...new Set([...drv.keys(), ...con.keys()])].sort();
  const drvTotal = d.driver.reduce((t, l) => t + l.day_value, 0);
  const conTotal = d.contractor.reduce((t, l) => t + l.day_value, 0);
  const contractors = [...new Set(d.contractor.map((l) => l.person_name).filter(Boolean))].join(" + ");
  const drivers = [...new Set(d.driver.map((l) => l.person_name).filter(Boolean))].join(" + ");
  const commission = conTotal > 0 ? conTotal - drvTotal : 0;

  const th = "text-start font-bold py-1 px-1.5 border-b-2 border-slate-300 text-slate-600 text-[11px]";
  const td = "py-[3px] px-1.5 border-b border-slate-100";
  const box = "rounded-lg border border-slate-200 p-3";

  return (
    <Page title="تقرير الشهر" heading={equipment.name} month={month}>
      {/* الأرقام المهمة */}
      <div className="grid grid-cols-5 gap-2 mb-3 text-center">
        {[
          ["شغل المقاول", conTotal, ""],
          ["دخل السركي", s.income, ""],
          [`كوميشن ${person()}`, commission, ""],
          ["المصروفات", -s.expenseTotal, ""],
          ["صافي الربح", s.netProfit, "bg-slate-900 text-white"],
        ].map(([label, v, cls]) => (
          <div key={label as string} className={`rounded-lg border border-slate-200 py-2 ${cls}`}>
            <div className={`text-[10px] ${cls ? "text-white/70" : "text-slate-500"}`}>{label}</div>
            <div className="font-extrabold text-[15px]">{n(v as number)}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-[1.25fr_1fr] gap-3">
        {/* السركي والمقاول يوم بيوم */}
        <div className={box}>
          <div className="flex justify-between items-baseline mb-1">
            <b className="text-[13px]">السركي والمقاول يوم بيوم</b>
            <span className="text-[10px] text-slate-500">ساعات / قيمة</span>
          </div>
          <div className="text-[10px] text-slate-500 mb-1">
            {drivers && <>السركي: {drivers} </>}
            {contractors && <>— المقاول: {contractors}</>}
          </div>
          <table className="w-full text-[11px]">
            <thead>
              <tr>
                <th className={th}>اليوم</th>
                <th className={th}>سركي س</th>
                <th className={th}>سركي ج</th>
                <th className={th}>مقاول س</th>
                <th className={th}>مقاول ج</th>
              </tr>
            </thead>
            <tbody>
              {dates.map((dt) => {
                const a = drv.get(dt);
                const b = con.get(dt);
                const mismatch = a && b && worked(a) && worked(b) && (a.actual_hours ?? a.base_hours) !== (b.actual_hours ?? b.base_hours);
                return (
                  <tr key={dt} className={mismatch ? "bg-rose-50" : ""}>
                    <td className={td}>{dt.slice(8, 10)}/{dt.slice(5, 7)}</td>
                    <td className={td}>{hours(a)}</td>
                    <td className={td}>{a && a.day_value ? n(a.day_value) : ""}</td>
                    <td className={td}>{hours(b)}</td>
                    <td className={td}>{b && b.day_value ? n(b.day_value) : ""}</td>
                  </tr>
                );
              })}
              {dates.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-3 text-center text-slate-400">مفيش أيام متسجلة</td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr className="font-extrabold">
                <td className="pt-1.5">الإجمالي</td>
                <td className="pt-1.5">{d.driver.filter(worked).length} يوم</td>
                <td className="pt-1.5">{n(drvTotal)}</td>
                <td className="pt-1.5">{d.contractor.filter(worked).length} يوم</td>
                <td className="pt-1.5">{n(conTotal)}</td>
              </tr>
            </tfoot>
          </table>
          {d.market.length > 0 && (
            <div className="mt-2 text-[11px]">
              <b>سركي سوق:</b> {d.market.map((l) => `${l.date.slice(8, 10)}/${l.date.slice(5, 7)} ${n(l.day_value)}`).join(" · ")} — {n(s.marketIncome)}
            </div>
          )}
        </div>

        <div className="space-y-3">
          {/* المصروفات */}
          <div className={box}>
            <b className="text-[13px]">المصروفات</b>
            <table className="w-full text-[11px] mt-1">
              <tbody>
                {s.driverSalaryBreakdown.map((x) => (
                  <tr key={`s-${x.name}`}>
                    <td className={td}>مرتب السائق — {x.name}</td>
                    <td className={`${td} text-end font-semibold`}>{n(x.amount)}</td>
                  </tr>
                ))}
                {d.expenses.map((e) => (
                  <tr key={e.id}>
                    <td className={td}>
                      {(e.date ?? "").slice(8, 10) && <span className="text-slate-400">{e.date!.slice(8, 10)}/{e.date!.slice(5, 7)} </span>}
                      {e.category_name ?? "مصروف"}
                      {e.note || e.payee ? <span className="text-slate-500"> — {[e.note, e.payee].filter(Boolean).join(" — ")}</span> : ""}
                    </td>
                    <td className={`${td} text-end font-semibold`}>{n(e.amount)}</td>
                  </tr>
                ))}
                {!s.driverSalaryBreakdown.length && !d.expenses.length && (
                  <tr>
                    <td className="py-2 text-slate-400">مفيش مصروفات</td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr className="font-extrabold">
                  <td className="pt-1.5">الإجمالي</td>
                  <td className="pt-1.5 text-end">{n(s.expenseTotal)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* الربح */}
          <div className={box}>
            <b className="text-[13px]">الربح</b>
            <table className="w-full text-[11px] mt-1">
              <tbody>
                <tr>
                  <td className={td}>دخل السركي{s.marketIncome ? " + السوق" : ""}</td>
                  <td className={`${td} text-end`}>{n(s.income)}</td>
                </tr>
                <tr>
                  <td className={td}>− المصروفات</td>
                  <td className={`${td} text-end`}>{n(s.expenseTotal)}</td>
                </tr>
                <tr className="font-extrabold text-[12px]">
                  <td className="pt-1.5">= صافي الربح</td>
                  <td className="pt-1.5 text-end">{formatEGP(s.netProfit)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* التوزيع */}
          <div className={box}>
            <b className="text-[13px]">التوزيع على الشركاء</b>
            {s.distribution.length === 0 ? (
              <div className="text-[11px] text-slate-500 mt-1">مفيش شركاء محددين للمعدة دي.</div>
            ) : (
              <table className="w-full text-[11px] mt-1">
                <tbody>
                  {s.distribution.map((x) => (
                    <tr key={x.partner_id}>
                      <td className={`${td} font-semibold`}>{x.partner_name}</td>
                      <td className={td}>{x.percentage}%</td>
                      <td className={`${td} text-end font-bold`}>{formatEGP(x.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className={`${box} text-[11px] text-slate-600`}>
            <div className="flex justify-between">
              <span>التوقيع</span>
              <span>الختم</span>
            </div>
            <div className="h-14" />
            <div className="border-t border-slate-400 w-32" />
          </div>
          <div className="text-[10px] text-slate-400 leading-relaxed">
            «سركي» = اللي المعدة اشتغلت بيه حسب السركي، و«مقاول» = اللي المقاول بيدفعه. الفرق بينهم كوميشن {person()}. اليوم المتلوّن بالأحمر ساعاته مختلفة بين السركي والمقاول.
          </div>
        </div>
      </div>

    </Page>
  );
}

export default function EquipmentReport({ equipment, month, onClose }: { equipment: Equipment; month: string; onClose: () => void }) {
  const [ready, setReady] = useState(false);
  const period = `${monthLabel(month)} ${month.slice(0, 4)}`;
  return (
    <PackageShell title={`تقرير ${equipment.name}`} subtitle={period} fileName={`تقرير ${equipment.name} - ${period}`} ready={ready} onClose={onClose}>
      <OnePage equipment={equipment} month={month} onReady={() => setReady(true)} />
    </PackageShell>
  );
}
