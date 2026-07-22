import { useEffect, useState } from "react";
import Icon from "../components/Icon";
import Modal from "../components/Modal";
import MonthPicker from "../components/equipment/MonthPicker";
import { treasuryApi } from "../api/client";
import { TreasurySummaryRow, TreasuryTransaction } from "../api/types";
import { currentMonthKey } from "../utils/months";
import { formatEGP } from "../utils/format";

function AccountCard({
  row,
  onSaved,
  onShowDetail,
}: {
  row: TreasurySummaryRow;
  onSaved: () => void;
  onShowDetail: () => void;
}) {
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

      <button
        onClick={onShowDetail}
        className="w-full grid grid-cols-2 gap-3 text-sm border-t border-slate-100 pt-3 text-start hover:bg-slate-50 -mx-1 px-1 rounded-lg transition-colors"
        title="دوس تشوف كل حركة الحساب ده الشهر ده"
      >
        <div>
          <div className="text-xs text-slate-400">وارد الشهر</div>
          <div className="font-semibold text-primary">{formatEGP(row.monthIncoming)}</div>
        </div>
        <div>
          <div className="text-xs text-slate-400">صادر الشهر</div>
          <div className="font-semibold text-rose-600">{formatEGP(row.monthOutgoing)}</div>
        </div>
      </button>

      <div className="mt-3 pt-3 border-t border-slate-100">
        <div className="text-xs text-slate-400">الرصيد المتوقع</div>
        <div className={`text-xl font-extrabold ${row.projectedBalance >= 0 ? "text-slate-900" : "text-rose-600"}`}>
          {formatEGP(row.projectedBalance)}
        </div>
      </div>

      <button
        onClick={onShowDetail}
        className="no-print mt-2 w-full text-center text-xs font-semibold text-primary hover:text-primary-dark"
      >
        تفاصيل الحركة
      </button>
    </div>
  );
}

export default function Treasury() {
  const [month, setMonth] = useState(currentMonthKey());
  const [rows, setRows] = useState<TreasurySummaryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailAccount, setDetailAccount] = useState<TreasurySummaryRow | null>(null);
  const [transactions, setTransactions] = useState<TreasuryTransaction[] | null>(null);

  const refresh = () => treasuryApi.summary(month).then(setRows);

  useEffect(() => {
    setLoading(true);
    refresh().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

  function openDetail(row: TreasurySummaryRow) {
    setDetailAccount(row);
    setTransactions(null);
    treasuryApi.accountTransactions(row.name, month).then(setTransactions);
  }

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
              <AccountCard key={row.id} row={row} onSaved={refresh} onShowDetail={() => openDetail(row)} />
            ))}
          </div>
        </>
      )}

      {detailAccount && (
        <Modal title={`حركة ${detailAccount.name_ar} — ${month}`} onClose={() => setDetailAccount(null)}>
          {!transactions ? (
            <div className="text-sm text-slate-400">جاري التحميل...</div>
          ) : transactions.length === 0 ? (
            <div className="text-sm text-slate-400">مفيش حركة مسجلة على الحساب ده الشهر ده.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-400 border-b border-slate-100">
                  <th className="text-start font-semibold py-2">التاريخ</th>
                  <th className="text-start font-semibold py-2">البيان</th>
                  <th className="text-start font-semibold py-2">المبلغ</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((t, i) => (
                  <tr key={i} className="border-b border-slate-50 last:border-0">
                    <td className="py-2 text-slate-500 whitespace-nowrap">{t.date}</td>
                    <td className="py-2 text-slate-700">{t.label}</td>
                    <td className={`py-2 font-semibold whitespace-nowrap ${t.direction === "in" ? "text-primary" : "text-rose-600"}`}>
                      {t.direction === "in" ? "+" : "-"}
                      {formatEGP(t.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Modal>
      )}
    </div>
  );
}
