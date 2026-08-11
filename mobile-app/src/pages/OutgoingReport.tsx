import MonthBar from "../components/MonthBar";
import { listAllMonthlyExpenses, listAllPayrollEntries, listAllSalaryPayments, listWasteEntries } from "../store";

function formatEGP(value: number): string {
  return `${Math.round(value).toLocaleString("ar-EG")} ج.م`;
}

const PAYMENT_METHODS = [
  { value: "cash", label: "كاش" },
  { value: "wallet", label: "اكسيس باي" },
  { value: "instapay", label: "انستا باي" },
  { value: "vodafone_cash", label: "فودفون كاش" },
];

function paymentMethodLabel(v: string | null) {
  return PAYMENT_METHODS.find((m) => m.value === v)?.label ?? v ?? "—";
}

function kindLabel(kind: string) {
  return kind === "advance" ? "سلفة" : kind === "bonus" ? "مكافأة" : "خصم";
}

function Section({ title, total, children }: { title: string; total: number; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl shadow-card p-4">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-extrabold text-slate-700">{title}</h2>
        <span className="text-sm font-bold text-primary-dark">{formatEGP(total)}</span>
      </div>
      {children}
    </div>
  );
}

export default function OutgoingReport({ month, onChangeMonth, onBack }: { month: string; onChangeMonth: (m: string) => void; onBack: () => void }) {
  const expenses = listAllMonthlyExpenses(month);
  const payroll = listAllPayrollEntries(month);
  const salaryPayments = listAllSalaryPayments(month);
  const waste = listWasteEntries(month);

  const expensesTotal = expenses.reduce((s, e) => s + e.amount, 0);
  const payrollTotal = payroll.reduce((s, e) => s + (e.kind === "deduction" ? -e.amount : e.amount), 0) + salaryPayments.reduce((s, p) => s + p.amount, 0);
  const wasteTotal = waste.reduce((s, e) => s + e.amount, 0);
  const totalOutgoing = expensesTotal + payrollTotal + wasteTotal;

  return (
    <div>
      <div className="bg-primary text-white px-4 pt-6 pb-3 flex items-center gap-2">
        <button onClick={onBack} className="text-white/80 text-lg">
          ‹
        </button>
        <div>
          <div className="text-xs opacity-80 font-bold">دفتر البنيان</div>
          <div className="text-lg font-extrabold mt-0.5">الصادر</div>
        </div>
      </div>
      <MonthBar month={month} onChange={onChangeMonth} />

      <div className="p-4 space-y-3">
        <div className="bg-white rounded-2xl shadow-card p-4">
          <div className="text-sm text-slate-500 font-semibold">إجمالي الصادر — الشهر ده</div>
          <div className="mt-1 text-2xl font-extrabold text-rose-600">{formatEGP(totalOutgoing)}</div>
          <p className="text-[10px] text-slate-400 mt-1">مصروفات المعدات، السلف والمكافآت والخصومات ودفعات المرتبات، والهالك. (دفعات الشركاء والموردين والمقاولين بتتسجل من اللاب.)</p>
        </div>

        <Section title="مصروفات المعدات" total={expensesTotal}>
          {expenses.length === 0 ? (
            <div className="text-xs text-slate-400">لسه مفيش مصروفات مسجلة الشهر ده.</div>
          ) : (
            <div className="space-y-1.5">
              {expenses.map((e) => (
                <div key={e.id} className="flex items-center justify-between text-xs text-slate-600">
                  <span>
                    {e.date ?? "—"} — {e.equipment_name} — {e.category_name}
                  </span>
                  <span className="font-bold text-slate-700 shrink-0 ms-2">{formatEGP(e.amount)}</span>
                </div>
              ))}
            </div>
          )}
        </Section>

        <Section title="الرواتب (سلف ومكافآت وخصومات ودفعات مرتبات)" total={payrollTotal}>
          {payroll.length === 0 && salaryPayments.length === 0 ? (
            <div className="text-xs text-slate-400">لسه مفيش سلف ولا مكافآت ولا دفعات مرتبات مسجلة الشهر ده.</div>
          ) : (
            <div className="space-y-1.5">
              {payroll.map((p) => (
                <div key={`p-${p.id}`} className="flex items-center justify-between text-xs text-slate-600">
                  <span>
                    {p.date} — {p.employee_name} — {kindLabel(p.kind)}
                  </span>
                  <span className={["font-bold shrink-0 ms-2", p.kind === "deduction" ? "text-primary-dark" : "text-slate-700"].join(" ")}>
                    {p.kind === "deduction" ? "-" : ""}
                    {formatEGP(p.amount)}
                  </span>
                </div>
              ))}
              {salaryPayments.map((p) => (
                <div key={`s-${p.id}`} className="flex items-center justify-between text-xs text-slate-600">
                  <span>
                    {p.date} — {p.employee_name} — دفعة مرتب ({paymentMethodLabel(p.payment_method)})
                  </span>
                  <span className="font-bold text-slate-700 shrink-0 ms-2">{formatEGP(p.amount)}</span>
                </div>
              ))}
            </div>
          )}
        </Section>

        <Section title="الهالك" total={wasteTotal}>
          {waste.length === 0 ? (
            <div className="text-xs text-slate-400">لسه مفيش هالك مسجل الشهر ده.</div>
          ) : (
            <div className="space-y-1.5">
              {waste.map((w) => (
                <div key={w.id} className="flex items-center justify-between text-xs text-slate-600">
                  <span>
                    {w.date} — {paymentMethodLabel(w.payment_method)} {w.note && `— ${w.note}`}
                  </span>
                  <span className="font-bold text-slate-700 shrink-0 ms-2">{formatEGP(w.amount)}</span>
                </div>
              ))}
            </div>
          )}
        </Section>
      </div>
    </div>
  );
}
