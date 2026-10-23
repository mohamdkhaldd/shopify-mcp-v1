import { ReactNode } from "react";

export function PageHeader({ title, subtitle, children }: { title: string; subtitle?: string; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="m-0 font-display text-2xl font-bold text-fg">{title}</h1>
        {subtitle && <p className="m-0 mt-0.5 text-muted">{subtitle}</p>}
      </div>
      {children && <div className="no-print flex flex-wrap gap-2">{children}</div>}
    </div>
  );
}

export function Panel({ title, hint, actions, children, className = "" }: { title?: ReactNode; hint?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`bg-surface border border-line rounded-card min-w-0 ${className}`}>
      {(title || actions) && (
        <div className="flex flex-wrap items-center justify-between gap-2.5 px-4 py-3.5 border-b border-line">
          <h2 className="m-0 font-display text-[15px] font-bold">{title}</h2>
          {hint && <span className="text-xs font-semibold text-muted">{hint}</span>}
          {actions && <div className="no-print flex gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

export function Note({ children }: { children: ReactNode }) {
  return <div className="text-xs text-muted px-4 py-2.5 border-t border-line">{children}</div>;
}

type Tone = "plain" | "hero" | "tax" | "good";

export function Kpi({ label, value, sub, tone = "plain" }: { label: string; value: ReactNode; sub?: ReactNode; tone?: Tone }) {
  const box = tone === "hero" ? "bg-hero border-hero text-white" : "bg-surface border-line";
  const val = tone === "hero" ? "text-amber" : tone === "tax" ? "text-tax" : tone === "good" ? "text-in" : "text-fg";
  return (
    <div className={`border rounded-card px-4 py-3.5 grid gap-0.5 ${box}`}>
      <span className={`text-[13px] font-semibold ${tone === "hero" ? "text-side" : "text-muted"}`}>{label}</span>
      <span className={`text-[22px] font-extrabold num ${val}`}>{value}</span>
      {sub && <span className={`text-xs ${tone === "hero" ? "text-side" : "text-muted"}`}>{sub}</span>}
    </div>
  );
}

export function Money({ pt, className = "" }: { pt: string; className?: string }) {
  return (
    <>
      <span className={className}>{pt}</span>
      <span className="text-[0.6em] font-bold ms-1 opacity-70">ج</span>
    </>
  );
}

export function Button({ children, onClick, primary, danger, disabled, title }: { children: ReactNode; onClick?: () => void; primary?: boolean; danger?: boolean; disabled?: boolean; title?: string }) {
  const style = primary
    ? "bg-ink border-ink text-white dark:bg-amber dark:border-amber dark:text-[#1a1406]"
    : danger
      ? "bg-surface border-out-soft text-out hover:border-out"
      : "bg-surface border-line text-fg hover:border-amber";
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`inline-flex items-center gap-1.5 rounded-lg border px-3.5 py-1.5 text-[13px] font-bold disabled:opacity-50 ${style}`}
    >
      {children}
    </button>
  );
}

export function Pill({ children, tone = "muted" }: { children: ReactNode; tone?: "in" | "out" | "tax" | "amber" | "muted" }) {
  const t = {
    in: "bg-in-soft text-in",
    out: "bg-out-soft text-out",
    tax: "bg-tax-soft text-tax",
    amber: "bg-amber-soft text-amber-deep",
    muted: "bg-surface-2 text-muted border border-line",
  }[tone];
  return <span className={`inline-block rounded-full px-2.5 py-px text-xs font-bold ${t}`}>{children}</span>;
}

/** Codes like "ع-2026-001": isolated so neighbouring numbers don't reorder them. */
export function Code({ children }: { children: ReactNode }) {
  return <bdi className="font-bold">{children}</bdi>;
}

export function Loading() {
  return <div className="text-muted py-10 text-center">جاري التحميل...</div>;
}

export function ErrorBox({ message }: { message: string }) {
  return <div className="rounded-card border border-out bg-out-soft px-4 py-3 font-semibold">{message}</div>;
}
