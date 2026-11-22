import { useEffect, useRef, useState } from "react";
import { hassanApi } from "../../api/client";
import { formatEGP } from "../../utils/format";
import { person } from "../../person";

type Status = Awaited<ReturnType<typeof hassanApi.cashStatus>>;

// فوق صفحة صاحب الكوميشن: «الخزنة فيها كذا، منهم كذا لـ…». بعد أي حركة
// (صرف، صدقة، قسط، عامل، دهب، حساب شخصي…) بيتحدّث ويتلوّن لحظة عشان تاخد بالك.
export default function HassanCashBar() {
  const [s, setS] = useState<Status | null>(null);
  const [flash, setFlash] = useState(false);
  const timer = useRef<number>();
  useEffect(() => {
    const load = () => hassanApi.cashStatus().then(setS, () => setS(null));
    load();
    const onChange = () => {
      load().then(() => {
        setFlash(true);
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => setFlash(false), 4000);
      });
    };
    window.addEventListener("hassan-money-changed", onChange);
    return () => {
      window.removeEventListener("hassan-money-changed", onChange);
      window.clearTimeout(timer.current);
    };
  }, []);
  if (!s) return null;
  return (
    <div
      className={[
        "no-print sticky top-0 z-20 rounded-card shadow-card px-4 py-3 flex flex-wrap items-center gap-x-6 gap-y-1 transition-colors",
        flash ? "bg-emerald-50 ring-2 ring-emerald-300" : "bg-white",
      ].join(" ")}
    >
      {flash && <span className="text-xs font-bold text-emerald-700">اتسجل ✓</span>}
      <div className="text-sm text-slate-600">
        الخزنة فيها <b className="text-slate-900 text-base">{formatEGP(s.total)}</b>
      </div>
      <div className="text-sm text-slate-600">
        منهم <b className={`text-base ${s.hassan < 0 ? "text-rose-600" : "text-primary-dark"}`}>{formatEGP(s.hassan)}</b> فلوس {person()}
      </div>
      <div className="text-sm text-slate-600">
        والباقي للشركة <b className="text-slate-800">{formatEGP(s.company)}</b>
      </div>
      <div className="text-[11px] text-slate-400 w-full">
        {s.accounts.filter((a) => Math.abs(a.balance) > 0.005).map((a) => `${a.name_ar} ${formatEGP(a.balance)}`).join(" · ")}
        {s.hassan < 0 && ` — ${person()} صرف أكتر من كوميشنه بـ ${formatEGP(-s.hassan)}`}
      </div>
    </div>
  );
}
