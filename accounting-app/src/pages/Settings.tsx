import { useState } from "react";
import { expenseCategoriesApi, systemApi } from "../api/client";
import SimpleEntityManager from "../components/settings/SimpleEntityManager";
import Icon from "../components/Icon";
import DriversTab from "./settings/DriversTab";
import EquipmentTab from "./settings/EquipmentTab";
import ContractorsTab from "./settings/ContractorsTab";
import PartnersTab from "./settings/PartnersTab";

type TabId = "partners" | "drivers" | "equipment" | "contractors" | "expenseCategories";

const tabs: { id: TabId; label: string; icon: string }[] = [
  { id: "partners", label: "الشركاء", icon: "partners" },
  { id: "drivers", label: "السائقين", icon: "salaries" },
  { id: "equipment", label: "المعدات", icon: "equipment" },
  { id: "contractors", label: "المقاولين", icon: "contractors" },
  { id: "expenseCategories", label: "أنواع المصروفات", icon: "treasury" },
];

export default function Settings() {
  const [active, setActive] = useState<TabId>("partners");
  const [resetting, setResetting] = useState(false);

  async function handleResetAll() {
    const step1 = window.confirm(
      "هتمسح كل البيانات نهائيًا — المعدات والشركاء والسائقين والمقاولين والسركي والمصروفات وكل حاجة. متأكد؟"
    );
    if (!step1) return;
    const step2 = window.confirm("تأكيد أخير: مفيش رجوع بعد كده. تمسح كل البيانات فعلاً؟");
    if (!step2) return;
    setResetting(true);
    await systemApi.resetAll();
    window.location.reload();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900">الإعدادات</h1>
        <p className="text-sm text-slate-500 mt-1">
          أي حاجة تضيفها هنا تظهر تلقائيًا في كل الشاشات والتقارير المرتبطة بيها — من غير أي خطوة إضافية.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => {
          const isActive = tab.id === active;
          return (
            <button
              key={tab.id}
              onClick={() => setActive(tab.id)}
              className={[
                "flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-colors",
                isActive
                  ? "bg-primary text-white shadow-sm"
                  : "bg-white text-slate-600 hover:bg-primary-light hover:text-primary-dark shadow-card",
              ].join(" ")}
            >
              <Icon name={tab.icon} className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {active === "partners" && <PartnersTab />}

      {active === "drivers" && <DriversTab />}

      {active === "equipment" && <EquipmentTab />}

      {active === "contractors" && <ContractorsTab />}

      {active === "expenseCategories" && (
        <SimpleEntityManager
          title="أنواع المصروفات"
          addLabel="إضافة نوع"
          namePlaceholder="اسم نوع المصروف (زي: صيانة، وقود)"
          emptyMessage="لسه مفيش أنواع مصروفات مسجلة."
          icon="treasury"
          api={expenseCategoriesApi}
        />
      )}

      <div className="bg-white rounded-card shadow-card p-5 border border-rose-100">
        <h2 className="font-bold text-rose-600 mb-1">منطقة الخطر</h2>
        <p className="text-xs text-slate-400 mb-3">
          بيمسح كل البيانات نهائيًا (المعدات، الشركاء، السائقين، المقاولين، السركي، المصروفات، الرواتب، كل حاجة)
          عشان تبدأ تسجيل بياناتك الحقيقية من الأول.
        </p>
        <button
          onClick={handleResetAll}
          disabled={resetting}
          className="text-sm font-semibold text-rose-600 border border-rose-200 rounded-xl px-4 py-2 hover:bg-rose-50 disabled:opacity-50"
        >
          {resetting ? "جاري المسح..." : "مسح كل البيانات وابدأ من جديد"}
        </button>
      </div>
    </div>
  );
}
