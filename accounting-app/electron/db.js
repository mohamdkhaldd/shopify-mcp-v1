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
  name TEXT NOT NULL UNIQUE,
  opening_balance REAL NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS equipment (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  purchase_price REAL NOT NULL DEFAULT 0
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
  rate REAL NOT NULL,
  fixed_salary INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS employee_advances (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  amount REAL NOT NULL,
  payment_method TEXT NOT NULL DEFAULT 'cash' CHECK (payment_method IN ('wallet', 'instapay', 'cash')),
  note TEXT
);

CREATE TABLE IF NOT EXISTS employee_bonuses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  amount REAL NOT NULL,
  payment_method TEXT NOT NULL DEFAULT 'cash' CHECK (payment_method IN ('wallet', 'instapay', 'cash')),
  note TEXT
);

CREATE TABLE IF NOT EXISTS contractors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  opening_balance REAL NOT NULL DEFAULT 0
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
  is_paid_leave INTEGER NOT NULL DEFAULT 0,
  fixed_value REAL,
  hassan_commission REAL,
  UNIQUE (equipment_id, date, role)
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
  date TEXT,
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

CREATE TABLE IF NOT EXISTS waste_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  amount REAL NOT NULL,
  payment_method TEXT,
  note TEXT
);

CREATE TABLE IF NOT EXISTS salary_payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  month TEXT NOT NULL DEFAULT '',
  date TEXT NOT NULL,
  amount REAL NOT NULL,
  payment_method TEXT NOT NULL DEFAULT 'cash' CHECK (payment_method IN ('wallet', 'instapay', 'cash')),
  note TEXT
);
`;

// Real starting data pulled from the company's existing Excel system, so the
// app opens already reflecting how the business actually operates instead
// of an empty shell. Everything here remains editable from the Settings page.
// Only the reference/master lists are seeded — daily logs, expenses,
// advances and every other transactional table always start empty.
const SEED_PARTNERS = ["الحج رمضان", "أبو طارق", "أبو أدهم", "مصطفى علي", "د. حازم", "محمد رمضان"];

const SEED_EQUIPMENT = [
  { name: "مان لفت 42", shares: [["الحج رمضان", 12.5], ["أبو طارق", 29.17], ["أبو أدهم", 58.33]] },
  { name: "مان لفت 28 أزرق", shares: [["أبو أدهم", 50], ["الحج رمضان", 25], ["أبو طارق", 25]] },
  { name: "مان لفت 28 أصفر", shares: [["الحج رمضان", 25], ["مصطفى علي", 75]] },
  { name: "بوكيت أزرق", shares: [["الحج رمضان", 33.33], ["أبو طارق", 33.33], ["أبو أدهم", 33.34]] },
  { name: "بوكيت أوتوماتيك", shares: [["مصطفى علي", 50], ["الحج رمضان", 50]] },
  { name: "بوكيت ميتسوبيشي", shares: [["الحج رمضان", 50], ["مصطفى علي", 50]] },
  { name: "بوكيت أخضر", shares: [["الحج رمضان", 50], ["أبو طارق", 50]] },
  { name: "بوكيت كامل", shares: [["د. حازم", 100]] },
  { name: "ونش 5 طن دبوسة", shares: [["الحج رمضان", 33.33], ["محمد رمضان", 33.33], ["أبو طارق", 33.34]] },
  { name: "ونش 3 وصلة", shares: [["الحج رمضان", 33.33], ["أبو طارق", 33.33], ["أبو أدهم", 33.34]] },
];

// العمود الرابع (fixed_salary) بيبقى true بس لموظف شهري مرتبه ثابت مهما
// حصل (زي المكنيكي) — مش مرتبط بحضوره في السركي زي السواقين الشهريين.
const SEED_EMPLOYEES = [
  ["سيد حسين", "daily", 600, false],
  ["أشرف", "daily", 550, false],
  ["فتحي", "daily", 500, false],
  ["محمد الصياد", "daily", 500, false],
  ["أسامة علي", "daily", 475, false],
  ["أبو نسمة", "daily", 400, false],
  ["محمود", "daily", 400, false],
  ["خالد", "daily", 375, false],
  ["بدري", "daily", 375, false],
  ["فكري", "daily", 375, false],
  ["عبدالله", "daily", 500, false],
  ["التربو", "monthly", 12000, true],
];

const SEED_CONTRACTORS = ["محمد حماد", "حسام مرزوق", "مصطفى عثمان", "عثمان معتمد", "محمود عبد الكريم", "سوق"];

const SEED_EXPENSE_CATEGORIES = [
  "زيت", "صيانة", "مكنيكي", "راتب سائق", "سكن", "سولار", "كارتة", "مواصلات", "قطع غيار", "شهادة معايرة", "زيت هيدروليك",
];

function seedIfEmpty(db) {
  const equipmentCount = db.prepare("SELECT COUNT(*) AS c FROM equipment").get().c;
  if (equipmentCount > 0) return;

  const insertPartner = db.prepare("INSERT INTO partners (name) VALUES (?)");
  const insertEquipment = db.prepare("INSERT INTO equipment (name) VALUES (?)");
  const insertShare = db.prepare(
    "INSERT INTO equipment_partner_shares (equipment_id, partner_id, percentage) VALUES (?, ?, ?)"
  );
  const insertEmployee = db.prepare(
    "INSERT INTO employees (name, wage_type, rate, fixed_salary) VALUES (?, ?, ?, ?)"
  );
  const insertContractor = db.prepare("INSERT INTO contractors (name) VALUES (?)");
  const insertCategory = db.prepare("INSERT INTO expense_categories (name) VALUES (?)");

  const seed = db.transaction(() => {
    const partnerIds = {};
    for (const name of SEED_PARTNERS) {
      partnerIds[name] = insertPartner.run(name).lastInsertRowid;
    }

    for (const equipment of SEED_EQUIPMENT) {
      const equipmentId = insertEquipment.run(equipment.name).lastInsertRowid;
      for (const [partnerName, percentage] of equipment.shares) {
        insertShare.run(equipmentId, partnerIds[partnerName], percentage);
      }
    }

    for (const [name, wageType, rate, fixedSalary] of SEED_EMPLOYEES) {
      insertEmployee.run(name, wageType, rate, fixedSalary ? 1 : 0);
    }

    for (const name of SEED_CONTRACTORS) {
      insertContractor.run(name);
    }

    for (const name of SEED_EXPENSE_CATEGORIES) {
      insertCategory.run(name);
    }
  });

  seed();
}

function initDatabase() {
  const userDataDir = app.getPath("userData");
  if (!fs.existsSync(userDataDir)) fs.mkdirSync(userDataDir, { recursive: true });

  const dbPath = path.join(userDataDir, "al-bunyan.db");
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(SCHEMA);

  // Databases created before opening_balance existed need it added on top —
  // CREATE TABLE IF NOT EXISTS above only applies to brand-new databases.
  for (const table of ["contractors", "partners"]) {
    const hasColumn = db
      .prepare(`PRAGMA table_info(${table})`)
      .all()
      .some((col) => col.name === "opening_balance");
    if (!hasColumn) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN opening_balance REAL NOT NULL DEFAULT 0`);
    }
  }

  const dailyLogsHasPaidLeave = db
    .prepare("PRAGMA table_info(daily_logs)")
    .all()
    .some((col) => col.name === "is_paid_leave");
  if (!dailyLogsHasPaidLeave) {
    db.exec("ALTER TABLE daily_logs ADD COLUMN is_paid_leave INTEGER NOT NULL DEFAULT 0");
  }

  const employeesHasFixedSalary = db
    .prepare("PRAGMA table_info(employees)")
    .all()
    .some((col) => col.name === "fixed_salary");
  if (!employeesHasFixedSalary) {
    db.exec("ALTER TABLE employees ADD COLUMN fixed_salary INTEGER NOT NULL DEFAULT 0");
  }

  const monthlyExpensesHasDate = db
    .prepare("PRAGMA table_info(monthly_expenses)")
    .all()
    .some((col) => col.name === "date");
  if (!monthlyExpensesHasDate) {
    db.exec("ALTER TABLE monthly_expenses ADD COLUMN date TEXT");
  }

  const equipmentHasPurchasePrice = db
    .prepare("PRAGMA table_info(equipment)")
    .all()
    .some((col) => col.name === "purchase_price");
  if (!equipmentHasPurchasePrice) {
    db.exec("ALTER TABLE equipment ADD COLUMN purchase_price REAL NOT NULL DEFAULT 0");
  }

  // month = أي شهر مرتب الدفعة دي بتقفل (زي يونيو)، date = تاريخ الدفع الحقيقي
  // (ممكن يكون في يوليو لو الدفع اتأخر) — لازم يتفصلوا عشان شيت الرواتب يحسبها
  // على الشهر الصح، وشيت الصادر يحسبها على تاريخها الحقيقي.
  const salaryPaymentsHasMonth = db
    .prepare("PRAGMA table_info(salary_payments)")
    .all()
    .some((col) => col.name === "month");
  if (!salaryPaymentsHasMonth) {
    db.exec("ALTER TABLE salary_payments ADD COLUMN month TEXT NOT NULL DEFAULT ''");
  }

  const accountCount = db.prepare("SELECT COUNT(*) AS c FROM treasury_accounts").get().c;
  if (accountCount === 0) {
    const insertAccount = db.prepare(
      "INSERT INTO treasury_accounts (name, current_balance) VALUES (?, 0)"
    );
    insertAccount.run("wallet");
    insertAccount.run("instapay");
    insertAccount.run("cash");
  }

  seedIfEmpty(db);

  return db;
}

module.exports = { initDatabase };
