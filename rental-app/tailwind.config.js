/** @type {import('tailwindcss').Config} */
// Colours are CSS variables (see src/index.css) so the dark theme only swaps values.
const v = (name) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: v("ink"), 2: v("ink-2") },
        amber: { DEFAULT: v("amber"), soft: v("amber-soft"), deep: v("amber-deep") },
        canvas: v("bg"),
        surface: { DEFAULT: v("surface"), 2: v("surface-2") },
        line: v("line"),
        fg: v("fg"),
        muted: v("muted"),
        in: { DEFAULT: v("in"), soft: v("in-soft") },
        out: { DEFAULT: v("out"), soft: v("out-soft") },
        tax: { DEFAULT: v("tax"), soft: v("tax-soft") },
        side: v("side-fg"),
        hero: v("hero"),
      },
      fontFamily: {
        display: ['"Noto Kufi Arabic"', "Cairo", "Tahoma", "sans-serif"],
        body: ["Cairo", "Tahoma", '"Segoe UI"', "sans-serif"],
      },
      borderRadius: { card: "10px" },
    },
  },
  plugins: [],
};
