import { Db, UserError } from "../core/db";
import { clientsView, contractOptions, dashboardView, investorsView, managementView, sarkiView, settingsView, suppliersView, taxView, TreasuryFilters, treasuryView } from "../core/services/views";
import { activityView, runAction, undoAction } from "../core/services/activity";
import { formatPounds } from "../core/calc/money";
import { closeMonth, recordAdjustment } from "../core/services/close";
import { today } from "../core/db";
import { deleteEntity, deletePreview, restoreDeleted } from "../core/services/deletion";
import { createClient, createEquipment, createExpenseCategory, createInvestor, createSupplier, setRates, setWithholding, updateInvestor, newContract, NewContractInput, setClientTaxes, updateClient, updateEquipment, updateSupplier, endContract, reopenContract, renameContract } from "../core/services/master";
import { ManagerShare, setContractManagers } from "../core/services/managers";
import { markDelivered, Money, recordHold, recordTransfer, returnHold, saveAccount } from "../core/services/ledger";
import { recordCapital, recordClientPayment, recordExpense, recordPayout, recordSupplierDeduction, recordSupplierPayment, recordTaxPayment, reinvestProfit } from "../core/services/ledger";
import { assistantApply, AssistantAction, assistantContext, assistantFacts, assistantPreview, CallRunner, hasDelete, hasNotUndoable } from "../core/ai/assistant";
import { chatAdd, chatList, chatUpdate, myName, setMyName, teamLogView, teamNames } from "../core/services/team";
import { PASSWORD_CALLS, READ_CATALOG, toHuman, toInternal, WRITE_CATALOG } from "../core/ai/catalog";
import { createDriver, DriverInput, driversView, recordDriverPayment, updateDriver } from "../core/services/drivers";
import { applyOvertime, clearRange, DayPatch, fillRange, getPartySheet, setSupplierRate, Side, upsertDay } from "../core/services/sarki";

