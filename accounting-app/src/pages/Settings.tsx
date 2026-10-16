import { useEffect, useState } from "react";
import { appApi, syncApi, systemApi } from "../api/client";
import { AppUpdateStatus, SyncStatus } from "../api/types";
import Icon from "../components/Icon";
import DriversTab from "./settings/DriversTab";
import EquipmentTab from "./settings/EquipmentTab";
import ContractorsTab from "./settings/ContractorsTab";
import PartnersTab from "./settings/PartnersTab";
import ExpenseCategoriesTab from "./settings/ExpenseCategoriesTab";
import { ApkUpdateButton } from "../components/DeviceBars";

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
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [deviceName, setDeviceName] = useState("");
  const [nameSaved, setNameSaved] = useState(false);

  useEffect(() => {
    appApi.getVersion().then(setVersion);
    const load = () =>
      syncApi.status().then((s) => {
        setSyncStatus(s);
        setDeviceName((prev) => prev || s.deviceName);
      });
    load();
    const timer = setInterval(load, 3000);
    return () => clearInterval(timer);
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

  async function handleSyncNow() {
    setSyncing(true);
    setSyncStatus(await syncApi.now());
    setSyncing(false);
  }

  async function handleSaveDeviceName() {
    if (!deviceName.trim()) return;
    setSyncStatus(await syncApi.setDeviceName(deviceName));
    setNameSaved(true);
    setTimeout(() => setNameSaved(false), 2000);
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

        {updateResult?.state === "apk" && updateResult.url && (
          <div className="mt-2 space-y-1">
            <p className="text-sm text-primary-dark font-semibold">فيه نسخة جديدة للتابلت ({updateResult.version}).</p>
            <ApkUpdateButton update={updateResult} />
          </div>
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
        <h2 className="font-bold text-slate-700 mb-1">المزامنة بين الأجهزة (اللاب والتابلت)</h2>
        <p className="text-xs text-slate-400 mb-3">
          أي إضافة أو تعديل أو مسح على أي جهاز بيوصل التاني في ثواني لوحده. لو النت فصل، التعديلات بتستنى وبتتبعت أول ما يرجع.
        </p>
        {!syncStatus ? (
          <div className="text-sm text-slate-400">جاري التحميل...</div>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap items-end gap-2">
              <div>
                <label className="block text-xs text-slate-400 mb-1">اسم الجهاز ده (بيظهر في سجل التعديلات)</label>
                <input
                  value={deviceName}
                  onChange={(e) => setDeviceName(e.target.value)}
                  placeholder="زي: اللاب أو التابلت"
                  className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm w-48"
                />
              </div>
              <button
                onClick={handleSaveDeviceName}
                disabled={!deviceName.trim() || deviceName.trim() === syncStatus.deviceName}
                className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                {nameSaved ? "✓ اتحفظ" : "حفظ الاسم"}
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-sm">
              <div className={`rounded-xl py-2.5 text-center ${syncStatus.online ? "bg-primary-light" : "bg-rose-50"}`}>
                <div className="text-xs text-slate-500">الحالة</div>
                <div className={`font-bold ${syncStatus.online ? "text-primary-dark" : "text-rose-600"}`}>
                  {syncStatus.online ? "● متصل" : syncStatus.needsLogin ? "🔒 محتاج الباسورد" : "● مش متصل"}
                </div>
              </div>
              <div className="rounded-xl py-2.5 text-center bg-slate-50">
                <div className="text-xs text-slate-500">آخر مزامنة</div>
                <div className="font-bold text-slate-700">
                  {syncStatus.lastSyncAt ? new Date(syncStatus.lastSyncAt).toLocaleTimeString("ar-EG") : "—"}
                </div>
              </div>
              <div className={`rounded-xl py-2.5 text-center ${syncStatus.pending ? "bg-amber-50" : "bg-slate-50"}`}>
                <div className="text-xs text-slate-500">تعديلات لسه متبعتتش</div>
                <div className={`font-bold ${syncStatus.pending ? "text-amber-700" : "text-slate-700"}`}>{syncStatus.pending}</div>
              </div>
              <div className="rounded-xl py-2.5 text-center bg-slate-50">
                <div className="text-xs text-slate-500">مستنية بيانات تانية</div>
                <div className="font-bold text-slate-700">{syncStatus.deferred}</div>
              </div>
            </div>
            {syncStatus.lastError && !syncStatus.online && (
              <p className="text-xs text-rose-500">آخر خطأ: {syncStatus.lastError}</p>
            )}
            <button
              onClick={handleSyncNow}
              disabled={syncing}
              className="bg-primary text-white rounded-xl px-4 py-2 text-sm font-semibold hover:bg-primary-dark disabled:opacity-50"
            >
              {syncing ? "جاري المزامنة..." : "🔄 زامن دلوقتي"}
            </button>
          </div>
        )}
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
