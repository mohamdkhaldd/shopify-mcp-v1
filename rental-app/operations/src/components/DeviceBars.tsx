import { useEffect, useState } from "react";
import { appApi, syncApi } from "../api/client";
import { AppUpdateStatus } from "../api/types";

// شريط باسورد المزامنة: بيظهر لما الجهاز لسه مدخلش (أول مرة، أو بعد تغيير
// الباسورد). الباسورد بيتكتب مرة واحدة والجهاز بيفضل فاكر الدخول.
// MK-Tech: the sync login comes with the activation code (no password to
// type); this only shows while the device is still signing in.
export function SyncLoginBar() {
  const [needsLogin, setNeedsLogin] = useState(false);

  useEffect(() => {
    const load = () => syncApi.status().then((s) => setNeedsLogin(!!s.needsLogin));
    load();
    const timer = setInterval(load, 5000);
    return () => clearInterval(timer);
  }, []);

  if (!needsLogin) return null;
  return (
    <div className="no-print mb-4 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm font-semibold text-amber-900">
      المزامنة بتدخل على حساب الشركة… لو فضلت كده، اتأكد إن النت شغال.
    </div>
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
