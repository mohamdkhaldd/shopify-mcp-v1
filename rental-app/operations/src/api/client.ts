import { mockInvoke } from "./mockDb";
import {
  MonthMovement,
  HassanInstallment,
  FundDetail,
  FundSummary,
  PaperSheet,
  CustodyTarget,
  AttendanceRow,
  AttendanceStatus,
  CarSummary,
  Custody,
  CustodyStatement,
  DashboardAlert,
  Obligation,
  CreditorBalance,
  CreditorStatement,
  AppUpdateStatus,
  Contractor,
  ContractorDetail,
  ContractorPayment,
  ContractorSummary,
  DailyLog,
  DailyLogRole,
  DashboardMonthDues,
  EquipmentSheetMismatch,
  DashboardSummary,
  Driver,
  Equipment,
  EmployeeAdvance,
  EmployeeBonus,
  EmployeeDeduction,
  EquipmentShift,
  EquipmentSummary,
  ExpenseCategory,
  HassanBalance,
  HassanCommissionSummary,
  HassanEquipmentCommissionDetail,
  HassanLedgerEntry,
  HassanPartyBalance,
  HassanTreasuryBalance,
  HassanTreasuryExpense,
  HassanPenalty,
  HassanWorker,
  HassanWorkerEntry,
  HassanWorkerEntryType,
  HassanWorkerPayroll,
  IncomingSummary,
  MonthlyExpense,
  MonthlyReport,
  OutgoingSummary,
  Partner,
  PartnerDetail,
  PartnerPayment,
  PartnerSummary,
  PayrollDetail,
  PayrollRow,
  SalaryPayment,
  SupplierDashboardRow,
  SupplierPayment,
  SupplierPurchase,
  TreasuryAccount,
  TreasuryAccountName,
  TreasurySummaryRow,
  TreasuryStatement,
  TreasuryExtras,
  PayablesSummary,
  SyncActivity,
  SyncStatus,
  WasteEntry,
} from "./types";
import { person } from "../person";

declare global {
  interface Window {
    // the same shape the rental screens declare (MK-Tech builds both together)
    api?: {
      platform?: "tablet" | "web";
      invoke: (channel: string, payload?: unknown) => Promise<any>;
      on: (channel: string, cb: (data: unknown) => void) => () => void;
    };
  }
}

// ---------- تأكيد قبل أي إضافة أو مسح ----------
// قبل أي إضافة أو مسح بيسأل "إنت بتضيف كذا — موافق؟". العمليات اللي بتتكرر
// ورا بعض بسرعة (تعبئة أيام كتير في السركي مثلًا) بتتسأل مرة واحدة، والمسح
// اللي سأل "متأكد؟" لوحده مبيتسألش تاني. ممكن يتقفل من الإعدادات.
const CONFIRM_KEY = "albunyan.confirmChanges";
export const confirmSetting = {
  get: (): boolean => {
    try {
      return localStorage.getItem(CONFIRM_KEY) !== "0";
    } catch {
      return true;
    }
  },
  set: (on: boolean) => {
    try {
      localStorage.setItem(CONFIRM_KEY, on ? "1" : "0");
    } catch {
      /* storage blocked */
    }
  },
};

export class CancelledError extends Error {
  constructor() {
    super("اتلغى");
    this.name = "CancelledError";
  }
}

const entityLabels = (): Record<string, string> => ({
  partners: "شريك",
  employees: "سواق / موظف",
  contractors: "مقاول",
  expenseCategories: "نوع مصروف",
  equipment: "معدة",
  dailyLogs: "يوم في الشيت",
  equipmentShifts: "شيفت",
  monthlyExpenses: "مصروف معدة",
  employeeAdvances: "سلفة",
  employeeBonuses: "حافز",
  employeeDeductions: "خصم",
  salaryPayments: "دفعة مرتب",
  hassanPenalties: `جزاء على ${person()}`,
  hassanWorkers: `عامل ل${person()}`,
  hassanWorkerEntries: `حركة مرتب عامل ${person()}`,
  hassanTreasury: `مصروف من خزنة ${person()}`,
  hassanLedger: `حركة في حساب ${person()} الشخصي`,
  contractorPayments: "دفعة من مقاول",
  partnerPayments: "دفعة لشريك",
  treasury: "حركة خزنة",
  otherIncome: "إيراد آخر",
  expensePayments: "دفعة آجل",
  creditors: "جهة علينا لها فلوس",
  creditorEntries: "دين / سداد لجهة",
  supplierPurchases: "مشتريات من مورد",
  supplierPayments: "دفعة لمورد",
  waste: "هالك",
  custodies: "عهدة",
  paperSheets: "صورة السركي الورقي",
  fundExpenses: "صرف من خزنة",
  installments: "قسط",
  installmentPayments: "دفعة قسط",
  custodyEntries: "حركة في عهدة",
  carFuel: "بنزين / زيت العربية",
  obligations: "ميعاد التزام",
});

