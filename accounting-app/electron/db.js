const path = require("path");
const fs = require("fs");
const { app } = require("electron");
const Database = require("better-sqlite3");

// Full schema per the documented data model (doc section 13). Phase 2 wires
// up CRUD for the "settings" entities (equipment, partners, employees,
// contractors, expense categories); the remaining tables exist now so later
// phases don't need migrations.
const SCHEMA = `
CREATE TABLE IF NOT EXISTS partners (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS equipment (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS equipment_partner_shares (
  equipment_id INTEGER NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
  partner_id INTEGER NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  percentage REAL NOT NULL,
  PRIMARY KEY (equipment_id, partner_id)
);

CREATE TABLE IF NOT EXISTS employees (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  wage_type TEXT NOT NULL CHECK (wage_type IN ('daily', 'monthly')),
  rate REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS employee_advances (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  amount REAL NOT NULL,
  note TEXT
);

CREATE TABLE IF NOT EXISTS contractors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS contractor_payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  contractor_id INTEGER NOT NULL REFERENCES contractors(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  amount REAL NOT NULL,
  method TEXT,
  note TEXT
);

CREATE TABLE IF NOT EXISTS expense_categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS daily_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  equipment_id INTEGER NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('driver', 'contractor', 'market')),
  person_name TEXT NOT NULL,
  actual_hours REAL,
  base_hours REAL,
  day_rate REAL,
  fixed_value REAL
);

CREATE TABLE IF NOT EXISTS hassan_ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('loan', 'repayment', 'due', 'collection')),
  amount REAL NOT NULL,
  party_name TEXT,
  description TEXT,
  note TEXT
);

CREATE TABLE IF NOT EXISTS partner_payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  partner_id INTEGER NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  amount REAL NOT NULL,
  method TEXT,
  note TEXT
);

CREATE TABLE IF NOT EXISTS monthly_expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  equipment_id INTEGER NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
  month TEXT NOT NULL,
  category_id INTEGER REFERENCES expense_categories(id),
  amount REAL NOT NULL,
  payment_method TEXT
);

CREATE TABLE IF NOT EXISTS treasury_accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE CHECK (name IN ('wallet', 'instapay', 'cash')),
  current_balance REAL NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS suppliers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS supplier_purchases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  supplier_id INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  description TEXT,
  amount REAL NOT NULL,
  note TEXT
);

CREATE TABLE IF NOT EXISTS supplier_payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  supplier_id INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  amount REAL NOT NULL,
  method TEXT,
  note TEXT
);
`;

function initDatabase() {
  const userDataDir = app.getPath("userData");
  if (!fs.existsSync(userDataDir)) fs.mkdirSync(userDataDir, { recursive: true });

  const dbPath = path.join(userDataDir, "al-bunyan.db");
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(SCHEMA);

  const accountCount = db.prepare("SELECT COUNT(*) AS c FROM treasury_accounts").get().c;
  if (accountCount === 0) {
    const insertAccount = db.prepare(
      "INSERT INTO treasury_accounts (name, current_balance) VALUES (?, 0)"
    );
    insertAccount.run("wallet");
    insertAccount.run("instapay");
    insertAccount.run("cash");
  }

  return db;
}

module.exports = { initDatabase };
