import type { PartySheet } from "../api/client";
import { monthLabel, pounds } from "../utils/format";
import { milliToHours } from "../utils/input";

const WEEKDAYS = ["الأحد", "الاتنين", "التلات", "الأربع", "الخميس", "الجمعة", "السبت"];

/**
 * The sheet that is printed and handed to one party. It only receives that
 * party's own data from the core (getPartySheet), so there's nothing to hide here.
 */
export default function PartySheetView({ sheet, partyLabel, signLabel }: { sheet: PartySheet; partyLabel: string; signLabel: string }) {
  const days = sheet.days.filter((d) => d.entered);
  return (
    <div className="m-3 border border-line rounded-md bg-surface print:m-0 print:border-0">
      <div className="flex items-center gap-3 px-4 py-3.5 border-b-2 border-fg">
        <img src="./logo.png" alt="" className="w-11 h-11 rounded-full bg-white" />
        <div>
          <b className="block font-display">شركة البنيان للمعدات الثقيلة</b>
          <span className="text-muted text-[13px]">سركي معدة — {monthLabel(sheet.month)}</span>
        </div>
      </div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-2.5 px-4 py-3 border-b border-line">
        <div>
          <span className="block text-xs text-muted">{partyLabel}</span>
          <b>{sheet.partyName}</b>
        </div>
        <div>
          <span className="block text-xs text-muted">المعدة</span>
          <b>{sheet.equipmentName}</b>
        </div>
        <div>
          <span className="block text-xs text-muted">الموقع</span>
          <b>{sheet.siteName ?? "—"}</b>
        </div>
        <div>
          <span className="block text-xs text-muted">الشهر</span>
          <b>{monthLabel(sheet.month)}</b>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="tbl [&_td]:px-2 [&_th]:px-2">
          <thead>
            <tr>
              <th>اليوم</th>
              <th>الموقع</th>
              <th className="n">الساعات الفعلية</th>
              <th className="n">أوفر تايم</th>
              <th className="n">سعر ساعة الأوفر</th>
              <th className="n">الساعات الأساسية</th>
              <th className="n">اليومية</th>
              <th>بيان</th>
              <th className="n">الإجمالي</th>
            </tr>
          </thead>
          <tbody>
            {days.length === 0 && (
              <tr>
                <td colSpan={9} className="text-center text-muted py-6">
                  مفيش أيام متسجلة في الشهر ده.
                </td>
              </tr>
            )}
            {days.map((d) => {
              const otRate = d.overtimeMilli > 0 ? d.overtimeRatePt ?? (d.dayRatePt != null && d.baseHoursMilli ? Math.trunc((d.dayRatePt * 1000) / d.baseHoursMilli) : null) : null;
              return (
                <tr key={d.date} className={d.isDayOff ? "text-muted" : ""}>
                  <td>
                    {d.date.slice(8)} <span className="text-xs text-muted">({WEEKDAYS[new Date(d.date + "T00:00:00Z").getUTCDay()]})</span>
                    {d.isDayOff && " مشتغلش"}
                  </td>
                  <td>{d.siteName ?? ""}</td>
                  <td className="n">{milliToHours(d.actualHoursMilli)}</td>
                  <td className="n">{d.overtimeMilli > 0 ? milliToHours(d.overtimeMilli) : ""}</td>
                  <td className="n">{otRate != null ? pounds(otRate) : ""}</td>
                  <td className="n">{d.isDayOff ? "" : milliToHours(d.baseHoursMilli)}</td>
                  <td className="n">{d.dayRatePt != null ? pounds(d.dayRatePt) : ""}</td>
                  <td>{d.note ?? ""}</td>
                  <td className="n font-bold">{d.isDayOff ? "" : pounds(d.totalPt)}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={3}>الإجمالي — {sheet.totals.workedDays} يوم شغل</td>
              <td className="n">{milliToHours(sheet.totals.overtimeMilli) || 0} س</td>
              <td colSpan={4} />
              <td className="n">{pounds(sheet.totals.totalPt)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <div className="grid grid-cols-3 gap-4 px-4 pt-9 pb-4 text-center font-bold text-[13px]">
        <div className="border-t border-fg pt-1.5">توقيع شركة البنيان</div>
        <div className="border-t border-fg pt-1.5">{signLabel}</div>
        <div className="border-t border-fg pt-1.5">الختم</div>
      </div>
    </div>
  );
}