function changeKind(channel: string): "add" | "delete" | null {
  const [entity, op] = channel.split(":");
  if (!entityLabels()[entity]) return null;
  if (op === "create" || op === "upsert" || op === "createTransfer" || op === "count") return "add";
  if (op === "delete" || op === "deleteTransfer" || op === "deleteAdjustment") return "delete";
  return null;
}

function describePayload(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";
  const p = payload as Record<string, unknown>;
  const parts: string[] = [];
  const text = (k: string) => (typeof p[k] === "string" && (p[k] as string).trim() ? (p[k] as string).trim() : null);
  for (const k of ["name", "holder", "title", "person_name", "kind"]) {
    const v = text(k);
    // أنواع داخلية بالإنجليزي (salaries...) متظهرش في الرسالة.
    if (v && !/^[a-z_]+$/.test(v)) parts.push(v);
  }
  if (typeof p.amount === "number" || (typeof p.amount === "string" && p.amount !== "")) {
    parts.push(`${Number(p.amount).toLocaleString("en-US")} ج.م`);
  } else if (typeof p.counted === "number") {
    parts.push(`المعدود ${p.counted.toLocaleString("en-US")} ج.م`);
  }
  if (typeof p.day_rate === "number" && p.day_rate) parts.push(`يومية ${p.day_rate.toLocaleString("en-US")}`);
  const date = text("date") ?? text("due_date") ?? text("month");
  if (date) parts.push(`يوم ${date}`);
  for (const k of ["description", "reason", "note"]) {
    const v = text(k);
    if (v) {
      parts.push(v);
      break;
    }
  }
  return parts.join(" — ");
}

let lastNativeConfirm = 0;
let lastApproved = { channel: "", at: 0 };
if (typeof window !== "undefined" && !(window as unknown as { __confirmWrapped?: boolean }).__confirmWrapped) {
  const nativeConfirm = window.confirm.bind(window);
  window.confirm = (message?: string) => {
    const ok = nativeConfirm(message);
    lastNativeConfirm = Date.now();
    return ok;
  };
  (window as unknown as { __confirmWrapped?: boolean }).__confirmWrapped = true;
  // إلغاء التأكيد مش خطأ — منطلعش رسالة خطأ في الكونسول.
  window.addEventListener("unhandledrejection", (e) => {
    if ((e.reason as Error)?.name === "CancelledError") e.preventDefault();
  });
}

function confirmChange(channel: string, payload: unknown): boolean {
  const kind = changeKind(channel);
  if (!kind || !confirmSetting.get()) return true;
  const now = Date.now();
  if (lastApproved.channel === channel && now - lastApproved.at < 4000) {
    lastApproved.at = now;
    return true;
  }
  if (kind === "delete" && now - lastNativeConfirm < 4000) return true;
  const label = entityLabels()[channel.split(":")[0]];
  const details = describePayload(payload);
  const message =
    kind === "add"
      ? `إنت بتسجّل ${label}${details ? `:\n${details}` : ""}\n\nموافق؟`
      : `إنت بتمسح ${label}.\n\nموافق؟`;
  const ok = window.confirm(message);
  if (ok) lastApproved = { channel, at: Date.now() };
  return ok;
}

// ---------- عمولة التحويل (انستا باي) ----------
// لما فلوس تطلع من حساب عليه عمولة، بنسأل: "تحويل" (عليه العمولة) ولا "دفع"
// (من غير). الإجابة بتتبعت مع الحركة (transfer_fee) والباك إند بيسجل العمولة.
type FeeRule = { pct?: number; min?: number; max?: number | null };
const FEE_CHANNELS: Record<string, { method: string; out?: (p: Record<string, unknown>) => boolean }> = {
  "monthlyExpenses:create": { method: "payment_method" },
  "expensePayments:create": { method: "method" },
  "employeeAdvances:create": { method: "payment_method" },
  "employeeBonuses:create": { method: "payment_method" },
  "salaryPayments:create": { method: "payment_method" },
  "partnerPayments:create": { method: "method" },
  "supplierPayments:create": { method: "method" },
  "creditorEntries:create": { method: "method", out: (p) => p.type === "payment" },
  "hassanLedger:create": { method: "method", out: (p) => p.type === "repayment" || p.type === "due" },
  "hassanTreasury:create": { method: "method" },
  "installments:pay": { method: "method" },
  "custodies:create": { method: "method" },
  "waste:create": { method: "payment_method" },
  "treasury:createTransfer": { method: "from_account" },
};
const rawInvoke = (channel: string, payload?: unknown): Promise<any> => (window.api ? window.api.invoke(channel, payload) : mockInvoke(channel, payload));
let feeRulesCache: Promise<Record<string, FeeRule>> | null = null;
export const feeRulesApi = {
  get: (): Promise<Record<string, FeeRule>> => (feeRulesCache ??= rawInvoke("fees:get").catch(() => ({}))),
  set: async (rules: Record<string, FeeRule>) => {
    feeRulesCache = null;
    return rawInvoke("fees:set", { rules });
  },
};
export function feeAmount(rule: FeeRule | undefined, amount: number) {
  if (!rule || !(amount > 0) || (!rule.pct && !rule.min)) return 0;
  let fee = (amount * (Number(rule.pct) || 0)) / 100;
  fee = Math.max(fee, Number(rule.min) || 0);
  if (rule.max != null && String(rule.max) !== "") fee = Math.min(fee, Number(rule.max));
  return Math.round(fee * 100) / 100;
}

