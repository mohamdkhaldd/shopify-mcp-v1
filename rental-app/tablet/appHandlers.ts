import { registerPlugin } from "@capacitor/core";
import { Directory, Filesystem } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import { buildWorkbook, ExcelSheet } from "../electron/workbook";

// Tablet versions of what Electron's main process does on the laptop:
// printing (Android print — a printer or "Save as PDF"), Excel and backups
// (shared to WhatsApp / Drive / Files), and updates (download the new APK).
// In the web version: the browser's print, files downloaded, and no updates
// to install (the page always loads the latest version).

// small plugins inside the app: tablet/android/PrinterPlugin.java, UpdaterPlugin.java
const Printer = registerPlugin<{ print(o: { name: string }): Promise<void> }>("Printer");
const Updater = registerPlugin<{
  downloadAndInstall(o: { url: string }): Promise<void>;
  addListener(e: "progress", cb: (i: { percent: number }) => void): Promise<{ remove(): void }>;
}>("Updater");

/** Its own public releases repo (installers only), tablet builds tagged tablet-vX.Y.Z. */
const RELEASES = "mohamdkhaldd/mk-tech";
declare const __APP_VERSION__: string;
const VERSION = typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "0.0.0";

function newer(a: string, b: string) {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) > (pb[i] ?? 0);
  return false;
}

