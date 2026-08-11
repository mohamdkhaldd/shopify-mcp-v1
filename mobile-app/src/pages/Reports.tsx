import MonthBar from "../components/MonthBar";
import { listAllPayrollEntries, listAllSalaryPayments, listEquipment, listTreasuryAccounts } from "../store";
import { computeEquipmentSummary } from "../utils/profit";

function formatEGP(value: number): string {
  return `${Math.round(value).toLocaleString("ar-EG")} ج.م`;
}

const ACCOUNT_NAME_AR: Record<string, string> = {
  cash: "كاش",
  wallet: "اكسيس باي",
  instapay: "انستا باي",
  vodafone_cash: "فودفون كاش",
};

export default function Reports({ month, onChangeMonth, onBack }: { month: string; onChangeMonth: (m: string) => void; onBack: () => void }) {
  const equipment = listEquipment();
  const rows = equipment.map((eq) => {
    const s = computeEquipmentSummary(eq, month);
    return { equipment_name: eq.name, income: s.income, expense: s.expenseTotal, netProfit: s.netProfit };
  });

  const totalIncome = rows.reduce((sum, r) => sum + r.income, 0);
  const totalExpense = rows.reduce((sum, r) => sum + r.expense, 0);
  const netProfit = totalIncome - totalExpense;

  const payrollTotal =
    listAllPayrollEntries(month).reduce((sum, e) => sum + (e.kind === "deduction" ? -e.amount : e.amount), 0) +
    listAllSalaryPayments(month).reduce((sum, p) => sum + p.amount, 0);

  const treasuryBalances = listTreasuryAccounts();

  return (
    <div>
      <div className="bg-primary text-white px-4 pt-6 pb-3 flex items-center gap-2">
        <button onClick={onBack} className="text-white/80 text-lg">
          ‹
        </button>
        <div>
          <div className="text-xs opacity-80 font-bold">دفتر البنيان</div>
          <div className="text-lg font-extrabold mt-0.5">التقارير</div>
        </div>
      </div>
      <MonthBar month={month} onChange={onChangeMonth} />

      <div className="p-4 space-y-3">
        <div className="grid grid-cols-2 gap-2.5">
          <div className="bg-white rounded-2xl shadow-card p-3.5">
            <div className="text-[11px] text-slate-500">إجمالي الدخل</div>
            <div className="mt-1 font-extrabold text-slate-900">{formatEGP(totalIncome)}</div>
          </div>
          <div className="bg-white rounded-2xl shadow-card p-3.5">
            <div className="text-[11px] text-slate-500">إجمالي المصروفات</div>
            <div className="mt-1 font-extrabold text-rose-600">{formatEGP(totalExpense)}</div>
          </div>
          <div className="bg-white rounded-2xl shadow-card p-3.5">
            <div className="text-[11px] text-slate-500">صافي الربح</div>
            <div className={["mt-1 font-extrabold", netProfit >= 0 ? "text-primary" : "text-rose-600"].join(" ")}>{formatEGP(netProfit)}</div>
          </div>
          <div className="bg-white rounded-2xl shadow-card p-3.5">
            <div className="text-[11px] text-slate-500">إجمالي صافي الرواتب</div>
            <div className="mt-1 font-extrabold text-slate-900">{formatEGP(payrollTotal)}</div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-card p-4">
          <div className="text-sm font-extrabold text-slate-700 mb-3">الربح والمصروف لكل معدة</div>
          {rows.length === 0 ? (
            <div className="text-xs text-slate-400">لسه مفيش معدات.</div>
          ) : (
            <div className="space-y-2">
              {rows.map((r) => (
                <div key={r.equipment_name} className="flex items-center justify-between text-xs border-b border-slate-50 last:border-0 pb-2 last:pb-0">
                  <span className="font-semibold text-slate-700">{r.equipment_name}</span>
                  <span className={["font-bold", r.netProfit >= 0 ? "text-primary-dark" : "text-rose-600"].join(" ")}>{formatEGP(r.netProfit)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl shadow-card p-4">
          <div className="text-sm font-extrabold text-slate-700 mb-2">أرصدة الخزنة الحالية</div>
          <div className="space-y-1.5">
            {treasuryBalances.map((t) => (
              <div key={t.name} className="flex items-center justify-between text-sm">
                <span className="text-slate-600">{ACCOUNT_NAME_AR[t.name] ?? t.name}</span>
                <span className="font-semibold text-slate-800">{formatEGP(t.balance)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
