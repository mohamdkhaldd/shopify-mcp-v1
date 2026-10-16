import { FormEvent, useEffect, useState } from "react";
import Icon from "../components/Icon";
import Modal from "../components/Modal";
import MonthPicker from "../components/equipment/MonthPicker";
import { treasuryApi } from "../api/client";
import { TreasuryExtras, TreasuryStatement, TreasurySummaryRow } from "../api/types";
import { currentMonthKey, monthLabel } from "../utils/months";
import { formatEGP } from "../utils/format";
import { PAYMENT_METHODS, paymentMethodLabel } from "../utils/paymentMethods";

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const inputClass = "rounded-lg border border-slate-200 px-2 py-1.5 text-sm";


function AccountCard({
  row,
  onEditOpening,
  onShowStatement,
  onCount,
}: {
  row: TreasurySummaryRow;
  onEditOpening: () => void;
  onShowStatement: () => void;
  onCount: () => void;
}) {
  return (
    <div className="bg-white rounded-card shadow-card p-5 flex flex-col">
      <div className="flex items-center gap-2.5 mb-3">
        <div className="w-9 h-9 rounded-xl bg-primary-light text-primary flex items-center justify-center">
          <Icon name="treasury" className="w-4 h-4" />
        </div>
        <div className="font-bold text-slate-800">{row.name_ar}</div>
      </div>

      <div className="text-xs text-slate-400">الرصيد دلوقتي</div>
      <div className={`text-2xl font-extrabold ${row.balance >= 0 ? "text-slate-900" : "text-rose-600"}`}>{formatEGP(row.balance)}</div>

      <button onClick={onEditOpening} className="no-print mt-1 text-start text-xs text-slate-400 hover:text-primary" title="دوس تعدّل رصيد البداية">
        رصيد البداية {formatEGP(row.openingBalance)}
        {row.openingDate ? ` (يوم ${row.openingDate})` : " (من الأول)"} ✎
      </button>

      <div className="grid grid-cols-2 gap-3 text-sm border-t border-slate-100 pt-3 mt-3">
        <div>
          <div className="text-xs text-slate-400">دخل الشهر</div>
          <div className="font-semibold text-primary">{formatEGP(row.monthIncoming)}</div>
        </div>
        <div>
          <div className="text-xs text-slate-400">خرج الشهر</div>
          <div className="font-semibold text-rose-600">{formatEGP(row.monthOutgoing)}</div>
        </div>
      </div>

      {row.lastCountDate && <div className="text-[11px] text-slate-400 mt-2">آخر جرد بفرق: {row.lastCountDate}</div>}

      <div className="no-print mt-auto pt-3 grid grid-cols-2 gap-2">
        <button
          onClick={onShowStatement}
          className="rounded-lg border border-slate-200 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
        >
          كشف الحساب
        </button>
        <button onClick={onCount} className="rounded-lg bg-primary-light py-1.5 text-xs font-semibold text-primary-dark hover:bg-primary hover:text-white">
          جرد
        </button>
      </div>
    </div>
  );
}

