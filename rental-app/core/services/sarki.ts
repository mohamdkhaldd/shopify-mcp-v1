import { Db, UserError } from "../db";
import { dayValue, hoursKey, overtimeMilli, SarkiDay, sheetTotals } from "../calc/sarki";
import { monthDates } from "../calc/timeWeight";
import { getContract } from "./master";

export type Side = "client" | "supplier";

export interface WorkLogRow {
  id: number;
  contract_id: number;
  date: string;
  side: Side;
  is_day_off: number;
  site_name: string | null;
  actual_hours_milli: number | null;
  base_hours_milli: number;
  day_rate_pt: number | null;
  overtime_rate_pt: number | null;
  note: string | null;
}

export const toSarkiDay = (r: WorkLogRow): SarkiDay => ({
  isDayOff: !!r.is_day_off,
  actualHoursMilli: r.actual_hours_milli,
  baseHoursMilli: r.base_hours_milli,
  dayRatePt: r.day_rate_pt,
  overtimeRatePt: r.overtime_rate_pt,
});

type Contract = ReturnType<typeof getContract>;

export const defaultRate = (c: Contract, side: Side) => ({ unit: c.unit, ratePt: side === "client" ? c.client_rate_pt : c.supplier_rate_pt });

/** Explicit day rate written on new rows: the contract rate for daily contracts, null (= monthly ÷ 30) for monthly. */
const newRowRate = (c: Contract, side: Side) => (c.unit === "day" ? defaultRate(c, side).ratePt : null);

export interface DayPatch {
  isDayOff?: boolean;
  siteName?: string | null;
  actualHoursMilli?: number | null;
  baseHoursMilli?: number;
  dayRatePt?: number | null;
  overtimeRatePt?: number | null;
  note?: string | null;
}

function assertInContract(c: Contract, date: string) {
  if (date < c.start_date || (c.end_date && date > c.end_date)) throw new UserError(`اليوم ${date} برا مدة العقد ${c.code}`);
}

export function getDay(db: Db, contractId: number, date: string, side: Side): WorkLogRow | undefined {
  return db.prepare("SELECT * FROM work_logs WHERE contract_id = ? AND date = ? AND side = ? AND deleted_at IS NULL").get(contractId, date, side);
}

/** Creates or updates one day on one sheet (the cell-by-cell save of the sheet). */
export function upsertDay(db: Db, contractId: number, date: string, side: Side, patch: DayPatch): WorkLogRow {
  const c = getContract(db, contractId);
  assertInContract(c, date);
  const cur = getDay(db, contractId, date, side);
  const base: WorkLogRow = cur ?? {
    id: 0,
    contract_id: contractId,
    date,
    side,
    is_day_off: 0,
    site_name: c.site_name,
    actual_hours_milli: null,
    base_hours_milli: 8000,
    day_rate_pt: newRowRate(c, side),
    overtime_rate_pt: null,
    note: null,
  };
  const next = {
    is_day_off: patch.isDayOff === undefined ? base.is_day_off : Number(patch.isDayOff),
    site_name: patch.siteName === undefined ? base.site_name : patch.siteName,
    actual_hours_milli: patch.actualHoursMilli === undefined ? base.actual_hours_milli : patch.actualHoursMilli,
    base_hours_milli: patch.baseHoursMilli ?? base.base_hours_milli,
    day_rate_pt: patch.dayRatePt === undefined ? base.day_rate_pt : patch.dayRatePt,
    overtime_rate_pt: patch.overtimeRatePt === undefined ? base.overtime_rate_pt : patch.overtimeRatePt,
    note: patch.note === undefined ? base.note : patch.note,
  };
  if (next.is_day_off) {
    // "مشتغلش" wipes the day like the old sheet, keeping only the reason
    Object.assign(next, { site_name: null, actual_hours_milli: null, overtime_rate_pt: null });
    if (!next.note?.trim()) throw new UserError("اكتب سبب إن اليوم ده مشتغلش");
  }
  db.prepare(
    `INSERT INTO work_logs (contract_id, date, side, is_day_off, site_name, actual_hours_milli, base_hours_milli, day_rate_pt, overtime_rate_pt, note)
     VALUES (@contract_id, @date, @side, @is_day_off, @site_name, @actual_hours_milli, @base_hours_milli, @day_rate_pt, @overtime_rate_pt, @note)
     ON CONFLICT (contract_id, date, side) DO UPDATE SET
       is_day_off = excluded.is_day_off, site_name = excluded.site_name, actual_hours_milli = excluded.actual_hours_milli,
       base_hours_milli = excluded.base_hours_milli, day_rate_pt = excluded.day_rate_pt, overtime_rate_pt = excluded.overtime_rate_pt,
       note = excluded.note, deleted_at = NULL, delete_reason = NULL, updated_at = datetime('now')`,
  ).run({ contract_id: contractId, date, side, ...next });
  return getDay(db, contractId, date, side)!;
}

function datesBetween(c: Contract, from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = new Date(from + "T00:00:00Z"); d.toISOString().slice(0, 10) <= to; d.setUTCDate(d.getUTCDate() + 1)) {
    const s = d.toISOString().slice(0, 10);
    if (s >= c.start_date && (!c.end_date || s <= c.end_date)) out.push(s);
  }
  return out;
}

/** "املا أيام مرة واحدة": a normal working day (no overtime) on every date in the range. */
export function fillRange(db: Db, contractId: number, side: Side, from: string, to: string, v: { dayRatePt?: number | null; siteName?: string | null; baseHoursMilli?: number }) {
  const c = getContract(db, contractId);
  db.transaction(() => {
    for (const date of datesBetween(c, from, to))
      upsertDay(db, contractId, date, side, {
        isDayOff: false,
        dayRatePt: v.dayRatePt === undefined ? newRowRate(c, side) : v.dayRatePt,
        siteName: v.siteName === undefined ? c.site_name : v.siteName,
        baseHoursMilli: v.baseHoursMilli ?? 8000,
        actualHoursMilli: null,
        overtimeRatePt: null,
        note: null,
      });
  })();
}