// Every screen call goes through one channel ("core:call") to a named function
// here. Only names listed in this registry can be called from the window.
// Errors come back as { ok: false, message } so Arabic messages reach the
// screen untouched (Electron prefixes thrown errors otherwise).
export function makeRegistry(db: Db) {
  return {
    dashboard: (a: { month?: string }) => dashboardView(db, a.month),

    // السركي
    sarki: (a: { contractId?: number; month?: string }) => sarkiView(db, a.contractId, a.month),
    contractOptions: () => contractOptions(db),
    newContract: (a: NewContractInput) => newContract(db, a),
    upsertDay: (a: { contractId: number; date: string; side: Side; patch: DayPatch }) => upsertDay(db, a.contractId, a.date, a.side, a.patch),
    fillRange: (a: { contractId: number; from: string; to: string; dayRatePt?: number | null; siteName?: string | null; baseHoursMilli?: number }) =>
      fillRange(db, a.contractId, "client", a.from, a.to, { dayRatePt: a.dayRatePt, siteName: a.siteName, baseHoursMilli: a.baseHoursMilli }),
    clearRange: (a: { contractId: number; from: string; to: string; reason: string }) => clearRange(db, a.contractId, "client", a.from, a.to, a.reason),
    applyOvertime: (a: { contractId: number; month: string; days: string; hoursMilli: number; ratePt: number | null }) =>
      applyOvertime(db, a.contractId, "client", a.month, a.days, a.hoursMilli, a.ratePt),
    setSupplierRate: (a: { contractId: number; from: string; to: string; dayRatePt?: number | null; overtimeRatePt?: number | null }) =>
      setSupplierRate(db, a.contractId, a.from, a.to, { dayRatePt: a.dayRatePt, overtimeRatePt: a.overtimeRatePt }),

    // أصحاب المعدات
    suppliers: (a: { supplierId?: number }) => suppliersView(db, a.supplierId),
    createSupplier: (a: { name: string; phone?: string }) => createSupplier(db, a),
    updateSupplier: (a: { id: number; name: string; phone?: string | null }) => updateSupplier(db, a.id, a),
    createEquipment: (a: { name: string; supplierId: number; siteName?: string; supplierRatePt?: number }) => createEquipment(db, a),
    updateEquipment: (a: { id: number; name: string; siteName?: string | null; supplierRatePt?: number | null }) => updateEquipment(db, a.id, a),
    endContract: (a: { id: number; endDate: string }) => endContract(db, a.id, a.endDate),
    reopenContract: (a: { id: number }) => reopenContract(db, a.id),
    renameContract: (a: { id: number; name: string }) => renameContract(db, a.id, a.name),
    partySheet: (a: { contractId: number; month: string; side: Side }) => getPartySheet(db, a.contractId, a.month, a.side),
    supplierPayment: (a: { supplierId: number; contractId?: number | null; date: string; amountPt: number; note?: string; forMonth?: string | null; confirmNegative?: boolean } & Money) =>
      recordSupplierPayment(db, a, { confirmNegative: a.confirmNegative }),
    supplierDeduction: (a: { supplierId: number; contractId?: number | null; date: string; amountPt: number; note: string; paidFromTreasury?: boolean; confirmNegative?: boolean } & Money) =>
      recordSupplierDeduction(db, a, { confirmNegative: a.confirmNegative }),

    // الشركاء: اسم الشريك على الجهاز ده، مين عمل إيه، ومحادثة المساعد المشتركة
    me: () => myName(db),
    setMe: (a: { name: string }) => setMyName(db, a.name),
    teamNames: () => teamNames(db),
    teamLog: (a: { from?: string; to?: string }) => teamLogView(db, a),
    chatList: (a: { limit?: number }) => chatList(db, a.limit),
    chatAdd: (a: { role: "user" | "assistant"; text: string; extra?: unknown }) => chatAdd(db, a),
    chatUpdate: (a: { id: number; extra: unknown }) => chatUpdate(db, a.id, a.extra),

    // المساعد (الكلام بيتفهم على السيرفر، والتسجيل هنا بنفس دوال البرنامج)
    assistantContext: () => assistantContext(db),
    assistantPreview: (a: { actions: AssistantAction[] }) => assistantPreview(db, a.actions, assistantCalls(db, true)),
    assistantFacts: () => assistantFacts(db),
    assistantRead: (a: { fn: string; args?: Record<string, unknown> | null }) => {
      if (!Object.prototype.hasOwnProperty.call(READ_CATALOG, a.fn)) throw new UserError(`مفيش قراية اسمها «${a.fn}»`);
      const f = (makeRegistry(db) as unknown as Record<string, (x: unknown) => unknown>)[a.fn];
      return toHuman(f(toInternal(a.args ?? {}, a.fn)));
    },
    // المسح (وأي حاجة مبترجعش) من المساعد مش من هنا: لازم باسورد الشركة (shell:assistantApplyDeletes)
    assistantApply: (a: { actions: AssistantAction[]; summary?: string }) => {
      if (hasDelete(a.actions)) throw new UserError("دي محتاجة باسورد الشركة");
      return assistantApply(db, a.actions, assistantCalls(db, false));
    },

    // السواقين
    drivers: (a: { month?: string; driverId?: number }) => driversView(db, a.month, a.driverId),
    createDriver: (a: DriverInput) => createDriver(db, a),
    updateDriver: (a: DriverInput & { id: number }) => updateDriver(db, a.id, a),
    driverPayment: (a: { driverId: number; date: string; amountPt: number; note?: string; confirmNegative?: boolean } & Money) =>
      recordDriverPayment(db, a, { confirmNegative: a.confirmNegative }),

    // الشركات والأفراد
    clients: (a: { clientId?: number }) => clientsView(db, a.clientId),
    createClient: (a: { kind: "company" | "individual"; name: string; phone?: string; taxId?: string; vatApplies?: boolean; tax5Applies?: boolean }) => createClient(db, a),
    updateClient: (a: { id: number; kind: "company" | "individual"; name: string; phone?: string | null; taxId?: string | null }) => updateClient(db, a.id, a),
    setClientTaxes: (a: { id: number; vatApplies: boolean; tax5Applies: boolean }) => setClientTaxes(db, a.id, a.vatApplies, a.tax5Applies),
    clientPayment: (a: { clientId: number; contractId?: number | null; date: string; amountPt: number; note?: string; forMonth?: string | null } & Money) => recordClientPayment(db, a),

    // الإدارة
    management: (a: { month?: string }) => managementView(db, a.month),
    createExpenseCategory: (a: { name: string }) => createExpenseCategory(db, a.name),
    expense: (a: { kind: "contract" | "general"; contractId?: number | null; categoryId?: number | null; date: string; amountPt: number; note?: string; paidBy?: string | null; confirmNegative?: boolean } & Money) =>
      recordExpense(db, a, { confirmNegative: a.confirmNegative }),
    managementPayout: (a: { date: string; amountPt: number; note?: string; managerName?: string | null; confirmNegative?: boolean } & Money) =>
      recordPayout(db, { ...a, payee: "management" }, { confirmNegative: a.confirmNegative }),
    setContractManagers: (a: { contractId: number; managers: ManagerShare[] }) => setContractManagers(db, a.contractId, a.managers),
    closeMonth: (a: { month: string }) => {
      closeMonth(db, a.month, today());
    },
    adjustment: (a: { targetMonth: string; contractId: number; kind: "client_base" | "supplier_cost"; amountPt: number; reason: string }) =>
      recordAdjustment(db, { ...a, appliedMonth: today().slice(0, 7) }),

    // المستثمرين
    investors: (a: { month?: string }) => investorsView(db, a.month),
    createInvestor: (a: { name: string; phone?: string }) => createInvestor(db, a),
    updateInvestor: (a: { id: number; name: string; phone?: string | null }) => updateInvestor(db, a.id, a),
    capital: (a: { investorId: number; kind: "deposit" | "withdrawal"; date: string; amountPt: number; note?: string; confirmNegative?: boolean } & Money) =>
      recordCapital(db, a, { confirmNegative: a.confirmNegative }),
    investorPayout: (a: { investorId: number; date: string; amountPt: number; note?: string; confirmNegative?: boolean } & Money) =>
      recordPayout(db, { ...a, payee: "investor" }, { confirmNegative: a.confirmNegative }),
    reinvest: (a: { investorId: number; date: string; amountPt: number }) => reinvestProfit(db, a),

    // الخزنة
    treasury: (a: TreasuryFilters) => treasuryView(db, a),
    accounts: () =>
      db.prepare("SELECT key, name, fee_bp AS feeBp, fee_min_pt AS feeMinPt, fee_max_pt AS feeMaxPt FROM treasury_accounts WHERE deleted_at IS NULL ORDER BY sort, id").all() as {
        key: string;
        name: string;
        feeBp: number;
        feeMinPt: number;
        feeMaxPt: number | null;
      }[],
    transfer: (a: { date: string; from: string; to: string; amountPt: number; note?: string; transferFee?: boolean }) => recordTransfer(db, a),
    markDelivered: (a: { id: number; date: string }) => markDelivered(db, a.id, a.date),
    hold: (a: { date: string; account?: string; amountPt: number; heldBy: string; note?: string }) => recordHold(db, a),
    returnHold: (a: { id: number; date: string }) => returnHold(db, a.id, a.date),
    saveAccount: (a: { key?: string; name: string; feeBp: number; feeMinPt: number; feeMaxPt: number | null }) => saveAccount(db, a),

    // الملف الضريبي
    tax: () => taxView(db),
    taxPayment: (a: { tax: "vat" | "tax5"; periodMonth?: string; date: string; amountPt: number; receiptNo?: string; note?: string } & Money) => recordTaxPayment(db, a),

    // سجل التعديلات + الإعدادات
    activity: (a: { from?: string; to?: string }) => activityView(db, a),
    undo: (a: { actionId: string }) => undoAction(db, a.actionId).actionId,
    settings: () => settingsView(db),
    setWithholding: (a: { effectiveFrom: string; bp: number }) => setWithholding(db, a.effectiveFrom, a.bp),
    setRates: (a: { effectiveFrom: string; vat: number; tax5: number; management: number }) =>
      setRates(db, a.effectiveFrom, { vat: a.vat, tax5: a.tax5, management_share: a.management, investors_share: 10_000 - a.management }),

    // حذف
    deletePreview: (a: { entity: Parameters<typeof deletePreview>[1]; id: number }) => deletePreview(db, a.entity, a.id),
    delete: (a: { entity: Parameters<typeof deleteEntity>[1]; id: number }) => deleteEntity(db, a.entity, a.id),
    restore: (a: { batch: string }) => restoreDeleted(db, a.batch),
  };
}

