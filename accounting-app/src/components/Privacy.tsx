import { createContext, ReactNode, useContext, useState } from "react";
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

export function PrivacyProvider({ children }: { children: ReactNode }) {
  const [allHidden, setAllHidden] = useState(true);
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const isHidden = (id: string) => overrides[id] ?? allHidden;
  const toggle = (id: string) => setOverrides((o) => ({ ...o, [id]: !(o[id] ?? allHidden) }));
  const toggleAll = () => {
    setAllHidden((h) => !h);
    setOverrides({});
  };
  return <PrivacyContext.Provider value={{ isHidden, toggle, allHidden, toggleAll }}>{children}</PrivacyContext.Provider>;
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
