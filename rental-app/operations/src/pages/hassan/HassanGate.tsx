import { FormEvent, ReactNode, useEffect, useState } from "react";
import Icon from "../../components/Icon";
import { installmentsApi } from "../../api/client";
import { shell } from "../../shell";
import { person } from "../../person";
import ForgotPassword from "../../components/ForgotPassword";

// صفحة صاحب الكوميشن كلها مقفولة بباسورد (مش الأقساط بس). بتتقفل تاني لما
// تسيب الصفحة أو تدوس «اقفل دلوقتي». نسيت الباسورد؟ ← باسورد الشركة بيفتحه
// وتعمل واحد جديد.
export default function HassanGate({ children }: { children: (lock: () => void) => ReactNode }) {
  const [locked, setLocked] = useState<boolean | null>(null);
  const [open, setOpen] = useState(false);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [forgot, setForgot] = useState(false);
  const [company, setCompany] = useState("");
  const [newPin, setNewPin] = useState("");
  const [busy, setBusy] = useState(false);

  const load = () => installmentsApi.lockStatus().then((s) => setLocked(s.locked));
  useEffect(() => {
    load();
    const onChange = () => load();
    window.addEventListener("installments-lock-changed", onChange);
    return () => window.removeEventListener("installments-lock-changed", onChange);
  }, []);

  async function unlock(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (await installmentsApi.checkLock(pin)) {
      setOpen(true);
      setPin("");
    } else setError("الباسورد غلط");
  }

  async function reset(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (newPin && newPin.length < 4) return setError("الباسورد الجديد 4 أرقام/حروف على الأقل");
    setBusy(true);
    const r = await shell.checkPassword(company).catch(() => ({ ok: false, message: "مفيش نت — جرّب تاني" }) as { ok: boolean; message?: string; noPassword?: boolean });
    setBusy(false);
    if (!r.ok) {
      return setError(
        "noPassword" in r && r.noPassword
          ? "الشركة معندهاش باسورد — اعمله الأول من الإعدادات (باسورد الشركة)، أو كلّم MK-Tech"
          : r.message || "باسورد الشركة غلط",
      );
    }
    await installmentsApi.resetLock(newPin || null);
    window.dispatchEvent(new Event("installments-lock-changed"));
    setForgot(false);
    setCompany("");
    setNewPin("");
    setOpen(true);
  }

  if (locked == null) return <div className="text-sm text-slate-400">جاري التحميل...</div>;
  if (!locked || open) return <>{children(() => setOpen(false))}</>;

  const inputCls = "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-center";
  return (
    <div className="relative min-h-[60vh]">
      {/* الصفحة متغطية — البيانات نفسها مبتتحملش لحد ما الباسورد يتكتب */}
      <div className="blur-md select-none pointer-events-none space-y-4" aria-hidden>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white rounded-card shadow-card h-24" />
          <div className="bg-white rounded-card shadow-card h-24" />
        </div>
        <div className="bg-white rounded-card shadow-card h-40" />
        <div className="bg-white rounded-card shadow-card h-40" />
      </div>
      <div className="absolute inset-0 flex items-start justify-center pt-12 px-3">
        {!forgot ? (
          <form onSubmit={unlock} className="bg-white rounded-card shadow-card p-6 w-full max-w-xs space-y-3 text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-primary-light text-primary flex items-center justify-center"><Icon name="lock" className="w-6 h-6" /></div>
            <div className="font-bold text-slate-800">صفحة {person()} مقفولة</div>
            <input type="password" autoFocus value={pin} onChange={(e) => setPin(e.target.value)} placeholder="اكتب الباسورد" className={inputCls} />
            {error && <div className="text-xs font-semibold text-rose-600">{error}</div>}
            <button type="submit" className="w-full bg-primary text-white rounded-lg py-2 text-sm font-bold">
              افتح
            </button>
            <button type="button" onClick={() => { setForgot(true); setError(""); }} className="text-xs font-semibold text-slate-500 hover:text-primary-dark underline">
              نسيت الباسورد؟
            </button>
          </form>
        ) : (
          <form onSubmit={reset} className="bg-white rounded-card shadow-card p-6 w-full max-w-xs space-y-3 text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-primary-light text-primary flex items-center justify-center"><Icon name="lock" className="w-6 h-6" /></div>
            <div className="font-bold text-slate-800">نسيت الباسورد</div>
            <p className="text-xs text-slate-500">باسورد الشركة (اللي بتفتح بيه البرنامج) بيفتح الصفحة دي. اكتبه، واكتب باسورد جديد للصفحة — أو سيبه فاضي لو مش عايز باسورد.</p>
            <input type="password" autoFocus value={company} onChange={(e) => setCompany(e.target.value)} placeholder="باسورد الشركة" className={inputCls} />
            <input type="password" value={newPin} onChange={(e) => setNewPin(e.target.value)} placeholder="الباسورد الجديد للصفحة" className={inputCls} />
            {error && <div className="text-xs font-semibold text-rose-600">{error}</div>}
            <button type="submit" disabled={busy || !company} className="w-full bg-primary text-white rounded-lg py-2 text-sm font-bold disabled:opacity-50">
              {busy ? "بنتأكد…" : "افتح وغيّر الباسورد"}
            </button>
            <div className="border-t border-slate-100 pt-2 space-y-1">
              <div className="text-[11px] text-slate-400">ناسي باسورد الشركة كمان؟</div>
              <ForgotPassword what="hassan" />
            </div>
            <button type="button" onClick={() => { setForgot(false); setError(""); }} className="text-xs font-semibold text-slate-500 underline">
              رجوع
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
