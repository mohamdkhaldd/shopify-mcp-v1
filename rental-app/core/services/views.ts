import { Db, monthOf, today } from "../db";
import { computeBooks } from "./books";
import { dashboard } from "./reports";

// Screen-shaped data: one call per page, names already joined in.

const lastDayOf = (month: string) => new Date(Date.UTC(+month.slice(0, 4), +month.slice(5, 7), 0)).toISOString().slice(0, 10);

/** A past month is read as of its last day; the current month as of today. */
export function asOfForMonth(month: string, now: string = today()) {
  return month < monthOf(now) ? lastDayOf(month) : now;
}

export function dashboardView(db: Db, month: string = monthOf(today()), now: string = today()) {
  const asOf = asOfForMonth(month, now);
  const books = computeBooks(db, asOf);
  const d = dashboard(db, asOf, books);
  const m = books.months.find((x) => x.month === month);
  const names = (t: string) => new Map(db.prepare(`SELECT id, name FROM ${t}`).all().map((r: any) => [r.id, r.name as string]));
  const clients = names("clients");
  const suppliers = names("suppliers");
  const equipment = names("equipment");
  const rows = m?.contracts ?? [];
  const sum = (f: (r: (typeof rows)[number]) => number) => rows.reduce((s, r) => s + f(r), 0);
  const generalExpensesPt = m?.generalExpensesPt ?? 0;

  const active = books.raw.contracts
    .filter((c) => c.status === "active")
    .map((c) => {
      const r = rows.find((x) => x.contractId === c.id);
      return {
        contractId: c.id as number,
        code: c.code as string,
        unit: c.unit as "day" | "month",
        client: clients.get(c.client_id) ?? "",
        equipment: equipment.get(c.equipment_id) ?? "",
        supplier: suppliers.get(c.supplier_id) ?? "",
        clientRatePt: c.client_rate_pt as number,
        supplierRatePt: c.supplier_rate_pt as number,
        daysThisMonth: r?.clientDays ?? 0,
        netThisMonthPt: r?.netPt ?? 0,
      };
    });

  return {
    month,
    asOf,
    months: books.months.map((x) => ({ month: x.month, closed: x.closed })),
    closed: !!m?.closed,
    kpis: {
      balancePt: d.treasury.balancePt,
      availablePt: d.treasury.availablePt,
      taxHeldPt: d.treasury.taxHeldPt,
      vatHeldPt: books.tax.vatCollectedPt - books.tax.vatPaidPt,
      tax5HeldPt: books.tax.tax5AccruedPt - books.tax.tax5PaidPt,
      receivablesPt: d.receivablesPt,
      invoicedPt: books.invoices.reduce((s, i) => s + i.totalPt, 0),
      payablesPt: d.payablesPt,
      deductionsPt: books.raw.deductions.reduce((s, x) => s + x.amount_pt, 0),
      monthProfitPt: d.monthProfitPt,
      monthCollectedProfitPt: d.monthCollectedProfitPt,
      activeContracts: d.activeContracts,
    },
    // من فاتورة العميل لحد التوزيع — the whole month, all contracts
    ladder: {
      clientBasePt: sum((r) => r.clientBasePt),
      vatPt: sum((r) => r.vatPt),
      supplierCostPt: sum((r) => r.supplierCostPt),
      marginPt: sum((r) => r.marginPt),
      tax5Pt: sum((r) => r.tax5Pt),
      expensesPt: sum((r) => r.expensesPt) + generalExpensesPt,
      netPt: m?.monthNetPt ?? 0,
      carryInPt: m?.carryInPt ?? 0,
      managementPt: m?.distribution.managementPt ?? 0,
      investorsPt: m?.distribution.investorsPoolPt ?? 0,
      managementBp: m?.rates.management ?? 5000,
      investorsBp: m?.rates.investors ?? 5000,
    },
    treasury: books.treasury,
    capital: books.capital,
    activeContracts: active,
  };
}

export type DashboardView = ReturnType<typeof dashboardView>;
