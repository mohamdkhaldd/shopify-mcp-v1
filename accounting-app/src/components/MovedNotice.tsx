import { useState } from "react";

// آخر تحديث للبرنامج ده: برنامج التشغيل اتنقل لبرنامج MK-Tech (مع برنامج
// التأجير في نفس التطبيق)، وبياناته بتتنقل لوحدها أول ما يتفتح على اللاب.
// الشاشة دي بتظهر كل ما البرنامج القديم يفتح، عشان محدش يسجّل هنا تاني.
const isTablet = !!(window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.();
const DOWNLOAD = isTablet
  ? "https://github.com/mohamdkhaldd/mk-tech/releases/download/tablet-latest/mk-tech-rental-tablet.apk"
  : "https://github.com/mohamdkhaldd/mk-tech/releases/latest/download/mk-tech-rental-setup.exe";

export default function MovedNotice() {
  const [open, setOpen] = useState(true);
  if (!open) return null;
  return (
    <div dir="rtl" className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ background: "linear-gradient(160deg, #0F172A 0%, #0B1A3A 55%, #0B2A6B 100%)" }}>
      <div className="w-full max-w-[560px] rounded-2xl bg-white text-[#0F172A] p-7 grid gap-4 shadow-2xl">
        <div>
          <div className="text-xs font-bold text-[#0B5FFF]">MK-Tech</div>
          <h1 className="text-2xl font-extrabold mt-1">البرنامج ده اتنقل لـ MK-Tech</h1>
          <p className="text-sm text-[#475569] mt-2 leading-relaxed">
            برنامج التشغيل بقى جوه برنامج <b>MK-Tech</b> مع برنامج التأجير، بنفس الشاشات. وبياناتك كلها بتتنقل لوحدها أول ما تفتحه على اللاب.
          </p>
        </div>
        <ol className="grid gap-2 text-sm leading-relaxed list-decimal pe-5">
          <li>
            افتح <b>MK-Tech</b> {isTablet ? "(تطبيق التأجير بعد التحديث)" : "(الأيقونة اللي كانت \"التأجير\")"} واختار <b>برنامج التشغيل</b>.
          </li>
          <li>لو مش متسطب عندك، حمّله من الزرار تحت واكتب كود التفعيل بتاع الشركة.</li>
        </ol>
        <div className="rounded-lg border border-amber-200 bg-amber-50 text-amber-900 text-sm px-3 py-2">
          ماتسجلش حاجة جديدة هنا — اللي هيتسجل في البرنامج القديم مش هيظهر في MK-Tech.
        </div>
        <a href={DOWNLOAD} target="_blank" rel="noreferrer" className="text-center rounded-xl bg-[#0B5FFF] text-white font-bold py-2.5 hover:bg-[#2563EB]">
          حمّل MK-Tech
        </a>
        <button onClick={() => setOpen(false)} className="text-xs text-[#64748B] font-semibold">
          افتح البرنامج القديم للاطلاع بس
        </button>
      </div>
    </div>
  );
}
