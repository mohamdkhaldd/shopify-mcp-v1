import { useState } from "react";
import {
  addSupplierPayment,
  addSupplierPurchase,
  deleteSupplierPayment,
  deleteSupplierPurchase,
  listSupplierPayments,
  listSupplierPurchases,
  listSuppliers,
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

function PurchaseForm({ names, onSaved }: { names: string[]; onSaved: () => void }) {
  const [supplierName, setSupplierName] = useState("");
  const [date, setDate] = useState(todayIso());
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");

  function save() {
    if (!supplierName.trim() || !amount) return;
    addSupplierPurchase(supplierName.trim(), { date, description: description.trim() || null, amount: Number(amount), note: null });
    setSupplierName("");
    setDescription("");
    setAmount("");
    onSaved();
  }

  return (
    <div className="bg-white rounded-2xl shadow-card p-4 space-y-2">
      <div className="text-sm font-extrabold text-slate-700">تسجيل مشترى</div>
      <div>
        <label className="block text-[11px] text-slate-500 mb-1">اسم المورد</label>
        <input list="supplier-names" value={supplierName} onChange={(e) => setSupplierName(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
        <datalist id="supplier-names">
          {names.map((n) => (
            <option key={n} value={n} />
          ))}
        </datalist>
      </div>
      <div>
        <label className="block text-[11px] text-slate-500 mb-1">التاريخ</label>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
      </div>
      <div>
        <label className="block text-[11px] text-slate-500 mb-1">البيان</label>
        <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="المشترى" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
      </div>
      <div>
        <label className="block text-[11px] text-slate-500 mb-1">القيمة</label>
        <input type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
      </div>
      <button onClick={save} disabled={!supplierName.trim() || !amount} className="w-full bg-primary text-white rounded-xl py-2.5 text-sm font-bold disabled:opacity-50">
        تسجيل مشترى
      </button>
    </div>
  );
}

function PaymentForm({ names, onSaved }: { names: string[]; onSaved: () => void }) {
  const [supplierName, setSupplierName] = useState("");
  const [date, setDate] = useState(todayIso());
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");

  function save() {
    if (!supplierName.trim() || !amount) return;
    addSupplierPayment(supplierName.trim(), { date, amount: Number(amount), method, note: null });
    setSupplierName("");
    setAmount("");
    onSaved();
  }

  return (
    <div className="bg-white rounded-2xl shadow-card p-4 space-y-2">
      <div className="text-sm font-extrabold text-slate-700">تسجيل دفعة</div>
      <div>
        <label className="block text-[11px] text-slate-500 mb-1">اسم المورد</label>
        <input list="supplier-names" value={supplierName} onChange={(e) => setSupplierName(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
      </div>
      <div>
        <label className="block text-[11px] text-slate-500 mb-1">التاريخ</label>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
      </div>
      <div>
        <label className="block text-[11px] text-slate-500 mb-1">القيمة</label>
        <input type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
      </div>
      <div>
        <label className="block text-[11px] text-slate-500 mb-1">طريقة الدفع</label>
        <select value={method} onChange={(e) => setMethod(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm">
          {PAYMENT_METHODS.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
      </div>
      <button onClick={save} disabled={!supplierName.trim() || !amount} className="w-full bg-primary text-white rounded-xl py-2.5 text-sm font-bold disabled:opacity-50">
        تسجيل دفعة
      </button>
    </div>
  );
}

export default function Suppliers({ onBack }: { onBack: () => void }) {
  const [version, setVersion] = useState(0);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const suppliers = listSuppliers();
  const names = suppliers.map((s) => s.name);

  function refresh() {
    setVersion((v) => v + 1);
  }

  const rows = suppliers.map((s) => {
    const purchases = listSupplierPurchases(s.id);
    const payments = listSupplierPayments(s.id);
    const totalPurchases = purchases.reduce((sum, p) => sum + p.amount, 0);
    const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
    return { ...s, purchases, payments, totalPurchases, totalPaid, remaining: totalPurchases - totalPaid };
  });

  function removePurchase(supplierName: string, id: number) {
    const purchase = rows.find((r) => r.name === supplierName)?.purchases.find((p) => p.id === id);
    if (!purchase) return;
    deleteSupplierPurchase(id);
    refresh();
    pushUndo(`اتمسح مشترى "${supplierName}"`, () => {
      addSupplierPurchase(supplierName, { date: purchase.date, description: purchase.description, amount: purchase.amount, note: purchase.note });
      refresh();
    });
  }

  function removePayment(supplierName: string, id: number) {
    const payment = rows.find((r) => r.name === supplierName)?.payments.find((p) => p.id === id);
    if (!payment) return;
    deleteSupplierPayment(id);
    refresh();
    pushUndo(`اتمسحت دفعة "${supplierName}"`, () => {
      addSupplierPayment(supplierName, { date: payment.date, amount: payment.amount, method: payment.method, note: payment.note });
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
          <div className="text-lg font-extrabold mt-0.5">الموردين</div>
        </div>
      </div>

      <div className="p-4 space-y-3">
        <PurchaseForm names={names} onSaved={refresh} />
        <PaymentForm names={names} onSaved={refresh} />

        <div className="space-y-2">
          {rows.length === 0 ? (
            <div className="text-sm text-slate-400 text-center py-4">لسه مفيش موردين — أول ما تسجل مشترى أو دفعة، هيظهر هنا تلقائيًا.</div>
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
                            <div key={p.id} className="flex items-center justify-between text-xs text-slate-600">
                              <span>
                                {p.date} — {formatEGP(p.amount)} {p.description && <span className="text-slate-400">({p.description})</span>}
                              </span>
                              <button onClick={() => removePurchase(s.name, p.id)} className="text-rose-500 font-bold shrink-0 ms-2">
                                مسح
                              </button>
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
                            <div key={p.id} className="flex items-center justify-between text-xs text-slate-600">
                              <span>
                                {p.date} — {formatEGP(p.amount)} — {paymentMethodLabel(p.method)}
                              </span>
                              <button onClick={() => removePayment(s.name, p.id)} className="text-rose-500 font-bold shrink-0 ms-2">
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
    </div>
  );
}
