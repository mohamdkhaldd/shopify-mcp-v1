import { useEffect, useState } from "react";
import Icon from "../components/Icon";
import { contractorsDashboardApi } from "../api/client";
import { ContractorSummary } from "../api/types";
import { formatEGP } from "../utils/format";
import ContractorDetailView from "./contractors/ContractorDetailView";

export default function Contractors() {
  const [items, setItems] = useState<ContractorSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  useEffect(() => {
    contractorsDashboardApi.summary().then(setItems).finally(() => setLoading(false));
  }, []);

  if (selectedId !== null) {
    return <ContractorDetailView contractorId={selectedId} onBack={() => setSelectedId(null)} />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900">المقاولين</h1>
        <p className="text-sm text-slate-500 mt-1">
          كل مقاول شغله بيتحسب تلقائيًا من سجلات المقاول في كل المعدات، والباقي له بينقص لما تسجل دفعة.
        </p>
      </div>

      {loading ? (
        <div className="text-sm text-slate-400">جاري التحميل...</div>
      ) : items.length === 0 ? (
        <div className="bg-white rounded-card shadow-card p-8 text-center text-sm text-slate-400">
          لسه مفيش مقاولين مسجلين. ضيفهم من صفحة الإعدادات الأول.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {items.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedId(c.id)}
              className="bg-white rounded-card shadow-card p-5 text-start hover:ring-2 hover:ring-primary/30 transition-shadow"
            >
              <div className="flex items-center justify-between">
                <div className="w-11 h-11 rounded-xl bg-primary-light text-primary flex items-center justify-center">
                  <Icon name="contractors" className="w-5 h-5" />
                </div>
                {c.remaining !== 0 && (
                  <span className={`text-xs font-bold px-2 py-1 rounded-lg ${c.remaining > 0 ? "bg-primary-light text-primary-dark" : "bg-rose-50 text-rose-600"}`}>
                    {c.remaining > 0 ? "له" : "عليه"} {formatEGP(Math.abs(c.remaining))}
                  </span>
                )}
              </div>
              <div className="mt-3 font-bold text-slate-800">{c.name}</div>
              <div className="mt-1 text-xs text-slate-400">
                إجمالي شغله {formatEGP(c.totalWork)} — مدفوع {formatEGP(c.totalPaid)}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
