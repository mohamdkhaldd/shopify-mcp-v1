import { useEffect, useState } from "react";
import Icon from "../components/Icon";
import MonthPicker from "../components/equipment/MonthPicker";
import { treasuryApi } from "../api/client";
import { TreasurySummaryRow } from "../api/types";
import { currentMonthKey } from "../utils/months";
import { formatEGP } from "../utils/format";

function AccountCard({ row, onSaved }: { row: TreasurySummaryRow; onSaved: () => void }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(row.currentBalance));

  async function save() {
    await treasuryApi.updateBalance(row.id, Number(value) || 0);
    setEditing(false);
    onSaved();
  }

  return (
    <div className="bg-white rounded-card shadow-card p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-primary-light text-primary flex items-center justify-center">
            <Icon name="treasury" className="w-4 h-4" />
          </div>
          <div className="font-bold text-slate-800">{row.name_ar}</div>
        </div>
      </div>

      <div className="mb-4">
        <div className="text-xs text-slate-400 mb-1">الرصيد الحالي (يدوي)</div>
        {editing ? (
          <div className="flex gap-2">
            <input
              type="number"
              step="any"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="w-32 rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
              autoFocus
            />
            <button onClick={save} className="bg-primary text-white rounded-lg px-3 py-1.5 text-xs font-semibold hover:bg-primary-dark">
              حفظ
            </button>
          </div>
        ) : (
          <button onClick={() => setEditing(true)} className="text-lg font-extrabold text-slate-900 hover:text-primary">
            {formatEGP(row.currentBalance)}
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm border-t border-slate-100 pt-3">
        <div>
          <div className="text-xs text-slate-400">وارد الشهر</div>
          <div className="font-semibold text-primary">{formatEGP(row.monthIncoming)}</div>
        </div>
        <div>
          <div className="text-xs text-slate-400">صادر الشهر</div>
          <div className="font-semibold text-rose-600">{formatEGP(row.monthOutgoing)}</div>
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-slate-100">
        <div className="text-xs text-slate-400">الرصيد المتوقع</div>
        <div className={`text-xl font-extrabold ${row.projectedBalance >= 0 ? "text-slate-900" : "text-rose-600"}`}>
          {formatEGP(row.projectedBalance)}
        </div>
      </div>
    </div>
  );
}

export default function Treasury() {
  const [month, setMonth] = useState(currentMonthKey());
  const [rows, setRows] = useState<TreasurySummaryRow[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = () => treasuryApi.summary(month).then(setRows);

  useEffect(() => {
    setLoading(true);
    refresh().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

  const totalProjected = rows.reduce((sum, r) => sum + r.projectedBalance, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">الخزنة</h1>
          <p className="text-sm text-slate-500 mt-1">
            دوس على الرصيد الحالي لأي حساب عشان تحدّثه — الحركة الشهرية بتتحسب تلقائيًا من كل الدفعات والمصروفات المسجلة.
          </p>
        </div>
        <MonthPicker month={month} onChange={setMonth} />
      </div>

      {loading ? (
        <div className="text-sm text-slate-400">جاري التحميل...</div>
      ) : (
        <>
          <div className="bg-white rounded-card shadow-card p-5">
            <div className="text-sm text-slate-500 font-semibold">إجمالي الرصيد المتوقع في كل الحسابات</div>
            <div className="mt-2 text-2xl font-extrabold text-primary">{formatEGP(totalProjected)}</div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {rows.map((row) => (
              <AccountCard key={row.id} row={row} onSaved={refresh} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
