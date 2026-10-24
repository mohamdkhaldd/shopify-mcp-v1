// Builds the MK-Tech install guide (Arabic, RTL) as HTML, then prints it to PDF.
const fs = require("fs");
const path = require("path");
const QR = require("qrcode");
const { chromium } = require("playwright");

const LINKS = {
  windows: "https://github.com/mohamdkhaldd/mk-tech/releases/latest/download/mk-tech-rental-setup.exe",
  android: "https://github.com/mohamdkhaldd/mk-tech/releases/download/tablet-latest/mk-tech-rental-tablet.apk",
  web: "https://mohamdkhaldd.github.io/mk-tech/",
};
const F = (p) => "file://" + path.join(__dirname, "node_modules/@fontsource", p);
const ICONS = {
  laptop: '<path d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v9H4z"/><path d="M2 18h20"/>',
  tablet: '<rect x="2.5" y="5" width="19" height="14" rx="2"/><path d="M18.5 12h.01"/>',
  phone: '<rect x="6.5" y="2.5" width="11" height="19" rx="2"/><path d="M11 18.5h2"/>',
  apple: '<path d="M12 7c-1.5-1.6-5-1.4-6 1.6S6.2 16.4 8 18.6c1 1.2 2 1.4 3 .9s2-.5 3 0 2 .3 3-.9c.8-1 1.4-2.3 1.7-3.4-1.7-.7-2.6-2.3-2.3-4 .2-1.2 1-2.1 2-2.6-1.3-1.8-4-2-5.4-.6"/><path d="M12 7c0-1.8 1.2-3.4 3-3.8"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M17 6l3 3M15 8l2 2"/>',
  sync: '<path d="M4 12a8 8 0 0 1 14-5.3L20 9M20 4v5h-5"/><path d="M20 12a8 8 0 0 1-14 5.3L4 15M4 20v-5h5"/>',
  wifi: '<path d="M2 8.8a15 15 0 0 1 20 0M5 12.4a10 10 0 0 1 14 0M8.5 15.9a5 5 0 0 1 7 0M12 19.5h.01"/>',
  update: '<path d="M12 3v12M7 10l5 5 5-5"/><path d="M4 19h16"/>',
  warn: '<path d="M12 3 2 20h20z"/><path d="M12 10v4M12 17h.01"/>',
};
const icon = (n, cls = "") => `<svg class="ic ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONS[n]}</svg>`;