export type Registry = ReturnType<typeof makeRegistry>;

const egp = (pt: number) => `${formatPounds(pt)} ج`;
const day = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;

/** Every call that changes something gets a line in سجل التعديلات (and can be undone). */
function labelFor(db: Db, fn: string, a: any): string | null {
  switch (fn) {
    case "newContract":
      return "عقد جديد";
    case "upsertDay":
      return a.side === "supplier" ? `السركي: أسعار صاحب المعدة يوم ${day(a.date)}` : `السركي: يوم ${day(a.date)}`;
    case "fillRange":
      return `السركي: ملء الأيام من ${day(a.from)} لـ ${day(a.to)}`;
    case "clearRange":
      return `السركي: مشتغلش من ${day(a.from)} لـ ${day(a.to)}`;
    case "applyOvertime":
      return `السركي: أوفر تايم أيام ${a.days}`;
    case "setSupplierRate":
      return `السركي: أسعار صاحب المعدة من ${day(a.from)} لـ ${day(a.to)}`;
    case "createSupplier":
      return `صاحب معدة جديد: ${a.name}`;
    case "updateSupplier":
      return `تعديل صاحب معدة: ${a.name}`;
    case "createEquipment":
      return `معدة جديدة: ${a.name}`;
    case "endContract":
      return `العقد خلص يوم ${day(a.endDate)}`;
    case "renameContract":
      return a.name?.trim() ? `اسم العقد: ${a.name.trim()}` : "شيل اسم العقد";
    case "reopenContract":
      return "رجوع العقد شغال";
    case "updateEquipment":
      return `تعديل معدة: ${a.name}`;
    case "supplierPayment":
      return `دفعة لصاحب معدة ${egp(a.amountPt)}`;
    case "supplierDeduction":
      return `خصم لحساب صاحب معدة ${egp(a.amountPt)} — ${a.note}`;
    case "assistantApply":
    case "assistantApplyDeletes":
      return `المساعد: ${String(a.summary ?? "").slice(0, 80) || `${(a.actions ?? []).length} حاجة`}`;
    case "createDriver":
      return `سواق جديد: ${a.name}`;
    case "updateDriver":
      return `تعديل سواق: ${a.name}`;
    case "driverPayment": {
      const d = db.prepare("SELECT name FROM drivers WHERE id = ?").get(a.driverId) as { name: string } | undefined;
      return `فلوس للسواق ${d?.name ?? ""} ${egp(a.amountPt)} (على صاحب المعدة)`;
    }
    case "createClient":
      return `عميل جديد: ${a.name}`;
    case "updateClient":
      return `تعديل عميل: ${a.name}`;
    case "setClientTaxes":
      return `ضرايب العميل: ${a.vatApplies ? "عليه ١٤٪" : "من غير ١٤٪"} / ${a.tax5Applies ? "عليه ٥٪" : "من غير ٥٪"}`;
    case "clientPayment":
      return `دفعة من عميل ${egp(a.amountPt)}`;
    case "createExpenseCategory":
      return `بند مصروف جديد: ${a.name}`;
    case "expense":
      return `${a.kind === "general" ? "مصروف عام" : "مصروف عقد"} ${egp(a.amountPt)}${a.paidBy ? ` — دفعه ${a.paidBy} من جيبه` : ""}${a.note ? ` — ${a.note}` : ""}`;
    case "transfer":
      return `تحويل ${egp(a.amountPt)} بين حسابات الخزنة`;
    case "markDelivered":
      return "فلوس وصلت الخزنة";
    case "hold":
      return `فلوس من الخزنة مع ${a.heldBy} ${egp(a.amountPt)}`;
    case "returnHold":
      return "فلوس رجعت الخزنة";
    case "saveAccount":
      return `حساب الخزنة: ${a.name}`;
    case "managementPayout":
      return a.note?.startsWith("رد فلوس الهالك")
        ? `رجّعت لـ ${a.managerName} ${egp(a.amountPt)} صرفها من جيبه`
        : `صرف من نصيب الإدارة ${egp(a.amountPt)}${a.managerName ? ` لـ ${a.managerName}` : ""}`;
    case "setContractManagers": {
      const c = db.prepare("SELECT code FROM contracts WHERE id = ?").get(a.contractId) as { code: string } | undefined;
      return `شركاء الإدارة في العقد ${c?.code ?? ""}`;
    }
    case "closeMonth":
      return `قفل شهر ${a.month}`;
    case "adjustment":
      return `تسوية ${egp(a.amountPt)} — ${a.reason}`;
    case "createInvestor":
      return `مستثمر جديد: ${a.name}`;
    case "updateInvestor":
      return `تعديل مستثمر: ${a.name}`;
    case "capital":
      return `${a.kind === "deposit" ? "إيداع" : "سحب"} رأس مال ${egp(a.amountPt)}`;
    case "investorPayout":
      return `صرف أرباح لمستثمر ${egp(a.amountPt)}`;
    case "reinvest":
      return `أرباح اتحطت في رأس المال ${egp(a.amountPt)}`;
    case "taxPayment":
      return `دفع ضرايب ${a.tax === "vat" ? "١٤٪" : "٥٪"} ${egp(a.amountPt)}`;
    case "setRates":
      return `تغيير النسب من ${a.effectiveFrom}`;
    case "setWithholding":
      return `الاستقطاع ${a.bp / 100}٪ من ${a.effectiveFrom}`;
    case "delete": {
      try {
        return `حذف: ${deletePreview(db, a.entity, a.id).items[0] ?? ""}`;
      } catch {
        return "حذف";
      }
    }
    case "restore":
      return "رجوع حاجة محذوفة";
    default:
      return null;
  }
}

