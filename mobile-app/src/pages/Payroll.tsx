import { useState } from "react";
import MonthBar from "../components/MonthBar";
import PayslipSheet from "../components/PayslipSheet";
import { listEmployees, listPayrollEntries, listSalaryPayments } from "../store";
import { Driver } from "../types";

function employeeTaken(employeeId: number, month: string): number {
  const advances = listPayrollEntries(employeeId, month, "advance").reduce((s, a) => s + a.amount, 0);
  const bonuses = listPayrollEntries(employeeId, month, "bonus").reduce((s, a) => s + a.amount, 0);
  const deductions = listPayrollEntries(employeeId, month, "deduction").reduce((s, a) => s + a.amount, 0);
  const paid = listSalaryPayments(employeeId, month).reduce((s, a) => s + a.amount, 0);
  return advances + bonuses - deductions + paid;
}

export default function Payroll({ month, onChangeMonth }: { month: string; onChangeMonth: (m: string) => void }) {
  const [selected, setSelected] = useState<Driver | null>(null);
  const employees = listEmployees();

  if (selected) {
    return <PayslipSheet employee={selected} month={month} onBack={() => setSelected(null)} />;
  }

  return (
    <div>
      <div className="bg-primary text-white px-4 pt-6 pb-3">
        <div className="text-xs opacity-80 font-bold">دفتر البنيان</div>
        <div className="text-lg font-extrabold mt-0.5">المرتبات</div>
      </div>
      <MonthBar month={month} onChange={onChangeMonth} />

      <div className="p-4 space-y-2">
        {employees.map((e) => {
          const taken = employeeTaken(e.id, month);
          return (
            <button key={e.id} onClick={() => setSelected(e)} className="w-full bg-white rounded-2xl shadow-card p-3.5 flex items-center justify-between text-start">
              <div>
                <div className="text-sm font-bold text-slate-800">{e.name}</div>
                <div className="text-[11px] text-slate-400">{e.wage_type === "daily" ? "أجر يومي" : "مرتب شهري"}</div>
              </div>
              {taken > 0 && <div className="text-xs font-bold text-primary-dark">{taken} ج.م</div>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