/** شباك صغير بزرارين: "تحويل" / "دفع" (أو إلغاء). */
function askTransferOrPay(account: string, amount: number, fee: number): Promise<"transfer" | "pay" | null> {
  return new Promise((resolve) => {
    const wrap = document.createElement("div");
    wrap.setAttribute("dir", "rtl");
    wrap.style.cssText = "position:fixed;inset:0;z-index:9999;background:rgba(15,23,42,.45);display:flex;align-items:center;justify-content:center;font-family:inherit";
    const name = account === "instapay" ? "انستا باي" : account === "wallet" ? "اكسيس باي" : account === "vodafone_cash" ? "فودفون كاش" : account;
    const n = (x: number) => x.toLocaleString("en-US");
    wrap.innerHTML = `<div style="background:#fff;border-radius:16px;padding:22px 24px;max-width:420px;width:92%;box-shadow:0 20px 50px rgba(0,0,0,.25)">
      <div style="font-weight:800;font-size:17px;color:#0f172a;margin-bottom:6px">الفلوس دي اتبعتت من ${name} إزاي؟</div>
      <div style="font-size:14px;color:#475569;line-height:1.8;margin-bottom:16px">«تحويل» عليه عمولة ${name}: <b>${n(fee)} ج</b> على ${n(amount)} ج — «دفع» (فاتورة/تاجر) من غير عمولة.</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button data-v="transfer" style="flex:1;background:#1d4ed8;color:#fff;border:0;border-radius:10px;padding:10px;font-weight:700;cursor:pointer">تحويل (+ ${n(fee)} ج)</button>
        <button data-v="pay" style="flex:1;background:#e2e8f0;color:#0f172a;border:0;border-radius:10px;padding:10px;font-weight:700;cursor:pointer">دفع (من غير عمولة)</button>
        <button data-v="" style="background:none;border:0;color:#64748b;padding:10px;cursor:pointer">إلغاء</button>
      </div></div>`;
    wrap.addEventListener("click", (e) => {
      const b = (e.target as HTMLElement).closest("button");
      if (!b) return;
      wrap.remove();
      const v = b.getAttribute("data-v");
      resolve(v === "transfer" ? "transfer" : v === "pay" ? "pay" : null);
    });
    document.body.appendChild(wrap);
  });
}

async function withFeeChoice(channel: string, payload: unknown): Promise<unknown> {
  const cfg = FEE_CHANNELS[channel];
  if (!cfg || !payload || typeof payload !== "object" || typeof document === "undefined") return payload;
  const p = payload as Record<string, unknown>;
  if (cfg.out && !cfg.out(p)) return payload;
  const account = String(p[cfg.method] ?? "");
  const amount = Number(p.paid_amount ?? p.amount);
  const fee = feeAmount((await feeRulesApi.get())[account], amount);
  if (!(fee > 0)) return payload;
  const choice = await askTransferOrPay(account, amount, fee);
  if (!choice) throw new CancelledError();
  return { ...p, transfer_fee: choice === "transfer" };
}

async function invoke(channel: string, payload?: unknown): Promise<any> {
  if (!confirmChange(channel, payload)) throw new CancelledError();
  const p = await withFeeChoice(channel, payload);
  return rawInvoke(channel, p);
}

export const partnersApi = {
  list: (): Promise<Partner[]> => invoke("partners:list"),
  create: (name: string, opening_balance = 0): Promise<Partner> =>
    invoke("partners:create", { name, opening_balance }),
  remove: (id: number): Promise<void> => invoke("partners:delete", { id }),
  rename: (id: number, name: string): Promise<Partner> => invoke("partners:rename", { id, name }),
  updateOpeningBalance: (id: number, opening_balance: number): Promise<Partner> =>
    invoke("partners:updateOpeningBalance", { id, opening_balance }),
};

