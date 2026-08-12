import { useState } from "react";
import { listSupplierPayments, listSupplierPurchases, listSuppliers } from "../store";

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

export default function Suppliers({ onBack }: { onBack: () => void }) {
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const suppliers = listSuppliers();

  const rows = suppliers.map((s) => {
    const purchases = listSupplierPurchases(s.id);
    const payments = listSupplierPayments(s.id);
    const totalPurchases = purchases.reduce((sum, p) => sum + p.amount, 0);
    const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
    return { ...s, purchases, payments, totalPurchases, totalPaid, remaining: totalPurchases - totalPaid };
  });

  return (
    <div>
      <div className="bg-primary text-white px-4 pt-6 pb-3 flex items-center gap-2">
        <button onClick={onBack} className="text-white/80 text-lg">
          ‹
        </button>
        <div>
          <div className="text-xs opacity-80 font-bold">دفتر البنيان</div>
          <div className="text-lg font-extrabold mt-0.5">الموردين</div>
        </div>
      </div>

      <div className="p-4 space-y-3">
        <div className="space-y-2">
          {rows.length === 0 ? (
            <div className="text-sm text-slate-400 text-center py-4">لسه مفيش موردين مسجلين.</div>
          ) : (
            rows.map((s) => (
              <div key={s.id} className="bg-white rounded-2xl shadow-card overflow-hidden">
                <button onClick={() => setExpandedId(expandedId === s.id ? null : s.id)} className="w-full p-3.5 flex items-center justify-between text-start">
                  <div>
                    <div className="text-sm font-bold text-slate-800">{s.name}</div>
                    <div className="text-[11px] text-slate-400">{s.purchases.length} عملية شراء</div>
                  </div>
                  <div className="text-end">
                    <div className="text-xs text-slate-400">المتبقي له</div>
                    <div className="font-bold text-rose-600">{formatEGP(s.remaining)}</div>
                  </div>
                </button>
                {expandedId === s.id && (
                  <div className="border-t border-slate-100 p-3.5 space-y-3">
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-slate-50 rounded-lg px-2.5 py-2">
                        <div className="text-slate-400">إجمالي المشتريات</div>
                        <div className="font-bold text-slate-700">{formatEGP(s.totalPurchases)}</div>
                      </div>
                      <div className="bg-slate-50 rounded-lg px-2.5 py-2">
                        <div className="text-slate-400">إجمالي المدفوع</div>
                        <div className="font-bold text-primary-dark">{formatEGP(s.totalPaid)}</div>
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-500 mb-1.5">المشتريات</div>
                      {s.purchases.length === 0 ? (
                        <div className="text-xs text-slate-400">لا يوجد.</div>
                      ) : (
                        <div className="space-y-1">
                          {s.purchases.map((p) => (
                            <div key={p.id} className="text-xs text-slate-600">
                              {p.date} — {formatEGP(p.amount)} {p.description && <span className="text-slate-400">({p.description})</span>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-500 mb-1.5">الدفعات</div>
                      {s.payments.length === 0 ? (
                        <div className="text-xs text-slate-400">لا يوجد.</div>
                      ) : (
                        <div className="space-y-1">
                          {s.payments.map((p) => (
                            <div key={p.id} className="text-xs text-slate-600">
                              {p.date} — {formatEGP(p.amount)} — {paymentMethodLabel(p.method)}
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
    </div>
  );
}
