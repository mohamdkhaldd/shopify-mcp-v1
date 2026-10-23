import ExcelJS from "exceljs";

// The right-to-left workbook behind every "Excel" button — shared by the
// laptop (saved with a file dialog) and the tablet (shared to WhatsApp/Drive).

export interface ExcelColumn {
  header: string;
  key: string;
  /** values are integer piasters → written as pounds with a #,##0.00 format */
  money?: boolean;
  width?: number;
}

export interface ExcelSheet {
  title: string;
  columns: ExcelColumn[];
  rows: Record<string, string | number | null>[];
  totals?: Record<string, string | number | null>;
}

export function buildWorkbook(sheets: ExcelSheet[]) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "MK-Tech";
  for (const s of sheets) {
    const ws = wb.addWorksheet(s.title.slice(0, 31).replace(/[\\/?*[\]:]/g, "-"), { views: [{ rightToLeft: true, state: "frozen", ySplit: 1 }] });
    ws.columns = s.columns.map((c) => ({ header: c.header, key: c.key, width: c.width ?? Math.max(12, c.header.length + 4) }));
    const conv = (row: Record<string, string | number | null>) =>
      Object.fromEntries(s.columns.map((c) => [c.key, c.money && typeof row[c.key] === "number" ? (row[c.key] as number) / 100 : row[c.key] ?? null]));
    for (const row of s.rows) ws.addRow(conv(row));
    if (s.totals) ws.addRow(conv(s.totals)).font = { bold: true };
    ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF16233F" } };
    s.columns.forEach((c, i) => {
      if (c.money) ws.getColumn(i + 1).numFmt = "#,##0.00";
    });
  }
  return wb;
}
