import { Db, monthOf, today } from "../db";
import { contractMonth, ContractMonthResult } from "../calc/contractMonth";
import { distribute, Distribution } from "../calc/distribution";
import { capitalWeight, CapitalMovement, daysPresent } from "../calc/timeWeight";
import { allocatePayments, InvoiceCollection, releasable } from "../calc/collections";
import { sheetTotals } from "../calc/sarki";
import { portion, Piasters } from "../calc/money";
import { rateAt } from "./master";
import { toSarkiDay, WorkLogRow } from "./sarki";

// Everything on every page is derived here from the raw rows, so there is a
// single implementation of each rule. Closed months are read from their
// snapshot, never recomputed.

export interface ContractMonthRow extends ContractMonthResult {
  contractId: number;
  code: string;
  clientId: number;
  supplierId: number;
  equipmentId: number;
  month: string;
  clientDays: number;
  supplierDays: number;
}

export interface MonthResult {
  month: string;
  closed: boolean;
  rates: { vat: number; tax5: number; investors: number; management: number };
  contracts: ContractMonthRow[];
  generalExpensesPt: Piasters;
  monthNetPt: Piasters;
  /** Loss brought from earlier months, taken off this month's profit before splitting it. */
  carryInPt: Piasters;
  /** Loss still left to carry into next month. */
  carryOutPt: Piasters;
  distribution: Distribution;
  /** Σ invoice base (ex-VAT) for the month, and how much of it clients paid so far. */
  invoicedBasePt: Piasters;
  collectedBasePt: Piasters;
  releasableManagementPt: Piasters;
  releasableByInvestor: Map<number, Piasters>;
}

type Row = Record<string, any>;

/** Rows that still count: drops deleted rows, cancelled originals and their reversals. */
function live<T extends Row>(rows: T[]): T[] {
  const kept = rows.filter((r) => !r.deleted_at);
  const reversed = new Set(kept.filter((r) => r.reversal_of != null).map((r) => r.reversal_of));
  return kept.filter((r) => r.reversal_of == null && !reversed.has(r.id));
}

const sum = <T>(rows: T[], f: (r: T) => number) => rows.reduce((s, r) => s + f(r), 0);

function monthsBetween(from: string, to: string): string[] {
  const out: string[] = [];
  let [y, m] = from.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);
  while (y < ty || (y === ty && m <= tm)) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    if (++m > 12) [y, m] = [y + 1, 1];
  }
  return out;
}

