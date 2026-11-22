import { createContext, ReactNode, useContext, useEffect, useState } from "react";

type Theme = "light" | "dark";

const STORAGE_KEY = "al-bunyan-theme";

export const ACCENTS = [
  { id: "blue", label: "أزرق", color: "#2f5bea" },
  { id: "green", label: "أخضر", color: "#138a5e" },
  { id: "teal", label: "تركواز", color: "#0b8fa3" },
  { id: "orange", label: "برتقالي", color: "#ea6a0c" },
  { id: "indigo", label: "نيلي", color: "#5145e0" },
  { id: "rose", label: "توتي", color: "#d4335f" },
  { id: "ink", label: "أسود", color: "#1d2430" },
] as const;
export type Accent = (typeof ACCENTS)[number]["id"];
const ACCENT_KEY = "ops-accent";

interface ThemeContextValue {
  theme: Theme;
  toggle: () => void;
  accent: Accent;
  setAccent: (a: Accent) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function getInitialTheme(): Theme {
  return localStorage.getItem(STORAGE_KEY) === "dark" ? "dark" : "light";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(getInitialTheme);
  const [accent, setAccent] = useState<Accent>(() => {
    const saved = localStorage.getItem(ACCENT_KEY);
    return (ACCENTS.find((a) => a.id === saved)?.id ?? "blue") as Accent;
  });
  useEffect(() => {
    document.documentElement.dataset.accent = accent;
    localStorage.setItem(ACCENT_KEY, accent);
  }, [accent]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  const toggle = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

  return <ThemeContext.Provider value={{ theme, toggle, accent, setAccent }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx;
}

/** اللون الأساسي كـ hex — للرسومات (recharts محتاج لون حقيقي مش متغيّر) */
export function useAccentColor() {
  const { accent } = useTheme();
  return ACCENTS.find((a) => a.id === accent)?.color ?? ACCENTS[0].color;
}
