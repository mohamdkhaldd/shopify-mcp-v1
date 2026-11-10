import { Db, monthOf, today, UserError } from "../db";
import { live, monthsBetween } from "./books";
import { Money, recordSupplierDeduction } from "./ledger";

// السواقين: السواق على معدة صاحب معدة، وحسابه لوحده.
//  - "إحنا بنقبّضه": ليه مرتب شهري، أو يومية × أيام شغل المعدة في السركي.
//  - "صاحب المعدة بيقبّضه": ملوش عندنا مرتب، بنسجل بس اللي اديناهوله.
// في الحالتين أي فلوس بنديها للسواق بتتسجل خصم من صاحب المعدة
// (supplier_deductions.driver_id)، فبتتخصم من تصفيته آخر الشهر لوحدها.

export type PaidBy = "us" | "owner";
export type PayKind = "month" | "day";

export interface DriverInput {
  name: string;
  phone?: string | null;
  supplierId: number;
  equipmentId?: number | null;
  paidBy: PaidBy;
  payKind: PayKind;
  ratePt?: number | null;
  startDate?: string;
}

type DriverRow = {
  id: number;
  name: string;
  phone: string | null;
  supplier_id: number;
  equipment_id: number | null;
  paid_by: PaidBy;
  pay_kind: PayKind;
  rate_pt: number | null;
  start_date: string;
};

function check(db: Db, v: DriverInput) {
  if (!v.name?.trim()) throw new UserError("اكتب اسم السواق");
  if (!db.prepare("SELECT 1 FROM suppliers WHERE id = ? AND deleted_at IS NULL").get(v.supplierId)) throw new UserError("اختار صاحب المعدة");
  if (v.equipmentId != null) {
    const e = db.prepare("SELECT supplier_id FROM equipment WHERE id = ? AND deleted_at IS NULL").get(v.equipmentId) as { supplier_id: number } | undefined;
    if (!e) throw new UserError("المعدة دي مش موجودة");
    if (e.supplier_id !== v.supplierId) throw new UserError("المعدة دي مش بتاعة صاحب المعدة ده");
  }
  if (v.paidBy !== "us" && v.paidBy !== "owner") throw new UserError("اختار مين بيقبّض السواق");
  if (v.payKind !== "month" && v.payKind !== "day") throw new UserError("اختار شهري ولا يومية");
  if (v.ratePt != null && !(Number.isSafeInteger(v.ratePt) && v.ratePt >= 0)) throw new UserError("المرتب مش صحيح");
  if (v.paidBy === "us" && !v.ratePt) throw new UserError(v.payKind === "month" ? "اكتب مرتب السواق في الشهر" : "اكتب يومية السواق");
}

