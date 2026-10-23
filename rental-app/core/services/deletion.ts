import { Db, UserError } from "../db";
import { formatPounds } from "../calc/money";

// "حذف" with a confirmation that lists everything that goes with it. Nothing
// is physically removed: rows get deleted_at (one batch id per delete) so they
// leave every list and total, stay in the activity log, and can be restored.
// Anything dated in a closed month is refused — that's what adjustments are for.

export type Deletable =
  | "client_payments"
  | "supplier_payments"
  | "supplier_deductions"
  | "expenses"
  | "capital_movements"
  | "profit_payouts"
  | "tax_payments"
  | "work_logs"
  | "contracts"
  | "equipment"
  | "clients"
  | "suppliers"
  | "investors"
  | "expense_categories";

const MONEY_LABEL: Record<string, string> = {
  client_payments: "دفعة من عميل",
  supplier_payments: "دفعة لصاحب معدة",
  supplier_deductions: "خصم لحساب صاحب معدة",
  expenses: "مصروف",
  capital_movements: "حركة رأس مال",
  profit_payouts: "صرف أرباح",
  tax_payments: "دفعة ضرايب",
};
const MONEY_TABLES = Object.keys(MONEY_LABEL);

interface Target {
  table: string;
  id: number;
  label: string;
  date?: string;
}

const live = "deleted_at IS NULL";

function money(db: Db, table: string, where: string, ...p: unknown[]): Target[] {
  return db
    .prepare(`SELECT id, date, amount_pt FROM ${table} WHERE ${where} AND ${live}`)
    .all(...p)
    .map((r: any) => ({ table, id: r.id, date: r.date, label: `${MONEY_LABEL[table]} ${formatPounds(Math.abs(r.amount_pt))} ج — ${r.date}` }));
}

function contractTargets(db: Db, contractId: number): Target[] {
  const c = db
    .prepare(
      `SELECT c.code, e.name AS eq, cl.name AS client FROM contracts c JOIN equipment e ON e.id = c.equipment_id
       JOIN clients cl ON cl.id = c.client_id WHERE c.id = ? AND c.${live}`,
    )
    .get(contractId);
  if (!c) return [];
  const logs = db.prepare(`SELECT id, date FROM work_logs WHERE contract_id = ? AND ${live}`).all(contractId);
  const out: Target[] = [{ table: "contracts", id: contractId, label: `العقد ${c.code} (${c.eq} — ${c.client})` }];
  if (logs.length) out.push(...logs.map((l: any, i: number) => ({ table: "work_logs", id: l.id, date: l.date, label: i === 0 ? `${logs.length} يوم سركي` : "" })));
  for (const t of ["client_payments", "supplier_payments", "supplier_deductions", "expenses"]) out.push(...money(db, t, "contract_id = ?", contractId));
  return out;
}

function targetsOf(db: Db, entity: Deletable, id: number): Target[] {
  if (MONEY_TABLES.includes(entity)) return money(db, entity, "id = ?", id);
  switch (entity) {
    case "work_logs": {
      const r = db.prepare(`SELECT id, date, side FROM work_logs WHERE id = ? AND ${live}`).get(id);
      return r ? [{ table: "work_logs", id, date: r.date, label: `يوم ${r.date} من ${r.side === "client" ? "سركي الشركة" : "سركي صاحب المعدة"}` }] : [];
    }
    case "contracts":
      return contractTargets(db, id);
    case "equipment": {
      const e = db.prepare(`SELECT name FROM equipment WHERE id = ? AND ${live}`).get(id);
      if (!e) return [];
      const contracts = db.prepare(`SELECT id FROM contracts WHERE equipment_id = ? AND ${live}`).all(id);
      return [{ table: "equipment", id, label: `المعدة ${e.name}` }, ...contracts.flatMap((c: any) => contractTargets(db, c.id))];
    }
    case "clients": {
      const c = db.prepare(`SELECT name FROM clients WHERE id = ? AND ${live}`).get(id);
      if (!c) return [];
      const contracts = db.prepare(`SELECT id FROM contracts WHERE client_id = ? AND ${live}`).all(id);
      return [
        { table: "clients", id, label: c.name },
        ...contracts.flatMap((x: any) => contractTargets(db, x.id)),
        ...money(db, "client_payments", "client_id = ? AND contract_id IS NULL", id),
      ];
    }
    case "suppliers": {
      const s = db.prepare(`SELECT name FROM suppliers WHERE id = ? AND ${live}`).get(id);
      if (!s) return [];
      const eq = db.prepare(`SELECT id FROM equipment WHERE supplier_id = ? AND ${live}`).all(id);
      return [
        { table: "suppliers", id, label: s.name },
        ...eq.flatMap((e: any) => targetsOf(db, "equipment", e.id)),
        ...money(db, "supplier_payments", "supplier_id = ? AND contract_id IS NULL", id),
        ...money(db, "supplier_deductions", "supplier_id = ? AND contract_id IS NULL", id),
      ];
    }
    case "investors": {
      const i = db.prepare(`SELECT name FROM investors WHERE id = ? AND ${live}`).get(id);
      if (!i) return [];
      return [{ table: "investors", id, label: `المستثمر ${i.name}` }, ...money(db, "capital_movements", "investor_id = ?", id), ...money(db, "profit_payouts", "investor_id = ?", id)];
    }
    case "expense_categories": {
      const c = db.prepare(`SELECT name FROM expense_categories WHERE id = ? AND ${live}`).get(id);
      return c ? [{ table: "expense_categories", id, label: `نوع المصروف ${c.name}` }] : [];
    }
  }
  return [];
}

