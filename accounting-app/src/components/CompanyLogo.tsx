import { useState } from "react";

// Drop the real logo file at public/logo.png (or .svg — update the src
// below) and it replaces this fallback automatically, no other code changes
// needed.
export default function CompanyLogo() {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-white font-extrabold text-lg shrink-0">
        ب
      </div>
    );
  }

  return (
    <img
      src="./logo.png"
      alt="شعار شركة البنيان"
      className="w-10 h-10 rounded-xl object-contain bg-primary-light shrink-0"
      onError={() => setFailed(true)}
    />
  );
}
