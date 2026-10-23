import { useEffect, useState } from "react";
import { REFRESH_EVENT } from "./api/client";
import Sidebar from "./components/Sidebar";
import { UndoProvider } from "./context/UndoContext";
import Dashboard from "./pages/Dashboard";
import Sarki from "./pages/sarki/Sarki";
import Suppliers from "./pages/suppliers/Suppliers";
import Clients from "./pages/clients/Clients";
import Management from "./pages/management/Management";
import Investors from "./pages/investors/Investors";
import Treasury from "./pages/treasury/Treasury";
import Tax from "./pages/tax/Tax";
import Activity from "./pages/activity/Activity";
import Settings from "./pages/settings/Settings";
import { SectionId } from "./nav";
import { SyncBars } from "./components/Sync";
import LicenseGate from "./components/LicenseGate";

export default function App() {
  const [active, setActive] = useState<SectionId>("home");
  const [pageKey, setPageKey] = useState(0);
  useEffect(() => {
    const onRefresh = () => setPageKey((k) => k + 1);
    window.addEventListener(REFRESH_EVENT, onRefresh);
    return () => window.removeEventListener(REFRESH_EVENT, onRefresh);
  }, []);
  return (
    <LicenseGate>
      <UndoProvider>
        <div className="flex min-h-screen" dir="rtl">
          <Sidebar active={active} onSelect={setActive} />
          <main className="flex-1 min-w-0 px-6 xl:px-8 pt-[26px] pb-14">
            <div className="max-w-[1240px] mx-auto">
              <SyncBars />
            </div>
            <div className="max-w-[1240px] mx-auto" key={pageKey}>
              {active === "home" ? (
                <Dashboard onNavigate={setActive} />
              ) : active === "sarki" ? (
                <Sarki />
              ) : active === "suppliers" ? (
                <Suppliers />
              ) : active === "clients" ? (
                <Clients />
              ) : active === "management" ? (
                <Management />
              ) : active === "investors" ? (
                <Investors />
              ) : active === "treasury" ? (
                <Treasury />
              ) : active === "tax" ? (
                <Tax />
              ) : active === "activity" ? (
                <Activity />
              ) : (
                <Settings />
              )}
            </div>
          </main>
        </div>
      </UndoProvider>
    </LicenseGate>
  );
}
