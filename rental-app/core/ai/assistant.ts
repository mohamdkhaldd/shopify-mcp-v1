import { Db, today, UserError } from "../db";
import { formatPounds } from "../calc/money";
import { createClient, createEquipment, createExpenseCategory, createSupplier, newContract } from "../services/master";
import { recordClientPayment, recordExpense, recordSupplierDeduction, recordSupplierPayment } from "../services/ledger";
import { createDriver, recordDriverPayment } from "../services/drivers";
import { fillRange } from "../services/sarki";
import { computeBooks } from "../services/books";
import { managersReport } from "../services/managers";
import { clientStatement, supplierStatement } from "../services/reports";
import { Deletable, deleteEntity, deletePreview } from "../services/deletion";

// المساعد: المستخدم بيكتب بالعامية ("دخلت لودر صاحبه محمد لشركة النور بـ ١٥٠٠
// وصاحبه ياخد ١٢٠٠")، والذكاء الاصطناعي (على السيرفر) بيحوّل الكلام لقايمة
// "أفعال" بالشكل اللي تحت. الملف ده مبيكلمش أي ذكاء اصطناعي: بياخد القايمة
// وينفذها بنفس دوال البرنامج العادية (نفس القواعد ونفس سجل التعديلات).
//  - assistantContext: الأسماء الموجودة، عشان الذكاء الاصطناعي يستخدمها زي ما هي.
//  - assistantPreview: بينفذ القايمة ويرجّع في كلامه — يوري هيحصل إيه من غير ما يسجل.
//  - assistantApply:   بينفذ القايمة كلها مرة واحدة (يا كلها يا ولا حاجة).

export type AssistantActionType =
  | "supplier"
  | "client"
  | "equipment"
  | "contract"
  | "work_days"
  | "expense"
  | "client_payment"
  | "supplier_payment"
  | "supplier_deduction"
  | "driver"
  | "driver_payment"
  | "delete";

/** فعل واحد. الفلوس بالجنيه، والتواريخ YYYY-MM-DD، والأسماء زي ما المستخدم بيقولها. */
export interface AssistantAction {
  type: AssistantActionType;
  supplier?: string | null;
  client?: string | null;
  /** company = شركة (بالضرايب) — individual = مقاول باطن (من غير ضرايب) */
  clientKind?: "company" | "individual" | null;
  equipment?: string | null;
  driver?: string | null;
  phone?: string | null;
  site?: string | null;
  unit?: "day" | "month" | null;
  clientRate?: number | null;
  supplierRate?: number | null;
  startDate?: string | null;
  endDate?: string | null;
  from?: string | null;
  to?: string | null;
  amount?: number | null;
  date?: string | null;
  note?: string | null;
  category?: string | null;
  /** شريك إدارة دفع المصروف من جيبه */
  paidBy?: string | null;
  /** مفتاح حساب الخزنة (cash / instapay / wallet / checks …) */
  account?: string | null;
  forMonth?: string | null;
  payKind?: "month" | "day" | null;
  rate?: number | null;
  overtimeRate?: number | null;
  /** delete: إيه اللي يتمسح (supplier / client / equipment / driver / contract) */
  target?: "supplier" | "client" | "equipment" | "driver" | "contract" | null;
}

type Named = { id: number; name: string };

/** نفس الاسم حتى لو اتكتب بهمزة أو من غيرها، بتاء مربوطة أو هاء، بمسافات زيادة */
export const normalizeName = (s: string) =>
  s
    .trim()
    .replace(/[ًٌٍَُِّْـ]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/\s+/g, " ")
    .toLowerCase();

const pt = (pounds: number | null | undefined, what: string) => {
  if (pounds == null || !Number.isFinite(pounds) || pounds <= 0) throw new UserError(`${what}: المبلغ مش مكتوب`);
  return Math.round(pounds * 100);
};
const day = (d: string | null | undefined) => {
  if (!d) return today();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) throw new UserError(`التاريخ ده مش مفهوم: ${d}`);
  return d;
};
const egp = (pounds: number) => `${formatPounds(Math.round(pounds * 100))} ج`;

