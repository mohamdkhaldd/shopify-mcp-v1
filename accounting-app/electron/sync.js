const { createClient } = require("@supabase/supabase-js");
const { app } = require("electron");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const WebSocket = require("ws");

const SUPABASE_URL = "https://xpnkwmpzwvcfezimklwa.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhwbmt3bXB6d3ZjZmV6aW1rbHdhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYxODg2OTIsImV4cCI6MjEwMTc2NDY5Mn0.J76_zFG4UuycVYsG4rXbfkux1KUnACizTYbZ6JF7ZEA";
// حساب مخصص للاب بس، بيسجل دخول في الخلفية عشان يقدر يقرا تحت نفس نظام
// الحماية (RLS) اللي بيحمي بيانات الموبايل والشركاء.
const DESKTOP_EMAIL = "mkh@elbonyan.app";
const DESKTOP_PASSWORD = "mkh123";

const COLLECTIONS = [
  "partners",
  "contractors",
  "employees",
  "expense_categories",
  "equipment",
  "daily_logs",
  "monthly_expenses",
  "payroll_entries",
  "salary_payments",
  "hassan_ledger",
  "hassan_treasury_expenses",
  "waste_entries",
  "suppliers",
  "supplier_purchases",
  "supplier_payments",
  "contractor_payments",
  "partner_payments",
];

function findOrCreateEquipmentId(db, name) {
  const trimmed = (name || "").trim();
  if (!trimmed) return null;
  const existing = db.prepare("SELECT id FROM equipment WHERE name = ?").get(trimmed);
  if (existing) return existing.id;
  const info = db.prepare("INSERT INTO equipment (name, purchase_price) VALUES (?, 0)").run(trimmed);
  return info.lastInsertRowid;
}

function findOrCreatePartnerId(db, name) {
  const trimmed = (name || "").trim();
  if (!trimmed) return null;
  const existing = db.prepare("SELECT id FROM partners WHERE name = ?").get(trimmed);
  if (existing) return existing.id;
  const info = db.prepare("INSERT INTO partners (name, opening_balance) VALUES (?, 0)").run(trimmed);
  return info.lastInsertRowid;
}

function findOrCreateExpenseCategoryId(db, name) {
  const trimmed = (name || "").trim();
  if (!trimmed) return null;
  const existing = db.prepare("SELECT id FROM expense_categories WHERE name = ?").get(trimmed);
  if (existing) return existing.id;
  const info = db.prepare("INSERT INTO expense_categories (name, counts_as_commission) VALUES (?, 0)").run(trimmed);
  return info.lastInsertRowid;
}

function findEmployeeId(db, name) {
  const trimmed = (name || "").trim();
  if (!trimmed) return null;
  const row = db.prepare("SELECT id FROM employees WHERE name = ?").get(trimmed);
  return row ? row.id : null;
}

function findOrCreateSupplierId(db, name) {
  const trimmed = (name || "").trim();
  if (!trimmed) return null;
  const existing = db.prepare("SELECT id FROM suppliers WHERE name = ?").get(trimmed);
  if (existing) return existing.id;
  const info = db.prepare("INSERT INTO suppliers (name) VALUES (?)").run(trimmed);
  return info.lastInsertRowid;
}

function findOrCreateContractorId(db, name) {
  const trimmed = (name || "").trim();
  if (!trimmed) return null;
  const existing = db.prepare("SELECT id FROM contractors WHERE name = ?").get(trimmed);
  if (existing) return existing.id;
  const info = db.prepare("INSERT INTO contractors (name, opening_balance) VALUES (?, 0)").run(trimmed);
  return info.lastInsertRowid;
}

function mergePartner(db, data) {
  const name = (data.name || "").trim();
  if (!name) return;
  const openingBalance = Number(data.opening_balance) || 0;
  db.prepare(
    "INSERT INTO partners (name, opening_balance) VALUES (?, ?) ON CONFLICT(name) DO UPDATE SET opening_balance = excluded.opening_balance"
  ).run(name, openingBalance);
}

function mergeContractor(db, data) {
  const name = (data.name || "").trim();
  if (!name) return;
  const openingBalance = Number(data.opening_balance) || 0;
  db.prepare(
    "INSERT INTO contractors (name, opening_balance) VALUES (?, ?) ON CONFLICT(name) DO UPDATE SET opening_balance = excluded.opening_balance"
  ).run(name, openingBalance);
}