export const employeesApi = {
  list: (): Promise<Driver[]> => invoke("employees:list"),
  create: (data: Omit<Driver, "id">): Promise<Driver> => invoke("employees:create", data),
  update: (id: number, data: Omit<Driver, "id">, effective_month?: string): Promise<Driver> =>
    invoke("employees:update", { id, ...data, effective_month }),
  remove: (id: number): Promise<void> => invoke("employees:delete", { id }),
};

export const contractorsApi = {
  list: (): Promise<Contractor[]> => invoke("contractors:list"),
  create: (name: string, opening_balance = 0): Promise<Contractor> =>
    invoke("contractors:create", { name, opening_balance }),
  remove: (id: number): Promise<void> => invoke("contractors:delete", { id }),
  updateOpeningBalance: (id: number, opening_balance: number): Promise<Contractor> =>
    invoke("contractors:updateOpeningBalance", { id, opening_balance }),
};

export const expenseCategoriesApi = {
  list: (): Promise<ExpenseCategory[]> => invoke("expenseCategories:list"),
  create: (name: string, counts_as_commission = false, own_fund = false): Promise<ExpenseCategory> =>
    invoke("expenseCategories:create", { name, counts_as_commission, own_fund }),
  update: (id: number, name: string, counts_as_commission: boolean, own_fund = false): Promise<ExpenseCategory> =>
    invoke("expenseCategories:update", { id, name, counts_as_commission, own_fund }),
  remove: (id: number): Promise<void> => invoke("expenseCategories:delete", { id }),
};

export const equipmentApi = {
  list: (): Promise<Equipment[]> => invoke("equipment:list"),
  sheetMismatches: (): Promise<EquipmentSheetMismatch[]> => invoke("equipment:sheetMismatches"),
  create: (data: {
    name: string;
    purchase_price: number;
    shares: { partner_id: number; percentage: number }[];
  }): Promise<Equipment> => invoke("equipment:create", data),
  update: (
    id: number,
    data: { purchase_price: number; shares: { partner_id: number; percentage: number }[] }
  ): Promise<Equipment> => invoke("equipment:update", { id, ...data }),
  remove: (id: number): Promise<void> => invoke("equipment:delete", { id }),
  summary: (equipment_id: number, month: string): Promise<EquipmentSummary> =>
    invoke("equipment:summary", { equipment_id, month }),
};

export const dailyLogsApi = {
  list: (equipment_id: number, month: string, role: DailyLogRole, shift_label = ""): Promise<DailyLog[]> =>
    invoke("dailyLogs:list", { equipment_id, month, role, shift_label }),
  upsert: (log: Omit<DailyLog, "id" | "day_value">): Promise<DailyLog> => invoke("dailyLogs:upsert", log),
  remove: (id: number): Promise<void> => invoke("dailyLogs:delete", { id }),
  copyFromEquipment: (
    target_equipment_id: number,
    source_equipment_id: number,
    month: string,
    source_shift_label = "",
    target_shift_label = ""
  ): Promise<{ count: number }> =>
    invoke("dailyLogs:copyFromEquipment", {
      target_equipment_id,
      source_equipment_id,
      month,
      source_shift_label,
      target_shift_label,
    }),
};

export const equipmentShiftsApi = {
  list: (equipment_id: number): Promise<EquipmentShift[]> => invoke("equipmentShifts:list", { equipment_id }),
  create: (equipment_id: number, label: string): Promise<EquipmentShift> =>
    invoke("equipmentShifts:create", { equipment_id, label }),
};

export const monthlyExpensesApi = {
  list: (equipment_id: number, month: string): Promise<MonthlyExpense[]> =>
    invoke("monthlyExpenses:list", { equipment_id, month }),
  create: (expense: Omit<MonthlyExpense, "id" | "category_name" | "paid_total" | "remaining">): Promise<MonthlyExpense> =>
    invoke("monthlyExpenses:create", expense),
  remove: (id: number): Promise<void> => invoke("monthlyExpenses:delete", { id }),
};

export const employeeAdvancesApi = {
  list: (employee_id: number, month: string): Promise<EmployeeAdvance[]> =>
    invoke("employeeAdvances:list", { employee_id, month }),
  create: (advance: Omit<EmployeeAdvance, "id">): Promise<EmployeeAdvance> =>
    invoke("employeeAdvances:create", advance),
  remove: (id: number): Promise<void> => invoke("employeeAdvances:delete", { id }),
};

