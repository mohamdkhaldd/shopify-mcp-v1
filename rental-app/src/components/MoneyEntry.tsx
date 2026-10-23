import { ReactNode, useState } from "react";
import { ApiError } from "../api/client";
import { Labeled, Select, TextInput } from "./Field";
import { Button, ErrorBox } from "./ui";
import { moneyToPt } from "../utils/input";
import { today } from "../../core/db";
import { pounds } from "../utils/format";

export interface MoneyEntryValue {
  date: string;
  amountPt: number;
  contractId: number | null;
  note: string;
  confirmNegative?: boolean;
}

/**
 * The "new payment" row used on every page: date, amount, optional contract,
 * note. If the core answers that cash would go negative, it asks once more
 * in place instead of failing.
 */
export default function MoneyEntry({
  title,
  contracts,
  notePlaceholder,
  noteRequired,
  extra,
  saveLabel = "حفظ",
  onSave,
}: {
  title: string;
  contracts: { id: number; label: string }[];
  notePlaceholder?: string;
  noteRequired?: boolean;
  extra?: ReactNode;
  saveLabel?: string;
  onSave: (v: MoneyEntryValue) => Promise<unknown>;
}) {
  const [date, setDate] = useState(today());
  const [amount, setAmount] = useState("");
  const [contract, setContract] = useState<string>(contracts.length === 1 ? String(contracts[0].id) : "");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirmCash, setConfirmCash] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save(confirmNegative = false) {
    setError(null);
    let amountPt: number | null;
    try {
      amountPt = moneyToPt(amount);
    } catch (e) {
      setError((e as Error).message);
      return;
    }
    if (!amountPt || amountPt <= 0) return setError("اكتب المبلغ");
    if (noteRequired && !note.trim()) return setError("اكتب البيان");
    setBusy(true);
    try {
      await onSave({ date, amountPt, contractId: contract ? Number(contract) : null, note: note.trim(), confirmNegative });
      setAmount("");
      setNote("");
      setConfirmCash(null);
    } catch (e) {
      if (e instanceof ApiError && e.code === "cash_negative") setConfirmCash(e.message);
      else setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="no-print grid gap-2 px-4 py-3 border-b border-line bg-surface-2">
      <div className="flex flex-wrap items-end gap-2.5">
        <b className="w-full text-xs text-muted">{title}</b>
        <Labeled label="التاريخ">
          <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-36" />
        </Labeled>
        <Labeled label="المبلغ">
          <TextInput value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="مثلًا 20000" inputMode="decimal" className="w-28" />
        </Labeled>
        {contracts.length > 0 && (
          <Labeled label="عن أنهي معدة؟ (لو عنده أكتر من عقد)">
            <Select value={contract} onChange={(e) => setContract(e.target.value)}>
              <option value="">— مش محددة (على الأقدم) —</option>
              {contracts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </Select>
          </Labeled>
        )}
        <Labeled label={noteRequired ? "البيان" : "ملاحظة"}>
          <TextInput value={note} onChange={(e) => setNote(e.target.value)} placeholder={notePlaceholder} className="w-52" />
        </Labeled>
        {extra}
        <Button primary onClick={() => save()} disabled={busy}>
          {saveLabel}
        </Button>
      </div>
      {error && <ErrorBox message={error} />}
      {confirmCash && (
        <div className="flex flex-wrap items-center gap-3 rounded-card border border-amber bg-amber-soft px-4 py-2.5 font-semibold">
          <span>⚠ {confirmCash}</span>
          <Button danger onClick={() => save(true)} disabled={busy}>
            أيوه، اصرف {amount ? pounds(moneyToPt(amount) ?? 0) : ""}
          </Button>
          <Button onClick={() => setConfirmCash(null)}>لأ</Button>
        </div>
      )}
    </div>
  );
}