/** الحاجات اللي بتعرض بس (من غير تعديل) — دي بس اللي بتشتغل والاشتراك خالص */
const READ_CALLS = new Set(["me", "teamNames", "teamLog", "chatList", "assistantContext", "assistantFacts", "assistantPreview", "assistantRead", "drivers", "dashboard", "sarki", "contractOptions", "suppliers", "partySheet", "clients", "management", "investors", "treasury", "accounts", "tax", "activity", "settings", "deletePreview"]);
export const isReadCall = (fn: string) => READ_CALLS.has(fn);

/** التشغيل: أي قناة بتعدّل أو بتضيف (create / delete / update / set …) — بتتقفل والاشتراك خالص */
export const isOperationsWrite = (channel: string) =>
  /^sync:undo$/.test(channel) || /:(create|delete|update|upsert|set|pay|done|reopen|replace|rename|reset|movement)/.test(channel);

/** المساعد لما فيه مسح: بيتنده بعد ما باسورد الشركة يتأكد (في main / backend). */
export function assistantDeletesRegistry(db: Db) {
  return { assistantApplyDeletes: (a: { actions: AssistantAction[]; summary?: string }) => assistantApply(db, a.actions, assistantCalls(db, true)) } as unknown as Registry;
}

/**
 * المساعد بينفذ أي دالة تعديل من القايمة (core/ai/catalog.ts) بنفس دوال الشاشات.
 * الفلوس جاية بالجنيه وبتتحوّل هنا. withPassword = الباسورد اتأكد (أو معاينة بس).
 */
