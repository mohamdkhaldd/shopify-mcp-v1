import { Driver, PaymentMethodLike } from "../types";
import { listPayrollEntries, listSalaryPayments } from "../store";

const PAYMENT_METHODS: { value: PaymentMethodLike; label: string }[] = [
  { value: "cash", label: "كاش" },
  { value: "wallet", label: "اكسيس باي" },
  { value: "instapay", label: "انستا باي" },
  { value: "vodafone_cash", label: "فودفون كاش" },
];

export default function PayslipSheet({
  employee,
  month,
  onBack,
}: {
  employee: Driver;
  month: string;
  onBack: () => void;
}) {
  const advances = listPayrollEntries(employee.id, month, "advance");
  const bonuses = listPayrollEntries(employee.id, month, "bonus");
  const deductions = listPayrollEntries(employee.id, month, "deduction");
  const payments = listSalaryPayments(employee.id, month);

  const advancesTotal = advances.reduce((s, a) => s + a.amount, 0);
  const bonusesTotal = bonuses.reduce((s, a) => s + a.amount, 0);
  const deductionsTotal = deductions.reduce((s, a) => s + a.amount, 0);
  const paidTotal = payments.reduce((s, a) => s + a.amount, 0);

  return (
    <div>
      <div className="bg-primary text-white px-4 pt-6 pb-4 flex items-center gap-3">
        <button onClick={onBack} className="w-7 h-7 rounded-full bg-white/15 flex items-center justify-center text-sm">
          ←
        </button>
        <div>
          <div className="text-xs opacity-80 font-bold">شيت المرتب</div>
          <div className="text-lg font-extrabold mt-0.5">{employee.name}</div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-rose-50 rounded-xl py-3 text-center">
            <div className="text-[11px] text-slate-500">السلف</div>
            <div className="font-bold text-rose-600">{advancesTotal} ج.م</div>
          </div>
          <div className="bg-emerald-50 rounded-xl py-3 text-center">
            <div className="text-[11px] text-slate-500">الحافز</div>
            <div className="font-bold text-emerald-600">{bonusesTotal} ج.م</div>
          </div>
          <div className="bg-rose-50 rounded-xl py-3 text-center">
            <div className="text-[11px] text-slate-500">الخصم</div>
            <div className="font-bold text-rose-600">{deductionsTotal} ج.م</div>
          </div>
          <div className="bg-primary-light rounded-xl py-3 text-center">
            <div className="text-[11px] text-slate-500">اتدفع من الصافي</div>
            <div className="font-bold text-primary-dark">{paidTotal} ج.م</div>
          </div>
        </div>

        <PaymentSection
          title="دفع المرتب"
          accent="primary"
          entries={payments.map((p) => ({ id: p.id, date: p.date, amount: p.amount, extra: PAYMENT_METHODS.find((m) => m.value === p.payment_method)?.label, note: p.note }))}
        />
        <PaymentSection
          title="السلف"
          accent="rose"
          entries={advances.map((a) => ({ id: a.id, date: a.date, amount: a.amount, extra: PAYMENT_METHODS.find((m) => m.value === a.payment_method)?.label, note: null }))}
        />
        <PaymentSection
          title="الحافز"
          accent="emerald"
          entries={bonuses.map((b) => ({ id: b.id, date: b.date, amount: b.amount, extra: PAYMENT_METHODS.find((m) => m.value === b.payment_method)?.label, note: null }))}
        />
        <PaymentSection
          title="الخصم"
          accent="rose"
          entries={deductions.map((d) => ({ id: d.id, date: d.date, amount: d.amount, extra: null, note: d.reason }))}
        />
      </div>
    </div>
  );
}

interface EntryRow {
  id: number;
  date: string;
  amount: number;
  extra?: string | null;
  note?: string | null;
}

function PaymentSection({
  title,
  accent,
  entries,
}: {
  title: string;
  accent: "primary" | "rose" | "emerald";
  entries: EntryRow[];
}) {
  const accentText = accent === "primary" ? "text-primary-dark" : accent === "rose" ? "text-rose-600" : "text-emerald-600";

  return (
    <div className="bg-white rounded-2xl shadow-card p-4">
      <div className="text-sm font-extrabold text-slate-700 mb-2">{title}</div>

      {entries.length === 0 ? (
        <div className="text-xs text-slate-400">لسه مفيش حاجة مسجلة الشهر ده.</div>
      ) : (
        <div className="space-y-1.5">
          {entries.map((e) => (
            <div key={e.id} className="flex items-center justify-between text-xs bg-slate-50 rounded-lg px-2.5 py-2">
              <div className="text-slate-500">{e.date.slice(-2)}</div>
              <div className={["flex-1 px-2", accentText].join(" ")}>
                {e.amount} ج.م {e.extra && <span className="text-slate-400">— {e.extra}</span>} {e.note && <span className="text-slate-400">({e.note})</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
