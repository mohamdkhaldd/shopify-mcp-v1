import { Db, monthOf, today } from "../db";
import { Books, computeBooks } from "./books";
import { allocateByMonth } from "../calc/collections";

// Page-shaped views on top of computeBooks. Party statements (supplier /
// client) only ever contain that party's own numbers.

const sum = <T>(rows: T[], f: (r: T) => number) => rows.reduce((s, r) => s + f(r), 0);

/** كشف حساب صاحب المعدة: "up to today" line + one row per month. No client names, no margins. */
export function supplierStatement(db: Db, supplierId: number, asOf: string = today(), books: Books = computeBooks(db, asOf)) {
  const supplier = db.prepare("SELECT id, name, phone FROM suppliers WHERE id = ?").get(supplierId);
  const pays = books.raw.supplierPayments.filter((p) => p.supplier_id === supplierId);
  // عمولة التحويل (انستا باي) اللي اتخصمت على كل دفعة/خصم
  const feeOf = new Map(
    (db.prepare("SELECT fee_of, amount_pt FROM expenses WHERE fee_of IS NOT NULL AND deleted_at IS NULL").all() as { fee_of: string; amount_pt: number }[]).map((r) => [r.fee_of, r.amount_pt]),
  );
  const withFee = (table: string, id: number, note: string | null) => {
    const fee = feeOf.get(`${table}:${id}`);
    return fee ? `${note ? `${note} — ` : ""}+ عمولة تحويل ${(fee / 100).toLocaleString("en-US")} ج` : note;
  };
  const deds = books.raw.deductions.filter((d) => d.supplier_id === supplierId);
  const months = books.months.map((m) => m.month);
  const dueOf = (month: string) =>
    sum(
      books.months.find((m) => m.month === month)!.contracts.filter((c) => c.supplierId === supplierId),
      (c) => c.supplierCostPt,
    );
  // شهر بشهر: الدفعة بتتحسب للشهر اللي اخترت إنها "عنه" (مش شهر تاريخها —
  // التاريخ ده يوم ما اتدفعت بس)، والباقي بيسدد الأقدم الأول. الخصم (سولار…)
  // بيتحسب على شهره.
  const byMonth = allocateByMonth(
    months.map((m) => ({ month: m, amountPt: dueOf(m) })),
    [
      ...pays.map((p) => ({ date: p.date as string, amountPt: p.amount_pt as number, forMonth: (p.for_month as string | null) ?? null, kind: "payment" })),
      ...deds.map((d) => ({ date: d.date as string, amountPt: d.amount_pt as number, forMonth: (d.date as string).slice(0, 7), kind: "deduction" })),
    ],
  );
  let running = 0;
  const rows = byMonth.months.map((m) => {
    const deductionsPt = sum(m.covered.filter((c) => c.kind === "deduction"), (c) => c.amountPt);
    const paidPt = sum(m.covered.filter((c) => c.kind !== "deduction"), (c) => c.amountPt);
    const monthBalancePt = m.duePt - deductionsPt - paidPt;
    running += monthBalancePt;
    return { month: m.month, fromSarkiPt: m.duePt, deductionsPt, paidPt, monthBalancePt, runningBalancePt: running };
  });
  const totals = {
    fromSarkiPt: sum(rows, (r) => r.fromSarkiPt),
    deductionsPt: sum(deds, (d) => d.amount_pt),
    paidPt: sum(pays, (p) => p.amount_pt),
  };
  const equipment = db.prepare("SELECT id, name, site_name, supplier_rate_pt FROM equipment WHERE supplier_id = ? AND deleted_at IS NULL ORDER BY id").all(supplierId) as {
    id: number;
    name: string;
  }[];
  // an owner with several machines: the same account split per machine (payments not tied to a contract stay apart)
  const equipmentOfContract = new Map(books.raw.contracts.map((c) => [c.id as number, c.equipment_id as number]));
  const byEquipment = [
    ...equipment.map((e) => {
      const mine = (r: Record<string, any>) => r.contract_id != null && equipmentOfContract.get(r.contract_id) === e.id;
      const fromSarkiPt = sum(
        books.months.flatMap((m) => m.contracts.filter((c) => c.supplierId === supplierId && c.equipmentId === e.id)),
        (c) => c.supplierCostPt,
      );
      const deductionsPt = sum(deds.filter(mine), (d) => d.amount_pt);
      const paidPt = sum(pays.filter(mine), (p) => p.amount_pt);
      return { equipmentId: e.id as number | null, name: e.name, fromSarkiPt, deductionsPt, paidPt, remainingPt: fromSarkiPt - deductionsPt - paidPt };
    }),
  ];
  const unlinkedDed = sum(deds.filter((d) => d.contract_id == null), (d) => d.amount_pt);
  const unlinkedPaid = sum(pays.filter((p) => p.contract_id == null), (p) => p.amount_pt);
  if (unlinkedDed || unlinkedPaid)
    byEquipment.push({ equipmentId: null, name: "دفعات من غير معدة محددة", fromSarkiPt: 0, deductionsPt: unlinkedDed, paidPt: unlinkedPaid, remainingPt: -unlinkedDed - unlinkedPaid });
  return {
    supplier,
    equipment,
    byEquipment,
    rows,
    byMonth,
    totals: { ...totals, remainingPt: totals.fromSarkiPt - totals.deductionsPt - totals.paidPt },
    payments: pays.map((p) => ({ id: p.id, date: p.date, contractId: p.contract_id, amountPt: p.amount_pt, note: withFee("supplier_payments", p.id, p.note), forMonth: (p.for_month as string | null) ?? null })),
    deductions: deds.map((d) => ({ id: d.id, date: d.date, contractId: d.contract_id, amountPt: d.amount_pt, note: withFee("supplier_deductions", d.id, d.note) })),
  };
}

