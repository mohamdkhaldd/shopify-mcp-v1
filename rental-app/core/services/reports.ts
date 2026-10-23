import { Db, monthOf, today } from "../db";
import { Books, computeBooks } from "./books";

// Page-shaped views on top of computeBooks. Party statements (supplier /
// client) only ever contain that party's own numbers.

const sum = <T>(rows: T[], f: (r: T) => number) => rows.reduce((s, r) => s + f(r), 0);

/** كشف حساب صاحب المعدة: "up to today" line + one row per month. No client names, no margins. */
export function supplierStatement(db: Db, supplierId: number, asOf: string = today(), books: Books = computeBooks(db, asOf)) {
  const supplier = db.prepare("SELECT id, name, phone FROM suppliers WHERE id = ?").get(supplierId);
  const pays = books.raw.supplierPayments.filter((p) => p.supplier_id === supplierId);
  const deds = books.raw.deductions.filter((d) => d.supplier_id === supplierId);
  const months = books.months.map((m) => m.month);
  let running = 0;
  const rows = months
    .map((month) => {
      const fromSarkiPt = sum(
        books.months.find((m) => m.month === month)!.contracts.filter((c) => c.supplierId === supplierId),
        (c) => c.supplierCostPt,
      );
      const deductionsPt = sum(deds.filter((d) => d.date.startsWith(month)), (d) => d.amount_pt);
      const paidPt = sum(pays.filter((p) => p.date.startsWith(month)), (p) => p.amount_pt);
      const monthBalancePt = fromSarkiPt - deductionsPt - paidPt;
      running += monthBalancePt;
      return { month, fromSarkiPt, deductionsPt, paidPt, monthBalancePt, runningBalancePt: running };
    })
    .filter((r) => r.fromSarkiPt || r.deductionsPt || r.paidPt);
  const totals = {
    fromSarkiPt: sum(rows, (r) => r.fromSarkiPt),
    deductionsPt: sum(rows, (r) => r.deductionsPt),
    paidPt: sum(rows, (r) => r.paidPt),
  };
  const equipment = db.prepare("SELECT id, name, site_name, supplier_rate_pt FROM equipment WHERE supplier_id = ? AND deleted_at IS NULL ORDER BY id").all(supplierId);
  return {
    supplier,
    equipment,
    rows,
    totals: { ...totals, remainingPt: totals.fromSarkiPt - totals.deductionsPt - totals.paidPt },
    payments: pays.map((p) => ({ id: p.id, date: p.date, contractId: p.contract_id, amountPt: p.amount_pt, note: p.note })),
    deductions: deds.map((d) => ({ id: d.id, date: d.date, contractId: d.contract_id, amountPt: d.amount_pt, note: d.note })),
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
      totalPt: i.totalPt,
      collectedPt: i.collectedPt,
      openPt: i.totalPt - i.collectedPt,
    }));
  const payments = books.raw.clientPayments
    .filter((p) => p.client_id === clientId)
    .map((p) => ({ id: p.id, date: p.date, contractId: p.contract_id, amountPt: p.amount_pt, note: p.note }));
  const invoicedPt = sum(invoices, (i) => i.totalPt);
  const paidPt = sum(payments, (p) => p.amountPt);
  return {
    client,
    invoices,
    payments,
    totals: {
      basePt: sum(invoices, (i) => i.basePt),
      vatPt: sum(invoices, (i) => i.vatPt),
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
  const receivablesPt = sum(books.invoices, (i) => i.totalPt - i.collectedPt);
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
