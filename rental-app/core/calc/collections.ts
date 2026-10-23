import { portion, Piasters } from "./money";

// Allocates client payments to monthly invoices. A payment tied to a contract
// pays that contract's oldest open invoice first; any other payment (or what's
// left of one) pays the client's oldest open invoice. Anything beyond that is
// client credit.

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
}

export interface InvoiceCollection extends InvoiceLine {
  collectedPt: Piasters;
  collectedVatPt: Piasters;
  collectedBasePt: Piasters;
}

export interface Allocation {
  invoices: InvoiceCollection[];
  creditByClient: Map<number, Piasters>;
}

export function allocatePayments(invoices: InvoiceLine[], payments: PaymentLine[]): Allocation {
  const inv = [...invoices]
    .sort((a, b) => a.month.localeCompare(b.month) || a.contractId - b.contractId)
    .map((i) => ({ ...i, collectedPt: 0 }));
  const credit = new Map<number, Piasters>();
  const pay = (target: (typeof inv)[number][], amount: number) => {
    for (const i of target) {
      if (amount <= 0) break;
      const open = i.totalPt - i.collectedPt;
      if (open <= 0) continue;
      const take = Math.min(open, amount);
      i.collectedPt += take;
      amount -= take;
    }
    return amount;
  };
  for (const p of [...payments].sort((a, b) => a.date.localeCompare(b.date))) {
    let left = p.amountPt;
    if (left <= 0) continue;
    if (p.contractId != null) left = pay(inv.filter((i) => i.contractId === p.contractId), left);
    left = pay(inv.filter((i) => i.clientId === p.clientId), left);
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