function base64(bytes: Uint8Array) {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

function downloadFile(name: string, bytes: Uint8Array) {
  const url = URL.createObjectURL(new Blob([bytes as unknown as BlobPart], { type: "application/octet-stream" }));
  const a = document.createElement("a");
  a.href = url;
  a.setAttribute("download", name);
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return name;
}

async function shareFile(name: string, bytes: Uint8Array, title: string) {
  const { uri } = await Filesystem.writeFile({ path: name, data: base64(bytes), directory: Directory.Cache });
  await Share.share({ title, files: [uri] });
  return name;
}

// Like the laptop, a statement prints on one A4 sheet: Android's print doesn't
// shrink by itself, so measure the page at A4 width with the print CSS in a
// hidden frame and lower the base font size (all sizes are rem) until it fits.
// Same method as the old app's tablet.
const A4_PRINTABLE_PX = { width: 733, height: 1062 };
const BASE_PRINT_FONT_PX = 10;
function fitPrintToOnePage() {
  const allCss: string[] = [];
  const printCss: string[] = [];
  for (const sheet of Array.from(document.styleSheets)) {
    let rules: CSSRuleList;
    try {
      rules = sheet.cssRules;
    } catch {
      continue;
    }
    for (const rule of Array.from(rules)) {
      if (rule instanceof CSSMediaRule && rule.media.mediaText.includes("print")) {
        for (const inner of Array.from(rule.cssRules)) if (!(inner instanceof CSSPageRule)) printCss.push(inner.cssText);
      } else allCss.push(rule.cssText);
    }
  }
  const frame = document.createElement("iframe");
  frame.style.cssText = `position:fixed;left:-10000px;top:0;width:${A4_PRINTABLE_PX.width}px;height:10px;border:0;visibility:hidden;`;
  document.body.appendChild(frame);
  const clone = document.documentElement.cloneNode(true) as HTMLElement;
  clone.querySelectorAll("script, link[rel='stylesheet'], style").forEach((el) => el.remove());
  const doc = frame.contentDocument!;
  doc.open();
  doc.write(`<!doctype html>${clone.outerHTML}`);
  doc.close();
  const style = doc.createElement("style");
  doc.head.appendChild(style);
  const measure = (fontPx: number) => {
    style.textContent = `${allCss.join("\n")}\n${printCss.join("\n")}\nhtml { font-size: ${fontPx}px !important; }`;
    return { h: Math.max(doc.body.scrollHeight, doc.documentElement.scrollHeight), w: Math.max(doc.body.scrollWidth, doc.documentElement.scrollWidth) };
  };
  const widthMatters = measure(3).w <= A4_PRINTABLE_PX.width + 2;
  const fits = (fontPx: number) => {
    const { h, w } = measure(fontPx);
    return h <= A4_PRINTABLE_PX.height * 0.88 && (!widthMatters || w <= A4_PRINTABLE_PX.width + 2);
  };
  let font = BASE_PRINT_FONT_PX;
  if (!fits(font)) {
    let lo = 3;
    let hi = BASE_PRINT_FONT_PX;
    for (let i = 0; i < 8; i++) {
      const mid = (lo + hi) / 2;
      if (fits(mid)) lo = mid;
      else hi = mid;
    }
    font = lo;
  }
  frame.remove();
  const printFont = document.createElement("style");
  printFont.textContent = `@media print { html { font-size: ${font.toFixed(2)}px !important; } }`;
  document.head.appendChild(printFont);
  return () => printFont.remove();
}

async function print(singlePage: boolean, native: boolean) {
  const cleanup = singlePage ? fitPrintToOnePage() : () => {};
  try {
    if (!native) throw new Error("web");
    await Printer.print({ name: document.title || "MK-Tech" });
  } catch {
    window.print();
  } finally {
    setTimeout(cleanup, native ? 60000 : 1000);
  }
}

export function tabletAppHandlers(emit: (channel: string, data: unknown) => void, databaseFile: () => Uint8Array, native = true) {
  const deliver = (name: string, bytes: Uint8Array, title: string) => (native ? shareFile(name, bytes, title) : downloadFile(name, bytes));
  return {
    "app:getVersion": () => VERSION,
    // no silent install on Android: a newer APK comes back as a link, the
    // screen offers it, and Android asks once to install it over this one
    "app:checkForUpdate": async () => {
      if (!native) return { state: "not-available", version: VERSION };
      try {
        const res = await fetch(`https://api.github.com/repos/${RELEASES}/releases?per_page=20`);
        if (!res.ok) throw new Error(`GitHub ${res.status}`);
        const releases = (await res.json()) as { tag_name?: string; assets?: { name: string; browser_download_url: string }[] }[];
        const latest = releases
          .filter((r) => r.tag_name?.startsWith("tablet-v"))
          .map((r) => ({ version: r.tag_name!.slice("tablet-v".length), asset: r.assets?.find((a) => a.name.endsWith(".apk")) }))
          .filter((r) => r.asset)
          .sort((x, y) => (newer(x.version, y.version) ? -1 : 1))[0];
        if (latest && newer(latest.version, VERSION)) return { state: "apk", version: latest.version, url: latest.asset!.browser_download_url };
        return { state: "not-available", version: VERSION };
      } catch (err) {
        return { state: "error", message: String((err as Error)?.message ?? err) };
      }
    },
    "app:installUpdate": async ({ url }: { url?: string }) => {
      if (!url) return { ok: false };
      const sub = await Updater.addListener("progress", (info) => emit("app:updateProgress", info));
      try {
        await Updater.downloadAndInstall({ url });
        return { ok: true };
      } catch (err) {
        // first time: Android opens "allow installing updates"; after allowing, tap again
        if (String((err as Error)?.message ?? err).includes("NEEDS_PERMISSION")) return { ok: false, message: "اسمح للبرنامج يسطّب التحديثات من الشاشة اللي اتفتحت، وبعدين دوس تاني" };
        return { ok: false, message: String((err as Error)?.message ?? err) };
      } finally {
        sub.remove();
      }
    },
    "print:preview": ({ singlePage = true }: { singlePage?: boolean }) => print(singlePage, native),
    // Android's and the browser's print screens both have "Save as PDF"
    "print:savePdf": () => print(true, native),
    "export:excel": async ({ fileName, sheets }: { fileName: string; sheets: ExcelSheet[] }) => {
      const buf = await buildWorkbook(sheets).xlsx.writeBuffer();
      return deliver(`${fileName}.xlsx`, new Uint8Array(buf as ArrayBuffer), fileName);
    },
    // the tablet's real backup is the cloud copy; this shares the file by hand
    "backup:last": () => null,
    "backup:now": () => deliver(`نسخة-التأجير-${new Date().toLocaleDateString("en-CA")}.db`, databaseFile(), "نسخة احتياطية"),
    "backup:restore": () => ({ ok: false, message: "الرجوع لنسخة قديمة بيتعمل من اللاب — التابلت بياخد كل البيانات من المزامنة" }),
  };
}