/** كشف حساب الشركة / الفرد: invoices with VAT, payments, what's left. No supplier names or costs. */
export function clientStatement(db: Db, clientId: number, asOf: string = today(), books: Books = computeBooks(db, asOf)) {
  const client = db.prepare("SELECT id, kind, name, phone, tax_id, vat_applies, tax5_applies FROM clients WHERE id = ?").get(clientId);
  const invoices = books.invoices
    .filter((i) => i.clientId === clientId)
    .map((i) => ({
      serial: i.serial,
      month: i.month,
      contractId: i.contractId,
      basePt: i.basePt,
      vatPt: i.vatPt,
      /** الاستقطاع اللي الشركة خصمته (٣٪ من اليومية) */
      whtPt: i.basePt + i.vatPt - i.totalPt,
      totalPt: i.totalPt,
      collectedPt: i.collectedPt,
      creditedPt: i.creditedPt,
      openPt: i.totalPt - i.collectedPt - i.creditedPt,
    }));
  const payments = books.raw.clientPayments
    .filter((p) => p.client_id === clientId)
    .map((p) => ({ id: p.id, date: p.date, contractId: p.contract_id, amountPt: p.amount_pt, note: p.note, forMonth: (p.for_month as string | null) ?? null }));
  const invoicedPt = sum(invoices, (i) => i.totalPt);
  // شهر بشهر: فواتير كل شهر، واتدفع منها كام ومن أنهي دفعة، وناقص كام
  const monthKeys = [...new Set(invoices.map((i) => i.month))].sort();
  const covers = books.invoices.filter((i) => i.clientId === clientId);
  const byMonth = {
    months: monthKeys.map((month) => {
      const of = invoices.filter((i) => i.month === month);
      const duePt = sum(of, (i) => i.totalPt);
      const paidPt = sum(of, (i) => i.collectedPt + i.creditedPt);
      const covered = covers.filter((i) => i.month === month).flatMap((i) => i.covered);
      const merged = [...covered.reduce((m, c) => m.set(c.date, (m.get(c.date) ?? 0) + c.amountPt), new Map<string, number>())].map(([date, amountPt]) => ({ date, amountPt }));
      return { month, duePt, paidPt, openPt: duePt - paidPt, covered: merged };
    }),
    advancePt: books.creditByClient.get(clientId) ?? 0,
  };
  const paidPt = sum(payments, (p) => p.amountPt);
  return {
    client,
    invoices,
    payments,
    byMonth,
    totals: {
      basePt: sum(invoices, (i) => i.basePt),
      vatPt: sum(invoices, (i) => i.vatPt),
      whtPt: sum(invoices, (i) => i.whtPt),
      invoicedPt,
      paidPt,
      remainingPt: invoicedPt - paidPt,
      creditPt: books.creditByClient.get(clientId) ?? 0,
    },
  };
}

