import { useEffect, useState } from "react";
import { licenseApi, LicenseStatus, Product, shellApi } from "../api/client";
import { Activate } from "./LicenseGate";

const PROGRAMS: Record<Product, { title: string; line: string }> = {
  rental: { title: "التأجير", line: "السركي، أصحاب المعدات، الشركات، المستثمرين والأرباح" },
  operations: { title: "التشغيل", line: "المعدات، الشغل اليومي، الشركاء، المرتبات، الخزنة والمصاريف" },
};

/**
 * The page MK-Tech opens on before a program: the activation code, then — when
 * the code opens both programs — which one to work in. A code with one program
 * goes straight into it.
 */
export default function Launcher() {
  const [status, setStatus] = useState<LicenseStatus | null>(null);
  const [opening, setOpening] = useState<Product | null>(null);
  useEffect(() => {
    document.title = "MK-Tech";
    licenseApi.status().then(setStatus);
    return licenseApi.onChanged(setStatus);
  }, []);
  const open = (p: Product) => {
    setOpening(p);
    shellApi.open(p);
  };
  useEffect(() => {
    if (status?.state === "active" && status.products.length === 1) open(status.products[0]);
  }, [status]);

  if (!status) return null;
  if (status.state !== "active") return <Activate message={status.message} onDone={setStatus} />;

  // MK-Tech's own colors (navy #0F172A / blue #0B5FFF), like the activation screen
  return (
    <div dir="rtl" className="min-h-screen flex items-center justify-center px-4 py-10" style={{ background: "linear-gradient(160deg, #0F172A 0%, #0B1A3A 55%, #0B2A6B 100%)" }}>
      <div className="w-full max-w-[720px] grid gap-6 text-center">
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
      </div>
    </div>
  );
}
