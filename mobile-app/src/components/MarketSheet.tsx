import { listDailyLogs } from "../store";

export default function MarketSheet({ equipmentId, month }: { equipmentId: number; month: string }) {
  const logs = listDailyLogs(equipmentId, month, "market");

  return (
    <div className="space-y-2">
      {logs.length === 0 ? (
        <div className="text-sm text-slate-400 text-center py-6">لسه مفيش سركي سوق مسجل الشهر ده.</div>
      ) : (
        logs.map((l) => (
          <div key={l.id} className="bg-white rounded-xl border border-slate-200 px-3 py-2.5 text-sm">
            <div className="flex items-center justify-between">
              <div className="text-slate-500">{l.date.slice(-2)}</div>
              <div className="font-bold text-primary-dark">{l.fixed_value} ج.م</div>
            </div>
            {l.note && <div className="text-xs text-slate-400 mt-0.5">{l.note}</div>}
          </div>
        ))
      )}
    </div>
  );
}
