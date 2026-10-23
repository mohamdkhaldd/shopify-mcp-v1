import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from "react";
import { api, CHANGED_EVENT } from "../api/client";

// Ported from the old app: a 12-second "تراجع (Ctrl+Z)" bar after a change.
interface UndoAction {
  id: number;
  label: string;
  undo: () => Promise<void>;
}

const UndoContext = createContext<{ pushUndo: (label: string, undo: () => Promise<void>) => void } | null>(null);
const AUTO_DISMISS_MS = 12000;

export function UndoProvider({ children }: { children: ReactNode }) {
  const [action, setAction] = useState<UndoAction | null>(null);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const actionRef = useRef<UndoAction | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nextId = useRef(1);

  const clear = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };

  const pushUndo = useCallback((label: string, undo: () => Promise<void>) => {
    clear();
    const next = { id: nextId.current++, label, undo };
    actionRef.current = next;
    setAction(next);
    timer.current = setTimeout(() => {
      if (actionRef.current?.id === next.id) {
        actionRef.current = null;
        setAction(null);
      }
    }, AUTO_DISMISS_MS);
  }, []);

  const performUndo = useCallback(async () => {
    const cur = actionRef.current;
    if (!cur) return;
    actionRef.current = null;
    clear();
    setAction(null);
    setBusy(true);
    try {
      await cur.undo();
    } catch (e) {
      setFailure((e as Error).message);
      setTimeout(() => setFailure(null), 5000);
    } finally {
      setBusy(false);
    }
  }, []);

  // every save anywhere in the app offers "تراجع" for a few seconds
  useEffect(() => {
    const onChanged = (e: Event) => {
      const { actionId, label, undoable } = (e as CustomEvent<{ actionId: string; label: string; undoable: boolean }>).detail;
      if (!undoable || label.startsWith("تراجع")) return;
      pushUndo(`اتحفظ: ${label}`, async () => {
        await api.undo(actionId);
      });
    };
    window.addEventListener(CHANGED_EVENT, onChanged);
    return () => window.removeEventListener(CHANGED_EVENT, onChanged);
  }, [pushUndo]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== "z") return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      e.preventDefault();
      performUndo();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [performUndo]);

  useEffect(() => () => clear(), []);

  return (
    <UndoContext.Provider value={{ pushUndo }}>
      {children}
      {failure && (
        <div className="no-print fixed bottom-5 inset-x-0 z-50 flex justify-center px-4">
          <div className="bg-out text-white text-sm rounded-lg shadow-lg px-4 py-2.5">{failure}</div>
        </div>
      )}
      {action && (
        <div className="no-print fixed bottom-5 inset-x-0 z-50 flex justify-center px-4">
          <div className="flex items-center gap-3 bg-ink text-white text-sm rounded-lg shadow-lg px-4 py-2.5">
            <span>{action.label}</span>
            <button onClick={performUndo} disabled={busy} className="shrink-0 bg-white/10 border border-white/20 rounded-md px-3 py-1 text-xs font-semibold hover:bg-white/20 disabled:opacity-50">
              {busy ? "جاري التراجع..." : "تراجع (Ctrl+Z)"}
            </button>
          </div>
        </div>
      )}
    </UndoContext.Provider>
  );
}

export function useUndo() {
  const ctx = useContext(UndoContext);
  if (!ctx) throw new Error("useUndo must be used inside UndoProvider");
  return ctx;
}
