import { defineConfig, Plugin } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import fs from "fs";
import crypto from "crypto";

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

// The web version's offline copy (tablet/web/sw.js): it lists every file of
// this build. The Android app has its files inside it and doesn't use it.
const storageName = process.env.PREVIEW ? "mk-tech-preview" : "albunyan-rental";
const offlineCopy = (): Plugin => ({
  name: "offline-copy",
  apply: "build",
  // after writing: by then the build has dropped its empty chunks
  writeBundle(opts, bundle) {
    const publicDir = path.resolve(__dirname, "public");
    const files = ["index.html", ...Object.keys(bundle).filter((f) => f !== "index.html"), ...fs.readdirSync(publicDir)].sort();
    const version = crypto.createHash("sha256").update(files.join("\n")).digest("hex").slice(0, 12);
    const source = fs
      .readFileSync(path.resolve(__dirname, "tablet/web/sw.js"), "utf8")
      .replace("__VERSION__", JSON.stringify(version))
      .replace("__PREFIX__", JSON.stringify(`${storageName}:`))
      .replace("__FILES__", JSON.stringify(files));
    fs.writeFileSync(path.join(opts.dir!, "sw.js"), source);
  },
});

export default defineConfig({
  root: path.resolve(__dirname, "tablet"),
  publicDir: path.resolve(__dirname, "public"),
  plugins: [operationsShims(), react(), offlineCopy()],
  base: "./",
  define: {
    __APP_VERSION__: JSON.stringify(process.env.APP_VERSION ?? "0.0.0"),
    __STORAGE_NAME__: JSON.stringify(storageName),
  },
  build: {
    outDir: path.resolve(__dirname, process.env.PREVIEW ? "dist-preview" : "dist-tablet"),
    emptyOutDir: true,
    commonjsOptions: { include: [/operations[\\/]electron[\\/]/, /node_modules/], transformMixedEsModules: true },
  },
});