// جرد: بتكتب الفلوس اللي عدّيتها فعلًا، والبرنامج بيوريك المحسوب والفرق قبل
// ما تأكد — ولو أكدت الفرق بيتسجل تسوية عشان الرصيد يطابق الحقيقة.
function CountModal({ row, onClose, onDone }: { row: TreasurySummaryRow; onClose: () => void; onDone: () => void }) {
  const [date, setDate] = useState(todayISO());
  const [counted, setCounted] = useState("");
  const [note, setNote] = useState("");
  const [expected, setExpected] = useState<number | null>(null);

  useEffect(() => {
    setExpected(null);
    treasuryApi.previewCount(row.name, date).then((r) => setExpected(r.expected));
  }, [row.name, date]);

  const difference = counted.trim() === "" || expected == null ? null : Number(counted) - expected;

  async function confirm(e: FormEvent) {
    e.preventDefault();
    if (counted.trim() === "") return;
    await treasuryApi.count(row.name, date, Number(counted), note || null);
    onDone();
  }

  return (
    <Modal title={`جرد ${row.name_ar}`} onClose={onClose}>
      <form onSubmit={confirm} className="space-y-3 text-sm">
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs text-slate-400 mb-1">يوم الجرد</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">الفلوس اللي عدّيتها فعلًا</label>
            <input type="number" step="any" value={counted} onChange={(e) => setCounted(e.target.value)} className={`${inputClass} w-36`} autoFocus />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">ملاحظة</label>
            <input type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="اختياري" className={inputClass} />
          </div>
        </div>
        <div className="bg-slate-50 rounded-xl p-3 space-y-1">
          <div>
            المفروض يكون معاك: <span className="font-bold">{expected == null ? "..." : formatEGP(expected)}</span>
          </div>
          {difference != null && (
            <div className={Math.abs(difference) < 0.005 ? "text-primary-dark font-bold" : "text-rose-600 font-bold"}>
              {Math.abs(difference) < 0.005
                ? "✓ مظبوط — مفيش فرق"
                : `في فرق ${formatEGP(Math.abs(difference))} ${difference < 0 ? "ناقص" : "زيادة"} — لو أكدت هيتسجل تسوية والرصيد يتظبط`}
            </div>
          )}
        </div>
        <button type="submit" disabled={counted.trim() === ""} className="bg-primary text-white rounded-lg px-4 py-1.5 font-semibold disabled:opacity-50">
          أكّد الجرد
        </button>
      </form>
    </Modal>
  );
}

function OpeningModal({ row, onClose, onDone }: { row: TreasurySummaryRow; onClose: () => void; onDone: () => void }) {
  const [amount, setAmount] = useState(String(row.openingBalance));
  const [date, setDate] = useState(row.openingDate ?? todayISO());

  async function save(e: FormEvent) {
    e.preventDefault();
    await treasuryApi.setOpening(row.id, Number(amount) || 0, date || null);
    onDone();
  }

  return (
    <Modal title={`رصيد البداية — ${row.name_ar}`} onClose={onClose}>
      <form onSubmit={save} className="space-y-3 text-sm">
        <p className="text-xs text-slate-500">
          عدّ الفلوس اللي في الحساب ده يوم ما تبدأ، واكتبها هنا مرة واحدة. بعد كده الرصيد بيتحسب لوحده من كل حركة فلوس حقيقية من اليوم ده.
        </p>
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs text-slate-400 mb-1">المبلغ</label>
            <input type="number" step="any" value={amount} onChange={(e) => setAmount(e.target.value)} className={`${inputClass} w-36`} />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">من يوم</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
          </div>
        </div>
        <button type="submit" className="bg-primary text-white rounded-lg px-4 py-1.5 font-semibold">
          حفظ
        </button>
      </form>
    </Modal>
  );
}

function TransferModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [from, setFrom] = useState("instapay");
  const [to, setTo] = useState("cash");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayISO());
  const [note, setNote] = useState("");

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!amount || from === to) return;
    await treasuryApi.createTransfer({ date, from_account: from, to_account: to, amount: Number(amount), note: note || null });
    onDone();
  }

  return (
    <Modal title="تحويل بين حسابات" onClose={onClose}>
      <form onSubmit={save} className="space-y-3 text-sm">
        <p className="text-xs text-slate-500">زي سحب من انستا باي لكاش — بيقلل من الأول ويزوّد التاني، ومش بيتحسب مصروف ولا دخل.</p>
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs text-slate-400 mb-1">من</label>
            <select value={from} onChange={(e) => setFrom(e.target.value)} className={inputClass}>
              {PAYMENT_METHODS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">إلى</label>
            <select value={to} onChange={(e) => setTo(e.target.value)} className={inputClass}>
              {PAYMENT_METHODS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">المبلغ</label>
            <input type="number" min="0" step="any" value={amount} onChange={(e) => setAmount(e.target.value)} className={`${inputClass} w-32`} />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">التاريخ</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">ملاحظة</label>
            <input type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="اختياري" className={inputClass} />
          </div>
        </div>
        {from === to && <div className="text-xs text-rose-600">لازم تختار حسابين مختلفين.</div>}
        <button type="submit" disabled={!amount || from === to} className="bg-primary text-white rounded-lg px-4 py-1.5 font-semibold disabled:opacity-50">
          تسجيل التحويل
        </button>
      </form>
    </Modal>
  );
}

function OtherIncomeModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");
  const [date, setDate] = useState(todayISO());
  const [description, setDescription] = useState("");

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!amount) return;
    await treasuryApi.createOtherIncome({ date, amount: Number(amount), method, description: description || null });
    onDone();
  }

  return (
    <Modal title="إيراد آخر" onClose={onClose}>
      <form onSubmit={save} className="space-y-3 text-sm">
        <p className="text-xs text-slate-500">
          للحاجات النادرة (بيع خردة، شريك حط فلوس...) — بيزوّد الخزنة بس، ومش بيدخل في ربح أي معدة ولا الشركاء.
        </p>
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs text-slate-400 mb-1">المبلغ</label>
            <input type="number" min="0" step="any" value={amount} onChange={(e) => setAmount(e.target.value)} className={`${inputClass} w-32`} />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">دخل في</label>
            <select value={method} onChange={(e) => setMethod(e.target.value)} className={inputClass}>
              {PAYMENT_METHODS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">التاريخ</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">البيان</label>
            <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="زي: بيع خردة" className={inputClass} />
          </div>
        </div>
        <button type="submit" disabled={!amount} className="bg-primary text-white rounded-lg px-4 py-1.5 font-semibold disabled:opacity-50">
          تسجيل الإيراد
        </button>
      </form>
    </Modal>
  );
}

