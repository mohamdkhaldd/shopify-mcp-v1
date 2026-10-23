import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// The Android build: the same screens (src/) and the same core/ running inside
// a Capacitor app, with tablet/backend.ts in place of Electron's main process.
export default defineConfig({
  root: path.resolve(__dirname, "tablet"),
  publicDir: path.resolve(__dirname, "public"),
  plugins: [react()],
  base: "./",
  define: { __APP_VERSION__: JSON.stringify(process.env.APP_VERSION ?? "0.0.0") },
  build: { outDir: path.resolve(__dirname, "dist-tablet"), emptyOutDir: true },
});
