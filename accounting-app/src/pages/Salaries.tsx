import { Fragment, FormEvent, useEffect, useState } from "react";
import MonthPicker from "../components/equipment/MonthPicker";
import Icon from "../components/Icon";
import { employeeAdvancesApi, payrollApi } from "../api/client";
import { EmployeeAdvance, PayrollRow } from "../api/types";
import { currentMonthKey } from "../utils/months";
import { formatEGP } from "../utils/format";

function AdvancesPanel({ employeeId, month, onChanged }: { employeeId: number; month: string; onChanged: () => void }) {
  const [advances, setAdvances] = useState<EmployeeAdvance[]>([]);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  const refresh = () => employeeAdvancesApi.list(employeeId, month).then(setAdvances);

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeId, month]);

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    if (!amount) return;
    await employeeAdvancesApi.create({ employee_id: employeeId, date, amount: Number(amount), note: note || null });
    setAmount("");
    setNote("");
    await refresh();
    onChanged();
  }

  async function handleDelete(id: number) {
    await employeeAdvancesApi.remove(id);
    await refresh();
    onChanged();
  }

  return (
    <tr>
      <td colSpan={6} className="bg-slate-50 px-4 py-4 rounded-xl">
        <div className="text-xs font-bold text-slate-500 mb-2">سلف {month}</div>
        <form onSubmit={handleAdd} className="flex flex-wrap items-end gap-2 mb-3">
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
            className="w-28 rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
          />
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
        {advances.length === 0 ? (
          <div className="text-xs text-slate-400">مفيش سلف مسجلة الشهر ده.</div>
        ) : (
          <ul className="space-y-1">
            {advances.map((a) => (
              <li key={a.id} className="flex items-center justify-between text-sm">
                <span className="text-slate-600">
                  {a.date} — {formatEGP(a.amount)} {a.note && <span className="text-slate-400">({a.note})</span>}
                </span>
                <button onClick={() => handleDelete(a.id)} className="text-xs text-rose-500 hover:text-rose-700 font-semibold">
                  حذف
                </button>
              </li>
            ))}
          </ul>
        )}
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
            الأجر اليومي بيتحسب تلقائيًا من سركي كل المعدات اللي اشتغل فيها السائق الشهر ده.
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
                  {expandedId === row.id && (
                    <AdvancesPanel employeeId={row.id} month={month} onChanged={refresh} />
                  )}
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
