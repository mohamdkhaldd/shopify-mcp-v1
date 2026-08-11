import { useState } from "react";
import MonthBar from "../components/MonthBar";
import {
  listAllContractorPayments,
  listAllMonthlyExpenses,
  listAllPartnerPayments,
  listAllPayrollEntries,
  listAllSalaryPayments,
  listAllSupplierPayments,
  listWasteEntries,
} from "../store";

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

function OutgoingView({ month }: { month: string }) {
  const expenses = listAllMonthlyExpenses(month);
  const partnerPayments = listAllPartnerPayments(month);
  const supplierPayments = listAllSupplierPayments(month);
  const payroll = listAllPayrollEntries(month);
  const salaryPayments = listAllSalaryPayments(month);
  const waste = listWasteEntries(month);

  const expensesTotal = expenses.reduce((s, e) => s + e.amount, 0);
  const partnerPaymentsTotal = partnerPayments.reduce((s, p) => s + p.amount, 0);
  const supplierPaymentsTotal = supplierPayments.reduce((s, p) => s + p.amount, 0);
  const payrollTotal = payroll.reduce((s, e) => s + (e.kind === "deduction" ? -e.amount : e.amount), 0) + salaryPayments.reduce((s, p) => s + p.amount, 0);
  const wasteTotal = waste.reduce((s, e) => s + e.amount, 0);
  const totalOutgoing = expensesTotal + partnerPaymentsTotal + supplierPaymentsTotal + payrollTotal + wasteTotal;

  return (
    <div className="space-y-3">
      <div className="bg-white rounded-2xl shadow-card p-4">
        <div className="text-sm text-slate-500 font-semibold">إجمالي الصادر — الشهر ده</div>
        <div className="mt-1 text-2xl font-extrabold text-rose-600">{formatEGP(totalOutgoing)}</div>
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

      <Section title="دفعات للشركاء" total={partnerPaymentsTotal}>
        {partnerPayments.length === 0 ? (
          <div className="text-xs text-slate-400">لسه مفيش دفعات شركاء الشهر ده.</div>
        ) : (
          <div className="space-y-1.5">
            {partnerPayments.map((p) => (
              <div key={p.id} className="flex items-center justify-between text-xs text-slate-600">
                <span>
                  {p.date} — {p.partner_name} — {paymentMethodLabel(p.method)}
                </span>
                <span className="font-bold text-slate-700 shrink-0 ms-2">{formatEGP(p.amount)}</span>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title="دفعات للموردين" total={supplierPaymentsTotal}>
        {supplierPayments.length === 0 ? (
          <div className="text-xs text-slate-400">لسه مفيش دفعات موردين الشهر ده.</div>
        ) : (
          <div className="space-y-1.5">
            {supplierPayments.map((p) => (
              <div key={p.id} className="flex items-center justify-between text-xs text-slate-600">
                <span>
                  {p.date} — {p.supplier_name} — {paymentMethodLabel(p.method)}
                </span>
                <span className="font-bold text-slate-700 shrink-0 ms-2">{formatEGP(p.amount)}</span>
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
  );
}

function IncomingView({ month }: { month: string }) {
  const contractorPayments = listAllContractorPayments(month);
  const totalIncoming = contractorPayments.reduce((s, p) => s + p.amount, 0);

  return (
    <div className="space-y-3">
      <div className="bg-white rounded-2xl shadow-card p-4">
        <div className="text-sm text-slate-500 font-semibold">إجمالي الوارد — الشهر ده</div>
        <div className="mt-1 text-2xl font-extrabold text-primary">{formatEGP(totalIncoming)}</div>
      </div>

      <Section title="دفعات من المقاولين" total={totalIncoming}>
        {contractorPayments.length === 0 ? (
          <div className="text-xs text-slate-400">لسه مفيش دفعات مستلمة من مقاولين الشهر ده.</div>
        ) : (
          <div className="space-y-1.5">
            {contractorPayments.map((p) => (
              <div key={p.id} className="flex items-center justify-between text-xs text-slate-600">
                <span>
                  {p.date} — {p.contractor_name} — {paymentMethodLabel(p.method)}
                </span>
                <span className="font-bold text-slate-700 shrink-0 ms-2">{formatEGP(p.amount)}</span>
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

export default function OutgoingReport({ month, onChangeMonth, onBack }: { month: string; onChangeMonth: (m: string) => void; onBack: () => void }) {
  const [tab, setTab] = useState<"outgoing" | "incoming">("outgoing");

  return (
    <div>
      <div className="bg-primary text-white px-4 pt-6 pb-3 flex items-center gap-2">
        <button onClick={onBack} className="text-white/80 text-lg">
          ‹
        </button>
        <div>
          <div className="text-xs opacity-80 font-bold">دفتر البنيان</div>
          <div className="text-lg font-extrabold mt-0.5">الصادر والوارد</div>
        </div>
      </div>
      <MonthBar month={month} onChange={onChangeMonth} />

      <div className="px-4 pt-3 flex gap-2">
        <button
          onClick={() => setTab("outgoing")}
          className={["flex-1 rounded-xl py-2 text-sm font-bold", tab === "outgoing" ? "bg-primary text-white" : "bg-white text-slate-500 shadow-card"].join(" ")}
        >
          الصادر
        </button>
        <button
          onClick={() => setTab("incoming")}
          className={["flex-1 rounded-xl py-2 text-sm font-bold", tab === "incoming" ? "bg-primary text-white" : "bg-white text-slate-500 shadow-card"].join(" ")}
        >
          الوارد
        </button>
      </div>

      <div className="p-4">{tab === "outgoing" ? <OutgoingView month={month} /> : <IncomingView month={month} />}</div>
    </div>
  );
}
