import { Db, monthOf, today } from "../db";
import { computeBooks } from "./books";
import { clientStatement, dashboard, supplierStatement } from "./reports";
import { getSheet } from "./sarki";
import { daysPresent } from "../calc/timeWeight";

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

// ---------------- الشركات والأفراد ----------------

export function clientsView(db: Db, clientId?: number, now: string = today()) {
  const books = computeBooks(db, now);
  const clients = db.prepare("SELECT id, kind, name, phone, tax_id, vat_applies, tax5_applies FROM clients WHERE deleted_at IS NULL ORDER BY name").all() as {
    id: number;
    kind: "company" | "individual";
    name: string;
    phone: string | null;
    tax_id: string | null;
    vat_applies: number;
    tax5_applies: number;
  }[];
  const list = clients.map((c) => ({ ...c, remainingPt: clientStatement(db, c.id, now, books).totals.remainingPt }));
  const id = clientId && clients.some((c) => c.id === clientId) ? clientId : clients[0]?.id;
  if (!id) return { list, selected: null };
  const st = clientStatement(db, id, now, books);
  const closedMonths = new Set((db.prepare("SELECT month FROM month_closes").all() as { month: string }[]).map((r) => r.month));
  const contracts = (
    db
      .prepare(
        `SELECT c.id, c.code, c.start_date, c.end_date, e.name AS equipment FROM contracts c JOIN equipment e ON e.id = c.equipment_id
         WHERE c.client_id = ? AND c.deleted_at IS NULL ORDER BY c.id DESC`,
      )
      .all(id) as { id: number; code: string; start_date: string; end_date: string | null; equipment: string }[]
  ).map((c) => ({ ...c, months: monthsOfContract(c, now) }));
  const code = new Map(contracts.map((c) => [c.id, c.code]));
  const equipment = new Map(contracts.map((c) => [c.id, c.equipment]));
  // monthly statement: what was invoiced (with VAT) and what was paid, month by month
  const months = [...new Set([...st.invoices.map((i) => i.month), ...st.payments.map((p) => p.date.slice(0, 7))])].sort();
  let running = 0;
  const rows = months.map((month) => {
    const invoicedPt = st.invoices.filter((i) => i.month === month).reduce((s, i) => s + i.totalPt, 0);
    const paidPt = st.payments.filter((p) => p.date.startsWith(month)).reduce((s, p) => s + p.amountPt, 0);
    running += invoicedPt - paidPt;
    return { month, invoicedPt, paidPt, runningPt: running };
  });
  return {
    list,
    selected: {
      client: st.client as (typeof clients)[number],
      totals: st.totals,
      rows,
      invoices: st.invoices.map((i) => ({
        ...i,
        code: code.get(i.contractId) ?? "",
        equipment: equipment.get(i.contractId) ?? "",
        monthClosed: closedMonths.has(i.month),
        status: i.totalPt < 0 ? ("credit" as const) : i.openPt <= 0 ? ("paid" as const) : i.collectedPt + i.creditedPt > 0 ? ("partial" as const) : ("unpaid" as const),
      })),
      payments: st.payments,
      contracts,
    },
  };
}

export type ClientsView = ReturnType<typeof clientsView>;

// ---------------- الإدارة ----------------