export const employeeBonusesApi = {
  list: (employee_id: number, month: string): Promise<EmployeeBonus[]> =>
    invoke("employeeBonuses:list", { employee_id, month }),
  create: (bonus: Omit<EmployeeBonus, "id">): Promise<EmployeeBonus> =>
    invoke("employeeBonuses:create", bonus),
  remove: (id: number): Promise<void> => invoke("employeeBonuses:delete", { id }),
};

export const employeeDeductionsApi = {
  list: (employee_id: number, month: string): Promise<EmployeeDeduction[]> =>
    invoke("employeeDeductions:list", { employee_id, month }),
  create: (deduction: Omit<EmployeeDeduction, "id">): Promise<EmployeeDeduction> =>
    invoke("employeeDeductions:create", deduction),
  remove: (id: number): Promise<void> => invoke("employeeDeductions:delete", { id }),
};

export const payrollApi = {
  summary: (month: string): Promise<PayrollRow[]> => invoke("payroll:summary", { month }),
  detail: (employee_id: number, month: string): Promise<PayrollDetail> =>
    invoke("payroll:detail", { employee_id, month }),
};

export const salaryPaymentsApi = {
  list: (employee_id: number, month: string): Promise<SalaryPayment[]> =>
    invoke("salaryPayments:list", { employee_id, month }),
  create: (payment: Omit<SalaryPayment, "id">): Promise<SalaryPayment> => invoke("salaryPayments:create", payment),
  remove: (id: number): Promise<void> => invoke("salaryPayments:delete", { id }),
};

export const systemApi = {
  resetAll: (): Promise<void> => invoke("system:resetAll"),
  diagnoseExpenses: (): Promise<{
    total: number;
    orphaned: number;
    sample: { id: number; equipment_id: number; month: string; date: string | null; amount: number }[];
  }> => invoke("system:diagnoseExpenses"),
};

export const syncApi = {
  status: (): Promise<SyncStatus> => invoke("sync:status"),
  now: (): Promise<SyncStatus> => invoke("sync:now"),
  login: (password: string): Promise<SyncStatus> => invoke("sync:login", { password }),
  undo: (id: number | string): Promise<{ ok: boolean }> => invoke("sync:undo", { id }),
  setDeviceName: (name: string): Promise<SyncStatus> => invoke("sync:setDeviceName", { name }),
  activity: (filters: { from?: string | null; to?: string | null; device?: string | null; limit?: number }): Promise<SyncActivity> =>
    invoke("sync:activity", filters),
  // إشعار لما تعديلات توصل من جهاز تاني — بيرجع دالة لإلغاء الاشتراك.
  onRemoteChanges: (callback: (info: { count: number; devices: string[] }) => void): (() => void) =>
    window.api?.on ? window.api.on("sync:remoteChanges", callback as (data: unknown) => void) : () => {},
};

