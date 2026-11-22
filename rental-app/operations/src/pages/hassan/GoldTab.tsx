import { FormEvent, useEffect, useState } from "react";
import Icon from "../../components/Icon";
import { ask } from "../../components/Dialogs";
import { GoldEntry, GoldLoan, GoldSummary, goldApi } from "../../api/client";
import Modal from "../../components/Modal";
import { formatEGP } from "../../utils/format";
import { person } from "../../person";
import { PAYMENT_METHODS, paymentMethodLabel } from "../../utils/paymentMethods";

// الفلوس من/لـ خزنة الشركة (من رصيد صاحب الكوميشن جواها) — أو دهب بس من غير فلوس
function MethodSelect({ value, onChange, cashIn, allowNone }: { value: string; onChange: (v: string) => void; cashIn: boolean; allowNone?: boolean }) {
  return (
    <label className="grid gap-0.5 text-[11px] text-slate-400">
      {cashIn ? "الفلوس دخلت الخزنة في" : "الفلوس طلعت من الخزنة من"}
      <select value={value} onChange={(e) => onChange(e.target.value)} className={cls}>
        {PAYMENT_METHODS.map((m) => (
          <option key={m.value} value={m.value}>{m.label}</option>
        ))}
        {allowNone && <option value="">دهب بس — مفيش فلوس</option>}
      </select>
    </label>
  );
}
const cashNote = (r: { method?: string | null }, cashIn: boolean) =>
  r.method ? <span className="text-[11px] text-slate-400"> · {cashIn ? "دخلت" : "طلعت"} {paymentMethodLabel(r.method)}</span> : null;

const cls = "rounded-lg border border-slate-200 px-2 py-1.5 text-sm bg-white";
const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const KARATS = ["24", "21", "18"];
const gr = (n: number) => `${Number(n.toFixed(3)).toLocaleString("en-US")} جم`;
const Gain = ({ v }: { v: number }) => (
  <span className={`font-extrabold ${v > 0.005 ? "text-emerald-700" : v < -0.005 ? "text-rose-600" : "text-slate-500"}`}>
    {v > 0.005 ? "كسبت " : v < -0.005 ? "خسرت " : ""}
    {formatEGP(Math.abs(v))}
  </span>
);

// دهب صاحب الكوميشن: سلف دهب (استلفت/سلّفت وبعدين اترد) وتحويش (اشتريت/بعت).
// كل حاجة بالجرام وسعر الجرام يومها، والمكسب أو الخسارة من فرق السعر.
export default function GoldTab() {
  const [data, setData] = useState<GoldSummary | null>(null);
  const [repaying, setRepaying] = useState<GoldLoan | null>(null);
  const refresh = () => goldApi.summary().then(setData);
  useEffect(() => {
    refresh();
  }, []);
  if (!data) return <div className="text-sm text-slate-400">جاري التحميل...</div>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-card shadow-card p-4">
          <div className="text-xs font-semibold text-slate-500">من سلف الدهب</div>
          <div className="mt-1 text-xl"><Gain v={data.loanGain} /></div>
        </div>
        <div className="bg-white rounded-card shadow-card p-4">
          <div className="text-xs font-semibold text-slate-500">من التحويش (اللي اتباع)</div>
          <div className="mt-1 text-xl"><Gain v={data.saveGain} /></div>
        </div>
        <div className="bg-white rounded-card shadow-card p-4">
          <div className="text-xs font-semibold text-slate-500">الدهب المحوّش دلوقتي</div>
          <div className="mt-1 text-xl font-extrabold text-amber-700">
            {data.holdings.filter((h) => h.grams > 0.0005).map((h) => `${gr(h.grams)} عيار ${h.karat}`).join(" · ") || "—"}
          </div>
        </div>
      </div>

      <LoansSection data={data} onChanged={refresh} onRepay={setRepaying} />
      <SavingsSection data={data} onChanged={refresh} />
      {repaying && <RepayDialog loan={repaying} onClose={() => setRepaying(null)} onDone={() => { setRepaying(null); refresh(); }} />}
    </div>
  );
}