export function managementView(db: Db, month?: string, now: string = today()) {
  const books = computeBooks(db, now);
  const months = books.months.map((m) => m.month);
  const m = books.months.find((x) => x.month === (month && months.includes(month) ? month : monthOf(now))) ?? books.months[books.months.length - 1];
  const names = (t: string) => new Map((db.prepare(`SELECT id, name FROM ${t}`).all() as { id: number; name: string }[]).map((r) => [r.id, r.name]));
  const clients = names("clients");
  const suppliers = names("suppliers");
  const equipment = names("equipment");
  const contracts = db.prepare("SELECT id, code, equipment_id, status FROM contracts WHERE deleted_at IS NULL ORDER BY id DESC").all() as {
    id: number;
    code: string;
    equipment_id: number;
    status: string;
  }[];

  const rows = (m?.contracts ?? []).map((r) => ({
    ...r,
    client: clients.get(r.clientId) ?? "",
    supplier: suppliers.get(r.supplierId) ?? "",
    equipment: equipment.get(r.equipmentId) ?? "",
  }));
  const byEquipment = [...new Set(rows.map((r) => r.equipmentId))].map((id) => {
    const rs = rows.filter((r) => r.equipmentId === id);
    const s = (f: (r: (typeof rows)[number]) => number) => rs.reduce((a, r) => a + f(r), 0);
    return {
      equipmentId: id,
      equipment: rs[0].equipment,
      supplier: rs[0].supplier,
      clients: [...new Set(rs.map((r) => r.client))].join("، "),
      marginPt: s((r) => r.marginPt),
      tax5Pt: s((r) => r.tax5Pt),
      expensesPt: s((r) => r.expensesPt),
      netPt: s((r) => r.netPt),
    };
  });

  const expenses = m
    ? (
        db
          .prepare(
            `SELECT x.id, x.kind, x.date, x.amount_pt, x.note, x.contract_id, c.code, k.name AS category
             FROM expenses x LEFT JOIN contracts c ON c.id = x.contract_id LEFT JOIN expense_categories k ON k.id = x.category_id
             WHERE substr(x.date, 1, 7) = ? AND x.deleted_at IS NULL AND x.reversal_of IS NULL
               AND NOT EXISTS (SELECT 1 FROM expenses r WHERE r.reversal_of = x.id AND r.deleted_at IS NULL)
             ORDER BY x.date, x.id`,
          )
          .all(m.month) as { id: number; kind: "contract" | "general"; date: string; amount_pt: number; note: string | null; contract_id: number | null; code: string | null; category: string | null }[]
      )
    : [];

  const payouts = (
    db
      .prepare("SELECT id, date, amount_pt, note FROM profit_payouts WHERE payee_kind = 'management' AND deleted_at IS NULL AND reversal_of IS NULL ORDER BY date DESC")
      .all() as { id: number; date: string; amount_pt: number; note: string | null }[]
  ).map((p) => ({ id: p.id, date: p.date, contractId: null, amountPt: p.amount_pt, note: p.note }));

  // months close in order, and only after they end
  const closable = books.months.find((x) => !x.closed && x.month < monthOf(now))?.month ?? null;
  const adjustments = db
    .prepare(
      `SELECT a.id, a.applied_month, a.target_month, a.kind, a.amount_pt, a.reason, c.code FROM adjustments a JOIN contracts c ON c.id = a.contract_id
       ORDER BY a.id DESC`,
    )
    .all() as { id: number; applied_month: string; target_month: string; kind: "client_base" | "supplier_cost"; amount_pt: number; reason: string; code: string }[];

  return {
    month: m?.month ?? monthOf(now),
    months: books.months.map((x) => ({ month: x.month, closed: x.closed })),
    closed: !!m?.closed,
    rates: m?.rates ?? null,
    rows,
    byEquipment,
    totals: {
      clientBasePt: rows.reduce((a, r) => a + r.clientBasePt, 0),
      supplierCostPt: rows.reduce((a, r) => a + r.supplierCostPt, 0),
      marginPt: rows.reduce((a, r) => a + r.marginPt, 0),
      tax5Pt: rows.reduce((a, r) => a + r.tax5Pt, 0),
      contractExpensesPt: rows.reduce((a, r) => a + r.expensesPt, 0),
      generalExpensesPt: m?.generalExpensesPt ?? 0,
      monthNetPt: m?.monthNetPt ?? 0,
      carryInPt: m?.carryInPt ?? 0,
      carryOutPt: m?.carryOutPt ?? 0,
      managementPt: m?.distribution.managementPt ?? 0,
      investorsPt: m?.distribution.investorsPoolPt ?? 0,
      releasableManagementPt: m?.releasableManagementPt ?? 0,
    },
    expenses,
    categories: db.prepare("SELECT id, name FROM expense_categories WHERE deleted_at IS NULL ORDER BY name").all() as { id: number; name: string }[],
    contracts: contracts.map((c) => ({ id: c.id, code: c.code, equipment: equipment.get(c.equipment_id) ?? "", active: c.status === "active" })),
    history: books.months
      .map((x) => ({
        month: x.month,
        closed: x.closed,
        netPt: x.monthNetPt,
        carryInPt: x.carryInPt ?? 0,
        managementPt: x.distribution.managementPt,
        releasablePt: x.releasableManagementPt,
      }))
      .reverse(),
    management: { ...books.management, payableNowPt: Math.max(0, books.management.releasablePt - books.management.paidPt) },
    payouts,
    closable,
    adjustments,
    closedMonths: books.months.filter((x) => x.closed).map((x) => x.month),
  };
}

