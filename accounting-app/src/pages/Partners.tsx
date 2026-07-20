import { useEffect, useState } from "react";
import Icon from "../components/Icon";
import { partnersDashboardApi } from "../api/client";
import { PartnerSummary } from "../api/types";
import { formatEGP } from "../utils/format";
import PartnerDetailView from "./partners/PartnerDetailView";

export default function Partners() {
  const [items, setItems] = useState<PartnerSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  useEffect(() => {
    partnersDashboardApi.summary().then(setItems).finally(() => setLoading(false));
  }, []);

  if (selectedId !== null) {
    return <PartnerDetailView partnerId={selectedId} onBack={() => setSelectedId(null)} />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900">الشركاء</h1>
        <p className="text-sm text-slate-500 mt-1">
          إجمالي المستحق لكل شريك بيتحسب تلقائيًا من نسبته في كل معدة شغال فيها.
        </p>
      </div>

      {loading ? (
        <div className="text-sm text-slate-400">جاري التحميل...</div>
      ) : items.length === 0 ? (
        <div className="bg-white rounded-card shadow-card p-8 text-center text-sm text-slate-400">
          لسه مفيش شركاء مسجلين. ضيفهم من صفحة الإعدادات الأول.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {items.map((p) => (
            <button
              key={p.id}
              onClick={() => setSelectedId(p.id)}
              className="bg-white rounded-card shadow-card p-5 text-start hover:ring-2 hover:ring-primary/30 transition-shadow"
            >
              <div className="flex items-center justify-between">
                <div className="w-11 h-11 rounded-xl bg-primary-light text-primary flex items-center justify-center">
                  <Icon name="partners" className="w-5 h-5" />
                </div>
                {p.remaining !== 0 && (
                  <span className={`text-xs font-bold px-2 py-1 rounded-lg ${p.remaining > 0 ? "bg-primary-light text-primary-dark" : "bg-rose-50 text-rose-600"}`}>
                    باقي {formatEGP(Math.abs(p.remaining))}
                  </span>
                )}
              </div>
              <div className="mt-3 font-bold text-slate-800">{p.name}</div>
              <div className="mt-1 text-xs text-slate-400">
                إجمالي {formatEGP(p.totalDue)} — مدفوع {formatEGP(p.totalPaid)}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
