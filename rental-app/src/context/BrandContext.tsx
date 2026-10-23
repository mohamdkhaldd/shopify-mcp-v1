import { createContext, useContext } from "react";

// The customer's own company on screen and on paper: name and logo come with
// the activation code (licenses.display_name / customer / logo_url).
export interface Brand {
  /** short name for the app's header, e.g. "البنيان" */
  name: string;
  /** legal name for printouts, e.g. "شركة البنيان للمعدات الثقيلة" */
  customer: string;
  /** image src, or null for a letter badge */
  logo: string | null;
  /** first signature line on printouts */
  signature: string;
}

export function brandFrom(s: { name: string; customer: string; logo: string | null }): Brand {
  const company = s.customer.startsWith("شركة") ? s.customer : `شركة ${s.name}`;
  return { name: s.name, customer: s.customer, logo: s.logo === "bundled" ? "./logo.png" : s.logo, signature: `توقيع ${company}` };
}

export const BrandContext = createContext<Brand>(brandFrom({ name: "التأجير", customer: "التأجير", logo: null }));
export const useBrand = () => useContext(BrandContext);
