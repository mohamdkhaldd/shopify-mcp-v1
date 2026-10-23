import { api, OpenSarki } from "../../api/client";
import { Cell } from "../../components/Field";
import Icon from "../../components/Icon";
import { pounds } from "../../utils/format";
import { hoursToMilli, milliToHours, moneyToPt, ptToInput } from "../../utils/input";

type Day = OpenSarki["client"]["days"][number];
type Totals = OpenSarki["client"]["totals"];

const WEEKDAYS = ["الأحد", "الاتنين", "التلات", "الأربع", "الخميس", "الجمعة", "السبت"];
const weekday = (date: string) => WEEKDAYS[new Date(date + "T00:00:00Z").getUTCDay()];

function DayCell({ d, onToggleOff, readOnly }: { d: Day; onToggleOff?: () => void; readOnly: boolean }) {
  const off = !!d.row?.is_day_off;
  return (
    <td>
      {onToggleOff && (
        <button
          type="button"
          onClick={onToggleOff}
          disabled={readOnly}
          title={off ? "اليوم ده مشتغلش — دوس تاني عشان ترجّعه" : "علّم إن اليوم ده مشتغلش"}
          className={`w-3.5 h-3.5 rounded-full border-[1.5px] border-out align-middle me-1.5 disabled:opacity-40 ${off ? "bg-out" : "hover:bg-out-soft"}`}
        />
      )}
      {d.date.slice(8)} <span className="text-xs text-muted">({weekday(d.date)})</span>
    </td>
  );
}

function Foot({ totals, cols }: { totals: Totals; cols: number }) {
  return (
    <tfoot>
      <tr>
        <td colSpan={3}>الإجمالي — {totals.workedDays} يوم شغل</td>
        <td className="n">{milliToHours(totals.overtimeMilli) || 0} س</td>
        <td colSpan={cols - 5} />
        <td className="n">{pounds(totals.totalPt)}</td>
      </tr>
    </tfoot>
  );
}

const HEAD = (
  <tr>
    <th>اليوم</th>
    <th>الموقع</th>
    <th className="n">الساعات الفعلية</th>
    <th className="n">أوفر تايم</th>
    <th className="n">سعر ساعة الأوفر</th>
    <th className="n">الساعات الأساسية</th>
    <th className="n">اليومية</th>
    <th>بيان</th>
    <th className="n">الإجمالي</th>
  </tr>
);

