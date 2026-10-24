import { createContext, ReactNode, useContext, useState } from "react";
import Icon from "./Icon";

// Hiding the home page's numbers (like التشغيل): everything is blurred until
// you tap the eye next to it, and one eye on top shows / hides them all.
// Hidden is the default every time the page opens; printing always shows them.
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

function EyeButton({ id, className = "" }: { id: string; className?: string }) {
  const p = useContext(PrivacyContext);
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
      aria-label={hidden ? "اظهر الأرقام" : "اخفي الأرقام"}
      className={`no-print w-8 h-8 rounded-lg flex items-center justify-center text-muted bg-surface/80 border border-line hover:text-fg ${className}`}
    >
      <Icon name={hidden ? "eye" : "eyeOff"} className="w-4 h-4" />
    </button>
  );
}

export function EyeAllButton() {
  const p = useContext(PrivacyContext);
  if (!p) return null;
  return (
    <button
      type="button"
      onClick={p.toggleAll}
      className="inline-flex items-center gap-1.5 font-bold border border-line bg-surface text-fg rounded-lg px-2.5 py-1.5 hover:bg-surface-2"
    >
      <Icon name={p.allHidden ? "eye" : "eyeOff"} className="w-4 h-4" />
      {p.allHidden ? "اظهر الأرقام" : "اخفي الأرقام"}
    </button>
  );
}

/** A block that is blurred while hidden, with its own eye in the corner. */
export function Blurrable({ id, children, className = "" }: { id: string; children: ReactNode; className?: string }) {
  const p = useContext(PrivacyContext);
  const hidden = p?.isHidden(id) ?? false;
  return (
    <div className={`relative min-w-0 ${className}`}>
      <EyeButton id={id} className="absolute top-2.5 left-2.5 z-10" />
      <div className={hidden ? "blur-md select-none pointer-events-none transition print:blur-none" : "transition"} aria-hidden={hidden}>
        {children}
      </div>
    </div>
  );
}
