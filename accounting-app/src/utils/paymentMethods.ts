import { PaymentMethod } from "../api/types";

export const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "wallet", label: "اكسيس باي" },
  { value: "instapay", label: "انستا باي" },
  { value: "cash", label: "كاش" },
  { value: "vodafone_cash", label: "فودفون كاش" },
];

export function paymentMethodLabel(value: string | null): string {
  if (value === "custody") return "عهدة";
  if (value === "car") return "من فلوس العربية";
  return PAYMENT_METHODS.find((m) => m.value === value)?.label ?? value ?? "—";
}
