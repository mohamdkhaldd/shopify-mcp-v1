import { useEffect, useState } from "react";
import { contractorsApi, dailyLogsApi } from "../../api/client";
import { Contractor, DailyLog } from "../../api/types";
import { ReadDay, ReadSheet, shell } from "../../shell";

// صورة السركي الورقي ← Claude يقرا الأيام والساعات والأوفر والإجازات والموقع
// ← انت تراجع وتختار المقاول وتكتب السعر ← بيتسجلوا في شيت المقاول للمعدة.

type Row = { day: number; worked: boolean; hours: string; overtime: string; site: string; note: string; unclear: boolean };
const toRow = (d: ReadDay): Row => ({
  day: d.day,
  worked: d.worked,
  hours: d.hours == null ? "" : String(d.hours),
  overtime: d.overtime == null ? "" : String(d.overtime),
  site: d.site ?? "",
  note: d.note ?? "",
  unclear: d.unclear,
});
const num = (t: string) => {
  const v = t.trim().replace(/[٠-٩]/g, (c) => String("٠١٢٣٤٥٦٧٨٩".indexOf(c))).replace("٫", ".");
  if (v === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) throw new Error(`رقم مش صحيح: ${t}`);
  return n;
};
const input = "w-full min-w-0 rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm";

export default function ReadToSheet({ equipmentId, month, image, onClose }: { equipmentId: number; month: string; image: string; onClose: (saved?: number) => void }) {
  const [state, setState] = useState<"reading" | "review" | "saving">("reading");
  const [error, setError] = useState("");
  const [sheet, setSheet] = useState<ReadSheet | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [existing, setExisting] = useState<DailyLog[]>([]);
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [person, setPerson] = useState("");
  const [base, setBase] = useState("8");
  const [rate, setRate] = useState("");
  const [otRate, setOtRate] = useState("");
  const [site, setSite] = useState("");

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const [list, logs] = await Promise.all([contractorsApi.list(), dailyLogsApi.list(equipmentId, month, "contractor", "")]);
        if (!live) return;
        setContractors(list);
        setExisting(logs);
        // آخر مقاول وسعر على المعدة دي الشهر ده
        const last = [...logs].reverse().find((l) => l.person_name && !l.is_day_off);
        if (last) {
          setPerson(last.person_name);
          if (last.day_rate) setRate(String(last.day_rate));
          if (last.overtime_rate) setOtRate(String(last.overtime_rate));
          if (last.base_hours) setBase(String(last.base_hours));
          if (last.site_name) setSite(last.site_name);
        }
        const r = await shell.readSarki({ image, mediaType: "image/jpeg", month });
        if (!live) return;
        if (!r.ok) throw new Error(r.message);
        if (!r.sheet.days.length) throw new Error("ملقاش أيام في الصورة دي — صوّر الورقة كلها بوضوح");
        setSheet(r.sheet);
        setRows(r.sheet.days.map(toRow));
        if (!last && r.sheet.person) {
          const match = list.find((c) => c.name.includes(r.sheet.person!) || r.sheet.person!.includes(c.name));
          if (match) setPerson(match.name);
        }
        if (r.sheet.site) setSite((s) => s || r.sheet.site!);
        setState("review");
      } catch (e) {
        if (live) setError((e as Error).message);
      }
    })();
    return () => {
      live = false;
    };
  }, [equipmentId, month, image]);

  const edit = (i: number, patch: Partial<Row>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const taken = new Set(existing.map((l) => Number(l.date.slice(8))));
  const overwrites = rows.filter((r) => taken.has(r.day)).length;

  async function save() {
    setError("");
    try {
      if (!person) throw new Error("اختار المقاول");
      const dayRate = num(rate);
      if (dayRate == null && rows.some((r) => r.worked)) throw new Error("اكتب سعر اليوم");
      const baseHours = num(base) ?? 8;
      const ot = num(otRate);
      setState("saving");
      for (const r of rows) {
        const date = `${month}-${String(r.day).padStart(2, "0")}`;
        const hours = num(r.hours);
        const extra = num(r.overtime) ?? 0;
        const actual = r.worked ? (hours == null && extra === 0 ? baseHours : (hours ?? baseHours) + extra) : null;
        await dailyLogsApi.upsert({
          equipment_id: equipmentId,
          date,
          role: "contractor",
          shift_label: "",
          person_name: r.worked ? person : "",
          actual_hours: r.worked ? actual : null,
          base_hours: r.worked ? baseHours : null,
          day_rate: r.worked ? dayRate : null,
          is_paid_leave: false,
          is_day_off: !r.worked,
          fixed_value: null,
          hassan_commission: null,
          note: r.note.trim() || null,
          site_name: r.worked ? r.site.trim() || site.trim() || null : null,
          overtime_rate: r.worked && actual != null && actual > baseHours && ot != null ? ot : null,
        });
      }
      onClose(rows.length);
    } catch (e) {
      setState("review");
      if ((e as Error)?.name !== "CancelledError") setError((e as Error).message);
    }
  }

  return (
    <div className="no-print bg-white rounded-card shadow-card p-5 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-bold text-slate-800">قراية السركي وتسجيله في شيت المقاول</h3>
        <button onClick={() => onClose()} className="text-sm text-slate-500 hover:text-slate-800" disabled={state === "saving"}>
          إلغاء
        </button>
      </div>
      {error && <div className="rounded-xl bg-rose-50 text-rose-700 px-4 py-2.5 text-sm font-semibold">{error}</div>}
      {state === "reading" && !error && <div className="text-sm text-slate-500">بيقرا الورقة… ممكن ياخد دقيقة — سيب الصفحة مفتوحة.</div>}
      {state !== "reading" && sheet && (
        <>
          <p className="text-xs text-slate-500">
            {[sheet.equipment, sheet.person, sheet.month].filter(Boolean).join(" · ")} — راجع كل سطر وعدّل اللي مش مظبوط، وبعدين اكتب السعر وسجّل.
          </p>
          {sheet.month && sheet.month !== month && (
            <div className="rounded-xl bg-amber-50 text-amber-800 px-4 py-2 text-sm font-semibold">
              الورقة مكتوب عليها شهر {sheet.month} — وانت فاتح شهر {month}. الأيام هتتسجل على شهر {month}.
            </div>
          )}
          {!!sheet.warnings.length && (
            <ul className="rounded-xl bg-amber-50 text-amber-800 px-6 py-2 text-sm list-disc">
              {sheet.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-400 text-xs">
                  <th className="p-1 text-start">اليوم</th>
                  <th className="p-1">اشتغل</th>
                  <th className="p-1">الساعات</th>
                  <th className="p-1">أوفر</th>
                  <th className="p-1">الموقع</th>
                  <th className="p-1">ملاحظة</th>
                  <th className="p-1"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.day} className={`border-t border-slate-100 ${r.unclear ? "bg-amber-50" : ""}`}>
                    <td className="p-1 font-bold whitespace-nowrap">
                      {r.day}
                      {taken.has(r.day) && <span className="text-[10px] text-slate-400"> (متسجل)</span>}
                      {r.unclear && <span className="text-[10px]"> ⚠︎</span>}
                    </td>
                    <td className="p-1 text-center">
                      <input type="checkbox" checked={r.worked} onChange={(e) => edit(i, { worked: e.target.checked })} />
                    </td>
                    <td className="p-1 w-20">
                      <input className={input} value={r.hours} disabled={!r.worked} inputMode="decimal" placeholder={base} onChange={(e) => edit(i, { hours: e.target.value })} />
                    </td>
                    <td className="p-1 w-20">
                      <input className={input} value={r.overtime} disabled={!r.worked} inputMode="decimal" onChange={(e) => edit(i, { overtime: e.target.value })} />
                    </td>
                    <td className="p-1 min-w-28">
                      <input className={input} value={r.site} disabled={!r.worked} placeholder={site} onChange={(e) => edit(i, { site: e.target.value })} />
                    </td>
                    <td className="p-1 min-w-28">
                      <input className={input} value={r.note} onChange={(e) => edit(i, { note: e.target.value })} />
                    </td>
                    <td className="p-1">
                      <button className="text-slate-400 hover:text-rose-600" title="شيل اليوم ده" onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}>
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-xs text-slate-500">
              المقاول
              <select className={`${input} block mt-1 min-w-40`} value={person} onChange={(e) => setPerson(e.target.value)}>
                <option value="">اختار…</option>
                {contractors.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-slate-500">
              سعر اليوم
              <input className={`${input} block mt-1 w-28`} value={rate} inputMode="decimal" onChange={(e) => setRate(e.target.value)} />
            </label>
            <label className="text-xs text-slate-500">
              سعر ساعة الأوفر
              <input className={`${input} block mt-1 w-28`} value={otRate} inputMode="decimal" placeholder="تلقائي" onChange={(e) => setOtRate(e.target.value)} />
            </label>
            <label className="text-xs text-slate-500">
              الساعات الأساسية
              <input className={`${input} block mt-1 w-20`} value={base} inputMode="decimal" onChange={(e) => setBase(e.target.value)} />
            </label>
            <label className="text-xs text-slate-500">
              الموقع (لو مش مكتوب لليوم)
              <input className={`${input} block mt-1 w-40`} value={site} onChange={(e) => setSite(e.target.value)} />
            </label>
          </div>
          {overwrites > 0 && <p className="text-xs text-slate-500">{overwrites} يوم متسجلين في شيت المقاول قبل كده هيتكتبوا من الورقة.</p>}
          <button
            onClick={save}
            disabled={state === "saving" || !rows.length}
            className="bg-primary text-white rounded-xl px-4 py-2 text-sm font-semibold hover:bg-primary-dark disabled:opacity-50"
          >
            {state === "saving" ? "بيسجل…" : `سجّل ${rows.length} يوم في شيت المقاول`}
          </button>
        </>
      )}
    </div>
  );
}
