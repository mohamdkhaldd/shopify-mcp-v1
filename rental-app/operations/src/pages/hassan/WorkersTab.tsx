import { Fragment, FormEvent, useEffect, useState } from "react";
import PrintButton from "../../components/PrintButton";
import Icon from "../../components/Icon";
import { attendanceApi, hassanApi } from "../../api/client";
import { AttendanceRow, AttendanceStatus, HassanWorker, HassanWorkerEntry, HassanWorkerEntryType, HassanWorkerPayroll } from "../../api/types";
import { monthLabel } from "../../utils/months";
import { formatEGP } from "../../utils/format";
import { person } from "../../person";
import { PAYMENT_METHODS } from "../../utils/paymentMethods";

function WorkerEntryForm({
  type,
  workerId,
  month,
  suggestedAmount,
  notePlaceholder,
  noteRequired,
  buttonLabel,
  buttonClass,
  onSaved,
}: {
  type: HassanWorkerEntryType;
  workerId: number;
  month: string;
  suggestedAmount?: number;
  notePlaceholder: string;
  noteRequired?: boolean;
  buttonLabel: string;
  buttonClass: string;
  onSaved: () => void;
}) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [method, setMethod] = useState("cash");
  // الدفعة والسلفة فلوس طالعة من خزنة الشركة (من الكوميشن) — من أنهي حساب.
  const paysOut = type === "payment" || type === "advance";

  useEffect(() => {
    if (suggestedAmount !== undefined) setAmount(suggestedAmount > 0 ? String(suggestedAmount) : "");
  }, [suggestedAmount]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!amount || (noteRequired && !note.trim())) return;
    await hassanApi.workerEntryCreate({ worker_id: workerId, month, date, type, amount: Number(amount), note: note || null, method });
    if (suggestedAmount === undefined) setAmount("");
    setNote("");
    onSaved();
  }

  return (
    <form onSubmit={handleSubmit} className="no-print flex flex-wrap items-end gap-2">
      <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm" />
      <input
        type="number"
        min="0"
        step="any"
        placeholder="القيمة"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        className="w-24 rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
      />
      <input
        type="text"
        placeholder={notePlaceholder}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
      />
      {paysOut && (
        <select value={method} onChange={(e) => setMethod(e.target.value)} className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm bg-white">
          {PAYMENT_METHODS.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
      )}
      <button type="submit" className={`${buttonClass} text-white rounded-lg px-3 py-1.5 text-sm font-semibold`}>
        {buttonLabel}
      </button>
    </form>
  );
}

const ATTENDANCE: { value: AttendanceStatus; label: string; short: string; cls: string }[] = [
  { value: "present", label: "اشتغل", short: "ش", cls: "bg-primary text-white" },
  { value: "absent", label: "غايب", short: "غ", cls: "bg-rose-500 text-white" },
  { value: "leave_paid", label: "إجازة مدفوعة", short: "م", cls: "bg-sky-500 text-white" },
  { value: "leave_unpaid", label: "إجازة مش مدفوعة", short: "ب", cls: "bg-amber-500 text-white" },
];

