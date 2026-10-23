import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { BrowserWindow, WebContents } from "electron";

// Ported from the old app (accounting-app/electron/main.js): Electron has no
// print preview, so we render a real PDF of the page with the print styles and
// open it in an in-app window that has its own print button.

function countPdfPages(buffer: Buffer) {
  return (buffer.toString("latin1").match(/\/Type\s*\/Page(?![a-zA-Z])/g) ?? []).length;
}

/** Short sheets shrink to one A4 page (old behaviour); long statements may run onto more pages. */
async function renderPdf(wc: WebContents, singlePage: boolean) {
  const options = { printBackground: true, pageSize: "A4" as const, margins: { marginType: "default" as const } };
  let scale = 1;
  let pdf = await wc.printToPDF({ ...options, scale });
  if (!singlePage) return pdf;
  for (let attempt = 0; attempt < 8; attempt++) {
    const pages = countPdfPages(pdf);
    if (pages <= 1 || scale <= 0.2) break;
    scale = Math.max(0.2, Math.min(scale * 0.92, scale / Math.sqrt(pages) - 0.02));
    pdf = await wc.printToPDF({ ...options, scale: Number(scale.toFixed(2)) });
  }
  return pdf;
}

let previewWindow: BrowserWindow | null = null;

export async function printPreview(source: BrowserWindow, iconPath: string, singlePage: boolean) {
  const pdf = await renderPdf(source.webContents, singlePage);
  const file = path.join(os.tmpdir(), `albunyan-rental-print-${Date.now()}.pdf`);
  fs.writeFileSync(file, pdf);
  if (previewWindow && !previewWindow.isDestroyed()) previewWindow.close();
  previewWindow = new BrowserWindow({
    width: 900,
    height: 1000,
    title: "معاينة الطباعة",
    icon: iconPath,
    webPreferences: { plugins: true, contextIsolation: true, nodeIntegration: false },
  });
  previewWindow.setMenuBarVisibility(false);
  previewWindow.on("closed", () => (previewWindow = null));
  await previewWindow.loadURL(`file://${file}`);
}

/** "PDF" button: same rendering, saved where the user chooses. */
export async function savePdf(source: BrowserWindow, file: string) {
  fs.writeFileSync(file, await renderPdf(source.webContents, false));
  return file;
}
