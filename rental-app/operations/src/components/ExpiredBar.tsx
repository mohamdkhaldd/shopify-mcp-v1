import { useEffect, useState } from "react";

type Status = { state: string; expired?: boolean; expiresAt?: string | null };

/** الاشتراك خلص: شريط أحمر فوق كل الصفحات — البرنامج للعرض بس لحد ما يتجدد. */
export default function ExpiredBar() {
  const [s, setS] = useState<Status | null>(null);
  useEffect(() => {
    const api = window.api;
    if (!api) return;
    api.invoke("license:status").then((x) => setS(x as Status), () => {});
    return api.on("license:changed", (x) => setS(x as Status));
  }, []);
  if (s?.state !== "active" || !s.expired) return null;
  return (
    <div className="no-print mb-4 rounded-2xl bg-rose-600 text-white px-5 py-4 shadow-card" role="alert">
      <div className="text-lg font-bold">اشتراكك خلص{s.expiresAt ? ` يوم ${s.expiresAt}` : ""}</div>
      <div className="text-sm mt-1 leading-relaxed">
        متقلقش، بياناتك كلها موجودة ومحفوظة وتقدر تشوفها وتطبعها. بس التعديل والإضافة مقفولين لحد ما تجدد الاشتراك.
        <br />
        كلّم MK-Tech عشان تجدد، وكل حاجة هترجع تشتغل على طول.
      </div>
    </div>
  );
}
