import { useEffect, useState } from "react";
import { syncApi } from "../api/client";
import { SyncActivity, SyncActivityRow } from "../api/types";
import { formatEGP } from "../utils/format";
import { person } from "../person";

const OP_VERB: Record<string, string> = { insert: "أضاف", update: "عدّل", delete: "مسح" };

const money = (v: unknown) => (typeof v === "number" ? formatEGP(v) : "");
const day = (d: unknown) => (typeof d === "string" && d.length >= 10 ? `${d.slice(8, 10)}/${d.slice(5, 7)}` : "");

// جملة بالعربي توصف التعديل — من اسم الجدول والبيانات اللي اتبعتت معاه.
function describe(r: SyncActivityRow): string {
  const d = r.data ?? {};
  const ref = r.refs ?? {};
  const eq = ref.equipment_id ? ` — ${ref.equipment_id}` : "";
  switch (r.tbl) {
    case "daily_logs": {
      const sheet = d.role === "contractor" ? "شيت المقاول" : d.role === "market" ? "سركي سوق" : "السركي";
      const detail = d.is_day_off ? " (مشتغلش)" : d.person_name ? ` — ${d.person_name}${d.day_rate ? ` ${money(d.day_rate)}` : ""}` : "";
      return `${sheet}${eq} يوم ${day(d.date)}${detail}`;
    }
    case "monthly_expenses":
      return `مصروف ${ref.category_id ?? ""} ${money(d.amount)}${eq}${d.payee ? ` — ${d.payee}` : ""}`;
    case "expense_payments":
      return `دفعة آجل ${money(d.amount)}`;
    case "employee_advances":
      return `سلفة ${ref.employee_id ?? ""} ${money(d.amount)}`;
    case "employee_bonuses":
      return `مكافأة ${ref.employee_id ?? ""} ${money(d.amount)}`;
    case "employee_deductions":
      return `خصم ${ref.employee_id ?? ""} ${money(d.amount)}`;
    case "salary_payments":
      return `دفعة مرتب ${ref.employee_id ?? ""} ${money(d.amount)}`;
    case "employee_rate_history":
      return `أجر ${ref.employee_id ?? ""} من شهر ${d.effective_month ?? ""}: ${money(d.rate)}`;
    case "contractor_payments":
      return `دفعة من المقاول ${ref.contractor_id ?? ""} ${money(d.amount)}`;
    case "partner_payments":
      return `دفعة للشريك ${ref.partner_id ?? ""} ${money(d.amount)}`;
    case "supplier_purchases":
      return `مشتريات من ${ref.supplier_id ?? ""} ${money(d.amount)}`;
    case "supplier_payments":
      return `دفعة للمورد ${ref.supplier_id ?? ""} ${money(d.amount)}`;
    case "equipment_partner_shares":
      return `نسبة ${ref.partner_id ?? ""} في ${ref.equipment_id ?? ""}: ${d.percentage ?? ""}%`;
    case "equipment_shifts":
      return `شيفت ${d.label ?? ""}${eq}`;
    case "equipment":
      return `معدة ${d.name ?? ""}`;
    case "partners":
      return `شريك ${d.name ?? ""}`;
    case "employees":
      return `سواق/موظف ${d.name ?? ""}`;
    case "contractors":
      return `مقاول ${d.name ?? ""}`;
    case "suppliers":
      return `مورد ${d.name ?? ""}`;
    case "expense_categories":
      return `نوع مصروف ${d.name ?? ""}`;
    case "hassan_ledger":
      return `حساب ${person()} الشخصي ${money(d.amount)}${d.party_name ? ` — ${d.party_name}` : ""}`;
    case "hassan_treasury_expenses":
      return `خزنة ${person()} ${money(d.amount)}${d.description ? ` — ${d.description}` : ""}`;
    case "hassan_penalties":
      return `جزاء ${person()} ${money(d.amount)}${d.reason ? ` — ${d.reason}` : ""}`;
    case "hassan_workers":
      return `عامل ${person()} ${d.name ?? ""}`;
    case "hassan_worker_entries":
      return `حركة ${ref.worker_id ?? `عامل ${person()}`} ${money(d.amount)}`;
    case "treasury_accounts":
      return "رصيد بداية حساب الخزنة";
    case "treasury_transfers":
      return `تحويل بين حسابات ${money(d.amount)}`;
    case "other_income":
      return `إيراد آخر ${money(d.amount)}${d.description ? ` — ${d.description}` : ""}`;
    case "treasury_adjustments":
      return `جرد الخزنة (فرق ${money(d.amount)})`;
    case "creditors":
      return `جهة علينا لها فلوس: ${d.name ?? ""}${d.opening_balance ? ` (رصيد قديم ${money(d.opening_balance)})` : ""}`;
    case "creditor_entries":
      return d.type === "payment"
        ? `سداد لـ ${ref.creditor_id ?? ""} ${money(d.amount)}${d.note ? ` — ${d.note}` : ""}`
        : `دين علينا لـ ${ref.creditor_id ?? ""} ${money(d.amount)}${d.note ? ` — ${d.note}` : ""}`;
    case "custodies":
      return `عهدة لـ ${d.holder ?? ""} ${money(d.amount)}`;
    case "custody_entries":
      return d.type === "expense"
        ? `صرف من عهدة ${ref.custody_id ?? ""} ${money(d.amount)}${d.description ? ` — ${d.description}` : ""}`
        : d.type === "topup"
          ? `زيادة على عهدة ${ref.custody_id ?? ""} ${money(d.amount)}`
          : `رجوع باقي عهدة ${ref.custody_id ?? ""} ${money(d.amount)}`;
    case "car_fuel":
      return `العربية الملاكي: ${d.kind ?? ""} ${money(d.amount)}`;
    case "obligations":
      return `ميعاد التزام: ${d.title ?? ""}${d.amount ? ` ${money(d.amount)}` : ""} — ${d.due_date ?? ""}${d.done_at ? " (اتدفع)" : ""}`;
    case "hassan_worker_attendance": {
      const st: Record<string, string> = { present: "اشتغل", absent: "غايب", leave_paid: "إجازة مدفوعة", leave_unpaid: "إجازة مش مدفوعة" };
      return `حضور ${ref.worker_id ?? `عامل ${person()}`} يوم ${day(d.date)}: ${st[d.status] ?? d.status ?? ""}`;
    }
    case "waste_entries":
      return `هالك ${money(d.amount)}`;
    default:
      return r.tbl;
  }
}

