import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// بناء نسخة التابلت: نفس شاشات البرنامج (src/) + نفس كود الحسابات من
// electron/ (بيتحول من CommonJS وقت البناء) شغالين جوه تطبيق أندرويد.
export default defineConfig({
  root: path.resolve(__dirname, "tablet"),
  publicDir: path.resolve(__dirname, "public"),
  plugins: [react()],
  base: "./",
  define: {
    __APP_VERSION__: JSON.stringify(process.env.APP_VERSION ?? "0.0.0"),
  },
  resolve: {
    alias: [
      { find: /^electron$/, replacement: path.resolve(__dirname, "tablet/electronShim.js") },
      { find: /^\.\/sync$/, replacement: path.resolve(__dirname, "tablet/syncShim.js") },
    ],
  },
  build: {
    outDir: path.resolve(__dirname, "dist-tablet"),
    emptyOutDir: true,
    commonjsOptions: { include: [/electron[\\/]/, /node_modules/], transformMixedEsModules: true },
  },
});
