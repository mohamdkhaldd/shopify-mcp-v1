import { navItems, SectionId } from "../nav";
import CompanyLogo from "./CompanyLogo";
import Icon from "./Icon";
import { useTheme } from "../theme";

interface SidebarProps {
  active: SectionId;
  onSelect: (id: SectionId) => void;
}

export default function Sidebar({ active, onSelect }: SidebarProps) {
  const { theme, toggle } = useTheme();

  return (
    <aside className="no-print w-64 shrink-0 h-screen sticky top-0 bg-white border-s border-slate-200 flex flex-col">
      <div className="px-5 py-6 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <CompanyLogo />
          <div>
            <div className="font-bold text-slate-900 leading-tight">شركة البنيان</div>
            <div className="text-xs text-slate-400 leading-tight">تأجير المعدات الثقيلة</div>
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
              <span>{item.label}</span>
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
        <div className="text-xs text-slate-400">الإصدار ٠.١ — يعمل بالكامل بدون إنترنت</div>
      </div>
    </aside>
  );
}
