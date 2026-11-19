import { person } from "./person";

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
  /** عنوان المجموعة اللي فوق البند (أول بند في كل مجموعة بس) */
  group?: string;
}

// الترتيب: الشغل اليومي الأول، وبعدين المواعيد والمتابعة، وبعدين الحسابات والفلوس في الآخر
export const navItems: NavItem[] = [
  { id: "home", label: "الرئيسية", icon: "home" },
  { id: "equipment", label: "المعدات", icon: "equipment", group: "الشغل" },
  { id: "contractors", label: "المقاولين", icon: "contractors" },
  { id: "partners", label: "الشركاء", icon: "partners" },
  { id: "salaries", label: "السائقين", icon: "salaries" },
  { id: "custody", label: "العهد", icon: "custody" },
  { id: "car", label: "السيارات", icon: "car" },
  { id: "obligations", label: "الالتزامات والمستحقات", icon: "calendar", group: "المتابعة" },
  { id: "suppliers", label: "الموردين", icon: "suppliers" },
  { id: "outgoingIncoming", label: "الصادر والوارد", icon: "flow" },
  { id: "reports", label: "التقارير", icon: "reports" },
  { id: "activity", label: "سجل التعديلات", icon: "history" },
  { id: "hassan", label: "صاحب الكوميشن", icon: "hassan", group: "الحسابات" },
  { id: "treasury", label: "الخزنة", icon: "treasury" },
  { id: "payables", label: "الرصيد", icon: "balance" },
  { id: "settings", label: "الإعدادات", icon: "settings" },
];

/** The commission page is named after the person (each company types it in Settings). */
export const navLabel = (item: NavItem) => (item.id === "hassan" ? person() : item.label);
