import { Fragment, FormEvent, useEffect, useState } from "react";
import MonthPicker from "../components/equipment/MonthPicker";
import PrintButton from "../components/PrintButton";
import { PrintHeader, PrintSignoff } from "../components/PrintSignoff";
import Icon from "../components/Icon";
import { hassanApi } from "../api/client";
import {
  HassanBalance,
  HassanCommissionSummary,
  HassanEquipmentCommissionDetail,
  HassanLedgerEntry,
  HassanLedgerType,
  HassanPartyBalance,
  HassanPenalty,
  HassanTreasuryBalance,
  HassanTreasuryExpense,
  HassanWorker,
  HassanWorkerEntry,
  HassanWorkerEntryType,
  HassanWorkerPayroll,
} from "../api/types";
import { currentMonthKey, monthLabel } from "../utils/months";
import { formatEGP } from "../utils/format";

const LEDGER_TYPES: { value: HassanLedgerType; label: string }[] = [
  { value: "loan", label: "سلفة/دين على حسن" },
  { value: "repayment", label: "سداد من حسن" },
  { value: "due", label: "مستحق لحسن" },
  { value: "collection", label: "تحصيل لحسن" },
];

function typeLabel(type: HassanLedgerType) {
  return LEDGER_TYPES.find((t) => t.value === type)?.label ?? type;
}

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
                  <th className="text-start font-semibold py-1.5">كوميشن حسن</th>
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

