import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Produces a build with every asset (including fonts) inlined as base64, so
// the output can be stitched into a single self-contained HTML file for
// preview purposes (Claude Artifacts, sharing a live demo link, etc.).
// The normal vite.config.ts (used by npm run dev / build / electron) is
// untouched — this is a separate, one-off build target.
export default defineConfig({
  plugins: [react()],
  base: "./",
  build: {
    outDir: "dist-artifact",
    assetsInlineLimit: 100_000_000,
    cssCodeSplit: false,
  },
});
