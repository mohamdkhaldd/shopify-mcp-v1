import Icon from "./Icon";
import { EyeButton, Secret } from "./Privacy";

interface KpiCardProps {
  label: string;
  value: string;
  icon: string;
  tone?: "positive" | "negative" | "neutral";
  /** الكارت الأهم في الصف — متلوّن كله باللون الأساسي */
  hero?: boolean;
  sub?: string;
  onClick?: () => void;
  // لو متحدد: الرقم عليه بلور وجنبه عين تظهره (الصفحة الرئيسية).
  privacyId?: string;
}

const toneStyles: Record<NonNullable<KpiCardProps["tone"]>, string> = {
  positive: "text-primary bg-primary-light",
  negative: "text-rose-600 bg-rose-50",
  neutral: "text-slate-500 bg-slate-100",
};

export default function KpiCard({ label, value, icon, tone = "neutral", sub, onClick, privacyId, hero }: KpiCardProps) {
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
        "rounded-card p-5 flex items-start justify-between text-start w-full min-w-0",
        hero ? "kpi-hero bg-primary text-white shadow-[0_8px_24px_-8px_rgb(var(--accent)/0.55)]" : "bg-white shadow-card",
        onClick ? "cursor-pointer transition-[box-shadow,transform] hover:-translate-y-0.5 " + (hero ? "" : "hover:shadow-[0_0_0_1px_rgb(var(--accent)/0.35),0_6px_18px_rgba(20,23,28,0.06)]") : "",
      ].join(" ")}
    >
      <div className="min-w-0">
        <div className={["text-[13px]", hero ? "text-white/80" : "text-slate-500"].join(" ")}>{label}</div>
        <div
          className={[
            "mt-1.5 text-[26px] leading-tight font-semibold tracking-tight",
            hero ? "text-white" : tone === "negative" ? "text-rose-600" : "text-slate-900",
          ].join(" ")}
        >
          {privacyId ? <Secret id={privacyId}>{value}</Secret> : value}
        </div>
        {sub && <div className={["mt-1 text-xs", hero ? "text-white/70" : "text-slate-400"].join(" ")}>{sub}</div>}
        {onClick && <div className={["no-print mt-2 text-xs", hero ? "text-white/90" : "text-primary"].join(" ")}>دوس للتفاصيل ←</div>}
      </div>
      <div className="flex flex-col items-center gap-1">
        <div className={["w-9 h-9 rounded-[10px] flex items-center justify-center", hero ? "bg-white/15 text-white" : toneStyles[tone]].join(" ")}>
          <Icon name={icon} className="w-[18px] h-[18px]" />
        </div>
        {privacyId && <EyeButton id={privacyId} />}
      </div>
    </div>
  );
}