function CommissionTab({ month }: { month: string }) {
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
          <div className="text-sm text-slate-500 font-semibold">إجمالي كوميشن حسن — {monthLabel(month)}</div>
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
        <h2 className="font-bold text-slate-800 mb-1">جزاءات حسن — {monthLabel(month)}</h2>
        <p className="text-xs text-slate-400 mb-4">أي جزاء هنا بيتخصم من كوميشن حسن ومن رصيد خزنته.</p>
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
function TreasuryTab({ month }: { month: string }) {
  const [balance, setBalance] = useState<HassanTreasuryBalance | null>(null);
  const [entries, setEntries] = useState<HassanTreasuryExpense[]>([]);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");

  const refresh = () => {
    hassanApi.treasuryBalance(month).then(setBalance);
    hassanApi.treasuryList(month).then(setEntries);
  };

  useEffect(refresh, [month]);

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    if (!amount || !description) return;
    await hassanApi.treasuryCreate({ date, amount: Number(amount), description });
    setAmount("");
    setDescription("");
    refresh();
  }

  async function handleDelete(id: number) {
    await hassanApi.treasuryRemove(id);
    refresh();
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-card shadow-card p-5">
        <div className="text-sm text-slate-500 font-semibold">رصيد خزنة حسن (كل الوقت)</div>
        <div className="mt-2 text-2xl font-extrabold text-primary">{formatEGP(balance?.balance ?? 0)}</div>
        <p className="text-xs text-slate-400 mt-1">بيزيد بكوميشنه كل شهر، وبيقل بس لما هو يدفع منه — مالوش علاقة بخزنة الشركة.</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="text-center bg-primary-light rounded-xl py-2.5">
          <div className="text-xs text-slate-500">كوميشن الشهر (بعد الجزاءات)</div>
          <div className="font-bold text-slate-800">{formatEGP(balance?.monthCommission ?? 0)}</div>
        </div>
        <div className="text-center bg-rose-50 rounded-xl py-2.5">
          <div className="text-xs text-slate-500">دفع الشهر</div>
          <div className="font-bold text-rose-600">{formatEGP(balance?.monthSpent ?? 0)}</div>
        </div>
        <div className="text-center bg-slate-50 rounded-xl py-2.5">
          <div className="text-xs text-slate-500">إجمالي الكوميشن بعد الجزاءات (كل الوقت)</div>
          <div className="font-bold text-slate-700">{formatEGP(balance?.allTimeCommission ?? 0)}</div>
        </div>
        <div className="text-center bg-slate-50 rounded-xl py-2.5">
          <div className="text-xs text-slate-500">إجمالي المدفوع (كل الوقت)</div>
          <div className="font-bold text-slate-700">{formatEGP(balance?.allTimeSpent ?? 0)}</div>
        </div>
      </div>

      <div className="bg-white rounded-card shadow-card p-5">
        <h2 className="font-bold text-slate-800 mb-1">دفع حسن من خزنته — {month}</h2>
        <p className="text-xs text-slate-400 mb-4">زي قسط أو إيجار — بتتخصم من فلوس حسن نفسها، مش من خزنة الشركة.</p>
        <form onSubmit={handleAdd} className="no-print flex flex-wrap items-end gap-2 mb-4 pb-4 border-b border-slate-100">
          <div>
            <label className="block text-xs text-slate-400 mb-1">التاريخ</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
            />
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
            <label className="block text-xs text-slate-400 mb-1">بيان</label>
            <input
              type="text"
              placeholder="زي: قسط عربية، إيجار"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
            />
          </div>
          <button type="submit" className="bg-primary text-white rounded-lg px-4 py-1.5 text-sm font-semibold hover:bg-primary-dark">
            إضافة
          </button>
        </form>

        {entries.length === 0 ? (
          <div className="text-sm text-slate-400">لسه مفيش حاجة اتدفعت من خزنة حسن الشهر ده.</div>
        ) : (
          <ul className="space-y-1">
            {entries.map((e) => (
              <li key={e.id} className="flex items-center justify-between text-sm">
                <span className="text-slate-600">
                  {e.date} — {formatEGP(e.amount)} <span className="text-slate-400">({e.description})</span>
                </span>
                <button onClick={() => handleDelete(e.id)} className="no-print text-xs text-rose-500 hover:text-rose-700 font-semibold">
                  حذف
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function LedgerTab({ month }: { month: string }) {
  const [entries, setEntries] = useState<HassanLedgerEntry[]>([]);
  const [balance, setBalance] = useState<HassanBalance | null>(null);
  const [partyBalances, setPartyBalances] = useState<HassanPartyBalance[]>([]);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [type, setType] = useState<HassanLedgerType>("loan");
  const [amount, setAmount] = useState("");
  const [partyName, setPartyName] = useState("");
  const [description, setDescription] = useState("");

  const refresh = () => {
    hassanApi.ledgerList(month).then(setEntries);
    hassanApi.balance().then(setBalance);
    hassanApi.balanceByParty().then(setPartyBalances);
  };

  useEffect(refresh, [month]);

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    if (!amount) return;
    await hassanApi.ledgerCreate({
      date,
      type,
      amount: Number(amount),
      party_name: partyName || null,
      description: description || null,
      note: null,
    });
    setAmount("");
    setPartyName("");
    setDescription("");
    refresh();
  }

  async function handleDelete(id: number) {
    await hassanApi.ledgerRemove(id);
    refresh();
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white rounded-card shadow-card p-5">
          <div className="text-sm text-slate-500 font-semibold">صافي المديونية على حسن (كل الوقت)</div>
          <div className="mt-2 text-xl font-extrabold text-rose-600">{formatEGP(balance?.netDebt ?? 0)}</div>
        </div>
        <div className="bg-white rounded-card shadow-card p-5">
          <div className="text-sm text-slate-500 font-semibold">صافي المستحق لحسن (كل الوقت)</div>
          <div className="mt-2 text-xl font-extrabold text-primary">{formatEGP(balance?.netDue ?? 0)}</div>
        </div>
      </div>

      <div className="bg-white rounded-card shadow-card p-5">
        <h2 className="font-bold text-slate-800 mb-4">الرصيد بالتفصيل — لكل شخص/جهة</h2>
        {partyBalances.length === 0 ? (
          <div className="text-sm text-slate-400">مفيش أرصدة مفتوحة دلوقتي — كل الحركات المسجلة اتقفلت.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-400 border-b border-slate-100">
                <th className="text-start font-semibold py-2">الجهة/الشخص</th>
                <th className="text-start font-semibold py-2">حسن مديون له بـ</th>
                <th className="text-start font-semibold py-2">مستحق لحسن منه</th>
              </tr>
            </thead>
            <tbody>
              {partyBalances.map((p) => (
                <tr key={p.party_name} className="border-b border-slate-50 last:border-0">
                  <td className="py-2 font-semibold text-slate-700">{p.party_name}</td>
                  <td className="py-2 text-rose-600 font-semibold">{p.netDebt > 0 ? formatEGP(p.netDebt) : "—"}</td>
                  <td className="py-2 text-primary font-semibold">{p.netDue > 0 ? formatEGP(p.netDue) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="bg-white rounded-card shadow-card p-5">
        <h2 className="font-bold text-slate-800 mb-4">حساب حسن الشخصي — {monthLabel(month)} {month.slice(0, 4)}</h2>
        <form onSubmit={handleAdd} className="no-print flex flex-wrap items-end gap-2 mb-4 pb-4 border-b border-slate-100">
          <div>
            <label className="block text-xs text-slate-400 mb-1">التاريخ</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">النوع</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as HassanLedgerType)}
              className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
            >
              {LEDGER_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
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
            <label className="block text-xs text-slate-400 mb-1">الجهة/الشخص</label>
            <input
              type="text"
              value={partyName}
              onChange={(e) => setPartyName(e.target.value)}
              className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">بيان</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
            />
          </div>
          <button type="submit" className="bg-primary text-white rounded-lg px-4 py-1.5 text-sm font-semibold hover:bg-primary-dark">
            إضافة
          </button>
        </form>

        {entries.length === 0 ? (
          <div className="text-sm text-slate-400">لسه مفيش حركات مسجلة الشهر ده.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-400 border-b border-slate-100">
                <th className="text-start font-semibold py-2">التاريخ</th>
                <th className="text-start font-semibold py-2">النوع</th>
                <th className="text-start font-semibold py-2">القيمة</th>
                <th className="text-start font-semibold py-2">الجهة</th>
                <th className="text-start font-semibold py-2">بيان</th>
                <th className="no-print"></th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="border-b border-slate-50 last:border-0">
                  <td className="py-2 text-slate-500">{e.date}</td>
                  <td className="py-2 text-slate-700 font-semibold">{typeLabel(e.type)}</td>
                  <td className="py-2 text-slate-600">{formatEGP(e.amount)}</td>
                  <td className="py-2 text-slate-500">{e.party_name ?? "—"}</td>
                  <td className="py-2 text-slate-500">{e.description ?? "—"}</td>
                  <td className="no-print py-2">
                    <button onClick={() => handleDelete(e.id)} className="text-xs text-rose-500 hover:text-rose-700 font-semibold">
                      حذف
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// خانة تسجيل حركة واحدة (دفعة مرتب / سلفة / حافز / خصم) جوه شيت العامل.
function WorkerEntryForm({
  type,
  workerId,
  month,
  suggestedAmount,
  notePlaceholder,
  noteRequired,
  buttonLabel,
  buttonClass,
  onSaved,
}: {
  type: HassanWorkerEntryType;
  workerId: number;
  month: string;
  suggestedAmount?: number;
  notePlaceholder: string;
  noteRequired?: boolean;
  buttonLabel: string;
  buttonClass: string;
  onSaved: () => void;
}) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (suggestedAmount !== undefined) setAmount(suggestedAmount > 0 ? String(suggestedAmount) : "");
  }, [suggestedAmount]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!amount || (noteRequired && !note.trim())) return;
    await hassanApi.workerEntryCreate({ worker_id: workerId, month, date, type, amount: Number(amount), note: note || null });
    if (suggestedAmount === undefined) setAmount("");
    setNote("");
    onSaved();
  }

  return (
    <form onSubmit={handleSubmit} className="no-print flex flex-wrap items-end gap-2">
      <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm" />
      <input
        type="number"
        min="0"
        step="any"
        placeholder="القيمة"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        className="w-24 rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
      />
      <input
        type="text"
        placeholder={notePlaceholder}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
      />
      <button type="submit" className={`${buttonClass} text-white rounded-lg px-3 py-1.5 text-sm font-semibold`}>
        {buttonLabel}
      </button>
    </form>
  );
}

// شيت مرتب عامل واحد لشهر — زي شيت مرتب السواق في صفحة الرواتب بالظبط:
// المرتب والسلف والحوافز والخصومات ودفعات المرتب، كل حركة بتاريخها وسببها،
// وبيتطبع لوحده.
function WorkerSlip({
  row,
  month,
  entries,
  onChanged,
}: {
  row: HassanWorkerPayroll["rows"][number];
  month: string;
  entries: HassanWorkerEntry[];
  onChanged: () => void;
}) {
  const mine = entries.filter((e) => e.worker_id === row.worker_id).sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id);
  const ofType = (t: HassanWorkerEntryType) => mine.filter((e) => e.type === t);

  async function handleDelete(id: number) {
    await hassanApi.workerEntryRemove(id);
    onChanged();
  }

  const section = (t: HassanWorkerEntryType, title: string, form: JSX.Element) => (
    <div className="mb-4">
      <div className="text-xs font-bold text-slate-500 mb-1.5">{title}</div>
      {ofType(t).length > 0 ? (
        <ul className="space-y-1 mb-2">
          {ofType(t).map((e) => (
            <li key={e.id} className="flex items-center justify-between text-sm">
              <span className="text-slate-600">
                {e.date} — {formatEGP(e.amount)} {e.note && <span className="text-slate-400">({e.note})</span>}
              </span>
              <button onClick={() => handleDelete(e.id)} className="no-print text-xs text-rose-500 hover:text-rose-700 font-semibold">
                حذف
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="text-xs text-slate-400 mb-2">مفيش.</div>
      )}
      {form}
    </div>
  );

  return (
    <tr>
      <td colSpan={9} className="bg-slate-50 px-4 py-5 rounded-xl">
        <div className="bg-white rounded-card shadow-card p-5 max-w-2xl">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
            <div>
              <div className="font-extrabold text-slate-900">
                {row.name}
                {row.job && <span className="text-sm font-semibold text-slate-400"> — {row.job}</span>}
              </div>
              <div className="text-xs text-slate-400">
                شيت مرتب {monthLabel(month)} {month.slice(0, 4)} — عمال حسن
              </div>
            </div>
            <div className="flex items-center gap-2">
              <PrintButton />
              <Icon name="salaries" className="w-6 h-6 text-primary no-print" />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 mb-4">
            <div className="text-center bg-primary-light rounded-xl py-2.5">
              <div className="text-xs text-slate-500">المرتب الشهري</div>
              <div className="font-bold text-slate-800">{formatEGP(row.monthly_salary)}</div>
            </div>
            <div className="text-center bg-emerald-50 rounded-xl py-2.5">
              <div className="text-xs text-slate-500">الحافز</div>
              <div className="font-bold text-emerald-600">{formatEGP(row.bonuses)}</div>
            </div>
            <div className="text-center bg-rose-50 rounded-xl py-2.5">
              <div className="text-xs text-slate-500">الخصم</div>
              <div className="font-bold text-rose-600">{formatEGP(row.deductions)}</div>
            </div>
            <div className="text-center bg-rose-50 rounded-xl py-2.5">
              <div className="text-xs text-slate-500">السلف</div>
              <div className="font-bold text-rose-600">{formatEGP(row.advances)}</div>
            </div>
            <div className="text-center bg-primary rounded-xl py-2.5">
              <div className="text-xs text-white/80">المستحق</div>
              <div className="font-extrabold text-white">{formatEGP(row.net)}</div>
            </div>
          </div>

          <div className="flex items-center justify-between bg-slate-50 rounded-xl px-4 py-3 mb-4">
            <div>
              <div className="text-xs text-slate-500">اتدفع (مرتب + سلف)</div>
              <div className="font-bold text-emerald-600">{formatEGP(row.paid)}</div>
            </div>
            <div className="text-end">
              <div className="text-xs text-slate-500">الباقي</div>
              <div className={`font-extrabold ${row.remaining > 0 ? "text-rose-600" : "text-slate-800"}`}>{formatEGP(row.remaining)}</div>
            </div>
          </div>

          {section(
            "payment",
            "دفع المرتب",
            <WorkerEntryForm
              type="payment"
              workerId={row.worker_id}
              month={month}
              suggestedAmount={row.remaining}
              notePlaceholder="ملاحظة (اختياري)"
              buttonLabel="دفعت المرتب"
              buttonClass="bg-primary hover:bg-primary-dark"
              onSaved={onChanged}
            />
          )}
          {section(
            "advance",
            "السلف",
            <WorkerEntryForm
              type="advance"
              workerId={row.worker_id}
              month={month}
              notePlaceholder="ملاحظة (اختياري)"
              buttonLabel="إضافة سلفة"
              buttonClass="bg-primary hover:bg-primary-dark"
              onSaved={onChanged}
            />
          )}
          {section(
            "bonus",
            "الحافز",
            <WorkerEntryForm
              type="bonus"
              workerId={row.worker_id}
              month={month}
              notePlaceholder="الحافز ده عشان إيه؟"
              noteRequired
              buttonLabel="إضافة حافز"
              buttonClass="bg-emerald-600 hover:bg-emerald-700"
              onSaved={onChanged}
            />
          )}
          {section(
            "deduction",
            "الخصم",
            <WorkerEntryForm
              type="deduction"
              workerId={row.worker_id}
              month={month}
              notePlaceholder="سبب الخصم"
              noteRequired
              buttonLabel="إضافة خصم"
              buttonClass="bg-rose-600 hover:bg-rose-700"
              onSaved={onChanged}
            />
          )}
          <p className="no-print text-xs text-slate-400">
            دفعة المرتب والسلفة بيتخصموا من خزنة حسن على طول ويظهروا هناك باسم العامل. الحافز والخصم بيغيّروا المستحق بس.
          </p>
        </div>
      </td>
    </tr>
  );
}

// شيت مرتبات العمال اللي حسن بيقبضهم من كوميشنه — دوس على اسم العامل تفتح
// شيت مرتبه وتسجل له كل حاجة وتطبعه.
function WorkersTab({ month }: { month: string }) {
  const [workers, setWorkers] = useState<HassanWorker[]>([]);
  const [payroll, setPayroll] = useState<HassanWorkerPayroll | null>(null);
  const [entries, setEntries] = useState<HassanWorkerEntry[]>([]);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const [newName, setNewName] = useState("");
  const [newJob, setNewJob] = useState("");
  const [newSalary, setNewSalary] = useState("");

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editJob, setEditJob] = useState("");
  const [editSalary, setEditSalary] = useState("");

  const refresh = () => {
    hassanApi.workersList().then(setWorkers);
    hassanApi.workersPayroll(month).then(setPayroll);
    hassanApi.workerEntriesList(month).then(setEntries);
  };

  useEffect(refresh, [month]);

  async function handleAddWorker(e: FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    await hassanApi.workerCreate({ name: newName, job: newJob || null, monthly_salary: Number(newSalary) || 0, start_month: month });
    setNewName("");
    setNewJob("");
    setNewSalary("");
    refresh();
  }

  function startEdit(w: HassanWorker) {
    setEditingId(w.id);
    setEditName(w.name);
    setEditJob(w.job ?? "");
    setEditSalary(String(w.monthly_salary));
  }

  async function saveEdit() {
    if (editingId == null || !editName.trim()) return;
    await hassanApi.workerUpdate({ id: editingId, name: editName, job: editJob || null, monthly_salary: Number(editSalary) || 0 });
    setEditingId(null);
    refresh();
  }

  async function handleRemoveWorker(w: HassanWorker) {
    if (!window.confirm(`تشيل ${w.name} من قائمة عمال حسن؟ حركاته القديمة هتفضل زي ما هي.`)) return;
    await hassanApi.workerRemove(w.id);
    refresh();
  }

  // لما شيت عامل يبقى مفتوح، الطباعة بتطلع شيته هو بس.
  const slipOpen = expandedId != null;

  return (
    <div className="space-y-4">
      <div className={`${slipOpen ? "no-print " : ""}grid grid-cols-1 sm:grid-cols-3 gap-4`}>
        <div className="bg-white rounded-card shadow-card p-5">
          <div className="text-sm text-slate-500 font-semibold">إجمالي المستحق للعمال — {monthLabel(month)}</div>
          <div className="mt-2 text-2xl font-extrabold text-slate-800">{formatEGP(payroll?.totalNet ?? 0)}</div>
        </div>
        <div className="bg-white rounded-card shadow-card p-5">
          <div className="text-sm text-slate-500 font-semibold">اتصرف من خزنة حسن</div>
          <div className="mt-2 text-2xl font-extrabold text-rose-600">{formatEGP(payroll?.totalPaid ?? 0)}</div>
        </div>
        <div className="bg-white rounded-card shadow-card p-5">
          <div className="text-sm text-slate-500 font-semibold">الباقي للعمال</div>
          <div className="mt-2 text-2xl font-extrabold text-primary">{formatEGP(payroll?.totalRemaining ?? 0)}</div>
        </div>
      </div>

      <div className="bg-white rounded-card shadow-card p-5">
        <h2 className={`${slipOpen ? "no-print " : ""}font-bold text-slate-800 mb-1`}>
          شيت مرتبات عمال حسن — {monthLabel(month)} {month.slice(0, 4)}
        </h2>
        <p className="no-print text-xs text-slate-400 mb-4">دوس على اسم أي عامل تفتح شيت مرتبه — تسجل له دفع المرتب والسلف والحافز والخصم وتطبعه.</p>
        {!payroll || payroll.rows.length === 0 ? (
          <div className="text-sm text-slate-400">لسه مفيش عمال — ضيفهم من تحت.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className={slipOpen ? "no-print" : ""}>
                <tr className="text-slate-400 border-b border-slate-100">
                  <th className="text-start font-semibold py-2">العامل</th>
                  <th className="text-start font-semibold py-2">الوظيفة</th>
                  <th className="text-start font-semibold py-2">المرتب الشهري</th>
                  <th className="text-start font-semibold py-2">حوافز</th>
                  <th className="text-start font-semibold py-2">خصومات</th>
                  <th className="text-start font-semibold py-2">المستحق</th>
                  <th className="text-start font-semibold py-2">سلف</th>
                  <th className="text-start font-semibold py-2">دفعات مرتب</th>
                  <th className="text-start font-semibold py-2">الباقي</th>
                </tr>
              </thead>
              <tbody>
                {payroll.rows.map((r) => (
                  <Fragment key={r.worker_id}>
                    <tr className={`${slipOpen ? "no-print " : ""}border-b border-slate-50 last:border-0`}>
                      <td className="py-2">
                        <button
                          onClick={() => setExpandedId(expandedId === r.worker_id ? null : r.worker_id)}
                          className="flex items-center gap-2 font-semibold text-slate-700 hover:text-primary"
                        >
                          <Icon name="salaries" className="w-4 h-4 text-primary no-print" />
                          {r.name}
                          {!r.active && <span className="text-xs text-slate-400"> (اتشال)</span>}
                        </button>
                      </td>
                      <td className="py-2 text-slate-500">{r.job ?? "—"}</td>
                      <td className="py-2 text-slate-600">{formatEGP(r.monthly_salary)}</td>
                      <td className="py-2 text-slate-600">{formatEGP(r.bonuses)}</td>
                      <td className="py-2 text-rose-500">{formatEGP(r.deductions)}</td>
                      <td className="py-2 font-semibold text-slate-800">{formatEGP(r.net)}</td>
                      <td className="py-2 text-slate-600">{formatEGP(r.advances)}</td>
                      <td className="py-2 text-slate-600">{formatEGP(r.payments)}</td>
                      <td className={["py-2 font-bold", r.remaining > 0 ? "text-primary-dark" : r.remaining < 0 ? "text-rose-600" : "text-slate-500"].join(" ")}>
                        {formatEGP(r.remaining)}
                      </td>
                    </tr>
                    {expandedId === r.worker_id && <WorkerSlip row={r} month={month} entries={entries} onChanged={refresh} />}
                  </Fragment>
                ))}
              </tbody>
              <tfoot className={slipOpen ? "no-print" : ""}>
                <tr className="border-t border-slate-100">
                  <td colSpan={5} className="pt-3 font-bold text-slate-700">
                    الإجمالي
                  </td>
                  <td className="pt-3 font-bold text-slate-800">{formatEGP(payroll.totalNet)}</td>
                  <td colSpan={2} className="pt-3 font-bold text-rose-600">
                    {formatEGP(payroll.totalPaid)}
                  </td>
                  <td className="pt-3 font-bold text-primary-dark">{formatEGP(payroll.totalRemaining)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
      <div className="no-print bg-white rounded-card shadow-card p-5">
        <h2 className="font-bold text-slate-800 mb-4">عمال حسن</h2>
        <form onSubmit={handleAddWorker} className="flex flex-wrap items-end gap-2 mb-4 pb-4 border-b border-slate-100">
          <div>
            <label className="block text-xs text-slate-400 mb-1">اسم العامل</label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">الوظيفة</label>
            <input
              type="text"
              value={newJob}
              onChange={(e) => setNewJob(e.target.value)}
              placeholder="اختياري"
              className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">المرتب الشهري</label>
            <input
              type="number"
              min="0"
              step="any"
              value={newSalary}
              onChange={(e) => setNewSalary(e.target.value)}
              className="w-28 rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={!newName.trim()}
            className="bg-primary text-white rounded-lg px-4 py-1.5 text-sm font-semibold hover:bg-primary-dark disabled:opacity-50"
          >
            إضافة عامل
          </button>
        </form>
        <p className="text-xs text-slate-400 mb-3">العامل الجديد بيظهر في الشيت من الشهر اللي إنت فاتحه دلوقتي ورايح.</p>

        {workers.length === 0 ? (
          <div className="text-sm text-slate-400">لسه مفيش عمال.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-400 border-b border-slate-100">
                <th className="text-start font-semibold py-2">الاسم</th>
                <th className="text-start font-semibold py-2">الوظيفة</th>
                <th className="text-start font-semibold py-2">المرتب الشهري</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {workers.map((w) =>
                editingId === w.id ? (
                  <tr key={w.id} className="border-b border-slate-50 last:border-0">
                    <td className="py-1.5">
                      <input value={editName} onChange={(e) => setEditName(e.target.value)} className="rounded-lg border border-slate-200 px-2 py-1 text-sm" />
                    </td>
                    <td className="py-1.5">
                      <input value={editJob} onChange={(e) => setEditJob(e.target.value)} className="rounded-lg border border-slate-200 px-2 py-1 text-sm" />
                    </td>
                    <td className="py-1.5">
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={editSalary}
                        onChange={(e) => setEditSalary(e.target.value)}
                        className="w-28 rounded-lg border border-slate-200 px-2 py-1 text-sm"
                      />
                    </td>
                    <td className="py-1.5 whitespace-nowrap">
                      <button onClick={saveEdit} className="text-xs text-primary font-semibold me-3">
                        حفظ
                      </button>
                      <button onClick={() => setEditingId(null)} className="text-xs text-slate-400 font-semibold">
                        إلغاء
                      </button>
                    </td>
                  </tr>
                ) : (
                  <tr key={w.id} className="border-b border-slate-50 last:border-0">
                    <td className="py-2 font-semibold text-slate-700">{w.name}</td>
                    <td className="py-2 text-slate-500">{w.job ?? "—"}</td>
                    <td className="py-2 text-slate-600">{formatEGP(w.monthly_salary)}</td>
                    <td className="py-2 whitespace-nowrap">
                      <button onClick={() => startEdit(w)} className="text-xs text-primary font-semibold me-3">
                        تعديل
                      </button>
                      <button onClick={() => handleRemoveWorker(w)} className="text-xs text-rose-500 hover:text-rose-700 font-semibold">
                        شيل
                      </button>
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default function Hassan() {
  const [month, setMonth] = useState(currentMonthKey());
  const [tab, setTab] = useState<"commission" | "treasury" | "workers" | "ledger">("commission");
  const printTitle =
    tab === "ledger"
      ? "حساب حسن الشخصي"
      : tab === "treasury"
        ? "خزنة حسن"
        : tab === "workers"
          ? "مرتبات عمال حسن"
          : "كوميشن حسن";

  return (
    <div className="space-y-6">
      <PrintHeader title={printTitle} subtitle={`${monthLabel(month)} ${month.slice(0, 4)}`} />

      <div className="no-print flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">حسن</h1>
          <p className="text-sm text-slate-500 mt-1">كوميشن حسن على تأجير المعدات، منفصل عن حسابه الشخصي.</p>
        </div>
        <div className="flex items-center gap-2">
          <PrintButton />
          <MonthPicker month={month} onChange={setMonth} />
        </div>
      </div>

      <div className="no-print flex flex-wrap gap-2">
        <button
          onClick={() => setTab("commission")}
          className={[
            "flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-colors",
            tab === "commission" ? "bg-primary text-white shadow-sm" : "bg-white text-slate-600 hover:bg-primary-light hover:text-primary-dark shadow-card",
          ].join(" ")}
        >
          <Icon name="reports" className="w-4 h-4" />
          الكوميشن
        </button>
        <button
          onClick={() => setTab("treasury")}
          className={[
            "flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-colors",
            tab === "treasury" ? "bg-primary text-white shadow-sm" : "bg-white text-slate-600 hover:bg-primary-light hover:text-primary-dark shadow-card",
          ].join(" ")}
        >
          <Icon name="treasury" className="w-4 h-4" />
          الخزنة
        </button>
        <button
          onClick={() => setTab("workers")}
          className={[
            "flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-colors",
            tab === "workers" ? "bg-primary text-white shadow-sm" : "bg-white text-slate-600 hover:bg-primary-light hover:text-primary-dark shadow-card",
          ].join(" ")}
        >
          <Icon name="salaries" className="w-4 h-4" />
          مرتبات العمال
        </button>
        <button
          onClick={() => setTab("ledger")}
          className={[
            "flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-colors",
            tab === "ledger" ? "bg-primary text-white shadow-sm" : "bg-white text-slate-600 hover:bg-primary-light hover:text-primary-dark shadow-card",
          ].join(" ")}
        >
          <Icon name="hassan" className="w-4 h-4" />
          الحساب الشخصي
        </button>
      </div>

      {tab === "commission" && <CommissionTab month={month} />}
      {tab === "treasury" && <TreasuryTab month={month} />}
      {tab === "workers" && <WorkersTab month={month} />}
      {tab === "ledger" && <LedgerTab month={month} />}

      <PrintSignoff />
    </div>
  );
}
