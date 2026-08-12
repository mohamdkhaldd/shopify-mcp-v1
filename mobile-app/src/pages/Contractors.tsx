import { useState } from "react";
import { listContractorPayments, listContractorSummaries } from "../store";

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

export default function Contractors({ onBack }: { onBack: () => void }) {
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const items = listContractorSummaries();

  return (
    <div>
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
          <div className="text-sm text-slate-400 text-center py-4">لسه مفيش مقاولين مسجلين.</div>
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
                <div className="border-t border-slate-100 p-3.5">
                  <div className="text-xs font-bold text-slate-500 mb-1.5">الدفعات</div>
                  {listContractorPayments(c.id).length === 0 ? (
                    <div className="text-xs text-slate-400">لا يوجد.</div>
                  ) : (
                    <div className="space-y-1">
                      {listContractorPayments(c.id).map((p) => (
                        <div key={p.id} className="text-xs text-slate-600">
                          {p.date} — {formatEGP(p.amount)} — {paymentMethodLabel(p.method)}
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
