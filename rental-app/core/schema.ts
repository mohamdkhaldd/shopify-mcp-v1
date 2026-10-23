import { Db } from "./db";

// Money columns are INTEGER piasters, enforced with CHECK(typeof(x) = 'integer').
// Rows are never physically deleted: "حذف" in the app sets deleted_at (the row
// drops out of every list and total but can be restored), money rows can't be
// edited (only their note), and every change is written to audit_log.

const pt = (col: string, nullable = false) =>
  `${col} INTEGER${nullable ? "" : " NOT NULL"} CHECK (${col} IS NULL OR typeof(${col}) = 'integer')`;
const reversalCheck = "CHECK ((reversal_of IS NULL AND amount_pt > 0) OR (reversal_of IS NOT NULL AND amount_pt < 0))";

const DDL = `
CREATE TABLE IF NOT EXISTS app_settings (key TEXT PRIMARY KEY, value TEXT);

CREATE TABLE IF NOT EXISTS rate_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT NOT NULL CHECK (key IN ('vat', 'tax5', 'management_share', 'investors_share')),
  value_bp INTEGER NOT NULL CHECK (typeof(value_bp) = 'integer' AND value_bp BETWEEN 0 AND 10000),
  effective_from TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (key, effective_from)
);

CREATE TABLE IF NOT EXISTS investors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  phone TEXT,
  notes TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  deleted_at TEXT,
  delete_reason TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS suppliers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  phone TEXT,
  notes TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  deleted_at TEXT,
  delete_reason TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS clients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL CHECK (kind IN ('company', 'individual')),
  name TEXT NOT NULL,
  phone TEXT,
  tax_id TEXT,
  vat_applies INTEGER NOT NULL,
  tax5_applies INTEGER NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  deleted_at TEXT,
  delete_reason TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS equipment (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  supplier_id INTEGER NOT NULL REFERENCES suppliers(id),
  site_name TEXT,
  ${pt("supplier_rate_pt", true)},
  active INTEGER NOT NULL DEFAULT 1,
  deleted_at TEXT,
  delete_reason TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS contracts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  client_id INTEGER NOT NULL REFERENCES clients(id),
  equipment_id INTEGER NOT NULL REFERENCES equipment(id),
  supplier_id INTEGER NOT NULL REFERENCES suppliers(id),
  unit TEXT NOT NULL CHECK (unit IN ('day', 'month')),
  ${pt("client_rate_pt")},
  ${pt("supplier_rate_pt")},
  site_name TEXT,
  start_date TEXT NOT NULL,
  end_date TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'ended', 'cancelled')),
  notes TEXT,
  deleted_at TEXT,
  delete_reason TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- السركي: one row per day per sheet (client = سركي الشركة, supplier = سركي صاحب المعدة)
CREATE TABLE IF NOT EXISTS work_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  contract_id INTEGER NOT NULL REFERENCES contracts(id),
  date TEXT NOT NULL,
  side TEXT NOT NULL CHECK (side IN ('client', 'supplier')),
  is_day_off INTEGER NOT NULL DEFAULT 0,
  site_name TEXT,
  actual_hours_milli INTEGER CHECK (actual_hours_milli IS NULL OR (typeof(actual_hours_milli) = 'integer' AND actual_hours_milli >= 0)),
  base_hours_milli INTEGER NOT NULL DEFAULT 8000 CHECK (typeof(base_hours_milli) = 'integer' AND base_hours_milli >= 0),
  ${pt("day_rate_pt", true)},
  ${pt("overtime_rate_pt", true)},
  note TEXT,
  deleted_at TEXT,
  delete_reason TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (contract_id, date, side)
);

CREATE TABLE IF NOT EXISTS client_payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL REFERENCES clients(id),
  contract_id INTEGER REFERENCES contracts(id),
  date TEXT NOT NULL,
  ${pt("amount_pt")},
  note TEXT,
  reversal_of INTEGER,
  deleted_at TEXT,
  delete_reason TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  ${reversalCheck}
);

CREATE TABLE IF NOT EXISTS supplier_payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  supplier_id INTEGER NOT NULL REFERENCES suppliers(id),
  contract_id INTEGER REFERENCES contracts(id),
  date TEXT NOT NULL,
  ${pt("amount_pt")},
  note TEXT,
  reversal_of INTEGER,
  deleted_at TEXT,
  delete_reason TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  ${reversalCheck}
);

-- things we paid on the supplier's behalf (fuel, repairs…), taken off what we owe him
CREATE TABLE IF NOT EXISTS supplier_deductions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  supplier_id INTEGER NOT NULL REFERENCES suppliers(id),
  contract_id INTEGER REFERENCES contracts(id),
  date TEXT NOT NULL,
  ${pt("amount_pt")},
  note TEXT,
  paid_from_treasury INTEGER NOT NULL DEFAULT 1,
  reversal_of INTEGER,
  deleted_at TEXT,
  delete_reason TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  ${reversalCheck}
);

CREATE TABLE IF NOT EXISTS expense_categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  deleted_at TEXT,
  delete_reason TEXT
);

CREATE TABLE IF NOT EXISTS expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL CHECK (kind IN ('contract', 'general')),
  contract_id INTEGER REFERENCES contracts(id),
  category_id INTEGER REFERENCES expense_categories(id),
  date TEXT NOT NULL,
  ${pt("amount_pt")},
  note TEXT,
  reversal_of INTEGER,
  deleted_at TEXT,
  delete_reason TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  ${reversalCheck},
  CHECK ((kind = 'contract') = (contract_id IS NOT NULL))
);

CREATE TABLE IF NOT EXISTS capital_movements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  investor_id INTEGER NOT NULL REFERENCES investors(id),
  kind TEXT NOT NULL CHECK (kind IN ('deposit', 'withdrawal')),
  date TEXT NOT NULL,
  ${pt("amount_pt")},
  note TEXT,
  reversal_of INTEGER,
  deleted_at TEXT,
  delete_reason TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  ${reversalCheck}
);

CREATE TABLE IF NOT EXISTS profit_payouts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  payee_kind TEXT NOT NULL CHECK (payee_kind IN ('investor', 'management')),
  investor_id INTEGER REFERENCES investors(id),
  date TEXT NOT NULL,
  ${pt("amount_pt")},
  note TEXT,
  reversal_of INTEGER,
  deleted_at TEXT,
  delete_reason TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  ${reversalCheck},
  CHECK ((payee_kind = 'investor') = (investor_id IS NOT NULL))
);

CREATE TABLE IF NOT EXISTS tax_payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tax TEXT NOT NULL CHECK (tax IN ('vat', 'tax5')),
  period_month TEXT,
  date TEXT NOT NULL,
  ${pt("amount_pt")},
  receipt_no TEXT,
  note TEXT,
  reversal_of INTEGER,
  deleted_at TEXT,
  delete_reason TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  ${reversalCheck}
);

-- every pound in or out, linked to the row that caused it
CREATE TABLE IF NOT EXISTS treasury_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('in', 'out')),
  ${pt("amount_pt")},
  type TEXT NOT NULL CHECK (type IN ('investor_deposit', 'investor_withdrawal', 'client_collection', 'supplier_payment',
    'supplier_deduction', 'expense', 'tax_payment', 'profit_payout')),
  source_table TEXT NOT NULL,
  source_id INTEGER NOT NULL,
  party_kind TEXT,
  party_id INTEGER,
  note TEXT,
  deleted_at TEXT,
  delete_reason TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (amount_pt <> 0)
);

-- corrections to a closed month, booked in an open month
CREATE TABLE IF NOT EXISTS adjustments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  applied_month TEXT NOT NULL,
  target_month TEXT NOT NULL,
  contract_id INTEGER NOT NULL REFERENCES contracts(id),
  kind TEXT NOT NULL CHECK (kind IN ('client_base', 'supplier_cost')),
  ${pt("amount_pt")},
  reason TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (amount_pt <> 0)
);

CREATE TABLE IF NOT EXISTS month_closes (
  month TEXT PRIMARY KEY,
  closed_at TEXT NOT NULL DEFAULT (datetime('now')),
  snapshot_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS invoices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  serial TEXT NOT NULL UNIQUE,
  contract_id INTEGER NOT NULL REFERENCES contracts(id),
  month TEXT NOT NULL,
  ${pt("base_pt")},
  ${pt("vat_pt")},
  ${pt("total_pt")},
  issued_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (contract_id, month)
);

CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  tbl TEXT NOT NULL,
  row_id INTEGER,
  op TEXT NOT NULL CHECK (op IN ('insert', 'update', 'delete')),
  before_json TEXT,
  after_json TEXT,
  action_id TEXT,
  undone INTEGER NOT NULL DEFAULT 0
);

-- one row per thing the user did (a save, a payment, a delete…): the audit rows
-- it produced share its id, so "تراجع" undoes the whole action at once
CREATE TABLE IF NOT EXISTS actions (
  id TEXT PRIMARY KEY,
  at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  label TEXT NOT NULL,
  undone INTEGER NOT NULL DEFAULT 0,
  undo_of TEXT
);

-- names only need to be unique among rows that weren't deleted
CREATE UNIQUE INDEX IF NOT EXISTS ux_investors_name ON investors (name) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_suppliers_name ON suppliers (name) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_clients_name ON clients (name) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_expense_categories_name ON expense_categories (name) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS ix_work_logs_contract_date ON work_logs (contract_id, date);
CREATE INDEX IF NOT EXISTS ix_treasury_date ON treasury_entries (date);
CREATE INDEX IF NOT EXISTS ix_audit_at ON audit_log (at);
`;

