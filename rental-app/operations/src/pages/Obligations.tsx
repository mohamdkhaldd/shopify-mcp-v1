import { FormEvent, useEffect, useState } from "react";
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
// «2026-10» → «أكتوبر 2026» جوه أي كلام
export const prettyMonths = (t: string) => t.replace(/(\d{4})-(\d{2})(?!-)/g, (_m, y, mm) => `${monthLabel(`${y}-${mm}`)} ${y}`);

export default function Obligations() {
  const [month, setMonth] = useState(currentMonthKey());
  const [board, setBoard] = useState<DueBoard | null>(null);
  const [paying, setPaying] = useState<DueItem | null>(null);
  const [viewing, setViewing] = useState<DueItem | null>(null);
  const [adding, setAdding] = useState(false);
  const [help, setHelp] = useState(false);
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
            كل شهر لوحده: عليك تدفع إيه وهتستلم إيه، اتدفع منه كام وفاضل كام. دوس على أي اسم تشوف تفاصيله.{" "}
            <button onClick={() => setHelp((h) => !h)} className="text-primary font-semibold underline">{help ? "اقفل الشرح" : "إزاي الصفحة دي بتشتغل؟"}</button>
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

      {help && <HowItWorks settings={board?.settings} />}

      {!board ? (
        <div className="text-sm text-slate-400">جاري التحميل...</div>
      ) : (
        <>
          {board.overdue.length > 0 && (
            <div className="no-print rounded-card border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 flex flex-wrap items-center gap-2">
              <b>لسه فيه حاجات من شهور فاتت:</b>
              {board.overdue.map((o) => (
                <button key={o.month} onClick={() => setMonth(o.month)} className="rounded-full bg-white border border-rose-200 px-3 py-1 font-semibold hover:bg-rose-100">
                  {monthLabel(o.month)} {o.month.slice(0, 4)}
                  {o.pay > 0.005 && ` — ندفع ${formatEGP(o.pay)}`}
                  {o.receive > 0.005 && ` — نستلم ${formatEGP(o.receive)}`}
                </button>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <TotalCard title={`علينا ندفع في ${monthLabel(month)}`} all={board.totals.payAll} done={board.totals.paid} left={board.totals.pay} doneLabel="اتدفع" tone="pay" />
            <TotalCard title={`هنستلم في ${monthLabel(month)}`} all={board.totals.receiveAll} done={board.totals.received} left={board.totals.receive} doneLabel="اتستلم" tone="receive" />
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

          {board.days.length === 0 && <div className="bg-white rounded-card shadow-card p-8 text-center text-slate-400">مفيش حاجة عليك ولا ليك في {monthLabel(month)}.</div>}

          {board.days.map((d) => {
            const day = Number(d.date.slice(8, 10));
            const wd = WEEKDAYS[new Date(`${d.date}T12:00:00`).getDay()];
            const days = daysUntil(d.date);
            const allDone = d.items.every((x) => x.done);
            return (
              <section key={d.date} className="bg-white rounded-card shadow-card overflow-hidden">
                <header className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 bg-slate-50 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center leading-none ${allDone ? "bg-slate-200 text-slate-600" : "bg-primary text-white"}`}>
                      <span className="text-lg font-extrabold">{day}</span>
                      <span className="text-[10px] opacity-80">{monthLabel(d.date.slice(0, 7))}</span>
                    </div>
                    <div>
                      <div className="font-extrabold text-slate-800">{d.title}</div>
                      <div className="text-xs text-slate-500">
                        {wd} —{" "}
                        {allDone ? (
                          <span className="text-emerald-700 font-bold">خلص كله</span>
                        ) : (
                          <span className={days < 0 ? "text-rose-600 font-bold" : days <= 3 ? "text-amber-600 font-bold" : ""}>{dueText(days)}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-sm font-bold">
                    {d.pay > 0 && <span className="text-rose-600">باقي ندفع {formatEGP(d.pay)}</span>}
                    {d.pay > 0 && d.receive > 0 && " · "}
                    {d.receive > 0 && <span className="text-primary-dark">باقي نستلم {formatEGP(d.receive)}</span>}
                  </div>
                </header>
                <ul className="divide-y divide-slate-100">
                  {d.items.map((x) => {
                    const recv = x.direction === "receive";
                    const partial = !x.done && x.paid > 0.005;
                    return (
                      <li key={`${x.group}-${x.ref}`} className="flex flex-wrap items-center gap-3 px-5 py-3 hover:bg-slate-50/60">
                        <button onClick={() => setViewing(x)} className="flex-1 min-w-[180px] text-start">
                          <div className="font-bold text-slate-800">
                            {x.label}
                            {x.party && <span className="text-slate-500 font-semibold"> — {x.party}</span>}
                            {x.covers && <span className="ms-2 text-xs font-semibold text-slate-500">{prettyMonths(x.covers)}</span>}
                          </div>
                          <div className="text-xs text-slate-500 flex flex-wrap items-center gap-2 mt-0.5">
                            <span>المطلوب {formatEGP(x.amount)}</span>
                            {x.paid > 0.005 && <span>· {recv ? "اتستلم" : "اتدفع"} {formatEGP(x.paid)}</span>}
                            {x.done ? (
                              <span className="rounded-full bg-emerald-50 text-emerald-700 px-2 py-0.5 font-bold">{recv ? "اتستلم كله" : "اتدفع كله"} ✓</span>
                            ) : partial ? (
                              <span className="rounded-full bg-amber-50 text-amber-700 px-2 py-0.5 font-bold">جزء</span>
                            ) : null}
                            {x.late && <span className="rounded-full bg-rose-50 text-rose-600 px-2 py-0.5 font-bold">متأخر</span>}
                            <span className="no-print text-primary">· دوس للتفاصيل</span>
                          </div>
                        </button>
                        <div className={`text-lg font-extrabold ${x.done ? "text-slate-300" : recv ? "text-primary-dark" : "text-slate-900"}`}>{formatEGP(x.remaining)}</div>
                        {!x.done && x.canPay !== false && (
                          <button onClick={() => setPaying(x)} className="no-print rounded-lg px-4 py-2 text-sm font-bold text-white bg-primary hover:bg-primary-dark">
                            {recv ? "استلمت" : "ادفع"}
                          </button>
                        )}
                        {!x.done && x.canPay === false && x.cantPayWhy && <span className="no-print text-[11px] text-slate-400 max-w-[160px]">{x.cantPayWhy}</span>}
                        {x.group === "manual" && (
                          <button
                            title="امسح"
                            onClick={async () => {
                              if (!window.confirm(`تمسح «${x.label}»؟`)) return;
                              await obligationsApi.remove(x.ref);
                              refresh();
                            }}
                            className="no-print text-xs font-bold text-rose-500 px-1"
                          >
                            🗑
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </>
      )}

      {viewing && (
        <DetailDialog
          item={viewing}
          onClose={() => setViewing(null)}
          onPay={!viewing.done && viewing.canPay !== false ? () => { setPaying(viewing); setViewing(null); } : undefined}
        />
      )}
      {paying && <PayDialog item={paying} onClose={() => setPaying(null)} onDone={() => { setPaying(null); refresh(); }} />}
      {adding && <AddDialog month={month} onClose={() => setAdding(false)} onDone={() => { setAdding(false); refresh(); }} />}
    </div>
  );
}

function TotalCard({ title, all, done, left, doneLabel, tone }: { title: string; all: number; done: number; left: number; doneLabel: string; tone: "pay" | "receive" }) {
  const pct = all > 0 ? Math.min(100, Math.round((done / all) * 100)) : 0;
  return (
    <div className="bg-white rounded-card shadow-card p-5">
      <div className="text-sm font-semibold text-slate-500">{title}</div>
      <div className="mt-1 flex items-baseline gap-2 flex-wrap">
        <span className={`text-2xl font-extrabold ${tone === "pay" ? "text-rose-600" : "text-primary-dark"}`}>{formatEGP(left)}</span>
        <span className="text-xs text-slate-400">باقي</span>
      </div>
      <div className="mt-3 h-2 rounded-full bg-slate-100 overflow-hidden">
        <div className={`h-full rounded-full ${tone === "pay" ? "bg-rose-400" : "bg-primary"}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-2 text-xs text-slate-500">
        المطلوب {formatEGP(all)} · {doneLabel} {formatEGP(done)} ({pct}%)
      </div>
    </div>
  );
}

function HowItWorks({ settings }: { settings?: Record<string, number> }) {
  const day = (k: string, d: number) => settings?.[k] ?? d;
  return (
    <div className="no-print bg-white rounded-card shadow-card p-5 text-sm text-slate-600 leading-7 space-y-2">
      <b className="text-slate-800">الصفحة دي بتشتغل إزاي؟</b>
      <ul className="list-disc ps-5 space-y-1">
        <li>كل شهر لوحده، مش تراكمي: لما تختار أكتوبر بتشوف اللي كان مطلوب في أكتوبر بس، واتدفع منه كام وفاضل كام. الحاجة اللي اتدفعت بتفضل ظاهرة في شهرها وجنبها «اتدفع ✓».</li>
        <li>
          الفلوس بتتدفع عن الشهر اللي قبله: يوم {day("drivers", 1)} نوفمبر بتدفع <b>مرتبات أكتوبر</b>، ويوم {day("partners", 5)} <b>نصيب الشركاء من أكتوبر</b>، ويوم {day("contractors", 10)} بتستلم من
          المقاولين <b>شغل أكتوبر</b>، ويوم {day("suppliers", 15)} بتدفع <b>مشتريات أكتوبر</b> للموردين. (لو غيّرت اليوم لـ ٢٠ أو بعده يبقى عن نفس الشهر.)
        </li>
        <li>الأقساط: كل شهر قسطه بس. والالتزامات اللي بتكتبها بإيدك (إيجار…) بتظهر في شهر ميعادها، ولو «كل شهر» بتتعمل للشهر الجاي لوحدها لما تتدفع.</li>
        <li>لما تدوس «ادفع» الدفعة بتتسجل عن الشهر ده بالظبط (مرتب أكتوبر، شغل أكتوبر…) وبتطلع من الخزنة.</li>
        <li>لو فيه حاجة متدفعتش من شهر فات، هيطلعلك شريط أحمر فوق بالشهور دي — دوس على الشهر تروحله.</li>
        <li>دوس على أي اسم يطلعلك تفاصيله كلها: السواق مرتبه وسلفه وخصوماته ودفعاته، والمقاول أيامه على كل معدة، والشريك نصيبه من كل معدة، والمورد مشترياته.</li>
      </ul>
    </div>
  );
}

function DetailDialog({ item, onClose, onPay }: { item: DueItem; onClose: () => void; onPay?: () => void }) {
  const recv = item.direction === "receive";
  return (
    <Modal title={`${item.label}${item.covers ? ` — ${prettyMonths(item.covers)}` : ""}`} onClose={onClose}>
      <div className="space-y-4 text-sm">
        {item.details.map((sec) => (
          <div key={sec.title}>
            <div className="font-bold text-slate-700 mb-1">{prettyMonths(sec.title)}</div>
            <table className="w-full">
              <tbody>
                {sec.rows.map((r, i) => (
                  <tr key={i} className="border-b border-slate-100">
                    <td className="py-1.5 text-slate-400 w-24 whitespace-nowrap">{r.date ?? ""}</td>
                    <td className="py-1.5 text-slate-700">{prettyMonths(r.label)}</td>
                    <td className={`py-1.5 text-end font-bold whitespace-nowrap ${r.amount == null ? "" : r.amount < 0 ? "text-rose-600" : "text-slate-800"}`}>{r.amount == null ? "" : formatEGP(r.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
        <div className="rounded-xl bg-slate-50 p-3 grid grid-cols-3 gap-2 text-center">
          <div>
            <div className="text-xs text-slate-500">المطلوب</div>
            <div className="font-extrabold text-slate-800">{formatEGP(item.amount)}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">{recv ? "اتستلم" : "اتدفع"}</div>
            <div className="font-extrabold text-emerald-700">{formatEGP(item.paid)}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">الباقي</div>
            <div className={`font-extrabold ${item.remaining > 0.005 ? "text-rose-600" : "text-slate-400"}`}>{formatEGP(item.remaining)}</div>
          </div>
        </div>
        {onPay && (
          <button onClick={onPay} className="w-full bg-primary text-white rounded-lg py-2.5 font-bold hover:bg-primary-dark">
            {recv ? "استلمت" : "ادفع"} ({formatEGP(item.remaining)})
          </button>
        )}
      </div>
    </Modal>
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
        <button onClick={() => pay(item.remaining)} className="bg-emerald-600 text-white rounded-lg px-4 py-2 text-sm font-bold hover:bg-emerald-700">
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
              className={`flex-1 rounded-lg py-2 text-sm font-bold ${direction === d ? (d === "pay" ? "bg-emerald-600 text-white" : "bg-sky-600 text-white") : "bg-slate-100 text-slate-600"}`}
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
