import { useState } from "react";
import MonthBar from "../components/MonthBar";
import {
  addHassanLedgerEntry,
  addHassanTreasuryExpense,
  deleteHassanLedgerEntry,
  deleteHassanTreasuryExpense,
  hassanLedgerBalance,
  listHassanLedger,
  listHassanTreasuryExpenses,
} from "../store";
import { pushUndo } from "../undo";
import { HassanLedgerType } from "../types";

function formatEGP(value: number): string {
  return `${Math.round(value).toLocaleString("ar-EG")} ج.م`;
}

const LEDGER_TYPES: { value: HassanLedgerType; label: string }[] = [
  { value: "loan", label: "سلفة/دين على حسن" },
  { value: "repayment", label: "سداد من حسن" },
  { value: "due", label: "مستحق لحسن" },
  { value: "collection", label: "تحصيل لحسن" },
];

function typeLabel(type: HassanLedgerType) {
  return LEDGER_TYPES.find((t) => t.value === type)?.label ?? type;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function LedgerTab({ month }: { month: string }) {
  const [entries, setEntries] = useState(() => listHassanLedger(month));
  const [balance, setBalance] = useState(() => hassanLedgerBalance());
  const [date, setDate] = useState(todayIso());
  const [type, setType] = useState<HassanLedgerType>("loan");
  const [amount, setAmount] = useState("");
  const [partyName, setPartyName] = useState("");
  const [description, setDescription] = useState("");

  function refresh() {
    setEntries(listHassanLedger(month));
    setBalance(hassanLedgerBalance());
  }

  function save() {
    if (!amount) return;
    addHassanLedgerEntry({
      date,
      type,
      amount: Number(amount),
      party_name: partyName.trim() || null,
      description: description.trim() || null,
      note: null,
    });
    setAmount("");
    setPartyName("");
    setDescription("");
    refresh();
  }

  function remove(id: number) {
    const entry = entries.find((e) => e.id === id);
    if (!entry) return;
    deleteHassanLedgerEntry(id);
    refresh();
    pushUndo("اتمسحت حركة من حساب حسن", () => {
      addHassanLedgerEntry({
        date: entry.date,
        type: entry.type,
        amount: entry.amount,
        party_name: entry.party_name,
        description: entry.description,
        note: entry.note,
      });
      refresh();
    });
  }

  return (
    <div className="p-4 space-y-3">
      <div className="grid grid-cols-2 gap-2.5">
        <div className="bg-white rounded-2xl shadow-card p-3.5 text-center">
          <div className="text-[11px] text-slate-500">مديون بيها حسن (كل الوقت)</div>
          <div className="mt-1 font-extrabold text-rose-600">{formatEGP(balance.netDebt)}</div>
        </div>
        <div className="bg-white rounded-2xl shadow-card p-3.5 text-center">
          <div className="text-[11px] text-slate-500">مستحق لحسن (كل الوقت)</div>
          <div className="mt-1 font-extrabold text-primary-dark">{formatEGP(balance.netDue)}</div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-card p-4 space-y-2">
        <div className="text-sm font-extrabold text-slate-700">تسجيل حركة</div>
        <div>
          <label className="block text-[11px] text-slate-500 mb-1">التاريخ</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-[11px] text-slate-500 mb-1">النوع</label>
          <select value={type} onChange={(e) => setType(e.target.value as HassanLedgerType)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm">
            {LEDGER_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[11px] text-slate-500 mb-1">القيمة</label>
          <input type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-[11px] text-slate-500 mb-1">الجهة/الشخص</label>
          <input value={partyName} onChange={(e) => setPartyName(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-[11px] text-slate-500 mb-1">بيان</label>
          <input value={description} onChange={(e) => setDescription(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
        </div>
        <button onClick={save} disabled={!amount} className="w-full bg-primary text-white rounded-xl py-2.5 text-sm font-bold disabled:opacity-50">
          حفظ
        </button>
      </div>

      <div className="space-y-2">
        {entries.length === 0 ? (
          <div className="text-sm text-slate-400 text-center py-4">لسه مفيش حركات مسجلة الشهر ده.</div>
        ) : (
          entries.map((e) => (
            <div key={e.id} className="bg-white rounded-xl border border-slate-200 px-3 py-2.5 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-700">{typeLabel(e.type)}</span>
                <span className="font-bold text-primary-dark">{formatEGP(e.amount)}</span>
              </div>
              <div className="flex items-center justify-between mt-1 text-[11px] text-slate-400">
                <span>
                  {e.date} {e.party_name && `— ${e.party_name}`} {e.description && `(${e.description})`}
                </span>
                <button onClick={() => remove(e.id)} className="text-rose-500 font-bold">
                  مسح
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function TreasuryTab({ month }: { month: string }) {
  const [entries, setEntries] = useState(() => listHassanTreasuryExpenses(month));
  const [date, setDate] = useState(todayIso());
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");

  function refresh() {
    setEntries(listHassanTreasuryExpenses(month));
  }

  function save() {
    if (!amount || !description) return;
    addHassanTreasuryExpense({ date, amount: Number(amount), description });
    setAmount("");
    setDescription("");
    refresh();
  }

  function remove(id: number) {
    const entry = entries.find((e) => e.id === id);
    if (!entry) return;
    deleteHassanTreasuryExpense(id);
    refresh();
    pushUndo("اتمسح مصروف من خزنة حسن", () => {
      addHassanTreasuryExpense({ date: entry.date, amount: entry.amount, description: entry.description });
      refresh();
    });
  }

  const total = entries.reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className="p-4 space-y-3">
      <div className="bg-white rounded-2xl shadow-card p-3.5">
        <div className="text-[11px] text-slate-500">دفع حسن من خزنته الشخصية — الشهر ده</div>
        <div className="mt-1 font-extrabold text-rose-600">{formatEGP(total)}</div>
        <p className="text-[10px] text-slate-400 mt-1">الكوميشن ورصيد الخزنة الكامل بيتحسبوا من اللاب — هنا بس تقدر تسجل اللي حسن دفعه.</p>
      </div>

      <div className="bg-white rounded-2xl shadow-card p-4 space-y-2">
        <div className="text-sm font-extrabold text-slate-700">تسجيل دفع</div>
        <div>
          <label className="block text-[11px] text-slate-500 mb-1">التاريخ</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-[11px] text-slate-500 mb-1">القيمة</label>
          <input type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-[11px] text-slate-500 mb-1">بيان</label>
          <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="زي: قسط عربية، إيجار" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
        </div>
        <button onClick={save} disabled={!amount || !description} className="w-full bg-primary text-white rounded-xl py-2.5 text-sm font-bold disabled:opacity-50">
          حفظ
        </button>
      </div>

      <div className="space-y-2">
        {entries.length === 0 ? (
          <div className="text-sm text-slate-400 text-center py-4">لسه مفيش حاجة اتدفعت من خزنة حسن الشهر ده.</div>
        ) : (
          entries.map((e) => (
            <div key={e.id} className="bg-white rounded-xl border border-slate-200 px-3 py-2.5 flex items-center justify-between text-sm">
              <div>
                <div className="text-slate-700 font-semibold">{e.description}</div>
                <div className="text-[11px] text-slate-400">{e.date}</div>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-primary-dark">{formatEGP(e.amount)}</span>
                <button onClick={() => remove(e.id)} className="text-rose-500 text-xs font-bold">
                  مسح
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default function HassanLedger({ month, onChangeMonth, onBack }: { month: string; onChangeMonth: (m: string) => void; onBack: () => void }) {
  const [tab, setTab] = useState<"ledger" | "treasury">("ledger");

  return (
    <div>
      <div className="bg-primary text-white px-4 pt-6 pb-3 flex items-center gap-2">
        <button onClick={onBack} className="text-white/80 text-lg">
          ‹
        </button>
        <div>
          <div className="text-xs opacity-80 font-bold">دفتر البنيان</div>
          <div className="text-lg font-extrabold mt-0.5">حسن</div>
        </div>
      </div>
      <MonthBar month={month} onChange={onChangeMonth} />

      <div className="px-4 pt-3 flex gap-2">
        <button
          onClick={() => setTab("ledger")}
          className={["flex-1 rounded-xl py-2 text-sm font-bold", tab === "ledger" ? "bg-primary text-white" : "bg-white text-slate-500 shadow-card"].join(" ")}
        >
          الحساب الشخصي
        </button>
        <button
          onClick={() => setTab("treasury")}
          className={["flex-1 rounded-xl py-2 text-sm font-bold", tab === "treasury" ? "bg-primary text-white" : "bg-white text-slate-500 shadow-card"].join(" ")}
        >
          الخزنة
        </button>
      </div>

      {tab === "ledger" ? <LedgerTab month={month} /> : <TreasuryTab month={month} />}
    </div>
  );
}
