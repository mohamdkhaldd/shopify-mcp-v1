import { Db, UserError } from "../db";

// سجل التعديلات + التراجع. Every write the user makes runs inside runAction():
// the audit triggers tag each row they log with the action's id, so one
// "تراجع" puts back everything that action changed (a sarki day and the owner's
// copy of it, a payment and its treasury entry, a delete and all it took along).
// Undo never deletes: what was added is hidden (deleted_at), what was changed
// gets its old values back. Closed months stay locked.

const newId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const SOFT_DELETE_TABLES = new Set([
  "client_payments",
  "supplier_payments",
  "supplier_deductions",
  "expenses",
  "capital_movements",
  "profit_payouts",
  "tax_payments",
  "treasury_entries",
  "work_logs",
  "contracts",
  "equipment",
  "clients",
  "suppliers",
  "investors",
  "expense_categories",
]);

export function runAction<T>(db: Db, label: string, fn: () => T): { value: T; actionId: string } {
  const id = newId();
  const value = db.transaction(() => {
    db.prepare("INSERT INTO actions (id, label) VALUES (?, ?)").run(id, label);
    db.prepare("INSERT INTO app_settings (key, value) VALUES ('current_action', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(id);
    try {
      return fn();
    } finally {
      db.prepare("DELETE FROM app_settings WHERE key = 'current_action'").run();
    }
  })();
  // a call that changed nothing leaves no trace in the log
  if (!db.prepare("SELECT 1 FROM audit_log WHERE action_id = ? LIMIT 1").get(id)) db.prepare("DELETE FROM actions WHERE id = ?").run(id);
  return { value, actionId: id };
}

const columns = (db: Db, t: string) => (db.prepare(`PRAGMA table_info(${t})`).all() as { name: string }[]).map((c) => c.name);

export function undoAction(db: Db, actionId: string) {
  const action = db.prepare("SELECT * FROM actions WHERE id = ?").get(actionId);
  if (!action) throw new UserError("التعديل ده مش موجود");
  if (action.undone) throw new UserError("التعديل ده اترجع قبل كده");
  if (action.undo_of) throw new UserError("ده تراجع — لو عايز ترجّع اللي اتعمل، اعمله تاني");
  const rows = db.prepare("SELECT * FROM audit_log WHERE action_id = ? AND undone = 0 ORDER BY id DESC").all(actionId) as {
    id: number;
    tbl: string;
    row_id: number;
    op: "insert" | "update" | "delete";
    before_json: string | null;
  }[];
  if (!rows.length) throw new UserError("مفيش حاجة تترجع");
  return runAction(db, `تراجع: ${action.label}`, () => {
    for (const r of rows) {
      if (r.op === "insert") {
        if (!SOFT_DELETE_TABLES.has(r.tbl)) throw new UserError("الحاجة دي مينفعش تترجع (قفل شهر / تسوية / تغيير نسبة)");
        db.prepare(`UPDATE ${r.tbl} SET deleted_at = ?, delete_reason = 'تراجع' WHERE id = ? AND deleted_at IS NULL`).run(`undo:${actionId}`, r.row_id);
      } else if (r.op === "update") {
        const before = JSON.parse(r.before_json ?? "{}") as Record<string, unknown>;
        const cols = columns(db, r.tbl).filter((c) => c !== "id" && c in before);
        db.prepare(`UPDATE ${r.tbl} SET ${cols.map((c) => `${c} = @${c}`).join(", ")} WHERE id = @__id`).run({ ...Object.fromEntries(cols.map((c) => [c, before[c]])), __id: r.row_id });
      } else {
        throw new UserError("الحاجة دي مينفعش تترجع");
      }
    }
    db.prepare("UPDATE audit_log SET undone = 1 WHERE action_id = ?").run(actionId);
    db.prepare("UPDATE actions SET undone = 1 WHERE id = ?").run(actionId);
    db.prepare("UPDATE actions SET undo_of = ? WHERE id = (SELECT value FROM app_settings WHERE key = 'current_action')").run(actionId);
  });
}

export function activityView(db: Db, f: { from?: string; to?: string; limit?: number } = {}) {
  const where: string[] = [];
  const p: unknown[] = [];
  if (f.from) {
    where.push("a.at >= ?");
    p.push(f.from);
  }
  if (f.to) {
    where.push("a.at < ?");
    p.push(`${f.to}T99`);
  }
  const rows = db
    .prepare(
      `SELECT a.id, a.at, a.label, a.undone, a.undo_of,
         (SELECT COUNT(*) FROM audit_log l WHERE l.action_id = a.id) AS changes,
         (SELECT COUNT(*) FROM audit_log l WHERE l.action_id = a.id AND l.op = 'insert' AND l.tbl IN ('month_closes', 'adjustments', 'rate_settings', 'invoices')) AS locked
       FROM actions a ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY a.at DESC, a.rowid DESC LIMIT ?`,
    )
    .all(...p, f.limit ?? 300) as { id: string; at: string; label: string; undone: number; undo_of: string | null; changes: number; locked: number }[];
  return rows.map((r) => ({ ...r, undone: !!r.undone, canUndo: !r.undone && !r.undo_of && !r.locked && r.changes > 0 }));
}

export type ActivityView = ReturnType<typeof activityView>;
