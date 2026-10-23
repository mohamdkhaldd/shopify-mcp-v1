import { useState } from "react";
import { api, OpenSarki } from "../../api/client";
import { Labeled, TextInput } from "../../components/Field";
import { Button } from "../../components/ui";
import { hoursToMilli, moneyToPt, ptToInput } from "../../utils/input";

const day = (month: string, n: string) => `${month}-${String(Math.min(31, Math.max(1, Number(n) || 1))).padStart(2, "0")}`;
const lastDay = (month: string) => String(new Date(Date.UTC(+month.slice(0, 4), +month.slice(5, 7), 0)).getUTCDate());

/** Same two boxes as the old sheet: "املا أيام مرة واحدة" and "أوفر تايم لأيام معيّنة". */
export function ClientBulk({ v, onDone, onError }: { v: OpenSarki; onDone: (msg: string) => void; onError: (m: string) => void }) {
  const c = v.contract;
  const [from, setFrom] = useState("1");
  const [to, setTo] = useState(lastDay(v.month));
  const [rate, setRate] = useState(c.unit === "day" ? ptToInput(c.clientRatePt) : "");
  const [site, setSite] = useState(c.siteName ?? "");
  const [base, setBase] = useState("8");
  const [reason, setReason] = useState("");
  const [otDays, setOtDays] = useState("");
  const [otHours, setOtHours] = useState("");
  const [otRate, setOtRate] = useState("");
  const [busy, setBusy] = useState(false);

  async function run(f: () => Promise<unknown>, msg: string) {
    setBusy(true);
    try {
      await f();
      onDone(msg);
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="no-print grid gap-2.5 px-4 py-3 border-b border-line bg-surface-2">
      <div className="flex flex-wrap items-end gap-2.5">
        <b className="w-full text-xs text-muted">املا أيام مرة واحدة</b>
        <Labeled label="من يوم">
          <TextInput value={from} onChange={(e) => setFrom(e.target.value)} className="w-16" inputMode="numeric" />
        </Labeled>
        <Labeled label="لحد يوم">
          <TextInput value={to} onChange={(e) => setTo(e.target.value)} className="w-16" inputMode="numeric" />
        </Labeled>
        <Labeled label={c.unit === "month" ? "اليومية (فاضي = الشهري ÷ 30)" : "سعر اليوم"}>
          <TextInput value={rate} onChange={(e) => setRate(e.target.value)} inputMode="decimal" />
        </Labeled>
        <Labeled label="اسم الموقع">
          <TextInput value={site} onChange={(e) => setSite(e.target.value)} className="w-48" />
        </Labeled>
        <Labeled label="الساعات الأساسية">
          <TextInput value={base} onChange={(e) => setBase(e.target.value)} className="w-20" inputMode="decimal" />
        </Labeled>
        <Button
          primary
          disabled={busy || v.closed}
          onClick={() =>
            run(
              () => api.fillRange(c.id, day(v.month, from), day(v.month, to), { dayRatePt: moneyToPt(rate), siteName: site.trim() || null, baseHoursMilli: hoursToMilli(base) ?? 8000 }),
              `اتملت الأيام من ${from} لـ ${to}`,
            )
          }
        >
          تطبيق على الأيام
        </Button>
        <Labeled label="السبب (للأيام اللي مشتغلتش)">
          <TextInput value={reason} onChange={(e) => setReason(e.target.value)} className="w-44" placeholder="إجازة / عطل / ..." />
        </Labeled>
        <Button danger disabled={busy || v.closed} onClick={() => run(() => api.clearRange(c.id, day(v.month, from), day(v.month, to), reason), `الأيام من ${from} لـ ${to} اتعلّمت مشتغلش`)}>
          افرغ الأيام دي (مشتغلش)
        </Button>
      </div>
      <div className="flex flex-wrap items-end gap-2.5">
        <b className="w-full text-xs text-muted">أوفر تايم لأيام معيّنة</b>
        <Labeled label="الأيام (مثلًا 3, 7, 15 أو 14-31)">
          <TextInput value={otDays} onChange={(e) => setOtDays(e.target.value)} className="w-48" placeholder="1-5, 7-10, 15" />
        </Labeled>
        <Labeled label="عدد الساعات">
          <TextInput value={otHours} onChange={(e) => setOtHours(e.target.value)} className="w-20" inputMode="decimal" />
        </Labeled>
        <Labeled label="سعر الساعة (اختياري)">
          <TextInput value={otRate} onChange={(e) => setOtRate(e.target.value)} className="w-24" placeholder="تلقائي" inputMode="decimal" />
        </Labeled>
        <Button
          primary
          disabled={busy || v.closed || !otDays.trim() || !otHours.trim()}
          onClick={() => run(() => api.applyOvertime(c.id, v.month, otDays, hoursToMilli(otHours) ?? 0, moneyToPt(otRate)), "اتطبّق الأوفر تايم")}
        >
          طبّق
        </Button>
      </div>
      <div className="text-[11px] text-muted">سركي صاحب المعدة بيتملى لوحده بنفس الأيام والساعات والأوفر تايم والبيان — اللي بيختلف فيه أسعاره بس (اليومية وساعة الأوفر).</div>
    </div>
  );
}

/** On the owner's sheet the only bulk changes are his two prices. */
export function SupplierBulk({ v, onDone, onError }: { v: OpenSarki; onDone: (msg: string) => void; onError: (m: string) => void }) {
  const c = v.contract;
  const [from, setFrom] = useState("1");
  const [to, setTo] = useState(lastDay(v.month));
  const [rate, setRate] = useState(ptToInput(c.supplierRatePt));
  const [otRate, setOtRate] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="no-print flex flex-wrap items-end gap-2.5 px-4 py-3 border-b border-line bg-surface-2">
      <b className="w-full text-xs text-muted">أسعار صاحب المعدة — كل حاجة تانية جاية من سركي الشركة</b>
      <Labeled label="من يوم">
        <TextInput value={from} onChange={(e) => setFrom(e.target.value)} className="w-16" inputMode="numeric" />
      </Labeled>
      <Labeled label="لحد يوم">
        <TextInput value={to} onChange={(e) => setTo(e.target.value)} className="w-16" inputMode="numeric" />
      </Labeled>
      <Labeled label="سعر اليوم">
        <TextInput value={rate} onChange={(e) => setRate(e.target.value)} inputMode="decimal" />
      </Labeled>
      <Labeled label="سعر ساعة الأوفر (فاضي = مايتغيرش)">
        <TextInput value={otRate} onChange={(e) => setOtRate(e.target.value)} className="w-28" inputMode="decimal" placeholder="—" />
      </Labeled>
      <Button
        primary
        disabled={busy || v.closed}
        onClick={async () => {
          setBusy(true);
          try {
            const pt = moneyToPt(rate);
            if (pt == null) throw new Error("اكتب سعر اليوم");
            const ot = moneyToPt(otRate);
            await api.setSupplierRate(c.id, day(v.month, from), day(v.month, to), { dayRatePt: pt, ...(ot != null ? { overtimeRatePt: ot } : {}) });
            onDone(`أسعار صاحب المعدة اتغيّرت من ${from} لـ ${to}`);
          } catch (e) {
            onError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        تطبيق
      </Button>
    </div>
  );
}