export function computeBooks(db: Db, asOf: string = today()) {
  const q = (sql: string, ...p: unknown[]) => db.prepare(sql).all(...p) as Row[];
  const contracts = q("SELECT * FROM contracts WHERE deleted_at IS NULL ORDER BY id");
  const clients = new Map(q("SELECT * FROM clients").map((c) => [c.id, c]));
  const investors = q("SELECT * FROM investors WHERE deleted_at IS NULL ORDER BY id");
  const logs = q("SELECT * FROM work_logs WHERE date <= ? AND deleted_at IS NULL ORDER BY date", asOf) as WorkLogRow[];
  const expenses = live(q("SELECT * FROM expenses WHERE date <= ?", asOf));
  const adjustments = q("SELECT * FROM adjustments WHERE applied_month <= ?", monthOf(asOf));
  const capital = live(q("SELECT * FROM capital_movements WHERE date <= ?", asOf));
  const clientPayments = live(q("SELECT * FROM client_payments WHERE date <= ?", asOf));
  const supplierPayments = live(q("SELECT * FROM supplier_payments WHERE date <= ?", asOf));
  const deductions = live(q("SELECT * FROM supplier_deductions WHERE date <= ?", asOf));
  const payouts = live(q("SELECT * FROM profit_payouts WHERE date <= ?", asOf));
  const taxPayments = live(q("SELECT * FROM tax_payments WHERE date <= ?", asOf));
  const closes = new Map(q("SELECT * FROM month_closes").map((r) => [r.month, JSON.parse(r.snapshot_json)]));

  const dated = [...logs.map((l) => l.date), ...expenses.map((e) => e.date), ...capital.map((c) => c.date)];
  const first = dated.length ? dated.reduce((a, b) => (a < b ? a : b)).slice(0, 7) : monthOf(asOf);
  const months = monthsBetween(first, monthOf(asOf));

  const movementsOf = (investorId: number): CapitalMovement[] =>
    capital
      .filter((c) => c.investor_id === investorId)
      .map((c) => ({ date: c.date, signedPt: c.kind === "deposit" ? c.amount_pt : -c.amount_pt }));

  // ---- per month (accrual, from the sarki) ----
  let carry = 0; // loss carried forward ("الخسارة بتترحّل")
  const monthResults: MonthResult[] = months.map((month) => {
    const snap = closes.get(month);
    if (snap) {
      const m = reviveSnapshot(snap);
      carry = m.carryOutPt ?? 0;
      return m;
    }
    const start = `${month}-01`;
    const rates = {
      vat: rateAt(db, "vat", start),
      tax5: rateAt(db, "tax5", start),
      investors: rateAt(db, "investors_share", start),
      management: rateAt(db, "management_share", start),
    };
    const rows: ContractMonthRow[] = [];
    for (const c of contracts) {
      const inMonth = logs.filter((l) => l.contract_id === c.id && l.date.startsWith(month));
      const adj = adjustments.filter((a) => a.contract_id === c.id && a.applied_month === month);
      const exp = expenses.filter((e) => e.kind === "contract" && e.contract_id === c.id && e.date.startsWith(month));
      if (!inMonth.length && !adj.length && !exp.length) continue;
      const cs = sheetTotals(inMonth.filter((l) => l.side === "client").map(toSarkiDay), { unit: c.unit, ratePt: c.client_rate_pt });
      const ss = sheetTotals(inMonth.filter((l) => l.side === "supplier").map(toSarkiDay), { unit: c.unit, ratePt: c.supplier_rate_pt });
      const client = clients.get(c.client_id)!;
      const r = contractMonth({
        clientBasePt: cs.totalPt + sum(adj.filter((a) => a.kind === "client_base"), (a) => a.amount_pt),
        supplierCostPt: ss.totalPt + sum(adj.filter((a) => a.kind === "supplier_cost"), (a) => a.amount_pt),
        contractExpensesPt: sum(exp, (e) => e.amount_pt),
        vatApplies: !!client.vat_applies,
        tax5Applies: !!client.tax5_applies,
        vatBp: rates.vat,
        tax5Bp: rates.tax5,
      });
      rows.push({
        ...r,
        contractId: c.id,
        code: c.code,
        clientId: c.client_id,
        supplierId: c.supplier_id,
        equipmentId: c.equipment_id,
        month,
        clientDays: cs.workedDays,
        supplierDays: ss.workedDays,
      });
    }
    const generalExpensesPt = sum(
      expenses.filter((e) => e.kind === "general" && e.date.startsWith(month)),
      (e) => e.amount_pt,
    );
    const monthNetPt = sum(rows, (r) => r.netPt) - generalExpensesPt;
    const weights = investors.map((i) => ({ investorId: i.id, weight: capitalWeight(movementsOf(i.id), month) })).filter((w) => w.weight > 0n);
    const carryInPt = carry;
    const distributable = monthNetPt - carryInPt;
    carry = distributable < 0 ? -distributable : 0;
    return {
      month,
      closed: false,
      rates,
      contracts: rows,
      generalExpensesPt,
      monthNetPt,
      carryInPt,
      carryOutPt: carry,
      distribution: distribute(distributable, rates.investors, weights),
      invoicedBasePt: 0,
      collectedBasePt: 0,
      releasableManagementPt: 0,
      releasableByInvestor: new Map(),
    };
  });

  // ---- invoices + collections ----
  const issued = new Map(q("SELECT * FROM invoices").map((i) => [`${i.contract_id}|${i.month}`, i]));
  const invoiceLines = monthResults.flatMap((m) =>
    m.contracts
      .filter((r) => r.invoiceTotalPt > 0)
      .map((r) => ({ clientId: r.clientId, contractId: r.contractId, month: m.month, basePt: r.clientBasePt, vatPt: r.vatPt, totalPt: r.invoiceTotalPt })),
  );
  const allocation = allocatePayments(
    invoiceLines,
    clientPayments.map((p) => ({ clientId: p.client_id, contractId: p.contract_id, date: p.date, amountPt: p.amount_pt })),
  );
  const invoices = allocation.invoices.map((i) => ({ ...i, serial: issued.get(`${i.contractId}|${i.month}`)?.serial ?? null }));

  for (const m of monthResults) {
    const inv = invoices.filter((i) => i.month === m.month);
    m.invoicedBasePt = sum(inv, (i) => i.basePt);
    m.collectedBasePt = sum(inv, (i) => i.collectedBasePt);
    m.releasableManagementPt = releasable(m.distribution.managementPt, m.collectedBasePt, m.invoicedBasePt);
    m.releasableByInvestor = new Map(m.distribution.investors.map((x) => [x.investorId, releasable(x.sharePt, m.collectedBasePt, m.invoicedBasePt)]));
  }

  // ---- capital in use ("قد إيه من فلوسه شغالة") ----
  const contractCash = contracts.map((c) => {
    const out =
      sum(supplierPayments.filter((p) => p.contract_id === c.id), (p) => p.amount_pt) +
      sum(deductions.filter((d) => d.contract_id === c.id && d.paid_from_treasury), (d) => d.amount_pt) +
      sum(expenses.filter((e) => e.contract_id === c.id), (e) => e.amount_pt);
    const back = sum(invoices.filter((i) => i.contractId === c.id), (i) => i.collectedBasePt);
    return { contractId: c.id, outPt: out, collectedBasePt: back, deployedPt: Math.max(0, out - back) };
  });
  const unlinkedOut =
    sum(supplierPayments.filter((p) => p.contract_id == null), (p) => p.amount_pt) +
    sum(deductions.filter((d) => d.contract_id == null && d.paid_from_treasury), (d) => d.amount_pt);
  const deployedPt = sum(contractCash, (c) => c.deployedPt) + unlinkedOut;

  // ---- investors ----
  const totalCapitalPt = sum(capital, (c) => (c.kind === "deposit" ? c.amount_pt : -c.amount_pt));
  const investorRows = investors.map((i) => {
    const mv = movementsOf(i.id);
    const capitalPt = sum(mv, (m) => m.signedPt);
    const accruedPt = sum(monthResults, (m) => m.distribution.investors.find((x) => x.investorId === i.id)?.sharePt ?? 0);
    const releasablePt = sum(monthResults, (m) => m.releasableByInvestor.get(i.id) ?? 0);
    const paidPt = sum(payouts.filter((p) => p.payee_kind === "investor" && p.investor_id === i.id), (p) => p.amount_pt);
    const last = monthResults[monthResults.length - 1];
    const lastShare = last?.distribution.investors.find((x) => x.investorId === i.id)?.sharePt ?? 0;
    return {
      investorId: i.id,
      name: i.name as string,
      phone: i.phone as string | null,
      capitalPt,
      shareBp: totalCapitalPt > 0 ? portion(capitalPt, 10_000, totalCapitalPt) : 0,
      inUsePt: totalCapitalPt > 0 ? portion(deployedPt, capitalPt, totalCapitalPt) : 0,
      accruedPt,
      releasablePt,
      paidPt,
      owedPt: accruedPt - paidPt,
      payableNowPt: Math.max(0, releasablePt - paidPt),
      /** last month's share ÷ capital, in bp */
      monthlyReturnBp: capitalPt > 0 ? portion(lastShare, 10_000, capitalPt) : 0,
      daysThisMonth: last ? daysPresent(mv, last.month) : 0,
    };
  });

  // ---- management ----
  const mgmtAccruedPt = sum(monthResults, (m) => m.distribution.managementPt);
  const mgmtReleasablePt = sum(monthResults, (m) => m.releasableManagementPt);
  const mgmtPaidPt = sum(payouts.filter((p) => p.payee_kind === "management"), (p) => p.amount_pt);

  // ---- taxes ----
  const vatInvoicedPt = sum(invoices, (i) => i.vatPt);
  const vatCollectedPt = sum(invoices, (i) => i.collectedVatPt);
  const vatPaidPt = sum(taxPayments.filter((t) => t.tax === "vat"), (t) => t.amount_pt);
  const tax5AccruedPt = sum(monthResults, (m) => sum(m.contracts, (r) => r.tax5Pt));
  const tax5PaidPt = sum(taxPayments.filter((t) => t.tax === "tax5"), (t) => t.amount_pt);
  const taxHeldPt = vatCollectedPt - vatPaidPt + (tax5AccruedPt - tax5PaidPt);

  // ---- treasury ----
  const treasury = q("SELECT direction, amount_pt FROM treasury_entries WHERE date <= ? AND deleted_at IS NULL", asOf);
  const balancePt = sum(treasury, (t) => (t.direction === "in" ? t.amount_pt : -t.amount_pt));
  const profitsDuePt =
    sum(investorRows, (i) => Math.max(0, i.releasablePt - i.paidPt)) + Math.max(0, mgmtReleasablePt - mgmtPaidPt);
  const availablePt = balancePt - taxHeldPt - profitsDuePt;

  return {
    asOf,
    months: monthResults,
    invoices,
    creditByClient: allocation.creditByClient,
    contractCash,
    deployedPt,
    investors: investorRows,
    capital: { totalPt: totalCapitalPt, deployedPt, inTreasuryPt: totalCapitalPt - deployedPt },
    management: { accruedPt: mgmtAccruedPt, releasablePt: mgmtReleasablePt, paidPt: mgmtPaidPt },
    tax: { vatInvoicedPt, vatCollectedPt, vatPaidPt, tax5AccruedPt, tax5PaidPt, taxHeldPt },
    treasury: { balancePt, taxHeldPt, profitsDuePt, availablePt },
    raw: { supplierPayments, deductions, clientPayments, logs, contracts, clients },
  };
}

export type Books = ReturnType<typeof computeBooks>;

// ---- month snapshots (closed months) ----
export function snapshotOf(m: MonthResult) {
  return {
    ...m,
    closed: true,
    distribution: { ...m.distribution, investors: m.distribution.investors.map((x) => ({ ...x, weight: x.weight.toString() })) },
    releasableByInvestor: [],
  };
}

function reviveSnapshot(s: any): MonthResult {
  return {
    ...s,
    closed: true,
    distribution: { ...s.distribution, investors: s.distribution.investors.map((x: any) => ({ ...x, weight: BigInt(x.weight) })) },
    releasableByInvestor: new Map(),
  };
}

export function findMonth(b: Books, month: string): MonthResult | undefined {
  return b.months.find((m) => m.month === month);
}

export type { InvoiceCollection };
