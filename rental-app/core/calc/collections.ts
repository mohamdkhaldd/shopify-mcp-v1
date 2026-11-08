import { portion, Piasters } from "./money";

// Allocates client payments to monthly invoices. A payment tied to a contract
// pays that contract's oldest open invoice first (a payment marked "for month X"
// pays that month's invoices before anything else); any other payment (or what's
// left of one) pays the client's oldest open invoice. Anything beyond that is
// client credit. Credit notes (a correction that lowers a closed month) close
// open invoices the same way, but they are not cash: they never count as
// "collected" (no VAT collected, no profit released).

export interface InvoiceLine {
  clientId: number;
  contractId: number;
  month: string; // YYYY-MM
  basePt: Piasters;
  vatPt: Piasters;
  totalPt: Piasters;
}

export interface PaymentLine {
  clientId: number;
  contractId: number | null;
  date: string;
  amountPt: Piasters;
  /** "عن شهر كذا": يسدد فواتير الشهر ده الأول (فاضي = الأقدم الأول) */
  forMonth?: string | null;
}

/** دفعة سددت جزء من فاتورة/شهر */
export interface Covered {
  date: string;
  amountPt: Piasters;
}

export interface CreditLine {
  clientId: number;
  contractId: number;
  month: string;
  amountPt: Piasters;
}

export interface InvoiceCollection extends InvoiceLine {
  collectedPt: Piasters;
  /** الدفعات اللي سددت الفاتورة دي */
  covered: Covered[];
  /** closed by a credit note, not by cash */
  creditedPt: Piasters;
  collectedVatPt: Piasters;
  collectedBasePt: Piasters;
}

export interface Allocation {
  invoices: InvoiceCollection[];
  creditByClient: Map<number, Piasters>;
}

export function allocatePayments(invoices: InvoiceLine[], payments: PaymentLine[], credits: CreditLine[] = []): Allocation {
  const inv = [...invoices]
    .sort((a, b) => a.month.localeCompare(b.month) || a.contractId - b.contractId)
    .map((i) => ({ ...i, collectedPt: 0, creditedPt: 0, covered: [] as Covered[] }));
  const credit = new Map<number, Piasters>();
  const apply = (target: (typeof inv)[number][], amount: number, field: "collectedPt" | "creditedPt", date: string) => {
    for (const i of target) {
      if (amount <= 0) break;
      const open = i.totalPt - i.collectedPt - i.creditedPt;
      if (open <= 0) continue;
      const take = Math.min(open, amount);
      i[field] += take;
      if (field === "collectedPt") i.covered.push({ date, amountPt: take });
      amount -= take;
    }
    return amount;
  };
  const events = [
    ...credits.map((c) => ({ date: `${c.month}-01`, clientId: c.clientId, contractId: c.contractId as number | null, amountPt: c.amountPt, forMonth: null as string | null | undefined, field: "creditedPt" as const })),
    ...payments.map((p) => ({ ...p, field: "collectedPt" as const })),
  ].sort((a, b) => a.date.localeCompare(b.date));
  for (const p of events) {
    let left = p.amountPt;
    if (left <= 0) continue;
    if (p.forMonth) {
      const ofMonth = inv.filter((i) => i.clientId === p.clientId && i.month === p.forMonth);
      if (p.contractId != null) left = apply(ofMonth.filter((i) => i.contractId === p.contractId), left, p.field, p.date);
      left = apply(ofMonth, left, p.field, p.date);
    }
    if (p.contractId != null) left = apply(inv.filter((i) => i.contractId === p.contractId), left, p.field, p.date);
    left = apply(inv.filter((i) => i.clientId === p.clientId), left, p.field, p.date);
    if (left > 0) credit.set(p.clientId, (credit.get(p.clientId) ?? 0) + left);
  }
  return {
    invoices: inv.map((i) => {
      const collectedBasePt = i.totalPt === 0 ? 0 : portion(i.collectedPt, i.basePt, i.totalPt);
      return { ...i, collectedBasePt, collectedVatPt: i.collectedPt - collectedBasePt };
    }),
    creditByClient: credit,
  };
}

/** What may be paid out of a share, in proportion to what clients actually paid for that month. */
export function releasable(sharePt: Piasters, collectedBasePt: Piasters, invoicedBasePt: Piasters): Piasters {
  if (sharePt <= 0 || invoicedBasePt <= 0) return 0;
  return portion(sharePt, Math.min(collectedBasePt, invoicedBasePt), invoicedBasePt);
}

/**
 * حساب شهر بشهر لطرف واحد (صاحب معدة): اللي عليه في كل شهر، والدفعات.
 * الدفعة "عن شهر كذا" بتسدد الشهر ده الأول؛ والباقي منها والدفعات من غير شهر
 * بتسدد الأقدم الأول (بترتيب تاريخ الدفعة). الزيادة عن كل الشهور = مقدّم.
 */
export function allocateByMonth(
  dues: { month: string; amountPt: Piasters }[],
  pays: { date: string; amountPt: Piasters; forMonth?: string | null }[],
) {
  const rows = [...dues]
    .filter((d) => d.amountPt !== 0)
    .sort((a, b) => a.month.localeCompare(b.month))
    .map((d) => ({ month: d.month, duePt: d.amountPt, paidPt: 0, covered: [] as Covered[] }));
  const apply = (target: typeof rows, amount: number, date: string) => {
    for (const r of target) {
      if (amount <= 0) break;
      const take = Math.min(amount, Math.max(0, r.duePt - r.paidPt));
      if (take <= 0) continue;
      r.paidPt += take;
      r.covered.push({ date, amountPt: take });
      amount -= take;
    }
    return amount;
  };
  let advancePt = 0;
  for (const p of [...pays].sort((a, b) => a.date.localeCompare(b.date))) {
    let left = p.amountPt;
    if (p.forMonth) left = apply(rows.filter((r) => r.month === p.forMonth), left, p.date);
    left = apply(rows, left, p.date);
    advancePt += left;
  }
  return { months: rows.map((r) => ({ ...r, openPt: r.duePt - r.paidPt })), advancePt };
}
