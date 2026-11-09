import { percent, Piasters } from "./money";

// One contract in one month. Fixed order: margin → tax → expenses.
// VAT sits on top of the client amount and never touches profit.
// Tax on our side is one of two systems, by month:
//  - before withholding: 5% of the margin (we owe it).
//  - withholding (whtBp set): the client keeps e.g. 3% of the daily base before
//    adding VAT and pays it to the tax office for us — the invoice total is
//    base − 3% + 14%, and the 3% comes out of our margin (the owner is paid in full).
export interface ContractMonthInput {
  clientBasePt: Piasters; // from the client sarki (+ adjustments)
  supplierCostPt: Piasters; // from the supplier sarki (+ adjustments)
  contractExpensesPt: Piasters;
  vatApplies: boolean;
  tax5Applies: boolean;
  vatBp: number;
  tax5Bp: number;
  /** نسبة الاستقطاع من اليومية (null = النظام القديم: ٥٪ على الهامش) */
  whtBp?: number | null;
}

export interface ContractMonthResult {
  clientBasePt: Piasters;
  vatPt: Piasters;
  invoiceTotalPt: Piasters;
  supplierCostPt: Piasters;
  marginPt: Piasters;
  tax5Pt: Piasters;
  /** الاستقطاع من المنبع (العميل خصمه من اليومية) */
  whtPt: Piasters;
  afterTax5Pt: Piasters;
  expensesPt: Piasters;
  netPt: Piasters;
}

export function contractMonth(i: ContractMonthInput): ContractMonthResult {
  const vatPt = i.vatApplies ? percent(i.clientBasePt, i.vatBp) : 0;
  const marginPt = i.clientBasePt - i.supplierCostPt;
  // A negative margin (rare) pays no 5%; the loss flows into the month's profit.
  const withholding = i.whtBp != null;
  const tax5Pt = !withholding && i.tax5Applies && marginPt > 0 ? percent(marginPt, i.tax5Bp) : 0;
  const whtPt = withholding && i.tax5Applies ? percent(i.clientBasePt, i.whtBp!) : 0;
  const afterTax5Pt = marginPt - tax5Pt - whtPt;
  return {
    clientBasePt: i.clientBasePt,
    vatPt,
    invoiceTotalPt: i.clientBasePt - whtPt + vatPt,
    supplierCostPt: i.supplierCostPt,
    marginPt,
    tax5Pt,
    whtPt,
    afterTax5Pt,
    expensesPt: i.contractExpensesPt,
    netPt: afterTax5Pt - i.contractExpensesPt,
  };
}
