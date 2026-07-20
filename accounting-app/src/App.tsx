import { useState } from "react";
import Sidebar from "./components/Sidebar";
import Dashboard from "./pages/Dashboard";
import Settings from "./pages/Settings";
import Equipment from "./pages/Equipment";
import Salaries from "./pages/Salaries";
import Hassan from "./pages/Hassan";
import Contractors from "./pages/Contractors";
import Partners from "./pages/Partners";
import ComingSoon from "./pages/ComingSoon";
import { navItems, SectionId } from "./nav";

type ComingSoonSection = Exclude<
  SectionId,
  "home" | "settings" | "equipment" | "salaries" | "hassan" | "contractors" | "partners"
>;

const comingSoonNotes: Record<ComingSoonSection, string> = {
  treasury: "حسابات الخزنة الثلاثة (محفظة، انستا باي، كاش) — في المرحلة السادسة.",
  suppliers: "سجل المشتريات والدفعات لكل مورد — في المرحلة السادسة.",
  reports: "التقارير النهائية الشاملة — في المرحلة السادسة.",
};

const builtSections: SectionId[] = ["home", "settings", "equipment", "salaries", "hassan", "contractors", "partners"];

export default function App() {
  const [active, setActive] = useState<SectionId>("home");
  const activeItem = navItems.find((i) => i.id === active)!;

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
        {!builtSections.includes(active) && (
          <ComingSoon
            title={activeItem.label}
            icon={activeItem.icon}
            note={comingSoonNotes[active as ComingSoonSection]}
          />
        )}
      </main>
    </div>
  );
}
