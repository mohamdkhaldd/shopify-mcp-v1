import { CashWarning, Db, UserError } from "../db";
import { computeBooks } from "./books";
import { managersReport } from "./managers";
import { formatPounds } from "../calc/money";

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

/**
 * الفلوس دخلت/خرجت من أنهي حساب في الخزنة، ولو لسه مع حد (heldBy) مبتدخلش
 * الرصيد لحد ما تتعلّم "وصلت". transferFee = اتبعتت "تحويل" (عليه عمولة
 * الحساب، زي انستا باي) مش "دفع".
 */
export interface Money {
  account?: string;
  heldBy?: string | null;
  transferFee?: boolean;
}

interface Opts {
  /** The user saw the "cash goes negative" warning and confirmed. */
  confirmNegative?: boolean;
}

function positive(amountPt: number) {
  if (!Number.isSafeInteger(amountPt) || amountPt <= 0) throw new UserError("المبلغ لازم يبقى أكبر من صفر");
}

type AccountRow = { key: string; name: string; fee_bp: number; fee_min_pt: number; fee_max_pt: number | null };

function accountOf(db: Db, key?: string): AccountRow {
  const k = key || "instapay";
  const a = db.prepare("SELECT key, name, fee_bp, fee_min_pt, fee_max_pt FROM treasury_accounts WHERE key = ? AND deleted_at IS NULL").get(k) as AccountRow | undefined;
  if (!a) throw new UserError("الحساب ده مش موجود في الخزنة");
  return a;
}

/** عمولة التحويل من الحساب ده على المبلغ (صفر لو الحساب ملوش عمولة). */
export function transferFee(db: Db, key: string | undefined, amountPt: number): number {
  const a = accountOf(db, key);
  if (!a.fee_bp && !a.fee_min_pt) return 0;
  let fee = Math.round((amountPt * a.fee_bp) / 10_000);
  fee = Math.max(fee, a.fee_min_pt);
  if (a.fee_max_pt != null) fee = Math.min(fee, a.fee_max_pt);
  return fee;
}