function finder(db: Db, table: string, label: string) {
  const all = () => db.prepare(`SELECT id, name FROM ${table} WHERE deleted_at IS NULL`).all() as Named[];
  const find = (name?: string | null) => {
    const n = normalizeName(name ?? "");
    if (!n) return undefined;
    const rows = all();
    return rows.find((r) => normalizeName(r.name) === n) ?? (rows.filter((r) => normalizeName(r.name).includes(n)).length === 1 ? rows.find((r) => normalizeName(r.name).includes(n)) : undefined);
  };
  const must = (name?: string | null) => {
    if (!name?.trim()) throw new UserError(`${label}: الاسم مش مكتوب`);
    const r = find(name);
    if (!r) throw new UserError(`مش لاقي ${label} باسم «${name}»`);
    return r;
  };
  return { find, must };
}

/** الأسماء الموجودة في البرنامج — بتتبعت للذكاء الاصطناعي مع رسالة المستخدم. */
export function assistantContext(db: Db) {
  const q = <T>(sql: string) => db.prepare(sql).all() as T[];
  return {
    today: today(),
    suppliers: q<{ name: string }>("SELECT name FROM suppliers WHERE deleted_at IS NULL ORDER BY id DESC LIMIT 150").map((r) => r.name),
    clients: q<{ name: string; kind: string }>("SELECT name, kind FROM clients WHERE deleted_at IS NULL ORDER BY id DESC LIMIT 150"),
    equipment: q<{ name: string; supplier: string }>(
      "SELECT e.name, s.name AS supplier FROM equipment e JOIN suppliers s ON s.id = e.supplier_id WHERE e.deleted_at IS NULL ORDER BY e.id DESC LIMIT 200",
    ),
    contracts: q<{ equipment: string; client: string; supplier: string; site: string | null; ended: number }>(
      `SELECT e.name AS equipment, cl.name AS client, s.name AS supplier, c.site_name AS site, (c.status <> 'active') AS ended
       FROM contracts c JOIN equipment e ON e.id = c.equipment_id JOIN clients cl ON cl.id = c.client_id JOIN suppliers s ON s.id = c.supplier_id
       WHERE c.deleted_at IS NULL ORDER BY c.id DESC LIMIT 200`,
    ),
    drivers: q<{ name: string; equipment: string | null }>(
      "SELECT d.name, e.name AS equipment FROM drivers d LEFT JOIN equipment e ON e.id = d.equipment_id WHERE d.deleted_at IS NULL ORDER BY d.id DESC LIMIT 100",
    ),
    expenseCategories: q<{ name: string }>("SELECT name FROM expense_categories WHERE deleted_at IS NULL ORDER BY name").map((r) => r.name),
    accounts: q<{ key: string; name: string }>("SELECT key, name FROM treasury_accounts WHERE deleted_at IS NULL ORDER BY sort, id"),
    partners: q<{ name: string }>("SELECT DISTINCT name FROM contract_managers WHERE deleted_at IS NULL ORDER BY name").map((r) => r.name),
  };
}
export type AssistantContext = ReturnType<typeof assistantContext>;

const egpN = (pt: number) => Math.round(pt) / 100;

/**
 * الأرقام اللي المساعد بيجاوب منها ("كسبت كام"، "مكسبي كام في المية على فلوسي"…):
 * ملخص كل شهر، والخزنة، واللي لينا واللي علينا، ورأس المال، والمستثمرين،
 * وشركاء الإدارة، وحساب كل شركة وكل صاحب معدة. كله بالجنيه.
 */
