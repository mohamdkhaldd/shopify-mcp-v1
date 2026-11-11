export type SectionId = "home" | "assistant" | "sarki" | "suppliers" | "drivers" | "clients" | "management" | "expenses" | "investors" | "treasury" | "tax" | "activity" | "settings";

/** المساعد بيفتح صفحة (وممكن يطلع منها PDF): window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail })) */
export const OPEN_EVENT = "mk-open";
export interface OpenRequest {
  page: SectionId;
  /** صاحب معدة / شركة / عقد (السركي) / سواق */
  id?: number;
  month?: string;
  pdf?: boolean;
  /** أصحاب المعدات: أنهي تاب (full = الملف الكامل) */
  tab?: string;
}

export interface NavItem {
  id: SectionId;
  label: string;
  icon: string;
}

export const navItems: NavItem[] = [
  { id: "home", label: "الرئيسية", icon: "home" },
  { id: "assistant", label: "المساعد", icon: "assistant" },
  { id: "sarki", label: "السركي", icon: "sarki" },
  { id: "suppliers", label: "أصحاب المعدات", icon: "suppliers" },
  { id: "drivers", label: "السواقين", icon: "drivers" },
  { id: "clients", label: "الشركات ومقاولين الباطن", icon: "clients" },
  { id: "management", label: "الإدارة", icon: "management" },
  { id: "expenses", label: "الهالك", icon: "expenses" },
  { id: "investors", label: "المستثمرين", icon: "investors" },
  { id: "treasury", label: "الخزنة", icon: "treasury" },
  { id: "tax", label: "الضرايب والإقرارات", icon: "tax" },
];

export const footerItems: NavItem[] = [
  { id: "activity", label: "سجل التعديلات", icon: "history" },
  { id: "settings", label: "الإعدادات", icon: "settings" },
];
