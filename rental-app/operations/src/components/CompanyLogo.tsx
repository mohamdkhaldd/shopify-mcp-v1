import { useState } from "react";
import { initial, useBrand } from "../brand";

// The customer's logo (it comes with the activation code), or the first letter
// of its name when there's none.
export default function CompanyLogo() {
  const brand = useBrand();
  const [failed, setFailed] = useState<string | null>(null);

  if (!brand.logo || failed === brand.logo) {
    return (
      <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-white font-extrabold text-lg shrink-0">
        {initial(brand.name) || "م"}
      </div>
    );
  }

  return (
    <img
      src={brand.logo}
      alt=""
      className="w-10 h-10 rounded-xl object-contain bg-primary-light shrink-0"
      onError={() => setFailed(brand.logo)}
    />
  );
}
