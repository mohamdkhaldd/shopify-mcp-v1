import { ReactNode, useCallback, useEffect, useState } from "react";
import { licenseApi, LicenseStatus } from "../api/client";

/** Nothing of the app shows until this copy is activated with a code from Al Bunyan. */
export default function LicenseGate({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<LicenseStatus | null>(null);
  const load = useCallback(() => licenseApi.status().then(setStatus), []);
  useEffect(() => {
    load();
    // a stopped / expired code locks the open app at the next check
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [load]);
  if (!status) return null;
  if (status.state === "active") return <>{children}</>;
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
        <img src="./logo.png" alt="" className="w-20 h-20 rounded-full bg-white mx-auto" />
        <div>
          <div className="font-display text-xl font-bold">البنيان - التأجير</div>
          <div className="text-muted text-sm mt-1">اكتب كود التفعيل اللي خدته من البنيان عشان تبدأ</div>
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
