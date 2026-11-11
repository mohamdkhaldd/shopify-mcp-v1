import { useRef, useState } from "react";
import { api, OpenSarki, shellApi } from "../../api/client";
import { Labeled, TextInput } from "../../components/Field";
import { Button } from "../../components/ui";
import { photoForReading, ReadDay, ReadSheet } from "../../../core/ai/sarkiRead";
import { hoursToMilli, moneyToPt, ptToInput } from "../../utils/input";

/** A row of the review table: what Claude read, as the user edits it. */
type Row = { day: number; worked: boolean; hours: string; overtime: string; site: string; note: string; unclear: boolean };
const toRow = (d: ReadDay): Row => ({
  day: d.day,
  worked: d.worked,
  hours: d.hours == null ? "" : String(d.hours),
  overtime: d.overtime == null ? "" : String(d.overtime),
  site: d.site ?? "",
  note: "", // البيان مش بيتملى من الصورة (بيتكتب بالإيد)
  unclear: d.unclear,
});
const dateOf = (month: string, day: number) => `${month}-${String(day).padStart(2, "0")}`;

/**
 * "📷 اقرا صورة السركي": the paper sarki photo → Claude reads the days, hours,
 * overtime, days off and site → the user checks them and types the prices →
 * saved on the company's sarki (the owner's copy follows by itself).
 */