export function assistantFacts(db: Db) {
  const now = today();
  const books = computeBooks(db, now);
  const names = (t: string) => new Map((db.prepare(`SELECT id, name FROM ${t}`).all() as Named[]).map((r) => [r.id, r.name]));
  const eqName = names("equipment");
  const clName = names("clients");
  const months = books.months.slice(-12).map((m) => ({
    month: m.month,
    closed: m.closed,
    fromClients: egpN(m.contracts.reduce((s, c) => s + c.clientBasePt, 0)),
    toOwners: egpN(m.contracts.reduce((s, c) => s + c.supplierCostPt, 0)),
    margin: egpN(m.contracts.reduce((s, c) => s + c.marginPt, 0)),
    tax: egpN(m.contracts.reduce((s, c) => s + c.tax5Pt + (c.whtPt ?? 0), 0)),
    contractExpenses: egpN(m.contracts.reduce((s, c) => s + c.expensesPt, 0)),
    generalExpenses: egpN(m.generalExpensesPt),
    netProfit: egpN(m.monthNetPt),
    managementShare: egpN(m.distribution.managementPt),
    investorsShare: egpN(m.distribution.investorsPoolPt),
    contracts: m.contracts.map((c) => ({ equipment: eqName.get(c.equipmentId) ?? c.code, client: clName.get(c.clientId) ?? "", days: c.clientDays, net: egpN(c.netPt) })),
  }));
  // تفاصيل العقود لآخر ٣ شهور بس (عشان الرسالة متكبرش)
  months.forEach((m, i) => {
    if (i < months.length - 3) m.contracts = [];
  });
  const receivables = books.invoices.reduce((s, i) => s + i.totalPt - i.collectedPt - i.creditedPt, 0);
  const supplierCost = books.months.reduce((s, m) => s + m.contracts.reduce((a, c) => a + c.supplierCostPt, 0), 0);
  const payables = supplierCost - books.raw.deductions.reduce((s, d) => s + d.amount_pt, 0) - books.raw.supplierPayments.reduce((s, p) => s + p.amount_pt, 0);
  const totalNet = books.months.reduce((s, m) => s + m.monthNetPt, 0);
  const q = <T>(sql: string) => db.prepare(sql).all() as T[];
  const clients = q<{ id: number; name: string }>("SELECT id, name FROM clients WHERE deleted_at IS NULL").map((c) => ({
    name: c.name,
    stillOwesUs: egpN(clientStatement(db, c.id, now, books).totals.remainingPt),
  }));
  const owners = q<{ id: number; name: string }>("SELECT id, name FROM suppliers WHERE deleted_at IS NULL").map((x) => ({
    name: x.name,
    weStillOweHim: egpN(supplierStatement(db, x.id, now, books).totals.remainingPt),
  }));
  const partners = managersReport(db, books, now.slice(0, 7)).people.map((p) => ({
    name: p.name,
    shareThisMonth: egpN(p.monthPt),
    shareSinceStart: egpN(p.accruedPt),
    paidFromPocket: egpN(p.pocketPt),
    takenSoFar: egpN(p.paidPt),
    stillOwedToHim: egpN(p.balancePt),
  }));
  return {
    today: now,
    note: "كل المبالغ بالجنيه. netProfit = صافي ربح الشهر بعد الضرايب والمصروفات (قبل التقسيم بين الإدارة والمستثمرين).",
    months,
    sinceStart: { netProfit: egpN(totalNet), managementShare: egpN(books.management.accruedPt), managementPaid: egpN(books.management.paidPt) },
    treasury: {
      balance: egpN(books.treasury.balancePt),
      availableForWork: egpN(books.treasury.availablePt),
      taxMoneyHeld: egpN(books.treasury.taxHeldPt),
      byAccount: books.treasury.byAccount.map((a) => ({ account: a.name, balance: egpN(a.balancePt) })),
    },
    clientsStillOweUs: egpN(receivables),
    weStillOweOwners: egpN(payables),
    capital: { total: egpN(books.capital.totalPt), inUse: egpN(books.capital.deployedPt), inTreasury: egpN(books.capital.inTreasuryPt) },
    investors: books.investors.map((i) => ({
      name: i.name,
      capital: egpN(i.capitalPt),
      profitSinceStart: egpN(i.accruedPt),
      paidOut: egpN(i.paidPt),
      stillOwed: egpN(i.owedPt),
      lastMonthReturnPercent: i.monthlyReturnBp / 100,
    })),
    managementPartners: partners,
    clients,
    owners,
  };
}

