import { useEffect, useState } from "react";
import { hassanApi } from "../../api/client";
import { HassanTreasuryBalance } from "../../api/types";
import { formatEGP } from "../../utils/format";
import { person } from "../../person";

export default function TreasuryTab({ month }: { month: string }) {
  const [balance, setBalance] = useState<HassanTreasuryBalance | null>(null);

  useEffect(() => {
    hassanApi.treasuryBalance(month).then(setBalance);
  }, [month]);

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-card shadow-card p-5">
        <div className="text-sm text-slate-500 font-semibold">كوميشن {person()} اللي ليه جوه خزنة الشركة لحد دلوقتي</div>
        <div className="mt-2 text-2xl font-extrabold text-primary">{formatEGP(balance?.balance ?? 0)}</div>
        <p className="text-xs text-slate-400 mt-1">
          فلوسه جوه خزنة الشركة نفسها (مفيش خزنة لوحدها): بتزيد بكوميشنه كل شهر وباللي استلفه أو حصّله في حسابه الشخصي، وبتقل لما
          يصرف منها أو يسدد — وكل ده بيدخل ويطلع من خزنة الشركة.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="text-center bg-primary-light rounded-xl py-2.5">
          <div className="text-xs text-slate-500">كوميشن الشهر (بعد الجزاءات)</div>
          <div className="font-bold text-slate-800">{formatEGP(balance?.monthCommission ?? 0)}</div>
        </div>
        <div className="text-center bg-rose-50 rounded-xl py-2.5">
          <div className="text-xs text-slate-500">دفع الشهر</div>
          <div className="font-bold text-rose-600">{formatEGP(balance?.monthSpent ?? 0)}</div>
        </div>
        <div className="text-center bg-slate-50 rounded-xl py-2.5">
          <div className="text-xs text-slate-500">إجمالي الكوميشن بعد الجزاءات (كل الوقت)</div>
          <div className="font-bold text-slate-700">{formatEGP(balance?.allTimeCommission ?? 0)}</div>
        </div>
        <div className="text-center bg-slate-50 rounded-xl py-2.5">
          <div className="text-xs text-slate-500">إجمالي المدفوع (كل الوقت)</div>
          <div className="font-bold text-slate-700">{formatEGP(balance?.allTimeSpent ?? 0)}</div>
        </div>
      </div>
      {!!balance?.allTimeLedger && (
        <p className="text-xs text-slate-500">
          + صافي فلوس الحساب الشخصي اللي دخلت/طلعت من الخزنة (كل الوقت):{" "}
          <span className={`font-bold ${balance.allTimeLedger >= 0 ? "text-primary-dark" : "text-rose-600"}`}>{formatEGP(balance.allTimeLedger)}</span>
        </p>
      )}

      <p className="no-print text-xs text-slate-400">اللي {person()} بيصرفه من كوميشنه بيتسجل في تبويب "مصاريف التشغيل".</p>
    </div>
  );
}

// مصاريف التشغيل: اللي صاحب الكوميشن بيصرفه من خزنته (إيجار، قسط، أكل...)،
// كل مصروف على بند، وتحت إجمالي كل بند في الشهر — زي الصادر.
