import { Fragment, FormEvent, useEffect, useState } from "react";
import MonthPicker from "../components/equipment/MonthPicker";
import Icon from "../components/Icon";
import { employeeAdvancesApi, payrollApi } from "../api/client";
import { PaymentMethod, PayrollDetail, PayrollRow } from "../api/types";
import { currentMonthKey, monthLabel } from "../utils/months";
import { formatEGP } from "../utils/format";
import { PAYMENT_METHODS, paymentMethodLabel } from "../utils/paymentMethods";

function PayslipPanel({ row, month, onChanged }: { row: PayrollRow; month: string; onChanged: () => void }) {
  const [detail, setDetail] = useState<PayrollDetail | null>(null);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [note, setNote] = useState("");

  const refresh = () => payrollApi.detail(row.id, month).then(setDetail);

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [row.id, month]);

  async function handleAddAdvance(e: FormEvent) {
    e.preventDefault();
    if (!amount) return;
    await employeeAdvancesApi.create({
      employee_id: row.id,
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

  if (!detail) {
    return (
      <tr>
        <td colSpan={6} className="px-4 py-4 text-sm text-slate-400">
          جاري التحميل...
        </td>
      </tr>
    );
  }

  return (
    <tr>
      <td colSpan={6} className="bg-slate-50 px-4 py-5 rounded-xl">
        <div className="bg-white rounded-card shadow-card p-5 max-w-2xl">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
            <div>
              <div className="font-extrabold text-slate-900">{row.name}</div>
              <div className="text-xs text-slate-400">
                شيت مرتب {monthLabel(month)} {month.split("-")[0]} — شركة البنيان لتأجير المعدات الثقيلة
              </div>
            </div>
            <Icon name="salaries" className="w-6 h-6 text-primary" />
          </div>

          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="text-center bg-primary-light rounded-xl py-2.5">
              <div className="text-xs text-slate-500">الإجمالي</div>
              <div className="font-bold text-slate-800">{formatEGP(detail.grossPay)}</div>
            </div>
            <div className="text-center bg-rose-50 rounded-xl py-2.5">
              <div className="text-xs text-slate-500">السلف</div>
              <div className="font-bold text-rose-600">{formatEGP(detail.advancesTotal)}</div>
            </div>
            <div className="text-center bg-primary rounded-xl py-2.5">
              <div className="text-xs text-white/80">الصافي المستحق</div>
              <div className="font-extrabold text-white">{formatEGP(detail.netPay)}</div>
            </div>
          </div>

          {row.wage_type === "daily" && (
            <div className="mb-4">
              <div className="text-xs font-bold text-slate-500 mb-1.5">أيام العمل ({detail.days.length})</div>
              {detail.days.length === 0 ? (
                <div className="text-xs text-slate-400">لسه ملوش أيام مسجلة الشهر ده.</div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-slate-400 border-b border-slate-100">
                      <th className="text-start font-semibold py-1.5">التاريخ</th>
                      <th className="text-start font-semibold py-1.5">المعدة</th>
                      <th className="text-start font-semibold py-1.5">الساعات</th>
                      <th className="text-start font-semibold py-1.5">القيمة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.days.map((d, i) => (
                      <tr key={i} className="border-b border-slate-50 last:border-0">
                        <td className="py-1.5 text-slate-600">{d.date}</td>
                        <td className="py-1.5 text-slate-600">{d.equipment_name}</td>
                        <td className="py-1.5 text-slate-500">{d.actual_hours ?? "—"}</td>
                        <td className="py-1.5 font-semibold text-slate-700">{formatEGP(d.day_value)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          <div>
            <div className="text-xs font-bold text-slate-500 mb-1.5">السلف</div>
            {detail.advances.length > 0 && (
              <ul className="space-y-1 mb-2">
                {detail.advances.map((a) => (
                  <li key={a.id} className="flex items-center justify-between text-sm">
                    <span className="text-slate-600">
                      {a.date} — {formatEGP(a.amount)} — {paymentMethodLabel(a.payment_method)}{" "}
                      {a.note && <span className="text-slate-400">({a.note})</span>}
                    </span>
                    <button onClick={() => handleDeleteAdvance(a.id)} className="text-xs text-rose-500 hover:text-rose-700 font-semibold">
                      حذف
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <form onSubmit={handleAddAdvance} className="flex flex-wrap items-end gap-2">
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
              />
              <input
                type="number"
                min="0"
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">الرواتب</h1>
          <p className="text-sm text-slate-500 mt-1">
            دوس على اسم أي سائق تشوف شيت مرتبه بالتفصيل — الأيام والمعدات والسلف — وتقدر تصوره وتبعتهوله.
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
            <thead>
              <tr className="text-slate-400 border-b border-slate-100">
                <th className="text-start font-semibold py-2">الاسم</th>
                <th className="text-start font-semibold py-2">نوع الأجر</th>
                <th className="text-start font-semibold py-2">أيام العمل</th>
                <th className="text-start font-semibold py-2">الإجمالي</th>
                <th className="text-start font-semibold py-2">السلف</th>
                <th className="text-start font-semibold py-2">الصافي</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <Fragment key={row.id}>
                  <tr className="border-b border-slate-50 last:border-0">
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
                    <td className="py-2.5 font-bold text-primary-dark">{formatEGP(row.net_pay)}</td>
                  </tr>
                  {expandedId === row.id && <PayslipPanel row={row} month={month} onChanged={refresh} />}
                </Fragment>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={5} className="pt-3 text-sm font-bold text-slate-700">
                  إجمالي صافي الرواتب
                </td>
                <td className="pt-3 text-sm font-bold text-primary-dark">{formatEGP(totalNet)}</td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  );
}
