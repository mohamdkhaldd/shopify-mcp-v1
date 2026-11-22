import { fileURLToPath } from "node:url";

// The operations program keeps the old app's own look (green primary, Cairo),
// separate from the rental program's theme.
const here = (p) => fileURLToPath(new URL(p, import.meta.url));

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: [here("./index.html"), here("./src/**/*.{ts,tsx}")],
  theme: {
    extend: {
      colors: {
        // اللون الأساسي جاي من متغيّر (--accent) — بيتغيّر من اختيار اللون
        primary: {
          DEFAULT: "rgb(var(--accent) / <alpha-value>)",
          dark: "rgb(var(--accent-dark) / <alpha-value>)",
          light: "rgb(var(--accent-light) / <alpha-value>)",
        },
      },
      fontFamily: {
        cairo: ["Readex Pro", "Cairo", "Segoe UI", "Tahoma", "sans-serif"],
      },
      borderRadius: {
        card: "14px",
      },
      boxShadow: {
        card: "0 0 0 1px rgba(20, 23, 28, 0.06), 0 1px 2px rgba(20, 23, 28, 0.04), 0 4px 14px rgba(20, 23, 28, 0.04)",
      },
    },
  },
  plugins: [],
};
