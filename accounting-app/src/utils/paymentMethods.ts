import { PaymentMethod } from "../api/types";

export const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "wallet", label: "اكسيس باي" },
  { value: "instapay", label: "انستا باي" },
  { value: "cash", label: "كاش" },
  { value: "vodafone_cash", label: "فودفون كاش" },
];

export function paymentMethodLabel(value: string | null): string {
  return PAYMENT_METHODS.find((m) => m.value === value)?.label ?? value ?? "—";
}