/** "افرغ الأيام دي (مشتغلش)". */
export function clearRange(db: Db, contractId: number, side: Side, from: string, to: string, reason: string) {
  const c = getContract(db, contractId);
  db.transaction(() => {
    for (const date of datesBetween(c, from, to)) upsertDay(db, contractId, date, side, { isDayOff: true, note: reason });
  })();
}

/** "3, 7, 15" / "14-31" / "1-5, 7-10" → day numbers (same parser as the old app). */
export function parseDayNumbers(spec: string): number[] {
  const out = new Set<number>();
  for (const tok of spec.split(/[,،]+/).map((s) => s.trim()).filter(Boolean)) {
    const m = tok.match(/^(\d+)\s*-\s*(\d+)$/);
    if (m) for (let d = Math.min(+m[1], +m[2]); d <= Math.max(+m[1], +m[2]); d++) out.add(d);
    else for (const p of tok.split(/\s+/)) if (Number(p)) out.add(Number(p));
  }
  return [...out].sort((a, b) => a - b);
}

/** "أوفر تايم لأيام معيّنة": skips empty days and days marked off. */
export function applyOvertime(db: Db, contractId: number, side: Side, month: string, daySpec: string, overtimeHoursMilli: number, overtimeRatePt: number | null) {
  db.transaction(() => {
    for (const n of parseDayNumbers(daySpec)) {
      const date = `${month}-${String(n).padStart(2, "0")}`;
      const row = getDay(db, contractId, date, side);
      if (!row || row.is_day_off) continue;
      upsertDay(db, contractId, date, side, { actualHoursMilli: row.base_hours_milli + overtimeHoursMilli, overtimeRatePt });
    }
  })();
}

/** Copies days/site/hours/notes from the client sheet; the supplier keeps his own rate. */
export function copyClientToSupplier(db: Db, contractId: number, month: string) {
  const c = getContract(db, contractId);
  db.transaction(() => {
    for (const r of sheetRows(db, contractId, month, "client"))
      upsertDay(db, contractId, r.date, "supplier", {
        isDayOff: !!r.is_day_off,
        siteName: r.site_name,
        actualHoursMilli: r.actual_hours_milli,
        baseHoursMilli: r.base_hours_milli,
        dayRatePt: newRowRate(c, "supplier"),
        overtimeRatePt: null,
        note: r.note,
      });
  })();
}

export function sheetRows(db: Db, contractId: number, month: string, side: Side): WorkLogRow[] {
  return db
    .prepare("SELECT * FROM work_logs WHERE contract_id = ? AND side = ? AND substr(date, 1, 7) = ? AND deleted_at IS NULL ORDER BY date")
    .all(contractId, side, month);
}

/** The full internal sheet for the السركي page: every day of the month, with totals and mismatch flags. */
export function getSheet(db: Db, contractId: number, month: string, side: Side) {
  const c = getContract(db, contractId);
  const def = defaultRate(c, side);
  const rows = sheetRows(db, contractId, month, side);
  const other = new Map(sheetRows(db, contractId, month, side === "client" ? "supplier" : "client").map((r) => [r.date, r]));
  const byDate = new Map(rows.map((r) => [r.date, r]));
  const days = monthDates(month).map((date) => {
    const r = byDate.get(date);
    const o = other.get(date);
    const mismatch = (r || o) && hoursKey(r && toSarkiDay(r)) !== hoursKey(o && toSarkiDay(o));
    if (!r) return { date, row: null, overtimeMilli: 0, totalPt: 0, mismatch: !!mismatch };
    const d = toSarkiDay(r);
    return { date, row: r, overtimeMilli: overtimeMilli(d), totalPt: dayValue(d, def).toPiasters(), mismatch: !!mismatch };
  });
  return { contract: c, side, month, days, totals: sheetTotals(rows.map(toSarkiDay), def), mismatchDays: days.filter((d) => d.mismatch).length };
}

/**
 * The sheet handed to one party (printed on the supplier / client page). It only
 * carries that party's own name and rates — never the other party or our margin.
 */
export function getPartySheet(db: Db, contractId: number, month: string, side: Side) {
  const s = getSheet(db, contractId, month, side);
  const c = s.contract;
  const party =
    side === "client"
      ? db.prepare("SELECT name FROM clients WHERE id = ?").get(c.client_id).name
      : db.prepare("SELECT name FROM suppliers WHERE id = ?").get(c.supplier_id).name;
  const equipment = db.prepare("SELECT name FROM equipment WHERE id = ?").get(c.equipment_id).name;
  return {
    partyName: party as string,
    equipmentName: equipment as string,
    siteName: c.site_name,
    month,
    days: s.days.map((d) => ({
      date: d.date,
      isDayOff: !!d.row?.is_day_off,
      siteName: d.row?.site_name ?? null,
      actualHoursMilli: d.row?.actual_hours_milli ?? null,
      overtimeMilli: d.overtimeMilli,
      overtimeRatePt: d.row?.overtime_rate_pt ?? null,
      baseHoursMilli: d.row ? d.row.base_hours_milli : null,
      dayRatePt: d.row ? d.row.day_rate_pt : null,
      note: d.row?.note ?? null,
      totalPt: d.totalPt,
      entered: !!d.row,
    })),
    totals: s.totals,
  };
}
