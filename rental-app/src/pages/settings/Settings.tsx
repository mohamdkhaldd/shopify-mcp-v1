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

/** الاستقطاع من المنبع: الشركة بتخصم النسبة من اليومية قبل الـ ١٤٪ (بدل الـ ٥٪ على الهامش). */
function Withholding({ v, onSaved }: { v: SettingsView; onSaved: () => void }) {
  const [from, setFrom] = useState(nextMonthStart());
  const [pct, setPct] = useState(String((v.current.wht ?? 300) / 100));
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  return (
    <Panel title="الاستقطاع من المنبع (٣٪)" hint="الشركة بتخصمه من اليومية قبل ما تزود الـ ١٤٪ وبتدفعه للضرايب عننا">
      <div className="px-4 py-3 text-sm leading-[1.9] border-b border-line">
        مثال: يومية ١٠٠٠ ← الشركة تخصم ٣٪ (٣٠) وتزود ١٤٪ (١٤٠) وتدفع <b>١١١٠</b>. الـ ٣٠ بتطلع من ربحنا، وصاحب المعدة بياخد يوميته كاملة.
        <br />
        دلوقتي: <b>{percentFromBp(v.current.wht ?? 0)} استقطاع</b>
        {v.withholding.filter((w) => w.effectiveFrom > "2000-01-01").length > 0 && (
          <span className="text-muted"> — {v.withholding.map((w) => `${percentFromBp(w.bp)} ${w.effectiveFrom === "2000-01-01" ? "من الأول" : `من ${w.effectiveFrom}`}`).join("، ")}</span>
        )}
      </div>
      <div className="flex flex-wrap items-end gap-2.5 px-4 py-3 bg-surface-2">
        <Labeled label="يبتدي من يوم">
          <TextInput type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-36" />
        </Labeled>
        <Labeled label="النسبة ٪">
          <TextInput value={pct} onChange={(e) => setPct(e.target.value)} className="w-20" inputMode="decimal" />
        </Labeled>
        <Button
          primary
          onClick={async () => {
            setError(null);
            setOk(false);
            try {
              await api.setWithholding(from, toBp(pct));
              setOk(true);
              onSaved();
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          حفظ
        </Button>
      </div>
      {error && <ErrorBox message={error} />}
      {ok && <div className="rounded-card border border-in bg-in-soft mx-4 my-2 px-4 py-2 font-semibold text-sm">اتسجل — الشهور اللي من التاريخ ده اتحسبت تاني.</div>}
    </Panel>
  );
}

function Rates({ v, onSaved }: { v: SettingsView; onSaved: () => void }) {
  const [from, setFrom] = useState(nextMonthStart());
  const [vat, setVat] = useState(String(v.current.vat / 100));
  const tax5 = String(v.current.tax5 / 100); // الـ ٥٪ اتلغت — بتتبعت زي ما هي
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
      <div className="grid grid-cols-3 max-[800px]:grid-cols-2 border-b border-line">
        {[
          ["ضريبة القيمة المضافة", v.current.vat],
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
              <th className="n">الإدارة</th>
              <th className="n">المستثمرين</th>
            </tr>
          </thead>
          <tbody>
            {v.history.map((h) => (
              <tr key={h.effectiveFrom}>
                <td>{h.effectiveFrom === "2000-01-01" ? "من الأول" : h.effectiveFrom}</td>
                <td className="n">{h.vat != null ? percentFromBp(h.vat) : "—"}</td>
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

// The company password (optional, kept on the server): asked on every device
// of the company when MK-Tech opens, after "قفل", and when the code is entered
// on a new device. Changing it needs internet.
/** اسم الشريك اللي بيستخدم الجهاز ده: بيتكتب على كل تعديل وكل رسالة للمساعد. */
function MyName() {
  const [name, setName] = useState<string | null | undefined>(undefined);
  const [draft, setDraft] = useState("");
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    api.me().then((n) => {
      setName(n);
      setDraft(n ?? "");
    }, () => setName(null));
  }, []);
  if (name === undefined) return null;
  return (
    <Panel title="انت مين من الشركاء؟" hint={name ?? "مش متسجل"}>
      <div className="px-4 py-3.5 grid gap-3">
        <div className="text-sm text-muted">اسمك على الجهاز ده: بيتكتب على كل تعديل تعمله (سجل التعديلات ← كل الشركاء) وكل رسالة للمساعد، و«دفعت من جيبي» بتتسجل عليك. كل شريك يكتب اسمه على جهازه.</div>
        <div className="flex gap-2 items-end">
          <Labeled label="الاسم">
            <TextInput value={draft} onChange={(e) => (setDraft(e.target.value), setSaved(false))} className="w-56" />
          </Labeled>
          <Button
            primary
            disabled={!draft.trim() || draft.trim() === name}
            onClick={() =>
              api.setMe(draft).then((n) => {
                setName(n);
                setSaved(true);
              })
            }
          >
            حفظ
          </Button>
          {saved && <span className="text-sm text-in font-bold self-center">اتحفظ</span>}
        </div>
      </div>
    </Panel>
  );
}

/** اللي المساعد اتعلمه من تصحيح الشركاء — بيمشي عليه في كل سؤال، وتقدر تمسح أي درس. */
function Lessons() {
  const [list, setList] = useState<{ id: number; at: string; who: string | null; text: string }[] | null>(null);
  const load = () => api.lessons().then(setList, () => setList([]));
  useEffect(() => {
    load();
  }, []);
  if (!list) return null;
  return (
    <Panel title="اللي المساعد اتعلمه" hint={list.length ? `${list.length} درس` : "لسه مفيش"}>
      <div className="px-4 py-3.5 grid gap-2">
        <div className="text-sm text-muted">لما تصحّح المساعد («لا، أنا قصدي كذا») أو تقوله «افتكر إن…» بيحفظها هنا ويمشي عليها كل مرة بعد كده — على كل أجهزة الشركة.</div>
        {list.map((l) => (
          <div key={l.id} className="flex items-start gap-3 rounded-xl border border-line px-3 py-2">
            <div className="flex-1">
              <div>{l.text}</div>
              <div className="text-xs text-muted">
                {l.who ? `${l.who} · ` : ""}
                {new Date(l.at).toLocaleDateString("ar-EG")}
              </div>
            </div>
            <Button
              danger
              onClick={async () => {
                if (!window.confirm("تمسح الدرس ده؟ المساعد مش هيمشي عليه تاني.")) return;
                await api.lessonDelete(l.id);
                load();
              }}
            >
              امسح
            </Button>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function CompanyPassword() {
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
    setMsg({ ok: true, text: remove ? "الباسورد اتشال" : "الباسورد اتحفظ لكل أجهزة الشركة" });
  }

  return (
    <Panel title="باسورد الشركة" hint={has ? "شغال" : "مقفول"}>
      <div className="px-4 py-3.5 grid gap-3">
        <div className="text-sm text-muted">
          باسورد واحد لكل أجهزة الشركة: بيتطلب لما البرنامج يفتح، وبعد ما تدوس "قفل"، ولما حد يدخل الكود على جهاز جديد. تغييره محتاج نت — ولو اتنسى، MK-Tech تمسحه.
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

/** كروت الباقات بأسعارها في الشهر — الباقة اللي العميل عليها خضرا وفيها باقي كام يوم. */
function PlanCards({ current, prices, expiresAt }: { current: string | null; prices: SettingsView["plan"]["prices"]; expiresAt: string | null }) {
  const left = expiresAt ? Math.ceil((new Date(`${expiresAt.slice(0, 10)}T23:59:59`).getTime() - Date.now()) / 86400000) : null;
  return (
    <div className="pt-2">
      <div className="text-sm font-semibold mb-2">الباقات (الاشتراك بالشهر)</div>
      <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
        {prices.map((p) => {
          const on = p.key === current;
          return (
            <div key={p.key} className={`rounded-xl border-2 p-3 text-center ${on ? "border-emerald-500 bg-emerald-50 text-emerald-900" : "border-slate-200"}`}>
              {on && <div className="text-xs font-bold text-emerald-700 mb-1">✓ باقتك</div>}
              <div className="text-sm font-semibold">{p.label.replace(/^باقة /, "")}</div>
              <div className="text-xl font-bold num mt-1">{p.pricePerMonth.toLocaleString("en-US")} ج</div>
              <div className="text-xs text-muted">في الشهر</div>
              {on && (
                <div className={`text-xs font-semibold mt-1.5 ${left != null && left <= 3 ? "text-out" : "text-emerald-700"}`}>
                  {left == null ? "من غير ميعاد انتهاء" : left > 0 ? `باقي ${left} يوم` : "الاشتراك خلص"}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function License({ plan }: { plan: SettingsView["plan"] }) {
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
        {(plan.label || plan.limit != null) && (
          <div>
            الباقة: <b>{plan.label ?? "—"}</b> — المعدات:{" "}
            <b className={plan.limit != null && plan.used >= plan.limit ? "text-out" : ""}>
              {plan.used}
              {plan.limit != null ? ` من ${plan.limit}` : " (من غير حد)"}
            </b>
          </div>
        )}
        {plan.limit != null && plan.used >= plan.limit && (
          <div className="text-sm text-out font-semibold">الباقة خلصت — عشان تضيف معدة لازم ترقّي لباقة أكبر. كلّم MK-Tech.</div>
        )}
        <PlanCards current={plan.key ?? s.plan ?? null} prices={plan.prices} expiresAt={s.expiresAt} />
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
      <Withholding v={v} onSaved={load} />
      <div className="grid gap-3.5 items-start grid-cols-2 max-[1000px]:grid-cols-1">
        <Backups />
        <Updates />
        <SyncPanel />
        <License plan={v.plan} />
        <MyName />
        <Lessons />
        <CompanyPassword />
      </div>
    </div>
  );
}
