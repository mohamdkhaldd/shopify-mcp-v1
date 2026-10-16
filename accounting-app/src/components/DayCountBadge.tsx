// عدد أيام مظلل: أخضر للشغل، أحمر للإجازة — عشان يبان بسرعة لو فيه أيام
// لسه متسجلتش.
export default function DayCountBadge({ count, tone }: { count: number; tone: "work" | "off" | "missing" }) {
  return (
    <span
      className={[
        "inline-block min-w-[2.5rem] text-center rounded-lg px-2 py-0.5 text-xs font-bold",
        tone === "work"
          ? "bg-emerald-100 text-emerald-800"
          : tone === "off"
            ? "bg-rose-100 text-rose-700"
            : "bg-slate-100 text-slate-500",
      ].join(" ")}
    >
      {count} يوم
    </span>
  );
}
