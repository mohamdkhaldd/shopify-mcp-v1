import { useState } from "react";
import { listPartnerPayments, listPartnerSummaries } from "../store";

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

export default function Partners({ onBack }: { onBack: () => void }) {
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const items = listPartnerSummaries();

  return (
    <div>
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
          <div className="text-sm text-slate-400 text-center py-4">لسه مفيش شركاء مسجلين.</div>
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
                <div className="border-t border-slate-100 p-3.5">
                  <div className="text-xs font-bold text-slate-500 mb-1.5">الدفعات</div>
                  {listPartnerPayments(p.id).length === 0 ? (
                    <div className="text-xs text-slate-400">لا يوجد.</div>
                  ) : (
                    <div className="space-y-1">
                      {listPartnerPayments(p.id).map((pay) => (
                        <div key={pay.id} className="text-xs text-slate-600">
                          {pay.date} — {formatEGP(pay.amount)} — {paymentMethodLabel(pay.method)}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
