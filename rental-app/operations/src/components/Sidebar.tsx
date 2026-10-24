import { useEffect, useState } from "react";
import { navItems, navLabel, SectionId } from "../nav";
import { appApi } from "../api/client";
import CompanyLogo from "./CompanyLogo";
import { useBrand } from "../brand";
import Icon from "./Icon";
import { useTheme } from "../theme";
import { shell, ShellInfo, signOutOfDevice } from "../shell";

interface SidebarProps {
  active: SectionId;
  onSelect: (id: SectionId) => void;
  /** phone / upright tablet: the menu slides in from the right */
  open?: boolean;
}

// On a phone or a tablet held upright (under 1024px) the menu is hidden and
// slides in from the right when ☰ in the top bar is tapped.
export default function Sidebar({ active, onSelect, open = false }: SidebarProps) {
  const { theme, toggle } = useTheme();
  const brand = useBrand();
  const [version, setVersion] = useState("");
  const [info, setInfo] = useState<ShellInfo | null>(null);

  useEffect(() => {
    appApi.getVersion().then(setVersion);
    shell.info().then(setInfo, () => {});
  }, []);

  return (
    <aside
      className={[
        "no-print w-64 shrink-0 h-screen sticky top-0 bg-white border-s border-slate-200 flex flex-col",
        "max-[1023px]:fixed max-[1023px]:right-0 max-[1023px]:z-50 max-[1023px]:h-[100dvh] max-[1023px]:shadow-2xl max-[1023px]:transition-transform max-[1023px]:duration-200",
        open ? "" : "max-[1023px]:translate-x-full",
      ].join(" ")}
    >
      <div className="px-5 py-6 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <CompanyLogo />
          <div>
            <div className="font-bold text-slate-900 leading-tight">{brand.name}</div>
            <div className="text-xs text-slate-400 leading-tight">التشغيل</div>
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
        {navItems.map((item) => {
          const isActive = item.id === active;
          return (
            <button
              key={item.id}
              onClick={() => onSelect(item.id)}
              className={[
                "w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors",
                isActive
                  ? "bg-primary text-white shadow-sm"
                  : "text-slate-600 hover:bg-primary-light hover:text-primary-dark",
              ].join(" ")}
            >
              <Icon name={item.icon} className="w-5 h-5" />
              <span>{navLabel(item)}</span>
            </button>
          );
        })}
      </nav>

      <div className="px-4 py-4 border-t border-slate-100 space-y-3">
        <button
          onClick={toggle}
          className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-600 hover:bg-primary-light hover:text-primary-dark transition-colors"
        >
          <Icon name={theme === "dark" ? "sun" : "moon"} className="w-5 h-5" />
          <span>{theme === "dark" ? "الوضع العادي" : "الوضع الليلي"}</span>
        </button>
        {info?.hasPassword && (
          <button
            onClick={() => shell.lock()}
            className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-600 hover:bg-primary-light hover:text-primary-dark transition-colors"
          >
            <Icon name="lock" className="w-5 h-5" />
            <span>قفل</span>
          </button>
        )}
        {info && (
          <button
            onClick={signOutOfDevice}
            className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-600 hover:bg-primary-light hover:text-primary-dark transition-colors"
          >
            <Icon name="logout" className="w-5 h-5" />
            <span>خروج</span>
          </button>
        )}
        <div className="text-xs text-slate-400">
          {version ? `الإصدار ${version}` : "..."} — يعمل بالكامل بدون إنترنت
        </div>
      </div>
    </aside>
  );
}
