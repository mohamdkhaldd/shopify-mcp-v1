import { CashWarning, Db, UserError } from "../db";
import { computeBooks } from "./books";

// Every movement of money goes through here: the business row and its
// treasury entry are written in one transaction, and outgoing money is
// checked against the cash that's actually free to use.

type TreasuryType =
  | "investor_deposit"
  | "investor_withdrawal"
  | "client_collection"
  | "supplier_payment"
  | "supplier_deduction"
  | "expense"
  | "tax_payment"
  | "profit_payout";

interface Opts {
  /** The user saw the "cash goes negative" warning and confirmed. */
  confirmNegative?: boolean;
}

function positive(amountPt: number) {
  if (!Number.isSafeInteger(amountPt) || amountPt <= 0) throw new UserError("المبلغ لازم يبقى أكبر من صفر");
}

function treasury(db: Db, t: { date: string; direction: "in" | "out"; amountPt: number; type: TreasuryType; table: string; id: number; partyKind?: string; partyId?: number | null; note?: string | null }) {
  db.prepare(
    `INSERT INTO treasury_entries (date, direction, amount_pt, type, source_table, source_id, party_kind, party_id, note)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(t.date, t.direction, t.amountPt, t.type, t.table, t.id, t.partyKind ?? null, t.partyId ?? null, t.note ?? null);
}

/** Available operating cash after paying `amountPt` out (tax money and profits owed are never "available"). */
export function availableAfter(db: Db, date: string, amountPt: number) {
  return computeBooks(db, date).treasury.availablePt - amountPt;
}

function guardCash(db: Db, date: string, amountPt: number, opts: Opts) {
  const after = availableAfter(db, date, amountPt);
  if (after < 0 && !opts.confirmNegative) throw new CashWarning(after);
}

const insertId = (r: { lastInsertRowid: number | bigint }) => Number(r.lastInsertRowid);

export function recordCapital(db: Db, v: { investorId: number; kind: "deposit" | "withdrawal"; date: string; amountPt: number; note?: string }, opts: Opts = {}) {
  positive(v.amountPt);
  return db.transaction(() => {
    if (v.kind === "withdrawal") guardCash(db, v.date, v.amountPt, opts);
    const id = insertId(
      db.prepare("INSERT INTO capital_movements (investor_id, kind, date, amount_pt, note) VALUES (?, ?, ?, ?, ?)").run(v.investorId, v.kind, v.date, v.amountPt, v.note ?? null),
    );
    treasury(db, {
      date: v.date,
      direction: v.kind === "deposit" ? "in" : "out",
      amountPt: v.amountPt,
      type: v.kind === "deposit" ? "investor_deposit" : "investor_withdrawal",
      table: "capital_movements",
      id,
      partyKind: "investor",
      partyId: v.investorId,
      note: v.note,
    });
    return id;
  })();
}

export function recordClientPayment(db: Db, v: { clientId: number; contractId?: number | null; date: string; amountPt: number; note?: string }) {
  positive(v.amountPt);
  return db.transaction(() => {
    const id = insertId(
      db.prepare("INSERT INTO client_payments (client_id, contract_id, date, amount_pt, note) VALUES (?, ?, ?, ?, ?)").run(v.clientId, v.contractId ?? null, v.date, v.amountPt, v.note ?? null),
    );
    treasury(db, { date: v.date, direction: "in", amountPt: v.amountPt, type: "client_collection", table: "client_payments", id, partyKind: "client", partyId: v.clientId, note: v.note });
    return id;
  })();
}

export function recordSupplierPayment(db: Db, v: { supplierId: number; contractId?: number | null; date: string; amountPt: number; note?: string }, opts: Opts = {}) {
  positive(v.amountPt);
  return db.transaction(() => {
    guardCash(db, v.date, v.amountPt, opts);
    const id = insertId(
      db.prepare("INSERT INTO supplier_payments (supplier_id, contract_id, date, amount_pt, note) VALUES (?, ?, ?, ?, ?)").run(v.supplierId, v.contractId ?? null, v.date, v.amountPt, v.note ?? null),
    );
    treasury(db, { date: v.date, direction: "out", amountPt: v.amountPt, type: "supplier_payment", table: "supplier_payments", id, partyKind: "supplier", partyId: v.supplierId, note: v.note });
    return id;
  })();
}

/** Something we paid on the supplier's behalf; it comes off what we owe him. */
export function recordSupplierDeduction(
  db: Db,
  v: { supplierId: number; contractId?: number | null; date: string; amountPt: number; note: string; paidFromTreasury?: boolean },
  opts: Opts = {},
) {
  positive(v.amountPt);
  const fromTreasury = v.paidFromTreasury ?? true;
  return db.transaction(() => {
    if (fromTreasury) guardCash(db, v.date, v.amountPt, opts);
    const id = insertId(
      db
        .prepare("INSERT INTO supplier_deductions (supplier_id, contract_id, date, amount_pt, note, paid_from_treasury) VALUES (?, ?, ?, ?, ?, ?)")
        .run(v.supplierId, v.contractId ?? null, v.date, v.amountPt, v.note, Number(fromTreasury)),
    );
    if (fromTreasury)
      treasury(db, { date: v.date, direction: "out", amountPt: v.amountPt, type: "supplier_deduction", table: "supplier_deductions", id, partyKind: "supplier", partyId: v.supplierId, note: v.note });
    return id;
  })();
}

export function recordExpense(
  db: Db,
  v: { kind: "contract" | "general"; contractId?: number | null; categoryId?: number | null; date: string; amountPt: number; note?: string },
  opts: Opts = {},
) {
  positive(v.amountPt);
  if (v.kind === "contract" && v.contractId == null) throw new UserError("مصروف العقد لازم يتربط بعقد");
  return db.transaction(() => {
    guardCash(db, v.date, v.amountPt, opts);
    const id = insertId(
      db
        .prepare("INSERT INTO expenses (kind, contract_id, category_id, date, amount_pt, note) VALUES (?, ?, ?, ?, ?, ?)")
        .run(v.kind, v.kind === "contract" ? v.contractId : null, v.categoryId ?? null, v.date, v.amountPt, v.note ?? null),
    );
    treasury(db, { date: v.date, direction: "out", amountPt: v.amountPt, type: "expense", table: "expenses", id, partyKind: v.contractId ? "contract" : undefined, partyId: v.contractId ?? null, note: v.note });
    return id;
  })();
}

export function recordTaxPayment(db: Db, v: { tax: "vat" | "tax5"; periodMonth?: string; date: string; amountPt: number; receiptNo?: string; note?: string }) {
  positive(v.amountPt);
  return db.transaction(() => {
    const id = insertId(
      db
        .prepare("INSERT INTO tax_payments (tax, period_month, date, amount_pt, receipt_no, note) VALUES (?, ?, ?, ?, ?, ?)")
        .run(v.tax, v.periodMonth ?? null, v.date, v.amountPt, v.receiptNo ?? null, v.note ?? null),
    );
    treasury(db, { date: v.date, direction: "out", amountPt: v.amountPt, type: "tax_payment", table: "tax_payments", id, note: v.note });
    return id;
  })();
}

/** Profit payout. Only what clients have actually paid for can be paid out. */
export function recordPayout(db: Db, v: { payee: "investor" | "management"; investorId?: number; date: string; amountPt: number; note?: string }, opts: Opts = {}) {
  positive(v.amountPt);
  return db.transaction(() => {
    const b = computeBooks(db, v.date);
    const due =
      v.payee === "investor"
        ? b.investors.find((i) => i.investorId === v.investorId)?.payableNowPt ?? 0
        : Math.max(0, b.management.releasablePt - b.management.paidPt);
    if (v.amountPt > due) throw new UserError("المبلغ أكبر من الأرباح اللي اتحصّلت ومتصرفتش");
    // profits owed are already set aside, so paying them doesn't reduce operating cash
    if (b.treasury.balancePt - b.treasury.taxHeldPt < v.amountPt && !opts.confirmNegative) throw new CashWarning(b.treasury.balancePt - b.treasury.taxHeldPt - v.amountPt);
    const id = insertId(
      db
        .prepare("INSERT INTO profit_payouts (payee_kind, investor_id, date, amount_pt, note) VALUES (?, ?, ?, ?, ?)")
        .run(v.payee, v.payee === "investor" ? v.investorId : null, v.date, v.amountPt, v.note ?? null),
    );
    treasury(db, { date: v.date, direction: "out", amountPt: v.amountPt, type: "profit_payout", table: "profit_payouts", id, partyKind: v.payee, partyId: v.investorId ?? null, note: v.note });
    return id;
  })();
}

const REVERSIBLE: Record<string, string[]> = {
  client_payments: ["client_id", "contract_id"],
  supplier_payments: ["supplier_id", "contract_id"],
  supplier_deductions: ["supplier_id", "contract_id", "paid_from_treasury"],
  expenses: ["kind", "contract_id", "category_id"],
  capital_movements: ["investor_id", "kind"],
  profit_payouts: ["payee_kind", "investor_id"],
  tax_payments: ["tax", "period_month", "receipt_no"],
};

/**
 * Cancels a money row with a mirror row dated `date` (an open month) — the
 * original is never deleted or edited. Its treasury entry is mirrored too.
 */
export function reverse(db: Db, table: keyof typeof REVERSIBLE, id: number, date: string, reason: string) {
  const cols = REVERSIBLE[table];
  if (!cols) throw new UserError("الحركة دي مينفعش تتلغي");
  if (!reason.trim()) throw new UserError("اكتب سبب الإلغاء");
  return db.transaction(() => {
    const row = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id);
    if (!row || row.deleted_at) throw new UserError("الحركة دي مش موجودة");
    if (row.reversal_of != null) throw new UserError("دي حركة إلغاء أصلًا");
    if (db.prepare(`SELECT 1 FROM ${table} WHERE reversal_of = ?`).get(id)) throw new UserError("الحركة دي اتلغت قبل كده");
    const allCols = [...cols, "date", "amount_pt", "note", "reversal_of"];
    const newId = insertId(
      db
        .prepare(`INSERT INTO ${table} (${allCols.join(", ")}) VALUES (${allCols.map(() => "?").join(", ")})`)
        .run(...cols.map((c) => row[c]), date, -row.amount_pt, `إلغاء: ${reason}`, id),
    );
    for (const t of db.prepare("SELECT * FROM treasury_entries WHERE source_table = ? AND source_id = ? AND deleted_at IS NULL").all(table, id)) {
      treasury(db, {
        date,
        direction: t.direction,
        amountPt: -t.amount_pt,
        type: t.type,
        table,
        id: newId,
        partyKind: t.party_kind,
        partyId: t.party_id,
        note: `إلغاء: ${reason}`,
      });
    }
    return newId;
  })();
}
