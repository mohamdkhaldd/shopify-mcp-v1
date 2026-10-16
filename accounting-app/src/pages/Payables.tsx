import { FormEvent, useEffect, useState } from "react";
import Modal from "../components/Modal";
import MonthPicker from "../components/equipment/MonthPicker";
import PrintButton from "../components/PrintButton";
import { PrintHeader } from "../components/PrintSignoff";
import { payablesApi } from "../api/client";
import { PayableExpense, PayablesSummary } from "../api/types";
import { currentMonthKey, monthLabel } from "../utils/months";
import { formatEGP } from "../utils/format";
import { PAYMENT_METHODS, paymentMethodLabel } from "../utils/paymentMethods";

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function SummaryBox({ label, value, tone, onClick }: { label: string; value: number; tone?: "rose"; onClick?: () => void }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      onClick={onClick}
      className={[
        "bg-white rounded-card shadow-card p-5 text-start",
        onClick ? "hover:ring-2 hover:ring-primary/30 transition-shadow" : "",
      ].join(" ")}
    >
      <div className="text-sm text-slate-500 font-semibold">{label}</div>
      <div className={`mt-2 text-2xl font-extrabold ${tone === "rose" ? "text-rose-600" : "text-slate-800"}`}>{formatEGP(value)}</div>
      {onClick && <div className="no-print text-[11px] text-primary font-semibold mt-1">دوس للتفاصيل</div>}
    </Tag>
  );
}

// دفع جزء (أو كل) الباقي من مصروف آجل — بيخرج من الخزنة بتاريخ النهارده
// (أو اللي تختاره)، ومصروف المعدة نفسه مبيتغيرش.
function PayModal({ expense, onClose, onDone }: { expense: PayableExpense; onClose: () => void; onDone: () => void }) {
  const [amount, setAmount] = useState(String(expense.remaining));
  const [method, setMethod] = useState("cash");
  const [date, setDate] = useState(todayISO());
  const [note, setNote] = useState("");

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!amount || Number(amount) <= 0) return;
    await payablesApi.pay({ expense_id: expense.id, date, amount: Number(amount), method, note: note || null });
    onDone();
  }

  const tooMuch = Number(amount) > expense.remaining + 0.005;

  return (
    <Modal title={`دفع آجل — ${expense.category_name ?? "مصروف"} ${expense.equipment_name}`} onClose={onClose}>
      <form onSubmit={save} className="space-y-3 text-sm">
        <div className="bg-slate-50 rounded-xl p-3">
          القيمة {formatEGP(expense.amount)} — اتدفع {formatEGP(expense.paid)} —{" "}
          <span className="font-bold text-rose-600">الباقي {formatEGP(expense.remaining)}</span>
          {expense.payee ? ` — لـ ${expense.payee}` : ""}
        </div>
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs text-slate-400 mb-1">دفعت كام</label>
            <input
              type="number"
              min="0"
              step="any"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-32 rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">طريقة الدفع</label>
            <select value={method} onChange={(e) => setMethod(e.target.value)} className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm">
              {PAYMENT_METHODS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">التاريخ</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm" />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">ملاحظة</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="اختياري"
              className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
            />
          </div>
        </div>
        {tooMuch && <div className="text-xs text-rose-600">المبلغ أكبر من الباقي.</div>}
        <button
          type="submit"
          disabled={!amount || Number(amount) <= 0 || tooMuch}
          className="bg-primary text-white rounded-lg px-4 py-1.5 font-semibold disabled:opacity-50"
        >
          تسجيل الدفعة
        </button>
      </form>
    </Modal>
  );
}

// نصيب الشريك بالسالب معناه إن المعدة خسرانة في الفترة دي — مش دين علينا.
function PartnerDue({ value }: { value: number }) {
  if (value >= -0.005) return <>{formatEGP(Math.max(0, value))}</>;
  return <span className="text-slate-400 font-normal">0 (خسارة {formatEGP(-value)})</span>;
}

