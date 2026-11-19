import { FormEvent, useEffect, useState } from "react";
import EditRowButton from "../components/EditRowButton";
import MonthPicker from "../components/equipment/MonthPicker";
import PrintButton from "../components/PrintButton";
import { PrintHeader, PrintSignoff } from "../components/PrintSignoff";
import { Car as CarRow, carApi, equipmentApi, monthlyExpensesApi } from "../api/client";
import Modal from "../components/Modal";
import { PAYMENT_METHODS, paymentMethodLabel } from "../utils/paymentMethods";
import { CarSummary, Equipment } from "../api/types";
import { currentMonthKey, monthLabel } from "../utils/months";
import { formatEGP } from "../utils/format";
import { person } from "../person";

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const inputCls = "rounded-lg border border-slate-200 px-2 py-1.5 text-sm bg-white";
const KINDS = ["بنزين", "زيت", "صيانة", "غسيل", "أخرى"];

// العربية الملاكي: البنزين والزيت حسابك الخاص، ولما تاخدها مشوار شغل بتسجل
// سعر المشوار على المعدة (مصروف "عربية ملاكي") — بيتخصم من فلوس العربية اللي
// اتدفعت، مش من الخزنة. الباقي خاص وبيتخصم من كوميشن حسن.
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
  const [tNote, setTNote] = useState("");
  const [notice, setNotice] = useState("");
  // كذا عربية: تاب لكل واحدة
  const [cars, setCars] = useState<CarRow[]>([]);
  const [carId, setCarId] = useState<number | null>(null);
  const [editCar, setEditCar] = useState<Partial<CarRow> | null>(null);
  const [fMethod, setFMethod] = useState("cash");
  const [iDate, setIDate] = useState(todayISO());
  const [iAmount, setIAmount] = useState("");
  const [iMethod, setIMethod] = useState("cash");
  const [iNote, setINote] = useState("");

  const loadCars = () =>
    carApi.list().then((list) => {
      setCars(list);
      setCarId((cur) => (cur && list.some((c) => c.id === cur) ? cur : list[0]?.id ?? null));
    });
  useEffect(() => {
    loadCars();
  }, []);
  const refresh = () => {
    if (carId) carApi.summary(month, carId).then(setData);
  };
  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, carId]);
  const car = cars.find((c) => c.id === carId) ?? null;
  const work = car?.kind === "work";

  async function saveCar(e: FormEvent) {
    e.preventDefault();
    if (!editCar?.name?.trim()) return;
    const r = await carApi.save({ id: editCar.id, name: editCar.name, plate: editCar.plate ?? null, kind: editCar.kind ?? "personal", note: editCar.note ?? null });
    setEditCar(null);
    await loadCars();
    setCarId(r.id);
  }
  async function removeCar() {
    if (!car || !window.confirm(`تمسح «${car.name}» وكل مصاريفها ودخلها؟`)) return;
    await carApi.remove(car.id);
    setCarId(null);
    loadCars();
  }
  async function addIncome(e: FormEvent) {
    e.preventDefault();
    if (!carId || !iAmount) return;
    await carApi.addIncome({ car_id: carId, date: iDate, amount: Number(iAmount), method: iMethod, note: iNote || null });
    setIAmount("");
    setINote("");
    refresh();
  }
  useEffect(() => {
    equipmentApi.list().then(setEquipment);
  }, []);

  const breakdown = (s: CarSummary) =>
    [
      `صرفت ${formatEGP(s.fuelTotal)} على العربية في ${monthLabel(s.month)}:`,
      `${formatEGP(s.personal)} خاص (من كوميشن ${person()})`,
      ...s.byEquipment.map((b) => `${formatEGP(b.amount)} على ${b.equipment_name}`),
    ].join(" — ");

  async function addFuel(e: FormEvent) {
    e.preventDefault();
    if (!fAmount) return;
    const s = await carApi.addFuel({ date: fDate, kind: fKind, amount: Number(fAmount), note: fNote || null, car_id: carId ?? undefined, method: work ? fMethod : undefined });
    setFAmount("");
    setFNote("");
    if (!work) setNotice(breakdown(s));
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
      payment_method: "car",
      note: tNote || "مشوار بالعربية الملاكي",
      receipt_image: null,
      paid_amount: null,
      payee: null,
      car_id: carId,
    });
    setTAmount("");
    setTNote("");
    const s = await carApi.summary(tDate.slice(0, 7), carId ?? undefined);
    if (!work) setNotice(breakdown(s));
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
      <PrintHeader title={car?.name ?? "السيارات"} subtitle={`${monthLabel(month)} ${month.slice(0, 4)}`} />
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">السيارات</h1>
          <p className="text-sm text-slate-500 mt-1">
            {work
              ? "عربية شغل: مصاريفها بتطلع من الخزنة، واللي بتدخّله بيدخل الخزنة — وتحت ربحها الشهر ده."
              : <>سجّل البنزين والزيت كل مرة. مشوار الشغل بيتسجل على المعدة ويتخصم من فلوس العربية (مش من الخزنة) — والباقي خاص بيتخصم من كوميشن {person()}.</>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <PrintButton />
          <MonthPicker month={month} onChange={setMonth} />
        </div>
      </div>

      <div className="no-print flex flex-wrap items-center gap-2">
        {cars.map((c) => (
          <button
            key={c.id}
            onClick={() => setCarId(c.id)}
            className={[
              "rounded-xl px-4 py-2 text-sm font-bold transition-colors",
              c.id === carId ? "bg-primary text-white shadow-sm" : "bg-white text-slate-600 shadow-card hover:text-primary-dark",
            ].join(" ")}
          >
            🚗 {c.name}
            <span className="ms-1.5 text-[11px] opacity-80">{c.kind === "work" ? "شغل" : "ملاكي"}</span>
          </button>
        ))}
        <button onClick={() => setEditCar({ kind: "personal" })} className="rounded-xl border border-dashed border-slate-300 text-slate-500 px-4 py-2 text-sm font-bold hover:border-primary hover:text-primary-dark">
          + عربية
        </button>
        {car && (
          <>
            <button onClick={() => setEditCar(car)} className="text-xs font-bold text-slate-500 hover:text-primary-dark px-2">
              ✎ تعديل
            </button>
            <button onClick={removeCar} className="text-xs font-bold text-rose-500 px-2">
              🗑 مسح
            </button>
          </>
        )}
      </div>

      {editCar && (
        <Modal title={editCar.id ? "تعديل العربية" : "عربية جديدة"} onClose={() => setEditCar(null)}>
          <form onSubmit={saveCar} className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-sm font-semibold text-slate-600">
              الاسم
              <input value={editCar.name ?? ""} onChange={(e) => setEditCar({ ...editCar, name: e.target.value })} placeholder="زي: الهايلكس" className={inputCls} />
            </label>
            <label className="grid gap-1 text-sm font-semibold text-slate-600">
              رقم العربية
              <input value={editCar.plate ?? ""} onChange={(e) => setEditCar({ ...editCar, plate: e.target.value })} placeholder="اختياري" className={inputCls} />
            </label>
            <div className="sm:col-span-2 grid gap-2">
              {(["personal", "work"] as const).map((k) => (
                <label key={k} className={`flex items-start gap-2 rounded-xl border p-3 cursor-pointer ${editCar.kind === k ? "border-primary bg-primary-light" : "border-slate-200"}`}>
                  <input type="radio" checked={editCar.kind === k} onChange={() => setEditCar({ ...editCar, kind: k })} className="mt-1" />
                  <span className="text-sm">
                    <b>{k === "personal" ? "ملاكي (خاصة)" : "بتشتغل وبتدخّل فلوس"}</b>
                    <span className="block text-xs text-slate-500">
                      {k === "personal"
                        ? `البنزين حسابك الخاص، ومشاوير الشغل على المعدات — والباقي بيتخصم من كوميشن ${person()}.`
                        : "مصاريفها من الخزنة، واللي بتكسبه بيدخل الخزنة، وبيبان ربحها كل شهر."}
                    </span>
                  </span>
                </label>
              ))}
            </div>
            <div className="sm:col-span-2 flex gap-2">
              <button type="submit" className="bg-primary text-white rounded-lg px-4 py-2 text-sm font-bold">
                حفظ
              </button>
              <button type="button" onClick={() => setEditCar(null)} className="bg-slate-100 text-slate-600 rounded-lg px-4 py-2 text-sm font-bold">
                إلغاء
              </button>
            </div>
          </form>
        </Modal>
      )}

      {notice && (
        <div className="no-print flex items-center justify-between rounded-xl px-4 py-2.5 text-sm font-semibold bg-primary-light text-primary-dark">
          <span>{notice}</span>
          <button onClick={() => setNotice("")} className="text-xs opacity-70">
            إخفاء
          </button>
        </div>
      )}

      {data && work && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white rounded-card shadow-card p-4">
            <div className="text-xs text-slate-500 font-semibold">دخلها الشهر ده</div>
            <div className="mt-1 text-xl font-extrabold text-primary-dark">{formatEGP(data.incomeTotal)}</div>
          </div>
          <div className="bg-white rounded-card shadow-card p-4">
            <div className="text-xs text-slate-500 font-semibold">مشاوير على المعدات</div>
            <div className="mt-1 text-xl font-extrabold text-primary-dark">{formatEGP(data.tripsTotal)}</div>
          </div>
          <div className="bg-white rounded-card shadow-card p-4">
            <div className="text-xs text-slate-500 font-semibold">مصاريفها</div>
            <div className="mt-1 text-xl font-extrabold text-rose-600">{formatEGP(data.fuelTotal)}</div>
          </div>
          <div className="bg-white rounded-card shadow-card p-4">
            <div className="text-xs text-slate-500 font-semibold">ربحها</div>
            <div className={`mt-1 text-xl font-extrabold ${(data.net ?? 0) >= 0 ? "text-primary-dark" : "text-rose-600"}`}>{formatEGP(data.net ?? 0)}</div>
          </div>
        </div>
      )}
      {data && !work && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white rounded-card shadow-card p-4">
            <div className="text-xs text-slate-500 font-semibold">بنزين وزيت الشهر</div>
            <div className="mt-1 text-xl font-extrabold text-slate-800">{formatEGP(data.fuelTotal)}</div>
          </div>
          <div className="bg-white rounded-card shadow-card p-4">
            <div className="text-xs text-slate-500 font-semibold">مشاوير شغل على المعدات</div>
            <div className="mt-1 text-xl font-extrabold text-primary-dark">{formatEGP(data.tripsTotal)}</div>
          </div>
          <div className="bg-white rounded-card shadow-card p-4">
            <div className="text-xs text-slate-500 font-semibold">خاص (من كوميشن {person()})</div>
            <div className="mt-1 text-xl font-extrabold text-rose-600">{formatEGP(data.personal)}</div>
          </div>
          <div className="bg-white rounded-card shadow-card p-4">
            <div className="text-xs text-slate-500 font-semibold">خاص السنة دي</div>
            <div className="mt-1 text-xl font-extrabold text-slate-700">{formatEGP(data.yearPersonal)}</div>
          </div>
        </div>
      )}
      {data && !work && data.over > 0 && (
        <div className="rounded-xl bg-amber-50 text-amber-800 px-4 py-2.5 text-sm font-semibold">
          ⚠ المشاوير الشهر ده أكتر من البنزين بـ {formatEGP(data.over)} — اتأكد إنك سجلت كل البنزين.
        </div>
      )}

      {data && !work && data.fuelTotal > 0 && (
        <div className="bg-white rounded-card shadow-card p-5">
          <h2 className="font-bold text-slate-800 mb-3">تقسيم فلوس العربية — {monthLabel(month)}</h2>
          <table className="w-full text-sm">
            <tbody>
              <tr className="border-b border-slate-50">
                <td className="py-2 text-slate-600">خاص — من كوميشن {person()}</td>
                <td className="py-2 font-bold text-rose-600">{formatEGP(data.personal)}</td>
              </tr>
              {data.byEquipment.map((b) => (
                <tr key={b.equipment_name} className="border-b border-slate-50">
                  <td className="py-2 text-slate-600">على {b.equipment_name}</td>
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
          <h2 className="font-bold text-slate-800 mb-3">{work ? "مصاريف العربية" : "بنزين وزيت"}</h2>
          <form onSubmit={addFuel} className="no-print flex flex-wrap items-end gap-2 mb-4">
            <input type="date" value={fDate} onChange={(e) => setFDate(e.target.value)} className={inputCls} />
            <select value={fKind} onChange={(e) => setFKind(e.target.value)} className={inputCls}>
              {KINDS.map((k) => (
                <option key={k}>{k}</option>
              ))}
            </select>
            <input type="number" min="0" step="any" placeholder="المبلغ" value={fAmount} onChange={(e) => setFAmount(e.target.value)} className={`${inputCls} w-28`} />
            <input placeholder="ملاحظة" value={fNote} onChange={(e) => setFNote(e.target.value)} className={inputCls} />
            {work && (
              <select value={fMethod} onChange={(e) => setFMethod(e.target.value)} className={inputCls} title="طالع من">
                {PAYMENT_METHODS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            )}
            <button type="submit" className="bg-primary text-white rounded-lg px-3 py-1.5 text-sm font-semibold">
              {work ? "سجّل" : "حطيت"}
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
                    <td className="py-1.5 text-slate-500">
                      {f.note ?? ""}
                      {work && f.method && <span className="ms-1 text-[11px] text-slate-400">({paymentMethodLabel(f.method)})</span>}
                    </td>
                    <td className="py-1.5 font-semibold text-slate-800">{formatEGP(f.amount)}</td>
                    <td className="no-print py-1.5">
                      <EditRowButton src="car_fuel" withMethod={work} row={{ id: f.id, date: f.date, amount: f.amount, note: f.note, method: f.method }} onSaved={refresh} />
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
          <p className="no-print text-xs text-slate-400 mb-3">
            بيتسجل مصروف "عربية ملاكي" على المعدة ويظهر في مصروفاتها — بيتخصم من فلوس العربية اللي دفعتها، مش من الخزنة.
          </p>
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
                      <EditRowButton src="monthly_expenses" withMethod={false} row={{ id: t.id, date: t.date, amount: t.amount, note: t.note }} onSaved={refresh} />
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
      {work && data && (
        <div className="bg-white rounded-card shadow-card p-5">
          <h2 className="font-bold text-slate-800 mb-3">دخل العربية (بيدخل الخزنة)</h2>
          <form onSubmit={addIncome} className="no-print flex flex-wrap items-end gap-2 mb-4">
            <input type="date" value={iDate} onChange={(e) => setIDate(e.target.value)} className={inputCls} />
            <input type="number" min="0" step="any" placeholder="المبلغ" value={iAmount} onChange={(e) => setIAmount(e.target.value)} className={`${inputCls} w-28`} />
            <select value={iMethod} onChange={(e) => setIMethod(e.target.value)} className={inputCls} title="دخل فين">
              {PAYMENT_METHODS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
            <input placeholder="من مين / شغل إيه" value={iNote} onChange={(e) => setINote(e.target.value)} className={inputCls} />
            <button type="submit" disabled={!iAmount} className="bg-primary text-white rounded-lg px-3 py-1.5 text-sm font-semibold disabled:opacity-50">
              دخل
            </button>
          </form>
          {data.income.length === 0 ? (
            <div className="text-sm text-slate-400">مفيش دخل الشهر ده.</div>
          ) : (
            <table className="w-full text-sm">
              <tbody>
                {data.income.map((x) => (
                  <tr key={x.id} className="border-b border-slate-50 last:border-0">
                    <td className="py-1.5 text-slate-500">{x.date}</td>
                    <td className="py-1.5 text-slate-600">{x.note ?? ""}</td>
                    <td className="py-1.5 text-slate-400 text-xs">{paymentMethodLabel(x.method)}</td>
                    <td className="py-1.5 font-semibold text-primary-dark">{formatEGP(x.amount)}</td>
                    <td className="no-print py-1.5">
                      <EditRowButton src="car_income" row={{ id: x.id, date: x.date, amount: x.amount, method: x.method, note: x.note }} onSaved={refresh} />
                      <button
                        onClick={async () => {
                          if (!window.confirm("تمسح السطر ده؟")) return;
                          await carApi.removeIncome(x.id);
                          refresh();
                        }}
                        className="text-xs text-rose-500 font-semibold"
                      >
                        حذف
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
      <PrintSignoff />
    </div>
  );
}
