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

-- بيسجل تاريخ الأجر/نوعه لكل موظف بدل ما يبقى رقم واحد بس — أي شهر بيتحسب
-- بياخد السطر الساري وقتها (effective_month <= الشهر، أحدث واحد)، فتعديل
-- المرتب دلوقتي مبيغيرش حساب الشهور اللي فاتت خالص.
CREATE TABLE IF NOT EXISTS employee_rate_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  effective_month TEXT NOT NULL,
  wage_type TEXT NOT NULL CHECK (wage_type IN ('daily', 'monthly')),
  rate REAL NOT NULL,
  fixed_salary INTEGER NOT NULL DEFAULT 0,
  UNIQUE (employee_id, effective_month)
);

CREATE TABLE IF NOT EXISTS employee_advances (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  month TEXT NOT NULL DEFAULT '',
  date TEXT NOT NULL,
  amount REAL NOT NULL,
  payment_method TEXT NOT NULL DEFAULT 'cash',
  note TEXT
);

CREATE TABLE IF NOT EXISTS employee_bonuses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  month TEXT NOT NULL DEFAULT '',
  date TEXT NOT NULL,
  amount REAL NOT NULL,
  payment_method TEXT NOT NULL DEFAULT 'cash',
  note TEXT
);

-- خصم من صافي المرتب المستحق (زي غرامة تأخير أو تلفية) — مفيش فلوس بتتحرك
-- فعليًا زي السلفة، فمالوش أثر في الصادر ولا الخزنة، وبس بيقلل الباقي.
CREATE TABLE IF NOT EXISTS employee_deductions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  month TEXT NOT NULL DEFAULT '',
  date TEXT NOT NULL,
  amount REAL NOT NULL,
  reason TEXT NOT NULL
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
  name TEXT NOT NULL UNIQUE,
  counts_as_commission INTEGER NOT NULL DEFAULT 0
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
  note TEXT,
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

-- فلوس حسن دفعها من خزنته الشخصية (اللي بتتغذى من الكوميشن) — زي قسط أو
-- إيجار. مالوش أي علاقة بخزنة الشركة (treasury_accounts).
CREATE TABLE IF NOT EXISTS hassan_treasury_expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  amount REAL NOT NULL,
  description TEXT NOT NULL
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
  payment_method TEXT,
  note TEXT,
  receipt_image TEXT
);