export function createDriver(db: Db, v: DriverInput) {
  check(db, v);
  const r = db
    .prepare("INSERT INTO drivers (name, phone, supplier_id, equipment_id, paid_by, pay_kind, rate_pt, start_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
    .run(v.name.trim(), v.phone?.trim() || null, v.supplierId, v.equipmentId ?? null, v.paidBy, v.payKind, v.paidBy === "us" ? v.ratePt ?? null : null, v.startDate || today());
  return Number(r.lastInsertRowid);
}

export function updateDriver(db: Db, id: number, v: DriverInput) {
  check(db, v);
  const r = db
    .prepare("UPDATE drivers SET name = ?, phone = ?, supplier_id = ?, equipment_id = ?, paid_by = ?, pay_kind = ?, rate_pt = ?, start_date = COALESCE(?, start_date) WHERE id = ? AND deleted_at IS NULL")
    .run(v.name.trim(), v.phone?.trim() || null, v.supplierId, v.equipmentId ?? null, v.paidBy, v.payKind, v.paidBy === "us" ? v.ratePt ?? null : null, v.startDate || null, id);
  if (!r.changes) throw new UserError("السواق ده مش موجود");
}

const driverOf = (db: Db, id: number) => {
  const d = db.prepare("SELECT * FROM drivers WHERE id = ? AND deleted_at IS NULL").get(id) as DriverRow | undefined;
  if (!d) throw new UserError("السواق ده مش موجود");
  return d;
};

/** فلوس للسواق: بتطلع من الخزنة وبتتخصم من صاحب المعدة. */
export function recordDriverPayment(db: Db, v: { driverId: number; date: string; amountPt: number; note?: string } & Money, opts: { confirmNegative?: boolean } = {}) {
  const d = driverOf(db, v.driverId);
  const note = `للسواق ${d.name}${v.note?.trim() ? ` — ${v.note.trim()}` : ""}`;
  // على عقد المعدة اللي شغال يومها (عشان تظهر على المعدة في تصفية صاحبها)
  const contract =
    d.equipment_id == null
      ? undefined
      : (db
          .prepare(
            `SELECT id FROM contracts WHERE equipment_id = ? AND supplier_id = ? AND deleted_at IS NULL AND start_date <= ? AND (end_date IS NULL OR end_date >= ?)
             ORDER BY start_date DESC LIMIT 1`,
          )
          .get(d.equipment_id, d.supplier_id, v.date, v.date) as { id: number } | undefined);
  return recordSupplierDeduction(db, { ...v, supplierId: d.supplier_id, contractId: contract?.id ?? null, note, driverId: d.id, paidFromTreasury: true }, opts);
}

/** أيام شغل المعدة في الشهر (من سركي الشركة: كل يوم مسجل ومش إجازة). */
function workedDays(db: Db, equipmentId: number | null, month: string) {
  if (equipmentId == null) return 0;
  return (
    db
      .prepare(
        `SELECT COUNT(DISTINCT w.date) AS n FROM work_logs w JOIN contracts c ON c.id = w.contract_id
         WHERE c.equipment_id = ? AND c.deleted_at IS NULL AND w.deleted_at IS NULL AND w.side = 'client' AND w.is_day_off = 0 AND substr(w.date, 1, 7) = ?`,
      )
      .get(equipmentId, month) as { n: number }
  ).n;
}

/** مرتب السواق عن الشهر ده (لو إحنا بنقبّضه). */
function earnedIn(db: Db, d: DriverRow, month: string) {
  if (d.paid_by !== "us" || !d.rate_pt || month < monthOf(d.start_date)) return { days: d.pay_kind === "day" ? workedDays(db, d.equipment_id, month) : null, earnedPt: 0 };
  if (d.pay_kind === "month") return { days: null, earnedPt: d.rate_pt };
  const days = workedDays(db, d.equipment_id, month);
  return { days, earnedPt: days * d.rate_pt };
}

type PayRow = { id: number; driver_id: number; date: string; amount_pt: number; note: string | null; deleted_at: string | null; reversal_of: number | null };

/** السواقين: القايمة، وحساب كل واحد في الشهر ده، وتصفية السواق المختار. */
export function driversView(db: Db, month = monthOf(today()), driverId?: number) {
  const drivers = db
    .prepare(
      `SELECT d.*, s.name AS supplier_name, e.name AS equipment_name FROM drivers d
       JOIN suppliers s ON s.id = d.supplier_id LEFT JOIN equipment e ON e.id = d.equipment_id
       WHERE d.deleted_at IS NULL ORDER BY d.name`,
    )
    .all() as (DriverRow & { supplier_name: string; equipment_name: string | null })[];
  const pays = live(db.prepare("SELECT id, driver_id, date, amount_pt, note, deleted_at, reversal_of FROM supplier_deductions WHERE driver_id IS NOT NULL").all() as PayRow[]);
  const sum = (rows: PayRow[]) => rows.reduce((s, r) => s + r.amount_pt, 0);

  const rows = drivers.map((d) => {
    const mine = pays.filter((p) => p.driver_id === d.id);
    const now = earnedIn(db, d, month);
    const paidPt = sum(mine.filter((p) => p.date.startsWith(month)));
    // الحساب من أول ما اشتغل لحد الشهر ده: اتستحق كام واتصرفله كام
    const months = d.paid_by === "us" ? monthsBetween(monthOf(d.start_date), month) : [];
    const totalEarnedPt = months.reduce((s, m) => s + earnedIn(db, d, m).earnedPt, 0);
    const totalPaidPt = sum(mine.filter((p) => p.date.slice(0, 7) <= month));
    return {
      id: d.id,
      name: d.name,
      phone: d.phone,
      supplierId: d.supplier_id,
      supplierName: d.supplier_name,
      equipmentId: d.equipment_id,
      equipmentName: d.equipment_name,
      paidBy: d.paid_by,
      payKind: d.pay_kind,
      ratePt: d.rate_pt,
      startDate: d.start_date,
      days: now.days,
      earnedPt: now.earnedPt,
      paidPt,
      /** لسه ليه عندنا (إحنا بنقبّضه): كل اللي استحقه − كل اللي خده */
      remainingPt: d.paid_by === "us" ? totalEarnedPt - totalPaidPt : 0,
      previousPt: d.paid_by === "us" ? totalEarnedPt - now.earnedPt - (totalPaidPt - paidPt) : 0,
    };
  });

  const selected = driverId != null ? rows.find((r) => r.id === driverId) ?? null : null;
  const payments = selected
    ? pays
        .filter((p) => p.driver_id === selected.id && p.date.startsWith(month))
        .sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id)
        .map((p) => ({ id: p.id, date: p.date, amountPt: p.amount_pt, note: p.note }))
    : [];
  return {
    month,
    drivers: rows,
    selected,
    payments,
    suppliers: db.prepare("SELECT id, name FROM suppliers WHERE deleted_at IS NULL ORDER BY name").all() as { id: number; name: string }[],
    equipment: db.prepare("SELECT id, name, supplier_id AS supplierId FROM equipment WHERE deleted_at IS NULL ORDER BY name").all() as { id: number; name: string; supplierId: number }[],
  };
}

/** للتصفية بتاعة صاحب المعدة: السواقين اللي على معداته ومرتب الشهر اللي لسه متدفعش. */
export function driversOfSupplier(db: Db, supplierId: number, month: string) {
  return driversView(db, month).drivers.filter((d) => d.supplierId === supplierId);
}
