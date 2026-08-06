import { useState } from "react";
import MonthBar from "../components/MonthBar";
import { addPayrollEntry, deletePayrollEntry, listEmployees, listPayrollEntries } from "../store";
import { PayrollKind } from "../types";

const KINDS: { id: PayrollKind; label: string; icon: string }[] = [
  { id: "advance", label: "سلفة", icon: "💵" },
  { id: "bonus", label: "حافز", icon: "⭐" },
  { id: "deduction", label: "خصم", icon: "✂️" },
];

const PAYMENT_METHODS = [
  { value: "cash", label: "كاش" },
  { value: "wallet", label: "اكسيس باي" },
  { value: "instapay", label: "انستا باي" },
  { value: "vodafone_cash", label: "فودفون كاش" },
];

export default function Payroll({ month, onChangeMonth }: { month: string; onChangeMonth: (m: string) => void }) {
  const [kind, setKind] = useState<PayrollKind>("advance");
  const employees = listEmployees();
  const [employeeId, setEmployeeId] = useState(employees[0]?.id ?? "");
  const [date, setDate] = useState(`${month}-01`);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");
  const [reason, setReason] = useState("");
  const [, forceRefresh] = useState(0);

  const entries = listPayrollEntries(month);

  function save() {
    if (!employeeId || !amount) return;
    addPayrollEntry({
      employee_id: Number(employeeId),
      kind,
      month,
      date,
      amount: Number(amount) || 0,
      payment_method: kind === "deduction" ? null : method,
      reason: kind === "deduction" ? reason.trim() || null : null,
    });
    setAmount("");
    setReason("");
    forceRefresh((n) => n + 1);
  }

  function remove(id: number) {
    deletePayrollEntry(id);
    forceRefresh((n) => n + 1);
  }

  function employeeName(id: number) {
    return employees.find((e) => e.id === id)?.name ?? "—";
  }

  return (
    <div>
      <div className="bg-primary text-white px-4 pt-6 pb-3">
        <div className="text-xs opacity-80 font-bold">دفتر البنيان</div>
        <div className="text-lg font-extrabold mt-0.5">المرتبات</div>
      </div>
      <MonthBar month={month} onChange={onChangeMonth} />

      <div className="p-4 space-y-3">
        <div className="grid grid-cols-3 gap-2">
          {KINDS.map((k) => (
            <button
              key={k.id}
              onClick={() => setKind(k.id)}
              className={[
                "rounded-xl border py-2.5 text-center text-xs font-bold",
                kind === k.id ? "border-primary bg-primary-light text-primary-dark" : "border-slate-200 bg-white text-slate-500",
              ].join(" ")}
            >
              <div className="text-base mb-0.5">{k.icon}</div>
              {k.label}
            </button>
          ))}
        </div>

        <div className="bg-white rounded-2xl shadow-card p-4 space-y-2">
          <div>
            <label className="block text-[11px] text-slate-500 mb-1">الموظف</label>
            <select value={employeeId} onChange={(e) => setEmployeeId(Number(e.target.value))} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm">
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] text-slate-500 mb-1">التاريخ</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-[11px] text-slate-500 mb-1">المبلغ</label>
            <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
          </div>
          {kind === "deduction" ? (
            <div>
              <label className="block text-[11px] text-slate-500 mb-1">السبب</label>
              <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="غياب يوم بدون إذن" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
            </div>
          ) : (
            <div>
              <label className="block text-[11px] text-slate-500 mb-1">طريقة الصرف</label>
              <select value={method} onChange={(e) => setMethod(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm">
                {PAYMENT_METHODS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
          )}
          <button
            onClick={save}
            disabled={!employeeId || !amount}
            className={["w-full rounded-xl py-2.5 text-sm font-bold disabled:opacity-50", kind === "deduction" ? "border border-rose-300 text-rose-600" : "bg-primary text-white"].join(" ")}
          >
            حفظ {KINDS.find((k) => k.id === kind)!.label}
          </button>
        </div>

        <div className="space-y-2">
          {entries.map((e) => (
            <div key={e.id} className="bg-white rounded-xl border border-slate-200 px-3 py-2 flex items-center justify-between text-sm">
              <div className="text-slate-500">{e.date.slice(-2)}</div>
              <div className="font-bold flex-1 px-2">
                {KINDS.find((k) => k.id === e.kind)!.label} — {employeeName(e.employee_id)}
              </div>
              <div className="font-bold text-primary-dark">{e.amount} ج.م</div>
              <button onClick={() => remove(e.id)} className="text-rose-500 text-xs font-bold ms-2">
                مسح
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
