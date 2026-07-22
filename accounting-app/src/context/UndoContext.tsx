import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from "react";

interface UndoAction {
  id: number;
  label: string;
  undo: () => Promise<void>;
}

interface UndoContextValue {
  pushUndo: (label: string, undo: () => Promise<void>) => void;
}

const UndoContext = createContext<UndoContextValue | null>(null);

const AUTO_DISMISS_MS = 12000;

export function UndoProvider({ children }: { children: ReactNode }) {
  const [action, setAction] = useState<UndoAction | null>(null);
  const [busy, setBusy] = useState(false);
  const actionRef = useRef<UndoAction | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nextId = useRef(1);

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const pushUndo = useCallback((label: string, undo: () => Promise<void>) => {
    clearTimer();
    const id = nextId.current++;
    const next = { id, label, undo };
    actionRef.current = next;
    setAction(next);
    timerRef.current = setTimeout(() => {
      if (actionRef.current?.id === id) {
        actionRef.current = null;
        setAction(null);
      }
    }, AUTO_DISMISS_MS);
  }, []);

  const performUndo = useCallback(async () => {
    const current = actionRef.current;
    if (!current) return;
    actionRef.current = null;
    clearTimer();
    setAction(null);
    setBusy(true);
    try {
      await current.undo();
    } catch {
      // بيتجاهل فشل التراجع بهدوء — الحاجة أصلاً اتمسحت فعليًا لو فشل
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== "z") return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      e.preventDefault();
      performUndo();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [performUndo]);

  useEffect(() => () => clearTimer(), []);

  return (
    <UndoContext.Provider value={{ pushUndo }}>
      {children}
      {action && (
        <div className="no-print fixed bottom-5 inset-x-0 z-50 flex justify-center px-4">
          <div className="flex items-center gap-3 bg-slate-800 text-white text-sm rounded-xl shadow-lg px-4 py-2.5">
            <span>{action.label}</span>
            <button
              onClick={performUndo}
              disabled={busy}
              className="shrink-0 bg-white/10 border border-white/20 rounded-lg px-3 py-1 text-xs font-semibold hover:bg-white/20 disabled:opacity-50"
            >
              {busy ? "جاري التراجع..." : "تراجع (Ctrl+Z)"}
            </button>
          </div>
        </div>
      )}
    </UndoContext.Provider>
  );
}

export function useUndo(): UndoContextValue {
  const ctx = useContext(UndoContext);
  if (!ctx) throw new Error("useUndo must be used inside UndoProvider");
  return ctx;
}
