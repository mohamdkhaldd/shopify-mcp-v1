import { FormEvent, useEffect, useState } from "react";
import { contractorPaymentsApi, contractorsDashboardApi } from "../../api/client";
import { ContractorDetail } from "../../api/types";
import { formatEGP } from "../../utils/format";
import { PAYMENT_METHODS, paymentMethodLabel } from "../../utils/paymentMethods";
import PrintButton from "../../components/PrintButton";
import { PrintHeader, PrintSignoff } from "../../components/PrintSignoff";
import { currentMonthKey, monthLabel } from "../../utils/months";

// "2026-11" → "نوفمبر 2026"، و"opening" → "رصيد قديم".
function monthName(m: string) {
  return m === "opening" ? "رصيد قديم" : `${monthLabel(m)} ${m.slice(0, 4)}`;
}

function relativeTag(m: string) {
  if (m === "opening") return "";
  const [cy, cm] = currentMonthKey().split("-").map(Number);
  const [y, mm] = m.split("-").map(Number);
  const diff = (cy - y) * 12 + (cm - mm);
  if (diff === 0) return "الشهر ده";
  if (diff === 1) return "الشهر اللي فات";
  if (diff === 2) return "اللي قبله";
  return "";
}

interface ContractorDetailViewProps {
  contractorId: number;
  onBack: () => void;
}

