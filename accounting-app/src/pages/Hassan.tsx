import { Fragment, FormEvent, useEffect, useState } from "react";
import MonthPicker from "../components/equipment/MonthPicker";
import Icon from "../components/Icon";
import { hassanApi } from "../api/client";
import {
  HassanBalance,
  HassanCommissionSummary,
  HassanEquipmentCommissionDetail,
  HassanLedgerEntry,
  HassanLedgerType,
  HassanPartyBalance,
  HassanTreasuryBalance,
  HassanTreasuryExpense,
} from "../api/types";
import { currentMonthKey } from "../utils/months";
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

  useEffect(() => {
    hassanApi.commissionSummary(month).then(setSummary);
  }, [month]);

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
      <div className="bg-white rounded-card shadow-card p-5">
        <div className="text-sm text-slate-500 font-semibold">إجمالي كوميشن حسن — {month}</div>
        <div className="mt-2 text-2xl font-extrabold text-primary">{formatEGP(summary.total)}</div>
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
          <div className="text-xs text-slate-500">كوميشن الشهر</div>
          <div className="font-bold text-slate-800">{formatEGP(balance?.monthCommission ?? 0)}</div>
        </div>
        <div className="text-center bg-rose-50 rounded-xl py-2.5">
          <div className="text-xs text-slate-500">دفع الشهر</div>
          <div className="font-bold text-rose-600">{formatEGP(balance?.monthSpent ?? 0)}</div>
        </div>
        <div className="text-center bg-slate-50 rounded-xl py-2.5">
          <div className="text-xs text-slate-500">إجمالي الكوميشن (كل الوقت)</div>
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
        <form onSubmit={handleAdd} className="flex flex-wrap items-end gap-2 mb-4 pb-4 border-b border-slate-100">
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
                <button onClick={() => handleDelete(e.id)} className="text-xs text-rose-500 hover:text-rose-700 font-semibold">
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
        <h2 className="font-bold text-slate-800 mb-4">حساب حسن الشخصي — {month}</h2>
        <form onSubmit={handleAdd} className="flex flex-wrap items-end gap-2 mb-4 pb-4 border-b border-slate-100">
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
                <th></th>
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
                  <td className="py-2">
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

export default function Hassan() {
  const [month, setMonth] = useState(currentMonthKey());
  const [tab, setTab] = useState<"commission" | "treasury" | "ledger">("commission");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">حسن</h1>
          <p className="text-sm text-slate-500 mt-1">كوميشن حسن على تأجير المعدات، منفصل عن حسابه الشخصي.</p>
        </div>
        <MonthPicker month={month} onChange={setMonth} />
      </div>

      <div className="flex flex-wrap gap-2">
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
      {tab === "ledger" && <LedgerTab month={month} />}
    </div>
  );
}
