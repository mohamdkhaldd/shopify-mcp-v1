import { ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import CompanyLogo from "../../components/CompanyLogo";
import { useBrand } from "../../brand";
import { dailyLogsApi, equipmentApi, equipmentShiftsApi, monthlyExpensesApi, paperSheetsApi, printApi } from "../../api/client";
import { DailyLog, Equipment, EquipmentSummary, MonthlyExpense, PaperSheet } from "../../api/types";
import { formatEGP } from "../../utils/format";
import { monthLabel } from "../../utils/months";

interface PackageData {
  summary: EquipmentSummary;
  sheets: PaperSheet[];
  driverSheets: { label: string; logs: DailyLog[] }[];
  market: DailyLog[];
  expenses: MonthlyExpense[];
}

// صفحة A4 واحدة: المحتوى بيتصغر لوحده لو أطول أو أعرض من الورقة، عشان كل
// شيت يطلع في ورقة واحدة بالظبط.
function Page({ title, equipment, month, children }: { title: string; equipment: Equipment; month: string; children: ReactNode }) {
  const brand = useBrand();
  const box = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);

  // بنقيس المحتوى بعرض الورقة، ولو أكبر منها بنصغّره (ونوسّعه بنفس النسبة عشان
  // يفضل مالي عرض الورقة بعد التصغير). التعديل على الـ DOM مباشرة.
  const fit = () => {
    const b = box.current;
    const c = content.current;
    if (!b || !c) return;
    c.style.transformOrigin = "top right";
    c.style.transform = "none";
    // المحتوى بعرض (عرض الورقة ÷ s) ومتصغّر بـ s — لازم يدخل في الورقة طولًا وعرضًا.
    const fits = (s: number) => {
      c.style.width = `${100 / s}%`;
      return c.scrollHeight * s <= b.clientHeight + 1 && c.scrollWidth * s <= b.clientWidth + 1;
    };
    let scale = 1;
    if (!fits(1)) {
      let lo = 0.2;
      let hi = 1;
      for (let i = 0; i < 10; i++) {
        const mid = (lo + hi) / 2;
        if (fits(mid)) lo = mid;
        else hi = mid;
      }
      scale = lo;
    }
    c.style.width = `${100 / scale}%`;
    c.style.transform = scale < 1 ? `scale(${scale})` : "none";
  };
  useLayoutEffect(fit);
  useEffect(() => {
    const imgs = content.current?.querySelectorAll("img") ?? [];
    imgs.forEach((img) => img.addEventListener("load", fit));
    return () => imgs.forEach((img) => img.removeEventListener("load", fit));
  });

  return (
    <div className="pkg-page bg-white text-slate-900">
      <div ref={box} className="w-full h-full overflow-hidden">
      <div ref={content}>
        <div className="flex items-center justify-between border-b-2 border-slate-800 pb-2 mb-4">
          <div className="flex items-center gap-3">
            <CompanyLogo />
            <div>
              <div className="font-extrabold text-lg">{brand.customer || brand.name}</div>
              <div className="text-sm text-slate-600">
                {equipment.name} — {title}
              </div>
            </div>
          </div>
          <div className="text-sm font-semibold text-slate-600">
            {monthLabel(month)} {month.slice(0, 4)}
          </div>
        </div>
        {children}
        </div>
      </div>
    </div>
  );
}

const th = "text-start font-bold py-1.5 px-1 border-b-2 border-slate-300 text-slate-600";
const td = "py-1.5 px-1 border-b border-slate-100";

