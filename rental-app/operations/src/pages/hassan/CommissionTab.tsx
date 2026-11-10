import { Fragment, FormEvent, useEffect, useState } from "react";
import { hassanApi } from "../../api/client";
import { HassanCommissionSummary, HassanEquipmentCommissionDetail, HassanPenalty } from "../../api/types";
import { monthLabel } from "../../utils/months";
import { formatEGP } from "../../utils/format";
import { person } from "../../person";

function EquipmentCommissionPanel({ equipmentId, month }: { equipmentId: number; month: string }) {
  const [detail, setDetail] = useState<HassanEquipmentCommissionDetail | null>(null);

  useEffect(() => {
    setDetail(null);
    hassanApi.equipmentCommission(equipmentId, month).then(setDetail);
  }, [equipmentId, month]);

  if (!detail) {
    return (
      <tr>
        <td colSpan={2} className="px-4 py-4 text-sm text-slate-400">
          جاري التحميل...
        </td>
      </tr>
    );
  }

  return (
    <tr>
      <td colSpan={2} className="bg-slate-50 px-4 py-5 rounded-xl">
        <div className="bg-white rounded-card shadow-card p-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
            <div className="font-extrabold text-slate-900">{detail.equipment_name}</div>
            <div className="flex items-center gap-2">
              <div className="text-center bg-primary-light rounded-xl px-4 py-2">
                <div className="text-xs text-slate-500">إجمالي الشهر</div>
                <div className="font-bold text-slate-800">{formatEGP(detail.monthTotal)}</div>
              </div>
              <div className="text-center bg-primary rounded-xl px-4 py-2">
                <div className="text-xs text-white/80">إجمالي السنة</div>
                <div className="font-extrabold text-white">{formatEGP(detail.yearTotal)}</div>
              </div>
            </div>
          </div>

          {detail.days.length === 0 ? (
            <div className="text-sm text-slate-400">مفيش كوميشن محسوب على المعدة دي الشهر ده.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-400 border-b border-slate-100">
                  <th className="text-start font-semibold py-1.5">اليوم</th>
                  <th className="text-start font-semibold py-1.5">المصدر</th>
                  <th className="text-start font-semibold py-1.5">الشيفت</th>
                  <th className="text-start font-semibold py-1.5">المقاول بكام</th>
                  <th className="text-start font-semibold py-1.5">السركي بكام</th>
                  <th className="text-start font-semibold py-1.5">كوميشن {person()}</th>
                </tr>
              </thead>
              <tbody>
                {detail.days.map((d, i) => (
                  <tr key={i} className="border-b border-slate-50 last:border-0">
                    <td className="py-1.5 text-slate-500">{d.date}</td>
                    <td className="py-1.5 text-slate-500">
                      {d.source === "expense" ? d.category_name ?? "مصروف" : d.source === "market" ? "سركي سوق" : "سركي/مقاول"}
                    </td>
                    <td className="py-1.5 text-slate-500">{d.source === "paired" ? d.shift_label || "أساسي" : "—"}</td>
                    <td className="py-1.5 text-slate-600">{d.contractor_rate == null ? "—" : formatEGP(d.contractor_rate)}</td>
                    <td className="py-1.5 text-slate-600">{d.driver_rate == null ? "—" : formatEGP(d.driver_rate)}</td>
                    <td className="py-1.5 font-semibold text-primary-dark">{formatEGP(d.commission)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={5} className="pt-2 text-sm font-bold text-slate-700">إجمالي الشهر</td>
                  <td className="pt-2 text-sm font-bold text-primary-dark">{formatEGP(detail.monthTotal)}</td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </td>
    </tr>
  );
}

export default function CommissionTab({ month }: { month: string }) {
  const [summary, setSummary] = useState<HassanCommissionSummary | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [penalties, setPenalties] = useState<HassanPenalty[]>([]);
  const [penaltyDate, setPenaltyDate] = useState(new Date().toISOString().slice(0, 10));
  const [penaltyAmount, setPenaltyAmount] = useState("");
  const [penaltyReason, setPenaltyReason] = useState("");

  const refreshPenalties = () => hassanApi.penaltiesList(month).then(setPenalties);

  useEffect(() => {
    hassanApi.commissionSummary(month).then(setSummary);
    refreshPenalties();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

  async function handleAddPenalty(e: FormEvent) {
    e.preventDefault();
    if (!penaltyAmount) return;
    await hassanApi.penaltyCreate({ date: penaltyDate, amount: Number(penaltyAmount), reason: penaltyReason || null });
    setPenaltyAmount("");
    setPenaltyReason("");
    refreshPenalties();
  }

  async function handleDeletePenalty(id: number) {
    await hassanApi.penaltyRemove(id);
    refreshPenalties();
  }

  const penaltiesTotal = penalties.reduce((sum, p) => sum + p.amount, 0);

  if (!summary) return <div className="text-sm text-slate-400">جاري التحميل...</div>;

  const byEquipment = new Map<number, { equipment_name: string; commission: number }>();
  for (const row of summary.rows) {
    const entry = byEquipment.get(row.equipment_id) ?? { equipment_name: row.equipment_name, commission: 0 };
    entry.commission += row.commission;
    byEquipment.set(row.equipment_id, entry);
  }
  const equipmentTotals = [...byEquipment.entries()]
    .map(([equipment_id, e]) => ({ equipment_id, ...e }))
    .sort((a, b) => b.commission - a.commission);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-card shadow-card p-5">
          <div className="text-sm text-slate-500 font-semibold">إجمالي كوميشن {person()} — {monthLabel(month)}</div>
          <div className="mt-2 text-2xl font-extrabold text-slate-800">{formatEGP(summary.total)}</div>
        </div>
        <div className="bg-white rounded-card shadow-card p-5">
          <div className="text-sm text-slate-500 font-semibold">الجزاءات</div>
          <div className="mt-2 text-2xl font-extrabold text-rose-600">{formatEGP(penaltiesTotal)}</div>
        </div>
        <div className="bg-white rounded-card shadow-card p-5">
          <div className="text-sm text-slate-500 font-semibold">صافي الكوميشن بعد الجزاءات</div>
          <div className="mt-2 text-2xl font-extrabold text-primary">{formatEGP(summary.total - penaltiesTotal)}</div>
        </div>
      </div>

      <div className="bg-white rounded-card shadow-card p-5">
        <h2 className="font-bold text-slate-800 mb-1">جزاءات {person()} — {monthLabel(month)}</h2>
        <p className="text-xs text-slate-400 mb-4">أي جزاء هنا بيتخصم من كوميشن {person()} ومن رصيد خزنته.</p>
        <form onSubmit={handleAddPenalty} className="no-print flex flex-wrap items-end gap-2 mb-4 pb-4 border-b border-slate-100">
          <div>
            <label className="block text-xs text-slate-400 mb-1">التاريخ</label>
            <input
              type="date"
              value={penaltyDate}
              onChange={(e) => setPenaltyDate(e.target.value)}
              className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">القيمة</label>
            <input
              type="number"
              min="0"
              step="any"
              value={penaltyAmount}
              onChange={(e) => setPenaltyAmount(e.target.value)}
              className="w-28 rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">السبب</label>
            <input
              type="text"
              value={penaltyReason}
              onChange={(e) => setPenaltyReason(e.target.value)}
              placeholder="اختياري"
              className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
            />
          </div>
          <button type="submit" className="bg-rose-600 text-white rounded-lg px-4 py-1.5 text-sm font-semibold hover:bg-rose-700">
            إضافة جزاء
          </button>
        </form>
        {penalties.length === 0 ? (
          <div className="text-sm text-slate-400">مفيش جزاءات الشهر ده.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-400 border-b border-slate-100">
                <th className="text-start font-semibold py-2">التاريخ</th>
                <th className="text-start font-semibold py-2">القيمة</th>
                <th className="text-start font-semibold py-2">السبب</th>
                <th className="no-print"></th>
              </tr>
            </thead>
            <tbody>
              {penalties.map((p) => (
                <tr key={p.id} className="border-b border-slate-50 last:border-0">
                  <td className="py-2 text-slate-500">{p.date}</td>
                  <td className="py-2 font-semibold text-rose-600">{formatEGP(p.amount)}</td>
                  <td className="py-2 text-slate-600">{p.reason ?? "—"}</td>
                  <td className="no-print py-2">
                    <button onClick={() => handleDeletePenalty(p.id)} className="text-xs text-rose-500 hover:text-rose-700 font-semibold">
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
        <h2 className="font-bold text-slate-800 mb-1">الكوميشن حسب المعدة — {month}</h2>
        <p className="text-xs text-slate-400 mb-4">دوس على اسم المعدة تشوف شيتها بالتفصيل — يوم بيوم.</p>
        {equipmentTotals.length === 0 ? (
          <div className="text-sm text-slate-400">مفيش كوميشن محسوب الشهر ده.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-400 border-b border-slate-100">
                <th className="text-start font-semibold py-2">المعدة</th>
                <th className="text-start font-semibold py-2">كوميشن الشهر</th>
              </tr>
            </thead>
            <tbody>
              {equipmentTotals.map((e) => (
                <Fragment key={e.equipment_id}>
                  <tr className="border-b border-slate-50 last:border-0">
                    <td className="py-2">
                      <button
                        onClick={() => setExpandedId(expandedId === e.equipment_id ? null : e.equipment_id)}
                        className="font-semibold text-slate-700 hover:text-primary underline decoration-dashed decoration-slate-300 underline-offset-4 hover:decoration-primary"
                        title="دوس تشوف التفاصيل اليومية للمعدة دي بس"
                      >
                        {e.equipment_name}
                      </button>
                    </td>
                    <td className="py-2 font-semibold text-primary-dark">{formatEGP(e.commission)}</td>
                  </tr>
                  {expandedId === e.equipment_id && <EquipmentCommissionPanel equipmentId={e.equipment_id} month={month} />}
                </Fragment>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td className="pt-2 text-sm font-bold text-slate-700">الإجمالي</td>
                <td className="pt-2 text-sm font-bold text-primary-dark">{formatEGP(summary.total)}</td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>

    </div>
  );
}

// خزنة حسن: كوميشنه المتراكم من كل مصادر الكوميشن (السركي/المقاول والسركي
// سوق والمصروفات اللي بتتحسب كوميشن زي المكنيكي) ناقص أي فلوس دفعها هو من
// الخزنة دي — رصيد شخصي بحت، مالوش أي علاقة بخزنة الشركة.
