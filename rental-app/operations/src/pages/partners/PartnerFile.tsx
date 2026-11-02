import { useEffect, useState } from "react";
import { equipmentApi } from "../../api/client";
import { Equipment, PartnerDetail } from "../../api/types";
import { formatEGP } from "../../utils/format";
import { monthLabel } from "../../utils/months";
import { paymentMethodLabel } from "../../utils/paymentMethods";
import { EquipmentPages, PackageShell, Page } from "../equipment/PartnerPackage";

const th = "text-start font-bold py-1.5 px-1 border-b-2 border-slate-300 text-slate-600";
const td = "py-1.5 px-1 border-b border-slate-100";

// ملف الشريك من صفحة الشريك: أول صفحة حسابه هو (عمل كام من كل معدة، أخد كام،
// وليه كام)، وبعدها صفحات كل معدة هو شريك فيها — السركي الورقي وشيت السركي
// والمصروفات وتقسيمة الفلوس.
export default function PartnerFile({ detail, month, onClose }: { detail: PartnerDetail; month: string; onClose: () => void }) {
  const [equipment, setEquipment] = useState<Equipment[] | null>(null);
  const [readyCount, setReadyCount] = useState(0);
  const partner = detail.partner;
  const period = `${monthLabel(month)} ${month.slice(0, 4)}`;

  useEffect(() => {
    equipmentApi.list().then((all) => setEquipment(all.filter((e) => e.shares.some((s) => s.partner_id === partner.id))));
  }, [partner.id]);

  const monthPaid = detail.payments.filter((p) => p.date.startsWith(month));
  const ready = equipment != null && readyCount >= equipment.length;

  return (
    <PackageShell
      title={`ملف الشريك — ${partner.name}`}
      subtitle={period}
      fileName={`ملف الشريك - ${partner.name} - ${period}`}
      ready={ready}
      onClose={onClose}
    >
      <Page title="حساب الشريك" heading={partner.name} month={month}>
        <div className="grid grid-cols-3 gap-3 mb-5 text-center">
          <div className="rounded-xl bg-slate-50 py-3">
            <div className="text-xs text-slate-500">إجمالي المستحق له</div>
            <div className="text-lg font-extrabold">{formatEGP(detail.totalDue)}</div>
          </div>
          <div className="rounded-xl bg-slate-50 py-3">
            <div className="text-xs text-slate-500">أخد</div>
            <div className="text-lg font-extrabold text-rose-600">{formatEGP(detail.totalPaid)}</div>
          </div>
          <div className="rounded-xl bg-slate-50 py-3">
            <div className="text-xs text-slate-500">الباقي له</div>
            <div className="text-lg font-extrabold text-primary">{formatEGP(detail.remaining)}</div>
          </div>
        </div>

        <div className="font-bold mb-1">نصيبه من كل معدة — {period}</div>
        <table className="w-full text-sm mb-5">
          <thead>
            <tr>
              <th className={th}>المعدة</th>
              <th className={th}>نسبته</th>
              <th className={th}>نصيبه الشهر ده</th>
            </tr>
          </thead>
          <tbody>
            {detail.equipmentBreakdown.map((e) => (
              <tr key={e.equipment_name}>
                <td className={`${td} font-semibold`}>{e.equipment_name}</td>
                <td className={td}>{e.percentage}%</td>
                <td className={`${td} font-semibold`}>{formatEGP(e.monthAmount)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={2} className="pt-1.5 font-bold">
                إجمالي الشهر
              </td>
              <td className="pt-1.5 font-extrabold">{formatEGP(detail.monthDue)}</td>
            </tr>
          </tfoot>
        </table>

        <div className="font-bold mb-1">نصيبه من كل معدة — سنة {detail.year}</div>
        <table className="w-full text-sm mb-5">
          <thead>
            <tr>
              <th className={th}>المعدة</th>
              <th className={th}>نسبته</th>
              <th className={th}>نصيبه طول السنة</th>
            </tr>
          </thead>
          <tbody>
            {detail.yearlyEquipmentBreakdown.map((e) => (
              <tr key={e.equipment_name}>
                <td className={`${td} font-semibold`}>{e.equipment_name}</td>
                <td className={td}>{e.percentage}%</td>
                <td className={`${td} font-semibold`}>{formatEGP(e.yearAmount)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={2} className="pt-1.5 font-bold">
                إجمالي السنة
              </td>
              <td className="pt-1.5 font-extrabold">{formatEGP(detail.yearDue)}</td>
            </tr>
          </tfoot>
        </table>

        <div className="font-bold mb-1">اللي أخده — {period}</div>
        {monthPaid.length === 0 ? (
          <div className="text-sm text-slate-500">مفيش دفعات الشهر ده.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className={th}>التاريخ</th>
                <th className={th}>طريقة الدفع</th>
                <th className={th}>ملاحظة</th>
                <th className={th}>المبلغ</th>
              </tr>
            </thead>
            <tbody>
              {monthPaid.map((p) => (
                <tr key={p.id}>
                  <td className={td}>{p.date}</td>
                  <td className={td}>{paymentMethodLabel(p.method)}</td>
                  <td className={td}>{p.note ?? ""}</td>
                  <td className={`${td} font-semibold`}>{formatEGP(p.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Page>

      {equipment?.map((e) => (
        <EquipmentPages key={e.id} equipment={e} month={month} skipEmpty onReady={() => setReadyCount((n) => n + 1)} />
      ))}
    </PackageShell>
  );
}
