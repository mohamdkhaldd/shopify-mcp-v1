import { useState } from "react";
import Sidebar from "./components/Sidebar";
import Dashboard from "./pages/Dashboard";
import Settings from "./pages/Settings";
import Equipment from "./pages/Equipment";
import Salaries from "./pages/Salaries";
import Hassan from "./pages/Hassan";
import Contractors from "./pages/Contractors";
import Partners from "./pages/Partners";
import Treasury from "./pages/Treasury";
import Suppliers from "./pages/Suppliers";
import Reports from "./pages/Reports";
import { SectionId } from "./nav";

export default function App() {
  const [active, setActive] = useState<SectionId>("home");

  return (
    <div className="flex min-h-screen" dir="rtl">
      <Sidebar active={active} onSelect={setActive} />
      <main className="flex-1 p-6 xl:p-8 max-w-[1400px] mx-auto w-full">
        {active === "home" && <Dashboard />}
        {active === "settings" && <Settings />}
        {active === "equipment" && <Equipment />}
        {active === "salaries" && <Salaries />}
        {active === "hassan" && <Hassan />}
        {active === "contractors" && <Contractors />}
        {active === "partners" && <Partners />}
        {active === "treasury" && <Treasury />}
        {active === "suppliers" && <Suppliers />}
        {active === "reports" && <Reports />}
      </main>
    </div>
  );
}
