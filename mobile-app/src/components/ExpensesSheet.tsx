import { useState } from "react";
import { listMonthlyExpenses } from "../store";

const PAYMENT_METHODS = [
  { value: "cash", label: "كاش" },
  { value: "wallet", label: "اكسيس باي" },
  { value: "instapay", label: "انستا باي" },
  { value: "vodafone_cash", label: "فودفون كاش" },
];

function paymentMethodLabel(v: string | null) {
  return PAYMENT_METHODS.find((m) => m.value === v)?.label ?? v ?? "—";
}

export default function ExpensesSheet({ equipmentId, month }: { equipmentId: number; month: string }) {
  const expenses = listMonthlyExpenses(equipmentId, month);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  return (
    <div className="space-y-2">
      {expenses.length === 0 ? (
        <div className="text-sm text-slate-400 text-center py-6">لسه مفيش مصروفات مسجلة الشهر ده.</div>
      ) : (
        expenses.map((e) => (
          <div key={e.id} className="bg-white rounded-xl border border-slate-200 px-3 py-2.5 flex items-center justify-between text-sm">
            {e.receipt_image ? (
              <button onClick={() => setPreviewImage(e.receipt_image)}>
                <img src={e.receipt_image} alt="" className="w-8 h-8 rounded object-cover border border-slate-200" />
              </button>
            ) : (
              <div className="text-slate-500">{e.date?.slice(-2) ?? "—"}</div>
            )}
            <div className="text-xs text-slate-400">{paymentMethodLabel(e.payment_method)}</div>
            <div className="font-bold text-primary-dark">{e.amount} ج.م</div>
          </div>
        ))
      )}

      {previewImage && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-6" onClick={() => setPreviewImage(null)}>
          <img src={previewImage} alt="" className="max-w-full max-h-full rounded-xl" />
        </div>
      )}
    </div>
  );
}
