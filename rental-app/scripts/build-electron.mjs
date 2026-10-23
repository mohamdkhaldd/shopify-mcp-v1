// Bundles the Electron main/preload (TypeScript, plus the shared core/) into
// dist-electron/*.cjs. Every library is bundled in (the installer once left out
// a nested dependency of exceljs and the app crashed on start); only Electron
// and the native better-sqlite3 stay outside. bufferutil / utf-8-validate are
// optional speed-ups ws tries to load and falls back without.
import { build } from "esbuild";

const common = {
  bundle: true,
  platform: "node",
  target: "node20",
  format: "cjs",
  sourcemap: true,
  external: ["electron", "better-sqlite3", "bufferutil", "utf-8-validate"],
  logLevel: "info",
};

await Promise.all([
  build({ ...common, entryPoints: ["electron/main.ts"], outfile: "dist-electron/main.cjs" }),
  build({ ...common, entryPoints: ["electron/preload.ts"], outfile: "dist-electron/preload.cjs" }),
]);
