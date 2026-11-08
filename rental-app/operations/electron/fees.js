// عمولة التحويل (انستا باي وأي حساب تاني ليه عمولة): لما فلوس تطلع من حساب
// عليه عمولة والشاشة تقول إنها "تحويل" (transfer_fee: true) — مش "دفع" —
// العمولة بتتسجل في transfer_fees مربوطة بالحركة الأصلية (src/src_id)،
// وبتظهر في الخزنة "اتدفع كذا + عمولة كذا"، وبتتمسح لما الحركة تتمسح.
//
// ده غلاف حوالين ipcMain: كل شاشة بتسجل حركة طالعة زي ما هي، والغلاف
// بيضيف العمولة بعدها — من غير ما نعدّل كل handler لوحده.

const DEFAULT_RULES = { instapay: { pct: 0.1, min: 0.5, max: 20 } };

// القناة → [الجدول، عمود الحساب، شرط إن الحركة طالعة]
const OUT = {
  "monthlyExpenses:create": ["monthly_expenses", "payment_method"],
  "expensePayments:create": ["expense_payments", "method"],
  "employeeAdvances:create": ["employee_advances", "payment_method"],
  "employeeBonuses:create": ["employee_bonuses", "payment_method"],
  "salaryPayments:create": ["salary_payments", "payment_method"],
  "partnerPayments:create": ["partner_payments", "method"],
  "supplierPayments:create": ["supplier_payments", "method"],
  "creditorEntries:create": ["creditor_entries", "method", (r) => r.type === "payment"],
  "hassanLedger:create": ["hassan_ledger", "method", (r) => r.type === "repayment" || r.type === "due"],
  "hassanTreasury:create": ["hassan_treasury_expenses", "method"],
  "installments:pay": ["hassan_treasury_expenses", "method"],
  "custodies:create": ["custodies", "method"],
  "waste:create": ["waste_entries", "payment_method"],
  "treasury:createTransfer": ["treasury_transfers", "from_account"],
};

const DELETES = {
  "monthlyExpenses:delete": "monthly_expenses",
  "expensePayments:delete": "expense_payments",
  "employeeAdvances:delete": "employee_advances",
  "employeeBonuses:delete": "employee_bonuses",
  "salaryPayments:delete": "salary_payments",
  "partnerPayments:delete": "partner_payments",
  "supplierPayments:delete": "supplier_payments",
  "creditorEntries:delete": "creditor_entries",
  "hassanLedger:delete": "hassan_ledger",
  "hassanTreasury:delete": "hassan_treasury_expenses",
  "custodies:delete": "custodies",
  "waste:delete": "waste_entries",
  "treasury:deleteTransfer": "treasury_transfers",
};

let db = null;
const setFeeDb = (d) => {
  db = d;
};

function feeRules(d = db) {
  try {
    const row = d.prepare("SELECT value FROM app_settings WHERE key = 'transfer_fee_rules'").get();
    return row?.value ? { ...JSON.parse(row.value) } : { ...DEFAULT_RULES };
  } catch {
    return { ...DEFAULT_RULES };
  }
}

function feeFor(rule, amount) {
  if (!rule || !(amount > 0) || (!rule.pct && !rule.min)) return 0;
  let fee = (amount * (Number(rule.pct) || 0)) / 100;
  fee = Math.max(fee, Number(rule.min) || 0);
  if (rule.max != null && rule.max !== "") fee = Math.min(fee, Number(rule.max));
  return Math.round(fee * 100) / 100;
}

function record(channel, result) {
  const [table, col, isOut] = OUT[channel];
  const id = result && typeof result === "object" && result.id && channel !== "installments:pay" ? result.id : db.prepare(`SELECT MAX(id) AS id FROM ${table}`).get()?.id;
  if (!id) return;
  const row = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id);
  if (!row || (isOut && !isOut(row))) return;
  const amount = row.paid_amount ?? row.amount;
  const fee = feeFor(feeRules()[row[col]], amount);
  if (fee <= 0) return;
  db.prepare("DELETE FROM transfer_fees WHERE src = ? AND src_id = ?").run(table, id);
  db.prepare("INSERT INTO transfer_fees (date, account, amount, base_amount, src, src_id) VALUES (?, ?, ?, ?, ?, ?)").run(
    row.date ?? `${row.month}-01`,
    row[col],
    fee,
    amount,
    table,
    id
  );
}

const dropFees = (table, id) => id != null && db.prepare("DELETE FROM transfer_fees WHERE src = ? AND src_id = ?").run(table, id);

function wrapIpc(ipcMain) {
  return {
    handle(channel, fn) {
      ipcMain.handle(channel, (e, payload) => {
        let p = payload;
        const wantFee = !!(p && typeof p === "object" && p.transfer_fee);
        if (p && typeof p === "object" && "transfer_fee" in p) {
          p = { ...p };
          delete p.transfer_fee;
        }
        // دفعة قسط: العمولة مربوطة بالمصروف بتاعها — نعرفه قبل ما يتمسح
        const pre = channel === "installmentPayments:delete" && db ? db.prepare("SELECT treasury_expense_id AS x FROM hassan_installment_payments WHERE id = ?").get(p?.id)?.x : null;
        const after = (res) => {
          if (!db) return res;
          if (wantFee && OUT[channel]) record(channel, res);
          if (DELETES[channel]) dropFees(DELETES[channel], p?.id);
          if (channel === "treasury:movementDelete") dropFees(p?.src, p?.src_id);
          if (pre) dropFees("hassan_treasury_expenses", pre);
          // تعديل المبلغ/الحساب من حركة الشهر: العمولة بتتحسب تاني
          if (channel === "treasury:movementUpdate" && p?.src !== "transfer_fees") {
            const fee = db.prepare("SELECT * FROM transfer_fees WHERE src = ? AND src_id = ?").get(p.src, p.src_id);
            if (fee) {
              const amt = Number(p.amount);
              const acc = p.account || fee.account;
              const v = feeFor(feeRules()[acc], amt);
              if (v > 0) db.prepare("UPDATE transfer_fees SET amount = ?, base_amount = ?, account = ?, date = COALESCE(?, date) WHERE id = ?").run(v, amt, acc, p.date || null, fee.id);
              else dropFees(p.src, p.src_id);
            }
          }
          return res;
        };
        const res = fn(e, p);
        return res && typeof res.then === "function" ? res.then(after) : after(res);
      });
    },
  };
}

module.exports = { wrapIpc, setFeeDb, feeRules, feeFor, DEFAULT_RULES };
