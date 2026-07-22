import { Fragment, FormEvent, useEffect, useState } from "react";
import MonthPicker from "../components/equipment/MonthPicker";
import Icon from "../components/Icon";
import PrintButton from "../components/PrintButton";
import { PrintSignoff } from "../components/PrintSignoff";
import { employeeAdvancesApi, employeeBonusesApi, payrollApi, salaryPaymentsApi } from "../api/client";
import { PaymentMethod, PayrollDetail, PayrollRow } from "../api/types";
import { currentMonthKey, monthLabel } from "../utils/months";
import { formatEGP } from "../utils/format";
import { PAYMENT_METHODS, paymentMethodLabel } from "../utils/paymentMethods";

// شيت المرتب بيتبعت للسائق كإيصال — عايزين "اشتغل على المعدة دي كذا يوم أخد
// كذا" مش خصم من مرتب كامل، فبنجمع أيام الشغل (بما فيها أي يوم اتعلّم إجازة
// مدفوعة — بيظهر تحت المعدة اللي اتسجل عليها زي أي يوم شغل عادي) حسب المعدة
// بدل التفاصيل اليومية، والمجموع بيبقى هو الإجمالي نفسه.
function equipmentTotals(days: PayrollDetail["days"]): { equipment_name: string; days: number; value: number }[] {
  const byEquipment = new Map<string, { days: number; value: number }>();
  for (const d of days) {
    const entry = byEquipment.get(d.equipment_name) ?? { days: 0, value: 0 };
    entry.days += 1;
    entry.value += d.day_value;
    byEquipment.set(d.equipment_name, entry);
  }
  return [...byEquipment.entries()].map(([equipment_name, e]) => ({ equipment_name, ...e }));
}