// لو data.old_name موجود وغير عن الاسم الجديد، ده معناه إعادة تسمية —
// بندور على الموظف بالاسم القديم عشان نعدّل نفس الصف، مش نعمل واحد جديد.
function mergeEmployee(db, data) {
  const name = (data.name || "").trim();
  if (!name) return;
  const oldName = (data.old_name || "").trim();
  const wageType = data.wage_type === "monthly" ? "monthly" : "daily";
  const rate = Number(data.rate) || 0;
  const fixedSalary = data.fixed_salary ? 1 : 0;
  const existing = db.prepare("SELECT * FROM employees WHERE name = ?").get(oldName || name);
  if (existing) {
    db.prepare("UPDATE employees SET name = ?, wage_type = ?, rate = ?, fixed_salary = ? WHERE id = ?").run(name, wageType, rate, fixedSalary, existing.id);
    if (existing.name !== name) {
      db.prepare("UPDATE daily_logs SET person_name = ? WHERE role = 'driver' AND person_name = ?").run(name, existing.name);
    }
  } else {
    db.prepare("INSERT INTO employees (name, wage_type, rate, fixed_salary) VALUES (?, ?, ?, ?)").run(name, wageType, rate, fixedSalary);
  }
}

function mergeExpenseCategory(db, data) {
  const name = (data.name || "").trim();
  if (!name) return;
  const oldName = (data.old_name || "").trim();
  const countsAsCommission = data.counts_as_commission ? 1 : 0;
  const existing = db.prepare("SELECT * FROM expense_categories WHERE name = ?").get(oldName || name);
  if (existing) {
    db.prepare("UPDATE expense_categories SET name = ?, counts_as_commission = ? WHERE id = ?").run(name, countsAsCommission, existing.id);
  } else {
    db.prepare("INSERT INTO expense_categories (name, counts_as_commission) VALUES (?, ?)").run(name, countsAsCommission);
  }
}

function mergeEquipment(db, data) {
  const name = (data.name || "").trim();
  if (!name) return;
  const purchasePrice = Number(data.purchase_price) || 0;
  const shares = Array.isArray(data.shares) ? data.shares : [];
  const existing = db.prepare("SELECT id FROM equipment WHERE name = ?").get(name);
  let equipmentId;
  if (existing) {
    db.prepare("UPDATE equipment SET purchase_price = ? WHERE id = ?").run(purchasePrice, existing.id);
    equipmentId = existing.id;
  } else {
    const info = db.prepare("INSERT INTO equipment (name, purchase_price) VALUES (?, ?)").run(name, purchasePrice);
    equipmentId = info.lastInsertRowid;
  }
  db.prepare("DELETE FROM equipment_partner_shares WHERE equipment_id = ?").run(equipmentId);
  const insertShare = db.prepare("INSERT INTO equipment_partner_shares (equipment_id, partner_id, percentage) VALUES (?, ?, ?)");
  for (const share of shares) {
    const partnerId = findOrCreatePartnerId(db, share.partner_name);
    if (!partnerId) continue;
    insertShare.run(equipmentId, partnerId, Number(share.percentage) || 0);
  }
}

function mergeDailyLog(db, data) {
  const equipmentId = findOrCreateEquipmentId(db, data.equipment_name);
  if (!equipmentId || !data.date || !data.role) return;
  db.prepare(
    `INSERT INTO daily_logs (equipment_id, date, role, person_name, actual_hours, base_hours, day_rate, is_paid_leave, is_day_off, fixed_value, hassan_commission, note)
     VALUES (@equipment_id, @date, @role, @person_name, @actual_hours, @base_hours, @day_rate, 0, @is_day_off, @fixed_value, @hassan_commission, @note)
     ON CONFLICT(equipment_id, date, role) DO UPDATE SET
       person_name = excluded.person_name,
       actual_hours = excluded.actual_hours,
       base_hours = excluded.base_hours,
       day_rate = excluded.day_rate,
       is_day_off = excluded.is_day_off,
       fixed_value = excluded.fixed_value,
       hassan_commission = excluded.hassan_commission,
       note = excluded.note`
  ).run({
    equipment_id: equipmentId,
    date: data.date,
    role: data.role,
    person_name: data.person_name || "",
    actual_hours: data.actual_hours ?? null,
    base_hours: data.base_hours ?? null,
    day_rate: data.day_rate ?? null,
    is_day_off: data.is_day_off ? 1 : 0,
    fixed_value: data.fixed_value ?? null,
    hassan_commission: data.hassan_commission ?? null,
    note: data.note ?? null,
  });
}

function mergeMonthlyExpense(db, data, docId) {
  const equipmentId = findOrCreateEquipmentId(db, data.equipment_name);
  if (!equipmentId || !data.month) return;
  const categoryId = findOrCreateExpenseCategoryId(db, data.category_name);
  db.prepare(
    `INSERT INTO monthly_expenses (equipment_id, month, date, category_id, amount, payment_method, note, sync_key)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(sync_key) DO NOTHING`
  ).run(equipmentId, data.month, data.date ?? null, categoryId, Number(data.amount) || 0, data.payment_method ?? null, data.note ?? null, docId);
}

