import { useState } from "react";
import Sidebar from "./components/Sidebar";
import Dashboard from "./pages/Dashboard";
import ComingSoon from "./pages/ComingSoon";
import { navItems, SectionId } from "./nav";

const comingSoonNotes: Record<Exclude<SectionId, "home">, string> = {
  equipment: "شاشات السركي والمقاول والمصروفات وتوزيع الشركاء لكل معدة — في المرحلة الثالثة.",
  salaries: "تسجيل حضور الموظفين وحساب المرتبات والأوفر تايم — في المرحلة الرابعة.",
  hassan: "كوميشن حسن والحسابات الشخصية المنفصلة — في المرحلة الرابعة.",
  contractors: "لوحة المقاولين وسجلات الدفعات — في المرحلة الخامسة.",
  partners: "توزيع الأرباح على الشركاء وسجلات دفعاتهم — في المرحلة الخامسة.",
  treasury: "حسابات الخزنة الثلاثة (محفظة، انستا باي، كاش) — في المرحلة السادسة.",
  suppliers: "سجل المشتريات والدفعات لكل مورد — في المرحلة السادسة.",
  reports: "التقارير النهائية الشاملة — في المرحلة السادسة.",
  settings: "إضافة الشركاء والسائقين والمعدات والمقاولين ديناميكيًا — في المرحلة الثانية.",
};

export default function App() {
  const [active, setActive] = useState<SectionId>("home");
  const activeItem = navItems.find((i) => i.id === active)!;

  return (
    <div className="flex min-h-screen" dir="rtl">
      <Sidebar active={active} onSelect={setActive} />
      <main className="flex-1 p-6 xl:p-8 max-w-[1400px] mx-auto w-full">
        {active === "home" ? (
          <Dashboard />
        ) : (
          <ComingSoon
            title={activeItem.label}
            icon={activeItem.icon}
            note={comingSoonNotes[active as Exclude<SectionId, "home">]}
          />
        )}
      </main>
    </div>
  );
}