export default function Payables({ onGoToSuppliers }: { onGoToSuppliers: () => void }) {
  const [month, setMonth] = useState(currentMonthKey());
  const [data, setData] = useState<PayablesSummary | null>(null);
  const [paying, setPaying] = useState<PayableExpense | null>(null);

  const refresh = () => payablesApi.summary(month).then(setData);

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

  async function removePayment(id: number) {
    if (!window.confirm("تمسح الدفعة دي؟ الباقي هيرجع زي ما كان والخزنة هترجع.")) return;
    await payablesApi.removePayment(id);
    refresh();
  }

  if (!data) return <div className="text-sm text-slate-400">جاري التحميل...</div>;

  // الباقي لكل جهة (لمين) — تجميع سريع لمصروفات المعدات الآجلة.
  const byPayee = new Map<string, number>();
  for (const e of data.expenses) {
    const key = e.payee || "بدون اسم";
    byPayee.set(key, (byPayee.get(key) ?? 0) + e.remaining);
  }

  return (
    <div className="space-y-6">
      <PrintHeader title="الآجل — اللي علينا" subtitle={`${monthLabel(month)} ${month.slice(0, 4)}`} />

      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">الآجل (اللي علينا)</h1>
          <p className="text-sm text-slate-500 mt-1">
            كل فلوس لسه علينا: باقي مصروفات المعدات، نصيب الشركاء اللي لسه متدفعش، والموردين.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <PrintButton />
          <MonthPicker month={month} onChange={setMonth} />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <SummaryBox label="إجمالي اللي علينا" value={data.totalDue} tone="rose" />
        <SummaryBox label="باقي مصروفات المعدات" value={data.expensesDue} />
        <SummaryBox label={`للشركاء — سنة ${month.slice(0, 4)}`} value={Math.max(0, data.partnersYearDue)} />
        <SummaryBox label="للموردين" value={data.suppliersDue} onClick={onGoToSuppliers} />
      </div>

      <div className="bg-white rounded-card shadow-card p-5">
        <h2 className="font-bold text-slate-800 mb-4">إجمالي اللي علينا</h2>

        <h3 className="text-sm font-bold text-slate-600 mb-2">للشركاء</h3>
        {data.partners.length === 0 ? (
          <div className="text-sm text-slate-400 mb-5">مفيش حاجة للشركاء.</div>
        ) : (
          <table className="w-full text-sm mb-6">
            <thead>
              <tr className="text-slate-400 border-b border-slate-100">
                <th className="text-start font-semibold py-2">الشريك</th>
                <th className="text-start font-semibold py-2">علينا — {monthLabel(month)}</th>
                <th className="text-start font-semibold py-2">علينا — سنة {month.slice(0, 4)}</th>
              </tr>
            </thead>
            <tbody>
              {data.partners.map((p) => (
                <tr key={p.id} className="border-b border-slate-50 last:border-0">
                  <td className="py-2 font-semibold text-slate-700">{p.name}</td>
                  <td className="py-2 font-semibold text-slate-700">
                    <PartnerDue value={p.monthDue} />
                  </td>
                  <td className="py-2 font-semibold text-slate-800">
                    <PartnerDue value={p.yearDue} />
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-slate-100">
                <td className="pt-2 font-bold text-slate-700">الإجمالي</td>
                <td className="pt-2 font-bold text-slate-700">
                  <PartnerDue value={data.partnersMonthDue} />
                </td>
                <td className="pt-2 font-bold text-slate-800">
                  <PartnerDue value={data.partnersYearDue} />
                </td>
              </tr>
            </tfoot>
          </table>
        )}

        <h3 className="text-sm font-bold text-slate-600 mb-2">للموردين</h3>
        <div className="flex items-center justify-between bg-slate-50 rounded-xl px-4 py-3 mb-6 text-sm">
          <span className="text-slate-600">إجمالي المستحق للموردين (التفاصيل في صفحة الموردين)</span>
          <span className="flex items-center gap-3">
            <span className="font-bold text-slate-800">{formatEGP(data.suppliersDue)}</span>
            <button onClick={onGoToSuppliers} className="no-print text-xs font-semibold text-primary hover:text-primary-dark">
              افتح الموردين ←
            </button>
          </span>
        </div>

        <h3 className="text-sm font-bold text-slate-600 mb-2">مصروفات المعدات اللي لسه متدفعتش كلها</h3>
        {data.expenses.length === 0 ? (
          <div className="text-sm text-slate-400">مفيش مصروفات آجلة — كله متدفع.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-400 border-b border-slate-100">
                  <th className="text-start font-semibold py-2">المعدة</th>
                  <th className="text-start font-semibold py-2">المصروف</th>
                  <th className="text-start font-semibold py-2">لمين</th>
                  <th className="text-start font-semibold py-2">التاريخ</th>
                  <th className="text-start font-semibold py-2">القيمة</th>
                  <th className="text-start font-semibold py-2">اتدفع</th>
                  <th className="text-start font-semibold py-2">الباقي</th>
                  <th className="no-print"></th>
                </tr>
              </thead>
              <tbody>
                {data.expenses.map((e) => (
                  <tr key={e.id} className="border-b border-slate-50 last:border-0">
                    <td className="py-2 font-semibold text-slate-700">{e.equipment_name}</td>
                    <td className="py-2 text-slate-600">
                      {e.category_name ?? "—"}
                      {e.note ? <span className="text-xs text-slate-400"> ({e.note})</span> : null}
                    </td>
                    <td className="py-2 text-slate-600">{e.payee ?? "—"}</td>
                    <td className="py-2 text-slate-500 whitespace-nowrap">{e.date}</td>
                    <td className="py-2 text-slate-600">{formatEGP(e.amount)}</td>
                    <td className="py-2 text-slate-600">{formatEGP(e.paid)}</td>
                    <td className="py-2 font-bold text-rose-600">{formatEGP(e.remaining)}</td>
                    <td className="no-print py-2">
                      <button
                        onClick={() => setPaying(e)}
                        className="bg-primary text-white rounded-lg px-3 py-1 text-xs font-semibold hover:bg-primary-dark"
                      >
                        دفعت
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-slate-100">
                  <td colSpan={6} className="pt-2 font-bold text-slate-700">
                    إجمالي الباقي
                  </td>
                  <td className="pt-2 font-bold text-rose-600">{formatEGP(data.expensesDue)}</td>
                  <td className="no-print"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {byPayee.size > 1 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {[...byPayee.entries()].map(([name, amount]) => (
              <span key={name} className="rounded-lg bg-rose-50 text-rose-700 px-2.5 py-1 text-xs font-semibold">
                {name}: علينا {formatEGP(amount)}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="no-print bg-white rounded-card shadow-card p-5">
        <h2 className="font-bold text-slate-800 mb-3">دفعات الآجل — {monthLabel(month)}</h2>
        {data.recentPayments.length === 0 ? (
          <div className="text-sm text-slate-400">مفيش دفعات آجل الشهر ده.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-400 border-b border-slate-100">
                <th className="text-start font-semibold py-2">التاريخ</th>
                <th className="text-start font-semibold py-2">المصروف</th>
                <th className="text-start font-semibold py-2">لمين</th>
                <th className="text-start font-semibold py-2">المبلغ</th>
                <th className="text-start font-semibold py-2">طريقة الدفع</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.recentPayments.map((p) => (
                <tr key={p.id} className="border-b border-slate-50 last:border-0">
                  <td className="py-2 text-slate-500">{p.date}</td>
                  <td className="py-2 text-slate-700">
                    {p.category_name ?? "مصروف"} — {p.equipment_name}
                  </td>
                  <td className="py-2 text-slate-600">{p.payee ?? "—"}</td>
                  <td className="py-2 font-semibold text-slate-700">{formatEGP(p.amount)}</td>
                  <td className="py-2 text-slate-500">{paymentMethodLabel(p.method)}</td>
                  <td className="py-2">
                    <button onClick={() => removePayment(p.id)} className="text-xs text-rose-500 hover:text-rose-700 font-semibold">
                      حذف
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {paying && (
        <PayModal
          expense={paying}
          onClose={() => setPaying(null)}
          onDone={() => {
            setPaying(null);
            refresh();
          }}
        />
      )}
    </div>
  );
}
