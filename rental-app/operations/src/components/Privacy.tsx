import { createContext, FormEvent, ReactNode, useContext, useState } from "react";
import { shell } from "../shell";
import ForgotPassword from "./ForgotPassword";
import Icon from "./Icon";

// إخفاء أرقام الصفحة الرئيسية: كل حاجة عليها بلور لحد ما تدوس العين جنبها،
// وعين فوق بتظهر/تخفي الكل. الإخفاء هو الافتراضي كل ما الصفحة تتفتح.
interface PrivacyState {
  isHidden: (id: string) => boolean;
  toggle: (id: string) => void;
  allHidden: boolean;
  toggleAll: () => void;
}

const PrivacyContext = createContext<PrivacyState | null>(null);

// إظهار الأرقام محتاج باسورد الشركة — كل مرة

export function PrivacyProvider({ children }: { children: ReactNode }) {
  const [allHidden, setAllHidden] = useState(true);
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const [asking, setAsking] = useState<null | (() => void)>(null);
  const isHidden = (id: string) => overrides[id] ?? allHidden;
  // أي إظهار بيعدّي على الباسورد الأول
  const reveal = (then: () => void) => setAsking(() => then);
  const toggle = (id: string) => {
    const showing = overrides[id] ?? allHidden;
    const flip = () => setOverrides((o) => ({ ...o, [id]: !(o[id] ?? allHidden) }));
    if (showing) reveal(flip);
    else flip();
  };
  const toggleAll = () => {
    const flip = () => {
      setAllHidden((h) => !h);
      setOverrides({});
    };
    if (allHidden) reveal(flip);
    else flip();
  };
  return (
    <PrivacyContext.Provider value={{ isHidden, toggle, allHidden, toggleAll }}>
      {children}
      {asking && (
        <RevealPassword
          onClose={() => setAsking(null)}
          onOk={() => {
            const then = asking;
            setAsking(null);
            then();
          }}
        />
      )}
    </PrivacyContext.Provider>
  );
}

function RevealPassword({ onOk, onClose }: { onOk: () => void; onClose: () => void }) {
  const [pw, setPw] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const r = await shell.checkPassword(pw).catch(() => ({ ok: false, message: "مفيش نت — جرّب تاني" }) as { ok: boolean; message?: string; noPassword?: boolean });
    setBusy(false);
    // الشركة لسه معملتش باسورد: الأرقام بتظهر عادي (الإعدادات ← باسورد الشركة)
    if (r.ok || r.noPassword) onOk();
    else setError(r.message || "الباسورد غلط");
  }
  return (
    <div className="no-print fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4" onClick={onClose}>
      <form onSubmit={submit} onClick={(e) => e.stopPropagation()} className="bg-white rounded-card shadow-xl p-6 w-full max-w-xs space-y-3 text-center">
        <div className="mx-auto w-12 h-12 rounded-full bg-primary-light text-primary flex items-center justify-center"><Icon name="lock" className="w-6 h-6" /></div>
        <div className="font-bold text-slate-800">اكتب باسورد الشركة عشان تظهر الأرقام</div>
        <input type="password" autoFocus value={pw} onChange={(e) => setPw(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-center" />
        {error && <div className="text-xs font-semibold text-rose-600">{error}</div>}
        <button type="submit" disabled={busy} className="w-full bg-primary text-white rounded-lg py-2 text-sm font-bold disabled:opacity-50">
          {busy ? "بنتأكد…" : "اظهر"}
        </button>
        <ForgotPassword />
      </form>
    </div>
  );
}

export function usePrivacy() {
  return useContext(PrivacyContext);
}

export function EyeButton({ id, className = "" }: { id: string; className?: string }) {
  const p = usePrivacy();
  if (!p) return null;
  const hidden = p.isHidden(id);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        p.toggle(id);
      }}
      title={hidden ? "اظهر" : "اخفي"}
      className={`no-print w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 hover:text-primary ${className}`}
    >
      <Icon name={hidden ? "eye" : "eyeOff"} className="w-4 h-4" />
    </button>
  );
}

export function EyeAllButton() {
  const p = usePrivacy();
  if (!p) return null;
  return (
    <button
      type="button"
      onClick={p.toggleAll}
      className="no-print flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold bg-white text-slate-600 hover:bg-primary-light hover:text-primary-dark shadow-card"
    >
      <Icon name={p.allHidden ? "eye" : "eyeOff"} className="w-4 h-4" />
      {p.allHidden ? "اظهر كل الأرقام" : "اخفي كل الأرقام"}
    </button>
  );
}

// بلوك عليه بلور لما يكون مخفي، وعين في ركنه.
export function Blurrable({ id, children, className = "" }: { id: string; children: ReactNode; className?: string }) {
  const p = usePrivacy();
  const hidden = p?.isHidden(id) ?? false;
  return (
    <div className={`relative ${className}`}>
      <EyeButton id={id} className="absolute top-3 left-3 z-10 bg-white/80" />
      <div className={hidden ? "blur-md select-none pointer-events-none transition" : "transition"} aria-hidden={hidden}>
        {children}
      </div>
    </div>
  );
}

// رقم واحد عليه بلور.
export function Secret({ id, children }: { id: string; children: ReactNode }) {
  const p = usePrivacy();
  const hidden = p?.isHidden(id) ?? false;
  return <span className={hidden ? "blur-md select-none" : ""}>{children}</span>;
}
