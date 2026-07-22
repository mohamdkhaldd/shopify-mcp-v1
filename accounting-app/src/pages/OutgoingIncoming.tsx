import { useEffect, useState } from "react";
import MonthPicker from "../components/equipment/MonthPicker";
import PrintButton from "../components/PrintButton";
import { outgoingIncomingApi } from "../api/client";
import { IncomingSummary, OutgoingSummary } from "../api/types";
import { currentMonthKey } from "../utils/months";
import { formatEGP } from "../utils/format";
import { paymentMethodLabel } from "../utils/paymentMethods";

type Tab = "outgoing" | "incoming";

export default function OutgoingIncoming() {
  const [month, setMonth] = useState(currentMonthKey());
  const [tab, setTab] = useState<Tab>("outgoing");
  const [outgoing, setOutgoing] = useState<OutgoingSummary | null>(null);
  const [incoming, setIncoming] = useState<IncomingSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([outgoingIncomingApi.outgoing(month), outgoingIncomingApi.incoming(month)])
      .then(([o, i]) => {
        setOutgoing(o);
        setIncoming(i);
      })
      .finally(() => setLoading(false));
  }, [month]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">الصادر والوارد</h1>
          <p className="text-sm text-slate-500 mt-1">
            كل فلوس الشركة اللي خرجت (مصاريف معدات، دفعات شركاء وموردين، سلف ومكافآت، هالك) وكل الفلوس اللي دخلت من المقاولين.
          </p>
        </div>
        <div className="no-print flex items-center gap-2">
          <MonthPicker month={month} onChange={setMonth} />
          <PrintButton />
        </div>
      </div>

      <div className="no-print flex gap-2">
        <button
          onClick={() => setTab("outgoing")}
          className={[
            "rounded-xl px-4 py-2 text-sm font-semibold transition-colors",
            tab === "outgoing" ? "bg-primary text-white shadow-sm" : "bg-white text-slate-600 hover:bg-primary-light hover:text-primary-dark shadow-card",
          ].join(" ")}
        >
          الصادر
        </button>
        <button
          onClick={() => setTab("incoming")}
          className={[
            "rounded-xl px-4 py-2 text-sm font-semibold transition-colors",
            tab === "incoming" ? "bg-primary text-white shadow-sm" : "bg-white text-slate-600 hover:bg-primary-light hover:text-primary-dark shadow-card",
          ].join(" ")}
        >
          الوارد
        </button>
      </div>

      {loading || !outgoing || !incoming ? (
        <div className="text-sm text-slate-400">جاري التحميل...</div>
      ) : tab === "outgoing" ? (
        <OutgoingView data={outgoing} />
      ) : (
        <IncomingView data={incoming} />
      )}
    </div>
  );
}

function Section({ title, total, children }: { title: string; total: number; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-card shadow-card p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-bold text-slate-800">{title}</h2>
        <span className="text-sm font-bold text-primary-dark">{formatEGP(total)}</span>
      </div>
      {children}
    </div>
  );
}

