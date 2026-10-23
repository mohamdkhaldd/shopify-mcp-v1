import { ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { licenseApi, LicenseStatus } from "../api/client";
import { BrandContext, brandFrom } from "../context/BrandContext";

/**
 * Nothing of the app shows until this copy is activated. The code also brings
 * the customer's company name and logo, which every screen and printout uses.
 * Before that, the product's own brand (MK-Tech) is all the customer sees.
 */
export default function LicenseGate({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<LicenseStatus | null>(null);
  const load = useCallback(() => licenseApi.status().then(setStatus), []);
  useEffect(() => {
    load();
    const off = licenseApi.onChanged(setStatus);
    // a code that runs out while the app is open locks it within a minute
    const t = setInterval(load, 60_000);
    return () => {
      off();
      clearInterval(t);
    };
  }, [load]);
  const brand = useMemo(() => (status?.state === "active" ? brandFrom(status) : null), [status]);
  useEffect(() => {
    document.title = brand ? `${brand.name} - التأجير` : "MK-Tech Rental";
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
  // MK-Tech's own colors (navy #0F172A / blue #0B5FFF), not the app's theme
  return (
    <div dir="rtl" className="min-h-screen flex items-center justify-center px-4" style={{ background: "linear-gradient(160deg, #0F172A 0%, #0B1A3A 55%, #0B2A6B 100%)" }}>
      <div className="w-full max-w-[440px] rounded-2xl bg-white text-[#0F172A] shadow-2xl p-7 grid gap-5 text-center">
        <img src="./mk-icon.png" alt="MK-Tech" className="w-[72px] h-[72px] rounded-2xl mx-auto" />
        <div>
          <div dir="ltr" className="text-2xl font-extrabold tracking-tight">
            MK-Tech <span className="text-[#0B5FFF]">Rental</span>
          </div>
          <div className="text-[#64748B] text-sm mt-1.5">برنامج تأجير المعدات — اكتب كود التفعيل عشان تبدأ</div>
        </div>
        <input
          aria-label="كود التفعيل"
          dir="ltr"
          autoFocus
          value={key}
          placeholder="BNYN-XXXX-XXXX-XXXX"
          onChange={(e) => setKey(e.target.value.toUpperCase())}
          onKeyDown={(e) => e.key === "Enter" && key.trim() && !busy && submit()}
          style={{ outlineColor: "#0B5FFF" }}
          className="font-mono text-center text-lg tracking-wider border border-[#E2E8F0] bg-[#F8FAFC] text-[#0F172A] rounded-lg px-3 py-2.5 outline-none focus:border-[#0B5FFF] focus:ring-2 focus:ring-[#0B5FFF]/20"
        />
        <button
          onClick={submit}
          disabled={!key.trim() || busy}
          className="rounded-lg bg-[#0B5FFF] hover:bg-[#2563EB] text-white font-bold py-2.5 disabled:opacity-50"
        >
          {busy ? "بيتأكد من الكود..." : "فعّل البرنامج"}
        </button>
        {error && <div className="rounded-lg border border-[#EF4444] bg-[#FEF2F2] text-[#B91C1C] text-sm font-semibold px-3 py-2">{error}</div>}
        <div className="text-xs text-[#64748B]">الكود بيشتغل على عدد أجهزة محدد. أول مرة لازم يكون فيه نت، وبعدها البرنامج بيشتغل من غير نت لحد ١٤ يوم.</div>
      </div>
    </div>
  );
}