(async () => {
  const qr = {};
  for (const [k, v] of Object.entries(LINKS)) qr[k] = await QR.toString(v, { type: "svg", margin: 0, color: { dark: "#0F172A", light: "#FFFFFF" }, errorCorrectionLevel: "M" });

  const steps = (list) => `<ol class="steps">${list.map((s) => `<li><span>${s}</span></li>`).join("")}</ol>`;
  const linkBox = (k, label) => `
    <div class="linkbox">
      <div class="qr">${qr[k]}</div>
      <div class="lk">
        <div class="lk-t">${label}</div>
        <a dir="ltr" href="${LINKS[k]}">${LINKS[k].replace("https://", "")}</a>
        <div class="lk-h">صوّر الكود بكاميرا الجهاز، أو دوس على اللينك</div>
      </div>
    </div>`;
  const section = (o) => `
    <section class="dev">
      <header>
        <div class="badge">${icon(o.icon)}</div>
        <div><h2>${o.title}</h2><p>${o.sub}</p></div>
        <span class="tag">${o.tag}</span>
      </header>
      ${linkBox(o.link, o.linkLabel)}
      ${steps(o.steps)}
      ${o.note ? `<div class="note">${icon("warn")}<span>${o.note}</span></div>` : ""}
    </section>`;

  const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>MK-Tech — دليل التسطيب</title>
<style>
@font-face{font-family:Tajawal;font-weight:400;src:url(${F("tajawal/files/tajawal-arabic-400-normal.woff2")})}
@font-face{font-family:Tajawal;font-weight:500;src:url(${F("tajawal/files/tajawal-arabic-500-normal.woff2")})}
@font-face{font-family:Tajawal;font-weight:700;src:url(${F("tajawal/files/tajawal-arabic-700-normal.woff2")})}
@font-face{font-family:Tajawal;font-weight:800;src:url(${F("tajawal/files/tajawal-arabic-800-normal.woff2")})}
@font-face{font-family:Inter;font-weight:400;src:url(${F("inter/files/inter-latin-400-normal.woff2")})}
@font-face{font-family:Inter;font-weight:600;src:url(${F("inter/files/inter-latin-600-normal.woff2")})}
@font-face{font-family:Inter;font-weight:700;src:url(${F("inter/files/inter-latin-700-normal.woff2")})}
@font-face{font-family:Inter;font-weight:800;src:url(${F("inter/files/inter-latin-800-normal.woff2")})}
:root{--navy:#0F172A;--blue:#0B5FFF;--blue2:#2563EB;--accent:#3B82F6;--bg:#F8FAFC;--muted:#64748B;--line:#E2E8F0;--ok:#10B981;--warn:#F59E0B}
@page{size:A4;margin:0}
*{box-sizing:border-box}
html,body{margin:0;padding:0}
body{font-family:Tajawal,Inter,sans-serif;color:var(--navy);-webkit-print-color-adjust:exact;print-color-adjust:exact}
.en{font-family:Inter,sans-serif}
.page{width:210mm;height:297mm;position:relative;overflow:hidden;page-break-after:always;background:#fff}
.page:last-child{page-break-after:auto}
.ic{width:22px;height:22px}
/* cover */
.cover{background:linear-gradient(155deg,#0F172A 0%,#0B1A3A 48%,#0B2A6B 100%);color:#fff;padding:22mm 18mm}
.cover .glow{position:absolute;inset:auto -30mm -40mm auto;width:150mm;height:150mm;border-radius:50%;background:radial-gradient(circle,rgba(11,95,255,.45),transparent 65%)}
.cover .shape{position:absolute;left:-20mm;top:70mm;width:120mm;height:120mm;transform:rotate(45deg);border:1px solid rgba(59,130,246,.18);border-radius:12mm}
.brand{display:flex;align-items:center;gap:14px;direction:ltr;justify-content:flex-end}
.brand img{width:88px;height:88px;border-radius:20px;box-shadow:0 10px 30px rgba(11,95,255,.35)}
.brand .wm{font-family:Inter;font-weight:800;font-size:34px;letter-spacing:-.5px;line-height:1}
.brand .tl{font-family:Inter;font-size:12.5px;color:#93C5FD;margin-top:5px}
.hero{margin-top:34mm;position:relative}
.hero .kicker{display:inline-block;font-weight:700;font-size:14px;color:#93C5FD;background:rgba(59,130,246,.14);border:1px solid rgba(59,130,246,.35);padding:6px 14px;border-radius:999px}
.hero h1{font-size:44px;font-weight:800;margin:16px 0 6px;line-height:1.2}
.hero h1 b{color:#60A5FA}
.hero p{font-size:17px;color:#CBD5E1;margin:0;max-width:150mm;line-height:1.7}
.tiles{position:absolute;left:18mm;right:18mm;bottom:30mm;display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
.tile{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);border-radius:14px;padding:14px 12px}
.tile .ic{width:26px;height:26px;color:#60A5FA}
.tile b{display:block;font-size:15px;margin-top:8px}
.tile span{display:block;font-size:12px;color:#94A3B8;margin-top:3px;line-height:1.5}
.cover .foot{position:absolute;left:18mm;right:18mm;bottom:12mm;display:flex;justify-content:space-between;font-size:11px;color:#64748B}
/* inner pages */
.inner{background:var(--bg);padding:14mm 14mm 16mm}
.top{display:flex;align-items:center;justify-content:space-between;padding-bottom:9px;margin-bottom:10px;border-bottom:2px solid var(--line)}
.top .mini{display:flex;align-items:center;gap:8px;direction:ltr}
.top .mini img{width:26px;height:26px;border-radius:7px}
.top .mini b{font-family:Inter;font-weight:800;font-size:15px}
.top .pt{font-size:13px;color:var(--muted);font-weight:700}
.dev{background:#fff;border:1px solid var(--line);border-radius:16px;padding:18px 20px 16px;margin-bottom:14px;box-shadow:0 1px 2px rgba(15,23,42,.04)}
.dev header{display:flex;align-items:center;gap:12px}
.badge{width:44px;height:44px;border-radius:12px;background:linear-gradient(145deg,var(--blue),var(--accent));color:#fff;display:flex;align-items:center;justify-content:center;flex:none}
.badge .ic{width:24px;height:24px}
.dev h2{margin:0;font-size:22px;font-weight:800}
.dev header p{margin:2px 0 0;font-size:13px;color:var(--muted)}
.tag{margin-right:auto;font-size:11.5px;font-weight:700;color:var(--blue);background:#EFF6FF;border:1px solid #DBEAFE;padding:4px 10px;border-radius:999px;white-space:nowrap}
.linkbox{display:flex;gap:16px;align-items:center;background:var(--navy);color:#fff;border-radius:12px;padding:12px 14px;margin:14px 0 12px}
.qr{width:92px;height:92px;background:#fff;border-radius:8px;padding:5px;flex:none}
.qr svg{width:100%;height:100%;display:block}
.lk{min-width:0}
.lk-t{font-weight:700;font-size:13px;color:#93C5FD}
.lk a{display:block;font-family:Inter;font-size:10.5px;color:#fff;text-decoration:none;word-break:break-all;margin:3px 0;line-height:1.45;text-align:left}
.lk-h{font-size:11px;color:#94A3B8}
.steps{list-style:none;margin:0;padding:0;counter-reset:s}
.steps li{counter-increment:s;display:flex;gap:10px;align-items:flex-start;font-size:14.5px;line-height:1.75;padding:4px 0}
.steps li::before{content:counter(s);flex:none;width:23px;height:23px;border-radius:50%;background:#EFF6FF;color:var(--blue);font-family:Inter;font-weight:700;font-size:11.5px;display:flex;align-items:center;justify-content:center;margin-top:2px}
.steps b{font-weight:800}
.steps .k{white-space:nowrap;font-family:Inter;font-weight:600;background:#F1F5F9;border:1px solid var(--line);border-radius:5px;padding:0 5px;font-size:12px;direction:ltr;unicode-bidi:isolate}
.note{display:flex;gap:8px;align-items:flex-start;margin-top:12px;background:#FFFBEB;border:1px solid #FDE68A;color:#92400E;border-radius:10px;padding:7px 10px;font-size:12.5px;line-height:1.6}
.note .ic{width:18px;height:18px;flex:none;margin-top:2px;color:var(--warn)}
.pnum{position:absolute;bottom:8mm;left:14mm;right:14mm;display:flex;justify-content:space-between;font-size:10.5px;color:var(--muted)}
.pnum .en{direction:ltr}
/* after install */
.hero2{background:linear-gradient(145deg,#0F172A,#0B2A6B);color:#fff;border-radius:16px;padding:16px 18px;margin-bottom:12px}
.hero2 h2{margin:0;font-size:22px;font-weight:800}
.hero2 p{margin:4px 0 0;color:#CBD5E1;font-size:13.5px;line-height:1.7}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.card{background:#fff;border:1px solid var(--line);border-radius:14px;padding:13px 14px}
.card .ic{width:26px;height:26px;color:var(--blue)}
.card h3{margin:6px 0 4px;font-size:16px;font-weight:800}
.card p{margin:0;font-size:13px;color:#334155;line-height:1.7}
.codebox{margin-top:8px;font-family:Inter;font-weight:700;font-size:15px;letter-spacing:1.5px;text-align:center;direction:ltr;background:#EFF6FF;border:1.5px dashed #93C5FD;color:var(--blue);border-radius:10px;padding:7px}
.table{width:100%;border-collapse:separate;border-spacing:0;margin-top:12px;background:#fff;border:1px solid var(--line);border-radius:14px;overflow:hidden;font-size:13px}
.table th{background:var(--navy);color:#fff;font-weight:700;padding:9px 10px;text-align:right}
.table td{padding:9px 10px;border-top:1px solid var(--line)}
.table td:first-child{font-weight:700}
.table td{vertical-align:middle}
.tq{text-align:center;padding:6px 10px!important}
.tq svg{width:58px;height:58px;display:inline-block;vertical-align:middle}
.support{margin-top:12px;background:#fff;border:1px solid var(--line);border-right:4px solid var(--blue);border-radius:12px;padding:12px 14px;font-size:13.5px;line-height:1.7}
</style></head><body>

<div class="page cover">
  <div class="glow"></div><div class="shape"></div>
  <div class="brand"><div style="text-align:right"><div class="wm">MK-Tech</div><div class="tl">Business Systems &amp; Software</div></div><img src="mk-icon.png"></div>
  <div class="hero">
    <span class="kicker">دليل التسطيب</span>
    <h1>برامج <b>MK-Tech</b><br>على أي جهاز عندك</h1>
    <p>برنامج التأجير وبرنامج التشغيل في تطبيق واحد — كود التفعيل بيحدد اللي هيفتحلك. اختار الجهاز اللي حابب تشتغل عليه وتابع الخطوات؛ ينفع أكتر من جهاز في نفس الوقت، وكلهم بيشوفوا نفس البيانات أول بأول.</p>
  </div>
  <div class="tiles">
    <div class="tile">${icon("laptop")}<b>لاب ويندوز</b><span>برنامج بيتسطّب على الجهاز</span></div>
    <div class="tile">${icon("tablet")}<b>تابلت أندرويد</b><span>تطبيق، بيشتغل بالعرض</span></div>
    <div class="tile">${icon("phone")}<b>موبايل أندرويد</b><span>نفس تطبيق التابلت</span></div>
    <div class="tile">${icon("apple")}<b>آيفون وآيباد</b><span>من غير تسطيب، من Safari</span></div>
  </div>
  <div class="foot"><span>MK-Tech — Systems That Make Business Work Better</span><span class="en">mk-tech</span></div>
</div>

<div class="page inner">
  <div class="top"><div class="mini"><img src="mk-icon.png"><b>MK-Tech</b></div><div class="pt">دليل تسطيب MK-Tech</div></div>
  ${section({
    icon: "laptop", title: "لاب أو كمبيوتر ويندوز", sub: '<bdi dir="ltr">Windows 10</bdi> أو <bdi dir="ltr">11</bdi>', tag: "ملف تسطيب EXE",
    link: "windows", linkLabel: "لينك تحميل البرنامج",
    steps: [
      "افتح اللينك من اللاب، والملف هينزل على طول.",
      "لو كروم قال إن الملف <b>مش آمن</b>: دوس على التلات نقط جنب الملف ← <span class=\"k\">Keep</span>.",
      "افتح الملف. لو ظهرت شاشة زرقا <b>Windows protected your PC</b>: دوس <span class=\"k\">More info</span> ← <span class=\"k\">Run anyway</span>.",
      "اختار مكان التسطيب (أو سيبه زي ما هو) ودوس <b>Install</b>. هتلاقي أيقونة <b>MK-Tech</b> على سطح المكتب.",
      "افتح البرنامج واكتب <b>كود التفعيل</b> اللي معاك.",
    ],
    note: "الرسايل دي بتظهر مع أي برنامج جديد على ويندوز، ومش معناها إن فيه مشكلة. بتظهر أول مرة بس، والتحديثات بعد كده بتنزل لوحدها.",
  })}
  ${section({
    icon: "tablet", title: "تابلت أندرويد", sub: "سامسونج، هواوي، لينوفو… أي تابلت أندرويد", tag: "تطبيق APK",
    link: "android", linkLabel: "لينك تحميل التطبيق",
    steps: [
      "افتح اللينك من التابلت نفسه، والتطبيق هينزل.",
      "افتح الملف اللي نزل. لو أندرويد سألك <b>تسمح بالتسطيب من المصدر ده؟</b> ادخل على الإعدادات وفعّل <b>السماح</b>، وارجع.",
      "دوس <b>تثبيت</b>، وبعدها <b>فتح</b>.",
      "اكتب <b>كود التفعيل</b>. البرنامج على التابلت بيشتغل <b>بالعرض</b> دايمًا عشان الجداول تبان كاملة.",
    ],
  })}
  <div class="pnum"><span>MK-Tech</span><span class="en">2 / 4</span></div>
</div>

<div class="page inner">
  <div class="top"><div class="mini"><img src="mk-icon.png"><b>MK-Tech</b></div><div class="pt">دليل تسطيب MK-Tech</div></div>
  ${section({
    icon: "phone", title: "موبايل أندرويد", sub: "نفس تطبيق التابلت، بشكل مظبوط على الموبايل", tag: "تطبيق APK",
    link: "android", linkLabel: "نفس لينك التابلت",
    steps: [
      "افتح اللينك من الموبايل، والتطبيق هينزل.",
      "لو أندرويد طلب <b>السماح بالتسطيب من المصدر ده</b>، فعّله وارجع.",
      "دوس <b>تثبيت</b> ثم <b>فتح</b>، واكتب <b>كود التفعيل</b>.",
      "على الموبايل القايمة بتبقى مستخبية: دوس على <b>☰</b> فوق عشان تفتحها وتختار الصفحة.",
    ],
  })}
  ${section({
    icon: "apple", title: "آيفون أو آيباد", sub: "من غير ما تسطّب حاجة، من المتصفح", tag: "نسخة ويب",
    link: "web", linkLabel: "لينك البرنامج",
    steps: [
      "افتح اللينك من <b>Safari</b> (لازم Safari، مش كروم).",
      "دوس زرار <b>المشاركة</b> تحت (المربع اللي فيه سهم لفوق).",
      "انزل واختار <b>إضافة إلى الشاشة الرئيسية</b> <span class=\"k\">Add to Home Screen</span> ← <b>إضافة</b>.",
      "هتلاقي أيقونة <b>MK-Tech</b> على الشاشة. افتحها من هنا على طول، وهتشتغل زي التطبيق بالظبط.",
      "اكتب <b>كود التفعيل</b> أول مرة.",
    ],
    note: "متمسحش بيانات Safari: لو اتمسحت هتحتاج تكتب الكود تاني (والبيانات بترجع من السحابة لوحدها).",
  })}
  <div class="pnum"><span>MK-Tech</span><span class="en">3 / 4</span></div>
</div>

<div class="page inner">
  <div class="top"><div class="mini"><img src="mk-icon.png"><b>MK-Tech</b></div><div class="pt">بعد التسطيب</div></div>
  <div class="hero2"><h2>بعد ما تسطّب، تعرف الآتي</h2><p>البرنامج بيشتغل باسم شركتك ولوجوها في كل الشاشات والطباعة، وبياناتك ليك انت لوحدك.</p></div>
  <div class="grid2">
    <div class="card">${icon("key")}<h3>كود التفعيل</h3><p>كود واحد لشركتك، بيشتغل على عدد الأجهزة المتفق عليه. اكتبه مرة واحدة على كل جهاز، وأول مرة لازم يكون فيه نت.</p><div class="codebox">MKTECH-XXXX-XXXX-XXXX</div></div>
    <div class="card">${icon("sync")}<h3>كل أجهزتك متزامنة</h3><p>اللي تسجّله على اللاب يظهر على التابلت والموبايل لوحده في ثواني، والعكس. ومحدش غير أجهزة شركتك يشوف بياناتك.</p></div>
    <div class="card">${icon("wifi")}<h3>من غير نت؟ عادي</h3><p>البرنامج بيشتغل من غير نت، والتعديلات بتتبعت أول ما النت يرجع. لازم يتصل بالنت مرة كل ١٤ يوم على الأقل عشان يتأكد من الاشتراك.</p></div>
    <div class="card">${icon("update")}<h3>التحديثات لوحدها</h3><p>اللاب بينزّل التحديث في الخلفية ويتسطّب لما تقفل البرنامج. التابلت والموبايل بيطلعلك شريط "فيه نسخة جديدة" تدوس عليه. نسخة الآيفون دايمًا على آخر نسخة.</p></div>
  </div>
  <table class="table">
    <thead><tr><th>الجهاز</th><th>هتحمّل إيه</th><th style="text-align:center">صوّر الكود</th></tr></thead>
    <tbody>
      <tr><td>لاب ويندوز</td><td>ملف تسطيب</td><td class="tq">${qr.windows}</td></tr>
      <tr><td>تابلت أندرويد</td><td>تطبيق (بالعرض)</td><td class="tq">${qr.android}</td></tr>
      <tr><td>موبايل أندرويد</td><td>نفس التطبيق</td><td class="tq">${qr.android}</td></tr>
      <tr><td>آيفون / آيباد</td><td>نسخة ويب من Safari</td><td class="tq">${qr.web}</td></tr>
    </tbody>
  </table>
  <div class="support"><b>محتاج مساعدة؟</b> كلّم فريق <b class="en">MK-Tech</b>، وهنساعدك في التسطيب والتفعيل خطوة بخطوة.</div>
  <div class="pnum"><span>MK-Tech — Systems That Make Business Work Better</span><span class="en">4 / 4</span></div>
</div>
</body></html>`;

  fs.writeFileSync(path.join(__dirname, "guide.html"), html);
  const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox"] }).catch(() => chromium.launch());
  const p = await b.newPage();
  await p.goto("file://" + path.join(__dirname, "guide.html"));
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(500);
  await p.pdf({ path: path.join(__dirname, "MK-Tech-دليل-التسطيب.pdf"), format: "A4", printBackground: true, preferCSSPageSize: true });
  for (let i = 0; i < 4; i++) {
    await p.setViewportSize({ width: 794, height: 1123 });
    await p.evaluate((i) => window.scrollTo(0, i * 1123), i);
    await p.screenshot({ path: path.join(__dirname, `p${i + 1}.png`), clip: { x: 0, y: i * 1123, width: 794, height: 1123 }, fullPage: true });
  }
  await b.close();
  console.log("ok");
})().catch((e) => { console.error(e); process.exit(1); });
