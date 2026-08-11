import { useState } from "react";
import {
  addContractorPayment,
  deleteContractorPayment,
  listContractorPayments,
  listContractorSummaries,
} from "../store";
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

export default function Contractors({ onBack }: { onBack: () => void }) {
  const [version, setVersion] = useState(0);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [date, setDate] = useState(todayIso());
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");

  const items = listContractorSummaries();

  function refresh() {
    setVersion((v) => v + 1);
  }

  function save(contractorId: number) {
    if (!amount) return;
    addContractorPayment(contractorId, { date, amount: Number(amount), method, note: null });
    setAmount("");
    refresh();
  }

  function remove(contractorId: number, id: number) {
    const payment = listContractorPayments(contractorId).find((p) => p.id === id);
    if (!payment) return;
    deleteContractorPayment(id);
    refresh();
    pushUndo("اتمسحت دفعة مقاول", () => {
      addContractorPayment(contractorId, { date: payment.date, amount: payment.amount, method: payment.method, note: payment.note });
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
          <div className="text-lg font-extrabold mt-0.5">المقاولين</div>
        </div>
      </div>

      <div className="p-4 space-y-2">
        {items.length === 0 ? (
          <div className="text-sm text-slate-400 text-center py-4">لسه مفيش مقاولين مسجلين. ضيفهم من الإعدادات الأول.</div>
        ) : (
          items.map((c) => (
            <div key={c.id} className="bg-white rounded-2xl shadow-card overflow-hidden">
              <button onClick={() => setExpandedId(expandedId === c.id ? null : c.id)} className="w-full p-3.5 flex items-center justify-between text-start">
                <div>
                  <div className="text-sm font-bold text-slate-800">{c.name}</div>
                  <div className="text-[11px] text-slate-400">المستحق عليه {formatEGP(c.totalWork)} — دفع {formatEGP(c.totalPaid)}</div>
                </div>
                {c.remaining !== 0 && (
                  <span className={["text-xs font-bold px-2 py-1 rounded-lg shrink-0", c.remaining > 0 ? "bg-primary-light text-primary-dark" : "bg-rose-50 text-rose-600"].join(" ")}>
                    {c.remaining > 0 ? "عليه" : "دفع زيادة"} {formatEGP(Math.abs(c.remaining))}
                  </span>
                )}
              </button>
              {expandedId === c.id && (
                <div className="border-t border-slate-100 p-3.5 space-y-3">
                  <div className="space-y-2">
                    <div className="text-xs font-extrabold text-slate-700">تسجيل دفعة</div>
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
                    <button onClick={() => save(c.id)} disabled={!amount} className="w-full bg-primary text-white rounded-lg py-2 text-xs font-bold disabled:opacity-50">
                      حفظ الدفعة
                    </button>
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-500 mb-1.5">الدفعات</div>
                    {listContractorPayments(c.id).length === 0 ? (
                      <div className="text-xs text-slate-400">لا يوجد.</div>
                    ) : (
                      <div className="space-y-1">
                        {listContractorPayments(c.id).map((p) => (
                          <div key={p.id} className="flex items-center justify-between text-xs text-slate-600">
                            <span>
                              {p.date} — {formatEGP(p.amount)} — {paymentMethodLabel(p.method)}
                            </span>
                            <button onClick={() => remove(c.id, p.id)} className="text-rose-500 font-bold shrink-0 ms-2">
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
