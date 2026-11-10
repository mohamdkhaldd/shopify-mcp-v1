import { Fragment, FormEvent, useEffect, useState } from "react";
import { hassanApi } from "../../api/client";
import { HassanBalance, HassanLedgerEntry, HassanLedgerType, HassanPartyBalance } from "../../api/types";
import { monthLabel } from "../../utils/months";
import { formatEGP } from "../../utils/format";
import { person } from "../../person";
import { PAYMENT_METHODS, paymentMethodLabel } from "../../utils/paymentMethods";
import { ledgerTypes, typeLabel } from "./ledgerTypes";

function LedgerEntryRow({ e, onChanged }: { e: HassanLedgerEntry; onChanged: () => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(e);
  const set = (patch: Partial<HassanLedgerEntry>) => setDraft((d) => ({ ...d, ...patch }));
  const cls = "rounded-lg border border-slate-200 px-1.5 py-1 text-xs bg-white";

  async function save() {
    await hassanApi.ledgerUpdate({ ...draft, amount: Number(draft.amount) || 0 });
    setEditing(false);
    onChanged();
  }
  async function remove() {
    if (!window.confirm("تمسح الحركة دي؟")) return;
    await hassanApi.ledgerRemove(e.id);
    onChanged();
  }

  if (editing) {
    return (
      <tr className="border-b border-slate-50 bg-slate-50">
        <td className="py-1.5">
          <input type="date" value={draft.date} onChange={(x) => set({ date: x.target.value })} className={cls} />
        </td>
        <td className="py-1.5">
          <select value={draft.type} onChange={(x) => set({ type: x.target.value as HassanLedgerType })} className={cls}>
            {ledgerTypes().map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </td>
        <td className="py-1.5">
          <input type="number" value={draft.amount} onChange={(x) => set({ amount: x.target.value as unknown as number })} className={`${cls} w-24`} />
        </td>
        <td className="py-1.5">
          <input value={draft.party_name ?? ""} onChange={(x) => set({ party_name: x.target.value })} className={`${cls} w-28`} />
        </td>
        <td className="py-1.5">
          <input value={draft.description ?? ""} onChange={(x) => set({ description: x.target.value })} className={`${cls} w-28`} />
        </td>
        <td className="py-1.5">
          <select value={draft.method ?? "cash"} onChange={(x) => set({ method: x.target.value })} className={cls}>
            {PAYMENT_METHODS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </td>
        <td className="py-1.5 whitespace-nowrap">
          <button onClick={save} className="text-xs text-primary font-semibold me-2">
            حفظ
          </button>
          <button onClick={() => setEditing(false)} className="text-xs text-slate-400 font-semibold">
            إلغاء
          </button>
        </td>
      </tr>
    );
  }
  return (
    <tr className="border-b border-slate-50 last:border-0">
      <td className="py-2 text-slate-500">{e.date}</td>
      <td className="py-2 text-slate-700 font-semibold">{typeLabel(e.type)}</td>
      <td className="py-2 text-slate-600">{formatEGP(e.amount)}</td>
      <td className="py-2 text-slate-500">{e.party_name ?? "—"}</td>
      <td className="py-2 text-slate-500">{e.description ?? "—"}</td>
      <td className="py-2 text-slate-500">
        {e.method ? `${e.type === "loan" || e.type === "collection" ? "دخلت" : "طلعت"} — ${paymentMethodLabel(e.method)}` : "قديم"}
      </td>
      <td className="no-print py-2 whitespace-nowrap">
        <button
          onClick={() => {
            setDraft(e);
            setEditing(true);
          }}
          className="text-xs text-primary font-semibold me-2"
        >
          تعديل
        </button>
        <button onClick={remove} className="text-xs text-rose-500 hover:text-rose-700 font-semibold">
          حذف
        </button>
      </td>
    </tr>
  );
}

const ledgerHead = (
  <thead>
    <tr className="text-slate-400 border-b border-slate-100">
      <th className="text-start font-semibold py-2">التاريخ</th>
      <th className="text-start font-semibold py-2">النوع</th>
      <th className="text-start font-semibold py-2">القيمة</th>
      <th className="text-start font-semibold py-2">الجهة</th>
      <th className="text-start font-semibold py-2">بيان</th>
      <th className="text-start font-semibold py-2">الفلوس</th>
      <th className="no-print"></th>
    </tr>
  </thead>
);

export default function LedgerTab({ month }: { month: string }) {
  const [entries, setEntries] = useState<HassanLedgerEntry[]>([]);
  const [balance, setBalance] = useState<HassanBalance | null>(null);
  const [partyBalances, setPartyBalances] = useState<HassanPartyBalance[]>([]);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [type, setType] = useState<HassanLedgerType>("loan");
  const [amount, setAmount] = useState("");
  const [partyName, setPartyName] = useState("");
  const [description, setDescription] = useState("");
  // من/لـ أنهي حساب في خزنة الشركة.
  const [method, setMethod] = useState("cash");
  const cashIn = type === "loan" || type === "collection";
  const [openParty, setOpenParty] = useState<string | null>(null);
  const [partyRows, setPartyRows] = useState<HassanLedgerEntry[]>([]);
  const loadParty = (name: string) => hassanApi.partyEntries(name).then(setPartyRows);
  const refreshAll = () => {
    refresh();
    if (openParty) loadParty(openParty);
  };

  async function renameParty(name: string) {
    const to = window.prompt(`الاسم الجديد بدل "${name}":`, name === "بدون تحديد" ? "" : name);
    if (!to || !to.trim() || to.trim() === name) return;
    await hassanApi.renameParty(name, to.trim());
    if (openParty === name) setOpenParty(to.trim());
    refreshAll();
  }
  async function deleteParty(name: string) {
    if (!window.confirm(`تمسح "${name}" وكل حركاته في الحساب الشخصي؟`)) return;
    await hassanApi.deleteParty(name);
    if (openParty === name) setOpenParty(null);
    refreshAll();
  }

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
      method,
    });
    setAmount("");
    setPartyName("");
    setDescription("");
    refresh();
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white rounded-card shadow-card p-5">
          <div className="text-sm text-slate-500 font-semibold">صافي المديونية على {person()} (كل الوقت)</div>
          <div className="mt-2 text-xl font-extrabold text-rose-600">{formatEGP(balance?.netDebt ?? 0)}</div>
        </div>
        <div className="bg-white rounded-card shadow-card p-5">
          <div className="text-sm text-slate-500 font-semibold">صافي المستحق ل{person()} (كل الوقت)</div>
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
                <th className="text-start font-semibold py-2">{person()} مديون له بـ</th>
                <th className="text-start font-semibold py-2">مستحق ل{person()} منه</th>
                <th className="no-print"></th>
              </tr>
            </thead>
            <tbody>
              {partyBalances.map((p) => (
                <Fragment key={p.party_name}>
                  <tr className="border-b border-slate-50 last:border-0">
                    <td className="py-2 font-semibold text-slate-700">{p.party_name}</td>
                    <td className="py-2 text-rose-600 font-semibold">{p.netDebt > 0 ? formatEGP(p.netDebt) : "—"}</td>
                    <td className="py-2 text-primary font-semibold">{p.netDue > 0 ? formatEGP(p.netDue) : "—"}</td>
                    <td className="no-print py-2 whitespace-nowrap text-end">
                      <button
                        onClick={() => {
                          if (openParty === p.party_name) setOpenParty(null);
                          else {
                            setOpenParty(p.party_name);
                            loadParty(p.party_name);
                          }
                        }}
                        className="text-xs text-slate-600 font-semibold me-3"
                      >
                        {openParty === p.party_name ? "اقفل" : "تفاصيل وتعديل"}
                      </button>
                      <button onClick={() => renameParty(p.party_name)} className="text-xs text-primary font-semibold me-3">
                        تغيير الاسم
                      </button>
                      <button onClick={() => deleteParty(p.party_name)} className="text-xs text-rose-500 font-semibold">
                        حذف
                      </button>
                    </td>
                  </tr>
                  {openParty === p.party_name && (
                    <tr>
                      <td colSpan={4} className="bg-slate-50 rounded-xl px-3 py-3">
                        <div className="text-xs font-bold text-slate-500 mb-1">كل حركات {p.party_name} (من الأول)</div>
                        <table className="w-full text-sm">
                          {ledgerHead}
                          <tbody>
                            {partyRows.map((e) => (
                              <LedgerEntryRow key={e.id} e={e} onChanged={refreshAll} />
                            ))}
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="bg-white rounded-card shadow-card p-5">
        <h2 className="font-bold text-slate-800 mb-4">حساب {person()} الشخصي — {monthLabel(month)} {month.slice(0, 4)}</h2>
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
              {ledgerTypes().map((t) => (
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
          <div>
            <label className="block text-xs text-slate-400 mb-1">الفلوس {cashIn ? "دخلت الخزنة في" : "طلعت من الخزنة من"}</label>
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
        <p className="no-print text-[11px] text-slate-400 -mt-2 mb-4">
          استلف أو حصّل = الفلوس بتدخل الحساب ده في خزنة الشركة، سدد أو سلّف حد = بتطلع منه — وبتتحسب في فلوس {person()} اللي جوه الخزنة.
        </p>

        {entries.length === 0 ? (
          <div className="text-sm text-slate-400">لسه مفيش حركات مسجلة الشهر ده.</div>
        ) : (
          <table className="w-full text-sm">
            {ledgerHead}
            <tbody>
              {entries.map((e) => (
                <LedgerEntryRow key={e.id} e={e} onChanged={refreshAll} />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// خانة تسجيل حركة واحدة (دفعة مرتب / سلفة / حافز / خصم) جوه شيت العامل.
