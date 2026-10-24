import { defineConfig, Plugin } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// The Android / web build: the same screens and backends as the laptop —
// التأجير (src/, core/) and التشغيل (operations/) — running inside a
// Capacitor app or a browser, with tablet/backend.ts in place of Electron's
// main process.

// The operations backend asks for "electron" (ipcMain) and its "./sync"
// (Supabase over Node's ws): on the tablet both are small stand-ins.
const operationsShims = (): Plugin => ({
  name: "operations-shims",
  enforce: "pre",
  resolveId(source, importer) {
    if (!importer || !/[\\/]operations[\\/]electron[\\/]/.test(importer)) return null;
    if (source === "electron") return path.resolve(__dirname, "operations/tablet/electronShim.js");
    if (source === "./sync") return path.resolve(__dirname, "operations/tablet/syncShim.js");
    return null;
  },
});

export default defineConfig({
  root: path.resolve(__dirname, "tablet"),
  publicDir: path.resolve(__dirname, "public"),
  plugins: [operationsShims(), react()],
  base: "./",
  define: { __APP_VERSION__: JSON.stringify(process.env.APP_VERSION ?? "0.0.0") },
  build: {
    outDir: path.resolve(__dirname, "dist-tablet"),
    emptyOutDir: true,
    commonjsOptions: { include: [/operations[\\/]electron[\\/]/, /node_modules/], transformMixedEsModules: true },
  },
});