function mergePayrollEntry(db, data, docId) {
  const employeeId = findEmployeeId(db, data.employee_name);
  if (!employeeId || !data.month || !data.kind) return;
  if (data.kind === "advance") {
    db.prepare(
      `INSERT INTO employee_advances (employee_id, month, date, amount, payment_method, note, sync_key)
       VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(sync_key) DO NOTHING`
    ).run(employeeId, data.month, data.date, Number(data.amount) || 0, data.payment_method ?? "cash", null, docId);
  } else if (data.kind === "bonus") {
    db.prepare(
      `INSERT INTO employee_bonuses (employee_id, month, date, amount, payment_method, note, sync_key)
       VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(sync_key) DO NOTHING`
    ).run(employeeId, data.month, data.date, Number(data.amount) || 0, data.payment_method ?? "cash", null, docId);
  } else if (data.kind === "deduction") {
    db.prepare(
      `INSERT INTO employee_deductions (employee_id, month, date, amount, reason, sync_key)
       VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(sync_key) DO NOTHING`
    ).run(employeeId, data.month, data.date, Number(data.amount) || 0, data.reason ?? "", docId);
  }
}

function mergeSalaryPayment(db, data, docId) {
  const employeeId = findEmployeeId(db, data.employee_name);
  if (!employeeId || !data.month) return;
  db.prepare(
    `INSERT INTO salary_payments (employee_id, month, date, amount, payment_method, note, sync_key)
     VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(sync_key) DO NOTHING`
  ).run(employeeId, data.month, data.date, Number(data.amount) || 0, data.payment_method || "cash", data.note ?? null, docId);
}

function mergeHassanLedger(db, data, docId) {
  if (!data.date || !data.type) return;
  db.prepare(
    `INSERT INTO hassan_ledger (date, type, amount, party_name, description, note, sync_key)
     VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(sync_key) DO NOTHING`
  ).run(data.date, data.type, Number(data.amount) || 0, data.party_name ?? null, data.description ?? null, data.note ?? null, docId);
}

function mergeHassanTreasuryExpense(db, data, docId) {
  if (!data.date) return;
  db.prepare(
    `INSERT INTO hassan_treasury_expenses (date, amount, description, sync_key)
     VALUES (?, ?, ?, ?) ON CONFLICT(sync_key) DO NOTHING`
  ).run(data.date, Number(data.amount) || 0, data.description ?? "", docId);
}

function mergeWasteEntry(db, data, docId) {
  if (!data.date) return;
  db.prepare(
    `INSERT INTO waste_entries (date, amount, payment_method, note, sync_key)
     VALUES (?, ?, ?, ?, ?) ON CONFLICT(sync_key) DO NOTHING`
  ).run(data.date, Number(data.amount) || 0, data.payment_method ?? null, data.note ?? null, docId);
}

function mergeSupplier(db, data) {
  const name = (data.name || "").trim();
  if (!name) return;
  db.prepare("INSERT INTO suppliers (name) VALUES (?) ON CONFLICT(name) DO NOTHING").run(name);
}

function mergeSupplierPurchase(db, data, docId) {
  const supplierId = findOrCreateSupplierId(db, data.supplier_name);
  if (!supplierId || !data.date) return;
  db.prepare(
    `INSERT INTO supplier_purchases (supplier_id, date, description, amount, note, sync_key)
     VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(sync_key) DO NOTHING`
  ).run(supplierId, data.date, data.description ?? null, Number(data.amount) || 0, data.note ?? null, docId);
}

function mergeSupplierPayment(db, data, docId) {
  const supplierId = findOrCreateSupplierId(db, data.supplier_name);
  if (!supplierId || !data.date) return;
  db.prepare(
    `INSERT INTO supplier_payments (supplier_id, date, amount, method, note, sync_key)
     VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(sync_key) DO NOTHING`
  ).run(supplierId, data.date, Number(data.amount) || 0, data.method ?? null, data.note ?? null, docId);
}

function mergeContractorPayment(db, data, docId) {
  const contractorId = findOrCreateContractorId(db, data.contractor_name);
  if (!contractorId || !data.date) return;
  db.prepare(
    `INSERT INTO contractor_payments (contractor_id, date, amount, method, note, sync_key)
     VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(sync_key) DO NOTHING`
  ).run(contractorId, data.date, Number(data.amount) || 0, data.method ?? null, data.note ?? null, docId);
}

function mergePartnerPayment(db, data, docId) {
  const partnerId = findOrCreatePartnerId(db, data.partner_name);
  if (!partnerId || !data.date) return;
  db.prepare(
    `INSERT INTO partner_payments (partner_id, date, amount, method, note, sync_key)
     VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(sync_key) DO NOTHING`
  ).run(partnerId, data.date, Number(data.amount) || 0, data.method ?? null, data.note ?? null, docId);
}

