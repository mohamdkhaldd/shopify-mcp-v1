import { BrowserWindow, dialog } from "electron";
import { buildWorkbook, ExcelSheet } from "./workbook";

export type { ExcelColumn, ExcelSheet } from "./workbook";

// Generic "Excel" button: any table or statement the screen shows is sent here
// as columns + rows and saved as a right-to-left workbook.
export async function exportExcel(win: BrowserWindow, fileName: string, sheets: ExcelSheet[]) {
  const r = await dialog.showSaveDialog(win, { defaultPath: `${fileName}.xlsx`, filters: [{ name: "Excel", extensions: ["xlsx"] }] });
  if (r.canceled || !r.filePath) return null;
  await buildWorkbook(sheets).xlsx.writeFile(r.filePath);
  return r.filePath;
}
