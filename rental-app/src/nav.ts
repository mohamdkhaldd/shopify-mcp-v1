export type SectionId = "home" | "sarki" | "suppliers" | "clients" | "management" | "investors" | "treasury" | "tax" | "activity" | "settings";

export interface NavItem {
  id: SectionId;
  label: string;
  icon: string;
}

export const navItems: NavItem[] = [
  { id: "home", label: "الرئيسية", icon: "home" },
  { id: "sarki", label: "السركي", icon: "sarki" },
  { id: "suppliers", label: "أصحاب المعدات", icon: "suppliers" },
  { id: "clients", label: "الشركات والأفراد", icon: "clients" },
  { id: "management", label: "الإدارة", icon: "management" },
  { id: "investors", label: "المستثمرين", icon: "investors" },
  { id: "treasury", label: "الخزنة", icon: "treasury" },
  { id: "tax", label: "الملف الضريبي", icon: "tax" },
];

export const footerItems: NavItem[] = [
  { id: "activity", label: "سجل التعديلات", icon: "history" },
  { id: "settings", label: "الإعدادات", icon: "settings" },
];