function mergeDoc(db, collectionName, docId, data) {
  switch (collectionName) {
    case "partners":
      return mergePartner(db, data);
    case "contractors":
      return mergeContractor(db, data);
    case "employees":
      return mergeEmployee(db, data);
    case "expense_categories":
      return mergeExpenseCategory(db, data);
    case "equipment":
      return mergeEquipment(db, data);
    case "daily_logs":
      return mergeDailyLog(db, data);
    case "monthly_expenses":
      return mergeMonthlyExpense(db, data, docId);
    case "hassan_ledger":
      return mergeHassanLedger(db, data, docId);
    case "hassan_treasury_expenses":
      return mergeHassanTreasuryExpense(db, data, docId);
    case "waste_entries":
      return mergeWasteEntry(db, data, docId);
    case "suppliers":
      return mergeSupplier(db, data);
    case "supplier_purchases":
      return mergeSupplierPurchase(db, data, docId);
    case "supplier_payments":
      return mergeSupplierPayment(db, data, docId);
    case "contractor_payments":
      return mergeContractorPayment(db, data, docId);
    case "partner_payments":
      return mergePartnerPayment(db, data, docId);
    case "payroll_entries":
      return mergePayrollEntry(db, data, docId);
    case "salary_payments":
      return mergeSalaryPayment(db, data, docId);
    default:
      return;
  }
}

// كل الجداول المرجعية (معدات/موظفين/شركاء/أنواع مصروفات) بترجع من Supabase
// برقم (equipment_id وهكذا) مش اسم — بنسيب كاش بسيط في الذاكرة يترجم الرقم
// لاسم قبل ما نبعته لـ mergeDoc (اللي بيتوقع أسماء زي بالظبط بيانات الموبايل).
const equipmentNames = new Map();
const employeeNames = new Map();
const categoryNames = new Map();
const supplierNames = new Map();
const partnerNames = new Map();
const contractorNames = new Map();

async function primeNameCaches(supabase) {
  const [{ data: eq }, { data: emp }, { data: cat }, { data: sup }, { data: pt }, { data: con }] = await Promise.all([
    supabase.from("equipment").select("id,name"),
    supabase.from("employees").select("id,name"),
    supabase.from("expense_categories").select("id,name"),
    supabase.from("suppliers").select("id,name"),
    supabase.from("partners").select("id,name"),
    supabase.from("contractors").select("id,name"),
  ]);
  for (const r of eq ?? []) equipmentNames.set(r.id, r.name);
  for (const r of emp ?? []) employeeNames.set(r.id, r.name);
  for (const r of cat ?? []) categoryNames.set(r.id, r.name);
  for (const r of sup ?? []) supplierNames.set(r.id, r.name);
  for (const r of pt ?? []) partnerNames.set(r.id, r.name);
  for (const r of con ?? []) contractorNames.set(r.id, r.name);
}

// لو الصف اتغيّر اسمه فعلًا (مش مجرد رقم زي الرصيد)، بنرجّع old_name عشان
// mergeDoc يلاقي نفس الصف محليًا بدل ما يعمل واحد جديد مكرر. old هنا جاي من
// payload.old بتاع Postgres، ومحتاج الجدول يكون replica identity full وإلا
// هيفضل فاضي دايمًا.
function renameInfo(row, old) {
  const oldName = old && old.name;
  return oldName && oldName !== row.name ? { old_name: oldName } : {};
}

async function translateRow(supabase, table, row, old) {
  switch (table) {
    case "partners":
      partnerNames.set(row.id, row.name);
      return { name: row.name, opening_balance: row.opening_balance };
    case "contractors":
      contractorNames.set(row.id, row.name);
      return { name: row.name, opening_balance: row.opening_balance };
    case "employees":
      employeeNames.set(row.id, row.name);
      return { name: row.name, wage_type: row.wage_type, rate: row.rate, fixed_salary: row.fixed_salary, ...renameInfo(row, old) };
    case "expense_categories":
      categoryNames.set(row.id, row.name);
      return { name: row.name, counts_as_commission: row.counts_as_commission, ...renameInfo(row, old) };
    case "equipment": {
      equipmentNames.set(row.id, row.name);
      const { data: shareRows } = await supabase
        .from("equipment_partner_shares")
        .select("percentage, partners(name)")
        .eq("equipment_id", row.id);
      const shares = (shareRows ?? [])
        .map((s) => ({ partner_name: s.partners?.name, percentage: s.percentage }))
        .filter((s) => s.partner_name);
      return { name: row.name, purchase_price: row.purchase_price, shares };
    }
    case "daily_logs": {
      const equipment_name = equipmentNames.get(row.equipment_id);
      if (!equipment_name) return null;
      return { ...row, equipment_name };
    }
    case "monthly_expenses": {
      const equipment_name = equipmentNames.get(row.equipment_id);
      if (!equipment_name) return null;
      const category_name = row.category_id ? categoryNames.get(row.category_id) || "" : "";
      return { ...row, equipment_name, category_name };
    }
    case "payroll_entries":
    case "salary_payments": {
      const employee_name = employeeNames.get(row.employee_id);
      if (!employee_name) return null;
      return { ...row, employee_name };
    }
    case "hassan_ledger":
    case "hassan_treasury_expenses":
    case "waste_entries":
      return { ...row };
    case "suppliers":
      supplierNames.set(row.id, row.name);
      return { name: row.name };
    case "supplier_purchases":
    case "supplier_payments": {
      const supplier_name = supplierNames.get(row.supplier_id);
      if (!supplier_name) return null;
      return { ...row, supplier_name };
    }
    case "contractor_payments": {
      const contractor_name = contractorNames.get(row.contractor_id);
      if (!contractor_name) return null;
      return { ...row, contractor_name };
    }
    case "partner_payments": {
      const partner_name = partnerNames.get(row.partner_id);
      if (!partner_name) return null;
      return { ...row, partner_name };
    }
    default:
      return null;
  }
}

