import { useEffect, useState } from "react";
import MonthBar from "../components/MonthBar";
import { supabase } from "../supabaseClient";
import { signOut } from "../auth";
import { currentMonthKey, daysInMonth, weekdayLabel } from "../utils/months";

interface SummaryRow {
  equipment_name: string;
  percentage: number;
  income: number;
  manual_expense: number;
  driver_salary_expense: number;
  net_profit: number;
  partner_share: number;
}

interface DailyLogRow {
  equipment_name: string;
  log_date: string;
  person_name: string;
  actual_hours: number | null;
  base_hours: number | null;
  day_rate: number | null;
  is_day_off: boolean;
  day_value: number;
}

interface ExpenseRow {
  equipment_name: string;
  expense_date: string;
  category_name: string;
  amount: number;
  payment_method: string | null;
  note: string | null;
}

interface Balance {
  total_due: number;
  total_paid: number;
  remaining: number;
}

type Tab = "summary" | "logs" | "expenses";

function formatEGP(value: number): string {
  return `${Math.round(value).toLocaleString("ar-EG")} ج.م`;
}

function EquipmentLogSheet({ month, logs }: { month: string; logs: DailyLogRow[] }) {
  const dates = daysInMonth(month);
  const byDate = new Map(logs.map((l) => [l.log_date, l]));
  const total = logs.reduce((s, l) => s + (l.is_day_off ? 0 : l.day_value), 0);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between px-0.5 pb-1">
        <div className="text-[11px] text-slate-400 font-semibold">إجمالي الشهر</div>
        <div className="text-sm font-extrabold text-primary-dark">{formatEGP(total)}</div>
      </div>
      {dates.map((date) => {
        const log = byDate.get(date);
        const dayNum = date.slice(-2);
        return (
          <div
            key={date}
            className={[
              "rounded-xl border px-3 py-2",
              log?.is_day_off ? "bg-rose-50 border-rose-200" : log ? "bg-white border-slate-200" : "bg-slate-50/60 border-dashed border-slate-200",
            ].join(" ")}
          >
            <div className="flex items-center justify-between">
              <div className="text-xs font-extrabold text-slate-700">
                {dayNum} <span className="text-[10px] font-semibold text-slate-400">({weekdayLabel(date)})</span>
              </div>
              {log && !log.is_day_off && <div className="text-xs font-bold text-primary-dark">{formatEGP(log.day_value)}</div>}
            </div>
            {log?.is_day_off ? (
              <div className="text-[11px] font-bold text-rose-600 mt-0.5">مشتغلش</div>
            ) : !log ? (
              <div className="text-[11px] text-slate-400 mt-0.5">مفيش بيانات مسجلة</div>
            ) : (
              <div className="text-[11px] text-slate-500 mt-0.5">
                {log.person_name || "—"} — {log.actual_hours ?? log.base_hours ?? "—"} ساعة
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function PartnerSummary({ displayName }: { displayName: string }) {
  const [tab, setTab] = useState<Tab>("summary");
  const [month, setMonth] = useState(currentMonthKey());
  const [summary, setSummary] = useState<SummaryRow[]>([]);
  const [logs, setLogs] = useState<DailyLogRow[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [balance, setBalance] = useState<Balance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedEquipment, setExpandedEquipment] = useState<string | null>(null);

  useEffect(() => {
    supabase.rpc("get_partner_balance").then(({ data, error }) => {
      if (!error && data && data[0]) setBalance(data[0] as Balance);
    });
  }, []);

  useEffect(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      supabase.rpc("get_partner_summary", { p_month: month }),
      supabase.rpc("get_partner_daily_logs", { p_month: month }),
      supabase.rpc("get_partner_expenses", { p_month: month }),
    ]).then(([s, l, e]) => {
      const firstError = s.error ?? l.error ?? e.error;
      if (firstError) {
        setError(firstError.message);
      } else {
        setSummary((s.data as SummaryRow[]) ?? []);
        setLogs((l.data as DailyLogRow[]) ?? []);
        setExpenses((e.data as ExpenseRow[]) ?? []);
      }
      setLoading(false);
    });
  }, [month]);

  const total = summary.reduce((s, r) => s + r.partner_share, 0);

  return (
    <div className="min-h-screen bg-[#F5F7F6] max-w-md mx-auto">
      <div className="bg-primary text-white px-4 pt-6 pb-4 flex items-center justify-between">
        <div>
          <div className="text-xs opacity-80 font-bold">دفتر البنيان</div>
          <div className="text-lg font-extrabold mt-0.5">أهلًا {displayName}</div>
        </div>
        <button onClick={() => signOut()} className="text-xs bg-white/15 rounded-full px-3 py-1.5 font-bold">
          خروج
        </button>
      </div>

      {balance && (
        <div className="px-4 pt-3">
          <div className="bg-white rounded-2xl shadow-card p-4 grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="text-[10px] text-slate-400">مستحق كله</div>
              <div className="text-xs font-bold text-slate-700">{formatEGP(balance.total_due)}</div>
            </div>
            <div>
              <div className="text-[10px] text-slate-400">اتدفع كله</div>
              <div className="text-xs font-bold text-slate-700">{formatEGP(balance.total_paid)}</div>
            </div>
            <div>
              <div className="text-[10px] text-slate-400">الباقي لسه</div>
              <div className={["text-xs font-bold", balance.remaining >= 0 ? "text-primary-dark" : "text-rose-600"].join(" ")}>
                {formatEGP(balance.remaining)}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-1.5 px-4 pt-3">
        {([
          { id: "summary", label: "الملخص" },
          { id: "logs", label: "السركي" },
          { id: "expenses", label: "المصروفات" },
        ] as { id: Tab; label: string }[]).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={[
              "rounded-full px-3.5 py-1.5 text-xs font-bold border",
              tab === t.id ? "bg-primary border-primary text-white" : "bg-white border-slate-200 text-slate-500",
            ].join(" ")}
          >
            {t.label}
          </button>
        ))}
      </div>

      <MonthBar month={month} onChange={setMonth} />

      <div className="p-4 space-y-3">
        {tab === "summary" && (
          <div className="bg-primary-light rounded-2xl p-4 text-center">
            <div className="text-xs text-slate-500 font-semibold">إجمالي نصيبك الشهر ده</div>
            <div className="mt-1 text-xl font-extrabold text-primary-dark">{formatEGP(total)}</div>
          </div>
        )}

        {loading && <div className="text-sm text-slate-400 text-center py-6">جاري التحميل...</div>}
        {error && <div className="text-sm text-rose-600 text-center py-6">حصل خطأ: {error}</div>}

        {!loading && !error && tab === "summary" && (
          <>
            {summary.map((r) => (
              <div key={r.equipment_name} className="bg-white rounded-2xl shadow-card p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-extrabold text-slate-700">{r.equipment_name}</div>
                  <div className="text-[11px] text-slate-400">نصيبك {r.percentage}%</div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-center">
                  <div>
                    <div className="text-[10px] text-slate-400">الدخل</div>
                    <div className="text-xs font-bold text-slate-700">{formatEGP(r.income)}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400">المصروفات</div>
                    <div className="text-xs font-bold text-rose-600">{formatEGP(r.manual_expense)}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400">مرتب السواق</div>
                    <div className="text-xs font-bold text-rose-600">{formatEGP(r.driver_salary_expense)}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400">نصيبك</div>
                    <div className="text-xs font-bold text-primary-dark">{formatEGP(r.partner_share)}</div>
                  </div>
                </div>
              </div>
            ))}
            {summary.length === 0 && <div className="text-sm text-slate-400 text-center py-6">مفيش أرقام مسجلة للشهر ده لسه.</div>}
          </>
        )}

        {!loading && !error && tab === "logs" && (
          <>
            {summary.length === 0 ? (
              <div className="text-sm text-slate-400 text-center py-6">مفيش معدات مسجلة ليك لسه.</div>
            ) : (
              summary.map((s) => {
                const eqLogs = logs.filter((l) => l.equipment_name === s.equipment_name);
                const isOpen = expandedEquipment === s.equipment_name;
                return (
                  <div key={s.equipment_name} className="bg-white rounded-2xl shadow-card overflow-hidden">
                    <button
                      onClick={() => setExpandedEquipment(isOpen ? null : s.equipment_name)}
                      className="w-full p-3.5 flex items-center justify-between text-start"
                    >
                      <div className="text-sm font-bold text-slate-800">{s.equipment_name}</div>
                      <span className="text-primary-dark text-lg leading-none">{isOpen ? "−" : "+"}</span>
                    </button>
                    {isOpen && (
                      <div className="border-t border-slate-100 p-3.5">
                        <EquipmentLogSheet month={month} logs={eqLogs} />
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </>
        )}

        {!loading && !error && tab === "expenses" && (
          <>
            {expenses.map((e, i) => (
              <div key={i} className="bg-white rounded-xl border border-slate-200 px-3 py-2.5">
                <div className="flex items-center justify-between text-xs">
                  <div className="font-bold text-slate-700">{e.equipment_name}</div>
                  <div className="text-slate-400">{e.expense_date?.slice(-2) ?? "—"}</div>
                </div>
                <div className="flex items-center justify-between mt-1 text-xs text-slate-500">
                  <div>{e.category_name || "—"} {e.note && <span>({e.note})</span>}</div>
                  <div className="font-bold text-rose-600">{formatEGP(e.amount)}</div>
                </div>
              </div>
            ))}
            {expenses.length === 0 && <div className="text-sm text-slate-400 text-center py-6">مفيش مصروفات مسجلة للشهر ده لسه.</div>}
          </>
        )}
      </div>
    </div>
  );
}
