import { FormEvent, useEffect, useState } from "react";
import { fundsApi } from "../../api/client";
import { FundDetail, FundSummary } from "../../api/types";
import { formatEGP } from "../../utils/format";
import { monthLabel } from "../../utils/months";

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const inputCls = "rounded-lg border border-slate-200 px-2 py-1.5 text-sm bg-white";

// خزنة واحدة (المكنيكي مثلًا): اللي دخلها الشهر ده من المعدات، واللي اتصرف منها.
function FundCard({ fund, month, onChanged }: { fund: FundSummary; month: string; onChanged: () => void }) {
  const [detail, setDetail] = useState<FundDetail | null>(null);
  const [date, setDate] = useState(todayISO());
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");

  const refresh = () => fundsApi.detail(fund.category_id, month).then(setDetail);
  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fund.category_id, month, fund.allOut, fund.allIn]);

  async function add(e: FormEvent) {
    e.preventDefault();
    if (!amount) return;
    await fundsApi.addExpense({ category_id: fund.category_id, date, amount: Number(amount), description: description || null });
    setAmount("");
    setDescription("");
    onChanged();
  }

  async function remove(id: number) {
    if (!window.confirm("تمسح الصرف ده؟")) return;
    await fundsApi.removeExpense(id);
    onChanged();
  }

  return (
    <div className="bg-white rounded-card shadow-card p-5 space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-bold text-slate-800">خزنة {fund.name}</h2>
        <div className="text-sm text-slate-500">
          الرصيد (كل الوقت): <span className={`text-xl font-extrabold ${fund.balance >= 0 ? "text-primary" : "text-rose-600"}`}>{formatEGP(fund.balance)}</span>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        <div className="text-center bg-primary-light rounded-xl py-2.5">
          <div className="text-xs text-slate-500">دخل {monthLabel(month)}</div>
          <div className="font-bold text-primary-dark">{formatEGP(fund.monthIn)}</div>
        </div>
        <div className="text-center bg-rose-50 rounded-xl py-2.5">
          <div className="text-xs text-slate-500">اتصرف {monthLabel(month)}</div>
          <div className="font-bold text-rose-600">{formatEGP(fund.monthOut)}</div>
        </div>
        <div className="text-center bg-slate-50 rounded-xl py-2.5">
          <div className="text-xs text-slate-500">فاضل من الشهر ده</div>
          <div className="font-bold text-slate-800">{formatEGP(fund.monthIn - fund.monthOut)}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div>
          <div className="text-xs font-bold text-slate-500 mb-1.5">دخل من المعدات</div>
          {!detail || detail.incoming.length === 0 ? (
            <div className="text-xs text-slate-400">مفيش الشهر ده.</div>
          ) : (
            <table className="w-full text-sm">
              <tbody>
                {detail.incoming.map((r) => (
                  <tr key={r.id} className="border-b border-slate-50 last:border-0">
                    <td className="py-1.5 text-slate-500 whitespace-nowrap">{r.date}</td>
                    <td className="py-1.5 text-slate-700">{r.equipment_name}</td>
                    <td className="py-1.5 text-slate-400">{r.note ?? ""}</td>
                    <td className="py-1.5 font-semibold text-primary-dark">{formatEGP(r.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div>
          <div className="text-xs font-bold text-slate-500 mb-1.5">اتصرف منها</div>
          {detail && detail.outgoing.length > 0 && (
            <table className="w-full text-sm mb-2">
              <tbody>
                {detail.outgoing.map((r) => (
                  <tr key={r.id} className="border-b border-slate-50 last:border-0">
                    <td className="py-1.5 text-slate-500 whitespace-nowrap">{r.date}</td>
                    <td className="py-1.5 text-slate-700">{r.description ?? ""}</td>
                    <td className="py-1.5 font-semibold text-rose-600">{formatEGP(r.amount)}</td>
                    <td className="no-print py-1.5 text-end">
                      <button onClick={() => remove(r.id)} className="text-xs text-rose-500 font-semibold">
                        حذف
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <form onSubmit={add} className="no-print flex flex-wrap items-end gap-2">
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
            <input type="number" min="0" step="any" placeholder="المبلغ" value={amount} onChange={(e) => setAmount(e.target.value)} className={`${inputCls} w-28`} />
            <input placeholder="اتصرف في إيه؟" value={description} onChange={(e) => setDescription(e.target.value)} className={inputCls} />
            <button type="submit" className="bg-rose-600 text-white rounded-lg px-3 py-1.5 text-sm font-semibold hover:bg-rose-700">
              سجّل صرف
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

// الخزن اللي لوحدها (المكنيكي، السكن...) — مش داخلة في خزنة الكوميشن.
export default function FundsTab({ month }: { month: string }) {
  const [funds, setFunds] = useState<FundSummary[] | null>(null);
  const refresh = () => fundsApi.list(month).then(setFunds);
  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

  if (!funds) return <div className="text-sm text-slate-400">جاري التحميل...</div>;
  if (funds.length === 0) {
    return (
      <div className="bg-white rounded-card shadow-card p-6 text-sm text-slate-500">
        مفيش خزن لوحدها لسه. من الإعدادات ← أنواع المصروفات، اختار "خزنة لوحدها" قدام النوع (زي المكنيكي أو السكن).
      </div>
    );
  }
  return (
    <div className="space-y-4">
      {funds.map((f) => (
        <FundCard key={f.category_id} fund={f} month={month} onChanged={refresh} />
      ))}
    </div>
  );
}
