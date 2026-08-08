import { useEffect, useState } from "react";
import MonthBar from "../components/MonthBar";
import { supabase } from "../supabaseClient";
import { signOut } from "../auth";
import { currentMonthKey } from "../utils/months";

interface Row {
  equipment_name: string;
  percentage: number;
  income: number;
  manual_expense: number;
  net_profit: number;
  partner_share: number;
}

function formatEGP(value: number): string {
  return `${Math.round(value).toLocaleString("ar-EG")} ج.م`;
}

export default function PartnerSummary({ displayName }: { displayName: string }) {
  const [month, setMonth] = useState(currentMonthKey());
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    supabase
      .rpc("get_partner_summary", { p_month: month })
      .then(({ data, error }) => {
        if (error) setError(error.message);
        else setRows((data as Row[]) ?? []);
        setLoading(false);
      });
  }, [month]);

  const total = rows.reduce((s, r) => s + r.partner_share, 0);

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

      <MonthBar month={month} onChange={setMonth} />

      <div className="p-4 space-y-3">
        <div className="bg-primary-light rounded-2xl p-4 text-center">
          <div className="text-xs text-slate-500 font-semibold">إجمالي نصيبك الشهر ده</div>
          <div className="mt-1 text-xl font-extrabold text-primary-dark">{formatEGP(total)}</div>
        </div>

        {loading && <div className="text-sm text-slate-400 text-center py-6">جاري التحميل...</div>}
        {error && <div className="text-sm text-rose-600 text-center py-6">حصل خطأ: {error}</div>}

        {!loading &&
          !error &&
          rows.map((r) => (
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

        {!loading && !error && rows.length === 0 && (
          <div className="text-sm text-slate-400 text-center py-6">مفيش أرقام مسجلة للشهر ده لسه.</div>
        )}
      </div>
    </div>
  );
}
