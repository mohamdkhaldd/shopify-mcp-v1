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
import { syncApi } from "./api/client";
import { SectionId } from "./nav";

export default function App() {
  const [active, setActive] = useState<SectionId>("home");
  // تعديلات وصلت من جهاز تاني — بنعرض شريط بدل ما نحدّث الصفحة لوحدنا،
  // عشان منضيعش حاجة المستخدم بيكتبها دلوقتي.
  const [remote, setRemote] = useState<{ count: number; devices: string[] } | null>(null);
  const [pageKey, setPageKey] = useState(0);

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
        <Sidebar active={active} onSelect={setActive} />
        <main key={pageKey} className="flex-1 p-6 xl:p-8 max-w-[1400px] mx-auto w-full">
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
          {active === "home" && <Dashboard />}
          {active === "settings" && <Settings />}
          {active === "equipment" && <Equipment />}
          {active === "salaries" && <Salaries />}
          {active === "hassan" && <Hassan />}
          {active === "contractors" && <Contractors />}
          {active === "partners" && <Partners />}
          {active === "treasury" && <Treasury />}
          {active === "outgoingIncoming" && <OutgoingIncoming />}
          {active === "payables" && <Payables onGoToSuppliers={() => setActive("suppliers")} />}
          {active === "suppliers" && <Suppliers />}
          {active === "reports" && <Reports />}
          {active === "activity" && <Activity />}
        </main>
      </div>
    </UndoProvider>
  );
}
