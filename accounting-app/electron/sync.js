const { initializeApp } = require("firebase/app");
const { getFirestore, collection, onSnapshot } = require("firebase/firestore");

const firebaseConfig = {
  apiKey: "AIzaSyAYtgH5ZwqWPMTLFIgUT2_w5lH9iUbohYk",
  authDomain: "bonyan-9d419.firebaseapp.com",
  projectId: "bonyan-9d419",
  storageBucket: "bonyan-9d419.firebasestorage.app",
  messagingSenderId: "590186239301",
  appId: "1:590186239301:web:2f8510fbbf98a330455a2c",
};

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

// بيسمع لأي حاجة بتتسجل من أي موبايل ويحطها في قاعدة بيانات اللاب أوتوماتيك
// أول ما يكون فيه نت — من غير ما المستخدم يعمل استيراد يدوي. مفيش أي حذف
// بيتنفذ من هنا عمدًا: لو قيد اتمسح من الموبايل، بيفضل موجود في اللاب لحد
// ما حد يمسحه يدويًا — أأمن من حذف تلقائي ممكن يمسح حاجة غلط.
function startCloudSync(db) {
  let app;
  try {
    app = initializeApp(firebaseConfig);
  } catch (err) {
    console.error("Firebase init failed", err);
    return;
  }
  const firestore = getFirestore(app);

  for (const name of COLLECTIONS) {
    onSnapshot(
      collection(firestore, name),
      (snapshot) => {
        for (const change of snapshot.docChanges()) {
          if (change.type === "removed") continue;
          try {
            mergeDoc(db, name, change.doc.id, change.doc.data());
          } catch (err) {
            console.error(`sync merge failed for ${name}/${change.doc.id}`, err);
          }
        }
      },
      (err) => {
        console.error(`sync listener failed for ${name}`, err);
      }
    );
  }
}

module.exports = { startCloudSync };
