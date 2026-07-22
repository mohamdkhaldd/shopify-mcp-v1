import { Fragment, FormEvent, useEffect, useState } from "react";
import Icon from "../components/Icon";
import { suppliersApi } from "../api/client";
import { SupplierDashboardRow } from "../api/types";
import { formatEGP } from "../utils/format";
import { PAYMENT_METHODS, paymentMethodLabel } from "../utils/paymentMethods";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function PurchaseForm({ suggestions, onSaved }: { suggestions: string[]; onSaved: () => void }) {
  const [supplierName, setSupplierName] = useState("");
  const [date, setDate] = useState(todayIso());
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!supplierName.trim() || !amount) return;
    await suppliersApi.createPurchase({
      supplier_name: supplierName.trim(),
      date,
      description: description || null,
      amount: Number(amount),
      note: note || null,
    });
    setSupplierName("");
    setDescription("");
    setAmount("");
    setNote("");
    onSaved();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2">
      <div>
        <label className="block text-xs text-slate-400 mb-1">اسم المورد</label>
        <input
          list="supplier-names"
          value={supplierName}
          onChange={(e) => setSupplierName(e.target.value)}
          placeholder="اكتب اسم المورد"
          className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
        />
        <datalist id="supplier-names">
          {suggestions.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      </div>
      <div>
        <label className="block text-xs text-slate-400 mb-1">التاريخ</label>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm" />
      </div>
      <div>
        <label className="block text-xs text-slate-400 mb-1">البيان</label>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="المشترى"
          className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
        />
      </div>
      <div>
        <label className="block text-xs text-slate-400 mb-1">القيمة</label>
        <input
          type="number"
          min="0"
          step="any"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-28 rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
        />
      </div>
      <button type="submit" className="bg-primary text-white rounded-lg px-4 py-1.5 text-sm font-semibold hover:bg-primary-dark">
        تسجيل مشترى
      </button>
    </form>
  );
}

function PaymentForm({ suggestions, onSaved }: { suggestions: string[]; onSaved: () => void }) {
  const [supplierName, setSupplierName] = useState("");
  const [date, setDate] = useState(todayIso());
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");
  const [note, setNote] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!supplierName.trim() || !amount) return;
    await suppliersApi.createPayment({ supplier_name: supplierName.trim(), date, amount: Number(amount), method, note: note || null });
    setSupplierName("");
    setAmount("");
    setNote("");
    onSaved();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2">
      <div>
        <label className="block text-xs text-slate-400 mb-1">اسم المورد</label>
        <input
          list="supplier-names"
          value={supplierName}
          onChange={(e) => setSupplierName(e.target.value)}
          placeholder="اكتب اسم المورد"
          className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
        />
      </div>
      <div>
        <label className="block text-xs text-slate-400 mb-1">التاريخ</label>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm" />
      </div>
      <div>
        <label className="block text-xs text-slate-400 mb-1">القيمة</label>
        <input
          type="number"
          min="0"
          step="any"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-28 rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
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
      <button type="submit" className="bg-primary text-white rounded-lg px-4 py-1.5 text-sm font-semibold hover:bg-primary-dark">
        تسجيل دفعة
      </button>
    </form>
  );
}

export default function Suppliers() {
  const [rows, setRows] = useState<SupplierDashboardRow[]>([]);
  const [names, setNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const refresh = () => {
    suppliersApi.dashboard().then(setRows);
    suppliersApi.names().then(setNames);
  };

  useEffect(() => {
    refresh();
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900">الموردين</h1>
        <p className="text-sm text-slate-500 mt-1">مفيش قائمة موردين ثابتة — اكتب اسم المورد وقت التسجيل ويظهر في اللوحة تلقائيًا.</p>
      </div>

      <div className="bg-white rounded-card shadow-card p-5">
        <h2 className="font-bold text-slate-800 mb-3">سجل المشتريات</h2>
        <PurchaseForm suggestions={names} onSaved={refresh} />
      </div>

      <div className="bg-white rounded-card shadow-card p-5">
        <h2 className="font-bold text-slate-800 mb-3">سجل الدفعات</h2>
        <PaymentForm suggestions={names} onSaved={refresh} />
      </div>

      <div className="bg-white rounded-card shadow-card p-5">
        <h2 className="font-bold text-slate-800 mb-4">لوحة الموردين</h2>
        {loading ? (
          <div className="text-sm text-slate-400">جاري التحميل...</div>
        ) : rows.length === 0 ? (
          <div className="text-sm text-slate-400">لسه مفيش موردين — أول ما تسجل مشترى أو دفعة، هيظهر هنا تلقائيًا.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-400 border-b border-slate-100">
                <th className="text-start font-semibold py-2">المورد</th>
                <th className="text-start font-semibold py-2">عدد مرات الشراء</th>
                <th className="text-start font-semibold py-2">إجمالي المشتريات</th>
                <th className="text-start font-semibold py-2">إجمالي المدفوع</th>
                <th className="text-start font-semibold py-2">الباقي عليه</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <Fragment key={s.id}>
                  <tr className="border-b border-slate-50 last:border-0">
                    <td className="py-2.5">
                      <button
                        onClick={() => setExpandedId(expandedId === s.id ? null : s.id)}
                        className="flex items-center gap-2 font-semibold text-slate-700 hover:text-primary"
                      >
                        <Icon name="suppliers" className="w-4 h-4 text-primary" />
                        {s.name}
                      </button>
                    </td>
                    <td className="py-2.5 text-slate-500">{s.purchaseCount}</td>
                    <td className="py-2.5 text-slate-600">{formatEGP(s.totalPurchases)}</td>
                    <td className="py-2.5 text-primary font-semibold">{formatEGP(s.totalPaid)}</td>
                    <td className="py-2.5 font-bold text-rose-600">{formatEGP(s.remaining)}</td>
                  </tr>
                  {expandedId === s.id && (
                    <tr>
                      <td colSpan={5} className="bg-slate-50 px-4 py-4 rounded-xl">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <div className="text-xs font-bold text-slate-500 mb-2">المشتريات</div>
                            {s.purchases.length === 0 ? (
                              <div className="text-xs text-slate-400">لا يوجد.</div>
                            ) : (
                              <ul className="space-y-1 text-sm">
                                {s.purchases.map((p) => (
                                  <li key={p.id} className="text-slate-600">
                                    {p.date} — {formatEGP(p.amount)} {p.description && <span className="text-slate-400">({p.description})</span>}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                          <div>
                            <div className="text-xs font-bold text-slate-500 mb-2">الدفعات</div>
                            {s.payments.length === 0 ? (
                              <div className="text-xs text-slate-400">لا يوجد.</div>
                            ) : (
                              <ul className="space-y-1 text-sm">
                                {s.payments.map((p) => (
                                  <li key={p.id} className="text-slate-600">
                                    {p.date} — {formatEGP(p.amount)} — {paymentMethodLabel(p.method)}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
