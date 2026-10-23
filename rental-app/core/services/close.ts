import { Db, monthOf, UserError } from "../db";
import { computeBooks, findMonth, snapshotOf } from "./books";

/**
 * Monthly close: freezes the month's numbers and distribution, numbers its
 * invoices, and from then on the database refuses any change dated inside it.
 * Months close in order.
 */
export function closeMonth(db: Db, month: string, closingDate: string) {
  if (month >= monthOf(closingDate)) throw new UserError("مينفعش تقفل شهر لسه مخلصش");
  return db.transaction(() => {
    if (db.prepare("SELECT 1 FROM month_closes WHERE month = ?").get(month)) throw new UserError("الشهر ده اتقفل قبل كده");
    const lastDay = new Date(Date.UTC(+month.slice(0, 4), +month.slice(5, 7), 0)).toISOString().slice(0, 10);
    const books = computeBooks(db, lastDay);
    const m = findMonth(books, month);
    if (!m) throw new UserError("مفيش أي حركة في الشهر ده");
    const earlierOpen = books.months.find((x) => x.month < month && !x.closed);
    if (earlierOpen) throw new UserError(`اقفل شهر ${earlierOpen.month} الأول`);

    const year = month.slice(0, 4);
    let seq = db.prepare("SELECT COUNT(*) AS n FROM invoices WHERE serial LIKE ?").get(`ف-${year}-%`).n;
    const ins = db.prepare("INSERT INTO invoices (serial, contract_id, month, base_pt, vat_pt, total_pt) VALUES (?, ?, ?, ?, ?, ?)");
    for (const r of m.contracts.filter((r) => r.invoiceTotalPt > 0)) {
      seq += 1;
      ins.run(`ف-${year}-${String(seq).padStart(4, "0")}`, r.contractId, month, r.clientBasePt, r.vatPt, r.invoiceTotalPt);
    }
    db.prepare("INSERT INTO month_closes (month, snapshot_json) VALUES (?, ?)").run(month, JSON.stringify(snapshotOf(m)));
    return m;
  })();
}

/** Correction to a closed month, booked in an open month (the closed month itself never changes). */
export function recordAdjustment(
  db: Db,
  v: { appliedMonth: string; targetMonth: string; contractId: number; kind: "client_base" | "supplier_cost"; amountPt: number; reason: string },
) {
  if (!v.reason.trim()) throw new UserError("اكتب سبب التسوية");
  if (!db.prepare("SELECT 1 FROM month_closes WHERE month = ?").get(v.targetMonth)) throw new UserError("التسوية بتبقى لشهر اتقفل بس — الشهر المفتوح بيتعدل من السركي نفسه");
  return Number(
    db
      .prepare("INSERT INTO adjustments (applied_month, target_month, contract_id, kind, amount_pt, reason) VALUES (?, ?, ?, ?, ?, ?)")
      .run(v.appliedMonth, v.targetMonth, v.contractId, v.kind, v.amountPt, v.reason).lastInsertRowid,
  );
}