export type ManagementView = ReturnType<typeof managementView>;

// ---------------- المستثمرين ----------------

/** Profits are paid every three months: the next payout is the end of the current quarter. */
export function nextPayoutMonth(now: string) {
  const [y, m] = now.slice(0, 7).split("-").map(Number);
  const q = Math.ceil(m / 3) * 3;
  return `${y}-${String(q).padStart(2, "0")}`;
}

export function investorsView(db: Db, month?: string, now: string = today()) {
  const books = computeBooks(db, now);
  const phones = new Map((db.prepare("SELECT id, phone FROM investors").all() as { id: number; phone: string | null }[]).map((r) => [r.id, r.phone]));
  const names = new Map(books.investors.map((i) => [i.investorId, i.name]));
  const m = books.months.find((x) => x.month === (month ?? monthOf(now))) ?? books.months[books.months.length - 1];

  // نصيب كل مستثمر اتحسب إزاي: money × days present, for the chosen month
  const movements = (db
    .prepare(
      `SELECT c.id, c.investor_id, c.kind, c.date, c.amount_pt, c.note FROM capital_movements c
       WHERE c.deleted_at IS NULL AND c.reversal_of IS NULL AND NOT EXISTS (SELECT 1 FROM capital_movements r WHERE r.reversal_of = c.id AND r.deleted_at IS NULL)
       ORDER BY c.date, c.id`,
    )
    .all() as { id: number; investor_id: number; kind: "deposit" | "withdrawal"; date: string; amount_pt: number; note: string | null }[]);
  const totalWeight = m ? m.distribution.investors.reduce((s, x) => s + x.weight, 0n) : 0n;
  const split = m
    ? m.distribution.investors.map((x) => {
        const mv = movements.filter((c) => c.investor_id === x.investorId).map((c) => ({ date: c.date, signedPt: c.kind === "deposit" ? c.amount_pt : -c.amount_pt }));
        const end = `${m.month}-31`;
        return {
          investorId: x.investorId,
          name: names.get(x.investorId) ?? "",
          capitalAtEndPt: mv.filter((c) => c.date <= end).reduce((s, c) => s + c.signedPt, 0),
          daysPresent: daysPresent(mv, m.month),
          /** share of the pool in bp */
          shareBp: totalWeight > 0n ? Number((x.weight * 10_000n) / totalWeight) : 0,
          sharePt: x.sharePt,
        };
      })
    : [];

  const payouts = (
    db
      .prepare(
        `SELECT p.id, p.investor_id, p.date, p.amount_pt, p.note FROM profit_payouts p
         WHERE p.payee_kind = 'investor' AND p.deleted_at IS NULL AND p.reversal_of IS NULL
           AND NOT EXISTS (SELECT 1 FROM profit_payouts r WHERE r.reversal_of = p.id AND r.deleted_at IS NULL)
         ORDER BY p.date DESC, p.id DESC`,
      )
      .all() as { id: number; investor_id: number; date: string; amount_pt: number; note: string | null }[]
  ).map((p) => ({ ...p, name: names.get(p.investor_id) ?? "" }));

  const totalAccrued = books.investors.reduce((s, i) => s + i.accruedPt, 0);
  return {
    month: m?.month ?? monthOf(now),
    months: books.months.map((x) => ({ month: x.month, closed: x.closed })),
    investors: books.investors.map((i) => ({ ...i, phone: phones.get(i.investorId) ?? null })),
    totals: {
      capitalPt: books.capital.totalPt,
      deployedPt: books.capital.deployedPt,
      inTreasuryPt: books.capital.inTreasuryPt,
      accruedPt: totalAccrued,
      releasablePt: books.investors.reduce((s, i) => s + i.releasablePt, 0),
      paidPt: books.investors.reduce((s, i) => s + i.paidPt, 0),
      payableNowPt: books.investors.reduce((s, i) => s + i.payableNowPt, 0),
    },
    month_: m
      ? { poolPt: m.distribution.investorsPoolPt, remainderToManagementPt: m.distribution.remainderToManagementPt, releasablePt: [...m.releasableByInvestor.values()].reduce((s, v) => s + v, 0), closed: m.closed }
      : null,
    split,
    movements: movements.map((c) => ({ ...c, name: names.get(c.investor_id) ?? "" })).reverse(),
    payouts,
    nextPayoutMonth: nextPayoutMonth(now),
  };
}

export type InvestorsView = ReturnType<typeof investorsView>;