export const printApi = {
  // يطبع/يحفظ الصفحة الحالية PDF بصفحاتها زي ما هي (من غير تصغير لورقة واحدة).
  savePdf: async (fileName: string): Promise<{ saved: boolean; filePath?: string }> => {
    if (!window.api) {
      window.print();
      return { saved: true };
    }
    // اللاب بيرجع مكان الملف (أو null لو اتلغى)، والتابلت بيفتح شاشة الطباعة.
    const r = await window.api.invoke("print:savePdf", { name: fileName.replace(/[\\/:*?"<>|]/g, "-"), singlePage: false, pages: true });
    return typeof r === "string" ? { saved: true, filePath: r } : { saved: r !== null };
  },
};

export const paperSheetsApi = {
  list: (equipment_id: number, month: string): Promise<PaperSheet[]> => invoke("paperSheets:list", { equipment_id, month }),
  create: (s: { equipment_id: number; month: string; image: string; note: string | null }) => invoke("paperSheets:create", s),
  replace: (id: number, image: string) => invoke("paperSheets:replace", { id, image }),
  remove: (id: number) => invoke("paperSheets:delete", { id }),
};

export const appApi = {
  getVersion: (): Promise<string> => invoke("app:getVersion"),
  checkForUpdate: (): Promise<AppUpdateStatus> => invoke("app:checkForUpdate"),
  // على التابلت: بينزّل ملف النسخة الجديدة جوه البرنامج ويفتح شاشة التثبيت.
  installUpdate: (url?: string): Promise<void> => invoke("app:installUpdate", url ? { url } : undefined),
  onUpdateProgress: (callback: (info: { percent: number }) => void): (() => void) =>
    window.api?.on ? window.api.on("app:updateProgress", callback as (data: unknown) => void) : () => {},
};

export const hassanApi = {
  commissionSummary: (month: string): Promise<HassanCommissionSummary> =>
    invoke("hassan:commissionSummary", { month }),
  equipmentCommission: (equipment_id: number, month: string): Promise<HassanEquipmentCommissionDetail> =>
    invoke("hassan:equipmentCommission", { equipment_id, month }),
  ledgerList: (month: string): Promise<HassanLedgerEntry[]> => invoke("hassanLedger:list", { month }),
  ledgerCreate: (entry: Omit<HassanLedgerEntry, "id">): Promise<HassanLedgerEntry> =>
    invoke("hassanLedger:create", entry),
  ledgerRemove: (id: number): Promise<void> => invoke("hassanLedger:delete", { id }),
  ledgerUpdate: (entry: HassanLedgerEntry): Promise<HassanLedgerEntry> => invoke("hassanLedger:update", entry),
  renameParty: (from: string, to: string) => invoke("hassanLedger:renameParty", { from, to }),
  deleteParty: (name: string) => invoke("hassanLedger:deleteParty", { name }),
  partyEntries: (name: string): Promise<HassanLedgerEntry[]> => invoke("hassanLedger:partyEntries", { name }),
  balance: (): Promise<HassanBalance> => invoke("hassanLedger:balance"),
  balanceByParty: (): Promise<HassanPartyBalance[]> => invoke("hassanLedger:balanceByParty"),
  treasuryBalance: (month: string): Promise<HassanTreasuryBalance> => invoke("hassan:treasuryBalance", { month }),
  treasuryList: (month: string): Promise<HassanTreasuryExpense[]> => invoke("hassanTreasury:list", { month }),
  treasuryCreate: (expense: Omit<HassanTreasuryExpense, "id">): Promise<HassanTreasuryExpense> =>
    invoke("hassanTreasury:create", expense),
  treasuryRemove: (id: number): Promise<void> => invoke("hassanTreasury:delete", { id }),
  treasuryCategories: (): Promise<string[]> => invoke("hassanTreasury:categories"),
  penaltiesList: (month: string): Promise<HassanPenalty[]> => invoke("hassanPenalties:list", { month }),
  penaltyCreate: (penalty: Omit<HassanPenalty, "id">): Promise<HassanPenalty> => invoke("hassanPenalties:create", penalty),
  penaltyRemove: (id: number): Promise<void> => invoke("hassanPenalties:delete", { id }),
  workersList: (): Promise<HassanWorker[]> => invoke("hassanWorkers:list"),
  workerCreate: (worker: {
    name: string;
    job: string | null;
    monthly_salary: number;
    start_month: string;
    day_rate: number | null;
    leave_rate: number | null;
  }): Promise<HassanWorker> =>
    invoke("hassanWorkers:create", worker),
  workerUpdate: (worker: {
    id: number;
    name: string;
    job: string | null;
    monthly_salary: number;
    day_rate: number | null;
    leave_rate: number | null;
  }): Promise<HassanWorker> =>
    invoke("hassanWorkers:update", worker),
  workerRemove: (id: number): Promise<void> => invoke("hassanWorkers:delete", { id }),
  workerEntriesList: (month: string): Promise<HassanWorkerEntry[]> => invoke("hassanWorkerEntries:list", { month }),
  workerEntryCreate: (entry: {
    worker_id: number;
    month: string;
    date: string;
    type: HassanWorkerEntryType;
    amount: number;
    note: string | null;
    method?: string;
  }): Promise<HassanWorkerEntry> => invoke("hassanWorkerEntries:create", entry),
  workerEntryRemove: (id: number): Promise<void> => invoke("hassanWorkerEntries:delete", { id }),
  workersPayroll: (month: string): Promise<HassanWorkerPayroll> => invoke("hassanWorkers:payroll", { month }),
};

export const contractorPaymentsApi = {
  list: (contractor_id: number): Promise<ContractorPayment[]> =>
    invoke("contractorPayments:list", { contractor_id }),
  create: (payment: Omit<ContractorPayment, "id">): Promise<ContractorPayment> =>
    invoke("contractorPayments:create", payment),
  remove: (id: number): Promise<void> => invoke("contractorPayments:delete", { id }),
};

export const contractorsDashboardApi = {
  summary: (): Promise<ContractorSummary[]> => invoke("contractors:summary"),
  detail: (contractor_id: number): Promise<ContractorDetail> => invoke("contractors:detail", { contractor_id }),
};

export const partnerPaymentsApi = {
  list: (partner_id: number): Promise<PartnerPayment[]> => invoke("partnerPayments:list", { partner_id }),
  create: (payment: Omit<PartnerPayment, "id">): Promise<PartnerPayment> =>
    invoke("partnerPayments:create", payment),
  remove: (id: number): Promise<void> => invoke("partnerPayments:delete", { id }),
};

export const partnersDashboardApi = {
  summary: (): Promise<PartnerSummary[]> => invoke("partners:summary"),
  detail: (partner_id: number, month: string): Promise<PartnerDetail> =>
    invoke("partners:detail", { partner_id, month }),
};

export const treasuryApi = {
  monthMovements: (month: string, direction: "in" | "out"): Promise<MonthMovement[]> => invoke("treasury:monthMovements", { month, direction }),
  movementUpdate: (m: { src: string; src_id: number; date: string; amount: number; account: string }) => invoke("treasury:movementUpdate", m),
  movementDelete: (src: string, src_id: number) => invoke("treasury:movementDelete", { src, src_id }),
  list: (): Promise<TreasuryAccount[]> => invoke("treasury:list"),
  setOpening: (id: number, opening_balance: number, opening_date: string | null): Promise<void> =>
    invoke("treasury:setOpening", { id, opening_balance, opening_date }),
  summary: (month: string): Promise<TreasurySummaryRow[]> => invoke("treasury:summary", { month }),
  accountTransactions: (account_name: TreasuryAccountName, month: string): Promise<TreasuryStatement> =>
    invoke("treasury:accountTransactions", { account_name, month }),
  previewCount: (account_name: TreasuryAccountName, date: string): Promise<{ expected: number }> =>
    invoke("treasury:previewCount", { account_name, date }),
  count: (
    account_name: TreasuryAccountName,
    date: string,
    counted: number,
    note: string | null
  ): Promise<{ expected: number; counted: number; difference: number }> =>
    invoke("treasury:count", { account_name, date, counted, note }),
  deleteAdjustment: (id: number): Promise<void> => invoke("treasury:deleteAdjustment", { id }),
  createTransfer: (t: { date: string; from_account: string; to_account: string; amount: number; note: string | null }): Promise<void> =>
    invoke("treasury:createTransfer", t),
  deleteTransfer: (id: number): Promise<void> => invoke("treasury:deleteTransfer", { id }),
  createOtherIncome: (i: { date: string; amount: number; method: string; description: string | null }): Promise<void> =>
    invoke("otherIncome:create", i),
  deleteOtherIncome: (id: number): Promise<void> => invoke("otherIncome:delete", { id }),
  extras: (month: string): Promise<TreasuryExtras> => invoke("treasury:extras", { month }),
};

export const payablesApi = {
  summary: (month: string): Promise<PayablesSummary> => invoke("payables:summary", { month }),
  pay: (p: { expense_id: number; date: string; amount: number; method: string; note: string | null }): Promise<void> =>
    invoke("expensePayments:create", p),
  removePayment: (id: number): Promise<void> => invoke("expensePayments:delete", { id }),
};

export const suppliersApi = {
  names: (): Promise<string[]> => invoke("suppliers:names"),
  dashboard: (): Promise<SupplierDashboardRow[]> => invoke("suppliers:dashboard"),
  createPurchase: (purchase: {
    supplier_name: string;
    date: string;
    description: string | null;
    amount: number;
    note: string | null;
  }): Promise<SupplierPurchase> => invoke("supplierPurchases:create", purchase),
  removePurchase: (id: number): Promise<void> => invoke("supplierPurchases:delete", { id }),
  createPayment: (payment: {
    supplier_name: string;
    date: string;
    amount: number;
    method: string;
    note: string | null;
  }): Promise<SupplierPayment> => invoke("supplierPayments:create", payment),
  removePayment: (id: number): Promise<void> => invoke("supplierPayments:delete", { id }),
};

export const reportsApi = {
  monthly: (month: string): Promise<MonthlyReport> => invoke("reports:monthly", { month }),
};

export const dashboardApi = {
  summary: (): Promise<DashboardSummary> => invoke("dashboard:summary"),
  monthDues: (month: string): Promise<DashboardMonthDues> => invoke("dashboard:monthDues", { month }),
};

export const wasteApi = {
  list: (month: string): Promise<WasteEntry[]> => invoke("waste:list", { month }),
  create: (entry: Omit<WasteEntry, "id">): Promise<WasteEntry> => invoke("waste:create", entry),
  remove: (id: number): Promise<void> => invoke("waste:delete", { id }),
};

export const outgoingIncomingApi = {
  outgoing: (month: string): Promise<OutgoingSummary> => invoke("outgoing:list", { month }),
  incoming: (month: string): Promise<IncomingSummary> => invoke("incoming:list", { month }),
};

export const creditorsApi = {
  list: (): Promise<CreditorBalance[]> => invoke("creditors:list"),
  create: (c: { name: string; opening_balance: number; note: string | null }) => invoke("creditors:create", c),
  update: (c: { id: number; name: string; opening_balance: number; note: string | null }) => invoke("creditors:update", c),
  remove: (id: number) => invoke("creditors:delete", { id }),
  statement: (id: number): Promise<CreditorStatement> => invoke("creditors:statement", { id }),
  addEntry: (e: { creditor_id: number; date: string; type: "debt" | "payment"; amount: number; method: string | null; note: string | null }) =>
    invoke("creditorEntries:create", e),
  removeEntry: (id: number) => invoke("creditorEntries:delete", { id }),
};

export const custodyApi = {
  list: (): Promise<Custody[]> => invoke("custodies:list"),
  create: (c: { holder: string; date: string; amount: number; method: string; warn_amount: number | ""; note: string | null }): Promise<Custody> =>
    invoke("custodies:create", c),
  update: (c: { id: number; holder: string; warn_amount: number; note: string | null }) => invoke("custodies:update", c),
  setClosed: (id: number, closed: boolean) => invoke("custodies:setClosed", { id, closed }),
  remove: (id: number) => invoke("custodies:delete", { id }),
  statement: (id: number): Promise<CustodyStatement> => invoke("custodies:statement", { id }),
  addEntry: (e: {
    custody_id: number;
    date: string;
    type: "expense" | "topup" | "return";
    amount: number;
    description: string | null;
    method?: string | null;
    target?: CustodyTarget;
    equipment_id?: number | null;
    category_id?: number | null;
    supplier_name?: string | null;
    car_kind?: string | null;
    employee_id?: number | null;
    salary_month?: string | null;
  }): Promise<Custody> => invoke("custodyEntries:create", e),
  removeEntry: (id: number) => invoke("custodyEntries:delete", { id }),
};

export const carApi = {
  summary: (month: string): Promise<CarSummary> => invoke("car:summary", { month }),
  ensureCategory: (): Promise<{ id: number }> => invoke("car:ensureCategory"),
  addFuel: (f: { date: string; kind: string; amount: number; note: string | null }): Promise<CarSummary> => invoke("carFuel:create", f),
  removeFuel: (id: number) => invoke("carFuel:delete", { id }),
};

export const obligationsApi = {
  list: (): Promise<Obligation[]> => invoke("obligations:list"),
  create: (o: { title: string; kind: string; amount: number | null; due_date: string; repeat_monthly: boolean; note: string | null }) =>
    invoke("obligations:create", o),
  remove: (id: number) => invoke("obligations:delete", { id }),
  done: (id: number) => invoke("obligations:done", { id }),
  reopen: (id: number) => invoke("obligations:reopen", { id }),
};

export const alertsApi = {
  dashboard: (): Promise<DashboardAlert[]> => invoke("alerts:dashboard"),
};

export const attendanceApi = {
  list: (worker_id: number, month: string): Promise<AttendanceRow[]> => invoke("hassanAttendance:list", { worker_id, month }),
  set: (worker_id: number, date: string, status: AttendanceStatus | null) => invoke("hassanAttendance:set", { worker_id, date, status }),
};

export const fundsApi = {
  list: (month: string): Promise<FundSummary[]> => invoke("funds:list", { month }),
  detail: (category_id: number, month: string): Promise<FundDetail> => invoke("funds:detail", { category_id, month }),
  addExpense: (e: { category_id: number; date: string; amount: number; description: string | null }) => invoke("fundExpenses:create", e),
  removeExpense: (id: number) => invoke("fundExpenses:delete", { id }),
};

// باسورد الأقساط: الشاشة بتبعت hash بس (SHA-256) — الباسورد نفسه مبيتخزنش.
export async function hashPin(pin: string): Promise<string> {
  const bytes = new TextEncoder().encode(`mk-installments:${pin}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export const installmentsApi = {
  lockStatus: (): Promise<{ locked: boolean }> => invoke("installments:lockStatus"),
  checkLock: async (pin: string): Promise<boolean> => (await invoke("installments:checkLock", { hash: await hashPin(pin) })).ok,
  setLock: async (oldPin: string | null, newPin: string | null) =>
    invoke("installments:setLock", { oldHash: oldPin ? await hashPin(oldPin) : null, hash: newPin ? await hashPin(newPin) : null }),
  list: (): Promise<HassanInstallment[]> => invoke("installments:list"),
  create: (i: { title: string; amount: number; count: number | null; start_date: string; note: string | null }) => invoke("installments:create", i),
  update: (i: { id: number; title: string; amount: number; count: number | null; start_date: string; note: string | null }) =>
    invoke("installments:update", i),
  remove: (id: number, withPayments: boolean) => invoke("installments:delete", { id, withPayments }),
  pay: (id: number, date: string, method: string, amount?: number) => invoke("installments:pay", { id, date, method, amount }),
  removePayment: (id: number) => invoke("installmentPayments:delete", { id }),
};
