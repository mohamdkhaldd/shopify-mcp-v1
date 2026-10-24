import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "tailwindcss";
import autoprefixer from "autoprefixer";
import path from "path";

// التشغيل's screens (operations/src): built next to the rental screens, into
// dist/operations, with their own Tailwind theme.
export default defineConfig({
  root: path.resolve(__dirname, "operations"),
  publicDir: path.resolve(__dirname, "public"),
  plugins: [react()],
  base: "./",
  css: { postcss: { plugins: [tailwindcss({ config: path.resolve(__dirname, "operations/tailwind.config.js") }), autoprefixer()] } },
  build: { outDir: path.resolve(__dirname, "dist/operations"), emptyOutDir: true },
});
