import { fileURLToPath } from "node:url";

// شكل التشغيل: كحلي رسمي + لمسة كهرماني (ألوان شركات المعدات التقيلة)،
// وخط IBM Plex Sans Arabic — منفصل عن شكل التأجير.
const here = (p) => fileURLToPath(new URL(p, import.meta.url));

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: [here("./index.html"), here("./src/**/*.{ts,tsx}")],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#1D4E89",
          dark: "#123764",
          light: "#E8EFF8",
        },
        navy: {
          DEFAULT: "#0E2540",
          soft: "#16314F",
          line: "#23415F",
        },
        accent: {
          DEFAULT: "#F2A516",
          dark: "#C98505",
          light: "#FEF5E2",
        },
      },
      fontFamily: {
        cairo: ["IBM Plex Sans Arabic", "Cairo", "sans-serif"],
      },
      borderRadius: {
        card: "14px",
      },
      boxShadow: {
        card: "0 1px 2px 0 rgba(15, 30, 55, 0.05), 0 0 0 1px rgba(15, 30, 55, 0.06)",
      },
    },
  },
  plugins: [],
};
