import { useState } from "react";
import Sidebar from "./components/Sidebar";
import Dashboard from "./pages/Dashboard";
import Settings from "./pages/Settings";
import Equipment from "./pages/Equipment";
import ComingSoon from "./pages/ComingSoon";
import { navItems, SectionId } from "./nav";

type ComingSoonSection = Exclude<SectionId, "home" | "settings" | "equipment">;

const comingSoonNotes: Record<ComingSoonSection, string> = {
  salaries: "تسجيل حضور الموظفين وحساب المرتبات والأوفر تايم — في المرحلة الرابعة.",
  hassan: "كوميشن حسن والحسابات الشخصية المنفصلة — في المرحلة الرابعة.",
  contractors: "لوحة المقاولين وسجلات الدفعات — في المرحلة الخامسة.",
  partners: "توزيع الأرباح على الشركاء وسجلات دفعاتهم — في المرحلة الخامسة.",
  treasury: "حسابات الخزنة الثلاثة (محفظة، انستا باي، كاش) — في المرحلة السادسة.",
  suppliers: "سجل المشتريات والدفعات لكل مورد — في المرحلة السادسة.",
  reports: "التقارير النهائية الشاملة — في المرحلة السادسة.",
};

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
        {active !== "home" && active !== "settings" && active !== "equipment" && (
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
