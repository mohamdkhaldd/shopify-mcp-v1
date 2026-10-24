// Builds the Word sheet sent to every new customer: the activation code (the
// one thing to change, highlighted) and how to install on each device.
const fs = require("fs");
const path = require("path");
const QR = require(path.join(__dirname, "../install-guide/node_modules/qrcode"));
const {
  Document, Packer, Paragraph, TextRun, ImageRun, ExternalHyperlink, Table, TableRow, TableCell,
  WidthType, AlignmentType, BorderStyle, ShadingType, VerticalAlign, LevelFormat, Footer,
} = require("docx");

const LINKS = {
  windows: "https://github.com/mohamdkhaldd/mk-tech/releases/latest/download/mk-tech-rental-setup.exe",
  android: "https://github.com/mohamdkhaldd/mk-tech/releases/download/tablet-latest/mk-tech-rental-tablet.apk",
  web: "https://mohamdkhaldd.github.io/mk-tech/",
};
const NAVY = "0F172A", BLUE = "0B5FFF", MUTED = "64748B", LINE = "E2E8F0";
const FONT = "Segoe UI";

const t = (text, o = {}) => new TextRun({ text, rightToLeft: true, font: FONT, size: 22, ...o });
const p = (children, o = {}) => new Paragraph({ bidirectional: true, alignment: AlignmentType.RIGHT, spacing: { after: 80 }, children: [].concat(children), ...o });
const none = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const noBorders = { top: none, bottom: none, left: none, right: none, insideHorizontal: none, insideVertical: none };
const step = (text, n) => new Paragraph({ bidirectional: true, alignment: AlignmentType.RIGHT, numbering: { reference: "steps", level: 0, instance: n }, spacing: { after: 40 }, children: [].concat(text).map((x) => (typeof x === "string" ? t(x, { size: 21 }) : x)) });
const b = (text) => t(text, { bold: true, size: 21 });