/** بينفذ القايمة بالترتيب ويرجّع سطر عربي لكل حاجة اتعملت. بيترمي UserError لو حاجة ناقصة. */
function run(db: Db, actions: AssistantAction[]): string[] {
  if (!Array.isArray(actions) || !actions.length) throw new UserError("مفيش حاجة تتسجل");
  if (actions.length > 40) throw new UserError("الطلب فيه حاجات كتير أوي — قسّمه على كذا رسالة");
  const suppliers = finder(db, "suppliers", "صاحب معدة");
  const clients = finder(db, "clients", "شركة");
  const equipment = finder(db, "equipment", "معدة");
  const drivers = finder(db, "drivers", "سواق");
  const lines: string[] = [];

  const supplierOrNew = (name: string | null | undefined, phone?: string | null) => {
    if (!name?.trim()) throw new UserError("اسم صاحب المعدة مش مكتوب");
    const found = suppliers.find(name);
    if (found) return found.id;
    lines.push(`صاحب معدة جديد: ${name.trim()}`);
    return createSupplier(db, { name: name.trim(), phone: phone?.trim() || undefined });
  };
  const account = (key?: string | null) => {
    if (!key) return {};
    const a = db.prepare("SELECT key FROM treasury_accounts WHERE key = ? AND deleted_at IS NULL").get(key) as { key: string } | undefined;
    if (!a) throw new UserError(`حساب الخزنة «${key}» مش موجود`);
    return { account: a.key };
  };
  /** العقد الشغال على المعدة دي (للمصروفات والأيام) */
  const contractOf = (equipmentName?: string | null, date?: string) => {
    const e = equipment.must(equipmentName);
    const c = db
      .prepare(
        `SELECT id FROM contracts WHERE equipment_id = ? AND deleted_at IS NULL AND start_date <= ? AND (end_date IS NULL OR end_date >= ?)
         ORDER BY start_date DESC LIMIT 1`,
      )
      .get(e.id, date ?? today(), date ?? today()) as { id: number } | undefined;
    if (!c) throw new UserError(`المعدة «${e.name}» ملهاش عقد شغال في التاريخ ده`);
    return { contractId: c.id, equipment: e };
  };

  for (const a of actions) {
    switch (a.type) {
      case "supplier": {
        if (suppliers.find(a.supplier)) lines.push(`صاحب المعدة ${a.supplier} موجود قبل كده`);
        else supplierOrNew(a.supplier, a.phone);
        break;
      }
      case "client": {
        if (!a.client?.trim()) throw new UserError("اسم الشركة مش مكتوب");
        if (clients.find(a.client)) lines.push(`${a.client} موجودة قبل كده`);
        else {
          createClient(db, { kind: a.clientKind ?? "company", name: a.client.trim(), phone: a.phone?.trim() || undefined });
          lines.push(`${a.clientKind === "individual" ? "مقاول باطن جديد (من غير ضرايب)" : "شركة جديدة (بالضرايب)"}: ${a.client.trim()}`);
        }
        break;
      }
      case "equipment": {
        if (!a.equipment?.trim()) throw new UserError("اسم المعدة مش مكتوب");
        if (equipment.find(a.equipment)) lines.push(`المعدة ${a.equipment} موجودة قبل كده`);
        else {
          const supplierId = supplierOrNew(a.supplier, a.phone);
          createEquipment(db, { name: a.equipment.trim(), supplierId, siteName: a.site?.trim() || undefined });
          lines.push(`معدة جديدة: ${a.equipment.trim()} — صاحبها ${a.supplier}`);
        }
        break;
      }
      case "contract": {
        if (!a.equipment?.trim()) throw new UserError("العقد: اسم المعدة مش مكتوب");
        if (!a.client?.trim()) throw new UserError("العقد: اسم الشركة مش مكتوب");
        const unit = a.unit ?? "day";
        const clientRatePt = pt(a.clientRate, "سعر الشركة");
        const supplierRatePt = pt(a.supplierRate, "سعر صاحب المعدة");
        const startDate = day(a.startDate);
        const eq = equipment.find(a.equipment);
        const cl = clients.find(a.client);
        if (!eq && !a.supplier?.trim()) throw new UserError(`المعدة «${a.equipment}» جديدة — قول صاحبها مين`);
        const sup = eq ? null : suppliers.find(a.supplier);
        if (!cl) lines.push(`${a.clientKind === "individual" ? "مقاول باطن جديد (من غير ضرايب)" : "شركة جديدة (بالضرايب)"}: ${a.client.trim()}`);
        if (!eq && !sup) lines.push(`صاحب معدة جديد: ${a.supplier!.trim()}`);
        if (!eq) lines.push(`معدة جديدة: ${a.equipment.trim()} — صاحبها ${a.supplier!.trim()}`);
        newContract(db, {
          client: cl ? { id: cl.id } : { kind: a.clientKind ?? "company", name: a.client.trim() },
          equipment: eq ? { id: eq.id } : { name: a.equipment.trim(), siteName: a.site?.trim() || undefined, supplier: sup ? { id: sup.id } : { name: a.supplier!.trim(), phone: a.phone?.trim() || undefined } },
          unit,
          clientRatePt,
          supplierRatePt,
          startDate,
          endDate: a.endDate || undefined,
          siteName: a.site?.trim() || undefined,
        });
        const per = unit === "day" ? "اليوم" : "الشهر";
        lines.push(
          `عقد جديد: ${a.equipment.trim()} مع ${a.client.trim()} من ${startDate}${a.site ? ` — موقع ${a.site}` : ""} — على الشركة ${egp(a.clientRate!)} في ${per}، ولصاحب المعدة ${egp(a.supplierRate!)} (الفرق ${egp(a.clientRate! - a.supplierRate!)})`,
        );
        break;
      }
      case "work_days": {
        const from = day(a.from ?? a.date);
        const to = day(a.to ?? a.from ?? a.date);
        if (to < from) throw new UserError("أيام الشغل: آخر يوم قبل أول يوم");
        const { contractId, equipment: e } = contractOf(a.equipment, from);
        fillRange(db, contractId, "client", from, to, { siteName: a.site?.trim() || undefined });
        lines.push(from === to ? `يوم شغل للمعدة ${e.name}: ${from}` : `أيام شغل للمعدة ${e.name}: من ${from} لحد ${to}`);
        break;
      }
      case "expense": {
        const amountPt = pt(a.amount, "المصروف");
        const date = day(a.date);
        const onEquipment = a.equipment?.trim() ? contractOf(a.equipment, date) : null;
        let categoryId: number | null = null;
        if (a.category?.trim()) {
          const found = finder(db, "expense_categories", "بند").find(a.category);
          categoryId = found ? found.id : createExpenseCategory(db, a.category.trim());
          if (!found) lines.push(`بند مصروف جديد: ${a.category.trim()}`);
        }
        recordExpense(
          db,
          { kind: onEquipment ? "contract" : "general", contractId: onEquipment?.contractId ?? null, categoryId, date, amountPt, note: a.note?.trim() || undefined, paidBy: a.paidBy?.trim() || null, ...account(a.account) },
          { confirmNegative: true },
        );
        lines.push(
          `مصروف ${egp(a.amount!)}${a.note ? ` (${a.note})` : ""} — ${onEquipment ? `على عقد ${onEquipment.equipment.name}` : "عام للشركة"} — ${a.paidBy ? `دفعه ${a.paidBy} من جيبه` : "من الخزنة"} — ${date}`,
        );
        break;
      }
      case "client_payment": {
        const c = clients.must(a.client);
        recordClientPayment(db, { clientId: c.id, date: day(a.date), amountPt: pt(a.amount, "الدفعة"), note: a.note?.trim() || undefined, forMonth: a.forMonth || null, ...account(a.account) });
        lines.push(`دفعة من ${c.name}: ${egp(a.amount!)} — دخلت الخزنة — ${day(a.date)}`);
        break;
      }
      case "supplier_payment": {
        const s = suppliers.must(a.supplier);
        recordSupplierPayment(db, { supplierId: s.id, date: day(a.date), amountPt: pt(a.amount, "الدفعة"), note: a.note?.trim() || undefined, forMonth: a.forMonth || null, ...account(a.account) }, { confirmNegative: true });
        lines.push(`دفعة لصاحب المعدة ${s.name}: ${egp(a.amount!)} — من الخزنة — ${day(a.date)}`);
        break;
      }
      case "supplier_deduction": {
        // حاجة دفعناها عن صاحب المعدة (زيت، قطع غيار…): بتطلع من الخزنة وبتتخصم من حسابه
        const date = day(a.date);
        const onEquipment = a.equipment?.trim() ? equipment.must(a.equipment) : null;
        const owner = a.supplier?.trim()
          ? suppliers.must(a.supplier)
          : onEquipment
            ? (db.prepare("SELECT s.id, s.name FROM equipment e JOIN suppliers s ON s.id = e.supplier_id WHERE e.id = ?").get(onEquipment.id) as Named)
            : suppliers.must(a.supplier);
        if (!a.note?.trim()) throw new UserError("الخصم: اكتب اتدفع في إيه (زيت، قطع غيار…)");
        let contractId: number | null = null;
        if (onEquipment) {
          const c = db
            .prepare("SELECT id FROM contracts WHERE equipment_id = ? AND supplier_id = ? AND deleted_at IS NULL AND start_date <= ? AND (end_date IS NULL OR end_date >= ?) ORDER BY start_date DESC LIMIT 1")
            .get(onEquipment.id, owner.id, date, date) as { id: number } | undefined;
          contractId = c?.id ?? null;
        }
        recordSupplierDeduction(db, { supplierId: owner.id, contractId, date, amountPt: pt(a.amount, "الخصم"), note: a.note.trim(), ...account(a.account) }, { confirmNegative: true });
        lines.push(`${a.note.trim()} ${egp(a.amount!)}${onEquipment ? ` لمعدة ${onEquipment.name}` : ""} — من الخزنة، وبتتخصم من صاحب المعدة ${owner.name} — ${date}`);
        break;
      }
      case "driver": {
        if (!a.driver?.trim()) throw new UserError("اسم السواق مش مكتوب");
        if (drivers.find(a.driver)) {
          lines.push(`السواق ${a.driver} موجود قبل كده`);
          break;
        }
        const e = equipment.must(a.equipment);
        const owner = db.prepare("SELECT supplier_id FROM equipment WHERE id = ?").get(e.id) as { supplier_id: number };
        const payKind = a.payKind ?? "month";
        createDriver(db, {
          name: a.driver.trim(),
          phone: a.phone?.trim() || null,
          supplierId: owner.supplier_id,
          equipmentId: e.id,
          payKind,
          ratePt: pt(a.rate, payKind === "month" ? "مرتب السواق" : "يومية السواق"),
          overtimeRatePt: a.overtimeRate ? Math.round(a.overtimeRate * 100) : null,
          startDate: day(a.startDate ?? a.date),
        });
        lines.push(`سواق جديد: ${a.driver.trim()} على ${e.name} — ${payKind === "month" ? "مرتب شهري" : "يومية"} ${egp(a.rate!)}`);
        break;
      }
      case "driver_payment": {
        const d = drivers.must(a.driver);
        recordDriverPayment(db, { driverId: d.id, date: day(a.date), amountPt: pt(a.amount, "فلوس السواق"), note: a.note?.trim() || undefined, ...account(a.account) }, { confirmNegative: true });
        lines.push(`فلوس للسواق ${d.name}: ${egp(a.amount!)}${a.note ? ` (${a.note})` : ""} — من الخزنة، وبتتخصم من صاحب المعدة — ${day(a.date)}`);
        break;
      }
      case "delete": {
        const { entity, id, label } = deleteTarget(db, a);
        const p = deletePreview(db, entity, id);
        if (p.blocked) throw new UserError(p.blocked);
        deleteEntity(db, entity, id, "اتمسح من المساعد");
        lines.push(`مسح ${label}${p.count > 1 ? ` — ومعاه: ${p.items.slice(1, 6).join("، ")}${p.count > 6 ? "…" : ""}` : ""} (يترجع من سجل التعديلات)`);
        break;
      }
      default:
        throw new UserError(`مش فاهم نوع العملية: ${(a as { type?: string }).type}`);
    }
  }
  return lines;
}

