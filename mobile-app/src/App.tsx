import { useEffect, useState } from "react";
import { currentMonthKey } from "./utils/months";
import Home from "./pages/Home";
import EquipmentDetail from "./pages/EquipmentDetail";
import Payroll from "./pages/Payroll";
import Settings from "./pages/Settings";
import Login from "./pages/Login";
import PartnerSummary from "./pages/PartnerSummary";
import { Equipment } from "./types";
import { initCloudSync, subscribeRemoteChanges } from "./store";
import { Profile, fetchProfile, getSession, onAuthChange } from "./auth";

type Screen = "home" | "payroll" | "settings";

export default function App() {
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    getSession().then((session) => setUserId(session?.user.id ?? null));
    return onAuthChange((session) => setUserId(session?.user.id ?? null));
  }, []);

  useEffect(() => {
    if (!userId) {
      setProfile(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    fetchProfile(userId).then((p) => {
      setProfile(p);
      setLoading(false);
    });
  }, [userId]);

  if (loading) {
    return <div className="min-h-screen bg-[#F5F7F6] flex items-center justify-center text-sm text-slate-400">جاري التحميل...</div>;
  }
  if (!userId) return <Login />;
  if (!profile) {
    return (
      <div className="min-h-screen bg-[#F5F7F6] flex items-center justify-center text-sm text-slate-400 text-center px-6">
        الحساب ده مش مربوط بصلاحية لسه. كلّم حسن يضيفلك واحدة من الإعدادات.
      </div>
    );
  }
  if (profile.role === "partner") return <PartnerSummary displayName={profile.display_name} />;
  return <StaffApp />;
}

function StaffApp() {
  const [screen, setScreen] = useState<Screen>("home");
  const [selectedEquipment, setSelectedEquipment] = useState<Equipment | null>(null);
  const [month, setMonth] = useState(currentMonthKey());
  const [remoteVersion, setRemoteVersion] = useState(0);

  useEffect(() => {
    initCloudSync();
    // لما تعديل يوصل من موبايل تاني، نجدد الشاشة الحالية عشان تظهر الداتا
    // الجديدة على طول من غير ما المستخدم يعمل أي حاجة.
    return subscribeRemoteChanges(() => setRemoteVersion((v) => v + 1));
  }, []);

  function goHome() {
    setSelectedEquipment(null);
    setScreen("home");
  }

  return (
    <div className="min-h-screen bg-[#F5F7F6] flex flex-col max-w-md mx-auto">
      <main className="flex-1 overflow-y-auto pb-20" key={remoteVersion}>
        {screen === "home" && !selectedEquipment && (
          <Home month={month} onChangeMonth={setMonth} onOpenEquipment={setSelectedEquipment} />
        )}
        {screen === "home" && selectedEquipment && (
          <EquipmentDetail equipment={selectedEquipment} month={month} onChangeMonth={setMonth} onBack={goHome} />
        )}
        {screen === "payroll" && <Payroll month={month} onChangeMonth={setMonth} />}
        {screen === "settings" && <Settings />}
      </main>

      <nav className="fixed bottom-0 inset-x-0 max-w-md mx-auto bg-white border-t border-slate-200 flex px-2 py-2">
        <NavButton icon="🏗️" label="المعدات" active={screen === "home"} onClick={goHome} />
        <NavButton icon="👥" label="المرتبات" active={screen === "payroll"} onClick={() => { setSelectedEquipment(null); setScreen("payroll"); }} />
        <NavButton icon="⚙️" label="الإعدادات" active={screen === "settings"} onClick={() => { setSelectedEquipment(null); setScreen("settings"); }} />
      </nav>
    </div>
  );
}

function NavButton({ icon, label, active, onClick }: { icon: string; label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={["flex-1 flex flex-col items-center gap-1 py-1 text-[11px] font-bold", active ? "text-primary" : "text-slate-400"].join(" ")}>
      <span className="text-base">{icon}</span>
      {label}
    </button>
  );
}