export function ReadPhoto({
  v,
  onDone,
  onError,
  initialSheet,
  onCancel,
}: {
  v: OpenSarki;
  onDone: (msg: string) => void;
  onError: (m: string) => void;
  /** من المساعد: الورقة اتقرت خلاص — اعرضها للمراجعة على طول */
  initialSheet?: ReadSheet;
  onCancel?: () => void;
}) {
  const c = v.contract;
  const file = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<"idle" | "reading" | "review" | "saving">(initialSheet ? "review" : "idle");
  const [sheet, setSheet] = useState<ReadSheet | null>(initialSheet ?? null);
  const [rows, setRows] = useState<Row[]>(initialSheet ? initialSheet.days.map(toRow) : []);
  const [base, setBase] = useState("8");
  const [rate, setRate] = useState(c.unit === "day" ? ptToInput(c.clientRatePt) : "");
  const [otRate, setOtRate] = useState("");
  const [supRate, setSupRate] = useState(c.unit === "day" ? ptToInput(c.supplierRatePt) : "");
  const [supOt, setSupOt] = useState("");
  const [site, setSite] = useState(c.siteName ?? "");

  async function pick(f: File | undefined) {
    if (!f) return;
    setState("reading");
    try {
      const photo = await photoForReading(f);
      const r = await shellApi.readSarki({ ...photo, month: v.month, hint: `المعدة: ${c.equipment}. الشركة: ${c.client}.` });
      if (!r.ok) throw new Error(r.message);
      if (!r.sheet.days.length) throw new Error("ملقاش أيام في الصورة دي — صوّر الورقة كلها بوضوح");
      setSheet(r.sheet);
      setRows(r.sheet.days.map(toRow));
      if (r.sheet.site && !c.siteName) setSite(r.sheet.site);
      setState("review");
    } catch (e) {
      setState("idle");
      onError((e as Error).message);
    } finally {
      if (file.current) file.current.value = "";
    }
  }

  const edit = (i: number, patch: Partial<Row>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const existing = new Set(v.client.days.filter((d) => d.row).map((d) => Number(d.date.slice(8))));
  const overwrites = rows.filter((r) => existing.has(r.day)).length;
  const outside = rows.filter((r) => {
    const d = dateOf(v.month, r.day);
    return d < c.startDate || (c.endDate != null && d > c.endDate);
  });

  async function save() {
    setState("saving");
    try {
      const baseMilli = hoursToMilli(base) ?? 8000;
      const dayRatePt = moneyToPt(rate);
      const overtimeRatePt = moneyToPt(otRate);
      const ok = rows.filter((r) => !outside.includes(r));
      for (const r of ok) {
        const date = dateOf(v.month, r.day);
        if (!r.worked) {
          await api.upsertDay(c.id, date, "client", { isDayOff: true, note: r.note.trim() || null, actualHoursMilli: null });
          continue;
        }
        const hours = hoursToMilli(r.hours);
        const ot = hoursToMilli(r.overtime) ?? 0;
        // الساعات المكتوبة + الأوفر لو في خانة لوحده؛ لو مفيش ساعات = اليوم العادي
        const actual = hours == null && ot === 0 ? null : (hours ?? baseMilli) + ot;
        await api.upsertDay(c.id, date, "client", {
          isDayOff: false,
          baseHoursMilli: baseMilli,
          actualHoursMilli: actual,
          siteName: r.site.trim() || site.trim() || null,
          note: r.note.trim() || null,
          ...(dayRatePt != null ? { dayRatePt } : {}),
          ...(overtimeRatePt != null ? { overtimeRatePt } : {}),
        });
      }
      const worked = ok.filter((r) => r.worked);
      const sup = moneyToPt(supRate);
      const supOtPt = moneyToPt(supOt);
      if (worked.length && (sup != null || supOtPt != null)) {
        const from = dateOf(v.month, worked[0].day);
        const to = dateOf(v.month, worked[worked.length - 1].day);
        await api.setSupplierRate(c.id, from, to, { ...(sup != null ? { dayRatePt: sup } : {}), ...(supOtPt != null ? { overtimeRatePt: supOtPt } : {}) });
      }
      setState("idle");
      setSheet(null);
      onDone(`اتسجل ${ok.length} يوم من صورة السركي`);
    } catch (e) {
      setState("review");
      onError((e as Error).message);
    }
  }

  const input = "w-full min-w-0 rounded-md border border-line bg-surface px-1.5 py-1 text-sm";
  // من المساعد: بعد الحفظ أو الإلغاء مفيش زرار «اقرا صورة» تاني هنا
  if (initialSheet && (state === "idle" || state === "reading")) return null;
  const worked = rows.filter((r) => r.worked);
  const otTotal = worked.reduce((a, r) => a + (Number(r.overtime) || 0), 0);
  return (
    <div className="no-print px-4 py-3 border-b border-line">
      <input ref={file} type="file" accept="image/*" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
      {state === "idle" || state === "reading" ? (
        <div className="flex flex-wrap items-center gap-3">
          <Button primary disabled={state === "reading"} onClick={() => file.current?.click()}>
            {state === "reading" ? "بيقرا الورقة…" : "📷 اقرا صورة السركي"}
          </Button>
          <span className="text-xs text-muted">
            {state === "reading" ? "ممكن ياخد دقيقة — سيب الصفحة مفتوحة" : "صوّر ورقة السركي أو اختار صورتها: الأيام والساعات والأوفر والإجازات بيتقروا لوحدهم، وانت تراجع وتكتب السعر"}
          </span>
        </div>
      ) : (
        <div className="grid gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <b>اللي اتقرا من الصورة</b>
            <span className="text-xs text-muted">
              {[sheet?.equipment, sheet?.person, sheet?.month].filter(Boolean).join(" · ")} — راجع كل سطر وعدّل اللي مش مظبوط
            </span>
          </div>
          <div className="flex flex-wrap gap-2 text-sm">
            <span className="rounded-lg bg-in-soft text-in px-2.5 py-1 font-bold">اشتغل {worked.length} يوم</span>
            <span className="rounded-lg bg-surface-2 px-2.5 py-1 font-bold">إجازة {rows.length - worked.length} يوم</span>
            {otTotal > 0 && <span className="rounded-lg bg-amber-soft px-2.5 py-1 font-bold">أوفر {otTotal} ساعة</span>}
            {rows.some((r) => r.unclear) && <span className="rounded-lg bg-out-soft text-out px-2.5 py-1 font-bold">⚠︎ {rows.filter((r) => r.unclear).length} يوم مش واضح — راجعهم</span>}
          </div>
          {sheet?.month && sheet.month !== v.month && (
            <div className="rounded-md bg-amber-soft px-3 py-2 text-sm font-semibold">
              الورقة مكتوب عليها شهر {sheet.month} — وانت فاتح شهر {v.month}. الأيام هتتسجل على شهر {v.month}.
            </div>
          )}
          {!!sheet?.warnings.length && (
            <ul className="rounded-md bg-amber-soft px-5 py-2 text-sm list-disc">
              {sheet.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-muted text-xs">
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
                  <tr key={r.day} className={`border-t border-line ${r.unclear ? "bg-amber-soft" : ""} ${outside.includes(r) ? "opacity-50" : ""}`}>
                    <td className="p-1 font-bold whitespace-nowrap">
                      {r.day}
                      {existing.has(r.day) && <span className="text-[10px] text-muted"> (متسجل)</span>}
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
                      <button className="text-muted" title="شيل اليوم ده" onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}>
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-end gap-2.5">
            <Labeled label="الساعات الأساسية لليوم">
              <TextInput value={base} onChange={(e) => setBase(e.target.value)} className="w-20" inputMode="decimal" />
            </Labeled>
            <Labeled label={c.unit === "month" ? "يومية الشركة (فاضي = الشهري ÷ ٣٠)" : "سعر اليوم للشركة"}>
              <TextInput value={rate} onChange={(e) => setRate(e.target.value)} className="w-28" inputMode="decimal" />
            </Labeled>
            <Labeled label="ساعة الأوفر للشركة (فاضي = تلقائي)">
              <TextInput value={otRate} onChange={(e) => setOtRate(e.target.value)} className="w-28" inputMode="decimal" />
            </Labeled>
            <Labeled label="سعر اليوم لصاحب المعدة">
              <TextInput value={supRate} onChange={(e) => setSupRate(e.target.value)} className="w-28" inputMode="decimal" />
            </Labeled>
            <Labeled label="ساعة الأوفر لصاحب المعدة">
              <TextInput value={supOt} onChange={(e) => setSupOt(e.target.value)} className="w-28" inputMode="decimal" placeholder="—" />
            </Labeled>
            <Labeled label="الموقع (لو مش مكتوب لليوم)">
              <TextInput value={site} onChange={(e) => setSite(e.target.value)} className="w-40" />
            </Labeled>
          </div>
          {(overwrites > 0 || outside.length > 0) && (
            <div className="text-xs text-muted">
              {overwrites > 0 && `${overwrites} يوم متسجلين قبل كده هيتكتبوا من الورقة. `}
              {outside.length > 0 && `${outside.length} يوم برا مدة العقد مش هيتسجلوا.`}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <Button primary disabled={state === "saving" || !rows.length} onClick={save}>
              {state === "saving" ? "بيسجل…" : `سجّل ${rows.length - outside.length} يوم`}
            </Button>
            <Button
              disabled={state === "saving"}
              onClick={() => {
                setState("idle");
                setSheet(null);
                onCancel?.();
              }}
            >
              إلغاء
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