function assistantCalls(db: Db, withPassword: boolean): CallRunner {
  return (fn, raw) => {
    if (!Object.prototype.hasOwnProperty.call(WRITE_CATALOG, fn)) throw new UserError(`المساعد ميعرفش يعمل «${fn}»`);
    if (PASSWORD_CALLS.has(fn) && !withPassword) throw new UserError("دي محتاجة باسورد الشركة");
    const args: Record<string, unknown> = { ...(toInternal(raw, fn) as Record<string, unknown>), confirmNegative: true };
    const label = labelFor(db, fn, args) ?? fn;
    if (fn === "delete") {
      const p = deletePreview(db, args.entity as Parameters<typeof deletePreview>[1], Number(args.id));
      if (p.blocked) throw new UserError(p.blocked);
    }
    const f = (makeRegistry(db) as unknown as Record<string, (x: unknown) => unknown>)[fn];
    f(args);
    return label;
  };
}

export function callCore(db: Db, registry: Registry, fn: string, args: unknown) {
  const f = (registry as Record<string, (a: unknown) => unknown>)[fn];
  if (!f) return { ok: false, message: `unknown call ${fn}` };
  try {
    const label = labelFor(db, fn, args ?? {});
    if (!label) return { ok: true, value: f(args ?? {}) };
    const r = runAction(db, label, () => f(args ?? {}));
    // closing a month, corrections and rate changes stay in the log but can't be undone
    return { ok: true, value: r.value, actionId: r.actionId, label, undoable: !["closeMonth", "adjustment", "setRates", "setWithholding"].includes(fn) && !(fn.startsWith("assistantApply") && hasNotUndoable((args as { actions?: AssistantAction[] })?.actions ?? [])) };
  } catch (err) {
    if (err instanceof UserError) return { ok: false, message: err.message, code: err.code };
    // SQLite RAISE(ABORT, '...') messages from the guard triggers are Arabic and meant for the user
    const msg = String((err as Error)?.message ?? err);
    if (/[؀-ۿ]/.test(msg)) return { ok: false, message: msg, code: "db" };
    if (msg.includes("UNIQUE")) return { ok: false, message: "فيه حاجة متسجلة بنفس الاسم قبل كده", code: "unique" };
    console.error(err);
    return { ok: false, message: "حصلت مشكلة غير متوقعة — جرّب تاني", code: "internal" };
  }
}
