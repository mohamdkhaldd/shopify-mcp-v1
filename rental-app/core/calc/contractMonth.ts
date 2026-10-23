import { percent, Piasters } from "./money";

// One contract in one month. Fixed order: margin → 5% → expenses.
// VAT sits on top of the client amount and never touches profit.
export interface ContractMonthInput {
  clientBasePt: Piasters; // from the client sarki (+ adjustments)
  supplierCostPt: Piasters; // from the supplier sarki (+ adjustments)
  contractExpensesPt: Piasters;
  vatApplies: boolean;
  tax5Applies: boolean;
  vatBp: number;
  tax5Bp: number;
}

export interface ContractMonthResult {
  clientBasePt: Piasters;
  vatPt: Piasters;
  invoiceTotalPt: Piasters;
  supplierCostPt: Piasters;
  marginPt: Piasters;
  tax5Pt: Piasters;
  afterTax5Pt: Piasters;
  expensesPt: Piasters;
  netPt: Piasters;
}

export function contractMonth(i: ContractMonthInput): ContractMonthResult {
  const vatPt = i.vatApplies ? percent(i.clientBasePt, i.vatBp) : 0;
  const marginPt = i.clientBasePt - i.supplierCostPt;
  // A negative margin (rare) pays no 5%; the loss flows into the month's profit.
  const tax5Pt = i.tax5Applies && marginPt > 0 ? percent(marginPt, i.tax5Bp) : 0;
  const afterTax5Pt = marginPt - tax5Pt;
  return {
    clientBasePt: i.clientBasePt,
    vatPt,
    invoiceTotalPt: i.clientBasePt + vatPt,
    supplierCostPt: i.supplierCostPt,
    marginPt,
    tax5Pt,
    afterTax5Pt,
    expensesPt: i.contractExpensesPt,
    netPt: afterTax5Pt - i.contractExpensesPt,
  };
}
