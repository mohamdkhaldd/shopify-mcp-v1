const { createClient } = require("@supabase/supabase-js");
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

function mergePartner(db, data) {
  const name = (data.name || "").trim();
  if (!name) return;
  db.prepare("INSERT INTO partners (name, opening_balance) VALUES (?, 0) ON CONFLICT(name) DO NOTHING").run(name);
}

function mergeContractor(db, data) {
  const name = (data.name || "").trim();
  if (!name) return;
  db.prepare("INSERT INTO contractors (name, opening_balance) VALUES (?, 0) ON CONFLICT(name) DO NOTHING").run(name);
}

function mergeEmployee(db, data) {
  const name = (data.name || "").trim();
  if (!name) return;
  db.prepare(
    "INSERT INTO employees (name, wage_type, rate, fixed_salary) VALUES (?, ?, ?, ?) ON CONFLICT(name) DO NOTHING"
  ).run(name, data.wage_type === "monthly" ? "monthly" : "daily", Number(data.rate) || 0, data.fixed_salary ? 1 : 0);
}

function mergeExpenseCategory(db, data) {
  const name = (data.name || "").trim();
  if (!name) return;
  db.prepare(
    "INSERT INTO expense_categories (name, counts_as_commission) VALUES (?, ?) ON CONFLICT(name) DO NOTHING"
  ).run(name, data.counts_as_commission ? 1 : 0);
}

function mergeEquipment(db, data) {
  const name = (data.name || "").trim();
  if (!name) return;
  const existing = db.prepare("SELECT id FROM equipment WHERE name = ?").get(name);
  if (existing) return;
  const info = db.prepare("INSERT INTO equipment (name, purchase_price) VALUES (?, ?)").run(name, Number(data.purchase_price) || 0);
  const equipmentId = info.lastInsertRowid;
  const shares = Array.isArray(data.shares) ? data.shares : [];
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

async function primeNameCaches(supabase) {
  const [{ data: eq }, { data: emp }, { data: cat }] = await Promise.all([
    supabase.from("equipment").select("id,name"),
    supabase.from("employees").select("id,name"),
    supabase.from("expense_categories").select("id,name"),
  ]);
  for (const r of eq ?? []) equipmentNames.set(r.id, r.name);
  for (const r of emp ?? []) employeeNames.set(r.id, r.name);
  for (const r of cat ?? []) categoryNames.set(r.id, r.name);
}

function translateRow(table, row) {
  switch (table) {
    case "partners":
    case "contractors":
      return { name: row.name };
    case "employees":
      employeeNames.set(row.id, row.name);
      return { name: row.name, wage_type: row.wage_type, rate: row.rate, fixed_salary: row.fixed_salary };
    case "expense_categories":
      categoryNames.set(row.id, row.name);
      return { name: row.name, counts_as_commission: row.counts_as_commission };
    case "equipment":
      equipmentNames.set(row.id, row.name);
      return { name: row.name, purchase_price: row.purchase_price, shares: [] };
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
    default:
      return null;
  }
}

// بيسمع لأي حاجة بتتسجل من أي موبايل ويحطها في قاعدة بيانات اللاب أوتوماتيك
// أول ما يكون فيه نت — من غير ما المستخدم يعمل استيراد يدوي. مفيش أي حذف
// بيتنفذ من هنا عمدًا: لو قيد اتمسح من الموبايل، بيفضل موجود في اللاب لحد
// ما حد يمسحه يدويًا — أأمن من حذف تلقائي ممكن يمسح حاجة غلط.
let activeClient = null;

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
    supabase
      .channel(`sync-${table}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table }, (payload) => {
        const translated = translateRow(table, payload.new);
        if (!translated) return;
        try {
          mergeDoc(db, table, payload.new.sync_key || String(payload.new.id), translated);
        } catch (err) {
          console.error(`sync merge failed for ${table}/${payload.new.id}`, err);
        }
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table }, (payload) => {
        const translated = translateRow(table, payload.new);
        if (!translated) return;
        try {
          mergeDoc(db, table, payload.new.sync_key || String(payload.new.id), translated);
        } catch (err) {
          console.error(`sync merge failed for ${table}/${payload.new.id}`, err);
        }
      })
      .subscribe((status, err) => {
        if (err) console.error(`sync listener failed for ${table}`, err);
      });
  }
}

// بيبعت دفعة شريك للسحابة عشان حساب "الباقي" بتاعه في الموبايل يبقى محدّث.
// partnerName لازم اسم الشريك (مش الـ id المحلي بتاع اللاب — ده رقم تاني
// خالص عن رقمه في Supabase)، عشان نلاقي/ننشئ نفس الصف هناك بالاسم زي باقي
// أنواع البيانات. لو المزامنة لسه ملحقتش تسجل دخول (أو مفيش نت)، بيتجاهلها
// بهدوء — الدفعة اتسجلت في اللاب بالفعل، ده تحديث إضافي بس مش أساسي.
async function pushPartnerPayment(localId, partnerName, payment) {
  if (!activeClient) return;
  try {
    const trimmed = (partnerName || "").trim();
    if (!trimmed) return;
    const { data: partnerRow, error: partnerErr } = await activeClient
      .from("partners")
      .upsert({ name: trimmed, opening_balance: 0 }, { onConflict: "name" })
      .select("id")
      .single();
    if (partnerErr || !partnerRow) return;
    await activeClient.from("partner_payments").upsert(
      {
        partner_id: partnerRow.id,
        date: payment.date,
        amount: payment.amount,
        method: payment.method,
        note: payment.note,
        sync_key: `desktop_${localId}`,
      },
      { onConflict: "sync_key" }
    );
  } catch (err) {
    console.error("pushPartnerPayment failed", err);
  }
}

module.exports = { startCloudSync, pushPartnerPayment };