(async () => {
  const qr = {};
  for (const [k, v] of Object.entries(LINKS)) qr[k] = await QR.toBuffer(v, { margin: 1, width: 300, color: { dark: "#0F172A", light: "#FFFFFF" } });
  const logo = fs.readFileSync(path.join(__dirname, "../install-guide/mk-icon.png"));

  // one device: title, link + QR, steps
  const W = 9638; // A4 text width with 1.9 cm margins
  const device = (title, sub, key, steps, n) => {
    const stepsList = steps.map((s) => step(s, n));
    return new Table({
      width: { size: W, type: WidthType.DXA },
      columnWidths: [W - 1900, 1900],
      borders: { top: { style: BorderStyle.SINGLE, size: 6, color: LINE }, bottom: { style: BorderStyle.SINGLE, size: 6, color: LINE }, left: { style: BorderStyle.SINGLE, size: 6, color: LINE }, right: { style: BorderStyle.SINGLE, size: 6, color: LINE }, insideHorizontal: none, insideVertical: none },
      visuallyRightToLeft: true,
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: W - 1900, type: WidthType.DXA },
              margins: { top: 140, bottom: 120, left: 200, right: 220 },
              children: [
                p([t(`${n}. ${title}`, { bold: true, size: 28, color: NAVY }), t(`   ${sub}`, { size: 19, color: MUTED })], { spacing: { after: 60 } }),
                p(new ExternalHyperlink({ link: LINKS[key], children: [new TextRun({ text: LINKS[key], style: "Hyperlink", font: "Segoe UI", size: 16 })] }), { alignment: AlignmentType.LEFT, bidirectional: false, spacing: { after: 100 } }),
                ...stepsList,
              ],
            }),
            new TableCell({
              width: { size: 1900, type: WidthType.DXA },
              verticalAlign: VerticalAlign.CENTER,
              margins: { top: 120, bottom: 120, left: 120, right: 120 },
              children: [
                new Paragraph({ alignment: AlignmentType.CENTER, children: [new ImageRun({ type: "png", data: qr[key], transformation: { width: 105, height: 105 } })] }),
                new Paragraph({ alignment: AlignmentType.CENTER, bidirectional: true, children: [t("صوّر الكود بالكاميرا", { size: 16, color: MUTED })] }),
              ],
            }),
          ],
        }),
      ],
    });
  };
  const gap = () => new Paragraph({ spacing: { after: 120 }, children: [] });

  const doc = new Document({
    creator: "MK-Tech",
    title: "MK-Tech — كود التفعيل وطريقة التسطيب",
    styles: { default: { document: { run: { font: FONT, size: 22 } } } },
    numbering: { config: [{ reference: "steps", levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.RIGHT, style: { paragraph: { indent: { right: 360, hanging: 300 } }, run: { color: BLUE, bold: true } } }] }] },
    sections: [{
      properties: { page: { margin: { top: 900, bottom: 900, left: 1134, right: 1134 } } },
      footers: { default: new Footer({ children: [p([t("MK-Tech — Systems That Make Business Work Better", { size: 16, color: MUTED })], { alignment: AlignmentType.CENTER })] }) },
      children: [
        // header: logo + brand
        new Table({
          width: { size: W, type: WidthType.DXA }, columnWidths: [W - 1300, 1300], borders: noBorders, visuallyRightToLeft: true,
          rows: [new TableRow({ children: [
            new TableCell({ width: { size: W - 1300, type: WidthType.DXA }, verticalAlign: VerticalAlign.CENTER, children: [
              p([new TextRun({ text: "MK-Tech", bold: true, size: 44, color: NAVY, font: FONT })], { spacing: { after: 0 } }),
              p([new TextRun({ text: "Business Systems & Software", size: 18, color: MUTED, font: FONT })], { spacing: { after: 0 } }),
            ] }),
            new TableCell({ width: { size: 1300, type: WidthType.DXA }, verticalAlign: VerticalAlign.CENTER, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new ImageRun({ type: "png", data: logo, transformation: { width: 62, height: 62 } })] })] }),
          ] })],
        }),
        new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: BLUE, space: 4 } }, spacing: { after: 200 }, children: [] }),
        p(t("أهلًا بيك في MK-Tech 👋", { bold: true, size: 34, color: NAVY })),
        p(t("ده كود التفعيل بتاع شركتكم، وتحته طريقة تسطيب البرنامج على كل جهاز. اختار الجهاز اللي تحبه — وينفع أكتر من جهاز في نفس الوقت، وكلهم بيشوفوا نفس البيانات.", { size: 21, color: "334155" }), { spacing: { after: 200 } }),

        // the code — the one thing to change for each customer
        new Table({
          width: { size: W, type: WidthType.DXA }, columnWidths: [W], visuallyRightToLeft: true,
          borders: { top: { style: BorderStyle.DASHED, size: 12, color: "93C5FD" }, bottom: { style: BorderStyle.DASHED, size: 12, color: "93C5FD" }, left: { style: BorderStyle.DASHED, size: 12, color: "93C5FD" }, right: { style: BorderStyle.DASHED, size: 12, color: "93C5FD" }, insideHorizontal: none, insideVertical: none },
          rows: [new TableRow({ children: [new TableCell({
            width: { size: W, type: WidthType.DXA }, shading: { type: ShadingType.CLEAR, color: "auto", fill: "EFF6FF" }, margins: { top: 160, bottom: 160, left: 200, right: 200 },
            children: [
              new Paragraph({ alignment: AlignmentType.CENTER, bidirectional: true, spacing: { after: 60 }, children: [t("كود التفعيل", { bold: true, size: 22, color: BLUE })] }),
              new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 }, children: [new TextRun({ text: "MKTECH-XXXX-XXXX-XXXX", bold: true, size: 44, font: "Consolas", color: NAVY, characterSpacing: 40, highlight: "yellow" })] }),
              new Paragraph({ alignment: AlignmentType.CENTER, bidirectional: true, spacing: { after: 0 }, children: [t("اكتبه مرة واحدة على كل جهاز — وأول مرة لازم يكون فيه نت.", { size: 18, color: MUTED })] }),
            ],
          })] })],
        }),
        gap(),

        device("لاب أو كمبيوتر ويندوز", "ملف تسطيب", "windows", [
          "افتح اللينك من اللاب، والملف هينزل.",
          ["لو كروم قال إن الملف مش آمن: التلات نقط جنب الملف ← ", b("Keep"), "."],
          ["لو ظهرت شاشة زرقا: ", b("More info"), " ← ", b("Run anyway"), " — وبعدها ", b("Install"), "."],
          "افتح MK-Tech من سطح المكتب واكتب الكود.",
        ], 1),
        gap(),
        device("تابلت أو موبايل أندرويد", "تطبيق", "android", [
          "افتح اللينك من الجهاز نفسه، والتطبيق هينزل.",
          ["افتح الملف. لو طلب ", b("السماح بالتسطيب من المصدر ده"), " فعّله وارجع."],
          ["دوس ", b("تثبيت"), " ثم ", b("فتح"), "، واكتب الكود. على التابلت بيشتغل بالعرض."],
        ], 2),
        gap(),
        device("آيفون أو آيباد", "من غير تسطيب", "web", [
          ["افتح اللينك من ", b("Safari"), "."],
          ["زرار المشاركة ← ", b("إضافة إلى الشاشة الرئيسية"), " ← إضافة."],
          "افتح أيقونة MK-Tech من الشاشة واكتب الكود. بيشتغل كمان من غير نت.",
        ], 3),
        gap(),
        p(t("محتاج مساعدة في التسطيب؟ كلّم فريق MK-Tech وهنساعدك خطوة بخطوة.", { size: 20, color: MUTED }), { alignment: AlignmentType.CENTER }),
      ],
    }],
  });
  fs.writeFileSync(path.join(__dirname, "MK-Tech-كود-التفعيل.docx"), await Packer.toBuffer(doc));
  console.log("ok");
})().catch((e) => { console.error(e); process.exit(1); });
