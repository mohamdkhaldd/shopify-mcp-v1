import Icon from "./Icon";

interface KpiCardProps {
  label: string;
  value: string;
  icon: string;
  tone?: "positive" | "negative" | "neutral";
  sub?: string;
  onClick?: () => void;
}

const toneStyles: Record<NonNullable<KpiCardProps["tone"]>, string> = {
  positive: "text-primary bg-primary-light",
  negative: "text-rose-600 bg-rose-50",
  neutral: "text-slate-600 bg-slate-100",
};

export default function KpiCard({ label, value, icon, tone = "neutral", sub, onClick }: KpiCardProps) {
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
        "bg-white rounded-card shadow-card p-5 flex items-start justify-between text-start w-full",
        onClick ? "cursor-pointer hover:shadow-md hover:ring-2 hover:ring-primary/20 transition-shadow" : "",
      ].join(" ")}
    >
      <div>
        <div className="text-sm text-slate-500 font-semibold">{label}</div>
        <div
          className={[
            "mt-2 text-2xl font-extrabold",
            tone === "negative" ? "text-rose-600" : "text-slate-900",
          ].join(" ")}
        >
          {value}
        </div>
        {sub && <div className="mt-1 text-xs text-slate-400">{sub}</div>}
        {onClick && <div className="mt-1 text-[11px] text-primary font-semibold">دوس للتفاصيل</div>}
      </div>
      <div className={["w-11 h-11 rounded-xl flex items-center justify-center", toneStyles[tone]].join(" ")}>
        <Icon name={icon} className="w-5 h-5" />
      </div>
    </div>
  );
}
