import { useEffect, useState } from "react";
import { licenseApi, LicenseStatus } from "../api/client";

/** الاشتراك خلص: شريط أحمر فوق كل الصفحات — البرنامج للعرض بس لحد ما يتجدد. */
export default function ExpiredBar() {
  const [s, setS] = useState<LicenseStatus | null>(null);
  useEffect(() => {
    licenseApi.status().then(setS, () => {});
    return licenseApi.onChanged(setS);
  }, []);
  if (s?.state !== "active" || !s.expired) return null;
  return (
    <div className="no-print mb-4 rounded-2xl bg-rose-600 text-white px-5 py-4 shadow-card max-[1023px]:mt-3" role="alert">
      <div className="text-lg font-bold">اشتراكك خلص{s.expiresAt ? ` يوم ${s.expiresAt}` : ""}</div>
      <div className="text-sm mt-1 leading-relaxed">
        متقلقش، بياناتك كلها موجودة ومحفوظة وتقدر تشوفها وتطبعها. بس التعديل والإضافة مقفولين لحد ما تجدد الاشتراك.
        <br />
        كلّم MK-Tech عشان تجدد، وكل حاجة هترجع تشتغل على طول.
      </div>
    </div>
  );
}
