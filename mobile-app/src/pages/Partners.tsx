import { useState } from "react";
import { addPartnerPayment, deletePartnerPayment, listPartnerPayments, listPartnerSummaries } from "../store";
import { pushUndo } from "../undo";

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

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default function Partners({ onBack }: { onBack: () => void }) {
  const [version, setVersion] = useState(0);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [date, setDate] = useState(todayIso());
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");

  const items = listPartnerSummaries();

  function refresh() {
    setVersion((v) => v + 1);
  }

  function save(partnerId: number) {
    if (!amount) return;
    addPartnerPayment(partnerId, { date, amount: Number(amount), method, note: null });
    setAmount("");
    refresh();
  }

  function remove(partnerId: number, id: number) {
    const payment = listPartnerPayments(partnerId).find((p) => p.id === id);
    if (!payment) return;
    deletePartnerPayment(id);
    refresh();
    pushUndo("اتمسحت دفعة شريك", () => {
      addPartnerPayment(partnerId, { date: payment.date, amount: payment.amount, method: payment.method, note: payment.note });
      refresh();
    });
  }

  return (
    <div key={version}>
      <div className="bg-primary text-white px-4 pt-6 pb-3 flex items-center gap-2">
        <button onClick={onBack} className="text-white/80 text-lg">
          ‹
        </button>
        <div>
          <div className="text-xs opacity-80 font-bold">دفتر البنيان</div>
          <div className="text-lg font-extrabold mt-0.5">الشركاء</div>
        </div>
      </div>

      <div className="p-4 space-y-2">
        {items.length === 0 ? (
          <div className="text-sm text-slate-400 text-center py-4">لسه مفيش شركاء مسجلين. ضيفهم من الإعدادات الأول.</div>
        ) : (
          items.map((p) => (
            <div key={p.id} className="bg-white rounded-2xl shadow-card overflow-hidden">
              <button onClick={() => setExpandedId(expandedId === p.id ? null : p.id)} className="w-full p-3.5 flex items-center justify-between text-start">
                <div>
                  <div className="text-sm font-bold text-slate-800">{p.name}</div>
                  <div className="text-[11px] text-slate-400">إجمالي {formatEGP(p.totalDue)} — مدفوع {formatEGP(p.totalPaid)}</div>
                </div>
                {p.remaining !== 0 && (
                  <span className={["text-xs font-bold px-2 py-1 rounded-lg shrink-0", p.remaining > 0 ? "bg-primary-light text-primary-dark" : "bg-rose-50 text-rose-600"].join(" ")}>
                    باقي {formatEGP(Math.abs(p.remaining))}
                  </span>
                )}
              </button>
              {expandedId === p.id && (
                <div className="border-t border-slate-100 p-3.5 space-y-3">
                  <div className="space-y-2">
                    <div className="text-xs font-extrabold text-slate-700">تسجيل دفعة للشريك</div>
                    <div className="flex gap-1.5">
                      <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="flex-1 rounded-lg border border-slate-200 px-2 py-1.5 text-xs" />
                      <input type="number" inputMode="decimal" placeholder="القيمة" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-24 rounded-lg border border-slate-200 px-2 py-1.5 text-xs" />
                    </div>
                    <select value={method} onChange={(e) => setMethod(e.target.value)} className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs">
                      {PAYMENT_METHODS.map((m) => (
                        <option key={m.value} value={m.value}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                    <button onClick={() => save(p.id)} disabled={!amount} className="w-full bg-primary text-white rounded-lg py-2 text-xs font-bold disabled:opacity-50">
                      حفظ الدفعة
                    </button>
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-500 mb-1.5">الدفعات</div>
                    {listPartnerPayments(p.id).length === 0 ? (
                      <div className="text-xs text-slate-400">لا يوجد.</div>
                    ) : (
                      <div className="space-y-1">
                        {listPartnerPayments(p.id).map((pay) => (
                          <div key={pay.id} className="flex items-center justify-between text-xs text-slate-600">
                            <span>
                              {pay.date} — {formatEGP(pay.amount)} — {paymentMethodLabel(pay.method)}
                            </span>
                            <button onClick={() => remove(p.id, pay.id)} className="text-rose-500 font-bold shrink-0 ms-2">
                              مسح
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