function LoansSection({ data, onChanged, onRepay }: { data: GoldSummary; onChanged: () => void; onRepay: (l: GoldLoan) => void }) {
  const [direction, setDirection] = useState<"borrow" | "lend">("borrow");
  const [method, setMethod] = useState("");
  const [party, setParty] = useState("");
  const [date, setDate] = useState(todayISO());
  const [grams, setGrams] = useState("");
  const [price, setPrice] = useState("");
  const [karat, setKarat] = useState("21");
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  async function add(e: FormEvent) {
    e.preventDefault();
    setErr("");
    try {
      await goldApi.add({ kind: "loan", direction, party, date, grams: Number(grams), price: Number(price), karat, note, method: method || null });
      setGrams("");
      setPrice("");
      setNote("");
      onChanged();
    } catch (x) {
      setErr((x as Error).message.replace(/^Error invoking remote method '[^']+': (Error: )?/, ""));
    }
  }
  return (
    <div className="bg-white rounded-card shadow-card p-5">
      <h2 className="font-bold text-slate-800 mb-1">سلف الدهب</h2>
      <p className="text-xs text-slate-400 mb-3">
        استلفت دهب: لو الدهب غلي لما ترده بتخسر الفرق، ولو رخص بتكسب. سلّفت دهب: العكس. لو الدهب اتحوّل فلوس (بعته أو اشتريته)
        اختار الحساب — الفلوس بتدخل/تطلع من الخزنة ومن رصيد {person()} اللي جواها. «دهب بس» = مفيش فلوس اتحركت.
      </p>
      <form onSubmit={add} className="no-print flex flex-wrap items-end gap-2 mb-4">
        <select value={direction} onChange={(e) => setDirection(e.target.value as "borrow" | "lend")} className={cls}>
          <option value="borrow">استلفت من</option>
          <option value="lend">سلّفت لـ</option>
        </select>
        <input value={party} onChange={(e) => setParty(e.target.value)} placeholder="الاسم" className={cls} />
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={cls} />
        <input type="number" min="0" step="any" value={grams} onChange={(e) => setGrams(e.target.value)} placeholder="كام جرام" className={`${cls} w-24`} />
        <select value={karat} onChange={(e) => setKarat(e.target.value)} className={cls}>
          {KARATS.map((k) => (
            <option key={k} value={k}>عيار {k}</option>
          ))}
        </select>
        <input type="number" min="0" step="any" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="سعر الجرام يومها" className={`${cls} w-32`} />
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="ملاحظة" className={cls} />
        <MethodSelect value={method} onChange={setMethod} cashIn={direction === "borrow"} allowNone />
        <button type="submit" disabled={!party.trim() || !grams || !price} className="bg-primary text-white rounded-lg px-4 py-1.5 text-sm font-semibold disabled:opacity-50">
          سجّل
        </button>
      </form>
      {err && <div className="text-sm text-rose-600 font-semibold mb-2">{err}</div>}
      {data.loans.length === 0 ? (
        <div className="text-sm text-slate-400">مفيش سلف دهب.</div>
      ) : (
        <div className="space-y-3">
          {data.loans.map((l) => (
            <div key={l.id} className="rounded-xl border border-slate-200 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <b className="text-slate-800">
                    {l.direction === "borrow" ? `استلفت من ${l.party}` : `سلّفت لـ ${l.party}`} — {gr(l.grams)} عيار {l.karat ?? "21"}
                  </b>
                  <div className="text-xs text-slate-500">
                    يوم {l.date} والجرام بـ {formatEGP(l.price)} (قيمتها ساعتها {formatEGP(l.value)}){l.note ? ` — ${l.note}` : ""}
                    {cashNote(l, l.direction === "borrow")}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm">
                    {l.remaining > 0.0005 ? <span className="font-bold text-amber-700">باقي {gr(l.remaining)}</span> : <span className="font-bold text-emerald-700">اترد كله ✓</span>}
                  </span>
                  {l.repays.length > 0 && <Gain v={l.gain} />}
                  {l.remaining > 0.0005 && (
                    <button onClick={() => onRepay(l)} className="no-print rounded-lg bg-primary text-white px-3 py-1.5 text-xs font-bold hover:bg-primary-dark">
                      {l.direction === "borrow" ? "رديت" : "رجعولي"}
                    </button>
                  )}
                  <DeleteButton id={l.id} what="السلفة دي وكل اللي اترد منها" onChanged={onChanged} />
                </div>
              </div>
              {l.repays.length > 0 && (
                <table className="w-full text-xs mt-2">
                  <tbody>
                    {l.repays.map((r) => (
                      <tr key={r.id} className="border-t border-slate-100">
                        <td className="py-1.5 text-slate-500">{r.date}</td>
                        <td className="py-1.5">{l.direction === "borrow" ? "رديت" : "رجعولي"} {gr(r.grams)}</td>
                        <td className="py-1.5 text-slate-500">والجرام بـ {formatEGP(r.price)}{cashNote(r, l.direction === "lend")}</td>
                        <td className="py-1.5"><Gain v={r.gain} /></td>
                        <td className="py-1.5 no-print text-end"><DeleteButton id={r.id} what="الرد ده" onChanged={onChanged} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SavingsSection({ data, onChanged }: { data: GoldSummary; onChanged: () => void }) {
  const [direction, setDirection] = useState<"buy" | "sell">("buy");
  const [method, setMethod] = useState("cash");
  const [date, setDate] = useState(todayISO());
  const [grams, setGrams] = useState("");
  const [price, setPrice] = useState("");
  const [karat, setKarat] = useState("21");
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  async function add(e: FormEvent) {
    e.preventDefault();
    setErr("");
    try {
      await goldApi.add({ kind: "save", direction, date, grams: Number(grams), price: Number(price), karat, note, method: method || null });
      setGrams("");
      setPrice("");
      setNote("");
      onChanged();
    } catch (x) {
      setErr((x as Error).message.replace(/^Error invoking remote method '[^']+': (Error: )?/, ""));
    }
  }
  return (
    <div className="bg-white rounded-card shadow-card p-5">
      <h2 className="font-bold text-slate-800 mb-1">تحويش الدهب</h2>
      <p className="text-xs text-slate-400 mb-3">كل ما تشتري بيتحسب متوسط سعر الجرام، ولما تبيع بيطلعلك كسبت أو خسرت كام — كل عيار لوحده. الشرا بيطلع من الخزنة (من رصيد {person()})، والبيع بيدخلها.</p>
      <form onSubmit={add} className="no-print flex flex-wrap items-end gap-2 mb-4">
        <select value={direction} onChange={(e) => setDirection(e.target.value as "buy" | "sell")} className={cls}>
          <option value="buy">اشتريت</option>
          <option value="sell">بعت</option>
        </select>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={cls} />
        <input type="number" min="0" step="any" value={grams} onChange={(e) => setGrams(e.target.value)} placeholder="كام جرام" className={`${cls} w-24`} />
        <select value={karat} onChange={(e) => setKarat(e.target.value)} className={cls}>
          {KARATS.map((k) => (
            <option key={k} value={k}>عيار {k}</option>
          ))}
        </select>
        <input type="number" min="0" step="any" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="سعر الجرام" className={`${cls} w-28`} />
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="ملاحظة" className={cls} />
        <MethodSelect value={method} onChange={setMethod} cashIn={direction === "sell"} allowNone />
        <button type="submit" disabled={!grams || !price} className="bg-primary text-white rounded-lg px-4 py-1.5 text-sm font-semibold disabled:opacity-50">
          سجّل
        </button>
      </form>
      {err && <div className="text-sm text-rose-600 font-semibold mb-2">{err}</div>}
      {data.holdings.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          {data.holdings.map((h) => (
            <div key={h.karat} className="rounded-xl bg-amber-50 p-3 text-sm">
              <b className="text-amber-800">عيار {h.karat}</b>
              <div>عندك {gr(h.grams)} — متوسط الجرام {formatEGP(h.avg)}</div>
              <div className="text-xs text-slate-500">اشتريت {gr(h.bought)} وبعت {gr(h.sold)}</div>
              {h.sold > 0 && <div className="text-xs mt-1">من البيع: <Gain v={h.gain} /></div>}
            </div>
          ))}
        </div>
      )}
      {data.savings.length === 0 ? (
        <div className="text-sm text-slate-400">مفيش تحويش.</div>
      ) : (
        <table className="w-full text-sm">
          <tbody>
            {data.savings.map((r: GoldEntry) => (
              <tr key={r.id} className="border-b border-slate-50">
                <td className="py-1.5 text-slate-500">{r.date}</td>
                <td className="py-1.5 font-semibold">{r.direction === "buy" ? "اشتريت" : "بعت"} {gr(r.grams)} عيار {r.karat ?? "21"}{cashNote(r, r.direction === "sell")}</td>
                <td className="py-1.5 text-slate-500">الجرام بـ {formatEGP(r.price)}{r.avg != null ? ` (متوسط الشرا ${formatEGP(r.avg)})` : ""}</td>
                <td className="py-1.5">{r.gain != null ? <Gain v={r.gain} /> : <span className="text-slate-400">{formatEGP(r.grams * r.price)}</span>}</td>
                <td className="py-1.5 no-print text-end"><DeleteButton id={r.id} what="السطر ده" onChanged={onChanged} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function RepayDialog({ loan, onClose, onDone }: { loan: GoldLoan; onClose: () => void; onDone: () => void }) {
  const [grams, setGrams] = useState(String(loan.remaining));
  const [price, setPrice] = useState("");
  const [date, setDate] = useState(todayISO());
  const [method, setMethod] = useState(loan.method ?? "");
  const [err, setErr] = useState("");
  const g = Number(grams) || 0;
  const p = Number(price) || 0;
  const gain = p ? (loan.direction === "borrow" ? 1 : -1) * g * (loan.price - p) : null;
  async function save(e: FormEvent) {
    e.preventDefault();
    try {
      await goldApi.add({ kind: "loan", direction: "repay", ref_id: loan.id, date, grams: g, price: p, method: method || null });
      onDone();
    } catch (x) {
      setErr((x as Error).message.replace(/^Error invoking remote method '[^']+': (Error: )?/, ""));
    }
  }
  return (
    <Modal title={loan.direction === "borrow" ? `رديت الدهب لـ ${loan.party}` : `${loan.party} رجّعلي الدهب`} onClose={onClose}>
      <form onSubmit={save} className="space-y-3 text-sm">
        <div className="bg-slate-50 rounded-xl p-3">
          {loan.direction === "borrow" ? "استلفت" : "سلّفت"} {gr(loan.grams)} يوم {loan.date} والجرام بـ {formatEGP(loan.price)} — الباقي {gr(loan.remaining)}
        </div>
        <div className="flex flex-wrap gap-2">
          <input type="number" min="0" step="any" value={grams} onChange={(e) => setGrams(e.target.value)} placeholder="كام جرام" className={`${cls} w-28`} />
          <input type="number" min="0" step="any" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="سعر الجرام النهارده" className={`${cls} w-40`} autoFocus />
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={cls} />
        </div>
        <MethodSelect value={method} onChange={setMethod} cashIn={loan.direction === "lend"} allowNone />
        {gain != null && <div className="text-base">كده <Gain v={gain} /></div>}
        {err && <div className="text-rose-600 font-semibold">{err}</div>}
        <button type="submit" disabled={!g || !p} className="bg-primary text-white rounded-lg px-4 py-2 font-bold disabled:opacity-50">
          سجّل
        </button>
      </form>
    </Modal>
  );
}

function DeleteButton({ id, what, onChanged }: { id: number; what: string; onChanged: () => void }) {
  return (
    <button
      onClick={async () => {
        if (!(await ask(`تمسح ${what}؟`))) return;
        await goldApi.remove(id);
        onChanged();
      }}
      className="no-print text-xs font-bold text-rose-500"
      title="مسح"
    >
      <Icon name="trash" className="w-4 h-4" />
    </button>
  );
}
