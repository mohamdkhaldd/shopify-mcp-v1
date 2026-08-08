import { useEffect, useState } from "react";
import MonthBar from "../components/MonthBar";
import { supabase } from "../supabaseClient";
import { signOut } from "../auth";
import { currentMonthKey } from "../utils/months";

interface SummaryRow {
  equipment_name: string;
  percentage: number;
  income: number;
  manual_expense: number;
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

export default function PartnerSummary({ displayName }: { displayName: string }) {
  const [tab, setTab] = useState<Tab>("summary");
  const [month, setMonth] = useState(currentMonthKey());
  const [summary, setSummary] = useState<SummaryRow[]>([]);
  const [logs, setLogs] = useState<DailyLogRow[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [balance, setBalance] = useState<Balance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.rpc("get_partner_balance").then(({ data, error }) => {
      if (!error && data && data[0]) setBalance(data[0] as Balance);
    });
  }, []);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const rpcName = tab === "summary" ? "get_partner_summary" : tab === "logs" ? "get_partner_daily_logs" : "get_partner_expenses";
    supabase
      .rpc(rpcName, { p_month: month })
      .then(({ data, error }) => {
        if (error) {
          setError(error.message);
        } else if (tab === "summary") setSummary((data as SummaryRow[]) ?? []);
        else if (tab === "logs") setLogs((data as DailyLogRow[]) ?? []);
        else setExpenses((data as ExpenseRow[]) ?? []);
        setLoading(false);
      });
  }, [tab, month]);

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
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <div className="text-[10px] text-slate-400">الدخل</div>
                    <div className="text-xs font-bold text-slate-700">{formatEGP(r.income)}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400">المصروفات</div>
                    <div className="text-xs font-bold text-rose-600">{formatEGP(r.manual_expense)}</div>
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
            {logs.map((l, i) => (
              <div key={i} className={["rounded-xl border px-3 py-2.5", l.is_day_off ? "bg-rose-50 border-rose-200" : "bg-white border-slate-200"].join(" ")}>
                <div className="flex items-center justify-between text-xs">
                  <div className="font-bold text-slate-700">{l.equipment_name}</div>
                  <div className="text-slate-400">{l.log_date.slice(-2)}</div>
                </div>
                {l.is_day_off ? (
                  <div className="text-xs font-bold text-rose-600 mt-1">مشتغلش</div>
                ) : (
                  <div className="flex items-center justify-between mt-1 text-xs text-slate-500">
                    <div>{l.person_name || "—"} — {l.actual_hours ?? l.base_hours ?? "—"} ساعة</div>
                    <div className="font-bold text-primary-dark">{formatEGP(l.day_value)}</div>
                  </div>
                )}
              </div>
            ))}
            {logs.length === 0 && <div className="text-sm text-slate-400 text-center py-6">مفيش سركي مسجل للشهر ده لسه.</div>}
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