// شيت حضور العامل في الشهر (سركي عمال حسن): دوس على اليوم واختار اشتغل /
// إجازة مدفوعة / إجازة مش مدفوعة / غايب — ولو العامل باليومية مرتبه بيتحسب منه.
function AttendanceSheet({ workerId, month, onChanged }: { workerId: number; month: string; onChanged?: () => void }) {
  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [picking, setPicking] = useState<string | null>(null);
  const refresh = () => attendanceApi.list(workerId, month).then(setRows);
  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workerId, month]);

  const [y, m] = month.split("-").map(Number);
  const days = new Date(y, m, 0).getDate();
  const byDate = new Map(rows.map((r) => [r.date, r.status]));
  const count = (s: AttendanceStatus) => rows.filter((r) => r.status === s).length;

  async function set(date: string, status: AttendanceStatus | null) {
    setPicking(null);
    await attendanceApi.set(workerId, date, status);
    refresh();
    onChanged?.();
  }

  return (
    <div className="mt-5 pt-4 border-t border-slate-100">
      <div className="text-xs font-bold text-slate-500 mb-2">الحضور والغياب — {monthLabel(month)}</div>
      <div className="flex flex-wrap gap-2 mb-3 text-xs">
        {ATTENDANCE.map((a) => (
          <span key={a.value} className="flex items-center gap-1">
            <span className={`inline-flex w-5 h-5 rounded items-center justify-center font-bold ${a.cls}`}>{a.short}</span>
            {a.label}: <b>{count(a.value)}</b>
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 sm:grid-cols-10 gap-1.5">
        {Array.from({ length: days }, (_, i) => {
          const date = `${month}-${String(i + 1).padStart(2, "0")}`;
          const status = byDate.get(date);
          const meta = ATTENDANCE.find((a) => a.value === status);
          return (
            <div key={date} className="relative">
              <button
                onClick={() => setPicking(picking === date ? null : date)}
                className={[
                  "w-full rounded-lg py-1.5 text-xs font-bold border",
                  meta ? `${meta.cls} border-transparent` : "bg-white border-slate-200 text-slate-500",
                ].join(" ")}
                title={meta?.label ?? "مش متسجل"}
              >
                {i + 1}
                {meta && <span className="block text-[10px] font-semibold opacity-90">{meta.short}</span>}
              </button>
              {picking === date && (
                <div className="no-print absolute z-20 top-full mt-1 start-0 bg-white rounded-xl shadow-card border border-slate-100 p-1.5 space-y-1 min-w-[130px]">
                  {ATTENDANCE.map((a) => (
                    <button key={a.value} onClick={() => set(date, a.value)} className="w-full text-start rounded-lg px-2 py-1 text-xs font-semibold hover:bg-slate-50">
                      <span className={`inline-flex w-4 h-4 rounded me-1.5 items-center justify-center text-[10px] ${a.cls}`}>{a.short}</span>
                      {a.label}
                    </button>
                  ))}
                  {status && (
                    <button onClick={() => set(date, null)} className="w-full text-start rounded-lg px-2 py-1 text-xs text-slate-400 hover:bg-slate-50">
                      امسح
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// شيت مرتب عامل واحد لشهر — زي شيت مرتب السواق في صفحة الرواتب بالظبط:
// المرتب والسلف والحوافز والخصومات ودفعات المرتب، كل حركة بتاريخها وسببها،
// وبيتطبع لوحده.
function WorkerSlip({
  row,
  month,
  entries,
  onChanged,
}: {
  row: HassanWorkerPayroll["rows"][number];
  month: string;
  entries: HassanWorkerEntry[];
  onChanged: () => void;
}) {
  const mine = entries.filter((e) => e.worker_id === row.worker_id).sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id);
  const ofType = (t: HassanWorkerEntryType) => mine.filter((e) => e.type === t);

  async function handleDelete(id: number) {
    await hassanApi.workerEntryRemove(id);
    onChanged();
  }

  const section = (t: HassanWorkerEntryType, title: string, form: JSX.Element) => (
    <div className="mb-4">
      <div className="text-xs font-bold text-slate-500 mb-1.5">{title}</div>
      {ofType(t).length > 0 ? (
        <ul className="space-y-1 mb-2">
          {ofType(t).map((e) => (
            <li key={e.id} className="flex items-center justify-between text-sm">
              <span className="text-slate-600">
                {e.date} — {formatEGP(e.amount)} {e.note && <span className="text-slate-400">({e.note})</span>}
              </span>
              <button onClick={() => handleDelete(e.id)} className="no-print text-xs text-rose-500 hover:text-rose-700 font-semibold">
                حذف
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="text-xs text-slate-400 mb-2">مفيش.</div>
      )}
      {form}
    </div>
  );

  return (
    <tr>
      <td colSpan={9} className="bg-slate-50 px-4 py-5 rounded-xl">
        <div className="bg-white rounded-card shadow-card p-5 max-w-2xl">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
            <div>
              <div className="font-extrabold text-slate-900">
                {row.name}
                {row.job && <span className="text-sm font-semibold text-slate-400"> — {row.job}</span>}
              </div>
              <div className="text-xs text-slate-400">
                شيت مرتب {monthLabel(month)} {month.slice(0, 4)} — عمال {person()}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <PrintButton />
              <Icon name="salaries" className="w-6 h-6 text-primary no-print" />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 mb-4">
            <div className="text-center bg-primary-light rounded-xl py-2.5">
              <div className="text-xs text-slate-500">{row.daily ? "المرتب (من الحضور)" : "المرتب الشهري"}</div>
              <div className="font-bold text-slate-800">{formatEGP(row.monthly_salary)}</div>
            </div>
            <div className="text-center bg-emerald-50 rounded-xl py-2.5">
              <div className="text-xs text-slate-500">الحافز</div>
              <div className="font-bold text-emerald-600">{formatEGP(row.bonuses)}</div>
            </div>
            <div className="text-center bg-rose-50 rounded-xl py-2.5">
              <div className="text-xs text-slate-500">الخصم</div>
              <div className="font-bold text-rose-600">{formatEGP(row.deductions)}</div>
            </div>
            <div className="text-center bg-rose-50 rounded-xl py-2.5">
              <div className="text-xs text-slate-500">السلف</div>
              <div className="font-bold text-rose-600">{formatEGP(row.advances)}</div>
            </div>
            <div className="text-center bg-primary rounded-xl py-2.5">
              <div className="text-xs text-white/80">المستحق</div>
              <div className="font-extrabold text-white">{formatEGP(row.net)}</div>
            </div>
          </div>

          <div className="flex items-center justify-between bg-slate-50 rounded-xl px-4 py-3 mb-4">
            <div>
              <div className="text-xs text-slate-500">اتدفع (مرتب + سلف)</div>
              <div className="font-bold text-emerald-600">{formatEGP(row.paid)}</div>
            </div>
            <div className="text-end">
              <div className="text-xs text-slate-500">الباقي</div>
              <div className={`font-extrabold ${row.remaining > 0 ? "text-rose-600" : "text-slate-800"}`}>{formatEGP(row.remaining)}</div>
            </div>
          </div>

          {section(
            "payment",
            "دفع المرتب",
            <WorkerEntryForm
              type="payment"
              workerId={row.worker_id}
              month={month}
              suggestedAmount={row.remaining}
              notePlaceholder="ملاحظة (اختياري)"
              buttonLabel="دفعت المرتب"
              buttonClass="bg-primary hover:bg-primary-dark"
              onSaved={onChanged}
            />
          )}
          {section(
            "advance",
            "السلف",
            <WorkerEntryForm
              type="advance"
              workerId={row.worker_id}
              month={month}
              notePlaceholder="ملاحظة (اختياري)"
              buttonLabel="إضافة سلفة"
              buttonClass="bg-primary hover:bg-primary-dark"
              onSaved={onChanged}
            />
          )}
          {section(
            "bonus",
            "الحافز",
            <WorkerEntryForm
              type="bonus"
              workerId={row.worker_id}
              month={month}
              notePlaceholder="الحافز ده عشان إيه؟"
              noteRequired
              buttonLabel="إضافة حافز"
              buttonClass="bg-emerald-600 hover:bg-emerald-700"
              onSaved={onChanged}
            />
          )}
          {section(
            "deduction",
            "الخصم",
            <WorkerEntryForm
              type="deduction"
              workerId={row.worker_id}
              month={month}
              notePlaceholder="سبب الخصم"
              noteRequired
              buttonLabel="إضافة خصم"
              buttonClass="bg-rose-600 hover:bg-rose-700"
              onSaved={onChanged}
            />
          )}
          <p className="no-print text-xs text-slate-400">
            دفعة المرتب والسلفة بتطلع من الحساب اللي تختاره في خزنة الشركة وبتتخصم من كوميشن {person()} باسم العامل. الحافز والخصم بيغيّروا المستحق بس.
          </p>

          {row.daily && (
            <div className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600 space-y-0.5">
              <div>
                {row.days_worked} يوم شغل × {formatEGP(row.day_rate ?? 0)} = <b>{formatEGP(row.days_worked * (row.day_rate ?? 0))}</b>
              </div>
              <div>
                {row.paid_leave_days} يوم إجازة مدفوعة × {formatEGP(row.leave_rate ?? 0)} = <b>{formatEGP(row.paid_leave_days * (row.leave_rate ?? 0))}</b>
              </div>
              <div className="text-slate-400">{row.unpaid_days} يوم إجازة غير مدفوعة / غياب — من غير فلوس</div>
            </div>
          )}

          <AttendanceSheet workerId={row.worker_id} month={month} onChanged={onChanged} />
        </div>
      </td>
    </tr>
  );
}

// شيت مرتبات العمال اللي حسن بيقبضهم من كوميشنه — دوس على اسم العامل تفتح
// شيت مرتبه وتسجل له كل حاجة وتطبعه.
export default function WorkersTab({ month }: { month: string }) {
  const [workers, setWorkers] = useState<HassanWorker[]>([]);
  const [payroll, setPayroll] = useState<HassanWorkerPayroll | null>(null);
  const [entries, setEntries] = useState<HassanWorkerEntry[]>([]);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const [newName, setNewName] = useState("");
  const [newJob, setNewJob] = useState("");
  const [newSalary, setNewSalary] = useState("");
  const [newDayRate, setNewDayRate] = useState("");
  const [newLeaveRate, setNewLeaveRate] = useState("");

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editJob, setEditJob] = useState("");
  const [editSalary, setEditSalary] = useState("");
  const [editDayRate, setEditDayRate] = useState("");
  const [editLeaveRate, setEditLeaveRate] = useState("");

  const refresh = () => {
    hassanApi.workersList().then(setWorkers);
    hassanApi.workersPayroll(month).then(setPayroll);
    hassanApi.workerEntriesList(month).then(setEntries);
  };

  useEffect(refresh, [month]);

  async function handleAddWorker(e: FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    await hassanApi.workerCreate({
      name: newName,
      job: newJob || null,
      monthly_salary: Number(newSalary) || 0,
      start_month: month,
      day_rate: newDayRate ? Number(newDayRate) : null,
      leave_rate: newLeaveRate ? Number(newLeaveRate) : null,
    });
    setNewName("");
    setNewJob("");
    setNewSalary("");
    setNewDayRate("");
    setNewLeaveRate("");
    refresh();
  }

  function startEdit(w: HassanWorker) {
    setEditingId(w.id);
    setEditName(w.name);
    setEditJob(w.job ?? "");
    setEditSalary(String(w.monthly_salary));
    setEditDayRate(w.day_rate ? String(w.day_rate) : "");
    setEditLeaveRate(w.leave_rate ? String(w.leave_rate) : "");
  }

  async function saveEdit() {
    if (editingId == null || !editName.trim()) return;
    await hassanApi.workerUpdate({
      id: editingId,
      name: editName,
      job: editJob || null,
      monthly_salary: Number(editSalary) || 0,
      day_rate: editDayRate ? Number(editDayRate) : null,
      leave_rate: editLeaveRate ? Number(editLeaveRate) : null,
    });
    setEditingId(null);
    refresh();
  }

  async function handleRemoveWorker(w: HassanWorker) {
    if (!window.confirm(`تشيل ${w.name} من قائمة عمال ${person()}؟ حركاته القديمة هتفضل زي ما هي.`)) return;
    await hassanApi.workerRemove(w.id);
    refresh();
  }

  // لما شيت عامل يبقى مفتوح، الطباعة بتطلع شيته هو بس.
  const slipOpen = expandedId != null;

  return (
    <div className="space-y-4">
      <div className={`${slipOpen ? "no-print " : ""}grid grid-cols-1 sm:grid-cols-3 gap-4`}>
        <div className="bg-white rounded-card shadow-card p-5">
          <div className="text-sm text-slate-500 font-semibold">إجمالي المستحق للعمال — {monthLabel(month)}</div>
          <div className="mt-2 text-2xl font-extrabold text-slate-800">{formatEGP(payroll?.totalNet ?? 0)}</div>
        </div>
        <div className="bg-white rounded-card shadow-card p-5">
          <div className="text-sm text-slate-500 font-semibold">اتصرف من كوميشن {person()}</div>
          <div className="mt-2 text-2xl font-extrabold text-rose-600">{formatEGP(payroll?.totalPaid ?? 0)}</div>
        </div>
        <div className="bg-white rounded-card shadow-card p-5">
          <div className="text-sm text-slate-500 font-semibold">الباقي للعمال</div>
          <div className="mt-2 text-2xl font-extrabold text-primary">{formatEGP(payroll?.totalRemaining ?? 0)}</div>
        </div>
      </div>

      <div className="bg-white rounded-card shadow-card p-5">
        <h2 className={`${slipOpen ? "no-print " : ""}font-bold text-slate-800 mb-1`}>
          شيت مرتبات عمال {person()} — {monthLabel(month)} {month.slice(0, 4)}
        </h2>
        <p className="no-print text-xs text-slate-400 mb-4">دوس على اسم أي عامل تفتح شيت مرتبه — تسجل له دفع المرتب والسلف والحافز والخصم وتطبعه.</p>
        {!payroll || payroll.rows.length === 0 ? (
          <div className="text-sm text-slate-400">لسه مفيش عمال — ضيفهم من تحت.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className={slipOpen ? "no-print" : ""}>
                <tr className="text-slate-400 border-b border-slate-100">
                  <th className="text-start font-semibold py-2">العامل</th>
                  <th className="text-start font-semibold py-2">الوظيفة</th>
                  <th className="text-start font-semibold py-2">المرتب</th>
                  <th className="text-start font-semibold py-2">حوافز</th>
                  <th className="text-start font-semibold py-2">خصومات</th>
                  <th className="text-start font-semibold py-2">المستحق</th>
                  <th className="text-start font-semibold py-2">سلف</th>
                  <th className="text-start font-semibold py-2">دفعات مرتب</th>
                  <th className="text-start font-semibold py-2">الباقي</th>
                </tr>
              </thead>
              <tbody>
                {payroll.rows.map((r) => (
                  <Fragment key={r.worker_id}>
                    <tr className={`${slipOpen ? "no-print " : ""}border-b border-slate-50 last:border-0`}>
                      <td className="py-2">
                        <button
                          onClick={() => setExpandedId(expandedId === r.worker_id ? null : r.worker_id)}
                          className="flex items-center gap-2 font-semibold text-slate-700 hover:text-primary"
                        >
                          <Icon name="salaries" className="w-4 h-4 text-primary no-print" />
                          {r.name}
                          {!r.active && <span className="text-xs text-slate-400"> (اتشال)</span>}
                        </button>
                      </td>
                      <td className="py-2 text-slate-500">{r.job ?? "—"}</td>
                      <td className="py-2 text-slate-600">
                        {formatEGP(r.monthly_salary)}
                        {r.daily && (
                          <span className="block text-[11px] text-slate-400">
                            {r.days_worked} يوم شغل{r.paid_leave_days ? ` + ${r.paid_leave_days} إجازة مدفوعة` : ""}
                          </span>
                        )}
                      </td>
                      <td className="py-2 text-slate-600">{formatEGP(r.bonuses)}</td>
                      <td className="py-2 text-rose-500">{formatEGP(r.deductions)}</td>
                      <td className="py-2 font-semibold text-slate-800">{formatEGP(r.net)}</td>
                      <td className="py-2 text-slate-600">{formatEGP(r.advances)}</td>
                      <td className="py-2 text-slate-600">{formatEGP(r.payments)}</td>
                      <td className={["py-2 font-bold", r.remaining > 0 ? "text-primary-dark" : r.remaining < 0 ? "text-rose-600" : "text-slate-500"].join(" ")}>
                        {formatEGP(r.remaining)}
                      </td>
                    </tr>
                    {expandedId === r.worker_id && <WorkerSlip row={r} month={month} entries={entries} onChanged={refresh} />}
                  </Fragment>
                ))}
              </tbody>
              <tfoot className={slipOpen ? "no-print" : ""}>
                <tr className="border-t border-slate-100">
                  <td colSpan={5} className="pt-3 font-bold text-slate-700">
                    الإجمالي
                  </td>
                  <td className="pt-3 font-bold text-slate-800">{formatEGP(payroll.totalNet)}</td>
                  <td colSpan={2} className="pt-3 font-bold text-rose-600">
                    {formatEGP(payroll.totalPaid)}
                  </td>
                  <td className="pt-3 font-bold text-primary-dark">{formatEGP(payroll.totalRemaining)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
      <div className="no-print bg-white rounded-card shadow-card p-5">
        <h2 className="font-bold text-slate-800 mb-4">عمال {person()}</h2>
        <form onSubmit={handleAddWorker} className="flex flex-wrap items-end gap-2 mb-4 pb-4 border-b border-slate-100">
          <div>
            <label className="block text-xs text-slate-400 mb-1">اسم العامل</label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">الوظيفة</label>
            <input
              type="text"
              value={newJob}
              onChange={(e) => setNewJob(e.target.value)}
              placeholder="اختياري"
              className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">يومية يوم الشغل</label>
            <input
              type="number"
              min="0"
              step="any"
              value={newDayRate}
              onChange={(e) => setNewDayRate(e.target.value)}
              className="w-28 rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">يومية الإجازة المدفوعة</label>
            <input
              type="number"
              min="0"
              step="any"
              value={newLeaveRate}
              onChange={(e) => setNewLeaveRate(e.target.value)}
              placeholder={newDayRate || "نفس اليومية"}
              className="w-28 rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">أو مرتب شهري ثابت</label>
            <input
              type="number"
              min="0"
              step="any"
              value={newSalary}
              onChange={(e) => setNewSalary(e.target.value)}
              placeholder="لو مش باليومية"
              className="w-28 rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={!newName.trim()}
            className="bg-primary text-white rounded-lg px-4 py-1.5 text-sm font-semibold hover:bg-primary-dark disabled:opacity-50"
          >
            إضافة عامل
          </button>
        </form>
        <p className="text-xs text-slate-400 mb-3">
          العامل الجديد بيظهر في الشيت من الشهر اللي إنت فاتحه دلوقتي ورايح. لو ليه يومية، مرتبه بيتحسب من شيت الحضور: يوم الشغل بيوميته، والإجازة
          المدفوعة بيومية الإجازة، والإجازة غير المدفوعة والغياب من غير فلوس.
        </p>

        {workers.length === 0 ? (
          <div className="text-sm text-slate-400">لسه مفيش عمال.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-400 border-b border-slate-100">
                <th className="text-start font-semibold py-2">الاسم</th>
                <th className="text-start font-semibold py-2">الوظيفة</th>
                <th className="text-start font-semibold py-2">اليومية</th>
                <th className="text-start font-semibold py-2">يومية الإجازة</th>
                <th className="text-start font-semibold py-2">مرتب شهري ثابت</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {workers.map((w) =>
                editingId === w.id ? (
                  <tr key={w.id} className="border-b border-slate-50 last:border-0">
                    <td className="py-1.5">
                      <input value={editName} onChange={(e) => setEditName(e.target.value)} className="rounded-lg border border-slate-200 px-2 py-1 text-sm" />
                    </td>
                    <td className="py-1.5">
                      <input value={editJob} onChange={(e) => setEditJob(e.target.value)} className="rounded-lg border border-slate-200 px-2 py-1 text-sm" />
                    </td>
                    <td className="py-1.5">
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={editDayRate}
                        onChange={(e) => setEditDayRate(e.target.value)}
                        className="w-24 rounded-lg border border-slate-200 px-2 py-1 text-sm"
                      />
                    </td>
                    <td className="py-1.5">
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={editLeaveRate}
                        onChange={(e) => setEditLeaveRate(e.target.value)}
                        placeholder={editDayRate}
                        className="w-24 rounded-lg border border-slate-200 px-2 py-1 text-sm"
                      />
                    </td>
                    <td className="py-1.5">
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={editSalary}
                        onChange={(e) => setEditSalary(e.target.value)}
                        className="w-24 rounded-lg border border-slate-200 px-2 py-1 text-sm"
                      />
                    </td>
                    <td className="py-1.5 whitespace-nowrap">
                      <button onClick={saveEdit} className="text-xs text-primary font-semibold me-3">
                        حفظ
                      </button>
                      <button onClick={() => setEditingId(null)} className="text-xs text-slate-400 font-semibold">
                        إلغاء
                      </button>
                    </td>
                  </tr>
                ) : (
                  <tr key={w.id} className="border-b border-slate-50 last:border-0">
                    <td className="py-2 font-semibold text-slate-700">{w.name}</td>
                    <td className="py-2 text-slate-500">{w.job ?? "—"}</td>
                    <td className="py-2 text-slate-600">{w.day_rate ? formatEGP(w.day_rate) : "—"}</td>
                    <td className="py-2 text-slate-600">{w.day_rate ? formatEGP(w.leave_rate ?? w.day_rate) : "—"}</td>
                    <td className="py-2 text-slate-600">{w.day_rate ? "—" : formatEGP(w.monthly_salary)}</td>
                    <td className="py-2 whitespace-nowrap">
                      <button onClick={() => startEdit(w)} className="text-xs text-primary font-semibold me-3">
                        تعديل
                      </button>
                      <button onClick={() => handleRemoveWorker(w)} className="text-xs text-rose-500 hover:text-rose-700 font-semibold">
                        شيل
                      </button>
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
