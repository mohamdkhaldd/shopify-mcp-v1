import { useState } from "react";
import Sidebar from "./components/Sidebar";
import { UndoProvider } from "./context/UndoContext";
import Dashboard from "./pages/Dashboard";
import ComingNext from "./pages/ComingNext";
import Sarki from "./pages/sarki/Sarki";
import Suppliers from "./pages/suppliers/Suppliers";
import Clients from "./pages/clients/Clients";
import Management from "./pages/management/Management";
import Investors from "./pages/investors/Investors";
import Treasury from "./pages/treasury/Treasury";
import Tax from "./pages/tax/Tax";
import { SectionId } from "./nav";

export default function App() {
  const [active, setActive] = useState<SectionId>("home");
  return (
    <UndoProvider>
      <div className="flex min-h-screen" dir="rtl">
        <Sidebar active={active} onSelect={setActive} />
        <main className="flex-1 min-w-0 px-6 xl:px-8 pt-[26px] pb-14">
          <div className="max-w-[1240px] mx-auto">
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
            ) : (
              <ComingNext id={active} />
            )}
          </div>
        </main>
      </div>
    </UndoProvider>
  );
}
