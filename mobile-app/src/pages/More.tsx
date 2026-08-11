type MoreScreen = "hassan" | "waste" | "suppliers" | "outgoing";

const ITEMS: { screen: MoreScreen; icon: string; label: string; desc: string }[] = [
  { screen: "hassan", icon: "🧾", label: "حسن", desc: "حسابه الشخصي وخزنته" },
  { screen: "waste", icon: "🗑️", label: "الهالك", desc: "الفلوس اللي راحت هالك" },
  { screen: "suppliers", icon: "🚚", label: "الموردين", desc: "المشتريات والدفعات" },
  { screen: "outgoing", icon: "📤", label: "الصادر", desc: "كل الفلوس اللي خرجت الشهر ده" },
];

export default function More({ onOpen }: { onOpen: (screen: MoreScreen) => void }) {
  return (
    <div>
      <div className="bg-primary text-white px-4 pt-6 pb-3">
        <div className="text-xs opacity-80 font-bold">دفتر البنيان</div>
        <div className="text-lg font-extrabold mt-0.5">المزيد</div>
      </div>

      <div className="p-4 space-y-2">
        {ITEMS.map((item) => (
          <button
            key={item.screen}
            onClick={() => onOpen(item.screen)}
            className="w-full bg-white rounded-2xl shadow-card p-3.5 flex items-center gap-3 text-start"
          >
            <span className="text-2xl">{item.icon}</span>
            <div className="flex-1">
              <div className="text-sm font-bold text-slate-800">{item.label}</div>
              <div className="text-[11px] text-slate-400">{item.desc}</div>
            </div>
            <span className="text-slate-300">‹</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export type { MoreScreen };
