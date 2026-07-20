import { PaymentMethod } from "../api/types";

export const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "wallet", label: "محفظة" },
  { value: "instapay", label: "انستا باي" },
  { value: "cash", label: "كاش" },
];

export function paymentMethodLabel(value: string | null): string {
  return PAYMENT_METHODS.find((m) => m.value === value)?.label ?? value ?? "—";
}
