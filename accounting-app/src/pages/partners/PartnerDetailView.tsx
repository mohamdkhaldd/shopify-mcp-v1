import { FormEvent, useEffect, useState } from "react";
import { partnerPaymentsApi, partnersDashboardApi } from "../../api/client";
import { PartnerDetail } from "../../api/types";
import { formatEGP } from "../../utils/format";
import { PAYMENT_METHODS, paymentMethodLabel } from "../../utils/paymentMethods";
import { currentMonthKey } from "../../utils/months";
import MonthPicker from "../../components/equipment/MonthPicker";
import PrintButton from "../../components/PrintButton";
import { PrintHeader, PrintSignoff } from "../../components/PrintSignoff";

interface PartnerDetailViewProps {
  partnerId: number;
  onBack: () => void;
}

export default function PartnerDetailView({ partnerId, onBack }: PartnerDetailViewProps) {
  const [month, setMonth] = useState(currentMonthKey());
  const [detail, setDetail] = useState<PartnerDetail | null>(null);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");
  const [note, setNote] = useState("");

  const refresh = () => partnersDashboardApi.detail(partnerId, month).then(setDetail);

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partnerId, month]);

  async function handleAddPayment(e: FormEvent) {
    e.preventDefault();
    if (!amount) return;
    await partnerPaymentsApi.create({ partner_id: partnerId, date, amount: Number(amount), method, note: note || null });
    setAmount("");
    setNote("");
    await refresh();
  }

  async function handleDeletePayment(id: number) {
    await partnerPaymentsApi.remove(id);
    await refresh();
  }

  if (!detail) return <div className="text-sm text-slate-400">جاري التحميل...</div>;

  return (
    <div className="space-y-6">
      <PrintHeader title={`${detail.partner.name} — كشف حساب الشريك`} />

      <div className="no-print flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="w-9 h-9 rounded-xl bg-white shadow-card flex items-center justify-center text-slate-500 hover:text-primary"
          >
            ←
          </button>
          <h1 className="text-2xl font-extrabold text-slate-900">{detail.partner.name}</h1>
        </div>
        <div className="flex items-center gap-2">
          <PrintButton />
          <MonthPicker month={month} onChange={setMonth} />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-card shadow-card p-5">
          <div className="text-sm text-slate-500 font-semibold">إجمالي المستحق له</div>
          <div className="mt-2 text-xl font-extrabold text-slate-900">{formatEGP(detail.totalDue)}</div>
        </div>
        <div className="bg-white rounded-card shadow-card p-5">
          <div className="text-sm text-slate-500 font-semibold">إجمالي المدفوع</div>
          <div className="mt-2 text-xl font-extrabold text-rose-600">{formatEGP(detail.totalPaid)}</div>
        </div>
        <div className="bg-white rounded-card shadow-card p-5">
          <div className="text-sm text-slate-500 font-semibold">الباقي له</div>
          <div className="mt-2 text-xl font-extrabold text-primary">{formatEGP(detail.remaining)}</div>
        </div>
      </div>

      <div className="bg-white rounded-card shadow-card p-5">
        <h2 className="font-bold text-slate-800 mb-4">توزيع المستحق على المعدات — {month}</h2>
        {detail.equipmentBreakdown.length === 0 ? (
          <div className="text-sm text-slate-400">مفيش معدات مرتبطة بالشريك ده.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-400 border-b border-slate-100">
                <th className="text-start font-semibold py-2">المعدة</th>
                <th className="text-start font-semibold py-2">نسبته</th>
                <th className="text-start font-semibold py-2">المستحق هذا الشهر</th>
              </tr>
            </thead>
            <tbody>
              {detail.equipmentBreakdown.map((e) => (
                <tr key={e.equipment_name} className="border-b border-slate-50 last:border-0">
                  <td className="py-2 font-semibold text-slate-700">{e.equipment_name}</td>
                  <td className="py-2 text-slate-500">{e.percentage}%</td>
                  <td className="py-2 font-semibold text-slate-700">{formatEGP(e.monthAmount)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={2} className="pt-2 text-sm font-bold text-slate-700">
                  إجمالي الشهر
                </td>
                <td className="pt-2 text-sm font-bold text-primary-dark">{formatEGP(detail.monthDue)}</td>
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