/** سركي الشركة — every cell editable, saved on blur. */
export function ClientSheet({ v, onSaved, onError, onDeleteDay }: { v: OpenSarki; onSaved: () => void; onError: (m: string) => void; onDeleteDay: (id: number) => void }) {
  const c = v.contract;
  const ro = v.closed;
  const save = (date: string, patch: Parameters<typeof api.upsertDay>[3]) =>
    api.upsertDay(c.id, date, "client", patch).then(onSaved, (e) => onError(e.message));
  const parse = <T,>(f: () => T, then: (x: T) => void) => {
    try {
      then(f());
    } catch (e) {
      onError((e as Error).message);
    }
  };

  return (
    <table className="tbl [&_td]:px-2 [&_th]:px-2">
      <thead>
        {HEAD}
      </thead>
      <tbody>
        {v.client.days.map((d) => {
          const r = d.row;
          const off = !!r?.is_day_off;
          const hasOt = d.overtimeMilli > 0;
          const base = r?.base_hours_milli ?? 8000;
          return (
            <tr key={d.date} className={off ? "[&>td]:bg-out-soft" : r ? "" : "[&>td]:bg-surface-2/50"}>
              <DayCell d={d} readOnly={ro} onToggleOff={() => save(d.date, { isDayOff: !off })} />
              <td>
                <Cell ariaLabel="الموقع" className="w-[150px]" value={r?.site_name ?? ""} disabled={ro || off} onCommit={(x) => save(d.date, { siteName: x.trim() || null })} />
              </td>
              <td className="n">
                <Cell ariaLabel="الساعات الفعلية" value={milliToHours(r?.actual_hours_milli)} disabled={ro || off} onCommit={(x) => parse(() => hoursToMilli(x), (m) => save(d.date, { actualHoursMilli: m }))} />
              </td>
              <td className="n">
                <Cell
                  ariaLabel="أوفر تايم"
                  value={hasOt ? milliToHours(d.overtimeMilli) : ""}
                  placeholder="—"
                  disabled={ro || off}
                  onCommit={(x) => parse(() => hoursToMilli(x), (m) => save(d.date, { actualHoursMilli: m == null ? null : base + m }))}
                />
              </td>
              <td className="n">
                <Cell
                  ariaLabel="سعر ساعة الأوفر"
                  value={hasOt ? ptToInput(r?.overtime_rate_pt) : ""}
                  placeholder={hasOt ? "تلقائي" : "—"}
                  disabled={ro || off || !hasOt}
                  onCommit={(x) => parse(() => moneyToPt(x), (pt) => save(d.date, { overtimeRatePt: pt }))}
                />
              </td>
              <td className="n">
                <Cell ariaLabel="الساعات الأساسية" value={off ? "" : milliToHours(base)} disabled={ro || off} onCommit={(x) => parse(() => hoursToMilli(x) ?? 8000, (m) => save(d.date, { baseHoursMilli: m }))} />
              </td>
              <td className="n">
                <Cell
                  ariaLabel="اليومية"
                  value={ptToInput(r?.day_rate_pt)}
                  placeholder={c.unit === "month" ? "شهري ÷ 30" : ""}
                  disabled={ro || off}
                  onCommit={(x) => parse(() => moneyToPt(x), (pt) => save(d.date, { dayRatePt: pt }))}
                />
              </td>
              <td>
                <Cell ariaLabel="بيان" className="w-[140px]" value={r?.note ?? ""} placeholder={off ? "السبب" : ""} disabled={ro} onCommit={(x) => save(d.date, { note: x.trim() || null })} />
              </td>
              <td className="n font-bold">
                {r && !off ? pounds(d.totalPt) : "—"}
                {r && !ro && (
                  <button type="button" title="حذف اليوم" onClick={() => onDeleteDay(r.id)} className="no-print ms-2 text-muted hover:text-out align-middle">
                    <Icon name="trash" className="w-3.5 h-3.5" />
                  </button>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
      <Foot totals={v.client.totals} cols={9} />
    </table>
  );
}

/** سركي صاحب المعدة — a copy of the company sheet; only his day rate and overtime rate can change. */
export function SupplierSheet({ v, onSaved, onError }: { v: OpenSarki; onSaved: () => void; onError: (m: string) => void }) {
  const c = v.contract;
  const ro = v.closed;
  return (
    <table className="tbl [&_td]:px-2 [&_th]:px-2">
      <thead>
        {HEAD}
      </thead>
      <tbody>
        {v.supplier.days.map((d) => {
          const r = d.row;
          const off = !!r?.is_day_off;
          const hasOt = d.overtimeMilli > 0;
          const rate = r?.day_rate_pt ?? (c.unit === "month" ? Math.trunc(c.supplierRatePt / 30) : c.supplierRatePt);
          const otRate = r && r.base_hours_milli > 0 ? (rate * 1000) / r.base_hours_milli : 0;
          return (
            <tr key={d.date} className={off ? "[&>td]:bg-out-soft" : r ? "" : "[&>td]:bg-surface-2/50"}>
              <DayCell d={d} readOnly />
              <td className="text-muted">{off ? "مشتغلش" : r?.site_name ?? ""}</td>
              <td className="n text-muted">{milliToHours(r?.actual_hours_milli)}</td>
              <td className="n text-muted">{hasOt ? milliToHours(d.overtimeMilli) : ""}</td>
              <td className="n">
                {hasOt ? (
                  <Cell
                    ariaLabel="سعر ساعة الأوفر لصاحب المعدة"
                    value={ptToInput(r?.overtime_rate_pt)}
                    placeholder={`تلقائي ${(Math.trunc(otRate) / 100).toLocaleString("en-US")}`}
                    disabled={ro}
                    onCommit={(x) => {
                      try {
                        api.upsertDay(c.id, d.date, "supplier", { overtimeRatePt: moneyToPt(x) }).then(onSaved, (e) => onError(e.message));
                      } catch (e) {
                        onError((e as Error).message);
                      }
                    }}
                    className="w-[80px] text-end"
                  />
                ) : null}
              </td>
              <td className="n text-muted">{r && !off ? milliToHours(r.base_hours_milli) : ""}</td>
              <td className="n">
                {r && !off ? (
                  <Cell
                    ariaLabel="يومية صاحب المعدة"
                    value={ptToInput(r.day_rate_pt)}
                    placeholder={c.unit === "month" ? "شهري ÷ 30" : ""}
                    disabled={ro}
                    onCommit={(x) => {
                      try {
                        api.upsertDay(c.id, d.date, "supplier", { dayRatePt: moneyToPt(x) }).then(onSaved, (e) => onError(e.message));
                      } catch (e) {
                        onError((e as Error).message);
                      }
                    }}
                  />
                ) : null}
              </td>
              <td className="text-muted">{r?.note ?? ""}</td>
              <td className="n font-bold">{r && !off ? pounds(d.totalPt) : "—"}</td>
            </tr>
          );
        })}
      </tbody>
      <Foot totals={v.supplier.totals} cols={9} />
    </table>
  );
}
