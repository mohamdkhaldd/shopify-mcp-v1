import { FormEvent, useEffect, useState } from "react";
import MonthPicker from "../components/equipment/MonthPicker";
import PrintButton from "../components/PrintButton";
import { PrintHeader, PrintSignoff } from "../components/PrintSignoff";
import { carApi, equipmentApi, monthlyExpensesApi } from "../api/client";
import { CarSummary, Equipment } from "../api/types";
import { currentMonthKey, monthLabel } from "../utils/months";
import { formatEGP } from "../utils/format";
import { PAYMENT_METHODS } from "../utils/paymentMethods";

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const inputCls = "rounded-lg border border-slate-200 px-2 py-1.5 text-sm bg-white";
const KINDS = ["بنزين", "زيت", "صيانة", "غسيل", "أخرى"];

// العربية الملاكي: البنزين والزيت حسابك الخاص، ولما تاخدها مشوار شغل بتسجل
// سعر المشوار على المعدة (مصروف "عربية ملاكي" من الخزنة) — ويتخصم من فلوس
// البنزين. الباقي خاص وبيتخصم من كوميشن حسن.
export default function Car() {
  const [month, setMonth] = useState(currentMonthKey());
  const [data, setData] = useState<CarSummary | null>(null);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [fDate, setFDate] = useState(todayISO());
  const [fKind, setFKind] = useState("بنزين");
  const [fAmount, setFAmount] = useState("");
  const [fNote, setFNote] = useState("");
  const [tDate, setTDate] = useState(todayISO());
  const [tEquipment, setTEquipment] = useState("");
  const [tAmount, setTAmount] = useState("");
  const [tMethod, setTMethod] = useState("cash");
  const [tNote, setTNote] = useState("");
  const [notice, setNotice] = useState("");

  const refresh = () => carApi.summary(month).then(setData);
  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);
  useEffect(() => {
    equipmentApi.list().then(setEquipment);
  }, []);

  const breakdown = (s: CarSummary) =>
    [
      `صرفت ${formatEGP(s.fuelTotal)} على العربية في ${monthLabel(s.month)}:`,
      `${formatEGP(s.personal)} خاص (من كوميشن حسن)`,
      ...s.byEquipment.map((b) => `${formatEGP(b.amount)} على ${b.equipment_name}`),
    ].join(" — ");

  async function addFuel(e: FormEvent) {
    e.preventDefault();
    if (!fAmount) return;
    const s = await carApi.addFuel({ date: fDate, kind: fKind, amount: Number(fAmount), note: fNote || null });
    setFAmount("");
    setFNote("");
    setNotice(breakdown(s));
    if (fDate.slice(0, 7) === month) setData({ ...s, categoryId: data?.categoryId ?? null, yearPersonal: data?.yearPersonal ?? 0 });
    refresh();
  }

  async function addTrip(e: FormEvent) {
    e.preventDefault();
    if (!tAmount || !tEquipment) return;
    const { id: categoryId } = await carApi.ensureCategory();
    await monthlyExpensesApi.create({
      equipment_id: Number(tEquipment),
      month: tDate.slice(0, 7),
      date: tDate,
      category_id: categoryId,
      amount: Number(tAmount),
      payment_method: tMethod,
      note: tNote || "مشوار بالعربية الملاكي",
      receipt_image: null,
      paid_amount: null,
      payee: null,
    });
    setTAmount("");
    setTNote("");
    const s = await carApi.summary(tDate.slice(0, 7));
    setNotice(breakdown(s));
    refresh();
  }

  async function removeFuel(id: number) {
    if (!window.confirm("تمسح السطر ده؟")) return;
    await carApi.removeFuel(id);
    refresh();
  }

  async function removeTrip(id: number) {
    if (!window.confirm("تمسح المشوار ده؟ هيتمسح من مصروفات المعدة كمان.")) return;
    await monthlyExpensesApi.remove(id);
    refresh();
  }

  return (
    <div className="space-y-6">
      <PrintHeader title="العربية الملاكي" subtitle={`${monthLabel(month)} ${month.slice(0, 4)}`} />
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">العربية الملاكي</h1>
          <p className="text-sm text-slate-500 mt-1">
            سجّل البنزين والزيت كل مرة. مشوار الشغل بيتسجل على المعدة ويتخصم من فلوس البنزين — والباقي خاص بيتخصم من كوميشن حسن.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <PrintButton />
          <MonthPicker month={month} onChange={setMonth} />
        </div>
      </div>

      {notice && (
        <div className="no-print flex items-center justify-between rounded-xl px-4 py-2.5 text-sm font-semibold bg-primary-light text-primary-dark">
          <span>{notice}</span>
          <button onClick={() => setNotice("")} className="text-xs opacity-70">
            إخفاء
          </button>
        </div>
      )}

      {data && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white rounded-card shadow-card p-4">
            <div className="text-xs text-slate-500 font-semibold">بنزين وزيت الشهر</div>
            <div className="mt-1 text-xl font-extrabold text-slate-800">{formatEGP(data.fuelTotal)}</div>
          </div>
          <div className="bg-white rounded-card shadow-card p-4">
            <div className="text-xs text-slate-500 font-semibold">مشاوير شغل (من الخزنة)</div>
            <div className="mt-1 text-xl font-extrabold text-primary-dark">{formatEGP(data.tripsTotal)}</div>
          </div>
          <div className="bg-white rounded-card shadow-card p-4">
            <div className="text-xs text-slate-500 font-semibold">خاص (من كوميشن حسن)</div>
            <div className="mt-1 text-xl font-extrabold text-rose-600">{formatEGP(data.personal)}</div>
          </div>
          <div className="bg-white rounded-card shadow-card p-4">
            <div className="text-xs text-slate-500 font-semibold">خاص السنة دي</div>
            <div className="mt-1 text-xl font-extrabold text-slate-700">{formatEGP(data.yearPersonal)}</div>
          </div>
        </div>
      )}
      {data && data.over > 0 && (
        <div className="rounded-xl bg-amber-50 text-amber-800 px-4 py-2.5 text-sm font-semibold">
          ⚠ المشاوير الشهر ده أكتر من البنزين بـ {formatEGP(data.over)} — اتأكد إنك سجلت كل البنزين.
        </div>
      )}

      {data && data.fuelTotal > 0 && (
        <div className="bg-white rounded-card shadow-card p-5">
          <h2 className="font-bold text-slate-800 mb-3">تقسيم فلوس العربية — {monthLabel(month)}</h2>
          <table className="w-full text-sm">
            <tbody>
              <tr className="border-b border-slate-50">
                <td className="py-2 text-slate-600">خاص — من كوميشن حسن</td>
                <td className="py-2 font-bold text-rose-600">{formatEGP(data.personal)}</td>
              </tr>
              {data.byEquipment.map((b) => (
                <tr key={b.equipment_name} className="border-b border-slate-50">
                  <td className="py-2 text-slate-600">على {b.equipment_name} — من الخزنة</td>
                  <td className="py-2 font-bold text-primary-dark">{formatEGP(b.amount)}</td>
                </tr>
              ))}
              <tr>
                <td className="pt-2 font-bold text-slate-700">الإجمالي</td>
                <td className="pt-2 font-bold text-slate-800">{formatEGP(data.fuelTotal)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="bg-white rounded-card shadow-card p-5">
          <h2 className="font-bold text-slate-800 mb-3">بنزين وزيت</h2>
          <form onSubmit={addFuel} className="no-print flex flex-wrap items-end gap-2 mb-4">
            <input type="date" value={fDate} onChange={(e) => setFDate(e.target.value)} className={inputCls} />
            <select value={fKind} onChange={(e) => setFKind(e.target.value)} className={inputCls}>
              {KINDS.map((k) => (
                <option key={k}>{k}</option>
              ))}
            </select>
            <input type="number" min="0" step="any" placeholder="المبلغ" value={fAmount} onChange={(e) => setFAmount(e.target.value)} className={`${inputCls} w-28`} />
            <input placeholder="ملاحظة" value={fNote} onChange={(e) => setFNote(e.target.value)} className={inputCls} />
            <button type="submit" className="bg-primary text-white rounded-lg px-3 py-1.5 text-sm font-semibold">
              حطيت
            </button>
          </form>
          {!data || data.fuel.length === 0 ? (
            <div className="text-sm text-slate-400">مفيش حاجة الشهر ده.</div>
          ) : (
            <table className="w-full text-sm">
              <tbody>
                {data.fuel.map((f) => (
                  <tr key={f.id} className="border-b border-slate-50 last:border-0">
                    <td className="py-1.5 text-slate-500">{f.date}</td>
                    <td className="py-1.5 text-slate-700 font-semibold">{f.kind}</td>
                    <td className="py-1.5 text-slate-500">{f.note ?? ""}</td>
                    <td className="py-1.5 font-semibold text-slate-800">{formatEGP(f.amount)}</td>
                    <td className="no-print py-1.5">
                      <button onClick={() => removeFuel(f.id)} className="text-xs text-rose-500 font-semibold">
                        حذف
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="bg-white rounded-card shadow-card p-5">
          <h2 className="font-bold text-slate-800 mb-1">مشاوير شغل</h2>
          <p className="no-print text-xs text-slate-400 mb-3">بيتسجل مصروف "عربية ملاكي" على المعدة (من الخزنة)، وبيظهر في مصروفات المعدة كمان.</p>
          <form onSubmit={addTrip} className="no-print flex flex-wrap items-end gap-2 mb-4">
            <input type="date" value={tDate} onChange={(e) => setTDate(e.target.value)} className={inputCls} />
            <select value={tEquipment} onChange={(e) => setTEquipment(e.target.value)} className={inputCls}>
              <option value="">على أنهي معدة؟</option>
              {equipment.map((eq) => (
                <option key={eq.id} value={eq.id}>
                  {eq.name}
                </option>
              ))}
            </select>
            <input type="number" min="0" step="any" placeholder="سعر المشوار" value={tAmount} onChange={(e) => setTAmount(e.target.value)} className={`${inputCls} w-28`} />
            <select value={tMethod} onChange={(e) => setTMethod(e.target.value)} className={inputCls}>
              {PAYMENT_METHODS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
            <input placeholder="رايح فين؟" value={tNote} onChange={(e) => setTNote(e.target.value)} className={inputCls} />
            <button type="submit" disabled={!tEquipment || !tAmount} className="bg-primary text-white rounded-lg px-3 py-1.5 text-sm font-semibold disabled:opacity-50">
              سجّل المشوار
            </button>
          </form>
          {!data || data.trips.length === 0 ? (
            <div className="text-sm text-slate-400">مفيش مشاوير الشهر ده.</div>
          ) : (
            <table className="w-full text-sm">
              <tbody>
                {data.trips.map((t) => (
                  <tr key={t.id} className="border-b border-slate-50 last:border-0">
                    <td className="py-1.5 text-slate-500">{t.date ?? t.month}</td>
                    <td className="py-1.5 text-slate-700 font-semibold">{t.equipment_name}</td>
                    <td className="py-1.5 text-slate-500">{t.note ?? ""}</td>
                    <td className="py-1.5 font-semibold text-primary-dark">{formatEGP(t.amount)}</td>
                    <td className="no-print py-1.5">
                      <button onClick={() => removeTrip(t.id)} className="text-xs text-rose-500 font-semibold">
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
      <PrintSignoff />
    </div>
  );
}
