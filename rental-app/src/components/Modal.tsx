import { ReactNode, useEffect } from "react";

export default function Modal({ title, onClose, children, footer }: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="no-print fixed inset-0 z-50 flex items-center justify-center bg-ink/50 px-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" className="bg-surface border border-line rounded-card shadow-xl max-w-xl w-full max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-line">
          <h3 className="m-0 font-display font-bold">{title}</h3>
          <button onClick={onClose} aria-label="إغلاق" className="text-muted hover:text-fg text-2xl leading-none w-8 h-8">
            ×
          </button>
        </div>
        <div className="px-5 py-4 overflow-y-auto">{children}</div>
        {footer && <div className="px-5 py-3 border-t border-line flex justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}
