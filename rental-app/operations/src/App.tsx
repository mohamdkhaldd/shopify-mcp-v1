import { useEffect, useState } from "react";
import { UndoProvider } from "./context/UndoContext";
import Sidebar from "./components/Sidebar";
import Dashboard from "./pages/Dashboard";
import Settings from "./pages/Settings";
import Equipment from "./pages/Equipment";
import Salaries from "./pages/Salaries";
import Hassan from "./pages/Hassan";
import Contractors from "./pages/Contractors";
import Partners from "./pages/Partners";
import Treasury from "./pages/Treasury";
import OutgoingIncoming from "./pages/OutgoingIncoming";
import Payables from "./pages/Payables";
import Suppliers from "./pages/Suppliers";
import Reports from "./pages/Reports";
import Activity from "./pages/Activity";
import Custody from "./pages/Custody";
import Car from "./pages/Car";
import Obligations from "./pages/Obligations";
import { syncApi } from "./api/client";
import { SyncLoginBar, TabletUpdatePrompt } from "./components/DeviceBars";
import { navItems, SectionId } from "./nav";
import CompanyLogo from "./components/CompanyLogo";
import { useBrand } from "./brand";

// نسخة التابلت (Capacitor) — التحديث فيها بيسأل قبل ما يحمّل.
const isTablet = !!(window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.();

export default function App() {
  const [active, setActive] = useState<SectionId>("home");
  // تعديلات وصلت من جهاز تاني — بنعرض شريط بدل ما نحدّث الصفحة لوحدنا،
  // عشان منضيعش حاجة المستخدم بيكتبها دلوقتي.
  const [remote, setRemote] = useState<{ count: number; devices: string[] } | null>(null);
  const [pageKey, setPageKey] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const brand = useBrand();
  const go = (id: SectionId) => {
    setActive(id);
    setMenuOpen(false);
    window.scrollTo(0, 0);
  };

  useEffect(
    () =>
      syncApi.onRemoteChanges((info) =>
        setRemote((prev) => ({
          count: (prev?.count ?? 0) + info.count,
          devices: [...new Set([...(prev?.devices ?? []), ...info.devices])],
        }))
      ),
    []
  );

  return (
    <UndoProvider>
      <div className="flex min-h-screen" dir="rtl">
        <Sidebar active={active} onSelect={go} open={menuOpen} />
        {menuOpen && <div className="no-print fixed inset-0 z-40 bg-black/40 min-[1024px]:hidden" onClick={() => setMenuOpen(false)} aria-hidden />}
        <main key={pageKey} className="flex-1 min-w-0 p-6 xl:p-8 max-w-[1400px] mx-auto w-full max-[1023px]:px-3 max-[1023px]:pt-0">
          {/* phone / upright tablet: the company, the page, and ☰ for the menu */}
          <div className="no-print min-[1024px]:hidden sticky top-0 z-30 -mx-3 mb-4 px-3 h-14 flex items-center gap-3 bg-white border-b border-slate-200 shadow-sm">
            <button aria-label="القايمة" onClick={() => setMenuOpen(true)} className="w-10 h-10 -ms-1 rounded-lg flex items-center justify-center text-slate-700 hover:bg-slate-100">
              <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            </button>
            <div className="font-bold text-slate-900 truncate">{navItems.find((i) => i.id === active)?.label}</div>
            <div className="ms-auto flex items-center gap-2 min-w-0">
              <span className="text-xs text-slate-500 truncate">{brand.name}</span>
              <CompanyLogo />
            </div>
          </div>
          <SyncLoginBar />
          {remote && (
            <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-sky-50 border border-sky-200 px-4 py-2.5 text-sm text-sky-900">
              <span>
                📱 وصل {remote.count} تعديل جديد من {remote.devices.join(" و") || "جهاز تاني"}
              </span>
              <span className="flex items-center gap-3">
                <button
                  onClick={() => {
                    setRemote(null);
                    setPageKey((k) => k + 1);
                  }}
                  className="rounded-lg bg-sky-600 text-white px-3 py-1 text-xs font-bold hover:bg-sky-700"
                >
                  حدّث الصفحة
                </button>
                <button onClick={() => setRemote(null)} className="text-xs text-sky-700 font-semibold">
                  إخفاء
                </button>
              </span>
            </div>
          )}
          {active === "home" && <Dashboard onNavigate={go} />}
          {active === "settings" && <Settings />}
          {active === "equipment" && <Equipment />}
          {active === "salaries" && <Salaries />}
          {active === "hassan" && <Hassan />}
          {active === "contractors" && <Contractors />}
          {active === "partners" && <Partners />}
          {active === "treasury" && <Treasury />}
          {active === "outgoingIncoming" && <OutgoingIncoming />}
          {active === "payables" && <Payables onGoToSuppliers={() => go("suppliers")} />}
          {active === "suppliers" && <Suppliers />}
          {active === "reports" && <Reports />}
          {active === "activity" && <Activity />}
          {active === "custody" && <Custody />}
          {active === "car" && <Car />}
          {active === "obligations" && <Obligations />}
        </main>
      </div>
      {isTablet && <TabletUpdatePrompt />}
    </UndoProvider>
  );
}