/** المسح بالأسماء: صاحب معدة / شركة / معدة / سواق / عقد (معدة + شركة). */
function deleteTarget(db: Db, a: AssistantAction): { entity: Deletable; id: number; label: string } {
  switch (a.target) {
    case "supplier": {
      const r = finder(db, "suppliers", "صاحب معدة").must(a.supplier);
      return { entity: "suppliers", id: r.id, label: `صاحب المعدة ${r.name}` };
    }
    case "client": {
      const r = finder(db, "clients", "شركة").must(a.client);
      return { entity: "clients", id: r.id, label: `${r.name}` };
    }
    case "equipment": {
      const r = finder(db, "equipment", "معدة").must(a.equipment);
      return { entity: "equipment", id: r.id, label: `المعدة ${r.name}` };
    }
    case "driver": {
      const r = finder(db, "drivers", "سواق").must(a.driver);
      return { entity: "drivers", id: r.id, label: `السواق ${r.name}` };
    }
    case "contract": {
      const e = finder(db, "equipment", "معدة").must(a.equipment);
      const rows = db.prepare("SELECT c.id, cl.name AS client FROM contracts c JOIN clients cl ON cl.id = c.client_id WHERE c.equipment_id = ? AND c.deleted_at IS NULL ORDER BY c.start_date DESC").all(e.id) as {
        id: number;
        client: string;
      }[];
      const picked = a.client ? rows.filter((r) => normalizeName(r.client) === normalizeName(a.client!)) : rows;
      if (!picked.length) throw new UserError(`مش لاقي عقد للمعدة ${e.name}${a.client ? ` مع ${a.client}` : ""}`);
      if (picked.length > 1) throw new UserError(`المعدة ${e.name} ليها أكتر من عقد — قول مع أنهي شركة`);
      return { entity: "contracts", id: picked[0].id, label: `عقد ${e.name} مع ${picked[0].client}` };
    }
    default:
      throw new UserError("قول تمسح إيه بالظبط (صاحب معدة، شركة، معدة، سواق، أو عقد) — والحاجات التانية (دفعة، مصروف، يوم سركي) امسحها من مكانها بعلامة الزبالة");
  }
}

/** القايمة فيها مسح؟ (المسح من المساعد لازم باسورد الشركة) */
export const hasDelete = (actions: AssistantAction[]) => actions.some((a) => a.type === "delete");

class Rollback extends Error {}

/** يوري هيحصل إيه من غير ما يسجل حاجة: بينفذ ويرجّع في كلامه. */
export function assistantPreview(db: Db, actions: AssistantAction[]): { ok: true; lines: string[] } | { ok: false; message: string } {
  let lines: string[] = [];
  try {
    db.transaction(() => {
      lines = run(db, actions);
      throw new Rollback();
    })();
  } catch (e) {
    if (e instanceof Rollback) return { ok: true, lines };
    const msg = String((e as Error)?.message ?? e);
    if (e instanceof UserError || /[؀-ۿ]/.test(msg)) return { ok: false, message: msg.includes("UNIQUE") ? "فيه حاجة متسجلة بنفس الاسم قبل كده" : msg };
    throw e;
  }
  return { ok: true, lines };
}

/** يسجل القايمة كلها مرة واحدة: يا كلها يا ولا حاجة. */
export function assistantApply(db: Db, actions: AssistantAction[]): string[] {
  return db.transaction(() => run(db, actions))();
}
