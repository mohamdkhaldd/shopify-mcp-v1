import { HassanLedgerType } from "../../api/types";
import { person } from "../../person";

export const ledgerTypes = (): { value: HassanLedgerType; label: string }[] => [
  { value: "loan", label: `سلفة/دين على ${person()}` },
  { value: "repayment", label: `سداد من ${person()}` },
  { value: "due", label: `مستحق ل${person()}` },
  { value: "collection", label: `تحصيل ل${person()}` },
];

export function typeLabel(type: HassanLedgerType) {
  return ledgerTypes().find((t) => t.value === type)?.label ?? type;
}
