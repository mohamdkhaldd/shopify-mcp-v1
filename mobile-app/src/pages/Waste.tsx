import MonthBar from "../components/MonthBar";
import { listWasteEntries } from "../store";

function formatEGP(value: number): string {
  return `${Math.round(value).toLocaleString("ar-EG")} ج.م`;
}

const PAYMENT_METHODS = [
  { value: "cash", label: "كاش" },
  { value: "wallet", label: "اكسيس باي" },
  { value: "instapay", label: "انستا باي" },
  { value: "vodafone_cash", label: "فودفون كاش" },
];

function paymentMethodLabel(v: string | null) {
  return PAYMENT_METHODS.find((m) => m.value === v)?.label ?? v ?? "—";
}

export default function Waste({ month, onChangeMonth, onBack }: { month: string; onChangeMonth: (m: string) => void; onBack: () => void }) {
  const entries = listWasteEntries(month);
  const total = entries.reduce((sum, e) => sum + e.amount, 0);

  return (
    <div>
      <div className="bg-primary text-white px-4 pt-6 pb-3 flex items-center gap-2">
        <button onClick={onBack} className="text-white/80 text-lg">
          ‹
        </button>
        <div>
          <div className="text-xs opacity-80 font-bold">دفتر البنيان</div>
          <div className="text-lg font-extrabold mt-0.5">الهالك</div>
        </div>
      </div>
      <MonthBar month={month} onChange={onChangeMonth} />

      <div className="p-4 space-y-3">
        <div className="bg-white rounded-2xl shadow-card p-3.5 flex items-center justify-between">
          <span className="text-sm text-slate-500 font-semibold">إجمالي الهالك — الشهر ده</span>
          <span className="font-extrabold text-rose-600">{formatEGP(total)}</span>
        </div>

        <div className="space-y-2">
          {entries.length === 0 ? (
            <div className="text-sm text-slate-400 text-center py-4">لسه مفيش هالك مسجل الشهر ده.</div>
          ) : (
            entries.map((e) => (
              <div key={e.id} className="bg-white rounded-xl border border-slate-200 px-3 py-2.5 flex items-center justify-between text-sm">
                <div>
                  <div className="text-slate-700 font-semibold">{e.note ?? "—"}</div>
                  <div className="text-[11px] text-slate-400">
                    {e.date} — {paymentMethodLabel(e.payment_method)}
                  </div>
                </div>
                <span className="font-bold text-rose-600">{formatEGP(e.amount)}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