export default function Treasury() {
  const [month, setMonth] = useState(currentMonthKey());
  const [rows, setRows] = useState<TreasurySummaryRow[]>([]);
  const [extras, setExtras] = useState<TreasuryExtras | null>(null);
  const [loading, setLoading] = useState(true);
  const [statementAccount, setStatementAccount] = useState<TreasurySummaryRow | null>(null);
  const [statement, setStatement] = useState<TreasuryStatement | null>(null);
  const [countAccount, setCountAccount] = useState<TreasurySummaryRow | null>(null);
  const [openingAccount, setOpeningAccount] = useState<TreasurySummaryRow | null>(null);
  const [showTransfer, setShowTransfer] = useState(false);
  const [showIncome, setShowIncome] = useState(false);

  const refresh = () => Promise.all([treasuryApi.summary(month).then(setRows), treasuryApi.extras(month).then(setExtras)]);

  useEffect(() => {
    setLoading(true);
    refresh().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

  function openStatement(row: TreasurySummaryRow) {
    setStatementAccount(row);
    setStatement(null);
    treasuryApi.accountTransactions(row.name, month).then(setStatement);
  }

  async function removeTransfer(id: number) {
    await treasuryApi.deleteTransfer(id);
    refresh();
  }
  async function removeIncome(id: number) {
    await treasuryApi.deleteOtherIncome(id);
    refresh();
  }
  async function removeAdjustment(id: number) {
    await treasuryApi.deleteAdjustment(id);
    refresh();
  }

  const totalBalance = rows.reduce((sum, r) => sum + r.balance, 0);
  const totalIn = rows.reduce((sum, r) => sum + r.monthIncoming, 0);
  const totalOut = rows.reduce((sum, r) => sum + r.monthOutgoing, 0);
  const accountName = (name: string) => paymentMethodLabel(name);
  const hasExtras = extras && (extras.transfers.length || extras.otherIncome.length || extras.adjustments.length);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">الخزنة</h1>
          <p className="text-sm text-slate-500 mt-1">
            الكاش الحقيقي: رصيد البداية + كل فلوس دخلت أو خرجت فعلًا بتاريخها — زي كشف حساب البنك.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => setShowTransfer(true)} className="rounded-xl px-3 py-2 text-sm font-semibold bg-white shadow-card text-slate-600 hover:text-primary-dark">
            ⇄ تحويل بين حسابات
          </button>
          <button onClick={() => setShowIncome(true)} className="rounded-xl px-3 py-2 text-sm font-semibold bg-white shadow-card text-slate-600 hover:text-primary-dark">
            + إيراد آخر
          </button>
          <MonthPicker month={month} onChange={setMonth} />
        </div>
      </div>

      {loading ? (
        <div className="text-sm text-slate-400">جاري التحميل...</div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-card shadow-card p-5">
              <div className="text-sm text-slate-500 font-semibold">الكاش الحقيقي في كل الحسابات دلوقتي</div>
              <div className={`mt-2 text-2xl font-extrabold ${totalBalance >= 0 ? "text-primary" : "text-rose-600"}`}>{formatEGP(totalBalance)}</div>
            </div>
            <div className="bg-white rounded-card shadow-card p-5">
              <div className="text-sm text-slate-500 font-semibold">دخل فعلًا — {monthLabel(month)}</div>
              <div className="mt-2 text-2xl font-extrabold text-primary">{formatEGP(totalIn)}</div>
            </div>
            <div className="bg-white rounded-card shadow-card p-5">
              <div className="text-sm text-slate-500 font-semibold">اتصرف فعلًا — {monthLabel(month)}</div>
              <div className="mt-2 text-2xl font-extrabold text-rose-600">{formatEGP(totalOut)}</div>
            </div>
          </div>
          <p className="text-xs text-slate-400 -mt-3">
            التحويلات بين الحسابات بتظهر في دخل وخرج كل حساب لوحده، بس مجموعها في الكل صفر.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {rows.map((row) => (
              <AccountCard
                key={row.id}
                row={row}
                onEditOpening={() => setOpeningAccount(row)}
                onShowStatement={() => openStatement(row)}
                onCount={() => setCountAccount(row)}
              />
            ))}
          </div>

          {hasExtras ? (
            <div className="bg-white rounded-card shadow-card p-5">
              <h2 className="font-bold text-slate-800 mb-3">تحويلات وإيرادات أخرى وتسويات جرد — {monthLabel(month)}</h2>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-slate-400 border-b border-slate-100">
                    <th className="text-start font-semibold py-2">التاريخ</th>
                    <th className="text-start font-semibold py-2">النوع</th>
                    <th className="text-start font-semibold py-2">التفاصيل</th>
                    <th className="text-start font-semibold py-2">المبلغ</th>
                    <th className="no-print"></th>
                  </tr>
                </thead>
                <tbody>
                  {extras!.transfers.map((t) => (
                    <tr key={`t${t.id}`} className="border-b border-slate-50 last:border-0">
                      <td className="py-2 text-slate-500">{t.date}</td>
                      <td className="py-2 font-semibold text-slate-700">تحويل</td>
                      <td className="py-2 text-slate-600">
                        من {accountName(t.from_account)} إلى {accountName(t.to_account)}
                        {t.note ? ` — ${t.note}` : ""}
                      </td>
                      <td className="py-2 font-semibold text-slate-700">{formatEGP(t.amount)}</td>
                      <td className="no-print py-2">
                        <button onClick={() => removeTransfer(t.id)} className="text-xs text-rose-500 font-semibold">
                          حذف
                        </button>
                      </td>
                    </tr>
                  ))}
                  {extras!.otherIncome.map((i) => (
                    <tr key={`i${i.id}`} className="border-b border-slate-50 last:border-0">
                      <td className="py-2 text-slate-500">{i.date}</td>
                      <td className="py-2 font-semibold text-slate-700">إيراد آخر</td>
                      <td className="py-2 text-slate-600">
                        {i.description ?? "—"} ({accountName(i.method)})
                      </td>
                      <td className="py-2 font-semibold text-primary">+{formatEGP(i.amount)}</td>
                      <td className="no-print py-2">
                        <button onClick={() => removeIncome(i.id)} className="text-xs text-rose-500 font-semibold">
                          حذف
                        </button>
                      </td>
                    </tr>
                  ))}
                  {extras!.adjustments.map((a) => (
                    <tr key={`a${a.id}`} className="border-b border-slate-50 last:border-0">
                      <td className="py-2 text-slate-500">{a.date}</td>
                      <td className="py-2 font-semibold text-slate-700">تسوية جرد</td>
                      <td className="py-2 text-slate-600">
                        {accountName(a.account)} — المحسوب {formatEGP(a.expected ?? 0)}، المعدود {formatEGP(a.counted ?? 0)}
                        {a.note ? ` — ${a.note}` : ""}
                      </td>
                      <td className={`py-2 font-semibold ${a.amount >= 0 ? "text-primary" : "text-rose-600"}`}>
                        {a.amount >= 0 ? "+" : "-"}
                        {formatEGP(Math.abs(a.amount))}
                      </td>
                      <td className="no-print py-2">
                        <button onClick={() => removeAdjustment(a.id)} className="text-xs text-rose-500 font-semibold">
                          حذف
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </>
      )}

      {statementAccount && (
        <Modal title={`كشف حساب ${statementAccount.name_ar} — ${monthLabel(month)} ${month.slice(0, 4)}`} onClose={() => setStatementAccount(null)}>
          {!statement ? (
            <div className="text-sm text-slate-400">جاري التحميل...</div>
          ) : (
            <div className="text-sm">
              <div className="mb-2 text-slate-500">
                رصيد أول الشهر: <span className="font-bold text-slate-800">{formatEGP(statement.openingForMonth)}</span>
              </div>
              {statement.rows.length === 0 ? (
                <div className="text-slate-400">مفيش حركة على الحساب ده الشهر ده.</div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="text-slate-400 border-b border-slate-100">
                      <th className="text-start font-semibold py-2">التاريخ</th>
                      <th className="text-start font-semibold py-2">البيان</th>
                      <th className="text-start font-semibold py-2">داخل</th>
                      <th className="text-start font-semibold py-2">خارج</th>
                      <th className="text-start font-semibold py-2">الرصيد</th>
                    </tr>
                  </thead>
                  <tbody>
                    {statement.rows.map((t, i) => (
                      <tr key={i} className="border-b border-slate-50 last:border-0">
                        <td className="py-2 text-slate-500 whitespace-nowrap">{t.date}</td>
                        <td className="py-2 text-slate-700">{t.label}</td>
                        <td className="py-2 font-semibold text-primary whitespace-nowrap">{t.direction === "in" ? formatEGP(t.amount) : ""}</td>
                        <td className="py-2 font-semibold text-rose-600 whitespace-nowrap">{t.direction === "out" ? formatEGP(t.amount) : ""}</td>
                        <td className="py-2 font-semibold text-slate-800 whitespace-nowrap">
                          {t.balance == null ? <span className="text-xs text-slate-400">قبل رصيد البداية</span> : formatEGP(t.balance)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <div className="mt-3 text-slate-500">
                رصيد آخر الشهر: <span className="font-bold text-slate-800">{formatEGP(statement.closing)}</span>
              </div>
            </div>
          )}
        </Modal>
      )}

      {countAccount && (
        <CountModal
          row={countAccount}
          onClose={() => setCountAccount(null)}
          onDone={() => {
            setCountAccount(null);
            refresh();
          }}
        />
      )}
      {openingAccount && (
        <OpeningModal
          row={openingAccount}
          onClose={() => setOpeningAccount(null)}
          onDone={() => {
            setOpeningAccount(null);
            refresh();
          }}
        />
      )}
      {showTransfer && (
        <TransferModal
          onClose={() => setShowTransfer(false)}
          onDone={() => {
            setShowTransfer(false);
            refresh();
          }}
        />
      )}
      {showIncome && (
        <OtherIncomeModal
          onClose={() => setShowIncome(false)}
          onDone={() => {
            setShowIncome(false);
            refresh();
          }}
        />
      )}
    </div>
  );
}
