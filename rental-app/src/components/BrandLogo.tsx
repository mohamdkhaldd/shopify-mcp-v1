import { useBrand } from "../context/BrandContext";

/** First meaningful letter: "النور" → "ن", "شركة الفجر" → "ف". */
const initial = (name: string) => name.trim().replace(/^(شركة|مؤسسة|مكتب)\s+/, "").replace(/^ال(?=\S{2})/, "").charAt(0);

/** The customer's logo, or the first letter of its name in a circle. */
export default function BrandLogo({ className = "" }: { className?: string }) {
  const brand = useBrand();
  if (brand.logo) return <img src={brand.logo} alt="" className={`${className} rounded-full bg-white object-contain`} />;
  return (
    <span className={`${className} rounded-full bg-amber text-ink font-display font-bold flex items-center justify-center text-lg`} aria-hidden>
      {initial(brand.name)}
    </span>
  );
}