function formatAt(at: string) {
  const d = new Date(at);
  if (Number.isNaN(d.getTime())) return at;
  return `${d.toLocaleDateString("ar-EG", { day: "2-digit", month: "2-digit", year: "numeric" })} ${d.toLocaleTimeString("ar-EG", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

// رسالة التأكيد قبل التراجع — بتقول هيحصل إيه بالظبط.
function undoQuestion(r: SyncActivityRow) {
  const what = describe(r);
  if (r.op === "insert") return `تتراجع عن الإضافة دي؟\n\n${what}\n\nهتتمسح (ومعاها أي حاجة متسجلة تحتها).`;
  if (r.op === "update") return `تتراجع عن التعديل ده؟\n\n${what}\n\nهترجع للقيم اللي كانت قبل التعديل.`;
  return `ترجّع اللي اتمسح؟\n\n${what}\n\nهيرجع زي ما كان (ومعاه أي حاجة اتمسحت معاه).`;
}

function Row({ r, currentDevice, onUndo }: { r: SyncActivityRow; currentDevice: string; onUndo?: (r: SyncActivityRow) => void }) {
  const isThis = r.device_name === currentDevice;
  return (
    <tr className="border-b border-slate-50 last:border-0">
      <td className="py-2 text-slate-500 whitespace-nowrap">{formatAt(r.at)}</td>
      <td className="py-2 whitespace-nowrap">
        <span
          className={[
            "rounded-md px-2 py-0.5 text-xs font-bold",
            isThis ? "bg-primary-light text-primary-dark" : "bg-sky-100 text-sky-800",
          ].join(" ")}
        >
          {isThis ? "💻" : "📱"} {r.device_name || "—"}
        </span>
      </td>
      <td
        className={[
          "py-2 font-semibold whitespace-nowrap",
          r.op === "delete" ? "text-rose-600" : r.op === "insert" ? "text-primary-dark" : "text-amber-700",
        ].join(" ")}
      >
        {OP_VERB[r.op] ?? r.op}
      </td>
      <td className="py-2 text-slate-700">
        {describe(r)}
        {r.pending && <span className="ms-2 rounded bg-amber-50 text-amber-700 px-1.5 py-0.5 text-[11px] font-bold">لسه متبعتش</span>}
      </td>
      <td className="py-2 text-end whitespace-nowrap">
        {r.undone ? (
          <span className="rounded bg-slate-100 text-slate-500 px-1.5 py-0.5 text-[11px] font-bold">اترجع ✓</span>
        ) : onUndo && !r.pending ? (
          <button
            onClick={() => onUndo(r)}
            className="rounded-lg border border-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-600 hover:bg-primary-light hover:text-primary-dark"
          >
            ↩ تراجع
          </button>
        ) : null}
      </td>
    </tr>
  );
}

// سجل التعديلات: كل إضافة/تعديل/مسح على أي جهاز — مين عمله وإمتى.
export default function Activity() {
  const [data, setData] = useState<SyncActivity | null>(null);
  const [device, setDevice] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [currentDevice, setCurrentDevice] = useState("");

  const refresh = () => {
    syncApi
      .activity({
        device: device || null,
        from: from ? new Date(`${from}T00:00:00`).toISOString() : null,
        to: to ? new Date(`${to}T23:59:59.999`).toISOString() : null,
        limit: 500,
      })
      .then(setData);
  };

  useEffect(() => {
    syncApi.status().then((s) => setCurrentDevice(s.deviceName));
  }, []);

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, 5000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [device, from, to]);

  const pending = (data?.pending ?? []).filter((r) => !device || r.device_name === device);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function handleUndo(r: SyncActivityRow) {
    if (!window.confirm(undoQuestion(r))) return;
    try {
      await syncApi.undo(r.id);
      setMessage({ ok: true, text: `اترجع: ${describe(r)}` });
    } catch (err) {
      setMessage({ ok: false, text: String((err as Error)?.message ?? err).replace(/^Error invoking remote method '[^']+': (Error: )?/, "") });
    }
    refresh();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900">سجل التعديلات</h1>
        <p className="text-sm text-slate-500 mt-1">
          كل إضافة أو تعديل أو مسح على اللاب أو التابلت — مين عمله وإمتى. دوس "تراجع" جنب أي سطر عشان ترجّعه زي ما كان.
        </p>
      </div>

      {message && (
        <div
          className={[
            "flex items-center justify-between rounded-xl px-4 py-2.5 text-sm font-semibold",
            message.ok ? "bg-primary-light text-primary-dark" : "bg-rose-50 text-rose-700",
          ].join(" ")}
        >
          <span>{message.ok ? "✓ " : "⚠ "}{message.text}</span>
          <button onClick={() => setMessage(null)} className="text-xs font-semibold opacity-70">
            إخفاء
          </button>
        </div>
      )}

      <div className="bg-white rounded-card shadow-card p-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs text-slate-400 mb-1">الجهاز</label>
          <select value={device} onChange={(e) => setDevice(e.target.value)} className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm bg-white min-w-[140px]">
            <option value="">كل الأجهزة</option>
            {(data?.devices ?? []).map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">من يوم</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">إلى يوم</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm" />
        </div>
        {(device || from || to) && (
          <button
            onClick={() => {
              setDevice("");
              setFrom("");
              setTo("");
            }}
            className="text-xs font-semibold text-slate-500 hover:text-primary"
          >
            مسح الفلتر
          </button>
        )}
      </div>

      {pending.length > 0 && (
        <div className="bg-white rounded-card shadow-card p-5">
          <h2 className="font-bold text-amber-700 mb-3">على الجهاز ده ولسه متبعتتش ({pending.length})</h2>
          <table className="w-full text-sm">
            <tbody>
              {pending.map((r) => (
                <Row key={r.id} r={r} currentDevice={currentDevice} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="bg-white rounded-card shadow-card p-5">
        {!data ? (
          <div className="text-sm text-slate-400">جاري التحميل...</div>
        ) : data.rows.length === 0 ? (
          <div className="text-sm text-slate-400">مفيش تعديلات متسجلة لسه.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-400 border-b border-slate-100">
                  <th className="text-start font-semibold py-2">الوقت</th>
                  <th className="text-start font-semibold py-2">الجهاز</th>
                  <th className="text-start font-semibold py-2">العملية</th>
                  <th className="text-start font-semibold py-2">التفاصيل</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r) => (
                  <Row key={r.id} r={r} currentDevice={currentDevice} onUndo={handleUndo} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
