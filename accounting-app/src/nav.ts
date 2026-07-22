export type SectionId =
  | "home"
  | "equipment"
  | "salaries"
  | "hassan"
  | "contractors"
  | "partners"
  | "treasury"
  | "outgoingIncoming"
  | "waste"
  | "suppliers"
  | "reports"
  | "settings";

export interface NavItem {
  id: SectionId;
  label: string;
  icon: string;
}

export const navItems: NavItem[] = [
  { id: "home", label: "الرئيسية", icon: "home" },
  { id: "equipment", label: "المعدات", icon: "equipment" },
  { id: "salaries", label: "الرواتب", icon: "salaries" },
  { id: "hassan", label: "حسن", icon: "hassan" },
  { id: "contractors", label: "المقاولين", icon: "contractors" },
  { id: "partners", label: "الشركاء", icon: "partners" },
  { id: "treasury", label: "الخزنة", icon: "treasury" },
  { id: "outgoingIncoming", label: "الصادر والوارد", icon: "flow" },
  { id: "waste", label: "الهالك", icon: "waste" },
  { id: "suppliers", label: "الموردين", icon: "suppliers" },
  { id: "reports", label: "التقارير", icon: "reports" },
  { id: "settings", label: "الإعدادات", icon: "settings" },
];
