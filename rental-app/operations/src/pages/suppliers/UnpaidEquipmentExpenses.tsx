import { FormEvent, useEffect, useState } from "react";
import { ask } from "../../components/Dialogs";
import Modal from "../../components/Modal";
import MonthPicker from "../../components/equipment/MonthPicker";
import { equipmentApi, expenseCategoriesApi, monthlyExpensesApi, payablesApi, suppliersApi } from "../../api/client";
import { PayableExpense, PayablesSummary } from "../../api/types";
import { currentMonthKey, monthLabel } from "../../utils/months";
import { formatEGP } from "../../utils/format";
import { PAYMENT_METHODS, paymentMethodLabel } from "../../utils/paymentMethods";

// مصروفات المعدات اللي لسه متدفعتش (آجل): دي فلوس علينا لمورد (اللي اتكتب في
// «لمين»)، فمكانها صفحة الموردين. الدفع بيخرج من الخزنة، ومصروف المعدة نفسه مبيتغيرش.

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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

// مصروف على معدة من عند مورد، ودفعت جزء بس: المعدة بتتحسب عليها القيمة كاملة،
// والخزنة بيتخصم منها اللي اتدفع بس، والباقي بيفضل آجل للمورد هنا.
function PartialExpenseForm({ onSaved }: { onSaved: () => void }) {
  const [equipment, setEquipment] = useState<{ id: number; name: string }[]>([]);
  const [categories, setCategories] = useState<{ id: number; name: string }[]>([]);
  const [suppliers, setSuppliers] = useState<string[]>([]);
  const [payee, setPayee] = useState("");
  const [equipmentId, setEquipmentId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [date, setDate] = useState(todayISO());
  const [total, setTotal] = useState("");
  const [paid, setPaid] = useState("");
  const [method, setMethod] = useState("cash");
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState("");
  useEffect(() => {
    equipmentApi.list().then(setEquipment);
    expenseCategoriesApi.list().then(setCategories);
    suppliersApi.names().then(setSuppliers);
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const t = Number(total);
    const p = paid === "" ? 0 : Number(paid);
    if (!equipmentId || !(t > 0) || !payee.trim()) return;
    if (p > t) return setMsg("المدفوع أكتر من القيمة");
    await monthlyExpensesApi.create({
      equipment_id: Number(equipmentId),
      month: date.slice(0, 7),
      date,
      category_id: categoryId ? Number(categoryId) : null,
      amount: t,
      payment_method: method,
      note: note || null,
      receipt_image: null,
      paid_amount: p,
      payee: payee.trim(),
    });
    const eq = equipment.find((x) => x.id === Number(equipmentId))?.name;
    setMsg(`اتسجل ${formatEGP(t)} على ${eq} — اتدفع ${formatEGP(p)} من ${paymentMethodLabel(method)}، والباقي ${formatEGP(t - p)} آجل لـ ${payee.trim()}`);
    setTotal("");
    setPaid("");
    setNote("");
    onSaved();
  }

  const cls = "rounded-lg border border-slate-200 px-2 py-1.5 text-sm bg-white";
  return (
    <div className="no-print bg-white rounded-card shadow-card p-5">
      <h2 className="font-bold text-slate-800 mb-1">مصروف على معدة من مورد (دفعت جزء)</h2>
      <p className="text-xs text-slate-400 mb-3">المعدة بيتحسب عليها السعر كامل، والخزنة بيتخصم منها اللي دفعته بس — والباقي بيفضل للمورد تحت.</p>
      <form onSubmit={submit} className="flex flex-wrap items-end gap-2">
        <div>
          <label className="block text-xs text-slate-400 mb-1">المورد</label>
          <input list="partial-suppliers" value={payee} onChange={(e) => setPayee(e.target.value)} placeholder="اسم المورد" className={cls} />
          <datalist id="partial-suppliers">
            {suppliers.map((x) => (
              <option key={x} value={x} />
            ))}
          </datalist>
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">على أنهي معدة</label>
          <select value={equipmentId} onChange={(e) => setEquipmentId(e.target.value)} className={cls}>
            <option value="">اختار…</option>
            {equipment.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">البند</label>
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={cls}>
            <option value="">—</option>
            {categories.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">التاريخ</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={cls} />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">القيمة كاملة</label>
          <input type="number" min="0" step="any" value={total} onChange={(e) => setTotal(e.target.value)} className={`${cls} w-28`} />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">دفعت كام</label>
          <input type="number" min="0" step="any" value={paid} onChange={(e) => setPaid(e.target.value)} placeholder="0" className={`${cls} w-28`} />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">دفعت من</label>
          <select value={method} onChange={(e) => setMethod(e.target.value)} className={cls}>
            {PAYMENT_METHODS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">البيان</label>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="اختياري" className={cls} />
        </div>
        <button type="submit" disabled={!equipmentId || !total || !payee.trim()} className="bg-primary text-white rounded-lg px-4 py-1.5 text-sm font-semibold disabled:opacity-50">
          سجّل
        </button>
      </form>
      {msg && <div className="mt-3 text-sm font-semibold text-primary-dark">{msg}</div>}
    </div>
  );
}

export default function UnpaidEquipmentExpenses() {
  const [month, setMonth] = useState(currentMonthKey());
  const [data, setData] = useState<PayablesSummary | null>(null);
  const [paying, setPaying] = useState<PayableExpense | null>(null);
  const refresh = () => payablesApi.summary(month).then(setData);
  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

  async function removePayment(id: number) {
    if (!(await ask("تمسح الدفعة دي؟ الباقي هيرجع زي ما كان والخزنة هترجع."))) return;
    await payablesApi.removePayment(id);
    refresh();
  }

  if (!data) return null;
  const byPayee = new Map<string, number>();
  for (const e of data.expenses) {
    const key = e.payee || "بدون اسم";
    byPayee.set(key, (byPayee.get(key) ?? 0) + e.remaining);
  }

  return (
    <>
      <PartialExpenseForm onSaved={refresh} />
      <div className="bg-white rounded-card shadow-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h2 className="font-bold text-slate-800">مصروفات المعدات اللي لسه متدفعتش (آجل)</h2>
          <span className="text-lg font-extrabold text-rose-600">{formatEGP(data.expensesDue)}</span>
        </div>
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
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h2 className="font-bold text-slate-800">دفعات الآجل — {monthLabel(month)}</h2>
          <MonthPicker month={month} onChange={setMonth} />
        </div>
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
    </>
  );
}
