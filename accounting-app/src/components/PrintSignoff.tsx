interface PrintHeaderProps {
  title: string;
  subtitle?: string;
}

// Shown only when printing (see .print-only in index.css) — the sidebar
// with the company name/logo is hidden on the printed page, so each
// printable sheet carries its own header.
export function PrintHeader({ title, subtitle }: PrintHeaderProps) {
  return (
    <div className="print-only mb-4 pb-3 border-b-2 border-slate-800">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-extrabold text-lg">شركة البنيان لتأجير المعدات الثقيلة</div>
          <div className="text-sm text-slate-600">{title}</div>
        </div>
        {subtitle && <div className="text-sm text-slate-600">{subtitle}</div>}
      </div>
    </div>
  );
}

// Signature + stamp block for printed sheets (سركي / شيت المرتب) — the
// paper trail the office actually uses once it leaves the screen.
export function PrintSignoff() {
  return (
    <div className="print-only mt-10 pt-6">
      <div className="flex items-start justify-between gap-10">
        <div className="flex-1">
          <div className="text-sm font-semibold mb-10">التوقيع</div>
          <div className="border-t border-slate-800 w-48"></div>
        </div>
        <div className="flex-1 text-center">
          <div className="text-sm font-semibold mb-2">الختم</div>
          <div className="w-28 h-28 border-2 border-dashed border-slate-400 rounded-full mx-auto"></div>
        </div>
      </div>
    </div>
  );
}