const MONTHS = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
const monthName = (m: string) => `${MONTHS[+m.slice(5, 7) - 1]} ${m.slice(0, 4)}`;

/** What the confirmation dialog shows: "هتحذف كذا وكذا — موافق؟" */
export function deletePreview(db: Db, entity: Deletable, id: number) {
  const targets = targetsOf(db, entity, id);
  if (!targets.length) throw new UserError("الحاجة دي مش موجودة أو اتحذفت قبل كده");
  const closed = new Set(db.prepare("SELECT month FROM month_closes").all().map((r: any) => r.month));
  const lockedMonths = [...new Set(targets.filter((t) => t.date && closed.has(t.date.slice(0, 7))).map((t) => t.date!.slice(0, 7)))].sort();
  return {
    items: targets.map((t) => t.label).filter(Boolean),
    count: targets.length,
    blocked: lockedMonths.length ? `فيه حاجات في شهر مقفول (${lockedMonths.map(monthName).join("، ")}) — مينفعش تتحذف. اعمل تسوية بدل كده.` : null,
  };
}

/** Deletes after the user confirmed the preview. Returns the batch id used to restore it. */
export function deleteEntity(db: Db, entity: Deletable, id: number, reason = "حذف من البرنامج") {
  const preview = deletePreview(db, entity, id);
  if (preview.blocked) throw new UserError(preview.blocked);
  const batch = `${new Date().toISOString()}#${Math.random().toString(36).slice(2, 8)}`;
  db.transaction(() => {
    for (const t of targetsOf(db, entity, id)) {
      db.prepare(`UPDATE ${t.table} SET deleted_at = ?, delete_reason = ? WHERE id = ? AND deleted_at IS NULL`).run(batch, reason, t.id);
      if (MONEY_TABLES.includes(t.table))
        db.prepare("UPDATE treasury_entries SET deleted_at = ?, delete_reason = ? WHERE source_table = ? AND source_id = ? AND deleted_at IS NULL").run(batch, reason, t.table, t.id);
    }
  })();
  return batch;
}

const ALL_TABLES = [...MONEY_TABLES, "treasury_entries", "work_logs", "contracts", "equipment", "clients", "suppliers", "investors", "expense_categories"];

/** Undo a delete (from the activity log or the undo bar). */
export function restoreDeleted(db: Db, batch: string) {
  db.transaction(() => {
    let n = 0;
    try {
      for (const t of ALL_TABLES) n += db.prepare(`UPDATE ${t} SET deleted_at = NULL, delete_reason = NULL WHERE deleted_at = ?`).run(batch).changes;
    } catch (err) {
      if (String((err as Error).message).includes("UNIQUE")) throw new UserError("فيه حاجة تانية دلوقتي بنفس الاسم أو نفس اليوم — غيّرها الأول");
      throw err;
    }
    if (!n) throw new UserError("مفيش حاجة محذوفة بالرقم ده");
  })();
}
