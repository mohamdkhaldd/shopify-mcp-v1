import { registerPlugin } from "@capacitor/core";

// طابعة أندرويد: plugin صغير جوه التطبيق (tablet/android/PrinterPlugin.java)
// بيطبع الصفحة الحالية بنظام الطباعة بتاع أندرويد (طابعة أو حفظ PDF).
const Printer = registerPlugin("Printer");
// التحديث: plugin جوه التطبيق (tablet/android/UpdaterPlugin.java) بينزّل ملف
// النسخة الجديدة ويفتح شاشة التثبيت بتاعة أندرويد.
const Updater = registerPlugin("Updater");

const REPO = "mohamdkhaldd/shopify-mcp-v1";
// eslint-disable-next-line no-undef
const VERSION = typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "0.0.0";

function newer(a, b) {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) > (pb[i] ?? 0);
  }
  return false;
}

// زي اللاب: أي طباعة لازم تطلع ورقة A4 واحدة. نظام الطباعة بتاع أندرويد
// مبيصغّرش لوحده، فبنطبّق CSS الطباعة على الشاشة لحظة ونقيس طول الصفحة على
// عرض ورقة A4، ونصغّر حجم الخط الأساسي (كل المقاسات في البرنامج نسبة منه)
// لحد ما الصفحة تدخل في ورقة واحدة — والحجم ده بيتطبق وقت الطباعة بس.
const A4_PRINTABLE_PX = { width: 733, height: 1062 }; // 194×281 مم بعد هوامش 8 مم
const BASE_PRINT_FONT_PX = 10;
function fitPrintToOnePage() {
  const allCss = [];
  const printCss = [];
  for (const sheet of Array.from(document.styleSheets)) {
    let rules;
    try {
      rules = sheet.cssRules;
    } catch {
      continue;
    }
    for (const rule of Array.from(rules)) {
      if (rule instanceof CSSMediaRule && rule.media.mediaText.includes("print")) {
        for (const inner of Array.from(rule.cssRules)) if (!(inner instanceof CSSPageRule)) printCss.push(inner.cssText);
      } else {
        allCss.push(rule.cssText);
      }
    }
  }
  // بنقيس في إطار مخفي بعرض ورقة A4 بالظبط — عشان التقسيمات اللي بتتغير حسب
  // العرض (زي 4 مربعات جنب بعض على الشاشة) تترص زي ما هتطلع على الورق.
  const frame = document.createElement("iframe");
  // الإطار نفسه قصير جدًا: لو طوله طول الورقة، أي صفحة فيها min-h-screen
  // بتتقاس على إنها طول الورقة كله حتى لو المحتوى قصير — فكانت بتتصغر على الفاضي.
  frame.style.cssText = `position:fixed;left:-10000px;top:0;width:${A4_PRINTABLE_PX.width}px;height:10px;border:0;visibility:hidden;`;
  document.body.appendChild(frame);
  const clone = document.documentElement.cloneNode(true);
  clone.querySelectorAll("script, link[rel='stylesheet'], style").forEach((el) => el.remove());
  const doc = frame.contentDocument;
  doc.open();
  doc.write(`<!doctype html>${clone.outerHTML}`);
  doc.close();
  const style = doc.createElement("style");
  doc.head.appendChild(style);
  // لازم يدخل في الورقة طولًا وعرضًا (جدول عريض كان بيطلع مقطوع من الجنب) —
  // وبهامش أمان، لأن أندرويد بيرسم الطباعة بفروق بسيطة عن القياس هنا.
  const measure = (fontPx) => {
    style.textContent = `${allCss.join("\n")}\n${printCss.join("\n")}\nhtml { font-size: ${fontPx}px !important; }`;
    return {
      h: Math.max(doc.body.scrollHeight, doc.documentElement.scrollHeight),
      w: Math.max(doc.body.scrollWidth, doc.documentElement.scrollWidth),
    };
  };
  // العرض بيتحسب بس لو تصغير الخط بيفرق فيه (جدول عريض) — الرسوم البيانية
  // عرضها ثابت ومش بتصغر مع الخط، فمنصغّرش الصفحة كلها عشانها.
  const widthMatters = measure(3).w <= A4_PRINTABLE_PX.width + 2;
  const fits = (fontPx) => {
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

export function tabletAppHandlers(emit = () => {}) {
  return {
    "app:getVersion": () => VERSION,
    // نسخ التابلت بتتنشر على GitHub باسم tablet-vX.Y.Z — لو فيه أحدث من
    // النسخة المتسطبة بنرجّع لينك ملف الـ APK عشان المستخدم ينزّله.
    "app:checkForUpdate": async () => {
      try {
        const res = await fetch(`https://api.github.com/repos/${REPO}/releases?per_page=20`);
        if (!res.ok) throw new Error(`GitHub ${res.status}`);
        const releases = await res.json();
        const latest = releases
          .filter((r) => r.tag_name?.startsWith("tablet-v"))
          .map((r) => ({ version: r.tag_name.slice("tablet-v".length), asset: r.assets?.find((a) => a.name.endsWith(".apk")) }))
          .filter((r) => r.asset)
          .sort((x, y) => (newer(x.version, y.version) ? -1 : 1))[0];
        if (latest && newer(latest.version, VERSION)) {
          return { state: "apk", version: latest.version, url: latest.asset.browser_download_url };
        }
        return { state: "not-available", version: VERSION };
      } catch (err) {
        return { state: "error", message: String(err?.message ?? err) };
      }
    },
    "app:installUpdate": async (_e, { url } = {}) => {
      if (!url) return { ok: false };
      const sub = await Updater.addListener("progress", (info) => emit("app:updateProgress", info));
      try {
        await Updater.downloadAndInstall({ url });
      } catch (err) {
        // أول مرة: أندرويد لازم يسمح للبرنامج يسطّب تحديثات — الشاشة دي
        // بتتفتح لوحدها، وبعد السماح المستخدم بيدوس "حمّل" تاني.
        if (String(err?.message ?? err).includes("NEEDS_PERMISSION")) throw new Error("NEEDS_PERMISSION");
        throw err;
      } finally {
        sub.remove();
      }
      return { ok: true };
    },
    "print:preview": async () => {
      const cleanup = fitPrintToOnePage();
      try {
        await Printer.print({ name: document.title || "البنيان" });
      } catch {
        window.print();
      } finally {
        setTimeout(cleanup, 60000);
      }
    },
  };
}
