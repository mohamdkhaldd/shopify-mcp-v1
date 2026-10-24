export type SectionId =
  | "home"
  | "equipment"
  | "salaries"
  | "hassan"
  | "contractors"
  | "partners"
  | "treasury"
  | "outgoingIncoming"
  | "payables"
  | "suppliers"
  | "reports"
  | "activity"
  | "custody"
  | "car"
  | "obligations"
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
  { id: "custody", label: "العهد", icon: "custody" },
  { id: "obligations", label: "المواعيد والالتزامات", icon: "calendar" },
  { id: "car", label: "العربية الملاكي", icon: "car" },
  { id: "outgoingIncoming", label: "الصادر والوارد", icon: "flow" },
  { id: "payables", label: "الرصيد", icon: "balance" },
  { id: "suppliers", label: "الموردين", icon: "suppliers" },
  { id: "reports", label: "التقارير", icon: "reports" },
  { id: "activity", label: "سجل التعديلات", icon: "history" },
  { id: "settings", label: "الإعدادات", icon: "settings" },
];
