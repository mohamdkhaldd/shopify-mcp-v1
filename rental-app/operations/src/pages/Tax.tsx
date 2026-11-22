import { FormEvent, useEffect, useState } from "react";
import { ask } from "../components/Dialogs";
import { TaxSummary, taxApi } from "../api/client";
import MonthPicker from "../components/equipment/MonthPicker";
import PrintButton from "../components/PrintButton";
import { PrintHeader, PrintSignoff } from "../components/PrintSignoff";
import { formatEGP } from "../utils/format";
import { currentMonthKey, monthLabel } from "../utils/months";
import { PAYMENT_METHODS, paymentMethodLabel } from "../utils/paymentMethods";

const cls = "rounded-lg border border-slate-200 px-2 py-1.5 text-sm bg-white";
const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

// الضرايب والملف الضريبي (زي التأجير): مين من المقاولين شركة بضرايب، ونسب
// القيمة المضافة والاستقطاع، وكل شهر: الفاتورة، الـ ١٤٪ اللي بتتورد، والـ ٣٪
// اللي اتخصمت لينا — وتسجيل اللي اتورد للضرايب (بيطلع من الخزنة).
export default function Tax() {
  const [month, setMonth] = useState(currentMonthKey());
  const [data, setData] = useState<TaxSummary | null>(null);
  const [vat, setVat] = useState("");
  const [wht, setWht] = useState("");
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("cash");
  const [payDate, setPayDate] = useState(todayISO());
  const refresh = () =>
    taxApi.summary(month).then((d) => {
      setData(d);
      setVat(String(d.rates.vat));
      setWht(String(d.rates.wht));
    });
  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

  if (!data) return <div className="text-sm text-slate-400">جاري التحميل...</div>;
  const m = data.month;

  async function saveRates() {
    await taxApi.setRates(Number(vat), Number(wht));
    refresh();
  }
  async function pay(e: FormEvent) {
    e.preventDefault();
    if (!payAmount) return;
    await taxApi.pay({ date: payDate, kind: "vat", for_month: month, amount: Number(payAmount), method: payMethod, note: null });
    setPayAmount("");
    refresh();
  }

  return (
    <div className="space-y-6">
      <PrintHeader title="الضرايب" subtitle={`${monthLabel(month)} ${month.slice(0, 4)}`} />
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">الضرايب والملف الضريبي</h1>
          <p className="text-sm text-slate-500 mt-1">
            المقاول اللي شركة بضرايب: الفاتورة عليها {data.rates.vat}٪ قيمة مضافة (بتتورد للضرايب)، وهو بيستقطع {data.rates.wht}٪ من الدفعة. مقاول الباطن من غير ضرايب مبيتحسبش عليه حاجة.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <PrintButton />
          <MonthPicker month={month} onChange={setMonth} />
        </div>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          { label: "شغل الشركات (من غير ضرايب)", v: m.base, tone: "text-slate-900" },
          { label: `قيمة مضافة ${data.rates.vat}٪ — بتتورد`, v: m.vat, tone: "text-amber-700" },
          { label: `استقطاع ${data.rates.wht}٪ — اتخصم لينا`, v: m.wht, tone: "text-sky-700" },
          { label: "قيمة مضافة لسه متوردتش", v: m.vatDue, tone: m.vatDue > 0.005 ? "text-rose-600" : "text-primary-dark" },
        ].map((k) => (
          <div key={k.label} className="bg-white rounded-card shadow-card p-4">
            <div className="text-xs font-semibold text-slate-500">{k.label}</div>
            <div className={`mt-1 text-xl font-extrabold ${k.tone}`}>{formatEGP(k.v)}</div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-card shadow-card p-5">
        <h2 className="font-bold text-slate-800 mb-3">فواتير شهر {monthLabel(month)}</h2>
        {m.rows.length === 0 ? (
          <div className="text-sm text-slate-400">مفيش شغل لشركات بضرايب الشهر ده.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-400 border-b border-slate-100">
                  <th className="text-start font-semibold py-2">المقاول</th>
                  <th className="text-start font-semibold py-2">الشغل</th>
                  <th className="text-start font-semibold py-2">+ قيمة مضافة</th>
                  <th className="text-start font-semibold py-2">= الفاتورة</th>
                  <th className="text-start font-semibold py-2">− استقطاع</th>
                  <th className="text-start font-semibold py-2">المفروض يدفع</th>
                </tr>
              </thead>
              <tbody>
                {m.rows.map((r) => (
                  <tr key={r.id} className="border-b border-slate-50">
                    <td className="py-2 font-bold text-slate-800">{r.name}</td>
                    <td className="py-2">{formatEGP(r.base)}</td>
                    <td className="py-2 text-amber-700">{formatEGP(r.vat)}</td>
                    <td className="py-2 font-semibold">{formatEGP(r.invoice)}</td>
                    <td className="py-2 text-sky-700">{formatEGP(r.wht)}</td>
                    <td className="py-2 font-extrabold">{formatEGP(r.collect)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="bg-white rounded-card shadow-card p-5">
          <h2 className="font-bold text-slate-800 mb-3">ورّدت للضرايب</h2>
          <form onSubmit={pay} className="no-print flex flex-wrap items-end gap-2 mb-4">
            <input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} className={cls} />
            <input type="number" min="0" step="any" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} placeholder={m.vatDue > 0 ? String(Math.round(m.vatDue)) : "المبلغ"} className={`${cls} w-28`} />
            <select value={payMethod} onChange={(e) => setPayMethod(e.target.value)} className={cls}>
              {PAYMENT_METHODS.map((x) => (
                <option key={x.value} value={x.value}>
                  {x.label}
                </option>
              ))}
            </select>
            <button type="submit" disabled={!payAmount} className="bg-primary text-white rounded-lg px-3 py-1.5 text-sm font-semibold disabled:opacity-50">
              ورّدت قيمة مضافة {monthLabel(month)}
            </button>
          </form>
          {data.payments.length === 0 ? (
            <div className="text-sm text-slate-400">مفيش توريدات السنة دي.</div>
          ) : (
            <table className="w-full text-sm">
              <tbody>
                {data.payments.map((p) => (
                  <tr key={p.id} className="border-b border-slate-50">
                    <td className="py-1.5 text-slate-500">{p.date}</td>
                    <td className="py-1.5">عن {p.for_month ? monthLabel(p.for_month) : "—"}</td>
                    <td className="py-1.5 text-xs text-slate-400">{paymentMethodLabel(p.method)}</td>
                    <td className="py-1.5 font-bold">{formatEGP(p.amount)}</td>
                    <td className="no-print py-1.5">
                      <button
                        onClick={async () => {
                          if (!(await ask("تمسح التوريد ده؟"))) return;
                          await taxApi.removePayment(p.id);
                          refresh();
                        }}
                        className="text-xs text-rose-500 font-semibold"
                      >
                        حذف
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="bg-white rounded-card shadow-card p-5">
          <h2 className="font-bold text-slate-800 mb-3">سنة {data.year.year} — شهر بشهر</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-400 border-b border-slate-100">
                <th className="text-start font-semibold py-1.5">الشهر</th>
                <th className="text-start font-semibold py-1.5">الشغل</th>
                <th className="text-start font-semibold py-1.5">قيمة مضافة</th>
                <th className="text-start font-semibold py-1.5">استقطاع</th>
                <th className="text-start font-semibold py-1.5">لسه</th>
              </tr>
            </thead>
            <tbody>
              {data.year.months
                .filter((x) => x.base !== 0 || x.vatPaid !== 0)
                .map((x) => (
                  <tr key={x.month} className="border-b border-slate-50">
                    <td className="py-1.5 font-semibold">{monthLabel(x.month)}</td>
                    <td className="py-1.5">{formatEGP(x.base)}</td>
                    <td className="py-1.5 text-amber-700">{formatEGP(x.vat)}</td>
                    <td className="py-1.5 text-sky-700">{formatEGP(x.wht)}</td>
                    <td className={`py-1.5 font-bold ${x.vatDue > 0.005 ? "text-rose-600" : "text-primary-dark"}`}>{formatEGP(x.vatDue)}</td>
                  </tr>
                ))}
              <tr>
                <td className="pt-2 font-extrabold">السنة</td>
                <td className="pt-2 font-extrabold">{formatEGP(data.year.base)}</td>
                <td className="pt-2 font-extrabold">{formatEGP(data.year.vat)}</td>
                <td className="pt-2 font-extrabold">{formatEGP(data.year.wht)}</td>
                <td className="pt-2 font-extrabold">{formatEGP(data.year.vatDue)}</td>
              </tr>
            </tbody>
          </table>
          <p className="text-xs text-slate-400 mt-2">الاستقطاع ({data.rates.wht}٪) اتخصم من فلوسك واتورد باسمك — بيتخصم من ضريبة الدخل آخر السنة (إقرار السنوي).</p>
        </div>
      </div>

      <div className="no-print bg-white rounded-card shadow-card p-5">
        <h2 className="font-bold text-slate-800 mb-1">المقاولين: شركة بضرايب ولا مقاول باطن؟</h2>
        <p className="text-xs text-slate-400 mb-3">علّم على الشركات اللي بتدّيها فاتورة بضرايب — حسابهم في صفحة المقاولين بيتحسب بالضرايب لوحده.</p>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-slate-400 border-b border-slate-100">
              <th className="text-start font-semibold py-2">المقاول</th>
              <th className="text-start font-semibold py-2">شركة بضرايب</th>
              <th className="text-start font-semibold py-2">قيمة مضافة {data.rates.vat}٪</th>
              <th className="text-start font-semibold py-2">استقطاع {data.rates.wht}٪</th>
            </tr>
          </thead>
          <tbody>
            {data.contractors.map((c) => {
              const set = (patch: Partial<{ is_company: boolean; vat_applies: boolean; wht_applies: boolean }>) =>
                taxApi
                  .setContractor({ id: c.id, is_company: !!c.is_company, vat_applies: !!c.vat_applies, wht_applies: !!c.wht_applies, ...patch })
                  .then(refresh);
              return (
                <tr key={c.id} className="border-b border-slate-50">
                  <td className="py-2 font-bold">{c.name}</td>
                  <td className="py-2">
                    <input type="checkbox" checked={!!c.is_company} onChange={(e) => set(e.target.checked ? { is_company: true, vat_applies: true, wht_applies: true } : { is_company: false })} />
                  </td>
                  <td className="py-2">
                    <input type="checkbox" disabled={!c.is_company} checked={!!c.vat_applies} onChange={(e) => set({ vat_applies: e.target.checked })} />
                  </td>
                  <td className="py-2">
                    <input type="checkbox" disabled={!c.is_company} checked={!!c.wht_applies} onChange={(e) => set({ wht_applies: e.target.checked })} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
          <b className="text-slate-600">النسب:</b>
          قيمة مضافة <input type="number" min="0" step="any" value={vat} onChange={(e) => setVat(e.target.value)} className={`${cls} w-16 text-center`} />٪
          استقطاع <input type="number" min="0" step="any" value={wht} onChange={(e) => setWht(e.target.value)} className={`${cls} w-16 text-center`} />٪
          <button onClick={saveRates} className="bg-slate-100 rounded-lg px-3 py-1.5 font-bold text-slate-600 hover:bg-primary-light">
            حفظ النسب
          </button>
        </div>
      </div>
      <PrintSignoff />
    </div>
  );
}
