import { useEffect, useState } from "react";
import { alertsApi } from "../api/client";
import { DashboardAlert } from "../api/types";
import { SectionId } from "../nav";
import { formatEGP } from "../utils/format";

function dueText(days: number) {
  if (days < 0) return `متأخر ${-days} يوم`;
  if (days === 0) return "النهارده";
  if (days === 1) return "بكرة";
  return `بعد ${days} أيام`;
}

// إنذارات الصفحة الرئيسية: عهدة قربت تخلص، والتزام ميعاده قرب أو عدّى.
export default function DashboardAlerts({ onNavigate }: { onNavigate?: (id: SectionId) => void }) {
  const [alerts, setAlerts] = useState<DashboardAlert[]>([]);

  useEffect(() => {
    const load = () => alertsApi.dashboard().then(setAlerts).catch(() => {});
    load();
    const timer = setInterval(load, 60000);
    return () => clearInterval(timer);
  }, []);

  if (!alerts.length) return null;
  return (
    <div className="no-print space-y-2">
      {alerts.map((a) => (
        <button
          key={`${a.kind}-${a.id}`}
          onClick={() => onNavigate?.(a.kind === "custody" ? "custody" : "obligations")}
          className={[
            "w-full flex flex-wrap items-center justify-between gap-2 rounded-xl px-4 py-3 text-sm text-start border",
            a.level === "danger" ? "bg-rose-50 border-rose-200 text-rose-800" : "bg-amber-50 border-amber-200 text-amber-900",
          ].join(" ")}
        >
          <span className="font-bold">
            {a.kind === "custody" ? "💼 " : "⏰ "}
            {a.kind === "obligation" ? `عليك التزام: ${a.title}` : a.title}
            {a.amount != null && <span className="font-extrabold"> {a.kind === "obligation" ? "بقيمة " : ""}{formatEGP(a.amount)}</span>}
            {a.kind === "obligation" && a.due_date && <span className="font-semibold"> — ميعاده {a.due_date}</span>}
          </span>
          <span className="text-xs font-bold rounded-lg bg-white/70 px-2 py-1">
            {a.kind === "obligation" && a.days != null ? dueText(a.days) : "افتح العهد ←"}
          </span>
        </button>
      ))}
    </div>
  );
}
