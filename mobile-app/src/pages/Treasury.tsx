import { useState } from "react";
import MonthBar from "../components/MonthBar";
import {
  listAllContractorPayments,
  listAllMonthlyExpenses,
  listAllPartnerPayments,
  listAllPayrollEntries,
  listAllSalaryPayments,
  listAllSupplierPayments,
  listTreasuryAccounts,
  updateTreasuryAccountBalance,
} from "../store";
import { TreasuryAccountName } from "../types";

function formatEGP(value: number): string {
  return `${Math.round(value).toLocaleString("ar-EG")} ج.م`;
}

const ACCOUNT_NAME_AR: Record<TreasuryAccountName, string> = {
  cash: "كاش",
  wallet: "اكسيس باي",
  instapay: "انستا باي",
  vodafone_cash: "فودفون كاش",
};

function sumByMethod<T extends { amount: number }>(rows: T[], methodOf: (r: T) => string | null): Record<string, number> {
  const result: Record<string, number> = {};
  for (const r of rows) {
    const key = methodOf(r) ?? "cash";
    result[key] = (result[key] ?? 0) + r.amount;
  }
  return result;
}

export default function Treasury({ month, onChangeMonth, onBack }: { month: string; onChangeMonth: (m: string) => void; onBack: () => void }) {
  const [version, setVersion] = useState(0);
  const [editingName, setEditingName] = useState<TreasuryAccountName | null>(null);
  const [editValue, setEditValue] = useState("");

  const accounts = listTreasuryAccounts();

  const incoming = sumByMethod(listAllContractorPayments(month), (p) => p.method);
  const outPartners = sumByMethod(listAllPartnerPayments(month), (p) => p.method);
  const outExpenses = sumByMethod(listAllMonthlyExpenses(month), (e) => e.payment_method);
  const outSuppliers = sumByMethod(listAllSupplierPayments(month), (p) => p.method);
  const outAdvancesBonuses = sumByMethod(listAllPayrollEntries(month).filter((e) => e.kind !== "deduction"), (e) => e.payment_method);
  const outSalaryPayments = sumByMethod(listAllSalaryPayments(month), (p) => p.payment_method);

  function saveBalance(name: TreasuryAccountName) {
    updateTreasuryAccountBalance(name, Number(editValue) || 0);
    setEditingName(null);
    setVersion((v) => v + 1);
  }

  const totalProjected = accounts.reduce((sum, acc) => {
    const monthIncoming = incoming[acc.name] ?? 0;
    const monthOutgoing =
      (outPartners[acc.name] ?? 0) + (outExpenses[acc.name] ?? 0) + (outSuppliers[acc.name] ?? 0) + (outAdvancesBonuses[acc.name] ?? 0) + (outSalaryPayments[acc.name] ?? 0);
    return sum + acc.balance + (monthIncoming - monthOutgoing);
  }, 0);

  return (
    <div key={version}>
      <div className="bg-primary text-white px-4 pt-6 pb-3 flex items-center gap-2">
        <button onClick={onBack} className="text-white/80 text-lg">
          ‹
        </button>
        <div>
          <div className="text-xs opacity-80 font-bold">دفتر البنيان</div>
          <div className="text-lg font-extrabold mt-0.5">الخزنة</div>
        </div>
      </div>
      <MonthBar month={month} onChange={onChangeMonth} />

      <div className="p-4 space-y-3">
        <div className="bg-white rounded-2xl shadow-card p-4">
          <div className="text-sm text-slate-500 font-semibold">إجمالي الرصيد المتوقع في كل الحسابات</div>
          <div className="mt-1 text-2xl font-extrabold text-primary">{formatEGP(totalProjected)}</div>
          <p className="text-[10px] text-slate-400 mt-1">
            الرصيد الحالي بتحطه إنت يدوي لكل حساب — دا رقم خاص بكل جهاز، مش بيتزامن (زي اللاب بالظبط). الوارد والصادر بيتحسبوا لوحدهم من البيانات المسجلة.
          </p>
        </div>

        {accounts.map((acc) => {
          const monthIncoming = incoming[acc.name] ?? 0;
          const monthOutgoing =
            (outPartners[acc.name] ?? 0) + (outExpenses[acc.name] ?? 0) + (outSuppliers[acc.name] ?? 0) + (outAdvancesBonuses[acc.name] ?? 0) + (outSalaryPayments[acc.name] ?? 0);
          const projected = acc.balance + (monthIncoming - monthOutgoing);
          return (
            <div key={acc.name} className="bg-white rounded-2xl shadow-card p-4">
              <div className="text-sm font-bold text-slate-800 mb-2">{ACCOUNT_NAME_AR[acc.name]}</div>
              <div className="mb-3">
                <div className="text-[11px] text-slate-400 mb-1">الرصيد الحالي (يدوي)</div>
                {editingName === acc.name ? (
                  <div className="flex gap-1.5">
                    <input
                      type="number"
                      inputMode="decimal"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      autoFocus
                      className="flex-1 rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                    />
                    <button onClick={() => saveBalance(acc.name)} className="bg-primary text-white rounded-lg px-3 py-1.5 text-xs font-bold">
                      حفظ
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      setEditingName(acc.name);
                      setEditValue(String(acc.balance));
                    }}
                    className="text-lg font-extrabold text-slate-900"
                  >
                    {formatEGP(acc.balance)}
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs border-t border-slate-100 pt-3">
                <div>
                  <div className="text-slate-400">وارد الشهر</div>
                  <div className="font-semibold text-primary">{formatEGP(monthIncoming)}</div>
                </div>
                <div>
                  <div className="text-slate-400">صادر الشهر</div>
                  <div className="font-semibold text-rose-600">{formatEGP(monthOutgoing)}</div>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-slate-100">
                <div className="text-[11px] text-slate-400">الرصيد المتوقع</div>
                <div className={["text-lg font-extrabold", projected >= 0 ? "text-slate-900" : "text-rose-600"].join(" ")}>{formatEGP(projected)}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
