import { useState } from "react";
import Icon from "./Icon";
import Modal from "./Modal";
import { treasuryApi } from "../api/client";
import { PAYMENT_METHODS } from "../utils/paymentMethods";
import { useUndo } from "../context/UndoContext";

/**
 * زرار «✎ تعديل» لأي سطر فلوس (دفعة، سلفة، مكافأة، خصم، مصروف، بنزين…):
 * بيعدّل التاريخ والمبلغ وطريقة الدفع والبيان في الجدول نفسه، والخزنة بتتحسب
 * من الجدول فبتتظبط لوحدها. «تراجع» بيرجّع القديم.
 */
export default function EditRowButton({
  src,
  row,
  onSaved,
  withMethod = true,
  expenseTotal = false,
}: {
  /** اسم الجدول (partner_payments، employee_advances…) */
  src: string;
  row: { id: number; date: string | null; amount: number; method?: string | null; note?: string | null };
  onSaved: () => void;
  withMethod?: boolean;
  /** مصروف معدة: المبلغ = إجمالي المصروف مش اللي اتدفع */
  expenseTotal?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(row.date ?? "");
  const [amount, setAmount] = useState(String(row.amount));
  const [method, setMethod] = useState(row.method ?? "cash");
  const [note, setNote] = useState(row.note ?? "");
  const [error, setError] = useState<string | null>(null);
  const { pushUndo } = useUndo();

  async function save() {
    setError(null);
    try {
      await treasuryApi.movementUpdate({
        src,
        src_id: row.id,
        date,
        amount: Number(amount),
        account: withMethod ? method : undefined,
        note,
        expenseTotal,
      });
    } catch (e) {
      setError((e as Error).message.replace(/^Error invoking remote method '[^']+': (Error: )?/, ""));
      return;
    }
    setOpen(false);
    onSaved();
    const before = { ...row };
    pushUndo("اتعدّل السطر", async () => {
      await treasuryApi.movementUpdate({
        src,
        src_id: before.id,
        date: before.date ?? date,
        amount: before.amount,
        account: withMethod ? before.method ?? undefined : undefined,
        note: before.note ?? null,
        expenseTotal,
      });
      onSaved();
    });
  }

  const cls = "rounded-lg border border-slate-200 px-2 py-1.5 text-sm w-full";
  return (
    <>
      <button
        type="button"
        title="تعديل"
        onClick={() => {
          setDate(row.date ?? "");
          setAmount(String(row.amount));
          setMethod(row.method ?? "cash");
          setNote(row.note ?? "");
          setOpen(true);
        }}
        className="no-print text-xs font-bold text-slate-500 hover:text-primary-dark px-1.5"
      >
        <Icon name="edit" className="w-3.5 h-3.5" /> تعديل
      </button>
      {open && (
        <Modal title="تعديل" onClose={() => setOpen(false)}>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-sm font-semibold text-slate-600">
              التاريخ
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={cls} />
            </label>
            <label className="grid gap-1 text-sm font-semibold text-slate-600">
              المبلغ
              <input type="number" min="0" step="any" value={amount} onChange={(e) => setAmount(e.target.value)} className={cls} />
            </label>
            {withMethod && (
              <label className="grid gap-1 text-sm font-semibold text-slate-600">
                طريقة الدفع
                <select value={method} onChange={(e) => setMethod(e.target.value)} className={cls}>
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="grid gap-1 text-sm font-semibold text-slate-600 sm:col-span-2">
              البيان
              <input value={note} onChange={(e) => setNote(e.target.value)} className={cls} />
            </label>
          </div>
          {error && <div className="mt-3 text-sm text-red-600">{error}</div>}
          <div className="mt-4 flex gap-2">
            <button onClick={save} className="bg-primary text-white rounded-lg px-4 py-2 text-sm font-bold hover:bg-primary-dark">
              حفظ
            </button>
            <button onClick={() => setOpen(false)} className="bg-slate-100 text-slate-600 rounded-lg px-4 py-2 text-sm font-bold">
              إلغاء
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
