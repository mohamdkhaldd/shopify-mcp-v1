import { ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { licenseApi, LicenseStatus } from "../api/client";
import { BrandContext, brandFrom } from "../context/BrandContext";

/**
 * Nothing of the app shows until this copy is activated. The code also brings
 * the customer's company name and logo, which every screen and printout uses;
 * the activation screen itself stays neutral (the customer never sees the
 * seller's name).
 */
export default function LicenseGate({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<LicenseStatus | null>(null);
  const load = useCallback(() => licenseApi.status().then(setStatus), []);
  useEffect(() => {
    load();
    // a stopped / expired code locks the open app at the next check
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [load]);
  const brand = useMemo(() => (status?.state === "active" ? brandFrom(status) : null), [status]);
  useEffect(() => {
    document.title = brand ? `${brand.name} - التأجير` : "برنامج التأجير";
  }, [brand]);
  if (!status) return null;
  if (brand) return <BrandContext.Provider value={brand}>{children}</BrandContext.Provider>;
  if (status.state === "active") return null;
  return <Activate message={status.message} onDone={setStatus} />;
}

function Activate({ message, onDone }: { message: string | null; onDone: (s: LicenseStatus) => void }) {
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(message);
  const submit = async () => {
    setBusy(true);
    setError(null);
    const r = await licenseApi.activate(key);
    setBusy(false);
    if (r.ok) onDone(r.status);
    else setError(r.message);
  };
  return (
    <div dir="rtl" className="min-h-screen flex items-center justify-center bg-canvas px-4">
      <div className="w-full max-w-[440px] rounded-card border border-line bg-surface shadow-sm p-7 grid gap-5 text-center">
        <div className="w-16 h-16 rounded-2xl bg-ink text-amber mx-auto flex items-center justify-center" aria-hidden>
          <svg viewBox="0 0 24 24" className="w-9 h-9" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="4" y="10" width="16" height="10" rx="2" />
            <path d="M8 10V7a4 4 0 0 1 8 0v3" />
            <circle cx="12" cy="15" r="1.5" />
          </svg>
        </div>
        <div>
          <div className="font-display text-xl font-bold">برنامج تأجير المعدات</div>
          <div className="text-muted text-sm mt-1">اكتب كود التفعيل عشان تبدأ</div>
        </div>
        <input
          aria-label="كود التفعيل"
          dir="ltr"
          autoFocus
          value={key}
          placeholder="BNYN-XXXX-XXXX-XXXX"
          onChange={(e) => setKey(e.target.value.toUpperCase())}
          onKeyDown={(e) => e.key === "Enter" && key.trim() && !busy && submit()}
          className="font-mono text-center text-lg tracking-wider border border-line bg-surface text-fg rounded-md px-3 py-2.5"
        />
        <button
          onClick={submit}
          disabled={!key.trim() || busy}
          className="rounded-md bg-ink text-white font-bold py-2.5 disabled:opacity-50"
        >
          {busy ? "بيتأكد من الكود..." : "فعّل البرنامج"}
        </button>
        {error && <div className="rounded-md border border-out bg-out-soft text-sm font-semibold px-3 py-2">{error}</div>}
        <div className="text-xs text-muted">الكود بيشتغل على عدد أجهزة محدد. أول مرة لازم يكون فيه نت، وبعدها البرنامج بيشتغل من غير نت لحد ١٤ يوم.</div>
      </div>
    </div>
  );
}