CREATE TABLE IF NOT EXISTS treasury_accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
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
  payment_method TEXT NOT NULL DEFAULT 'cash',
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

  const dailyLogsHasNote = db
    .prepare("PRAGMA table_info(daily_logs)")
    .all()
    .some((col) => col.name === "note");
  if (!dailyLogsHasNote) {
    db.exec("ALTER TABLE daily_logs ADD COLUMN note TEXT");
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

  const expenseCategoriesHasCommissionFlag = db
    .prepare("PRAGMA table_info(expense_categories)")
    .all()
    .some((col) => col.name === "counts_as_commission");
  if (!expenseCategoriesHasCommissionFlag) {
    db.exec("ALTER TABLE expense_categories ADD COLUMN counts_as_commission INTEGER NOT NULL DEFAULT 0");
  }

  const monthlyExpensesColumns = db.prepare("PRAGMA table_info(monthly_expenses)").all();
  if (!monthlyExpensesColumns.some((col) => col.name === "note")) {
    db.exec("ALTER TABLE monthly_expenses ADD COLUMN note TEXT");
  }
  if (!monthlyExpensesColumns.some((col) => col.name === "receipt_image")) {
    db.exec("ALTER TABLE monthly_expenses ADD COLUMN receipt_image TEXT");
  }

  const equipmentHasPurchasePrice = db
    .prepare("PRAGMA table_info(equipment)")
    .all()
    .some((col) => col.name === "purchase_price");
  if (!equipmentHasPurchasePrice) {
    db.exec("ALTER TABLE equipment ADD COLUMN purchase_price REAL NOT NULL DEFAULT 0");
  }

  // month = أي شهر مرتب الدفعة/السلفة/المكافأة دي بتخص (زي يونيو)، date = تاريخها
  // الحقيقي (ممكن يكون في يوليو لو اتأخرت) — لازم يتفصلوا عشان تحسب كلها على
  // شهرها الصح في كل مكان: شيت الرواتب، الصادر، الخزنة، ومصروف المعدة.
  for (const table of ["salary_payments", "employee_advances", "employee_bonuses"]) {
    const hasMonth = db
      .prepare(`PRAGMA table_info(${table})`)
      .all()
      .some((col) => col.name === "month");
    if (!hasMonth) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN month TEXT NOT NULL DEFAULT ''`);
    }
  }

  // كل موظف ملوش أي سطر تاريخ لسه (إما موظف قديم قبل ما الميزة دي تتعمل، أو
  // موظف جديد اتضاف من الإعدادات) بياخد سطر أساسي من "0000-01" بالقيم
  // الحالية بتاعته، عشان أي شهر (فات أو جاي) يفضل بيحسب صح لحد ما حد يعدّل
  // فعليًا من تاريخ معيّن.
  db.exec(`
    INSERT INTO employee_rate_history (employee_id, effective_month, wage_type, rate, fixed_salary)
    SELECT id, '0000-01', wage_type, rate, fixed_salary FROM employees
    WHERE id NOT IN (SELECT DISTINCT employee_id FROM employee_rate_history)
  `);

  // القيود القديمة كانت بتحصر وسيلة الدفع على wallet/instapay/cash بس — عشان
  // نضيف وسايل جديدة (زي فودفون كاش) من غير قيد تاني في المستقبل، لازم نشيل
  // القيد ده. SQLite ما بيدعمش تعديل CHECK مباشرة، فبنعيد بناء الجدول بنفس
  // بياناته بالظبط (مفيش أي داتا بتتفقد).
  function loosenPaymentMethodCheck(table) {
    const row = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name=?").get(table);
    if (!row || !row.sql.includes("CHECK (payment_method IN")) return;
    const tx = db.transaction(() => {
      db.exec(`ALTER TABLE ${table} RENAME TO ${table}_migrate_old`);
      db.exec(`
        CREATE TABLE ${table} (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
          month TEXT NOT NULL DEFAULT '',
          date TEXT NOT NULL,
          amount REAL NOT NULL,
          payment_method TEXT NOT NULL DEFAULT 'cash',
          note TEXT
        )
      `);
      db.exec(`
        INSERT INTO ${table} (id, employee_id, month, date, amount, payment_method, note)
        SELECT id, employee_id, month, date, amount, payment_method, note FROM ${table}_migrate_old
      `);
      db.exec(`DROP TABLE ${table}_migrate_old`);
    });
    tx();
  }
  for (const table of ["employee_advances", "employee_bonuses", "salary_payments"]) {
    loosenPaymentMethodCheck(table);
  }

  const treasuryAccountsRow = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='treasury_accounts'").get();
  if (treasuryAccountsRow && treasuryAccountsRow.sql.includes("CHECK (name IN")) {
    const tx = db.transaction(() => {
      db.exec("ALTER TABLE treasury_accounts RENAME TO treasury_accounts_migrate_old");
      db.exec(`
        CREATE TABLE treasury_accounts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE,
          current_balance REAL NOT NULL DEFAULT 0
        )
      `);
      db.exec(
        "INSERT INTO treasury_accounts (id, name, current_balance) SELECT id, name, current_balance FROM treasury_accounts_migrate_old"
      );
      db.exec("DROP TABLE treasury_accounts_migrate_old");
    });
    tx();
  }

  const accountCount = db.prepare("SELECT COUNT(*) AS c FROM treasury_accounts").get().c;
  if (accountCount === 0) {
    const insertAccount = db.prepare(
      "INSERT INTO treasury_accounts (name, current_balance) VALUES (?, 0)"
    );
    insertAccount.run("wallet");
    insertAccount.run("instapay");
    insertAccount.run("cash");
    insertAccount.run("vodafone_cash");
  }
  const hasVodafoneCash = db.prepare("SELECT COUNT(*) AS c FROM treasury_accounts WHERE name = 'vodafone_cash'").get().c;
  if (!hasVodafoneCash) {
    db.prepare("INSERT INTO treasury_accounts (name, current_balance) VALUES ('vodafone_cash', 0)").run();
  }

  seedIfEmpty(db);

  return db;
}

module.exports = { initDatabase };
