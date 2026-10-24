import { FormEvent, ReactNode, useEffect, useState } from "react";
import { licenseApi, LicenseStatus, Product, shellApi, ShellInfo } from "../api/client";
import { Activate } from "./LicenseGate";
import { signOutOfDevice } from "./signOut";

const PROGRAMS: Record<Product, { title: string; line: string }> = {
  rental: { title: "التأجير", line: "السركي، أصحاب المعدات، الشركات، المستثمرين والأرباح" },
  operations: { title: "التشغيل", line: "المعدات، الشغل اليومي، الشركاء، المرتبات، الخزنة والمصاريف" },
};

// MK-Tech's own colors (navy #0F172A / blue #0B5FFF), like the activation screen
function Backdrop({ children, width = "max-w-[720px]" }: { children: ReactNode; width?: string }) {
  return (
    <div dir="rtl" className="min-h-screen flex items-center justify-center px-4 py-10" style={{ background: "linear-gradient(160deg, #0F172A 0%, #0B1A3A 55%, #0B2A6B 100%)" }}>
      <div className={`w-full ${width} grid gap-6 text-center`}>{children}</div>
    </div>
  );
}

/** The lock screen: the company password (from the server, or offline the last one typed here). */
function LockScreen({ name, onOpen }: { name: string; onOpen: () => void }) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [forgot, setForgot] = useState(false);
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!value) return;
    setBusy(true);
    const r = await shellApi.unlock(value);
    setBusy(false);
    if (r.ok) onOpen();
    else setError(r.message ?? "حصلت مشكلة");
  }
  return (
    <Backdrop width="max-w-[400px]">
      <img src="./mk-icon.png" alt="MK-Tech" className="w-[72px] h-[72px] rounded-2xl mx-auto" />
      <form onSubmit={submit} className="rounded-2xl bg-white text-[#0F172A] p-6 grid gap-3 text-right shadow-2xl">
        <div className="text-center">
          <div className="text-xl font-extrabold">أهلًا، {name}</div>
          <div className="text-sm text-[#64748B] mt-1">اكتب باسورد الشركة عشان تدخل</div>
        </div>
        <input
          autoFocus
          type="password"
          dir="ltr"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setError(null);
          }}
          placeholder="••••"
          className="w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2.5 text-center text-lg tracking-widest outline-none focus:border-[#0B5FFF] focus:ring-2 focus:ring-[#0B5FFF]/30"
        />
        {error && <div className="rounded-lg border border-rose-200 bg-rose-50 text-rose-700 text-sm px-3 py-2 text-center">{error}</div>}
        <button disabled={busy || !value} className="rounded-xl bg-[#0B5FFF] text-white font-bold py-2.5 hover:bg-[#2563EB] disabled:opacity-60">
          {busy ? "..." : "دخول"}
        </button>
        {forgot ? (
          <div className="text-sm text-[#64748B] text-center leading-relaxed">
            كلّم MK-Tech يمسح الباسورد، أو{" "}
            <button type="button" onClick={signOutOfDevice} className="text-[#0B5FFF] font-semibold">
              اخرج من الجهاز ده
            </button>{" "}
            وادخل بالكود.
          </div>
        ) : (
          <button type="button" onClick={() => setForgot(true)} className="text-sm text-[#0B5FFF] font-semibold">
            نسيت الباسورد؟
          </button>
        )}
      </form>
    </Backdrop>
  );
}

/**
 * The page MK-Tech opens on before a program: the activation code, the lock
 * screen if the company has a password, then — when the code opens both programs — which one
 * to work in. A code with one program goes straight into it.
 */
export default function Launcher() {
  const [status, setStatus] = useState<LicenseStatus | null>(null);
  const [shell, setShell] = useState<ShellInfo | null>(null);
  const [opening, setOpening] = useState<Product | null>(null);
  useEffect(() => {
    document.title = "MK-Tech";
    licenseApi.status().then(setStatus);
    shellApi.info().then(setShell);
    return licenseApi.onChanged(setStatus);
  }, []);
  const open = (p: Product) => {
    setOpening(p);
    shellApi.open(p);
  };
  const locked = !!shell?.locked;
  useEffect(() => {
    if (status?.state === "active" && shell && !locked && status.products.length === 1) open(status.products[0]);
  }, [status, shell, locked]);

  if (!status || !shell) return null;
  if (status.state !== "active") return <Activate message={status.message} onDone={setStatus} />;
  if (locked) return <LockScreen name={status.name} onOpen={() => setShell({ ...shell, locked: false })} />;

  return (
    <Backdrop>
      <img src="./mk-icon.png" alt="MK-Tech" className="w-[72px] h-[72px] rounded-2xl mx-auto" />
      <div className="text-white">
        <div className="text-2xl font-extrabold">أهلًا، {status.name}</div>
        <div className="text-[#93C5FD] mt-1.5">اختار البرنامج اللي هتشتغل عليه</div>
      </div>
      <div className="grid gap-4 grid-cols-2 max-[640px]:grid-cols-1">
        {status.products.map((p) => (
          <button
            key={p}
            onClick={() => open(p)}
            disabled={!!opening}
            className="rounded-2xl bg-white text-[#0F172A] p-6 text-right shadow-2xl hover:ring-4 hover:ring-[#0B5FFF]/40 disabled:opacity-60 transition"
          >
            <div className="text-xs font-bold text-[#0B5FFF]">MK-Tech</div>
            <div className="text-2xl font-extrabold mt-1">برنامج {PROGRAMS[p].title}</div>
            <div className="text-sm text-[#64748B] mt-2 leading-relaxed">{PROGRAMS[p].line}</div>
            <div className="mt-4 inline-block rounded-lg bg-[#0B5FFF] text-white text-sm font-bold px-4 py-2">{opening === p ? "بيفتح..." : "افتح"}</div>
          </button>
        ))}
      </div>
      <div className="text-xs text-[#94A3B8]">تقدر تبدّل بين البرنامجين في أي وقت من الإعدادات.</div>
    </Backdrop>
  );
}
