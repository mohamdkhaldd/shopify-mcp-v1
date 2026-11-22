import { useEffect, useRef, useState } from "react";

// شباك التأكيد ورسالة «اتسجل» بتوع البرنامج نفسه (بدل مربع المتصفح الرمادي).
// ask("تمسح الحركة دي؟") → Promise<boolean>، و toast("اتسجل").

type AskReq = { id: number; message: string; okLabel: string; danger: boolean; resolve: (v: boolean) => void };
type ToastReq = { id: number; text: string; tone: "ok" | "bad" };

let seq = 0;
let pushAsk: ((r: AskReq) => void) | null = null;
let pushToast: ((t: ToastReq) => void) | null = null;
/** آخر مرة اتأكد فيها حاجة — عشان تأكيد التسجيل/المسح ميتسألش مرتين ورا بعض */
export let lastAskedAt = 0;

const looksDanger = (m: string) => /تمسح|امسح|مسح|تخرج|تشيل|تصفير|مفيش رجوع/.test(m);

export function ask(message: string, opts: { okLabel?: string; danger?: boolean } = {}): Promise<boolean> {
  const danger = opts.danger ?? looksDanger(message);
  const okLabel = opts.okLabel ?? (danger ? (/تخرج/.test(message) ? "اخرج" : "امسح") : "موافق");
  if (!pushAsk) return Promise.resolve(window.confirm(message));
  return new Promise((resolve) =>
    pushAsk!({
      id: ++seq,
      message,
      okLabel,
      danger,
      resolve: (v) => {
        lastAskedAt = Date.now();
        resolve(v);
      },
    }),
  );
}

export function toast(text: string, tone: "ok" | "bad" = "ok") {
  pushToast?.({ id: ++seq, text, tone });
}

export function DialogHost() {
  const [queue, setQueue] = useState<AskReq[]>([]);
  const [toasts, setToasts] = useState<ToastReq[]>([]);
  const okRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    pushAsk = (r) => setQueue((q) => [...q, r]);
    pushToast = (t) => {
      setToasts((x) => [...x, t]);
      window.setTimeout(() => setToasts((x) => x.filter((y) => y.id !== t.id)), 3200);
    };
    return () => {
      pushAsk = null;
      pushToast = null;
    };
  }, []);

  const cur = queue[0];
  const answer = (v: boolean) => {
    cur?.resolve(v);
    setQueue((q) => q.slice(1));
  };
  useEffect(() => {
    if (!cur) return;
    okRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") answer(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cur?.id]);

  const [title, ...rest] = cur ? cur.message.split("\n") : [""];
  return (
    <>
      {cur && (
        <div className="no-print fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 px-4" onClick={() => answer(false)}>
          <div role="alertdialog" aria-modal="true" className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex gap-3">
              <div className={["w-10 h-10 rounded-full shrink-0 flex items-center justify-center", cur.danger ? "bg-rose-50 text-rose-600" : "bg-primary-light text-primary"].join(" ")}>
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                  {cur.danger ? <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /> : <path d="M12 8v5M12 16.5v.5M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z" />}
                </svg>
              </div>
              <div className="min-w-0">
                <div className="font-semibold text-slate-900 leading-snug">{title}</div>
                {rest.join("\n").trim() && <p className="mt-1 text-sm text-slate-500 whitespace-pre-line">{rest.join("\n").trim()}</p>}
              </div>
            </div>
            <div className="mt-5 flex gap-2 justify-end">
              <button onClick={() => answer(false)} className="h-10 px-4 rounded-[10px] text-sm text-slate-600 bg-slate-100 hover:bg-slate-200">
                إلغاء
              </button>
              <button
                ref={okRef}
                onClick={() => answer(true)}
                className={["h-10 px-5 rounded-[10px] text-sm font-semibold text-white", cur.danger ? "bg-rose-600 hover:bg-rose-700" : "bg-primary hover:bg-primary-dark"].join(" ")}
              >
                {cur.okLabel}
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="no-print fixed bottom-5 inset-x-0 z-[70] flex flex-col items-center gap-2 pointer-events-none px-4" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto flex items-center gap-2 rounded-full bg-slate-900 text-white text-sm px-4 py-2.5 shadow-lg">
            <span className={["w-5 h-5 rounded-full flex items-center justify-center text-[11px]", t.tone === "ok" ? "bg-emerald-500" : "bg-rose-500"].join(" ")}>{t.tone === "ok" ? "✓" : "!"}</span>
            {t.text}
          </div>
        ))}
      </div>
    </>
  );
}