// بيسمع لأي حاجة بتتسجل من أي موبايل ويحطها في قاعدة بيانات اللاب أوتوماتيك
// أول ما يكون فيه نت — من غير ما المستخدم يعمل استيراد يدوي. مفيش أي حذف
// بيتنفذ من هنا عمدًا: لو قيد اتمسح من الموبايل، بيفضل موجود في اللاب لحد
// ما حد يمسحه يدويًا — أأمن من حذف تلقائي ممكن يمسح حاجة غلط.
let activeClient = null;

// كل الأجهزة اللي اتزامنت قبل ما الميزة دي تتعمل بتحسب sync_key بصيغة
// "desktop_<localId>" بس (من غير أي رقم جهاز) — لازم اللاب الأساسي يفضل
// يحسبها بنفس الصيغة دي بالظبط عشان ما يبقاش فيه تكرار لكل قيد سبق اتبعت.
// أي لاب جديد بينضم بعد كده (مش الأساسي) لازم يستخدم رقم جهاز مميز خالص
// عشان الـ ID المحلي بتاعه (اللي ممكن يتشابه مع اللاب الأساسي بالصدفة، زي
// سلفة رقمها 12 في اللابين مع بعض) ما يجيش يلخبط أو يمسح قيد اللاب التاني
// في السحابة. الملف ده مبيتعملش إلا لو المستخدم دوس "ده جهاز إضافي" من
// الإعدادات — افتراضيًا كل جهاز جديد بيفضل شغال بالصيغة القديمة.
function machineIdPath() {
  return path.join(app.getPath("userData"), "machine-id.txt");
}
function loadMachineId() {
  try {
    if (fs.existsSync(machineIdPath())) return fs.readFileSync(machineIdPath(), "utf8").trim() || null;
  } catch (err) {
    console.error("loadMachineId failed", err);
  }
  return null;
}
// بنأجل قراءة الملف لحد أول استخدام فعلي (مش وقت تحميل الموديول) عشان
// app.getPath محتاج الـ app يكون جاهز، والموديول ده بيتعمله require وقت
// بدء تشغيل main.js قبل ما app.whenReady() تخلص.
let machineId;
let machineIdLoaded = false;
function ensureMachineIdLoaded() {
  if (!machineIdLoaded) {
    machineId = loadMachineId();
    machineIdLoaded = true;
  }
}

function markAsSecondaryMachine() {
  machineId = crypto.randomUUID();
  machineIdLoaded = true;
  fs.writeFileSync(machineIdPath(), machineId, "utf8");
  return machineId;
}
function isSecondaryMachine() {
  ensureMachineIdLoaded();
  return !!machineId;
}
function syncKeyFor(localId) {
  ensureMachineIdLoaded();
  return machineId ? `desktop_${machineId}_${localId}` : `desktop_${localId}`;
}

