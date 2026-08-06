import { useEffect, useState } from "react";
import { daysInMonth } from "../utils/months";
import { deleteDailyLog, listDailyLogs, upsertDailyLog } from "../store";
import { DailyLog } from "../types";

export default function MarketSheet({ equipmentId, month }: { equipmentId: number; month: string }) {
  const [logs, setLogs] = useState<DailyLog[]>([]);
  const [date, setDate] = useState(daysInMonth(month)[0]);
  const [value, setValue] = useState("");
  const [commission, setCommission] = useState("");
  const [note, setNote] = useState("");

  const refresh = () => setLogs(listDailyLogs(equipmentId, month, "market"));
  useEffect(() => {
    refresh();
    setDate(daysInMonth(month)[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [equipmentId, month]);

  function save() {
    if (!value) return;
    upsertDailyLog({
      equipment_id: equipmentId,
      date,
      role: "market",
      person_name: "",
      actual_hours: null,
      base_hours: null,
      day_rate: null,
      is_paid_leave: false,
      is_day_off: false,
      fixed_value: Number(value) || 0,
      hassan_commission: commission ? Number(commission) : null,
      note: note.trim() || null,
    });
    setValue("");
    setCommission("");
    setNote("");
    refresh();
  }

  function remove(id: number) {
    deleteDailyLog(id);
    refresh();
  }

  return (
    <div className="space-y-3">
      <div className="bg-white rounded-2xl shadow-card p-4 space-y-2">
        <div className="text-sm font-extrabold text-slate-700">تسجيل يوم — سركي سوق</div>
        <div>
          <label className="block text-[11px] text-slate-500 mb-1">التاريخ</label>
          <select value={date} onChange={(e) => setDate(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm">
            {daysInMonth(month).map((d) => (
              <option key={d} value={d}>
                {d.slice(-2)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[11px] text-slate-500 mb-1">القيمة</label>
          <input type="number" value={value} onChange={(e) => setValue(e.target.value)} inputMode="decimal" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-[11px] text-slate-500 mb-1">كوميشن حسن</label>
          <input type="number" value={commission} onChange={(e) => setCommission(e.target.value)} inputMode="decimal" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-[11px] text-slate-500 mb-1">بيان</label>
          <input value={note} onChange={(e) => setNote(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
        </div>
        <button onClick={save} disabled={!value} className="w-full bg-primary text-white rounded-xl py-2.5 text-sm font-bold disabled:opacity-50">
          حفظ اليوم
        </button>
      </div>

      <div className="space-y-2">
        {logs.map((l) => (
          <div key={l.id} className="bg-white rounded-xl border border-slate-200 px-3 py-2 flex items-center justify-between text-sm">
            <div className="text-slate-500">{l.date.slice(-2)}</div>
            <div className="font-bold text-primary-dark">{l.fixed_value} ج.م</div>
            <button onClick={() => remove(l.id)} className="text-rose-500 text-xs font-bold">
              مسح
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
