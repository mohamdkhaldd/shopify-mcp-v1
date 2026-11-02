import { FormEvent, useEffect, useState } from "react";
import { installmentsApi } from "../../api/client";
import { HassanInstallment } from "../../api/types";
import { person } from "../../person";
import { formatEGP } from "../../utils/format";
import { PAYMENT_METHODS } from "../../utils/paymentMethods";

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function dueText(days: number) {
  if (days < 0) return `متأخر ${-days} يوم`;
  if (days === 0) return "النهارده";
  if (days === 1) return "بكرة";
  return `بعد ${days} يوم`;
}

const inputCls = "rounded-lg border border-slate-200 px-2 py-1.5 text-sm bg-white";

function InstallmentCard({ inst, onChanged }: { inst: HassanInstallment; onChanged: () => void }) {
  const [method, setMethod] = useState("cash");
  const [date, setDate] = useState(todayISO());
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(inst.title);
  const [amount, setAmount] = useState(String(inst.amount));
  const [count, setCount] = useState(inst.count ? String(inst.count) : "");
  const [start, setStart] = useState(inst.start_date);
  const [note, setNote] = useState(inst.note ?? "");
  const [showHistory, setShowHistory] = useState(false);

  async function pay() {
    await installmentsApi.pay(inst.id, date, method);
    onChanged();
  }
  async function save() {
    await installmentsApi.update({ id: inst.id, title, amount: Number(amount), count: count ? Number(count) : null, start_date: start, note: note || null });
    setEditing(false);
    onChanged();
  }
  async function remove() {
    if (!window.confirm(`تمسح "${inst.title}"؟`)) return;
    const withPayments = inst.paidCount > 0 && window.confirm(`تمسح كمان الأقساط اللي اتدفعت منه (${inst.paidCount})؟ لو "إلغاء" هتفضل متسجلة صرف من الكوميشن.`);
    await installmentsApi.remove(inst.id, withPayments);
    onChanged();
  }
  async function undoPayment(id: number) {
    if (!window.confirm("ترجّع الدفعة دي؟ الفلوس هترجع الخزنة والقسط يرجع مستني.")) return;
    await installmentsApi.removePayment(id);
    onChanged();
  }

  const badge =
    inst.days == null
      ? "bg-slate-100 text-slate-500"
      : inst.days <= 0
        ? "bg-rose-100 text-rose-700"
        : inst.days <= 3
          ? "bg-amber-100 text-amber-800"
          : "bg-slate-100 text-slate-600";

  return (
    <div className={`bg-white rounded-card shadow-card p-5 space-y-3 ${inst.done ? "opacity-70" : ""}`}>
      {editing ? (
        <div className="flex flex-wrap items-end gap-2">
          <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} placeholder="القسط" />
          <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className={`${inputCls} w-28`} placeholder="قيمة القسط" />
          <input type="number" value={count} onChange={(e) => setCount(e.target.value)} className={`${inputCls} w-24`} placeholder="عدد الأقساط" />
          <input type="date" value={start} onChange={(e) => setStart(e.target.value)} className={inputCls} />
          <input value={note} onChange={(e) => setNote(e.target.value)} className={inputCls} placeholder="ملاحظة" />
          <button onClick={save} className="bg-primary text-white rounded-lg px-3 py-1.5 text-sm font-semibold">
            حفظ
          </button>
          <button onClick={() => setEditing(false)} className="text-xs text-slate-500 font-semibold">
            إلغاء
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <div className="font-extrabold text-slate-900">{inst.title}</div>
            <div className="text-xs text-slate-500 mt-0.5">
              {formatEGP(inst.amount)} كل شهر{inst.count ? ` — ${inst.count} قسط` : ""} — من {inst.start_date}
              {inst.note ? ` — ${inst.note}` : ""}
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs font-semibold">
            <button onClick={() => setEditing(true)} className="text-primary">
              تعديل
            </button>
            <button onClick={remove} className="text-rose-500">
              حذف
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="text-center bg-emerald-50 rounded-xl py-2">
          <div className="text-xs text-slate-500">اتدفع</div>
          <div className="font-bold text-emerald-700">
            {inst.paidCount}
            {inst.count ? ` من ${inst.count}` : ""} — {formatEGP(inst.paidTotal)}
          </div>
        </div>
        <div className="text-center bg-rose-50 rounded-xl py-2">
          <div className="text-xs text-slate-500">فاضل</div>
          <div className="font-bold text-rose-600">
            {inst.count ? `${inst.remainingCount} قسط — ${formatEGP(inst.remainingAmount ?? 0)}` : "مفتوح"}
          </div>
        </div>
        <div className="text-center bg-slate-50 rounded-xl py-2 col-span-2">
          <div className="text-xs text-slate-500">القسط الجاي</div>
          <div className="font-bold text-slate-800">
            {inst.done ? (
              "خلصت ✓"
            ) : (
              <>
                رقم {inst.nextNumber} يوم {inst.nextDue}{" "}
                {inst.days != null && <span className={`ms-1 rounded px-2 py-0.5 text-xs ${badge}`}>{dueText(inst.days)}</span>}
              </>
            )}
          </div>
        </div>
      </div>

      {!inst.done && (
        <div className="no-print flex flex-wrap items-center gap-2">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
          <select value={method} onChange={(e) => setMethod(e.target.value)} className={inputCls}>
            {PAYMENT_METHODS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
          <button onClick={pay} className="bg-primary text-white rounded-lg px-4 py-1.5 text-sm font-semibold hover:bg-primary-dark">
            ✓ دفعت القسط ({formatEGP(inst.amount)})
          </button>
          <span className="text-[11px] text-slate-400">بيطلع من الحساب ده في خزنة الشركة ويتخصم من كوميشن {person()}.</span>
        </div>
      )}

      {inst.payments.length > 0 && (
        <div>
          <button onClick={() => setShowHistory(!showHistory)} className="no-print text-xs font-semibold text-slate-500">
            {showHistory ? "اخفي الدفعات" : `الدفعات (${inst.payments.length})`}
          </button>
          {showHistory && (
            <table className="w-full text-sm mt-2">
              <tbody>
                {inst.payments.map((p) => (
                  <tr key={p.id} className="border-b border-slate-50 last:border-0">
                    <td className="py-1.5 text-slate-600">قسط {p.number}</td>
                    <td className="py-1.5 text-slate-500">ميعاده {p.due_date}</td>
                    <td className="py-1.5 text-slate-500">اتدفع {p.paid_date}</td>
                    <td className="py-1.5 font-semibold text-slate-700">{formatEGP(p.amount)}</td>
                    <td className="no-print py-1.5 text-end">
                      <button onClick={() => undoPayment(p.id)} className="text-xs text-rose-500 font-semibold">
                        رجّع
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

// أقساط صاحب الكوميشن: عليه كام قسط إيه، وزرار "دفعت"، وتنبيه في الصفحة
// الرئيسية قبل الميعاد بـ 3 أيام.
export default function InstallmentsTab() {
  const [list, setList] = useState<HassanInstallment[] | null>(null);
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [count, setCount] = useState("");
  const [start, setStart] = useState(todayISO());
  const [note, setNote] = useState("");

  const refresh = () => installmentsApi.list().then(setList);
  useEffect(() => {
    refresh();
  }, []);

  async function add(e: FormEvent) {
    e.preventDefault();
    if (!title.trim() || !amount) return;
    await installmentsApi.create({ title, amount: Number(amount), count: count ? Number(count) : null, start_date: start, note: note || null });
    setTitle("");
    setAmount("");
    setCount("");
    setNote("");
    refresh();
  }

  const open = (list ?? []).filter((i) => !i.done);
  const finished = (list ?? []).filter((i) => i.done);
  const monthlyTotal = open.reduce((s, i) => s + i.amount, 0);
  const remainingTotal = open.reduce((s, i) => s + (i.remainingAmount ?? 0), 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white rounded-card shadow-card p-5">
          <div className="text-sm text-slate-500 font-semibold">أقساط كل شهر</div>
          <div className="mt-2 text-2xl font-extrabold text-slate-800">{formatEGP(monthlyTotal)}</div>
        </div>
        <div className="bg-white rounded-card shadow-card p-5">
          <div className="text-sm text-slate-500 font-semibold">فاضل في كل الأقساط</div>
          <div className="mt-2 text-2xl font-extrabold text-rose-600">{formatEGP(remainingTotal)}</div>
        </div>
      </div>

      <form onSubmit={add} className="no-print bg-white rounded-card shadow-card p-5 flex flex-wrap items-end gap-2">
        <div>
          <label className="block text-xs text-slate-400 mb-1">القسط ده إيه</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="قسط العربية، جمعية..." className={inputCls} />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">قيمة القسط</label>
          <input type="number" min="0" step="any" value={amount} onChange={(e) => setAmount(e.target.value)} className={`${inputCls} w-28`} />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">عدد الأقساط</label>
          <input type="number" min="1" value={count} onChange={(e) => setCount(e.target.value)} placeholder="فاضي = مفتوح" className={`${inputCls} w-28`} />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">ميعاد أول قسط</label>
          <input type="date" value={start} onChange={(e) => setStart(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">ملاحظة</label>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="اختياري" className={inputCls} />
        </div>
        <button type="submit" disabled={!title.trim() || !amount} className="bg-primary text-white rounded-lg px-4 py-1.5 text-sm font-semibold disabled:opacity-50">
          إضافة قسط
        </button>
        <p className="w-full text-[11px] text-slate-400">كل شهر في نفس اليوم. الصفحة الرئيسية بتنبهك قبل الميعاد بـ 3 أيام ويوم الميعاد ولو اتأخرت.</p>
      </form>

      {!list ? (
        <div className="text-sm text-slate-400">جاري التحميل...</div>
      ) : open.length === 0 && finished.length === 0 ? (
        <div className="bg-white rounded-card shadow-card p-6 text-sm text-slate-400">لسه مفيش أقساط.</div>
      ) : (
        <>
          {open.map((i) => (
            <InstallmentCard key={i.id} inst={i} onChanged={refresh} />
          ))}
          {finished.length > 0 && <div className="text-xs font-bold text-slate-400 pt-2">أقساط خلصت</div>}
          {finished.map((i) => (
            <InstallmentCard key={i.id} inst={i} onChanged={refresh} />
          ))}
        </>
      )}
    </div>
  );
}