/** الملف الضريبي. */
export function taxFile(db: Db, asOf: string = today(), books: Books = computeBooks(db, asOf)) {
  const contracts = new Map(books.raw.contracts.map((c) => [c.id, c]));
  const group = <K>(key: (i: (typeof books.invoices)[number]) => K) => {
    const m = new Map<K, { basePt: number; vatPt: number; collectedVatPt: number }>();
    for (const i of books.invoices) {
      const k = key(i);
      const g = m.get(k) ?? { basePt: 0, vatPt: 0, collectedVatPt: 0 };
      g.basePt += i.basePt;
      g.vatPt += i.vatPt;
      g.collectedVatPt += i.collectedVatPt;
      m.set(k, g);
    }
    return [...m.entries()].map(([k, v]) => ({ key: k, ...v }));
  };
  const payments = db.prepare("SELECT * FROM tax_payments WHERE date <= ? AND deleted_at IS NULL ORDER BY date").all(asOf);
  const t = books.tax;
  return {
    vatByClient: group((i) => i.clientId),
    vatByEquipment: group((i) => contracts.get(i.contractId)!.equipment_id as number),
    vatByMonth: group((i) => i.month),
    tax5ByContractMonth: books.months.flatMap((m) =>
      m.contracts.filter((r) => r.tax5Pt !== 0).map((r) => ({ contractId: r.contractId, code: r.code, month: m.month, marginPt: r.marginPt, tax5Pt: r.tax5Pt })),
    ),
    payments,
    /** الاستقطاع اللي الشركات خصمته ودفعته للضرايب عننا */
    whtPt: sum(books.invoices, (i) => i.basePt + i.vatPt - i.totalPt),
    totals: {
      vat: { invoicedPt: t.vatInvoicedPt, collectedPt: t.vatCollectedPt, paidPt: t.vatPaidPt, owedPt: t.vatInvoicedPt - t.vatPaidPt, heldPt: t.vatCollectedPt - t.vatPaidPt },
      tax5: { accruedPt: t.tax5AccruedPt, paidPt: t.tax5PaidPt, owedPt: t.tax5AccruedPt - t.tax5PaidPt },
      owedPt: t.vatInvoicedPt - t.vatPaidPt + t.tax5AccruedPt - t.tax5PaidPt,
      heldInTreasuryPt: t.taxHeldPt,
    },
  };
}

/** الرئيسية. */
export function dashboard(db: Db, asOf: string = today(), books: Books = computeBooks(db, asOf)) {
  const month = books.months.find((m) => m.month === monthOf(asOf));
  const receivablesPt = sum(books.invoices, (i) => i.totalPt - i.collectedPt - i.creditedPt);
  const supplierCostPt = sum(books.months, (m) => sum(m.contracts, (c) => c.supplierCostPt));
  const payablesPt = supplierCostPt - sum(books.raw.deductions, (d) => d.amount_pt) - sum(books.raw.supplierPayments, (p) => p.amount_pt);
  const net = month?.monthNetPt ?? 0;
  return {
    treasury: books.treasury,
    receivablesPt,
    payablesPt,
    monthProfitPt: net,
    /** the part of this month's profit clients have already paid for */
    monthCollectedProfitPt: month ? month.releasableManagementPt + sum([...month.releasableByInvestor.values()], (v) => v) : 0,
    activeContracts: books.raw.contracts.filter((c) => c.status === "active").length,
    capital: books.capital,
  };
}
