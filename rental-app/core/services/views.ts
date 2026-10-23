import { Db, monthOf, today } from "../db";
import { computeBooks } from "./books";
import { dashboard, supplierStatement } from "./reports";
import { getSheet } from "./sarki";

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

// ---------------- السركي ----------------

function monthsOfContract(c: { start_date: string; end_date: string | null }, now: string) {
  const end = c.end_date && c.end_date < now ? c.end_date : now > c.start_date ? now : c.start_date;
  const out: string[] = [];
  let [y, m] = c.start_date.slice(0, 7).split("-").map(Number);
  const [ey, em] = end.slice(0, 7).split("-").map(Number);
  while (y < ey || (y === ey && m <= em)) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    if (++m > 12) [y, m] = [y + 1, 1];
  }
  return out;
}

export function sarkiView(db: Db, contractId?: number, month?: string, now: string = today()) {
  const contracts = db
    .prepare(
      `SELECT c.id, c.code, c.status, e.name AS equipment, cl.name AS client FROM contracts c
       JOIN equipment e ON e.id = c.equipment_id JOIN clients cl ON cl.id = c.client_id
       WHERE c.deleted_at IS NULL ORDER BY (c.status = 'active') DESC, c.id DESC`,
    )
    .all() as { id: number; code: string; status: string; equipment: string; client: string }[];
  const id = contractId && contracts.some((c) => c.id === contractId) ? contractId : contracts[0]?.id;
  if (!id) return { contracts, contract: null };
  const c = db
    .prepare(
      `SELECT c.*, e.name AS equipment, cl.name AS client, cl.kind AS client_kind, cl.vat_applies, cl.tax5_applies, s.name AS supplier
       FROM contracts c JOIN equipment e ON e.id = c.equipment_id JOIN clients cl ON cl.id = c.client_id JOIN suppliers s ON s.id = c.supplier_id
       WHERE c.id = ?`,
    )
    .get(id);
  const months = monthsOfContract(c, now);
  const m = month && months.includes(month) ? month : months.includes(monthOf(now)) ? monthOf(now) : months[months.length - 1];
  const client = getSheet(db, id, m, "client");
  const supplier = getSheet(db, id, m, "supplier");
  const closed = !!db.prepare("SELECT 1 FROM month_closes WHERE month = ?").get(m);
  return {
    contracts,
    contract: {
      id: c.id as number,
      code: c.code as string,
      unit: c.unit as "day" | "month",
      client: c.client as string,
      clientKind: c.client_kind as "company" | "individual",
      vatApplies: !!c.vat_applies,
      tax5Applies: !!c.tax5_applies,
      supplier: c.supplier as string,
      equipment: c.equipment as string,
      siteName: c.site_name as string | null,
      clientRatePt: c.client_rate_pt as number,
      supplierRatePt: c.supplier_rate_pt as number,
      startDate: c.start_date as string,
      endDate: c.end_date as string | null,
      status: c.status as string,
    },
    month: m,
    months,
    closed,
    client: { days: client.days, totals: client.totals },
    supplier: { days: supplier.days, totals: supplier.totals },
  };
}

export type SarkiView = ReturnType<typeof sarkiView>;

/** Pick-lists for the "عقد جديد" form. */
export function contractOptions(db: Db) {
  return {
    clients: db.prepare("SELECT id, name, kind, vat_applies, tax5_applies FROM clients WHERE deleted_at IS NULL ORDER BY name").all() as {
      id: number;
      name: string;
      kind: "company" | "individual";
      vat_applies: number;
      tax5_applies: number;
    }[],
    suppliers: db.prepare("SELECT id, name FROM suppliers WHERE deleted_at IS NULL ORDER BY name").all() as { id: number; name: string }[],
    equipment: db
      .prepare(
        `SELECT e.id, e.name, e.site_name, e.supplier_rate_pt, e.supplier_id, s.name AS supplier FROM equipment e
         JOIN suppliers s ON s.id = e.supplier_id WHERE e.deleted_at IS NULL ORDER BY e.name`,
      )
      .all() as { id: number; name: string; site_name: string | null; supplier_rate_pt: number | null; supplier_id: number; supplier: string }[],
  };
}

export type ContractOptions = ReturnType<typeof contractOptions>;

// ---------------- أصحاب المعدات ----------------

export function suppliersView(db: Db, supplierId?: number, now: string = today()) {
  const books = computeBooks(db, now);
  const suppliers = db.prepare("SELECT id, name, phone, notes FROM suppliers WHERE deleted_at IS NULL ORDER BY name").all() as {
    id: number;
    name: string;
    phone: string | null;
    notes: string | null;
  }[];
  const list = suppliers.map((s) => {
    const st = supplierStatement(db, s.id, now, books);
    return { ...s, equipmentCount: st.equipment.length, remainingPt: st.totals.remainingPt };
  });
  const id = supplierId && suppliers.some((s) => s.id === supplierId) ? supplierId : suppliers[0]?.id;
  if (!id) return { list, selected: null };
  const st = supplierStatement(db, id, now, books);
  const active = new Map(
    (db.prepare("SELECT equipment_id, site_name FROM contracts WHERE supplier_id = ? AND status = 'active' AND deleted_at IS NULL").all(id) as { equipment_id: number; site_name: string | null }[]).map((c) => [
      c.equipment_id,
      c,
    ]),
  );
  const contracts = (
    db
      .prepare(
        `SELECT c.id, c.code, c.start_date, c.end_date, e.name AS equipment FROM contracts c JOIN equipment e ON e.id = c.equipment_id
         WHERE c.supplier_id = ? AND c.deleted_at IS NULL ORDER BY c.id DESC`,
      )
      .all(id) as { id: number; code: string; start_date: string; end_date: string | null; equipment: string }[]
  ).map((c) => ({ ...c, months: monthsOfContract(c, now) }));
  return {
    list,
    selected: {
      supplier: st.supplier as { id: number; name: string; phone: string | null },
      equipment: (st.equipment as { id: number; name: string; site_name: string | null; supplier_rate_pt: number | null }[]).map((e) => ({
        ...e,
        working: active.has(e.id),
      })),
      rows: st.rows,
      byEquipment: st.byEquipment,
      totals: st.totals,
      payments: st.payments,
      deductions: st.deductions,
      contracts,
    },
  };
}

export type SuppliersView = ReturnType<typeof suppliersView>;
