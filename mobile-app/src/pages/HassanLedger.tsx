import { useState } from "react";
import MonthBar from "../components/MonthBar";
import { hassanLedgerBalance, listEquipment, listHassanLedger, listHassanTreasuryExpenses } from "../store";
import { HassanLedgerType } from "../types";
import { computeCommissionRows, computeEquipmentCommissionDetail, computeHassanTreasuryBalance } from "../utils/commission";

function formatEGP(value: number): string {
  return `${Math.round(value).toLocaleString("ar-EG")} ج.م`;
}

const LEDGER_TYPES: { value: HassanLedgerType; label: string }[] = [
  { value: "loan", label: "سلفة/دين على حسن" },
  { value: "repayment", label: "سداد من حسن" },
  { value: "due", label: "مستحق لحسن" },
  { value: "collection", label: "تحصيل لحسن" },
];

function typeLabel(type: HassanLedgerType) {
  return LEDGER_TYPES.find((t) => t.value === type)?.label ?? type;
}

function sourceLabel(source: string, category_name?: string) {
  if (source === "expense") return category_name ?? "مصروف";
  if (source === "market") return "سركي سوق";
  return "سركي/مقاول";
}

function EquipmentCommissionPanel({ equipmentId, month }: { equipmentId: number; month: string }) {
  const detail = computeEquipmentCommissionDetail(equipmentId, month);

  return (
    <div className="bg-slate-50 rounded-xl p-3 mt-2 space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-xs font-bold text-slate-500">إجمالي السنة</div>
        <div className="text-sm font-extrabold text-primary">{formatEGP(detail.yearTotal)}</div>
      </div>
      {detail.days.length === 0 ? (
        <div className="text-xs text-slate-400">مفيش كوميشن محسوب على المعدة دي الشهر ده.</div>
      ) : (
        <div className="space-y-1.5">
          {detail.days.map((d, i) => (
            <div key={i} className="flex items-center justify-between text-xs text-slate-600">
              <span>
                {d.date} — {sourceLabel(d.source, d.category_name)}
              </span>
              <span className="font-bold text-primary-dark shrink-0 ms-2">{formatEGP(d.commission)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CommissionTab({ month }: { month: string }) {
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const equipment = listEquipment();
  const { rows, total } = computeCommissionRows(month);

  const byEquipment = new Map<number, { equipment_name: string; commission: number }>();
  for (const row of rows) {
    const entry = byEquipment.get(row.equipment_id) ?? { equipment_name: row.equipment_name, commission: 0 };
    entry.commission += row.commission;
    byEquipment.set(row.equipment_id, entry);
  }
  const equipmentTotals = [...byEquipment.entries()]
    .map(([equipment_id, e]) => ({ equipment_id, ...e }))
    .sort((a, b) => b.commission - a.commission);

  return (
    <div className="p-4 space-y-3">
      <div className="bg-white rounded-2xl shadow-card p-4">
        <div className="text-sm text-slate-500 font-semibold">إجمالي كوميشن حسن — {month}</div>
        <div className="mt-1 text-2xl font-extrabold text-primary">{formatEGP(total)}</div>
      </div>

      <div className="space-y-2">
        {equipmentTotals.length === 0 ? (
          <div className="text-sm text-slate-400 text-center py-4">مفيش كوميشن محسوب الشهر ده. ({equipment.length} معدة مسجلة)</div>
        ) : (
          equipmentTotals.map((e) => (
            <div key={e.equipment_id} className="bg-white rounded-2xl shadow-card overflow-hidden">
              <button
                onClick={() => setExpandedId(expandedId === e.equipment_id ? null : e.equipment_id)}
                className="w-full p-3.5 flex items-center justify-between text-start"
              >
                <span className="text-sm font-bold text-slate-800">{e.equipment_name}</span>
                <span className="font-bold text-primary-dark">{formatEGP(e.commission)}</span>
              </button>
              {expandedId === e.equipment_id && (
                <div className="px-3.5 pb-3.5">
                  <EquipmentCommissionPanel equipmentId={e.equipment_id} month={month} />
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function LedgerTab({ month }: { month: string }) {
  const entries = listHassanLedger(month);
  const balance = hassanLedgerBalance();

  return (
    <div className="p-4 space-y-3">
      <div className="grid grid-cols-2 gap-2.5">
        <div className="bg-white rounded-2xl shadow-card p-3.5 text-center">
          <div className="text-[11px] text-slate-500">مديون بيها حسن (كل الوقت)</div>
          <div className="mt-1 font-extrabold text-rose-600">{formatEGP(balance.netDebt)}</div>
        </div>
        <div className="bg-white rounded-2xl shadow-card p-3.5 text-center">
          <div className="text-[11px] text-slate-500">مستحق لحسن (كل الوقت)</div>
          <div className="mt-1 font-extrabold text-primary-dark">{formatEGP(balance.netDue)}</div>
        </div>
      </div>

      <div className="space-y-2">
        {entries.length === 0 ? (
          <div className="text-sm text-slate-400 text-center py-4">لسه مفيش حركات مسجلة الشهر ده.</div>
        ) : (
          entries.map((e) => (
            <div key={e.id} className="bg-white rounded-xl border border-slate-200 px-3 py-2.5 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-700">{typeLabel(e.type)}</span>
                <span className="font-bold text-primary-dark">{formatEGP(e.amount)}</span>
              </div>
              <div className="mt-1 text-[11px] text-slate-400">
                {e.date} {e.party_name && `— ${e.party_name}`} {e.description && `(${e.description})`}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function TreasuryTab({ month }: { month: string }) {
  const entries = listHassanTreasuryExpenses(month);
  const balance = computeHassanTreasuryBalance(month);

  return (
    <div className="p-4 space-y-3">
      <div className="bg-white rounded-2xl shadow-card p-4">
        <div className="text-sm text-slate-500 font-semibold">رصيد خزنة حسن (كل الوقت)</div>
        <div className="mt-1 text-2xl font-extrabold text-primary">{formatEGP(balance.balance)}</div>
        <p className="text-[10px] text-slate-400 mt-1">بيزيد بكوميشنه كل شهر، وبيقل بس لما هو يدفع منه — مالوش علاقة بخزنة الشركة.</p>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <div className="bg-primary-light rounded-xl py-2.5 text-center">
          <div className="text-[11px] text-slate-500">كوميشن الشهر</div>
          <div className="font-bold text-slate-800">{formatEGP(balance.monthCommission)}</div>
        </div>
        <div className="bg-rose-50 rounded-xl py-2.5 text-center">
          <div className="text-[11px] text-slate-500">دفع الشهر</div>
          <div className="font-bold text-rose-600">{formatEGP(balance.monthSpent)}</div>
        </div>
      </div>

      <div className="space-y-2">
        {entries.length === 0 ? (
          <div className="text-sm text-slate-400 text-center py-4">لسه مفيش حاجة اتدفعت من خزنة حسن الشهر ده.</div>
        ) : (
          entries.map((e) => (
            <div key={e.id} className="bg-white rounded-xl border border-slate-200 px-3 py-2.5 flex items-center justify-between text-sm">
              <div>
                <div className="text-slate-700 font-semibold">{e.description}</div>
                <div className="text-[11px] text-slate-400">{e.date}</div>
              </div>
              <span className="font-bold text-primary-dark">{formatEGP(e.amount)}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default function HassanLedger({ month, onChangeMonth, onBack }: { month: string; onChangeMonth: (m: string) => void; onBack: () => void }) {
  const [tab, setTab] = useState<"commission" | "treasury" | "ledger">("commission");

  return (
    <div>
      <div className="bg-primary text-white px-4 pt-6 pb-3 flex items-center gap-2">
        <button onClick={onBack} className="text-white/80 text-lg">
          ‹
        </button>
        <div>
          <div className="text-xs opacity-80 font-bold">دفتر البنيان</div>
          <div className="text-lg font-extrabold mt-0.5">حسن</div>
        </div>
      </div>
      <MonthBar month={month} onChange={onChangeMonth} />

      <div className="px-4 pt-3 flex gap-2">
        <button
          onClick={() => setTab("commission")}
          className={["flex-1 rounded-xl py-2 text-xs font-bold", tab === "commission" ? "bg-primary text-white" : "bg-white text-slate-500 shadow-card"].join(" ")}
        >
          الكوميشن
        </button>
        <button
          onClick={() => setTab("treasury")}
          className={["flex-1 rounded-xl py-2 text-xs font-bold", tab === "treasury" ? "bg-primary text-white" : "bg-white text-slate-500 shadow-card"].join(" ")}
        >
          الخزنة
        </button>
        <button
          onClick={() => setTab("ledger")}
          className={["flex-1 rounded-xl py-2 text-xs font-bold", tab === "ledger" ? "bg-primary text-white" : "bg-white text-slate-500 shadow-card"].join(" ")}
        >
          الحساب الشخصي
        </button>
      </div>

      {tab === "commission" && <CommissionTab month={month} />}
      {tab === "treasury" && <TreasuryTab month={month} />}
      {tab === "ledger" && <LedgerTab month={month} />}
    </div>
  );
}
