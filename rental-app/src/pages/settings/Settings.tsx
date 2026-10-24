import { useCallback, useEffect, useState } from "react";
import { api, appApi, isTablet, isWeb, licenseApi, LicenseStatus, SettingsView, shellApi, syncApi } from "../../api/client";
import { Button, ErrorBox, Loading, Note, PageHeader, Panel } from "../../components/ui";
import { Labeled, TextInput } from "../../components/Field";
import { syncLine, useSyncStatus } from "../../components/Sync";
import { monthLabel, percentFromBp } from "../../utils/format";

const toBp = (t: string) => {
  const n = Number(t.trim().replace(/[٠-٩]/g, (c) => String("٠١٢٣٤٥٦٧٨٩".indexOf(c))).replace("٫", "."));
  if (!Number.isFinite(n) || n < 0 || n > 100) throw new Error("النسبة لازم تبقى بين ٠ و ١٠٠");
  return Math.round(n * 100);
};

function nextMonthStart() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth() + 1, 1).toLocaleDateString("en-CA");
}

function Rates({ v, onSaved }: { v: SettingsView; onSaved: () => void }) {
  const [from, setFrom] = useState(nextMonthStart());
  const [vat, setVat] = useState(String(v.current.vat / 100));
  const [tax5, setTax5] = useState(String(v.current.tax5 / 100));
  const [mgmt, setMgmt] = useState(String(v.current.management / 100));
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  let investors = "";
  try {
    investors = percentFromBp(10_000 - toBp(mgmt));
  } catch {
    investors = "—";
  }
  return (
    <Panel title="النسب" hint="كل تغيير ليه تاريخ سريان — الشهور اللي قبله متتغيرش">
      <div className="grid grid-cols-4 max-[800px]:grid-cols-2 border-b border-line">
        {[
          ["ضريبة القيمة المضافة", v.current.vat],
          ["ضريبة الهامش", v.current.tax5],
          ["نصيب الإدارة", v.current.management],
          ["نصيب المستثمرين", v.current.investors],
        ].map(([l, bp]) => (
          <div key={l as string} className="px-4 py-3 border-s border-line first:border-s-0">
            <span className="block text-xs font-semibold text-muted">{l} (النهارده)</span>
            <b className="text-lg num">{percentFromBp(bp as number)}</b>
          </div>
        ))}
      </div>
      <div className="grid gap-2 px-4 py-3 border-b border-line bg-surface-2">
        <div className="flex flex-wrap items-end gap-2.5">
          <b className="w-full text-xs text-muted">نسب جديدة</b>
          <Labeled label="تبتدي من يوم">
            <TextInput type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-36" />
          </Labeled>
          <Labeled label="القيمة المضافة ٪">
            <TextInput value={vat} onChange={(e) => setVat(e.target.value)} className="w-20" inputMode="decimal" />
          </Labeled>
          <Labeled label="ضريبة الهامش ٪">
            <TextInput value={tax5} onChange={(e) => setTax5(e.target.value)} className="w-20" inputMode="decimal" />
          </Labeled>
          <Labeled label="نصيب الإدارة ٪">
            <TextInput value={mgmt} onChange={(e) => setMgmt(e.target.value)} className="w-20" inputMode="decimal" />
          </Labeled>
          <div className="text-sm self-center">المستثمرين: <b>{investors}</b></div>
          <Button
            primary
            onClick={async () => {
              setError(null);
              setOk(false);
              try {
                await api.setRates({ effectiveFrom: from, vat: toBp(vat), tax5: toBp(tax5), management: toBp(mgmt) });
                setOk(true);
                onSaved();
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            حفظ النسب
          </Button>
        </div>
        {error && <ErrorBox message={error} />}
        {ok && <div className="rounded-card border border-in bg-in-soft px-4 py-2 font-semibold text-sm">النسب الجديدة اتسجلت.</div>}
      </div>
      <div className="overflow-x-auto">
        <table className="tbl">
          <thead>
            <tr>
              <th>من يوم</th>
              <th className="n">القيمة المضافة</th>
              <th className="n">ضريبة الهامش</th>
              <th className="n">الإدارة</th>
              <th className="n">المستثمرين</th>
            </tr>
          </thead>
          <tbody>
            {v.history.map((h) => (
              <tr key={h.effectiveFrom}>
                <td>{h.effectiveFrom === "2000-01-01" ? "من الأول" : h.effectiveFrom}</td>
                <td className="n">{h.vat != null ? percentFromBp(h.vat) : "—"}</td>
                <td className="n">{h.tax5 != null ? percentFromBp(h.tax5) : "—"}</td>
                <td className="n">{h.management_share != null ? percentFromBp(h.management_share) : "—"}</td>
                <td className="n">{h.investors_share != null ? percentFromBp(h.investors_share) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Note>
        مينفعش نسبة جديدة تبتدي في شهر اتقفل{v.lastClosedMonth ? ` (آخر شهر اتقفل: ${monthLabel(v.lastClosedMonth)})` : ""}. الأفضل تبتدي أول الشهر.
      </Note>
    </Panel>
  );
}

function Backups() {
  const [last, setLast] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const refresh = () => appApi.lastBackup().then((b) => setLast(b ? new Date(b.at).toLocaleString("en-GB") : null));
  useEffect(() => {
    refresh();
  }, []);
  if (isTablet() || isWeb())
    return (
      <Panel title="النسخ الاحتياطي">
        <div className="px-4 py-3.5 grid gap-3">
          <div>
            البيانات هنا محفوظة في السحابة مع باقي الأجهزة، واللاب بيعمل نسخة كل يوم. لو عايز نسخة في إيدك،{" "}
            {isWeb() ? "نزّلها على الجهاز." : "ابعتها لنفسك على واتساب أو Drive."}
          </div>
          <div>
            <Button primary onClick={() => appApi.backupNow()}>
              {isWeb() ? "نزّل نسخة من البيانات" : "ابعت نسخة من البيانات"}
            </Button>
          </div>
        </div>
      </Panel>
    );
  return (
    <Panel title="النسخ الاحتياطي">
      <div className="px-4 py-3.5 grid gap-3">
        <div>البرنامج بيعمل نسخة لوحده كل يوم، وبيحتفظ بآخر ٣٠ يوم. آخر نسخة: <b className="num">{last ?? "لسه"}</b></div>
        <div className="flex flex-wrap gap-2">
          <Button
            primary
            onClick={async () => {
              const f = await appApi.backupNow();
              if (f) setMsg({ ok: true, text: `النسخة اتحفظت: ${f}` });
            }}
          >
            اعمل نسخة دلوقتي
          </Button>
          <Button
            onClick={async () => {
              const r = await appApi.restoreBackup();
              if (r.ok) setMsg({ ok: true, text: "النسخة رجعت — البرنامج اتحمّل من جديد" });
              else if (r.message) setMsg({ ok: false, text: r.message });
            }}
          >
            رجّع نسخة قديمة
          </Button>
        </div>
        {msg && <div className={`rounded-card border px-4 py-2 font-semibold text-sm ${msg.ok ? "border-in bg-in-soft" : "border-out bg-out-soft"}`}>{msg.text}</div>}
        <div className="text-xs text-muted">قبل ما ترجّع نسخة، البرنامج بيعمل نسخة من الوضع الحالي الأول — فمفيش حاجة بتضيع.</div>
      </div>
    </Panel>
  );
}

function SyncPanel() {
  const [status, setStatus] = useSyncStatus();
  const [name, setName] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const line = syncLine(status);
  if (status?.disabled) return null;
  return (
    <Panel title="المزامنة بين الأجهزة">
      <div className="px-4 py-3.5 grid gap-3">
        <div>
          أي تعديل على الجهاز ده بيوصل للأجهزة التانية لوحده في ثواني. لو النت فاصل، التعديلات بتستنى وبتتبعت أول ما يرجع. الحالة: <b>{line.text}</b>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <Labeled label="اسم الجهاز ده (بيظهر للأجهزة التانية)">
            <input
              aria-label="اسم الجهاز"
              value={name ?? status?.deviceName ?? ""}
              onChange={(e) => setName(e.target.value)}
              className="font-[inherit] text-[13px] border border-line bg-surface text-fg rounded-md px-2 py-1 w-[180px]"
            />
          </Labeled>
          <Button
            disabled={name == null || !name.trim() || name === status?.deviceName}
            onClick={async () => {
              setStatus(await syncApi.setDeviceName(name!.trim()));
              setName(null);
            }}
          >
            احفظ الاسم
          </Button>
          <Button
            primary
            disabled={busy || !!status?.needsLogin}
            onClick={async () => {
              setBusy(true);
              setStatus(await syncApi.now());
              setBusy(false);
            }}
          >
            {busy ? "بيزامن..." : "زامن دلوقتي"}
          </Button>
        </div>
        {status && status.deferred > 0 && <div className="text-xs text-muted">فيه {status.deferred} تعديل مستني بيانات من جهاز تاني — هيتطبق لوحده.</div>}
      </div>
    </Panel>
  );
}

// The device password (optional): asked when MK-Tech opens and after "خروج".
// On this device only; forgetting it is fixed with the activation code.
function DevicePassword() {
  const [has, setHas] = useState<boolean | null>(null);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  useEffect(() => {
    shellApi.info().then((i) => setHas(!!i.hasPassword), () => {});
  }, []);
  if (has === null || !window.api) return null;

  async function save(remove: boolean) {
    if (!remove && next !== again) return setMsg({ ok: false, text: "الباسورد الجديد مش زي التأكيد" });
    const r = await shellApi.setPassword(current, remove ? "" : next);
    if (!r.ok) return setMsg({ ok: false, text: r.message ?? "حصلت مشكلة" });
    setHas(!remove);
    setCurrent("");
    setNext("");
    setAgain("");
    setMsg({ ok: true, text: remove ? "الباسورد اتشال" : "الباسورد اتحفظ — هيتطلب كل ما البرنامج يفتح وبعد الخروج" });
  }

  return (
    <Panel title="باسورد الدخول" hint={has ? "شغال" : "مقفول"}>
      <div className="px-4 py-3.5 grid gap-3">
        <div className="text-sm text-muted">
          لو حطيت باسورد، البرنامج هيطلبه كل ما يتفتح وكل ما تدوس "خروج". على الجهاز ده بس — ولو نسيته، كود التفعيل بيشيله.
        </div>
        <div className="flex flex-wrap items-end gap-2.5">
          {has && (
            <Labeled label="الباسورد الحالي">
              <TextInput type="password" value={current} onChange={(e) => setCurrent(e.target.value)} className="w-36" />
            </Labeled>
          )}
          <Labeled label={has ? "الباسورد الجديد" : "الباسورد"}>
            <TextInput type="password" value={next} onChange={(e) => setNext(e.target.value)} className="w-36" />
          </Labeled>
          <Labeled label="اكتبه تاني">
            <TextInput type="password" value={again} onChange={(e) => setAgain(e.target.value)} className="w-36" />
          </Labeled>
          <Button primary disabled={!next} onClick={() => save(false)}>
            {has ? "غيّر الباسورد" : "حط باسورد"}
          </Button>
          {has && (
            <Button danger disabled={!current} onClick={() => save(true)}>
              شيل الباسورد
            </Button>
          )}
        </div>
        {msg && <div className={`text-sm font-semibold ${msg.ok ? "text-in" : "text-out"}`}>{msg.text}</div>}
      </div>
    </Panel>
  );
}

function License() {
  const [s, setS] = useState<LicenseStatus | null>(null);
  useEffect(() => {
    licenseApi.status().then(setS);
  }, []);
  if (s?.state !== "active") return null;
  return (
    <Panel title="الترخيص">
      <div className="px-4 py-3.5 grid gap-1.5">
        <div>
          البرنامج متفعّل باسم: <b>{s.customer}</b>
        </div>
        <div className="text-sm text-muted">الاسم واللوجو اللي بيظهروا في البرنامج والطباعة جايين مع كود التفعيل.</div>
        {s.products.includes("operations") && (
          <div className="pt-1">
            <Button primary onClick={() => shellApi.open("operations")}>
              افتح برنامج التشغيل
            </Button>
          </div>
        )}
        <div>الاشتراك: {s.expiresAt ? <b className="num">لحد يوم {s.expiresAt}</b> : <b>مفتوح</b>}</div>
        <div className="text-xs text-muted">البرنامج بيتأكد من الترخيص لوحده كل ما يكون فيه نت، ويقدر يشتغل من غير نت لحد ١٤ يوم.</div>
      </div>
    </Panel>
  );
}

function Updates() {
  const [version, setVersion] = useState("");
  const [state, setState] = useState<string | null>(null);
  const [ready, setReady] = useState<{ url?: string } | null>(null);
  const [percent, setPercent] = useState<number | null>(null);
  const tablet = isTablet();
  useEffect(() => {
    appApi.version().then(setVersion);
    return appApi.onUpdateProgress((p) => setPercent(p.percent));
  }, []);
  return (
    <Panel title="التحديثات">
      <div className="px-4 py-3.5 grid gap-3">
        <div>
          النسخة الحالية: <b className="num">{version}</b> —{" "}
          {isWeb()
            ? "نسخة الويب بتتحدّث لوحدها: كل ما تفتحها بتفتح على آخر نسخة."
            : tablet
            ? "البرنامج بيدوّر على تحديث لوحده كل ما يتفتح، ولو فيه نسخة جديدة هيظهرلك شريط فوق تدوس عليه."
            : "البرنامج بيدوّر على تحديث لوحده وبينزّله في الخلفية، وبيتثبّت لما تقفل البرنامج وتفتحه تاني."}
        </div>
        {!isWeb() && (
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={async () => {
                setState("جاري البحث...");
                const r = await appApi.checkForUpdate();
                if (r.state === "downloaded") {
                  setReady({});
                  setState(`نسخة ${r.version} نزلت وجاهزة`);
                } else if (r.state === "apk") {
                  setReady({ url: r.url });
                  setState(`فيه نسخة جديدة ${r.version}`);
                } else if (r.state === "not-available") setState("عندك آخر نسخة");
                else if (r.state === "dev") setState("نسخة تجريبية — مفيش تحديثات");
                else setState(`مقدرناش نوصل للتحديثات (${r.message ?? ""})`);
              }}
            >
              تحقق من التحديثات
            </Button>
            {ready && (
              <Button
                primary
                onClick={async () => {
                  const r = await appApi.installUpdate(ready.url);
                  if (r && !r.ok && r.message) setState(r.message);
                }}
              >
                {tablet ? "نزّل وسطّب" : "ثبّت وأعد التشغيل"}
              </Button>
            )}
          </div>
        )}
        {state && <div className="text-sm font-semibold">{state}</div>}
        {percent != null && percent < 100 && <div className="text-sm num">بينزّل... {percent}٪</div>}
      </div>
    </Panel>
  );
}

export default function Settings() {
  const [v, setV] = useState<SettingsView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => {
    api.settings().then(setV, (e) => setError(e.message));
  }, []);
  useEffect(load, [load]);
  if (!v) return error ? <ErrorBox message={error} /> : <Loading />;
  return (
    <div className="grid gap-5">
      <PageHeader title="الإعدادات" />
      <Rates v={v} onSaved={load} />
      <div className="grid gap-3.5 items-start grid-cols-2 max-[1000px]:grid-cols-1">
        <Backups />
        <Updates />
        <SyncPanel />
        <License />
        <DevicePassword />
      </div>
    </div>
  );
}
