import { FormEvent, useEffect, useState } from "react";
import { obligationsApi } from "../api/client";
import { Obligation } from "../api/types";
import { formatEGP } from "../utils/format";

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

const inputCls = "rounded-lg border border-slate-200 px-2 py-1.5 text-sm bg-white";

// مواعيد الاستحقاقات والالتزامات: بتسجل "عليك تدفع كذا قبل يوم كذا"، والصفحة
// الرئيسية بتنبهك قبلها بـ 3 أيام ويوم الميعاد ولو اتأخرت.
export default function Obligations() {
  const [list, setList] = useState<Obligation[]>([]);
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState("salaries");
  const [amount, setAmount] = useState("");
  const [due, setDue] = useState(todayISO());
  const [repeat, setRepeat] = useState(true);
  const [note, setNote] = useState("");

  const refresh = () => obligationsApi.list().then(setList);
  useEffect(() => {
    refresh();
  }, []);

  async function add(e: FormEvent) {
    e.preventDefault();
    const t = title.trim() || obligationKindLabel(kind);
    await obligationsApi.create({ title: t, kind, amount: amount ? Number(amount) : null, due_date: due, repeat_monthly: repeat, note: note || null });
    setTitle("");
    setAmount("");
    setNote("");
    refresh();
  }

  async function done(o: Obligation) {
    await obligationsApi.done(o.id);
    refresh();
  }
  async function reopen(o: Obligation) {
    await obligationsApi.reopen(o.id);
    refresh();
  }
  async function remove(o: Obligation) {
    if (!window.confirm(`تمسح "${o.title}"؟`)) return;
    await obligationsApi.remove(o.id);
    refresh();
  }

  const pending = list.filter((o) => !o.done_at);
  const finished = list.filter((o) => o.done_at).slice(0, 30);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900">المواعيد والالتزامات</h1>
        <p className="text-sm text-slate-500 mt-1">
          سجّل أي حاجة لازم تدفعها قبل يوم معيّن (مرتبات، شركاء، إيجار...). الصفحة الرئيسية هتنبهك قبلها بـ 3 أيام ويوم الميعاد ولو اتأخرت.
        </p>
      </div>

      <form onSubmit={add} className="bg-white rounded-card shadow-card p-5 flex flex-wrap items-end gap-2">
        <div>
          <label className="block text-xs text-slate-400 mb-1">النوع</label>
          <select value={kind} onChange={(e) => setKind(e.target.value)} className={inputCls}>
            {OBLIGATION_KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">الوصف</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={obligationKindLabel(kind)} className={`${inputCls} min-w-[180px]`} />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">المبلغ</label>
          <input type="number" min="0" step="any" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="اختياري" className={`${inputCls} w-28`} />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">قبل يوم</label>
          <input type="date" value={due} onChange={(e) => setDue(e.target.value)} className={inputCls} />
        </div>
        <label className="flex items-center gap-1.5 text-sm text-slate-600 pb-1.5">
          <input type="checkbox" checked={repeat} onChange={(e) => setRepeat(e.target.checked)} />
          يتكرر كل شهر
        </label>
        <div>
          <label className="block text-xs text-slate-400 mb-1">ملاحظة</label>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="اختياري" className={inputCls} />
        </div>
        <button type="submit" className="bg-primary text-white rounded-lg px-4 py-1.5 text-sm font-semibold">
          سجّل الميعاد
        </button>
      </form>

      <div className="bg-white rounded-card shadow-card p-5">
        <h2 className="font-bold text-slate-800 mb-3">جاية</h2>
        {pending.length === 0 ? (
          <div className="text-sm text-slate-400">مفيش التزامات مستنية.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-400 border-b border-slate-100">
                <th className="text-start font-semibold py-2">الميعاد</th>
                <th className="text-start font-semibold py-2">الالتزام</th>
                <th className="text-start font-semibold py-2">المبلغ</th>
                <th className="text-start font-semibold py-2">فاضل</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {pending.map((o) => {
                const d = daysUntil(o.due_date);
                return (
                  <tr key={o.id} className="border-b border-slate-50 last:border-0">
                    <td className="py-2 text-slate-600 whitespace-nowrap">{o.due_date}</td>
                    <td className="py-2">
                      <span className="font-semibold text-slate-800">{o.title}</span>
                      <span className="text-xs text-slate-400">
                        {" "}
                        — {obligationKindLabel(o.kind)}
                        {o.repeat_monthly ? " — كل شهر" : ""}
                        {o.note ? ` — ${o.note}` : ""}
                      </span>
                    </td>
                    <td className="py-2 font-semibold text-slate-700">{o.amount != null ? formatEGP(o.amount) : "—"}</td>
                    <td className="py-2">
                      <span
                        className={[
                          "rounded px-2 py-0.5 text-xs font-bold",
                          d <= 0 ? "bg-rose-100 text-rose-700" : d <= 3 ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-600",
                        ].join(" ")}
                      >
                        {dueText(d)}
                      </span>
                    </td>
                    <td className="py-2 whitespace-nowrap text-end">
                      <button onClick={() => done(o)} className="bg-primary text-white rounded-lg px-2.5 py-1 text-xs font-semibold me-2">
                        ✓ اتدفع
                      </button>
                      <button onClick={() => remove(o)} className="text-xs text-rose-500 font-semibold">
                        مسح
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        <p className="text-[11px] text-slate-400 mt-3">لما تدوس "اتدفع" على التزام بيتكرر كل شهر، ميعاد الشهر الجاي بيتسجل لوحده.</p>
      </div>

      {finished.length > 0 && (
        <div className="bg-white rounded-card shadow-card p-5">
          <h2 className="font-bold text-slate-800 mb-3">اتدفعت</h2>
          <table className="w-full text-sm">
            <tbody>
              {finished.map((o) => (
                <tr key={o.id} className="border-b border-slate-50 last:border-0 text-slate-500">
                  <td className="py-1.5">{o.due_date}</td>
                  <td className="py-1.5">{o.title}</td>
                  <td className="py-1.5">{o.amount != null ? formatEGP(o.amount) : "—"}</td>
                  <td className="py-1.5">اتدفع يوم {o.done_at}</td>
                  <td className="py-1.5 text-end">
                    <button onClick={() => reopen(o)} className="text-xs font-semibold text-slate-500">
                      رجّعه
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