function treasury(
  db: Db,
  t: { date: string; direction: "in" | "out"; amountPt: number; type: TreasuryType; table: string; id: number; partyKind?: string; partyId?: number | null; note?: string | null; account?: string; heldBy?: string | null; deliveredAt?: string | null },
) {
  const account = accountOf(db, t.account).key;
  db.prepare(
    `INSERT INTO treasury_entries (date, direction, amount_pt, type, source_table, source_id, party_kind, party_id, note, account, held_by, delivered_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(t.date, t.direction, t.amountPt, t.type, t.table, t.id, t.partyKind ?? null, t.partyId ?? null, t.note ?? null, account, t.heldBy?.trim() || null, t.deliveredAt ?? null);
}

/** عمولة التحويل بتتسجل مصروف عام (بند "عمولات تحويل") طالع من نفس الحساب. */
function chargeFee(db: Db, date: string, m: Money, amountPt: number, what: string, of: string) {
  if (!m.transferFee) return 0;
  const fee = transferFee(db, m.account, amountPt);
  if (fee <= 0) return 0;
  const acc = accountOf(db, m.account);
  let cat = db.prepare("SELECT id FROM expense_categories WHERE name = 'عمولات تحويل' AND deleted_at IS NULL").get() as { id: number } | undefined;
  if (!cat) cat = { id: insertId(db.prepare("INSERT INTO expense_categories (name) VALUES ('عمولات تحويل')").run()) };
  const note = `عمولة ${acc.name} على ${what} (${formatPounds(amountPt)} ج)`;
  const id = insertId(db.prepare("INSERT INTO expenses (kind, contract_id, category_id, date, amount_pt, note, fee_of) VALUES ('general', NULL, ?, ?, ?, ?, ?)").run(cat.id, date, fee, note, of));
  treasury(db, { date, direction: "out", amountPt: fee, type: "expense", table: "expenses", id, note, account: acc.key });
  return fee;
}

/** Available operating cash after paying `amountPt` out (tax money and profits owed are never "available"). */
export function availableAfter(db: Db, date: string, amountPt: number) {
  return computeBooks(db, date).treasury.availablePt - amountPt;
}

function guardCash(db: Db, date: string, amountPt: number, opts: Opts, m: Money = {}) {
  const after = availableAfter(db, date, amountPt + (m.transferFee ? transferFee(db, m.account, amountPt) : 0));
  if (after < 0 && !opts.confirmNegative) throw new CashWarning(after);
}

const insertId = (r: { lastInsertRowid: number | bigint }) => Number(r.lastInsertRowid);

export function recordCapital(db: Db, v: { investorId: number; kind: "deposit" | "withdrawal"; date: string; amountPt: number; note?: string } & Money, opts: Opts = {}) {
  positive(v.amountPt);
  return db.transaction(() => {
    if (v.kind === "withdrawal") {
      const capital = computeBooks(db, v.date).investors.find((i) => i.investorId === v.investorId)?.capitalPt ?? 0;
      if (v.amountPt > capital) throw new UserError("المبلغ أكبر من رأس مال المستثمر ده");
      guardCash(db, v.date, v.amountPt, opts, v);
    }
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
      account: v.account,
      heldBy: v.kind === "deposit" ? v.heldBy : null,
    });
    if (v.kind === "withdrawal") chargeFee(db, v.date, v, v.amountPt, "سحب رأس مال", `capital_movements:${id}`);
    return id;
  })();
}

const monthOrNull = (m?: string | null) => {
  if (!m) return null;
  if (!/^\d{4}-\d{2}$/.test(m)) throw new UserError("الشهر مش صحيح");
  return m;
};

export function recordClientPayment(db: Db, v: { clientId: number; contractId?: number | null; date: string; amountPt: number; note?: string; forMonth?: string | null } & Money) {
  positive(v.amountPt);
  return db.transaction(() => {
    const id = insertId(
      db
        .prepare("INSERT INTO client_payments (client_id, contract_id, date, amount_pt, note, for_month) VALUES (?, ?, ?, ?, ?, ?)")
        .run(v.clientId, v.contractId ?? null, v.date, v.amountPt, v.note ?? null, monthOrNull(v.forMonth)),
    );
    treasury(db, { date: v.date, direction: "in", amountPt: v.amountPt, type: "client_collection", table: "client_payments", id, partyKind: "client", partyId: v.clientId, note: v.note, account: v.account, heldBy: v.heldBy });
    return id;
  })();
}

export function recordSupplierPayment(
  db: Db,
  v: { supplierId: number; contractId?: number | null; date: string; amountPt: number; note?: string; forMonth?: string | null } & Money,
  opts: Opts = {},
) {
  positive(v.amountPt);
  return db.transaction(() => {
    guardCash(db, v.date, v.amountPt, opts, v);
    const id = insertId(
      db
        .prepare("INSERT INTO supplier_payments (supplier_id, contract_id, date, amount_pt, note, for_month) VALUES (?, ?, ?, ?, ?, ?)")
        .run(v.supplierId, v.contractId ?? null, v.date, v.amountPt, v.note ?? null, monthOrNull(v.forMonth)),
    );
    treasury(db, { date: v.date, direction: "out", amountPt: v.amountPt, type: "supplier_payment", table: "supplier_payments", id, partyKind: "supplier", partyId: v.supplierId, note: v.note, account: v.account });
    chargeFee(db, v.date, v, v.amountPt, "دفعة لصاحب معدة", `supplier_payments:${id}`);
    return id;
  })();
}

/** Something we paid on the supplier's behalf; it comes off what we owe him. */
export function recordSupplierDeduction(
  db: Db,
  v: { supplierId: number; contractId?: number | null; date: string; amountPt: number; note: string; paidFromTreasury?: boolean; driverId?: number | null } & Money,
  opts: Opts = {},
) {
  positive(v.amountPt);
  const fromTreasury = v.paidFromTreasury ?? true;
  return db.transaction(() => {
    if (fromTreasury) guardCash(db, v.date, v.amountPt, opts, v);
    const id = insertId(
      db
        .prepare("INSERT INTO supplier_deductions (supplier_id, contract_id, date, amount_pt, note, paid_from_treasury, driver_id) VALUES (?, ?, ?, ?, ?, ?, ?)")
        .run(v.supplierId, v.contractId ?? null, v.date, v.amountPt, v.note, Number(fromTreasury), v.driverId ?? null),
    );
    if (fromTreasury) {
      treasury(db, { date: v.date, direction: "out", amountPt: v.amountPt, type: "supplier_deduction", table: "supplier_deductions", id, partyKind: "supplier", partyId: v.supplierId, note: v.note, account: v.account });
      chargeFee(db, v.date, v, v.amountPt, `خصم لصاحب معدة: ${v.note}`, `supplier_deductions:${id}`);
    }
    return id;
  })();
}

export function recordExpense(
  db: Db,
  v: { kind: "contract" | "general"; contractId?: number | null; categoryId?: number | null; date: string; amountPt: number; note?: string; paidBy?: string | null } & Money,
  opts: Opts = {},
) {
  positive(v.amountPt);
  if (v.kind === "contract" && v.contractId == null) throw new UserError("مصروف العقد لازم يتربط بعقد");
  // دفعه شريك إدارة من جيبه: مبيطلعش من الخزنة، والشركة بقت عليها له المبلغ
  const paidBy = v.paidBy?.trim() || null;
  return db.transaction(() => {
    if (!paidBy) guardCash(db, v.date, v.amountPt, opts, v);
    const id = insertId(
      db
        .prepare("INSERT INTO expenses (kind, contract_id, category_id, date, amount_pt, note, paid_by) VALUES (?, ?, ?, ?, ?, ?, ?)")
        .run(v.kind, v.kind === "contract" ? v.contractId : null, v.categoryId ?? null, v.date, v.amountPt, v.note ?? null, paidBy),
    );
    if (paidBy) return id;
    treasury(db, { date: v.date, direction: "out", amountPt: v.amountPt, type: "expense", table: "expenses", id, partyKind: v.contractId ? "contract" : undefined, partyId: v.contractId ?? null, note: v.note, account: v.account });
    chargeFee(db, v.date, v, v.amountPt, `مصروف${v.note ? `: ${v.note}` : ""}`, `expenses:${id}`);
    return id;
  })();
}

export function recordTaxPayment(db: Db, v: { tax: "vat" | "tax5"; periodMonth?: string; date: string; amountPt: number; receiptNo?: string; note?: string } & Money) {
  positive(v.amountPt);
  return db.transaction(() => {
    const id = insertId(
      db
        .prepare("INSERT INTO tax_payments (tax, period_month, date, amount_pt, receipt_no, note) VALUES (?, ?, ?, ?, ?, ?)")
        .run(v.tax, v.periodMonth ?? null, v.date, v.amountPt, v.receiptNo ?? null, v.note ?? null),
    );
    treasury(db, { date: v.date, direction: "out", amountPt: v.amountPt, type: "tax_payment", table: "tax_payments", id, note: v.note, account: v.account });
    chargeFee(db, v.date, v, v.amountPt, "دفع ضرايب", `tax_payments:${id}`);
    return id;
  })();
}

/** شريك إدارة صرف من جيبه: فلوسه بترجعله حتى لو نصيب الإدارة لسه متحصّلش (بس مش أكتر من اللي ليه). */
function managementDue(db: Db, b: ReturnType<typeof computeBooks>, name: string | null | undefined, due: number) {
  const who = name?.trim();
  if (!who) return due;
  const p = managersReport(db, b, lastMonthOf(b)).people.find((x) => x.name === who);
  if (!p || !p.pocketPt) return due;
  return Math.max(due, Math.min(p.balancePt, due + p.pocketPt));
}
const lastMonthOf = (b: ReturnType<typeof computeBooks>) => b.months[b.months.length - 1]?.month ?? "";

/** Profit payout. Only what clients have actually paid for can be paid out. */
export function recordPayout(
  db: Db,
  v: { payee: "investor" | "management"; investorId?: number; managerName?: string | null; date: string; amountPt: number; note?: string } & Money,
  opts: Opts = {},
) {
  positive(v.amountPt);
  return db.transaction(() => {
    const b = computeBooks(db, v.date);
    const due =
      v.payee === "investor"
        ? b.investors.find((i) => i.investorId === v.investorId)?.payableNowPt ?? 0
        : managementDue(db, b, v.managerName, Math.max(0, b.management.releasablePt - b.management.paidPt));
    if (v.amountPt > due) throw new UserError("المبلغ أكبر من الأرباح اللي اتحصّلت ومتصرفتش");
    // profits owed are already set aside, so paying them doesn't reduce operating cash
    if (b.treasury.balancePt - b.treasury.taxHeldPt < v.amountPt && !opts.confirmNegative) throw new CashWarning(b.treasury.balancePt - b.treasury.taxHeldPt - v.amountPt);
    const id = insertId(
      db
        .prepare("INSERT INTO profit_payouts (payee_kind, investor_id, manager_name, date, amount_pt, note) VALUES (?, ?, ?, ?, ?, ?)")
        .run(v.payee, v.payee === "investor" ? v.investorId : null, v.payee === "management" ? v.managerName?.trim() || null : null, v.date, v.amountPt, v.note ?? null),
    );
    const who = v.payee === "management" ? v.managerName?.trim() : "";
    const note = who ? [who, v.note].filter(Boolean).join(" — ") : v.note;
    treasury(db, { date: v.date, direction: "out", amountPt: v.amountPt, type: "profit_payout", table: "profit_payouts", id, partyKind: v.payee, partyId: v.investorId ?? null, note, account: v.account });
    chargeFee(db, v.date, v, v.amountPt, "صرف أرباح", `profit_payouts:${id}`);
    return id;
  })();
}

const REVERSIBLE: Record<string, string[]> = {
  client_payments: ["client_id", "contract_id", "for_month"],
  supplier_payments: ["supplier_id", "contract_id", "for_month"],
  supplier_deductions: ["supplier_id", "contract_id", "paid_from_treasury", "driver_id"],
  expenses: ["kind", "contract_id", "category_id", "paid_by"],
  capital_movements: ["investor_id", "kind"],
  profit_payouts: ["payee_kind", "investor_id", "manager_name"],
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
        account: t.account,
        heldBy: t.held_by,
        deliveredAt: t.delivered_at,
      });
    }
    return newId;
  })();
}

/** "حطها في رأس ماله": his profit that's ready to pay goes into his capital instead of out of the treasury. */
export function reinvestProfit(db: Db, v: { investorId: number; date: string; amountPt: number }) {
  return db.transaction(() => {
    const payout = recordPayout(db, { payee: "investor", investorId: v.investorId, date: v.date, amountPt: v.amountPt, note: "اتحطت في رأس المال" }, { confirmNegative: true });
    recordCapital(db, { investorId: v.investorId, kind: "deposit", date: v.date, amountPt: v.amountPt, note: "أرباح اتحطت في رأس المال" });
    return payout;
  })();
}

/** نقل فلوس من حساب لحساب في الخزنة (ولو "تحويل" من حساب عليه عمولة، العمولة بتتسجل). */
export function recordTransfer(db: Db, v: { date: string; from: string; to: string; amountPt: number; note?: string; transferFee?: boolean }) {
  positive(v.amountPt);
  const from = accountOf(db, v.from);
  const to = accountOf(db, v.to);
  if (from.key === to.key) throw new UserError("اختار حسابين مختلفين");
  return db.transaction(() => {
    const id = insertId(
      db.prepare("INSERT INTO treasury_transfers (date, from_account, to_account, amount_pt, note) VALUES (?, ?, ?, ?, ?)").run(v.date, from.key, to.key, v.amountPt, v.note ?? null),
    );
    chargeFee(db, v.date, { account: from.key, transferFee: v.transferFee }, v.amountPt, `تحويل لـ ${to.name}`, `treasury_transfers:${id}`);
    return id;
  })();
}

/** الفلوس اللي كانت مع حد وصلت الخزنة النهارده (أو في التاريخ ده). */
export function markDelivered(db: Db, entryId: number, date: string) {
  const r = db.prepare("SELECT held_by, delivered_at FROM treasury_entries WHERE id = ? AND deleted_at IS NULL").get(entryId) as { held_by: string | null; delivered_at: string | null } | undefined;
  if (!r || !r.held_by) throw new UserError("الحركة دي مش متعلّمة إنها مع حد");
  if (r.delivered_at) throw new UserError("الفلوس دي اتعلّمت إنها وصلت قبل كده");
  db.prepare("UPDATE treasury_entries SET delivered_at = ? WHERE id = ?").run(date, entryId);
}

/** تعديل حساب في الخزنة (الاسم ونسبة العمولة)، أو إضافة واحد جديد. */
export function saveAccount(db: Db, v: { key?: string; name: string; feeBp: number; feeMinPt: number; feeMaxPt: number | null }) {
  if (!v.name.trim()) throw new UserError("اكتب اسم الحساب");
  if (!(v.feeBp >= 0 && v.feeBp <= 10_000) || !(v.feeMinPt >= 0)) throw new UserError("العمولة مش صحيحة");
  if (v.key) {
    db.prepare("UPDATE treasury_accounts SET name = ?, fee_bp = ?, fee_min_pt = ?, fee_max_pt = ? WHERE key = ?").run(v.name.trim(), v.feeBp, v.feeMinPt, v.feeMaxPt, v.key);
    return v.key;
  }
  const key = `acc_${Date.now().toString(36)}`;
  const sort = (db.prepare("SELECT COALESCE(MAX(sort), 0) + 1 AS n FROM treasury_accounts").get() as { n: number }).n;
  db.prepare("INSERT INTO treasury_accounts (key, name, fee_bp, fee_min_pt, fee_max_pt, sort) VALUES (?, ?, ?, ?, ?, ?)").run(key, v.name.trim(), v.feeBp, v.feeMinPt, v.feeMaxPt, sort);
  return key;
}

/** فلوس من الخزنة بقت مع حد (شريك…) — بتطلع من الرصيد لحد ما ترجع. */
export function recordHold(db: Db, v: { date: string; account?: string; amountPt: number; heldBy: string; note?: string }) {
  positive(v.amountPt);
  if (!v.heldBy?.trim()) throw new UserError("اكتب الفلوس مع مين");
  const acc = accountOf(db, v.account);
  return insertId(
    db.prepare("INSERT INTO treasury_holds (date, account, amount_pt, held_by, note) VALUES (?, ?, ?, ?, ?)").run(v.date, acc.key, v.amountPt, v.heldBy.trim(), v.note ?? null),
  );
}

/** الفلوس اللي كانت مع حد رجعت الخزنة. */
export function returnHold(db: Db, id: number, date: string) {
  const r = db.prepare("SELECT returned_at, date FROM treasury_holds WHERE id = ? AND deleted_at IS NULL").get(id) as { returned_at: string | null; date: string } | undefined;
  if (!r) throw new UserError("الحركة دي مش موجودة");
  if (r.returned_at) throw new UserError("الفلوس دي اتعلّمت إنها رجعت قبل كده");
  if (date < r.date) throw new UserError("تاريخ الرجوع قبل تاريخ ما خرجت");
  db.prepare("UPDATE treasury_holds SET returned_at = ? WHERE id = ?").run(date, id);
}
