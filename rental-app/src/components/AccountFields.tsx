import { useEffect, useState } from "react";
import { api, Money, TreasuryAccount } from "../api/client";
import { Labeled, Select, TextInput } from "./Field";
import { pounds } from "../utils/format";

// حساب الخزنة اللي الفلوس داخلة عليه / طالعة منه (انستا باي / محفظة).
// الطالع من حساب عليه عمولة: "تحويل" (بعمولة) ولا "دفع" (من غير).
// الداخل: لو لسه مع حد ومسلمهوش للخزنة، اكتب اسمه — مش هيدخل الرصيد لحد ما يوصل.

let cache: Promise<TreasuryAccount[]> | null = null;
export const loadAccounts = () => (cache ??= api.accounts().catch((e) => ((cache = null), Promise.reject(e))));
export const reloadAccounts = () => ((cache = null), loadAccounts());

export function feeOf(a: TreasuryAccount | undefined, amountPt: number) {
  if (!a || (!a.feeBp && !a.feeMinPt) || !(amountPt > 0)) return 0;
  let fee = Math.round((amountPt * a.feeBp) / 10_000);
  fee = Math.max(fee, a.feeMinPt);
  if (a.feeMaxPt != null) fee = Math.min(fee, a.feeMaxPt);
  return fee;
}

export function useAccounts() {
  const [accounts, setAccounts] = useState<TreasuryAccount[]>([]);
  useEffect(() => {
    loadAccounts().then(setAccounts, () => {});
  }, []);
  return accounts;
}

/** null = تمام، أو رسالة الغلط (مختارش تحويل ولا دفع). */
export function moneyProblem(m: Money, accounts: TreasuryAccount[], direction: "in" | "out") {
  if (direction !== "out") return null;
  const a = accounts.find((x) => x.key === (m.account || accounts[0]?.key));
  if (a && (a.feeBp || a.feeMinPt) && m.transferFee === undefined) return `اختار: الفلوس دي اتبعتت من ${a.name} "تحويل" ولا "دفع"؟`;
  return null;
}

export default function AccountFields({ direction, value, onChange, amountPt }: { direction: "in" | "out"; value: Money; onChange: (m: Money) => void; amountPt: number | null }) {
  const accounts = useAccounts();
  const key = value.account || accounts[0]?.key || "";
  const acc = accounts.find((a) => a.key === key);
  const hasFee = !!acc && (acc.feeBp > 0 || acc.feeMinPt > 0);
  const fee = feeOf(acc, amountPt ?? 0);
  return (
    <>
      <Labeled label={direction === "in" ? "دخلت على" : "اتدفعت من"}>
        <Select value={key} onChange={(e) => onChange({ ...value, account: e.target.value, transferFee: undefined })}>
          {accounts.map((a) => (
            <option key={a.key} value={a.key}>
              {a.name}
            </option>
          ))}
        </Select>
      </Labeled>
      {direction === "out" && hasFee && (
        <Labeled label="تحويل ولا دفع؟">
          <Select
            value={value.transferFee === undefined ? "" : value.transferFee ? "transfer" : "pay"}
            onChange={(e) => onChange({ ...value, account: key, transferFee: e.target.value === "" ? undefined : e.target.value === "transfer" })}
          >
            <option value="">— اختار —</option>
            <option value="transfer">تحويل (عليه عمولة{fee ? ` ${pounds(fee)}` : ""})</option>
            <option value="pay">دفع (من غير عمولة)</option>
          </Select>
        </Labeled>
      )}
      {direction === "in" && (
        <Labeled label="لسه مع مين؟ (لو موصلتش الخزنة)">
          <TextInput value={value.heldBy ?? ""} onChange={(e) => onChange({ ...value, account: key, heldBy: e.target.value })} className="w-40" placeholder="فاضي = وصلت" />
        </Labeled>
      )}
    </>
  );
}
