/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#2F8F63",
          dark: "#256F4D",
          light: "#E8F5EF",
        },
      },
      fontFamily: {
        cairo: ["Cairo", "sans-serif"],
      },
      borderRadius: {
        card: "16px",
      },
      boxShadow: {
        card: "0 2px 10px 0 rgba(16, 24, 40, 0.06)",
      },
    },
  },
  plugins: [],
};
