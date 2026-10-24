import { createContext, ReactNode, useContext, useEffect, useState } from "react";

// The customer's own company on screen and on paper (MK-Tech): name and logo
// come with the activation code, from the shell (license:status).
export interface Brand {
  /** short name for the header, e.g. "البنيان" */
  name: string;
  /** legal name for printouts */
  customer: string;
  /** image src, or null for a letter badge */
  logo: string | null;
  /** the programs this code opens */
  products: string[];
}

const fallback: Brand = { name: "التشغيل", customer: "", logo: null, products: ["operations"] };
const BrandContext = createContext<Brand>(fallback);

type Status = { state: string; name?: string; customer?: string; logo?: string | null; products?: string[] };
const toBrand = (s: Status | undefined): Brand =>
  s?.state === "active"
    ? { name: s.name ?? "", customer: s.customer ?? s.name ?? "", logo: s.logo === "bundled" ? "./logo.png" : s.logo ?? null, products: s.products ?? ["operations"] }
    : fallback;

export function BrandProvider({ children }: { children: ReactNode }) {
  const [brand, setBrand] = useState<Brand>(fallback);
  useEffect(() => {
    const api = window.api;
    if (!api) return;
    api.invoke("license:status").then((s) => setBrand(toBrand(s as Status)), () => {});
    return api.on("license:changed", (s) => setBrand(toBrand(s as Status)));
  }, []);
  useEffect(() => {
    document.title = brand.name && brand !== fallback ? `${brand.name} - التشغيل` : "MK-Tech التشغيل";
  }, [brand]);
  return <BrandContext.Provider value={brand}>{children}</BrandContext.Provider>;
}

export const useBrand = () => useContext(BrandContext);

/** First meaningful letter: "النور" → "ن", "شركة الفجر" → "ف". */
export const initial = (name: string) => name.trim().replace(/^(شركة|مؤسسة|مكتب)\s+/, "").replace(/^ال(?=\S{2})/, "").charAt(0);
