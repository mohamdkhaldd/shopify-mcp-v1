import BrandLogo from "./BrandLogo";
import { useBrand } from "../context/BrandContext";

/** Phone / upright tablet only: the company, the current page, and ☰ to open the menu. */
export default function MobileTopBar({ title, onMenu }: { title: string; onMenu: () => void }) {
  const brand = useBrand();
  return (
    <div className="no-print min-[1024px]:hidden sticky top-0 z-30 -mx-3 mb-4 px-3 h-14 flex items-center gap-3 bg-ink text-white shadow-md">
      <button aria-label="القايمة" onClick={onMenu} className="w-10 h-10 -ms-1 rounded-lg flex items-center justify-center hover:bg-white/10 active:bg-white/15">
        <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      </button>
      <div className="font-display font-bold text-[15px] truncate">{title}</div>
      <div className="ms-auto flex items-center gap-2 min-w-0">
        <span className="text-xs text-white/70 truncate">{brand.name}</span>
        <BrandLogo className="w-8 h-8 shrink-0 text-sm" />
      </div>
    </div>
  );
}