function PayslipPanel({ row, month, onChanged }: { row: PayrollRow; month: string; onChanged: () => void }) {
  const [detail, setDetail] = useState<PayrollDetail | null>(null);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [note, setNote] = useState("");
  const [bonusDate, setBonusDate] = useState(new Date().toISOString().slice(0, 10));
  const [bonusAmount, setBonusAmount] = useState("");
  const [bonusMethod, setBonusMethod] = useState<PaymentMethod>("cash");
  const [bonusNote, setBonusNote] = useState("");
  const [payDate, setPayDate] = useState(new Date().toISOString().slice(0, 10));
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState<PaymentMethod>("cash");
  const [payNote, setPayNote] = useState("");

  const refresh = () => payrollApi.detail(row.id, month).then(setDetail);

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [row.id, month]);

  // بيقترح المبلغ الباقي تلقائيًا كل ما الشيت يتحدّث — لو مفيش باقي (اتدفع
  // كله) بيسيب الخانة فاضية بدل ما يقترح صفر أو رقم سالب.
  useEffect(() => {
    if (detail) setPayAmount(detail.remaining > 0 ? String(detail.remaining) : "");
  }, [detail?.remaining]);

  async function handleAddAdvance(e: FormEvent) {
    e.preventDefault();
    if (!amount) return;
    await employeeAdvancesApi.create({
      employee_id: row.id,
      month,
      date,
      amount: Number(amount),
      payment_method: paymentMethod,
      note: note || null,
    });
    setAmount("");
    setNote("");
    await refresh();
    onChanged();
  }

  async function handleDeleteAdvance(id: number) {
    await employeeAdvancesApi.remove(id);
    await refresh();
    onChanged();
  }

  async function handleAddBonus(e: FormEvent) {
    e.preventDefault();
    if (!bonusAmount || !bonusNote) return;
    await employeeBonusesApi.create({
      employee_id: row.id,
      month,
      date: bonusDate,
      amount: Number(bonusAmount),
      payment_method: bonusMethod,
      note: bonusNote,
    });
    setBonusAmount("");
    setBonusNote("");
    await refresh();
    onChanged();
  }

  async function handleDeleteBonus(id: number) {
    await employeeBonusesApi.remove(id);
    await refresh();
    onChanged();
  }

  async function handleAddPayment(e: FormEvent) {
    e.preventDefault();
    if (!payAmount) return;
    await salaryPaymentsApi.create({
      employee_id: row.id,
      month,
      date: payDate,
      amount: Number(payAmount),
      payment_method: payMethod,
      note: payNote || null,
    });
    setPayNote("");
    await refresh();
    onChanged();
  }

  async function handleDeletePayment(id: number) {
    await salaryPaymentsApi.remove(id);
    await refresh();
    onChanged();
  }

  if (!detail) {
    return (
      <tr>
        <td colSpan={8} className="px-4 py-4 text-sm text-slate-400">
          جاري التحميل...
        </td>
      </tr>
    );
  }

  return (
    <tr>
      <td colSpan={8} className="bg-slate-50 px-4 py-5 rounded-xl">
        <div className="bg-white rounded-card shadow-card p-5 max-w-2xl">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
            <div>
              <div className="font-extrabold text-slate-900">{row.name}</div>
              <div className="text-xs text-slate-400">
                شيت مرتب {monthLabel(month)} {month.split("-")[0]} — شركة البنيان لتأجير المعدات الثقيلة
              </div>
            </div>
            <div className="flex items-center gap-2">
              <PrintButton />
              <Icon name="salaries" className="w-6 h-6 text-primary no-print" />
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2.5 mb-4">
            <div className="text-center bg-primary-light rounded-xl py-2.5">
              <div className="text-xs text-slate-500">المرتب من العمل</div>
              <div className="font-bold text-slate-800">{formatEGP(detail.grossPay)}</div>
            </div>
            <div className="text-center bg-rose-50 rounded-xl py-2.5">
              <div className="text-xs text-slate-500">السلف</div>
              <div className="font-bold text-rose-600">{formatEGP(detail.advancesTotal)}</div>
            </div>
            <div className="text-center bg-emerald-50 rounded-xl py-2.5">
              <div className="text-xs text-slate-500">الحافز</div>
              <div className="font-bold text-emerald-600">{formatEGP(detail.bonusesTotal)}</div>
            </div>
            <div className="text-center bg-primary rounded-xl py-2.5">
              <div className="text-xs text-white/80">الإجمالي</div>
              <div className="font-extrabold text-white">{formatEGP(detail.netPay)}</div>
            </div>
          </div>

          <div className="flex items-center justify-between bg-slate-50 rounded-xl px-4 py-3 mb-4">
            <div>
              <div className="text-xs text-slate-500">اتدفع من الصافي</div>
              <div className="font-bold text-emerald-600">{formatEGP(detail.paidTotal)}</div>
            </div>
            <div className="text-end">
              <div className="text-xs text-slate-500">الباقي</div>
              <div className={`font-extrabold ${detail.remaining > 0 ? "text-rose-600" : "text-slate-800"}`}>
                {formatEGP(detail.remaining)}
              </div>
            </div>
          </div>

          <div className="mb-4">
            <div className="text-xs font-bold text-slate-500 mb-1.5">دفع المرتب</div>
            {detail.payments.length > 0 && (
              <ul className="space-y-1 mb-2">
                {detail.payments.map((p) => (
                  <li key={p.id} className="flex items-center justify-between text-sm">
                    <span className="text-slate-600">
                      {p.date} — {formatEGP(p.amount)} — {paymentMethodLabel(p.payment_method)}{" "}
                      {p.note && <span className="text-slate-400">({p.note})</span>}
                    </span>
                    <button onClick={() => handleDeletePayment(p.id)} className="no-print text-xs text-rose-500 hover:text-rose-700 font-semibold">
                      حذف
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <form onSubmit={handleAddPayment} className="no-print flex flex-wrap items-end gap-2">
              <input
                type="date"
                value={payDate}
                onChange={(e) => setPayDate(e.target.value)}
                className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
              />
              <input
                type="number"
                min="0"
                step="any"
                placeholder="القيمة"
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                className="w-24 rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
              />
              <select
                value={payMethod}
                onChange={(e) => setPayMethod(e.target.value as PaymentMethod)}
                className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
              >
                {PAYMENT_METHODS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
              <input
                type="text"
                placeholder="ملاحظة (اختياري)"
                value={payNote}
                onChange={(e) => setPayNote(e.target.value)}
                className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
              />
              <button type="submit" className="bg-primary text-white rounded-lg px-3 py-1.5 text-sm font-semibold hover:bg-primary-dark">
                دفعت المرتب
              </button>
            </form>
          </div>

          <div className="mb-4">
            {row.wage_type === "monthly" && row.fixed_salary ? (
              <div className="text-xs text-slate-400 bg-slate-50 rounded-lg px-3 py-2">
                مرتب ثابت مهما حصل — مش مرتبط بالحضور في السركي.
              </div>
            ) : (
              <>
                <div className="text-xs font-bold text-slate-500 mb-1.5">الشغل حسب المعدة ({detail.days.length} يوم)</div>
                {detail.days.length === 0 ? (
                  <div className="text-xs text-slate-400">لسه ملوش أيام مسجلة الشهر ده.</div>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-slate-400 border-b border-slate-100">
                        <th className="text-start font-semibold py-1.5">المعدة</th>
                        <th className="text-start font-semibold py-1.5">عدد الأيام</th>
                        <th className="text-start font-semibold py-1.5">القيمة</th>
                      </tr>
                    </thead>
                    <tbody>
                      {equipmentTotals(detail.days).map((e) => (
                        <tr key={e.equipment_name} className="border-b border-slate-50 last:border-0">
                          <td className="py-1.5 text-slate-600">{e.equipment_name}</td>
                          <td className="py-1.5 text-slate-500">{e.days}</td>
                          <td className="py-1.5 font-semibold text-slate-700">{formatEGP(e.value)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </>
            )}
          </div>

          <div className="mb-4">
            <div className="text-xs font-bold text-slate-500 mb-1.5">السلف</div>
            {detail.advances.length > 0 && (
              <ul className="space-y-1 mb-2">
                {detail.advances.map((a) => (
                  <li key={a.id} className="flex items-center justify-between text-sm">
                    <span className="text-slate-600">
                      {a.date} — {formatEGP(a.amount)} — {paymentMethodLabel(a.payment_method)}{" "}
                      {a.note && <span className="text-slate-400">({a.note})</span>}
                    </span>
                    <button onClick={() => handleDeleteAdvance(a.id)} className="no-print text-xs text-rose-500 hover:text-rose-700 font-semibold">
                      حذف
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <form onSubmit={handleAddAdvance} className="no-print flex flex-wrap items-end gap-2">
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
              />
              <input
                type="number"
                min="0"
                step="any"
                placeholder="القيمة"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-24 rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
              />
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
              >
                {PAYMENT_METHODS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
              <input
                type="text"
                placeholder="ملاحظة (اختياري)"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
              />
              <button type="submit" className="bg-primary text-white rounded-lg px-3 py-1.5 text-sm font-semibold hover:bg-primary-dark">
                إضافة سلفة
              </button>
            </form>
          </div>

          <div>
            <div className="text-xs font-bold text-slate-500 mb-1.5">الحافز</div>
            {detail.bonuses.length > 0 && (
              <ul className="space-y-1 mb-2">
                {detail.bonuses.map((b) => (
                  <li key={b.id} className="flex items-center justify-between text-sm">
                    <span className="text-slate-600">
                      {b.date} — {formatEGP(b.amount)} — {paymentMethodLabel(b.payment_method)}{" "}
                      {b.note && <span className="text-slate-400">({b.note})</span>}
                    </span>
                    <button onClick={() => handleDeleteBonus(b.id)} className="no-print text-xs text-rose-500 hover:text-rose-700 font-semibold">
                      حذف
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <form onSubmit={handleAddBonus} className="no-print flex flex-wrap items-end gap-2">
              <input
                type="date"
                value={bonusDate}
                onChange={(e) => setBonusDate(e.target.value)}
                className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
              />
              <input
                type="number"
                min="0"
                step="any"
                placeholder="القيمة"
                value={bonusAmount}
                onChange={(e) => setBonusAmount(e.target.value)}
                className="w-24 rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
              />
              <select
                value={bonusMethod}
                onChange={(e) => setBonusMethod(e.target.value as PaymentMethod)}
                className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
              >
                {PAYMENT_METHODS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
              <input
                type="text"
                placeholder="الحافز ده عشان إيه؟"
                value={bonusNote}
                onChange={(e) => setBonusNote(e.target.value)}
                className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
              />
              <button type="submit" className="bg-emerald-600 text-white rounded-lg px-3 py-1.5 text-sm font-semibold hover:bg-emerald-700">
                إضافة حافز
              </button>
            </form>
          </div>

          <PrintSignoff />
        </div>
      </td>
    </tr>
  );
}

export default function Salaries() {
  const [month, setMonth] = useState(currentMonthKey());
  const [rows, setRows] = useState<PayrollRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const refresh = () => payrollApi.summary(month).then(setRows);

  useEffect(() => {
    setLoading(true);
    refresh().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

  const totalNet = rows.reduce((sum, r) => sum + r.net_pay, 0);
  const totalRemaining = rows.reduce((sum, r) => sum + r.remaining, 0);

  return (
    <div className="space-y-6">
      <div className="no-print flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">الرواتب</h1>
          <p className="text-sm text-slate-500 mt-1">
            دوس على اسم أي سائق تشوف شيت مرتبه بالتفصيل — الأيام والمعدات والسلف والحافز — وتقدر تصوره وتبعتهوله.
          </p>
        </div>
        <MonthPicker month={month} onChange={setMonth} />
      </div>

      <div className="bg-white rounded-card shadow-card p-5">
        {loading ? (
          <div className="text-sm text-slate-400">جاري التحميل...</div>
        ) : rows.length === 0 ? (
          <div className="text-sm text-slate-400">لسه مفيش سائقين أو موظفين مسجلين — ضيفهم من الإعدادات.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="no-print">
              <tr className="text-slate-400 border-b border-slate-100">
                <th className="text-start font-semibold py-2">الاسم</th>
                <th className="text-start font-semibold py-2">نوع الأجر</th>
                <th className="text-start font-semibold py-2">أيام العمل</th>
                <th className="text-start font-semibold py-2">المرتب من العمل</th>
                <th className="text-start font-semibold py-2">السلف</th>
                <th className="text-start font-semibold py-2">الحافز</th>
                <th className="text-start font-semibold py-2">الإجمالي</th>
                <th className="text-start font-semibold py-2">الباقي</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <Fragment key={row.id}>
                  <tr className="no-print border-b border-slate-50 last:border-0">
                    <td className="py-2.5">
                      <button
                        onClick={() => setExpandedId(expandedId === row.id ? null : row.id)}
                        className="flex items-center gap-2 font-semibold text-slate-700 hover:text-primary"
                      >
                        <Icon name="salaries" className="w-4 h-4 text-primary" />
                        {row.name}
                      </button>
                    </td>
                    <td className="py-2.5 text-slate-500">{row.wage_type === "daily" ? "يومي" : "شهري"}</td>
                    <td className="py-2.5 text-slate-500">{row.days_worked ?? "—"}</td>
                    <td className="py-2.5 text-slate-600">{formatEGP(row.gross_pay)}</td>
                    <td className="py-2.5 text-rose-500">
                      {row.advances_total > 0 ? `- ${formatEGP(row.advances_total)}` : "—"}
                    </td>
                    <td className="py-2.5 text-emerald-600">
                      {row.bonuses_total > 0 ? `+ ${formatEGP(row.bonuses_total)}` : "—"}
                    </td>
                    <td className="py-2.5 font-bold text-primary-dark">{formatEGP(row.net_pay)}</td>
                    <td className={`py-2.5 font-bold ${row.remaining > 0 ? "text-rose-600" : "text-slate-400"}`}>
                      {formatEGP(row.remaining)}
                    </td>
                  </tr>
                  {expandedId === row.id && <PayslipPanel row={row} month={month} onChanged={refresh} />}
                </Fragment>
              ))}
            </tbody>
            <tfoot className="no-print">
              <tr>
                <td colSpan={6} className="pt-3 text-sm font-bold text-slate-700">
                  إجمالي صافي الرواتب
                </td>
                <td className="pt-3 text-sm font-bold text-primary-dark">{formatEGP(totalNet)}</td>
                <td className="pt-3 text-sm font-bold text-rose-600">{formatEGP(totalRemaining)}</td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  );
}