export default function ContractorDetailView({ contractorId, onBack }: ContractorDetailViewProps) {
  const [detail, setDetail] = useState<ContractorDetail | null>(null);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");
  const [note, setNote] = useState("");
  const [forMonth, setForMonth] = useState("");

  const refresh = () => contractorsDashboardApi.detail(contractorId).then(setDetail);

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contractorId]);

  async function handleAddPayment(e: FormEvent) {
    e.preventDefault();
    if (!amount) return;
    await contractorPaymentsApi.create({
      contractor_id: contractorId,
      date,
      amount: Number(amount),
      method,
      note: note || null,
      for_month: forMonth || null,
    });
    setAmount("");
    setNote("");
    setForMonth("");
    await refresh();
  }

  async function handleDeletePayment(id: number) {
    await contractorPaymentsApi.remove(id);
    await refresh();
  }

  if (!detail) return <div className="text-sm text-slate-400">جاري التحميل...</div>;

  return (
    <div className="space-y-6">
      <PrintHeader title={`${detail.contractor.name} — كشف حساب المقاول`} />

      <div className="no-print flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="w-9 h-9 rounded-xl bg-white shadow-card flex items-center justify-center text-slate-500 hover:text-primary"
          >
            ←
          </button>
          <h1 className="text-2xl font-extrabold text-slate-900">{detail.contractor.name}</h1>
        </div>
        <PrintButton />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-card shadow-card p-5">
          <div className="text-sm text-slate-500 font-semibold">إجمالي المستحق عليه</div>
          <div className="mt-2 text-xl font-extrabold text-slate-900">{formatEGP(detail.totalWork)}</div>
        </div>
        <div className="bg-white rounded-card shadow-card p-5">
          <div className="text-sm text-slate-500 font-semibold">إجمالي المدفوع منه</div>
          <div className="mt-2 text-xl font-extrabold text-primary">{formatEGP(detail.totalPaid)}</div>
        </div>
        <div className="bg-white rounded-card shadow-card p-5">
          <div className="text-sm text-slate-500 font-semibold">الباقي عليه</div>
          <div className="mt-2 text-xl font-extrabold text-rose-600">{formatEGP(detail.remaining)}</div>
        </div>
      </div>

      <div className="bg-white rounded-card shadow-card p-5">
        <h2 className="font-bold text-slate-800 mb-1">المستحق عليه شهر بشهر</h2>
        <p className="text-xs text-slate-400 mb-4">
          كل شهر: شغله كان بكام، واتدفع عنه كام، وباقي عليه كام. الدفعة اللي بتحدد إنها عن شهر معين بتروح للشهر ده؛ واللي من غير شهر بتسدد الأقدم الأول.
        </p>
        {detail.months.length === 0 ? (
          <div className="text-sm text-slate-400">لسه ملوش شغل مسجل.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-400 border-b border-slate-100">
                <th className="text-start font-semibold py-2">الشهر</th>
                <th className="text-start font-semibold py-2">الشغل</th>
                <th className="text-start font-semibold py-2">اتدفع عنه</th>
                <th className="text-start font-semibold py-2">الباقي</th>
              </tr>
            </thead>
            <tbody>
              {detail.months.map((m) => (
                <tr key={m.month} className="border-b border-slate-50 last:border-0">
                  <td className="py-2 font-semibold text-slate-700">
                    {monthName(m.month)}
                    {relativeTag(m.month) && <span className="ms-2 text-xs font-semibold text-slate-400">({relativeTag(m.month)})</span>}
                  </td>
                  <td className="py-2 text-slate-700">{formatEGP(m.work)}</td>
                  <td className="py-2 text-primary">{formatEGP(m.paid)}</td>
                  <td className={`py-2 font-bold ${m.remaining > 0 ? "text-rose-600" : "text-emerald-600"}`}>
                    {m.remaining > 0 ? formatEGP(m.remaining) : "خالص ✓"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {detail.advance > 0 && (
          <div className="mt-3 rounded-xl bg-emerald-50 text-emerald-800 px-4 py-2 text-sm font-semibold">
            دافع زيادة (مقدّم) {formatEGP(detail.advance)} — هتتخصم من شغله الجاي.
          </div>
        )}
      </div>

      <div className="bg-white rounded-card shadow-card p-5">
        <h2 className="font-bold text-slate-800 mb-1">توزيع المستحق على المعدات</h2>
        <p className="text-xs text-slate-400 mb-4">اشتغل على أنهي معدة، وقيمة شغله عليها بالظبط — إجمالي الأعمدة دي هو نفسه "إجمالي المستحق عليه" فوق.</p>
        {detail.workByEquipment.length === 0 ? (
          <div className="text-sm text-slate-400">لسه ملوش شغل مسجل على أي معدة.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-400 border-b border-slate-100">
                <th className="text-start font-semibold py-2">المعدة</th>
                <th className="text-start font-semibold py-2">عدد الأيام</th>
                <th className="text-start font-semibold py-2">المستحق من المعدة دي</th>
              </tr>
            </thead>
            <tbody>
              {detail.workByEquipment.map((w) => (
                <tr key={w.equipment_name} className="border-b border-slate-50 last:border-0">
                  <td className="py-2 font-semibold text-slate-700">{w.equipment_name}</td>
                  <td className="py-2 text-slate-500">{w.days}</td>
                  <td className="py-2 font-semibold text-slate-700">{formatEGP(w.totalValue)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={2} className="pt-2 text-sm font-bold text-slate-700">
                  إجمالي كل المعدات
                </td>
                <td className="pt-2 text-sm font-bold text-primary-dark">
                  {formatEGP(detail.workByEquipment.reduce((sum, w) => sum + w.totalValue, 0))}
                </td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>

      <div className="bg-white rounded-card shadow-card p-5">
        <h2 className="font-bold text-slate-800 mb-4">سجل الدفعات</h2>
        <form onSubmit={handleAddPayment} className="no-print flex flex-wrap items-end gap-2 mb-4 pb-4 border-b border-slate-100">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm" />
          <input
            type="number"
            min="0"
            step="any"
            placeholder="القيمة"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-28 rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
          />
          <select value={method} onChange={(e) => setMethod(e.target.value)} className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm">
            {PAYMENT_METHODS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
          <select value={forMonth} onChange={(e) => setForMonth(e.target.value)} className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm">
            <option value="">عن أقدم شهر عليه (تلقائي)</option>
            {[...new Set([currentMonthKey(), ...detail.months.map((m) => m.month)])].map((m) => {
              const row = detail.months.find((r) => r.month === m);
              return (
                <option key={m} value={m}>
                  عن {monthName(m)}
                  {row && row.remaining > 0 ? ` — باقي ${formatEGP(row.remaining)}` : ""}
                </option>
              );
            })}
          </select>
          <input
            type="text"
            placeholder="ملاحظة (اختياري)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
          />
          <button type="submit" className="bg-primary text-white rounded-lg px-4 py-1.5 text-sm font-semibold hover:bg-primary-dark">
            إضافة دفعة
          </button>
        </form>

        {detail.payments.length === 0 ? (
          <div className="text-sm text-slate-400">لسه مفيش دفعات مسجلة.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-400 border-b border-slate-100">
                <th className="text-start font-semibold py-2">التاريخ</th>
                <th className="text-start font-semibold py-2">القيمة</th>
                <th className="text-start font-semibold py-2">عن شهر</th>
                <th className="text-start font-semibold py-2">طريقة الدفع</th>
                <th className="text-start font-semibold py-2">ملاحظة</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {detail.payments.map((p) => (
                <tr key={p.id} className="border-b border-slate-50 last:border-0">
                  <td className="py-2 text-slate-500">{p.date}</td>
                  <td className="py-2 font-semibold text-slate-700">{formatEGP(p.amount)}</td>
                  <td className="py-2 text-slate-500">{p.for_month ? monthName(p.for_month) : "تلقائي"}</td>
                  <td className="py-2 text-slate-500">{paymentMethodLabel(p.method)}</td>
                  <td className="py-2 text-slate-500">{p.note ?? "—"}</td>
                  <td className="py-2">
                    <button onClick={() => handleDeletePayment(p.id)} className="no-print text-xs text-rose-500 hover:text-rose-700 font-semibold">
                      حذف
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <PrintSignoff />
    </div>
  );
}
