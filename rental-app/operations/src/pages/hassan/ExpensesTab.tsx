import { FormEvent, useEffect, useState } from "react";
import { hassanApi } from "../../api/client";
import { HassanTreasuryExpense } from "../../api/types";
import { monthLabel } from "../../utils/months";
import { formatEGP } from "../../utils/format";
import { person } from "../../person";
import { PAYMENT_METHODS, paymentMethodLabel } from "../../utils/paymentMethods";

export default function ExpensesTab({ month }: { month: string }) {
  const [entries, setEntries] = useState<HassanTreasuryExpense[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [method, setMethod] = useState("cash");

  const refresh = () => {
    hassanApi.treasuryList(month).then(setEntries);
    hassanApi.treasuryCategories().then(setCategories);
  };
  useEffect(refresh, [month]);

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    if (!amount || !category.trim()) return;
    await hassanApi.treasuryCreate({ date, amount: Number(amount), category: category.trim(), description: description.trim(), method });
    setAmount("");
    setDescription("");
    refresh();
  }

  async function handleDelete(id: number) {
    await hassanApi.treasuryRemove(id);
    refresh();
  }

  const total = entries.reduce((sum, e) => sum + e.amount, 0);
  const byCategory = Object.entries(
    entries.reduce<Record<string, number>>((acc, e) => {
      const key = e.category || e.description;
      acc[key] = (acc[key] ?? 0) + e.amount;
      return acc;
    }, {})
  ).sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-card shadow-card p-5">
        <h2 className="font-bold text-slate-800 mb-1">مصاريف التشغيل — {monthLabel(month)}</h2>
        <p className="text-xs text-slate-400 mb-4">
          اللي {person()} بيصرفه من كوميشنه — بيطلع من الحساب اللي تختاره في خزنة الشركة، وبيتخصم من كوميشنه.
        </p>
        <form onSubmit={handleAdd} className="no-print flex flex-wrap items-end gap-2 mb-4 pb-4 border-b border-slate-100">
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
            <label className="block text-xs text-slate-400 mb-1">البند</label>
            <input
              type="text"
              list="expense-categories"
              placeholder="زي: إيجار، قسط عربية، أكل"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
            />
            <datalist id="expense-categories">
              {categories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">تفاصيل</label>
            <input
              type="text"
              placeholder="اختياري"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">طالع من</label>
            <select value={method} onChange={(e) => setMethod(e.target.value)} className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm bg-white">
              {PAYMENT_METHODS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className="bg-primary text-white rounded-lg px-4 py-1.5 text-sm font-semibold hover:bg-primary-dark">
            إضافة
          </button>
        </form>

        {entries.length === 0 ? (
          <div className="text-sm text-slate-400">لسه مفيش مصاريف الشهر ده.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-400 border-b border-slate-100">
                <th className="text-start font-semibold py-1.5">التاريخ</th>
                <th className="text-start font-semibold py-1.5">البند</th>
                <th className="text-start font-semibold py-1.5">التفاصيل</th>
                <th className="text-start font-semibold py-1.5">طالع من</th>
                <th className="text-start font-semibold py-1.5">القيمة</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="border-b border-slate-50 last:border-0">
                  <td className="py-1.5 text-slate-500 whitespace-nowrap">{e.date}</td>
                  <td className="py-1.5 font-semibold text-slate-700">{e.category || e.description}</td>
                  <td className="py-1.5 text-slate-500">{e.description !== (e.category || e.description) ? e.description : ""}</td>
                  <td className="py-1.5 text-slate-500">{e.computed ? "—" : e.method ? paymentMethodLabel(e.method) : "قديم"}</td>
                  <td className="py-1.5 font-semibold text-rose-600 whitespace-nowrap">{formatEGP(e.amount)}</td>
                  <td className="py-1.5 text-end">
                    {e.computed ? (
                      <span className="no-print text-[11px] text-slate-400">من صفحة العربية الملاكي</span>
                    ) : (
                      <button onClick={() => handleDelete(e.id as number)} className="no-print text-xs text-rose-500 hover:text-rose-700 font-semibold">
                        حذف
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {byCategory.length > 0 && (
        <div className="bg-white rounded-card shadow-card p-5">
          <h2 className="font-bold text-slate-800 mb-3">صرفت كام على كل بند — {monthLabel(month)}</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
            {byCategory.map(([name, sum]) => (
              <div key={name} className="bg-slate-50 rounded-xl px-3 py-2.5">
                <div className="text-xs text-slate-500 truncate" title={name}>
                  {name}
                </div>
                <div className="font-bold text-slate-800">{formatEGP(sum)}</div>
                <div className="text-[11px] text-slate-400">{total > 0 ? Math.round((sum / total) * 100) : 0}% من الإجمالي</div>
              </div>
            ))}
            <div className="bg-rose-50 rounded-xl px-3 py-2.5">
              <div className="text-xs text-slate-500">الإجمالي</div>
              <div className="font-extrabold text-rose-600">{formatEGP(total)}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// سطر حركة في الحساب الشخصي — بتعديل ومسح.
