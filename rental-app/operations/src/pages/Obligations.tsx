import { FormEvent, useEffect, useState } from "react";
import Icon from "../components/Icon";
import { ask } from "../components/Dialogs";
import { DueBoard, DueItem, duesApi, obligationsApi } from "../api/client";
import Modal from "../components/Modal";
import MonthPicker from "../components/equipment/MonthPicker";
import PrintButton from "../components/PrintButton";
import { PrintHeader } from "../components/PrintSignoff";
import { formatEGP } from "../utils/format";
import { currentMonthKey, monthLabel } from "../utils/months";
import { PAYMENT_METHODS } from "../utils/paymentMethods";
import { useUndo } from "../context/UndoContext";

export const OBLIGATION_KINDS: { value: string; label: string }[] = [
  { value: "salaries", label: "مرتبات" },
  { value: "partners", label: "دفع للشركاء" },
  { value: "suppliers", label: "دفع لمورد" },
  { value: "rent", label: "إيجار" },
  { value: "installment", label: "قسط" },
  { value: "other", label: "حاجة تانية" },
];
export const obligationKindLabel = (v: string) => OBLIGATION_KINDS.find((k) => k.value === v)?.label ?? v;

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function daysUntil(date: string) {
  return Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${todayISO()}T00:00:00Z`)) / 86400000);
}

export function dueText(days: number) {
  if (days < 0) return `متأخر ${-days} يوم`;
  if (days === 0) return "النهارده";
  if (days === 1) return "بكرة";
  return `بعد ${days} أيام`;
}

const DAY_GROUPS: { key: string; label: string }[] = [
  { key: "drivers", label: "مرتبات السواقين" },
  { key: "partners", label: "الشركاء" },
  { key: "contractors", label: "المقاولين" },
  { key: "suppliers", label: "الموردين" },
];
const WEEKDAYS = ["الأحد", "الاتنين", "التلات", "الأربع", "الخميس", "الجمعة", "السبت"];
const inputCls = "rounded-lg border border-slate-200 px-2 py-1.5 text-sm bg-white";

// الالتزامات والمستحقات: شيت شهري بالأيام — كل يوم عليك تدفع/تستلم إيه،
// وجنب كل واحد زرار «ادفع» أو «استلمت».
export default function Obligations() {
  const [month, setMonth] = useState(currentMonthKey());
  const [board, setBoard] = useState<DueBoard | null>(null);
  const [paying, setPaying] = useState<DueItem | null>(null);
  const [adding, setAdding] = useState(false);
  const refresh = () => duesApi.board(month).then(setBoard);
  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

  async function setDay(group: string, day: string) {
    if (!day) return;
    await duesApi.setDay(group, Number(day));
    refresh();
  }

  return (
    <div className="space-y-6">
      <PrintHeader title="الالتزامات والمستحقات" subtitle={`${monthLabel(month)} ${month.slice(0, 4)}`} />
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">الالتزامات والمستحقات</h1>
          <p className="text-sm text-slate-500 mt-1">
            كل يوم في الشهر عليك تدفع إيه أو هتستلم إيه. المرتبات والشركاء والمقاولين والموردين والأقساط بيتكتبوا لوحدهم — انت بتحدد يوم الدفع بس.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => setAdding(true)} className="bg-primary text-white rounded-xl px-4 py-2 text-sm font-bold hover:bg-primary-dark">
            + التزام / فلوس جاية
          </button>
          <PrintButton />
          <MonthPicker month={month} onChange={setMonth} />
        </div>
      </div>

      {!board ? (
        <div className="text-sm text-slate-400">جاري التحميل...</div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white rounded-card shadow-card p-5">
              <div className="text-sm font-semibold text-slate-500">عليك تدفع الشهر ده</div>
              <div className="mt-1 text-2xl font-extrabold text-rose-600">{formatEGP(board.totals.pay)}</div>
            </div>
            <div className="bg-white rounded-card shadow-card p-5">
              <div className="text-sm font-semibold text-slate-500">هتستلم الشهر ده</div>
              <div className="mt-1 text-2xl font-extrabold text-primary-dark">{formatEGP(board.totals.receive)}</div>
            </div>
          </div>

          <div className="no-print bg-white rounded-card shadow-card p-4 flex flex-wrap items-center gap-3 text-sm">
            <b className="text-slate-700">أيام الدفع كل شهر:</b>
            {DAY_GROUPS.map((g) => (
              <label key={g.key} className="flex items-center gap-1.5 text-slate-600">
                {g.label} يوم
                <input
                  type="number"
                  min={1}
                  max={31}
                  defaultValue={board.settings[g.key]}
                  key={`${g.key}-${board.settings[g.key]}`}
                  onBlur={(e) => e.target.value !== String(board.settings[g.key]) && setDay(g.key, e.target.value)}
                  className={`${inputCls} w-16 text-center`}
                />
              </label>
            ))}
          </div>

          {board.days.length === 0 && <div className="bg-white rounded-card shadow-card p-8 text-center text-slate-400">مفيش حاجة عليك ولا ليك الشهر ده</div>}

          {board.days.map((d) => {
            const day = Number(d.date.slice(8, 10));
            const wd = WEEKDAYS[new Date(`${d.date}T12:00:00`).getDay()];
            const days = daysUntil(d.date);
            return (
              <section key={d.date} className="bg-white rounded-card shadow-card overflow-hidden">
                <header className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 bg-slate-50 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-primary text-white flex flex-col items-center justify-center leading-none">
                      <span className="text-lg font-extrabold">{day}</span>
                      <span className="text-[10px] opacity-80">{monthLabel(month)}</span>
                    </div>
                    <div>
                      <div className="font-extrabold text-slate-800">{d.title}</div>
                      <div className="text-xs text-slate-500">
                        {wd} — <span className={days < 0 ? "text-rose-600 font-bold" : days <= 3 ? "text-amber-600 font-bold" : ""}>{dueText(days)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-sm font-bold">
                    {d.pay > 0 && <span className="text-rose-600">ندفع {formatEGP(d.pay)}</span>}
                    {d.pay > 0 && d.receive > 0 && " · "}
                    {d.receive > 0 && <span className="text-primary-dark">نستلم {formatEGP(d.receive)}</span>}
                  </div>
                </header>
                <ul className="divide-y divide-slate-100">
                  {d.items.map((x) => (
                    <li key={`${x.group}-${x.ref}`} className="flex flex-wrap items-center gap-3 px-5 py-3">
                      <div className="flex-1 min-w-[180px]">
                        <div className="font-bold text-slate-800">
                          {x.label}
                          {x.party && <span className="text-slate-500 font-semibold"> — {x.party}</span>}
                          {x.late && <span className="ms-2 text-[11px] rounded bg-rose-50 text-rose-600 px-1.5 py-0.5">متأخر من الشهر اللي فات</span>}
                        </div>
                        <div className="text-xs text-slate-500">
                          {x.paid > 0.005 ? `${x.direction === "receive" ? "اتستلم" : "اتدفع"} ${formatEGP(x.paid)} من ${formatEGP(x.amount)} — ` : ""}
                          {x.breakdown.length > 0 && x.paid <= 0.005 ? x.breakdown.map((b) => `${b.label} ${formatEGP(b.amount)}`).join(" · ") : ""}
                        </div>
                      </div>
                      <div className={`text-lg font-extrabold ${x.direction === "receive" ? "text-primary-dark" : "text-slate-900"}`}>{formatEGP(x.remaining)}</div>
                      <button
                        onClick={() => setPaying(x)}
                        className={`no-print rounded-lg px-4 py-2 text-sm font-bold text-white ${x.direction === "receive" ? "bg-sky-600 hover:bg-primary-dark" : "bg-emerald-600 hover:bg-primary-dark"}`}
                      >
                        {x.direction === "receive" ? "استلمت" : "ادفع"}
                      </button>
                      {x.group === "manual" && (
                        <button
                          title="امسح"
                          onClick={async () => {
                            if (!(await ask(`تمسح «${x.label}»؟`))) return;
                            await obligationsApi.remove(x.ref);
                            refresh();
                          }}
                          className="no-print text-xs font-bold text-rose-500 px-1"
                        >
                          <Icon name="trash" className="w-4 h-4" />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </>
      )}

      {paying && <PayDialog item={paying} onClose={() => setPaying(null)} onDone={() => { setPaying(null); refresh(); }} />}
      {adding && <AddDialog month={month} onClose={() => setAdding(false)} onDone={() => { setAdding(false); refresh(); }} />}
    </div>
  );
}

function PayDialog({ item, onClose, onDone }: { item: DueItem; onClose: () => void; onDone: () => void }) {
  const [amount, setAmount] = useState(String(Math.round(item.remaining * 100) / 100));
  const [method, setMethod] = useState("cash");
  const [date, setDate] = useState(todayISO());
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const { pushUndo } = useUndo();
  const receive = item.direction === "receive";

  async function pay(value: number) {
    setError("");
    if (!(value > 0)) return setError("اكتب المبلغ");
    let undo;
    try {
      undo = await duesApi.pay({ group: item.group, ref: item.ref, forMonth: item.forMonth, date, amount: value, method, note: note || null });
    } catch (e) {
      return setError((e as Error).message.replace(/^Error invoking remote method '[^']+': (Error: )?/, ""));
    }
    pushUndo(`${receive ? "استلمت" : "دفعت"} ${formatEGP(value)} — ${item.label}`, async () => {
      await duesApi.undo(undo);
      onDone();
    });
    onDone();
  }

  const cls = "rounded-lg border border-slate-200 px-2 py-1.5 text-sm w-full";
  return (
    <Modal title={`${receive ? "استلمت من" : "ادفع لـ"} ${item.label}`} onClose={onClose}>
      {item.breakdown.length > 0 && (
        <table className="w-full text-sm mb-4">
          <tbody>
            {item.breakdown.map((b) => (
              <tr key={b.label} className="border-b border-slate-100">
                <td className="py-1.5 text-slate-600">{b.label}</td>
                <td className={`py-1.5 text-end font-bold ${b.amount < 0 ? "text-rose-600" : "text-slate-800"}`}>{formatEGP(b.amount)}</td>
              </tr>
            ))}
            <tr>
              <td className="pt-2 font-extrabold">{receive ? "الباقي ليك" : "الباقي عليك"}</td>
              <td className="pt-2 text-end font-extrabold">{formatEGP(item.remaining)}</td>
            </tr>
          </tbody>
        </table>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-sm font-semibold text-slate-600">
          المبلغ
          <input type="number" min="0" step="any" value={amount} onChange={(e) => setAmount(e.target.value)} className={cls} />
        </label>
        <label className="grid gap-1 text-sm font-semibold text-slate-600">
          {receive ? "دخلت فين" : "هتدفع من"}
          <select value={method} onChange={(e) => setMethod(e.target.value)} className={cls}>
            {PAYMENT_METHODS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm font-semibold text-slate-600">
          التاريخ
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={cls} />
        </label>
        <label className="grid gap-1 text-sm font-semibold text-slate-600">
          البيان
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="اختياري" className={cls} />
        </label>
      </div>
      {error && <div className="mt-3 text-sm text-rose-600 font-semibold">{error}</div>}
      <div className="mt-4 flex flex-wrap gap-2">
        <button onClick={() => pay(item.remaining)} className="bg-primary text-white rounded-lg px-4 py-2 text-sm font-bold hover:bg-primary-dark">
          {receive ? "استلمت كله" : "دفعت كامل"} ({formatEGP(item.remaining)})
        </button>
        <button onClick={() => pay(Number(amount))} className="bg-primary text-white rounded-lg px-4 py-2 text-sm font-bold hover:bg-primary-dark">
          {receive ? "استلمت المبلغ ده" : "ادفع المبلغ ده"}
        </button>
        <button onClick={onClose} className="bg-slate-100 text-slate-600 rounded-lg px-4 py-2 text-sm font-bold">
          إلغاء
        </button>
      </div>
    </Modal>
  );
}

function AddDialog({ month, onClose, onDone }: { month: string; onClose: () => void; onDone: () => void }) {
  const [direction, setDirection] = useState<"pay" | "receive">("pay");
  const [title, setTitle] = useState("");
  const [party, setParty] = useState("");
  const [amount, setAmount] = useState("");
  const [due, setDue] = useState(todayISO().slice(0, 7) === month ? todayISO() : `${month}-01`);
  const [repeat, setRepeat] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    try {
      await duesApi.addManual({ title, party: party || null, amount: Number(amount), due_date: due, direction, repeat_monthly: repeat, note: note || null });
      onDone();
    } catch (err) {
      setError((err as Error).message.replace(/^Error invoking remote method '[^']+': (Error: )?/, ""));
    }
  }
  const cls = "rounded-lg border border-slate-200 px-2 py-1.5 text-sm w-full";
  return (
    <Modal title="التزام جديد أو فلوس جاية" onClose={onClose}>
      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2 flex gap-2">
          {(["pay", "receive"] as const).map((d) => (
            <button
              type="button"
              key={d}
              onClick={() => setDirection(d)}
              className={`flex-1 rounded-lg py-2 text-sm font-bold ${direction === d ? (d === "pay" ? "bg-primary text-white" : "bg-primary text-white") : "bg-slate-100 text-slate-600"}`}
            >
              {d === "pay" ? "هندفع" : "هنستلم"}
            </button>
          ))}
        </div>
        <label className="grid gap-1 text-sm font-semibold text-slate-600">
          ده إيه
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={direction === "pay" ? "زي: إيجار المخزن" : "زي: فلوس من مورد"} className={cls} />
        </label>
        <label className="grid gap-1 text-sm font-semibold text-slate-600">
          {direction === "pay" ? "لمين" : "من مين"}
          <input value={party} onChange={(e) => setParty(e.target.value)} placeholder="اختياري" className={cls} />
        </label>
        <label className="grid gap-1 text-sm font-semibold text-slate-600">
          المبلغ
          <input type="number" min="0" step="any" value={amount} onChange={(e) => setAmount(e.target.value)} className={cls} />
        </label>
        <label className="grid gap-1 text-sm font-semibold text-slate-600">
          {direction === "pay" ? "ميعاد الدفع" : "هيجيلي امتى"}
          <input type="date" value={due} onChange={(e) => setDue(e.target.value)} className={cls} />
        </label>
        <label className="grid gap-1 text-sm font-semibold text-slate-600 sm:col-span-2">
          ملاحظة
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="اختياري" className={cls} />
        </label>
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-600 sm:col-span-2">
          <input type="checkbox" checked={repeat} onChange={(e) => setRepeat(e.target.checked)} />
          بيتكرر كل شهر
        </label>
        {error && <div className="sm:col-span-2 text-sm text-rose-600 font-semibold">{error}</div>}
        <div className="sm:col-span-2 flex gap-2">
          <button type="submit" disabled={!title.trim() || !amount} className="bg-primary text-white rounded-lg px-4 py-2 text-sm font-bold disabled:opacity-50">
            سجّل
          </button>
          <button type="button" onClick={onClose} className="bg-slate-100 text-slate-600 rounded-lg px-4 py-2 text-sm font-bold">
            إلغاء
          </button>
        </div>
      </form>
    </Modal>
  );
}