function OutgoingView({ data }: { data: OutgoingSummary }) {
  return (
    <div className="space-y-5">
      <div className="bg-white rounded-card shadow-card p-5">
        <div className="text-sm text-slate-500 font-semibold">إجمالي الصادر الشهر ده</div>
        <div className="mt-2 text-2xl font-extrabold text-rose-600">{formatEGP(data.totalOutgoing)}</div>
      </div>

      <Section title="مصروفات المعدات" total={data.equipmentExpensesTotal}>
        {data.equipmentExpenses.length === 0 ? (
          <div className="text-sm text-slate-400">لسه مفيش مصروفات مسجلة الشهر ده.</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-slate-400 border-b border-slate-100">
                    <th className="text-start font-semibold py-2">التاريخ</th>
                    <th className="text-start font-semibold py-2">المعدة</th>
                    <th className="text-start font-semibold py-2">النوع</th>
                    <th className="text-start font-semibold py-2">طريقة الدفع</th>
                    <th className="text-start font-semibold py-2">المبلغ</th>
                  </tr>
                </thead>
                <tbody>
                  {data.equipmentExpenses.map((e) => (
                    <tr key={e.id} className="border-b border-slate-50 last:border-0">
                      <td className="py-2 text-slate-500">{e.date ?? "—"}</td>
                      <td className="py-2 font-semibold text-slate-700">{e.equipment_name}</td>
                      <td className="py-2 text-slate-500">{e.category_name ?? "—"}</td>
                      <td className="py-2 text-slate-500">{paymentMethodLabel(e.payment_method)}</td>
                      <td className="py-2 font-semibold text-slate-700">{formatEGP(e.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100">
              <div className="text-xs font-bold text-slate-500 mb-2">إجمالي كل نوع مصروف</div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {data.categoryTotals.map((c) => (
                  <div key={c.category_name} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-1.5 text-sm">
                    <span className="text-slate-600">{c.category_name}</span>
                    <span className="font-semibold text-slate-800">{formatEGP(c.total)}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </Section>

      <Section title="دفعات للشركاء" total={data.partnerPaymentsTotal}>
        {data.partnerPayments.length === 0 ? (
          <div className="text-sm text-slate-400">لسه مفيش دفعات شركاء الشهر ده.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-400 border-b border-slate-100">
                <th className="text-start font-semibold py-2">التاريخ</th>
                <th className="text-start font-semibold py-2">الشريك</th>
                <th className="text-start font-semibold py-2">طريقة الدفع</th>
                <th className="text-start font-semibold py-2">ملاحظة</th>
                <th className="text-start font-semibold py-2">المبلغ</th>
              </tr>
            </thead>
            <tbody>
              {data.partnerPayments.map((p) => (
                <tr key={p.id} className="border-b border-slate-50 last:border-0">
                  <td className="py-2 text-slate-500">{p.date}</td>
                  <td className="py-2 font-semibold text-slate-700">{p.partner_name}</td>
                  <td className="py-2 text-slate-500">{paymentMethodLabel(p.method)}</td>
                  <td className="py-2 text-slate-500">{p.note ?? "—"}</td>
                  <td className="py-2 font-semibold text-slate-700">{formatEGP(p.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      <Section title="دفعات للموردين" total={data.supplierPaymentsTotal}>
        {data.supplierPayments.length === 0 ? (
          <div className="text-sm text-slate-400">لسه مفيش دفعات موردين الشهر ده.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-400 border-b border-slate-100">
                <th className="text-start font-semibold py-2">التاريخ</th>
                <th className="text-start font-semibold py-2">المورد</th>
                <th className="text-start font-semibold py-2">طريقة الدفع</th>
                <th className="text-start font-semibold py-2">ملاحظة</th>
                <th className="text-start font-semibold py-2">المبلغ</th>
              </tr>
            </thead>
            <tbody>
              {data.supplierPayments.map((p) => (
                <tr key={p.id} className="border-b border-slate-50 last:border-0">
                  <td className="py-2 text-slate-500">{p.date}</td>
                  <td className="py-2 font-semibold text-slate-700">{p.supplier_name}</td>
                  <td className="py-2 text-slate-500">{paymentMethodLabel(p.method)}</td>
                  <td className="py-2 text-slate-500">{p.note ?? "—"}</td>
                  <td className="py-2 font-semibold text-slate-700">{formatEGP(p.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      <Section title="الرواتب (سلف ومكافآت ودفعات مرتبات)" total={data.payrollTotal}>
        {data.payroll.length === 0 ? (
          <div className="text-sm text-slate-400">لسه مفيش سلف ولا مكافآت ولا دفعات مرتبات مسجلة الشهر ده.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-400 border-b border-slate-100">
                <th className="text-start font-semibold py-2">التاريخ</th>
                <th className="text-start font-semibold py-2">الموظف</th>
                <th className="text-start font-semibold py-2">النوع</th>
                <th className="text-start font-semibold py-2">طريقة الدفع</th>
                <th className="text-start font-semibold py-2">ملاحظة</th>
                <th className="text-start font-semibold py-2">المبلغ</th>
              </tr>
            </thead>
            <tbody>
              {data.payroll.map((p) => (
                <tr key={`${p.kind}-${p.id}`} className="border-b border-slate-50 last:border-0">
                  <td className="py-2 text-slate-500">{p.date}</td>
                  <td className="py-2 font-semibold text-slate-700">{p.employee_name}</td>
                  <td className="py-2 text-slate-500">
                    {p.kind === "advance" ? "سلفة" : p.kind === "bonus" ? "مكافأة" : "دفعة مرتب"}
                  </td>
                  <td className="py-2 text-slate-500">{paymentMethodLabel(p.payment_method)}</td>
                  <td className="py-2 text-slate-500">{p.note ?? "—"}</td>
                  <td className="py-2 font-semibold text-slate-700">{formatEGP(p.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      <Section title="الهالك" total={data.wasteTotal}>
        {data.waste.length === 0 ? (
          <div className="text-sm text-slate-400">لسه مفيش هالك مسجل الشهر ده.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-400 border-b border-slate-100">
                <th className="text-start font-semibold py-2">التاريخ</th>
                <th className="text-start font-semibold py-2">طريقة الدفع</th>
                <th className="text-start font-semibold py-2">البيان</th>
                <th className="text-start font-semibold py-2">المبلغ</th>
              </tr>
            </thead>
            <tbody>
              {data.waste.map((w) => (
                <tr key={w.id} className="border-b border-slate-50 last:border-0">
                  <td className="py-2 text-slate-500">{w.date}</td>
                  <td className="py-2 text-slate-500">{paymentMethodLabel(w.payment_method)}</td>
                  <td className="py-2 text-slate-500">{w.note ?? "—"}</td>
                  <td className="py-2 font-semibold text-slate-700">{formatEGP(w.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>
    </div>
  );
}

function IncomingView({ data }: { data: IncomingSummary }) {
  return (
    <div className="space-y-5">
      <div className="bg-white rounded-card shadow-card p-5">
        <div className="text-sm text-slate-500 font-semibold">إجمالي الوارد الشهر ده</div>
        <div className="mt-2 text-2xl font-extrabold text-primary">{formatEGP(data.totalIncoming)}</div>
      </div>

      <Section title="دفعات من المقاولين" total={data.totalIncoming}>
        {data.contractorPayments.length === 0 ? (
          <div className="text-sm text-slate-400">لسه مفيش دفعات مستلمة من مقاولين الشهر ده.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-400 border-b border-slate-100">
                <th className="text-start font-semibold py-2">التاريخ</th>
                <th className="text-start font-semibold py-2">المقاول</th>
                <th className="text-start font-semibold py-2">طريقة الاستلام</th>
                <th className="text-start font-semibold py-2">ملاحظة</th>
                <th className="text-start font-semibold py-2">المبلغ</th>
              </tr>
            </thead>
            <tbody>
              {data.contractorPayments.map((p) => (
                <tr key={p.id} className="border-b border-slate-50 last:border-0">
                  <td className="py-2 text-slate-500">{p.date}</td>
                  <td className="py-2 font-semibold text-slate-700">{p.contractor_name}</td>
                  <td className="py-2 text-slate-500">{paymentMethodLabel(p.method)}</td>
                  <td className="py-2 text-slate-500">{p.note ?? "—"}</td>
                  <td className="py-2 font-semibold text-slate-700">{formatEGP(p.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>
    </div>
  );
}
