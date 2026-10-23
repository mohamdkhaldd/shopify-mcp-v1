import { InputHTMLAttributes, ReactNode, useEffect, useState } from "react";

const inputCls = "font-[inherit] text-[13px] border border-line bg-surface text-fg rounded-md px-2 py-1 disabled:bg-surface-2 disabled:text-muted";

/** A sheet cell: edits locally, saves on blur / Enter only if the value changed (same as the old sheets). */
export function Cell({ value, onCommit, disabled, className = "w-[58px] text-end", placeholder, ariaLabel }: { value: string; onCommit: (v: string) => void; disabled?: boolean; className?: string; placeholder?: string; ariaLabel: string }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return (
    <input
      aria-label={ariaLabel}
      value={draft}
      placeholder={placeholder}
      disabled={disabled}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => draft !== value && onCommit(draft)}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") setDraft(value);
      }}
      className={`${inputCls} ${className}`}
    />
  );
}

export function Labeled({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-0.5 text-[11px] font-semibold text-muted">
      {label}
      {children}
    </label>
  );
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputCls} py-1.5 ${props.className ?? "w-24"}`} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${inputCls} py-1.5 font-bold ${props.className ?? ""}`} />;
}