/** Rows that hold money: append-only (only `note` may be corrected). */
export const FINANCIAL_TABLES = [
  "client_payments",
  "supplier_payments",
  "supplier_deductions",
  "expenses",
  "capital_movements",
  "profit_payouts",
  "tax_payments",
  "treasury_entries",
  "adjustments",
  "invoices",
  "month_closes",
];

/** Tables whose rows carry a `date` and must not change inside a closed month. */
const DATED_TABLES = [
  "work_logs",
  "client_payments",
  "supplier_payments",
  "supplier_deductions",
  "expenses",
  "capital_movements",
  "profit_payouts",
  "tax_payments",
  "treasury_entries",
];

const REVERSIBLE_TABLES = [
  "client_payments",
  "supplier_payments",
  "supplier_deductions",
  "expenses",
  "capital_movements",
  "profit_payouts",
  "tax_payments",
];

export const DEFAULT_RATES: Record<string, number> = {
  vat: 1400,
  tax5: 500,
  management_share: 5000,
  investors_share: 5000,
};

const columnsOf = (db: Db, t: string): string[] => db.prepare(`PRAGMA table_info(${t})`).all().map((c: any) => c.name);

function installGuards(db: Db) {
  const closed = (expr: string) => `EXISTS (SELECT 1 FROM month_closes WHERE month = substr(${expr}, 1, 7))`;
  // true when an UPDATE changes more than the sync engine's global row id (gid)
  const realChange = (t: string) =>
    columnsOf(db, t)
      .filter((c) => c !== "gid")
      .map((c) => `NEW.${c} IS NOT OLD.${c}`)
      .join(" OR ");
  for (const t of DATED_TABLES) {
    db.exec(`
      DROP TRIGGER IF EXISTS lock_ins_${t};
      CREATE TRIGGER lock_ins_${t} BEFORE INSERT ON ${t} WHEN ${closed("NEW.date")}
      BEGIN SELECT RAISE(ABORT, 'الشهر ده اتقفل — التصحيح بيتعمل بتسوية في شهر مفتوح'); END;
      DROP TRIGGER IF EXISTS lock_upd_${t};
      CREATE TRIGGER lock_upd_${t} BEFORE UPDATE ON ${t} WHEN (${closed("OLD.date")} OR ${closed("NEW.date")}) AND (${realChange(t)})
      BEGIN SELECT RAISE(ABORT, 'الشهر ده اتقفل — التصحيح بيتعمل بتسوية في شهر مفتوح'); END;
    `);
  }
  db.exec(`
    DROP TRIGGER IF EXISTS lock_ins_adjustments;
    CREATE TRIGGER lock_ins_adjustments BEFORE INSERT ON adjustments WHEN EXISTS (SELECT 1 FROM month_closes WHERE month = NEW.applied_month)
    BEGIN SELECT RAISE(ABORT, 'التسوية لازم تتسجل في شهر مفتوح'); END;
  `);
  for (const t of FINANCIAL_TABLES) {
    const changed = columnsOf(db, t)
      .filter((c) => !["note", "deleted_at", "delete_reason", "gid"].includes(c)) // gid: the sync engine's global row id
      .map((c) => `NEW.${c} IS NOT OLD.${c}`)
      .join(" OR ");
    db.exec(`
      DROP TRIGGER IF EXISTS immutable_${t};
      CREATE TRIGGER immutable_${t} BEFORE UPDATE ON ${t} WHEN ${changed}
      BEGIN SELECT RAISE(ABORT, 'الحركات المالية مبتتعدلش — اعمل إلغاء (حركة عكسية) وسجّل الصح'); END;
    `);
  }
  // a percentage change can only start in an open month, and is never edited afterwards
  db.exec(`
    DROP TRIGGER IF EXISTS lock_ins_rate_settings;
    CREATE TRIGGER lock_ins_rate_settings BEFORE INSERT ON rate_settings WHEN ${closed("NEW.effective_from")}
    BEGIN SELECT RAISE(ABORT, 'مينفعش تغيّر نسبة في شهر اتقفل'); END;
    DROP TRIGGER IF EXISTS immutable_rate_settings;
    CREATE TRIGGER immutable_rate_settings BEFORE UPDATE ON rate_settings WHEN ${realChange("rate_settings")}
    BEGIN SELECT RAISE(ABORT, 'النسب مبتتعدلش — ضيف نسبة جديدة بتاريخ سريان جديد'); END;
  `);
  for (const t of REVERSIBLE_TABLES) {
    db.exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS ux_${t}_reversal ON ${t}(reversal_of) WHERE reversal_of IS NOT NULL;
      DROP TRIGGER IF EXISTS reversal_${t};
      CREATE TRIGGER reversal_${t} BEFORE INSERT ON ${t} WHEN NEW.reversal_of IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM ${t} o WHERE o.id = NEW.reversal_of AND o.reversal_of IS NULL AND o.amount_pt = -NEW.amount_pt)
      BEGIN SELECT RAISE(ABORT, 'الإلغاء لازم يبقى بنفس مبلغ الحركة الأصلية'); END;
    `);
  }
}

function installNoDelete(db: Db, tables: string[]) {
  for (const t of tables) {
    db.exec(`
      DROP TRIGGER IF EXISTS nodelete_${t};
      CREATE TRIGGER nodelete_${t} BEFORE DELETE ON ${t}
      BEGIN SELECT RAISE(ABORT, 'مفيش مسح في البرنامج ده — الإلغاء بيبقى بحركة عكسية أو بإيقاف'); END;
    `);
  }
}

// Same idea as the old app's sync triggers: a JSON snapshot of the row before
// and after every change, so the activity log can describe and undo it.
const ACTION = "(SELECT value FROM app_settings WHERE key = 'current_action')";

function installAudit(db: Db, tables: string[]) {
  for (const t of tables) {
    const cols = columnsOf(db, t).filter((c) => c !== "gid");
    // the sync engine stamping a row's gid is not a user change: never logged, never undone
    const changed = cols.map((c) => `NEW.${c} IS NOT OLD.${c}`).join(" OR ");
    const json = (p: "NEW" | "OLD") => `json_object(${cols.map((c) => `'${c}', ${p}.${c}`).join(", ")})`;
    db.exec(`
      DROP TRIGGER IF EXISTS audit_ins_${t};
      CREATE TRIGGER audit_ins_${t} AFTER INSERT ON ${t}
      BEGIN INSERT INTO audit_log (tbl, row_id, op, after_json, action_id) VALUES ('${t}', NEW.rowid, 'insert', ${json("NEW")}, ${ACTION}); END;
      DROP TRIGGER IF EXISTS audit_upd_${t};
      CREATE TRIGGER audit_upd_${t} AFTER UPDATE ON ${t} WHEN ${changed}
      BEGIN INSERT INTO audit_log (tbl, row_id, op, before_json, after_json, action_id) VALUES ('${t}', NEW.rowid, 'update', ${json("OLD")}, ${json("NEW")}, ${ACTION}); END;
      DROP TRIGGER IF EXISTS audit_del_${t};
      CREATE TRIGGER audit_del_${t} AFTER DELETE ON ${t}
      BEGIN INSERT INTO audit_log (tbl, row_id, op, before_json, action_id) VALUES ('${t}', OLD.rowid, 'delete', ${json("OLD")}, ${ACTION}); END;
    `);
  }
}

export const SCHEMA_VERSION = 1;

export function setupDatabase(db: Db): Db {
  db.exec("PRAGMA foreign_keys = ON");
  db.exec(DDL);
  const business = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE 'sync_%' AND name NOT IN ('audit_log', 'app_settings', 'actions', 'activity_log')")
    .all()
    .map((r: any) => r.name as string);
  installGuards(db);
  installNoDelete(db, business);
  installAudit(db, business);
  const seed = db.prepare("INSERT OR IGNORE INTO rate_settings (key, value_bp, effective_from) VALUES (?, ?, '2000-01-01')");
  for (const [k, v] of Object.entries(DEFAULT_RATES)) seed.run(k, v);
  db.exec(`PRAGMA user_version = ${SCHEMA_VERSION}`);
  return db;
}
