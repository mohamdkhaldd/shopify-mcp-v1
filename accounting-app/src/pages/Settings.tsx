import { useEffect, useState } from "react";
import { appApi, syncApi, systemApi } from "../api/client";
import { AppUpdateStatus } from "../api/types";
import Icon from "../components/Icon";
import DriversTab from "./settings/DriversTab";
import EquipmentTab from "./settings/EquipmentTab";
import ContractorsTab from "./settings/ContractorsTab";
import PartnersTab from "./settings/PartnersTab";
import ExpenseCategoriesTab from "./settings/ExpenseCategoriesTab";

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

  const [version, setVersion] = useState("");
  const [checking, setChecking] = useState(false);
  const [updateResult, setUpdateResult] = useState<AppUpdateStatus | null>(null);
  const [installing, setInstalling] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ pushed: number; error?: string } | null>(null);

  useEffect(() => {
    appApi.getVersion().then(setVersion);
  }, []);

  async function handleCheckForUpdate() {
    setChecking(true);
    setUpdateResult(null);
    const result = await appApi.checkForUpdate();
    setUpdateResult(result);
    setChecking(false);
  }

  async function handleInstallUpdate() {
    setInstalling(true);
    await appApi.installUpdate();
  }

  async function handleSyncAll() {
    setSyncing(true);
    setSyncResult(null);
    const result = await syncApi.pushAll();
    setSyncResult(result);
    setSyncing(false);
  }

  async function handleResetAll() {
    const step1 = window.confirm(
      "هتمسح كل السركي والمقاول ومصروفات المعدات والسلف والحوافز ودفعات المقاولين والشركاء وحساب حسن — المعدات والشركاء والسائقين والمقاولين هيفضلوا زي ما هما. متأكد؟"
    );
    if (!step1) return;
    const step2 = window.confirm("تأكيد أخير: مفيش رجوع بعد كده. تمسح كل السركي والمصروفات فعلاً؟");
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

      {active === "expenseCategories" && <ExpenseCategoriesTab />}

      <div className="bg-white rounded-card shadow-card p-5">
        <h2 className="font-bold text-slate-700 mb-1">الإصدار والتحديثات</h2>
        <p className="text-xs text-slate-400 mb-3">
          النسخة الحالية: <span className="font-semibold text-slate-600">{version || "..."}</span>
        </p>

        {updateResult?.state === "downloaded" ? (
          <div className="space-y-2">
            <p className="text-sm text-primary-dark font-semibold">
              فيه تحديث جاهز (نسخة {updateResult.version}) — دوس عشان يقفل البرنامج ويفتح تاني بالنسخة الجديدة.
            </p>
            <button
              onClick={handleInstallUpdate}
              disabled={installing}
              className="bg-primary text-white rounded-xl px-4 py-2 text-sm font-semibold hover:bg-primary-dark disabled:opacity-50"
            >
              {installing ? "جاري إعادة التشغيل..." : "ثبّت وأعد التشغيل الآن"}
            </button>
          </div>
        ) : (
          <button
            onClick={handleCheckForUpdate}
            disabled={checking}
            className="bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            {checking ? "جاري التحقق..." : "تحقق من وجود تحديث"}
          </button>
        )}

        {updateResult?.state === "not-available" && (
          <p className="text-xs text-slate-400 mt-2">البرنامج عندك أحدث نسخة متاحة.</p>
        )}
        {updateResult?.state === "error" && (
          <p className="text-xs text-rose-500 mt-2">حصل خطأ وقت التحقق — تأكد من الاتصال بالإنترنت وحاول تاني.</p>
        )}
        {updateResult?.state === "dev" && (
          <p className="text-xs text-slate-400 mt-2">التحديث التلقائي شغال بس في النسخة المثبّتة فعليًا على الجهاز.</p>
        )}
      </div>

      <div className="bg-white rounded-card shadow-card p-5">
        <h2 className="font-bold text-slate-700 mb-1">مزامنة مع الموبايل</h2>
        <p className="text-xs text-slate-400 mb-3">
          بيبعت كل البيانات الموجودة في اللاب (المعدات، الشركاء، السائقين، السركي، المصروفات، المرتبات) للسحابة
          دفعة واحدة — استخدمها أول مرة تربط اللاب بالمزامنة عشان كل التاريخ القديم يوصل للموبايل، مش بس اللي
          هيتسجل من دلوقتي.
        </p>
        <button
          onClick={handleSyncAll}
          disabled={syncing}
          className="bg-primary text-white rounded-xl px-4 py-2 text-sm font-semibold hover:bg-primary-dark disabled:opacity-50"
        >
          {syncing ? "جاري الإرسال... ممكن تاخد دقايق" : "🔄 ابعت كل بيانات اللاب للسحابة الآن"}
        </button>
        {syncResult && !syncResult.error && (
          <p className="text-xs text-primary-dark mt-2">تم إرسال {syncResult.pushed} سطر بنجاح.</p>
        )}
        {syncResult?.error && <p className="text-xs text-rose-500 mt-2">{syncResult.error}</p>}
      </div>

      <div className="bg-white rounded-card shadow-card p-5 border border-rose-100">
        <h2 className="font-bold text-rose-600 mb-1">منطقة الخطر</h2>
        <p className="text-xs text-slate-400 mb-3">
          بيمسح كل السركي والمقاول ومصروفات المعدات والسلف والحوافز ودفعات المقاولين والشركاء وحساب حسن، عشان تبدأ
          شهر جديد فاضي — من غير ما يمسح المعدات ولا الشركاء ولا نسبهم ولا السائقين ولا المقاولين، دول بيفضلوا زي
          ما هما.
        </p>
        <button
          onClick={handleResetAll}
          disabled={resetting}
          className="text-sm font-semibold text-rose-600 border border-rose-200 rounded-xl px-4 py-2 hover:bg-rose-50 disabled:opacity-50"
        >
          {resetting ? "جاري المسح..." : "مسح كل السركي والمصروفات وابدأ شهر جديد"}
        </button>
      </div>
    </div>
  );
}
