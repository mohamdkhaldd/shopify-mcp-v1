import { useEffect, useState } from "react";
import { navItems, navLabel, SectionId } from "../nav";
import { appApi } from "../api/client";
import CompanyLogo from "./CompanyLogo";
import { useBrand } from "../brand";
import Icon from "./Icon";
import { ACCENTS, useTheme } from "../theme";
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
  const { theme, toggle, accent, setAccent } = useTheme();
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
        "no-print w-60 shrink-0 h-screen sticky top-0 bg-white border-s border-slate-200/70 flex flex-col",
        "max-[1023px]:fixed max-[1023px]:right-0 max-[1023px]:z-50 max-[1023px]:h-[100dvh] max-[1023px]:shadow-2xl max-[1023px]:transition-transform max-[1023px]:duration-200",
        open ? "" : "max-[1023px]:translate-x-full",
      ].join(" ")}
    >
      <div className="px-5 pt-6 pb-4">
        <div className="flex items-center gap-3">
          <CompanyLogo />
          <div>
            <div className="font-bold text-slate-900 leading-tight">{brand.name}</div>
            <div className="text-xs text-slate-400 leading-tight">التشغيل</div>
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto pb-4 px-3 space-y-0.5">
        {navItems.map((item) => {
          const isActive = item.id === active;
          return (
            <div key={item.id}>
            {item.group && <div className="px-3 pt-5 pb-1.5 text-[11px] font-medium tracking-wide text-slate-400">{item.group}</div>}
            <button
              onClick={() => onSelect(item.id)}
              className={[
                "w-full flex items-center gap-3 rounded-[10px] px-3 py-2 text-sm transition-colors",
                isActive
                  ? "bg-primary-light text-primary-dark font-semibold"
                  : "text-slate-500 hover:bg-slate-100 hover:text-slate-800",
              ].join(" ")}
            >
              <Icon name={item.icon} className="w-[18px] h-[18px]" />
              <span>{navLabel(item)}</span>
            </button>
            </div>
          );
        })}
      </nav>

      <div className="px-3 py-4 border-t border-slate-100 space-y-1">
        <div className="px-3 pb-2 flex items-center gap-2" role="group" aria-label="لون البرنامج">
          {ACCENTS.map((a) => (
            <button
              key={a.id}
              title={a.label}
              aria-label={a.label}
              aria-pressed={accent === a.id}
              onClick={() => setAccent(a.id)}
              className={["w-5 h-5 rounded-full transition-transform", accent === a.id ? "ring-2 ring-offset-2 ring-slate-400 scale-110" : "hover:scale-110"].join(" ")}
              style={{ background: a.color }}
            />
          ))}
        </div>
        <button
          onClick={toggle}
          className="w-full flex items-center gap-3 rounded-[10px] px-3 py-2 text-sm text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors"
        >
          <Icon name={theme === "dark" ? "sun" : "moon"} className="w-5 h-5" />
          <span>{theme === "dark" ? "الوضع العادي" : "الوضع الليلي"}</span>
        </button>
        {info?.hasPassword && (
          <button
            onClick={() => shell.lock()}
            className="w-full flex items-center gap-3 rounded-[10px] px-3 py-2 text-sm text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors"
          >
            <Icon name="lock" className="w-5 h-5" />
            <span>قفل</span>
          </button>
        )}
        {info && (
          <button
            onClick={signOutOfDevice}
            className="w-full flex items-center gap-3 rounded-[10px] px-3 py-2 text-sm text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors"
          >
            <Icon name="logout" className="w-5 h-5" />
            <span>خروج</span>
          </button>
        )}
        <div className="px-3 pt-1 text-[11px] text-slate-400">
          {version ? `الإصدار ${version}` : "..."} — يعمل بالكامل بدون إنترنت
        </div>
      </div>
    </aside>
  );
}
