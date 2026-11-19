import Icon from "./Icon";
import { EyeButton, Secret } from "./Privacy";

interface KpiCardProps {
  label: string;
  value: string;
  icon: string;
  tone?: "positive" | "negative" | "neutral";
  sub?: string;
  onClick?: () => void;
  // لو متحدد: الرقم عليه بلور وجنبه عين تظهره (الصفحة الرئيسية).
  privacyId?: string;
}

const toneStyles: Record<NonNullable<KpiCardProps["tone"]>, string> = {
  positive: "text-emerald-700 bg-emerald-50",
  negative: "text-rose-600 bg-rose-50",
  neutral: "text-primary bg-primary-light",
};

export default function KpiCard({ label, value, icon, tone = "neutral", sub, onClick, privacyId }: KpiCardProps) {
  return (
    <div
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      className={[
        "relative overflow-hidden bg-white rounded-card shadow-card p-5 flex items-start justify-between text-start w-full",
        "after:absolute after:inset-x-0 after:top-0 after:h-[3px]",
        tone === "positive" ? "after:bg-emerald-500" : tone === "negative" ? "after:bg-rose-500" : "after:bg-primary/70",
        onClick ? "cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition" : "",
      ].join(" ")}
    >
      <div>
        <div className="text-[13px] text-slate-500 font-semibold">{label}</div>
        <div
          className={[
            "mt-2 text-[26px] leading-tight font-bold tabular-nums",
            tone === "negative" ? "text-rose-600" : "text-slate-900",
          ].join(" ")}
        >
          {privacyId ? <Secret id={privacyId}>{value}</Secret> : value}
        </div>
        {sub && <div className="mt-1 text-xs text-slate-400">{sub}</div>}
        {onClick && <div className="no-print mt-2 text-[11px] text-primary font-semibold">التفاصيل ←</div>}
      </div>
      <div className="flex flex-col items-center gap-1">
        <div className={["w-11 h-11 rounded-xl flex items-center justify-center", toneStyles[tone]].join(" ")}>
          <Icon name={icon} className="w-5 h-5" />
        </div>
        {privacyId && <EyeButton id={privacyId} />}
      </div>
    </div>
  );
}
