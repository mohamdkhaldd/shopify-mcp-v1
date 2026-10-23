import { useEffect, useState } from "react";
import { footerItems, navItems, NavItem, SectionId } from "../nav";
import { appApi } from "../api/client";
import { useTheme } from "../theme";
import Icon from "./Icon";

function NavButton({ item, active, onSelect }: { item: NavItem; active: boolean; onSelect: (id: SectionId) => void }) {
  return (
    <button
      onClick={() => onSelect(item.id)}
      className={[
        "relative w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors",
        active ? "bg-ink-2 text-white" : "text-side hover:bg-white/5 hover:text-white",
      ].join(" ")}
    >
      {active && <span className="absolute -start-3 top-2 bottom-2 w-1 rounded-e bg-amber" />}
      <span className={active ? "text-amber" : "opacity-80"}>
        <Icon name={item.icon} className="w-[19px] h-[19px]" />
      </span>
      {item.label}
    </button>
  );
}

export default function Sidebar({ active, onSelect }: { active: SectionId; onSelect: (id: SectionId) => void }) {
  const { theme, toggle } = useTheme();
  const [version, setVersion] = useState("");
  const [backup, setBackup] = useState<string | null>(null);

  useEffect(() => {
    appApi.version().then(setVersion);
    appApi.lastBackup().then((b) => {
      if (!b) return;
      const d = new Date(b.at);
      const p = (n: number) => String(n).padStart(2, "0");
      setBackup(`${p(d.getDate())}/${p(d.getMonth() + 1)} — ${p(d.getHours())}:${p(d.getMinutes())}`);
    });
  }, []);

  return (
    <aside className="no-print w-[248px] shrink-0 h-screen sticky top-0 bg-ink text-side flex flex-col">
      <div className="flex items-center gap-3 px-[18px] pt-[22px] pb-[18px] border-b border-white/[.07]">
        <img src="./logo.png" alt="" className="w-[46px] h-[46px] rounded-full bg-white" />
        <div>
          <div className="text-white font-display text-[15px] font-bold leading-tight">البنيان</div>
          <div className="text-amber text-xs font-bold">التأجير</div>
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto px-2.5 py-3.5 flex flex-col gap-0.5">
        {navItems.map((item) => (
          <NavButton key={item.id} item={item} active={item.id === active} onSelect={onSelect} />
        ))}
        <div className="my-2 border-t border-white/[.07]" />
        {footerItems.map((item) => (
          <NavButton key={item.id} item={item} active={item.id === active} onSelect={onSelect} />
        ))}
      </nav>
      <div className="px-4 pt-3 pb-4 border-t border-white/[.07] text-xs grid gap-1.5">
        <button onClick={toggle} className="flex items-center gap-2 font-semibold hover:text-white text-start">
          <Icon name={theme === "dark" ? "sun" : "moon"} className="w-4 h-4" />
          {theme === "dark" ? "الوضع العادي" : "الوضع الليلي"}
        </button>
        <div>{backup ? `آخر نسخة احتياطية: ${backup}` : "لسه مفيش نسخة احتياطية"}</div>
        <div>{version ? `الإصدار ${version}` : ""}</div>
      </div>
    </aside>
  );
}
