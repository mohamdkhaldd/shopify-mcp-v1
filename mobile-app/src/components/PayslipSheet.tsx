import { ReactNode, useState } from "react";
import { Driver, PaymentMethodLike } from "../types";
import {
  addPayrollEntry,
  addSalaryPayment,
  deletePayrollEntry,
  deleteSalaryPayment,
  listPayrollEntries,
  listSalaryPayments,
} from "../store";

const PAYMENT_METHODS: { value: PaymentMethodLike; label: string }[] = [
  { value: "cash", label: "كاش" },
  { value: "wallet", label: "اكسيس باي" },
  { value: "instapay", label: "انستا باي" },
  { value: "vodafone_cash", label: "فودفون كاش" },
];

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default function PayslipSheet({
  employee,
  month,
  onBack,
}: {
  employee: Driver;
  month: string;
  onBack: () => void;
}) {
  const [, forceRefresh] = useState(0);
  const refresh = () => forceRefresh((n) => n + 1);

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
          onDelete={(id) => { deleteSalaryPayment(id); refresh(); }}
          renderForm={(close) => (
            <SimpleForm
              buttonLabel="دفعت المرتب"
              needsMethod
              onSave={(v) => { addSalaryPayment({ employee_id: employee.id, month, date: v.date, amount: v.amount, payment_method: v.method!, note: v.note || null }); refresh(); close(); }}
            />
          )}
        />

        <PaymentSection
          title="السلف"
          accent="rose"
          entries={advances.map((a) => ({ id: a.id, date: a.date, amount: a.amount, extra: PAYMENT_METHODS.find((m) => m.value === a.payment_method)?.label, note: null }))}
          onDelete={(id) => { deletePayrollEntry(id); refresh(); }}
          renderForm={(close) => (
            <SimpleForm
              buttonLabel="إضافة سلفة"
              needsMethod
              onSave={(v) => { addPayrollEntry({ employee_id: employee.id, kind: "advance", month, date: v.date, amount: v.amount, payment_method: v.method!, reason: null }); refresh(); close(); }}
            />
          )}
        />

        <PaymentSection
          title="الحافز"
          accent="emerald"
          entries={bonuses.map((b) => ({ id: b.id, date: b.date, amount: b.amount, extra: PAYMENT_METHODS.find((m) => m.value === b.payment_method)?.label, note: null }))}
          onDelete={(id) => { deletePayrollEntry(id); refresh(); }}
          renderForm={(close) => (
            <SimpleForm
              buttonLabel="إضافة حافز"
              needsMethod
              onSave={(v) => { addPayrollEntry({ employee_id: employee.id, kind: "bonus", month, date: v.date, amount: v.amount, payment_method: v.method!, reason: null }); refresh(); close(); }}
            />
          )}
        />

        <PaymentSection
          title="الخصم"
          accent="rose"
          entries={deductions.map((d) => ({ id: d.id, date: d.date, amount: d.amount, extra: null, note: d.reason }))}
          onDelete={(id) => { deletePayrollEntry(id); refresh(); }}
          renderForm={(close) => (
            <SimpleForm
              buttonLabel="إضافة خصم"
              needsReason
              onSave={(v) => { addPayrollEntry({ employee_id: employee.id, kind: "deduction", month, date: v.date, amount: v.amount, payment_method: null, reason: v.reason || null }); refresh(); close(); }}
            />
          )}
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
  onDelete,
  renderForm,
}: {
  title: string;
  accent: "primary" | "rose" | "emerald";
  entries: EntryRow[];
  onDelete: (id: number) => void;
  renderForm: (close: () => void) => ReactNode;
}) {
  const [adding, setAdding] = useState(false);
  const accentText = accent === "primary" ? "text-primary-dark" : accent === "rose" ? "text-rose-600" : "text-emerald-600";

  return (
    <div className="bg-white rounded-2xl shadow-card p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-extrabold text-slate-700">{title}</div>
        <button onClick={() => setAdding((v) => !v)} className={["text-xs font-bold", accentText].join(" ")}>
          {adding ? "إلغاء" : "+ إضافة"}
        </button>
      </div>

      {entries.length === 0 && !adding && <div className="text-xs text-slate-400">لسه مفيش حاجة مسجلة الشهر ده.</div>}

      {entries.length > 0 && (
        <div className="space-y-1.5 mb-2">
          {entries.map((e) => (
            <div key={e.id} className="flex items-center justify-between text-xs bg-slate-50 rounded-lg px-2.5 py-2">
              <div className="text-slate-500">{e.date.slice(-2)}</div>
              <div className="flex-1 px-2 text-slate-600">
                {e.amount} ج.م {e.extra && <span className="text-slate-400">— {e.extra}</span>} {e.note && <span className="text-slate-400">({e.note})</span>}
              </div>
              <button onClick={() => onDelete(e.id)} className="text-rose-500 font-bold">
                مسح
              </button>
            </div>
          ))}
        </div>
      )}

      {adding && renderForm(() => setAdding(false))}
    </div>
  );
}

interface FormValue {
  date: string;
  amount: number;
  method?: PaymentMethodLike;
  reason?: string;
  note?: string;
}

function SimpleForm({
  buttonLabel,
  needsMethod,
  needsReason,
  onSave,
}: {
  buttonLabel: string;
  needsMethod?: boolean;
  needsReason?: boolean;
  onSave: (value: FormValue) => void;
}) {
  const [date, setDate] = useState(todayIso());
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethodLike>("cash");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");

  function submit() {
    if (!amount) return;
    if (needsReason && !reason.trim()) return;
    onSave({ date, amount: Number(amount) || 0, method: needsMethod ? method : undefined, reason: reason.trim(), note: note.trim() });
    setAmount("");
    setReason("");
    setNote("");
  }

  return (
    <div className="space-y-2 border-t border-slate-100 pt-3">
      <div>
        <label className="block text-[11px] text-slate-500 mb-1">التاريخ</label>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
      </div>
      <div>
        <label className="block text-[11px] text-slate-500 mb-1">المبلغ</label>
        <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
      </div>
      {needsMethod && (
        <div>
          <label className="block text-[11px] text-slate-500 mb-1">طريقة الصرف</label>
          <select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethodLike)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm">
            {PAYMENT_METHODS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
      )}
      {needsReason && (
        <div>
          <label className="block text-[11px] text-slate-500 mb-1">سبب الخصم</label>
          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="غياب يوم بدون إذن" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
        </div>
      )}
      {!needsReason && (
        <div>
          <label className="block text-[11px] text-slate-500 mb-1">ملاحظة (اختياري)</label>
          <input value={note} onChange={(e) => setNote(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
        </div>
      )}
      <button onClick={submit} disabled={!amount || (needsReason && !reason.trim())} className="w-full bg-primary text-white rounded-xl py-2.5 text-sm font-bold disabled:opacity-50">
        {buttonLabel}
      </button>
    </div>
  );
}