function DriverSheet({ logs }: { logs: DailyLog[] }) {
  const worked = logs.filter((l) => !l.is_day_off && !l.is_paid_leave && l.day_value > 0).length;
  const total = logs.reduce((s, l) => s + l.day_value, 0);
  return (
    <>
      <table className="w-full text-sm">
        <thead>
          <tr>
            <th className={th}>اليوم</th>
            <th className={th}>الموقع</th>
            <th className={th}>الحالة</th>
            <th className={th}>الساعات</th>
            <th className={th}>سعر اليوم</th>
            <th className={th}>القيمة</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((l) => (
            <tr key={l.id}>
              <td className={td}>{l.date.slice(8, 10)}/{l.date.slice(5, 7)}</td>
              <td className={td}>{l.site_name ?? ""}</td>
              <td className={td}>{l.is_day_off ? "مشتغلش" : l.is_paid_leave ? "إجازة مدفوعة" : "شغال"}</td>
              <td className={td}>
                {l.is_day_off || l.is_paid_leave ? "—" : `${l.actual_hours ?? l.base_hours ?? ""}${l.base_hours ? ` / ${l.base_hours}` : ""}`}
              </td>
              <td className={td}>{l.day_rate ? formatEGP(l.day_rate) : "—"}</td>
              <td className={`${td} font-semibold`}>{formatEGP(l.day_value)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={5} className="pt-2 font-bold">
              أيام الشغل: {worked} — الإجمالي
            </td>
            <td className="pt-2 font-extrabold">{formatEGP(total)}</td>
          </tr>
        </tfoot>
      </table>
    </>
  );
}

// ملف الشريك: الصفحات كلها جاهزة على ورق A4 — السركي الورقي، شيت السركي
// بالسعر، المصروفات، وتقسيمة الفلوس — وبيتحفظ PDF واحد.
export default function PartnerPackage({ equipment, month, onClose }: { equipment: Equipment; month: string; onClose: () => void }) {
  const [data, setData] = useState<PackageData | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    (async () => {
      const shifts = await equipmentShiftsApi.list(equipment.id);
      const labels = ["", ...shifts.map((s) => s.label)];
      const driverSheets = [];
      for (const label of labels) {
        const logs = (await dailyLogsApi.list(equipment.id, month, "driver", label)).filter((l) => l.person_name || l.day_rate || l.is_day_off);
        if (logs.length || label === "") driverSheets.push({ label, logs });
      }
      const [summary, sheets, market, expenses] = await Promise.all([
        equipmentApi.summary(equipment.id, month),
        paperSheetsApi.list(equipment.id, month),
        dailyLogsApi.list(equipment.id, month, "market", ""),
        monthlyExpensesApi.list(equipment.id, month),
      ]);
      setData({ summary, sheets, driverSheets, market: market.filter((l) => l.fixed_value), expenses });
    })();
  }, [equipment.id, month]);

  // الطباعة وقت الملف ده بتطلع صفحاته بس.
  useEffect(() => {
    const html = document.documentElement;
    html.style.setProperty("--pkg-root-font", getComputedStyle(html).fontSize);
    html.classList.add("pkg-printing");
    // وقت الملف ده بس: كل الصفحات A4 من غير هوامش — فالمتصفح (نسخة الويب)
    // ملوش مكان يكتب فيه اللينك والتاريخ فوق وتحت، ومفيش ورقة زيادة.
    const pageStyle = document.createElement("style");
    pageStyle.textContent = "@page { size: A4; margin: 0; }";
    document.head.appendChild(pageStyle);
    return () => {
      html.classList.remove("pkg-printing");
      pageStyle.remove();
    };
  }, []);

  async function save() {
    setSaving(true);
    setMessage("");
    try {
      const r = await printApi.savePdf(`ملف الشريك - ${equipment.name} - ${monthLabel(month)} ${month.slice(0, 4)}`);
      if (r.filePath) setMessage(`اتحفظ: ${r.filePath}`);
    } finally {
      setSaving(false);
    }
  }

  const s = data?.summary;
  const expensesTotal = (data?.expenses ?? []).reduce((sum, e) => sum + e.amount, 0);

  return createPortal(
    <div className="pkg-overlay fixed inset-0 z-50 overflow-y-auto bg-slate-200" dir="rtl">
      <div className="pkg-toolbar sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 bg-white shadow px-5 py-3">
        <div>
          <div className="font-extrabold text-slate-900">ملف الشريك — {equipment.name}</div>
          <div className="text-xs text-slate-500">
            {monthLabel(month)} {month.slice(0, 4)} — {message || "كل شيت في ورقة A4 لوحده"}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={save}
            disabled={!data || saving}
            className="bg-primary text-white rounded-xl px-4 py-2 text-sm font-semibold hover:bg-primary-dark disabled:opacity-50"
          >
            {saving ? "جاري التجهيز..." : "⬇ حفظ PDF"}
          </button>
          <button onClick={onClose} className="bg-slate-100 text-slate-600 rounded-xl px-4 py-2 text-sm font-semibold">
            إغلاق
          </button>
        </div>
      </div>

      {!data || !s ? (
        <div className="p-10 text-center text-slate-500">جاري تجهيز الملف...</div>
      ) : (
        <div className="pkg-pages py-6 space-y-6">
          {data.sheets.map((sheet, i) => (
            <Page key={sheet.id} title={`السركي الورقي من الشركة${data.sheets.length > 1 ? ` (${i + 1})` : ""}`} equipment={equipment} month={month}>
              <div className="flex items-center justify-center" style={{ height: "222mm" }}>
                <img src={sheet.image} alt="" className="max-w-full max-h-full object-contain" />
              </div>
            </Page>
          ))}

          {data.driverSheets.map((d) => (
            <Page key={`d-${d.label}`} title={`شيت السركي${d.label ? ` — ${d.label}` : ""}`} equipment={equipment} month={month}>
              {d.logs.length ? <DriverSheet logs={d.logs} /> : <div className="text-sm text-slate-500">مفيش أيام متسجلة الشهر ده.</div>}
            </Page>
          ))}

          {data.market.length > 0 && (
            <Page title="سركي سوق" equipment={equipment} month={month}>
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className={th}>اليوم</th>
                    <th className={th}>ملاحظة</th>
                    <th className={th}>القيمة</th>
                  </tr>
                </thead>
                <tbody>
                  {data.market.map((l) => (
                    <tr key={l.id}>
                      <td className={td}>{l.date.slice(8, 10)}/{l.date.slice(5, 7)}</td>
                      <td className={td}>{l.note ?? l.site_name ?? ""}</td>
                      <td className={`${td} font-semibold`}>{formatEGP(l.day_value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Page>
          )}

          <Page title="المصروفات" equipment={equipment} month={month}>
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className={th}>التاريخ</th>
                  <th className={th}>المصروف</th>
                  <th className={th}>ملاحظة</th>
                  <th className={th}>المبلغ</th>
                </tr>
              </thead>
              <tbody>
                {s.driverSalaryBreakdown.map((b) => (
                  <tr key={`sal-${b.name}`}>
                    <td className={td}>—</td>
                    <td className={td}>مرتب السائق</td>
                    <td className={td}>{b.name}</td>
                    <td className={`${td} font-semibold`}>{formatEGP(b.amount)}</td>
                  </tr>
                ))}
                {data.expenses.map((e) => (
                  <tr key={e.id}>
                    <td className={td}>{e.date ?? e.month}</td>
                    <td className={td}>{e.category_name ?? "مصروف"}</td>
                    <td className={td}>{[e.note, e.payee].filter(Boolean).join(" — ")}</td>
                    <td className={`${td} font-semibold`}>{formatEGP(e.amount)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3} className="pt-2 font-bold">
                    إجمالي المصروفات
                  </td>
                  <td className="pt-2 font-extrabold">{formatEGP(s.driverSalaryExpense + expensesTotal)}</td>
                </tr>
              </tfoot>
            </table>
          </Page>

          <Page title="تقسيمة الفلوس" equipment={equipment} month={month}>
            <table className="w-full text-base mb-6">
              <tbody>
                <tr>
                  <td className={td}>دخل التشغيل (سركي {formatEGP(s.driverIncome)} + سركي سوق {formatEGP(s.marketIncome)})</td>
                  <td className={`${td} font-bold`}>{formatEGP(s.income)}</td>
                </tr>
                <tr>
                  <td className={td}>إجمالي المصروفات (مرتب السائق {formatEGP(s.driverSalaryExpense)} + مصروفات {formatEGP(s.manualExpenseTotal)})</td>
                  <td className={`${td} font-bold`}>− {formatEGP(s.expenseTotal)}</td>
                </tr>
                <tr>
                  <td className="py-2 font-extrabold">صافي الربح</td>
                  <td className="py-2 font-extrabold">{formatEGP(s.netProfit)}</td>
                </tr>
              </tbody>
            </table>
            <div className="font-bold mb-2">توزيع الأرباح على الشركاء</div>
            {s.distribution.length === 0 ? (
              <div className="text-sm text-slate-500">مفيش شركاء محددين للمعدة دي.</div>
            ) : (
              <table className="w-full text-base">
                <thead>
                  <tr>
                    <th className={th}>الشريك</th>
                    <th className={th}>النسبة</th>
                    <th className={th}>المستحق</th>
                  </tr>
                </thead>
                <tbody>
                  {s.distribution.map((d) => (
                    <tr key={d.partner_id}>
                      <td className={`${td} font-semibold`}>{d.partner_name}</td>
                      <td className={td}>{d.percentage}%</td>
                      <td className={`${td} font-bold`}>{formatEGP(d.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <div className="mt-16 flex items-start justify-between gap-10 text-sm">
              <div className="flex-1">
                <div className="font-semibold mb-10">التوقيع</div>
                <div className="border-t border-slate-800 w-48" />
              </div>
              <div className="flex-1 text-center">
                <div className="font-semibold">الختم</div>
              </div>
            </div>
          </Page>
        </div>
      )}
    </div>,
    document.body
  );
}
