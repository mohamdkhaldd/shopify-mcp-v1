import { FormEvent, useEffect, useState } from "react";
import MonthPicker from "../components/equipment/MonthPicker";
import Icon from "../components/Icon";
import { hassanApi } from "../api/client";
import { HassanBalance, HassanCommissionSummary, HassanLedgerEntry, HassanLedgerType } from "../api/types";
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

function CommissionTab({ month }: { month: string }) {
  const [summary, setSummary] = useState<HassanCommissionSummary | null>(null);

  useEffect(() => {
    hassanApi.commissionSummary(month).then(setSummary);
  }, [month]);

  if (!summary) return <div className="text-sm text-slate-400">جاري التحميل...</div>;

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-card shadow-card p-5">
        <div className="text-sm text-slate-500 font-semibold">إجمالي كوميشن حسن — {month}</div>
        <div className="mt-2 text-2xl font-extrabold text-primary">{formatEGP(summary.total)}</div>
      </div>

      <div className="bg-white rounded-card shadow-card p-5">
        {summary.rows.length === 0 ? (
          <div className="text-sm text-slate-400">
            مفيش كوميشن محسوب الشهر ده — الكوميشن بيتحسب تلقائيًا لما يبقى فيه سركي ومقاول لنفس المعدة ونفس اليوم، أو
            كوميشن سركي سوق المُدخل يدويًا.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-400 border-b border-slate-100">
                <th className="text-start font-semibold py-2">المعدة</th>
                <th className="text-start font-semibold py-2">التاريخ</th>
                <th className="text-start font-semibold py-2">المصدر</th>
                <th className="text-start font-semibold py-2">الكوميشن</th>
              </tr>
            </thead>
            <tbody>
              {summary.rows.map((row, i) => (
                <tr key={i} className="border-b border-slate-50 last:border-0">
                  <td className="py-2 font-semibold text-slate-700">{row.equipment_name}</td>
                  <td className="py-2 text-slate-500">{row.date}</td>
                  <td className="py-2 text-slate-500">{row.source === "paired" ? "سركي/مقاول" : "سركي سوق"}</td>
                  <td className="py-2 font-semibold text-primary-dark">{formatEGP(row.commission)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function LedgerTab({ month }: { month: string }) {
  const [entries, setEntries] = useState<HassanLedgerEntry[]>([]);
  const [balance, setBalance] = useState<HassanBalance | null>(null);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [type, setType] = useState<HassanLedgerType>("loan");
  const [amount, setAmount] = useState("");
  const [partyName, setPartyName] = useState("");
  const [description, setDescription] = useState("");

  const refresh = () => {
    hassanApi.ledgerList(month).then(setEntries);
    hassanApi.balance().then(setBalance);
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
  const [tab, setTab] = useState<"commission" | "ledger">("commission");

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

      {tab === "commission" ? <CommissionTab month={month} /> : <LedgerTab month={month} />}
    </div>
  );
}