async function startCloudSync(db) {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: true },
    realtime: { transport: WebSocket },
  });

  const { error: authError } = await supabase.auth.signInWithPassword({
    email: DESKTOP_EMAIL,
    password: DESKTOP_PASSWORD,
  });
  if (authError) {
    console.error("Supabase sync sign-in failed", authError.message);
    return;
  }
  activeClient = supabase;

  await primeNameCaches(supabase);

  for (const table of COLLECTIONS) {
    let channel = supabase
      .channel(`sync-${table}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table }, async (payload) => {
        const translated = await translateRow(supabase, table, payload.new);
        if (!translated) return;
        try {
          mergeDoc(db, table, payload.new.sync_key || String(payload.new.id), translated);
        } catch (err) {
          console.error(`sync merge failed for ${table}/${payload.new.id}`, err);
        }
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table }, async (payload) => {
        const translated = await translateRow(supabase, table, payload.new, payload.old);
        if (!translated) return;
        try {
          mergeDoc(db, table, payload.new.sync_key || String(payload.new.id), translated);
        } catch (err) {
          console.error(`sync merge failed for ${table}/${payload.new.id}`, err);
        }
      });
    // السركي/المقاول بس بيتمسحوا من اللاب لو اتمسحوا من الموبايل — عندهم
    // مفتاح طبيعي (equipment_id+date+role) يضمن إننا بنمسح الصف الصح بالظبط.
    // باقي الجداول بتفضل زي ما هي عمدًا (راجع الملاحظة فوق).
    if (table === "daily_logs") {
      channel = channel.on("postgres_changes", { event: "DELETE", schema: "public", table }, (payload) => {
        const old = payload.old || {};
        const equipmentName = equipmentNames.get(old.equipment_id);
        if (!equipmentName || !old.date || !old.role) return;
        try {
          db.prepare(
            "DELETE FROM daily_logs WHERE equipment_id = (SELECT id FROM equipment WHERE name = ?) AND date = ? AND role = ?"
          ).run(equipmentName, old.date, old.role);
        } catch (err) {
          console.error("sync delete failed for daily_logs", err);
        }
      });
    }
    channel.subscribe((status, err) => {
      if (err) console.error(`sync listener failed for ${table}`, err);
    });
  }
}

async function getOrCreateByName(table, name, extra = {}) {
  const trimmed = (name || "").trim();
  if (!trimmed) return null;
  const { data, error } = await activeClient.from(table).upsert({ name: trimmed, ...extra }, { onConflict: "name" }).select("id").single();
  if (error || !data) {
    const { data: existing } = await activeClient.from(table).select("id").eq("name", trimmed).maybeSingle();
    return existing?.id ?? null;
  }
  return data.id;
}

async function findIdByName(table, name) {
  const trimmed = (name || "").trim();
  if (!trimmed) return null;
  const { data } = await activeClient.from(table).select("id").eq("name", trimmed).maybeSingle();
  return data?.id ?? null;
}

// بيبعت أي حاجة اتسجلت في اللاب مباشرة (مش جايه من الموبايل) للسحابة —
// لازم ده يحصل لكل حاجة بتتسجل من اللاب، مش بس دفعات الشركاء، عشان أي حد
// شايف الأرقام من الموبايل (شركاء أو ستاف) يشوف كل الداتا مش بس اللي
// اتسجلت من التليفون. localId بيتحول لـ sync_key فريد للجداول اللي معندهاش
// مفتاح طبيعي (زي equipment_id+date+role) أو اسم UNIQUE. لو المزامنة لسه
// ملحقتش تسجل دخول (أو مفيش نت)، بيتجاهل بهدوء — الداتا اتسجلت في اللاب
// بالفعل، ده تحديث إضافي بس مش أساسي.
// بيبعت تعديل على جدول مرجعي (اسمه UNIQUE). لو فيه oldName وغير عن الاسم
// الجديد (إعادة تسمية)، بيعمل تحديث على نفس الصف بالاسم القديم عشان الصف
// يفضل واحد بس، مش يتكرر تحت الاسم الجديد. لو مفيش صف بالاسم القديم أصلًا
// (لسه ما اتبعتش قبل كده)، بيرجع لـ upsert عادي بالاسم الجديد.
async function upsertByName(table, newName, fields, oldName) {
  const trimmed = (newName || "").trim();
  if (oldName && oldName.trim() && oldName.trim() !== trimmed) {
    const { data, error } = await activeClient.from(table).update({ name: trimmed, ...fields }).eq("name", oldName.trim()).select("id");
    if (!error && data && data.length > 0) return;
  }
  await activeClient.from(table).upsert({ name: trimmed, ...fields }, { onConflict: "name" });
}

async function pushToCloud(table, localId, data) {
  if (!activeClient) return;
  try {
    switch (table) {
      case "partners":
      case "contractors":
        await upsertByName(table, data.name, { opening_balance: data.opening_balance ?? 0 });
        return;
      case "employees":
        await upsertByName("employees", data.name, { wage_type: data.wage_type, rate: data.rate, fixed_salary: !!data.fixed_salary }, data.old_name);
        return;
      case "expense_categories":
        await upsertByName("expense_categories", data.name, { counts_as_commission: !!data.counts_as_commission }, data.old_name);
        return;
      case "equipment": {
        await upsertByName("equipment", data.name, { purchase_price: data.purchase_price ?? 0 });
        const equipmentId = await findIdByName("equipment", data.name);
        if (!equipmentId) return;
        const keptPartnerIds = [];
        for (const share of data.shares ?? []) {
          const partnerId = await getOrCreateByName("partners", share.partner_name);
          if (!partnerId) continue;
          keptPartnerIds.push(partnerId);
          await activeClient
            .from("equipment_partner_shares")
            .upsert({ equipment_id: equipmentId, partner_id: partnerId, percentage: share.percentage }, { onConflict: "equipment_id,partner_id" });
        }
        let deleteQuery = activeClient.from("equipment_partner_shares").delete().eq("equipment_id", equipmentId);
        if (keptPartnerIds.length > 0) deleteQuery = deleteQuery.not("partner_id", "in", `(${keptPartnerIds.join(",")})`);
        await deleteQuery;
        return;
      }
      case "daily_logs": {
        const equipmentId = await getOrCreateByName("equipment", data.equipment_name);
        if (!equipmentId) return;
        await activeClient.from("daily_logs").upsert(
          {
            equipment_id: equipmentId,
            date: data.date,
            role: data.role,
            person_name: data.person_name ?? "",
            actual_hours: data.actual_hours,
            base_hours: data.base_hours,
            day_rate: data.day_rate,
            is_day_off: !!data.is_day_off,
            fixed_value: data.fixed_value,
            hassan_commission: data.hassan_commission,
            note: data.note,
          },
          { onConflict: "equipment_id,date,role" }
        );
        return;
      }
      case "monthly_expenses": {
        const equipmentId = await getOrCreateByName("equipment", data.equipment_name);
        if (!equipmentId) return;
        const categoryId = data.category_name ? await getOrCreateByName("expense_categories", data.category_name) : null;
        await activeClient.from("monthly_expenses").upsert(
          {
            equipment_id: equipmentId,
            month: data.month,
            date: data.date,
            category_id: categoryId,
            amount: data.amount,
            payment_method: data.payment_method,
            note: data.note,
            sync_key: syncKeyFor(localId),
          },
          { onConflict: "sync_key" }
        );
        return;
      }
      case "payroll_entries": {
        const employeeId = await findIdByName("employees", data.employee_name);
        if (!employeeId) return;
        await activeClient.from("payroll_entries").upsert(
          {
            employee_id: employeeId,
            kind: data.kind,
            month: data.month,
            date: data.date,
            amount: data.amount,
            payment_method: data.payment_method,
            reason: data.reason,
            sync_key: syncKeyFor(localId),
          },
          { onConflict: "sync_key" }
        );
        return;
      }
      case "salary_payments": {
        const employeeId = await findIdByName("employees", data.employee_name);
        if (!employeeId) return;
        await activeClient.from("salary_payments").upsert(
          {
            employee_id: employeeId,
            month: data.month,
            date: data.date,
            amount: data.amount,
            payment_method: data.payment_method,
            note: data.note,
            sync_key: syncKeyFor(localId),
          },
          { onConflict: "sync_key" }
        );
        return;
      }
      case "partner_payments": {
        const partnerId = await getOrCreateByName("partners", data.partner_name);
        if (!partnerId) return;
        await activeClient.from("partner_payments").upsert(
          {
            partner_id: partnerId,
            date: data.date,
            amount: data.amount,
            method: data.method,
            note: data.note,
            sync_key: syncKeyFor(localId),
          },
          { onConflict: "sync_key" }
        );
        return;
      }
      case "hassan_ledger": {
        await activeClient.from("hassan_ledger").upsert(
          {
            date: data.date,
            type: data.type,
            amount: data.amount,
            party_name: data.party_name,
            description: data.description,
            note: data.note,
            sync_key: syncKeyFor(localId),
          },
          { onConflict: "sync_key" }
        );
        return;
      }
      case "hassan_treasury_expenses": {
        await activeClient.from("hassan_treasury_expenses").upsert(
          { date: data.date, amount: data.amount, description: data.description, sync_key: syncKeyFor(localId) },
          { onConflict: "sync_key" }
        );
        return;
      }
      case "waste_entries": {
        await activeClient.from("waste_entries").upsert(
          { date: data.date, amount: data.amount, payment_method: data.payment_method, note: data.note, sync_key: syncKeyFor(localId) },
          { onConflict: "sync_key" }
        );
        return;
      }
      case "supplier_purchases": {
        const supplierId = await getOrCreateByName("suppliers", data.supplier_name);
        if (!supplierId) return;
        await activeClient.from("supplier_purchases").upsert(
          {
            supplier_id: supplierId,
            date: data.date,
            description: data.description,
            amount: data.amount,
            note: data.note,
            sync_key: syncKeyFor(localId),
          },
          { onConflict: "sync_key" }
        );
        return;
      }
      case "supplier_payments": {
        const supplierId = await getOrCreateByName("suppliers", data.supplier_name);
        if (!supplierId) return;
        await activeClient.from("supplier_payments").upsert(
          {
            supplier_id: supplierId,
            date: data.date,
            amount: data.amount,
            method: data.method,
            note: data.note,
            sync_key: syncKeyFor(localId),
          },
          { onConflict: "sync_key" }
        );
        return;
      }
      case "contractor_payments": {
        const contractorId = await getOrCreateByName("contractors", data.contractor_name);
        if (!contractorId) return;
        await activeClient.from("contractor_payments").upsert(
          {
            contractor_id: contractorId,
            date: data.date,
            amount: data.amount,
            method: data.method,
            note: data.note,
            sync_key: syncKeyFor(localId),
          },
          { onConflict: "sync_key" }
        );
        return;
      }
    }
  } catch (err) {
    console.error(`pushToCloud failed for ${table}`, err);
  }
}

// بيبعت كل الداتا الموجودة في اللاب للسحابة مرة واحدة — لازم لأول مرة
// اللاب يتربط فيها بالمزامنة، عشان كل التاريخ القديم (قبل ما الموبايل
// يتعمل أصلًا) يوصل للسحابة وبالتالي للموبايل، مش بس اللي بيتسجل من دلوقتي.
async function pushAllToCloud(db) {
  if (!activeClient) return { pushed: 0, error: "مش متصل بالسحابة لسه" };
  let pushed = 0;

  for (const p of db.prepare("SELECT * FROM partners").all()) {
    await pushToCloud("partners", p.id, { name: p.name, opening_balance: p.opening_balance });
    pushed++;
  }
  for (const c of db.prepare("SELECT * FROM contractors").all()) {
    await pushToCloud("contractors", c.id, { name: c.name, opening_balance: c.opening_balance });
    pushed++;
  }
  for (const e of db.prepare("SELECT * FROM employees").all()) {
    await pushToCloud("employees", e.id, { name: e.name, wage_type: e.wage_type, rate: e.rate, fixed_salary: !!e.fixed_salary });
    pushed++;
  }
  for (const c of db.prepare("SELECT * FROM expense_categories").all()) {
    await pushToCloud("expense_categories", c.id, { name: c.name, counts_as_commission: !!c.counts_as_commission });
    pushed++;
  }

  const shareStmt = db.prepare(
    "SELECT eps.percentage, p.name AS partner_name FROM equipment_partner_shares eps JOIN partners p ON p.id = eps.partner_id WHERE eps.equipment_id = ?"
  );
  for (const eq of db.prepare("SELECT * FROM equipment").all()) {
    await pushToCloud("equipment", eq.id, { name: eq.name, purchase_price: eq.purchase_price, shares: shareStmt.all(eq.id) });
    pushed++;
  }

  for (const log of db
    .prepare("SELECT dl.*, e.name AS equipment_name FROM daily_logs dl JOIN equipment e ON e.id = dl.equipment_id")
    .all()) {
    await pushToCloud("daily_logs", log.id, log);
    pushed++;
  }

  for (const exp of db
    .prepare(
      `SELECT me.*, e.name AS equipment_name, ec.name AS category_name FROM monthly_expenses me
       JOIN equipment e ON e.id = me.equipment_id LEFT JOIN expense_categories ec ON ec.id = me.category_id`
    )
    .all()) {
    await pushToCloud("monthly_expenses", exp.id, exp);
    pushed++;
  }

  for (const a of db
    .prepare("SELECT a.*, e.name AS employee_name FROM employee_advances a JOIN employees e ON e.id = a.employee_id")
    .all()) {
    await pushToCloud("payroll_entries", `advance-${a.id}`, { ...a, kind: "advance" });
    pushed++;
  }
  for (const b of db
    .prepare("SELECT b.*, e.name AS employee_name FROM employee_bonuses b JOIN employees e ON e.id = b.employee_id")
    .all()) {
    await pushToCloud("payroll_entries", `bonus-${b.id}`, { ...b, kind: "bonus" });
    pushed++;
  }
  for (const d of db
    .prepare("SELECT d.*, e.name AS employee_name FROM employee_deductions d JOIN employees e ON e.id = d.employee_id")
    .all()) {
    await pushToCloud("payroll_entries", `deduction-${d.id}`, { ...d, kind: "deduction" });
    pushed++;
  }
  for (const sp of db
    .prepare("SELECT sp.*, e.name AS employee_name FROM salary_payments sp JOIN employees e ON e.id = sp.employee_id")
    .all()) {
    await pushToCloud("salary_payments", sp.id, sp);
    pushed++;
  }
  for (const pp of db
    .prepare("SELECT pp.*, p.name AS partner_name FROM partner_payments pp JOIN partners p ON p.id = pp.partner_id")
    .all()) {
    await pushToCloud("partner_payments", pp.id, pp);
    pushed++;
  }
  for (const cp of db
    .prepare("SELECT cp.*, c.name AS contractor_name FROM contractor_payments cp JOIN contractors c ON c.id = cp.contractor_id")
    .all()) {
    await pushToCloud("contractor_payments", cp.id, cp);
    pushed++;
  }

  for (const entry of db.prepare("SELECT * FROM hassan_ledger").all()) {
    await pushToCloud("hassan_ledger", entry.id, entry);
    pushed++;
  }
  for (const exp of db.prepare("SELECT * FROM hassan_treasury_expenses").all()) {
    await pushToCloud("hassan_treasury_expenses", exp.id, exp);
    pushed++;
  }
  for (const w of db.prepare("SELECT * FROM waste_entries").all()) {
    await pushToCloud("waste_entries", w.id, w);
    pushed++;
  }
  for (const p of db
    .prepare("SELECT sp.*, s.name AS supplier_name FROM supplier_purchases sp JOIN suppliers s ON s.id = sp.supplier_id")
    .all()) {
    await pushToCloud("supplier_purchases", p.id, p);
    pushed++;
  }
  for (const p of db
    .prepare("SELECT sp.*, s.name AS supplier_name FROM supplier_payments sp JOIN suppliers s ON s.id = sp.supplier_id")
    .all()) {
    await pushToCloud("supplier_payments", p.id, p);
    pushed++;
  }

  return { pushed };
}

module.exports = { startCloudSync, pushToCloud, pushAllToCloud, markAsSecondaryMachine, isSecondaryMachine };
