import { useEffect, useState } from "react";
import Modal from "../../components/Modal";
import { treasuryApi } from "../../api/client";
import { MonthMovement } from "../../api/types";
import { formatEGP } from "../../utils/format";
import { monthLabel } from "../../utils/months";
import { PAYMENT_METHODS, paymentMethodLabel } from "../../utils/paymentMethods";

const cls = "rounded-lg border border-slate-200 px-1.5 py-1 text-xs bg-white";

function Row({ m, onChanged }: { m: MonthMovement; onChanged: () => void }) {
  const [editing, setEditing] = useState(false);
  const [date, setDate] = useState(m.date);
  const [amount, setAmount] = useState(String(m.amount));
  const [account, setAccount] = useState(m.account);
  const [error, setError] = useState("");
  const canEdit = !!m.src && m.src_id != null;

  async function save() {
    setError("");
    try {
      await treasuryApi.movementUpdate({ src: m.src!, src_id: m.src_id!, date, amount: Number(amount), account });
      setEditing(false);
      onChanged();
    } catch (err) {
      setError(String((err as Error)?.message ?? err).replace(/^Error invoking remote method '[^']+': (Error: )?/, ""));
    }
  }
  async function remove() {
    if (!window.confirm(`تمسح "${m.label}" (${formatEGP(m.amount)})؟ هتتمسح من مكانها الأصلي كمان.`)) return;
    await treasuryApi.movementDelete(m.src!, m.src_id!);
    onChanged();
  }

  if (editing) {
    return (
      <tr className="border-b border-slate-50 bg-slate-50">
        <td className="py-1.5">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={cls} />
        </td>
        <td className="py-1.5 text-slate-600 text-xs">{m.label}</td>
        <td className="py-1.5">
          {m.src === "treasury_transfers" || m.src === "treasury_adjustments" ? (
            <span className="text-xs text-slate-500">{paymentMethodLabel(m.account)}</span>
          ) : (
            <select value={account} onChange={(e) => setAccount(e.target.value)} className={cls}>
              {PAYMENT_METHODS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          )}
        </td>
        <td className="py-1.5">
          <input type="number" min="0" step="any" value={amount} onChange={(e) => setAmount(e.target.value)} className={`${cls} w-24`} />
        </td>
        <td className="py-1.5 whitespace-nowrap">
          <button onClick={save} className="text-xs text-primary font-semibold me-2">
            حفظ
          </button>
          <button onClick={() => setEditing(false)} className="text-xs text-slate-400 font-semibold">
            إلغاء
          </button>
          {error && <div className="text-[11px] text-rose-600">{error}</div>}
        </td>
      </tr>
    );
  }
  return (
    <tr className="border-b border-slate-50 last:border-0">
      <td className="py-1.5 text-slate-500 whitespace-nowrap">{m.date}</td>
      <td className="py-1.5 text-slate-700">{m.label}</td>
      <td className="py-1.5 text-slate-500 whitespace-nowrap">{paymentMethodLabel(m.account)}</td>
      <td className={`py-1.5 font-semibold whitespace-nowrap ${m.direction === "in" ? "text-primary-dark" : "text-rose-600"}`}>{formatEGP(m.amount)}</td>
      <td className="py-1.5 whitespace-nowrap">
        {canEdit && (
          <>
            <button onClick={() => setEditing(true)} className="text-xs text-primary font-semibold me-2">
              تعديل
            </button>
            <button onClick={remove} className="text-xs text-rose-500 font-semibold">
              حذف
            </button>
          </>
        )}
      </td>
    </tr>
  );
}

// كل اللي دخل/اتصرف فعلًا في الشهر من كل الحسابات — وكل سطر بيتعدّل أو يتمسح
// (التعديل بيوصل لمكانه الأصلي: المصروف، المرتب، دفعة المقاول...).
export default function MonthMovements({
  month,
  direction,
  onClose,
  onChanged,
}: {
  month: string;
  direction: "in" | "out";
  onClose: () => void;
  onChanged: () => void;
}) {
  const [rows, setRows] = useState<MonthMovement[] | null>(null);
  const refresh = () => treasuryApi.monthMovements(month, direction).then(setRows);
  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, direction]);
  const changed = () => {
    refresh();
    onChanged();
  };
  const total = (rows ?? []).reduce((s, r) => s + r.amount, 0);

  return (
    <Modal title={`${direction === "out" ? "اتصرف فعلًا" : "دخل فعلًا"} — ${monthLabel(month)} ${month.slice(0, 4)}`} onClose={onClose}>
      {!rows ? (
        <div className="text-sm text-slate-400">جاري التحميل...</div>
      ) : rows.length === 0 ? (
        <div className="text-sm text-slate-400">مفيش حركات الشهر ده.</div>
      ) : (
        <>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-400 border-b border-slate-100">
                <th className="text-start font-semibold py-1.5">التاريخ</th>
                <th className="text-start font-semibold py-1.5">البيان</th>
                <th className="text-start font-semibold py-1.5">الحساب</th>
                <th className="text-start font-semibold py-1.5">المبلغ</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((m) => (
                <Row key={`${m.src}-${m.src_id}-${m.account}-${m.direction}`} m={m} onChanged={changed} />
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3} className="pt-2 font-bold text-slate-700">
                  الإجمالي
                </td>
                <td className="pt-2 font-extrabold text-slate-900">{formatEGP(total)}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
          <p className="text-[11px] text-slate-400 mt-3">التعديل والمسح بيوصلوا للمكان الأصلي للحركة (المصروف، المرتب، دفعة المقاول...).</p>
        </>
      )}
    </Modal>
  );
}
