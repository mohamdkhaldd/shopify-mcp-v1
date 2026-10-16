import { FormEvent, useEffect, useState } from "react";
import { appApi, syncApi } from "../api/client";
import { AppUpdateStatus } from "../api/types";

// شريط باسورد المزامنة: بيظهر لما الجهاز لسه مدخلش (أول مرة، أو بعد تغيير
// الباسورد). الباسورد بيتكتب مرة واحدة والجهاز بيفضل فاكر الدخول.
export function SyncLoginBar() {
  const [needsLogin, setNeedsLogin] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const load = () => syncApi.status().then((s) => setNeedsLogin(!!s.needsLogin));
    load();
    const timer = setInterval(load, 5000);
    return () => clearInterval(timer);
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!password) return;
    setBusy(true);
    setError("");
    try {
      const s = await syncApi.login(password);
      setNeedsLogin(!!s.needsLogin);
      setPassword("");
    } catch (err) {
      setError(String((err as Error)?.message ?? err).replace(/^Error invoking remote method '[^']+': (Error: )?/, ""));
    } finally {
      setBusy(false);
    }
  }

  if (!needsLogin) return null;
  return (
    <form
      onSubmit={handleSubmit}
      className="no-print mb-4 flex flex-wrap items-center gap-2 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-900"
    >
      <span className="font-semibold">🔒 المزامنة واقفة — اكتب باسورد المزامنة مرة واحدة على الجهاز ده:</span>
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="rounded-lg border border-amber-300 px-2 py-1.5 text-sm bg-white"
        dir="ltr"
        autoComplete="current-password"
      />
      <button
        type="submit"
        disabled={busy || !password}
        className="rounded-lg bg-amber-600 text-white px-3 py-1.5 text-xs font-bold hover:bg-amber-700 disabled:opacity-50"
      >
        {busy ? "جاري الدخول..." : "دخول"}
      </button>
      {error && <span className="text-rose-600 font-semibold">{error}</span>}
    </form>
  );
}

// زرار تحديث التابلت: بينزّل النسخة الجديدة جوه البرنامج ويفتح شاشة التثبيت.
export function ApkUpdateButton({ update }: { update: AppUpdateStatus }) {
  const [percent, setPercent] = useState<number | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => appApi.onUpdateProgress((info) => setPercent(info.percent)), []);

  async function handleInstall() {
    setMessage("");
    setPercent(0);
    try {
      await appApi.installUpdate(update.url);
      setMessage("اتحمّل — دوس \"تحديث\" في الشاشة اللي فتحت.");
    } catch (err) {
      const text = String((err as Error)?.message ?? err);
      setMessage(
        text.includes("NEEDS_PERMISSION")
          ? "أول مرة بس: فعّل \"السماح من المصدر ده\" في الشاشة اللي فتحت، وارجع دوس الزرار تاني."
          : "التحميل وقف — اتأكد من النت ودوس تاني."
      );
    } finally {
      setPercent(null);
    }
  }

  return (
    <div className="space-y-1">
      <button
        onClick={handleInstall}
        disabled={percent !== null}
        className="bg-primary text-white rounded-xl px-4 py-2 text-sm font-semibold hover:bg-primary-dark disabled:opacity-60"
      >
        {percent !== null ? `جاري التحميل... ${percent}%` : `حمّل وحدّث (نسخة ${update.version})`}
      </button>
      {message && <p className="text-xs text-slate-600">{message}</p>}
      <p className="text-[11px] text-slate-400">التحديث بيتسطب فوق النسخة الحالية — بياناتك مش هتتمسح ومش محتاج تمسح البرنامج.</p>
    </div>
  );
}

// التابلت بيشيك على التحديث لوحده كل ما يفتح وكل 6 ساعات، ولو فيه نسخة جديدة
// بيسأل "تحمّلها؟". (اللاب بيحدّث نفسه لوحده من غير ما يسأل.)
export function TabletUpdatePrompt() {
  const [update, setUpdate] = useState<AppUpdateStatus | null>(null);
  const [dismissed, setDismissed] = useState("");

  useEffect(() => {
    const check = () =>
      appApi
        .checkForUpdate()
        .then((r) => r.state === "apk" && r.url && setUpdate(r))
        .catch(() => {});
    const first = setTimeout(check, 5000);
    const timer = setInterval(check, 6 * 60 * 60 * 1000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, []);

  if (!update || dismissed === update.version) return null;
  return (
    <div className="no-print fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" dir="rtl">
      <div className="bg-white rounded-card shadow-card p-6 max-w-sm w-full space-y-3">
        <div className="font-extrabold text-slate-900 text-lg">فيه تحديث جديد 🎉</div>
        <p className="text-sm text-slate-600">نسخة {update.version} نزلت. تحمّلها دلوقتي؟</p>
        <ApkUpdateButton update={update} />
        <button onClick={() => setDismissed(update.version ?? "")} className="text-xs text-slate-500 font-semibold">
          بعدين
        </button>
      </div>
    </div>
  );
}
