import { useEffect, useState } from "react";
import MonthBar from "../components/MonthBar";
import { supabase } from "../supabaseClient";
import { signOut } from "../auth";
import { currentMonthKey } from "../utils/months";

interface EquipmentCommissionRow {
  equipment_name: string;
  commission: number;
}

interface TreasuryBalance {
  balance: number;
  all_time_commission: number;
  all_time_spent: number;
  month_commission: number;
  month_spent: number;
}

function formatEGP(value: number): string {
  return `${Math.round(value).toLocaleString("ar-EG")} ج.م`;
}

export default function HassanSummary({ displayName }: { displayName: string }) {
  const [month, setMonth] = useState(currentMonthKey());
  const [rows, setRows] = useState<EquipmentCommissionRow[]>([]);
  const [balance, setBalance] = useState<TreasuryBalance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      supabase.rpc("get_hassan_commission_by_equipment", { p_month: month }),
      supabase.rpc("get_hassan_treasury_balance", { p_month: month }),
    ]).then(([commissionRes, balanceRes]) => {
      if (commissionRes.error) setError(commissionRes.error.message);
      else setRows((commissionRes.data as EquipmentCommissionRow[]) ?? []);
      if (!balanceRes.error && balanceRes.data && balanceRes.data[0]) setBalance(balanceRes.data[0] as TreasuryBalance);
      setLoading(false);
    });
  }, [month]);

  const total = rows.reduce((s, r) => s + r.commission, 0);
  const maxAbs = Math.max(1, ...rows.map((r) => Math.abs(r.commission)));

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

      <div className="px-4 pt-3">
        <div className="bg-white rounded-2xl shadow-card p-4">
          <div className="text-sm text-slate-500 font-semibold">رصيد خزنتك (كل الوقت)</div>
          <div className="mt-1 text-2xl font-extrabold text-primary">{formatEGP(balance?.balance ?? 0)}</div>
          <p className="text-[10px] text-slate-400 mt-1">بيزيد بكوميشنك كل شهر، وبيقل بس لما تدفع منه.</p>
        </div>

        <div className="grid grid-cols-2 gap-2.5 mt-3">
          <div className="bg-primary-light rounded-xl py-2.5 text-center">
            <div className="text-[11px] text-slate-500">كوميشن الشهر</div>
            <div className="font-bold text-slate-800">{formatEGP(balance?.month_commission ?? 0)}</div>
          </div>
          <div className="bg-rose-50 rounded-xl py-2.5 text-center">
            <div className="text-[11px] text-slate-500">دفعت الشهر</div>
            <div className="font-bold text-rose-600">{formatEGP(balance?.month_spent ?? 0)}</div>
          </div>
        </div>
      </div>

      <MonthBar month={month} onChange={setMonth} />

      <div className="p-4 space-y-3">
        <div className="bg-primary-light rounded-2xl p-4 text-center">
          <div className="text-xs text-slate-500 font-semibold">إجمالي كوميشنك الشهر ده</div>
          <div className="mt-1 text-xl font-extrabold text-primary-dark">{formatEGP(total)}</div>
        </div>

        {loading && <div className="text-sm text-slate-400 text-center py-6">جاري التحميل...</div>}
        {error && <div className="text-sm text-rose-600 text-center py-6">حصل خطأ: {error}</div>}

        {!loading && !error && (
          <div className="bg-white rounded-2xl shadow-card p-4">
            <div className="text-sm font-extrabold text-slate-700 mb-3">كوميشنك حسب المعدة</div>
            {rows.length === 0 ? (
              <div className="text-sm text-slate-400 text-center py-4">مفيش كوميشن محسوب الشهر ده.</div>
            ) : (
              <div className="space-y-2.5">
                {rows.map((r) => (
                  <div key={r.equipment_name}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-bold text-slate-700">{r.equipment_name}</span>
                      <span className={["font-bold", r.commission >= 0 ? "text-primary-dark" : "text-rose-600"].join(" ")}>
                        {formatEGP(r.commission)}
                      </span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={["h-full rounded-full", r.commission >= 0 ? "bg-primary" : "bg-rose-400"].join(" ")}
                        style={{ width: `${(Math.abs(r.commission) / maxAbs) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
