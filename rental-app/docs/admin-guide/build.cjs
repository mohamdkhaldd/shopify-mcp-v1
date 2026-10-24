// Builds the MK-Tech admin guide (Arabic, RTL): how the owner runs customers,
// codes and the cloud by himself. Same look as ../install-guide; uses its fonts.
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const NM = path.join(__dirname, "../install-guide/node_modules");
const F = (p) => "file://" + path.join(NM, "@fontsource", p);
const ICON_PNG = path.join(__dirname, "../install-guide/mk-icon.png");
const LINKS = {
  table: "https://supabase.com/dashboard/project/dbzgiaxsxadzkfqppknm/editor",
  storage: "https://supabase.com/dashboard/project/dbzgiaxsxadzkfqppknm/storage/buckets/logos",
  code: "https://github.com/mohamdkhaldd/shopify-mcp-v1",
  releases: "https://github.com/mohamdkhaldd/albunyan-rental-releases",
  actions: "https://github.com/mohamdkhaldd/shopify-mcp-v1/actions",
};
const ICONS = {
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  plus: '<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  devices: '<rect x="2" y="4" width="14" height="10" rx="1.5"/><path d="M1 17h16"/><rect x="17" y="8" width="6" height="12" rx="1.2"/>',
  cloud: '<path d="M7 18a5 5 0 0 1-.6-10A6 6 0 0 1 18 9a4.5 4.5 0 0 1-.5 9z"/>',
  shield: '<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/><path d="m9 12 2 2 4-4"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 17-5-5-9 8"/>',
  send: '<path d="M22 2 11 13M22 2l-7 20-4-9-9-4z"/>',
  stop: '<circle cx="12" cy="12" r="9"/><path d="M9 9h6v6H9z"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M17 6l3 3M15 8l2 2"/>',
  warn: '<path d="M12 3 2 20h20z"/><path d="M12 10v4M12 17h.01"/>',
  check: '<path d="m5 12 5 5L20 7"/>',
  github: '<path d="M9 19c-4 1.5-4-2-6-2.5M15 21v-3.5c0-1 .1-1.4-.5-2 2.8-.3 5.5-1.4 5.5-6a4.6 4.6 0 0 0-1.3-3.2 4.2 4.2 0 0 0-.1-3.2s-1.1-.3-3.5 1.3a12 12 0 0 0-6.2 0C6.5 2.8 5.4 3.1 5.4 3.1a4.2 4.2 0 0 0-.1 3.2A4.6 4.6 0 0 0 4 9.5c0 4.6 2.7 5.7 5.5 6-.6.6-.6 1.2-.5 2V21"/>',
  db: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>',
  refresh: '<path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"/>',
};
const icon = (n, cls = "") => `<svg class="ic ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONS[n]}</svg>`;
const k = (t) => `<span class="k">${t}</span>`;
const steps = (list) => `<ol class="steps">${list.map((s) => `<li><span>${s}</span></li>`).join("")}</ol>`;
const note = (t, kind = "warn") => `<div class="note ${kind}">${icon(kind === "ok" ? "check" : "warn")}<span>${t}</span></div>`;
const link = (u) => `<a class="url" dir="ltr" href="${u}">${u.replace("https://", "")}</a>`;
const top = (title) => `<div class="top"><div class="mini"><img src="${ICON_PNG}"><b>MK-Tech</b></div><div class="pt">${title}</div></div>`;
const pnum = (n, total) => `<div class="pnum"><span>MK-Tech — دليل الإدارة (سري)</span><span class="en">${n} / ${total}</span></div>`;
const card = (ic, title, body) => `<section class="card"><header><div class="badge">${icon(ic)}</div><h2>${title}</h2></header>${body}</section>`;

const TOTAL = 6;
const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>MK-Tech — دليل الإدارة</title>
<style>
@font-face{font-family:Tajawal;font-weight:400;src:url(${F("tajawal/files/tajawal-arabic-400-normal.woff2")})}
@font-face{font-family:Tajawal;font-weight:500;src:url(${F("tajawal/files/tajawal-arabic-500-normal.woff2")})}
@font-face{font-family:Tajawal;font-weight:700;src:url(${F("tajawal/files/tajawal-arabic-700-normal.woff2")})}
@font-face{font-family:Tajawal;font-weight:800;src:url(${F("tajawal/files/tajawal-arabic-800-normal.woff2")})}
@font-face{font-family:Inter;font-weight:400;src:url(${F("inter/files/inter-latin-400-normal.woff2")})}
@font-face{font-family:Inter;font-weight:600;src:url(${F("inter/files/inter-latin-600-normal.woff2")})}
@font-face{font-family:Inter;font-weight:700;src:url(${F("inter/files/inter-latin-700-normal.woff2")})}
@font-face{font-family:Inter;font-weight:800;src:url(${F("inter/files/inter-latin-800-normal.woff2")})}
:root{--navy:#0F172A;--blue:#0B5FFF;--accent:#3B82F6;--bg:#F8FAFC;--muted:#64748B;--line:#E2E8F0;--warn:#F59E0B;--ok:#10B981}
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
.hero{margin-top:30mm;position:relative}
.kicker{display:inline-block;font-weight:700;font-size:14px;color:#FCD34D;background:rgba(245,158,11,.14);border:1px solid rgba(245,158,11,.4);padding:6px 14px;border-radius:999px}
.hero h1{font-size:44px;font-weight:800;margin:16px 0 6px;line-height:1.2}
.hero h1 b{color:#60A5FA}
.hero p{font-size:17px;color:#CBD5E1;margin:0;max-width:155mm;line-height:1.7}
.tiles{position:absolute;left:18mm;right:18mm;bottom:30mm;display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
.tile{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);border-radius:14px;padding:14px 12px}
.tile .ic{width:26px;height:26px;color:#60A5FA}
.tile b{display:block;font-size:15px;margin-top:8px}
.tile span{display:block;font-size:12px;color:#94A3B8;margin-top:3px;line-height:1.5}
.cover .foot{position:absolute;left:18mm;right:18mm;bottom:12mm;display:flex;justify-content:space-between;font-size:11px;color:#64748B}
/* inner */
.inner{background:var(--bg);padding:13mm 14mm 16mm}
.top{display:flex;align-items:center;justify-content:space-between;padding-bottom:9px;margin-bottom:10px;border-bottom:2px solid var(--line)}
.top .mini{display:flex;align-items:center;gap:8px;direction:ltr}
.top .mini img{width:26px;height:26px;border-radius:7px}
.top .mini b{font-family:Inter;font-weight:800;font-size:15px}
.top .pt{font-size:13px;color:var(--muted);font-weight:700}
.h1{font-size:25px;font-weight:800;margin:2px 0 4px}
.lead{font-size:14px;color:#334155;margin:0 0 10px;line-height:1.7}
.card{background:#fff;border:1px solid var(--line);border-radius:16px;padding:14px 18px 12px;margin-bottom:11px;box-shadow:0 1px 2px rgba(15,23,42,.04)}
.card header{display:flex;align-items:center;gap:11px;margin-bottom:6px}
.badge{width:38px;height:38px;border-radius:11px;background:linear-gradient(145deg,var(--blue),var(--accent));color:#fff;display:flex;align-items:center;justify-content:center;flex:none}
.badge .ic{width:21px;height:21px}
.card h2{margin:0;font-size:18.5px;font-weight:800}
.card p{margin:4px 0;font-size:13.5px;line-height:1.7;color:#334155}
.steps{list-style:none;margin:0;padding:0;counter-reset:s}
.steps li{counter-increment:s;display:flex;gap:10px;align-items:flex-start;font-size:13.8px;line-height:1.7;padding:3px 0}
.steps li::before{content:counter(s);flex:none;width:22px;height:22px;border-radius:50%;background:#EFF6FF;color:var(--blue);font-family:Inter;font-weight:700;font-size:11px;display:flex;align-items:center;justify-content:center;margin-top:2px}
.steps b{font-weight:800}
.k{white-space:nowrap;font-family:Inter;font-weight:600;background:#F1F5F9;border:1px solid var(--line);border-radius:5px;padding:0 5px;font-size:11.5px;direction:ltr;unicode-bidi:isolate}
.url{font-family:Inter;font-size:10.5px;color:var(--blue);text-decoration:none;word-break:break-all;direction:ltr;unicode-bidi:isolate}
.note{display:flex;gap:8px;align-items:flex-start;margin-top:8px;background:#FFFBEB;border:1px solid #FDE68A;color:#92400E;border-radius:10px;padding:7px 10px;font-size:12.5px;line-height:1.6}
.note .ic{width:17px;height:17px;flex:none;margin-top:2px;color:var(--warn)}
.note.ok{background:#ECFDF5;border-color:#A7F3D0;color:#065F46}
.note.ok .ic{color:var(--ok)}
table.t{width:100%;border-collapse:separate;border-spacing:0;background:#fff;border:1px solid var(--line);border-radius:12px;overflow:hidden;font-size:12.6px;margin-top:6px}
.t th{background:var(--navy);color:#fff;font-weight:700;padding:7px 9px;text-align:right}
.t td{padding:7px 9px;border-top:1px solid var(--line);vertical-align:top;line-height:1.55}
.t td:first-child{font-weight:700;white-space:nowrap}
.t .f{font-family:Inter;font-weight:700;color:var(--blue);direction:ltr;unicode-bidi:isolate}
.t .ex{font-family:Inter,Tajawal;color:#0F172A;background:#F8FAFC}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.grid2 .card{margin-bottom:0}
.msg{background:#DCF8C6;border-radius:12px 12px 2px 12px;padding:10px 12px;font-size:13px;line-height:1.75;color:#111;border:1px solid #c5e8ad}
.code{font-family:Inter;font-weight:700;letter-spacing:1px;white-space:nowrap;direction:ltr;unicode-bidi:isolate}
.check{list-style:none;margin:0;padding:0}
.check li{display:flex;gap:9px;align-items:flex-start;font-size:13.5px;line-height:1.65;padding:4px 0;border-bottom:1px dashed var(--line)}
.check li:last-child{border-bottom:0}
.check li::before{content:"";flex:none;width:15px;height:15px;border:2px solid var(--blue);border-radius:4px;margin-top:4px}
.pnum{position:absolute;bottom:8mm;left:14mm;right:14mm;display:flex;justify-content:space-between;font-size:10.5px;color:var(--muted)}
.pnum .en{direction:ltr}
</style></head><body>

<div class="page cover">
  <div class="glow"></div><div class="shape"></div>
  <div class="brand"><div style="text-align:right"><div class="wm">MK-Tech</div><div class="tl">Business Systems &amp; Software</div></div><img src="${ICON_PNG}"></div>
  <div class="hero">
    <span class="kicker">ليك انت بس — ماتبعتوش لعميل</span>
    <h1>دليل <b>إدارة</b><br>MK-Tech</h1>
    <p>إزاي تضيف عميل جديد، وتجدد وتوقف اشتراكات، وتدير أجهزة العملاء، وتخلي السيستم شغال على طول — كله بنفسك من غير مبرمج.</p>
  </div>
  <div class="tiles">
    <div class="tile">${icon("plus")}<b>عميل جديد</b><span>كود، اسم، لوجو، برامج</span></div>
    <div class="tile">${icon("calendar")}<b>الاشتراكات</b><span>تجديد، إيقاف، رجوع</span></div>
    <div class="tile">${icon("devices")}<b>الأجهزة</b><span>زيادة جهاز، تغيير جهاز</span></div>
    <div class="tile">${icon("cloud")}<b>السيستم شغال</b><span>السحابة، الحسابات، الأمان</span></div>
  </div>
  <div class="foot"><span>MK-Tech — Systems That Make Business Work Better</span><span class="en">mk-tech</span></div>
</div>

<div class="page inner">
  ${top("فين كل حاجة")}
  <div class="h1">السيستم متقسم على حسابين</div>
  <p class="lead">كل حاجة في MK-Tech موجودة في حسابين بتوعك: <b>Supabase</b> (العملاء والأكواد والسحابة) و<b>GitHub</b> (البرنامج نفسه والتحديثات). مفيش حاجة على جهازك أو جهاز حد تاني.</p>
  ${card("db", "Supabase — اللي هتستخدمه كل يوم", `
    <p>مشروع اسمه <b class="en">Albunyan Rental</b>. فيه:</p>
    <table class="t"><tr><th>الحاجة</th><th>فين بالظبط</th><th>بتعمل إيه</th></tr>
      <tr><td>العملاء والأكواد</td><td>Table Editor ← <span class="f">licenses</span></td><td>كل عميل صف: اسمه، كوده، عدد أجهزته، برامجه، آخر يوم في اشتراكه</td></tr>
      <tr><td>أجهزة العملاء</td><td>Table Editor ← <span class="f">license_devices</span></td><td>كل جهاز اتفعّل بأي كود: اسمه ونوعه وآخر مرة فتح</td></tr>
      <tr><td>لوجوهات العملاء</td><td>Storage ← <span class="f">logos</span></td><td>الصور اللي بتظهر جوه برنامج كل عميل</td></tr>
      <tr><td>بيانات العملاء</td><td>(أوتوماتيك)</td><td>كل عميل ليه مساحة لوحده على السحابة — ماتلمسهاش</td></tr>
    </table>
    <p style="margin-top:8px">جدول الأكواد على طول: ${link(LINKS.table)}</p>`)}
  ${card("github", "GitHub — البرنامج والتحديثات", `
    <table class="t"><tr><th>الريبو</th><th>فيه إيه</th><th>ملاحظة</th></tr>
      <tr><td class="en">shopify-mcp-v1</td><td>كود البرنامج كله، والأدوات اللي بتبني نسخ الويندوز والتابلت</td><td>هيتقفل (private) — شوف آخر صفحة</td></tr>
      <tr><td class="en">albunyan-rental-releases</td><td>النسخ الجاهزة، لينكات التسطيب، نسخة الويب، والتحديثات اللي بتوصل للعملاء</td><td><b>لازم يفضل public</b> — من غيره العملاء مش هيحمّلوا ولا يتحدّثوا</td></tr>
    </table>`)}
  ${card("shield", "الأمان", `
    <p>اللي يدخل على Supabase يقدر يعمل أكواد ويوقف عملاء، واللي يدخل على GitHub يقدر يبعت تحديث لكل العملاء. علشان كده:</p>
    ${steps([
      "شغّل <b>التحقق بخطوتين</b> (2FA) على الحسابين: من إعدادات الحساب ← ${k("Security")} أو ${k("Password and authentication")}.",
      "ماتديش الباسورد لحد، وماتكتبوش في الواتساب أو في ورقة مع العميل.",
      "الكود اللي بتديه للعميل مش سر خطير: آخره إنه يشغّل البرنامج على عدد الأجهزة اللي انت حددته.",
    ])}`)}
  ${pnum(2, TOTAL)}
</div>

<div class="page inner">
  ${top("عميل جديد")}
  <div class="h1">إضافة عميل جديد — ٥ دقايق</div>
  <p class="lead">العميل بيبقى <b>صف واحد</b> في جدول <span class="k">licenses</span>. أول ما تحفظه، الكود بيتعمل لوحده وتبعته للعميل.</p>
  ${card("plus", "الخطوات", steps([
    `ادخل على ${link("https://supabase.com/dashboard")} بحسابك، واختار مشروع <b class="en">Albunyan Rental</b>.`,
    `من القايمة على الشمال: ${k("Table Editor")}، واختار جدول ${k("licenses")}.`,
    `دوس الزرار الأخضر ${k("Insert")} ← ${k("Insert row")}. هيفتحلك فورم على اليمين.`,
    "املا الخانات اللي في الجدول تحت. <b>أي خانة مش مذكورة سيبها زي ما هي.</b>",
    `دوس ${k("Save")}. الصف هيظهر في الجدول، وفي خانة <span class="k">key</span> هتلاقي الكود: <span class="code">MKTECH-XXXX-XXXX-XXXX</span>.`,
  ]))}
  ${card("key", "الخانات اللي بتملاها", `
    <table class="t"><tr><th>الخانة</th><th>تكتب فيها إيه</th><th>مثال</th></tr>
      <tr><td><span class="f">customer</span></td><td>اسم الشركة الرسمي — بيظهر في الطباعة والتقارير</td><td class="ex">شركة النور للمقاولات</td></tr>
      <tr><td><span class="f">display_name</span></td><td>الاسم القصير اللي فوق في البرنامج (لو فاضي = customer)</td><td class="ex">النور</td></tr>
      <tr><td><span class="f">products</span></td><td>البرامج اللي الكود بيفتحها (شوف تحت)</td><td class="ex"><span class="en">{rental,operations}</span></td></tr>
      <tr><td><span class="f">max_devices</span></td><td>عدد الأجهزة المسموحة (لاب + تابلت + موبايل…)</td><td class="ex en">3</td></tr>
      <tr><td><span class="f">expires_at</span></td><td>آخر يوم في الاشتراك — فاضي = مفتوح من غير ميعاد</td><td class="ex en">2027-01-31</td></tr>
      <tr><td><span class="f">logo_url</span></td><td>لينك اللوجو (الصفحة الجاية) — فاضي = أول حرف من الاسم في دايرة</td><td class="ex">(اختياري)</td></tr>
      <tr><td><span class="f">note</span></td><td>أي ملاحظة ليك انت — العميل مابيشوفهاش</td><td class="ex">تليفون: 010…، ٢٠٠٠/شهر</td></tr>
      <tr><td><span class="f">key</span></td><td><b>ماتكتبش فيها حاجة</b> — الكود بيتعمل لوحده</td><td class="ex">—</td></tr>
    </table>
    <table class="t" style="margin-top:8px"><tr><th>العميل اشترى</th><th>اكتب في products بالظبط</th></tr>
      <tr><td>برنامج التأجير بس</td><td class="f">{rental}</td></tr>
      <tr><td>برنامج التشغيل بس</td><td class="f">{operations}</td></tr>
      <tr><td>البرنامجين</td><td class="f">{rental,operations}</td></tr>
    </table>
    ${note("الأقواس <b>{ }</b> لازم تتكتب، ومن غير مسافات. لو الكود بيفتح البرنامجين، العميل بيشوف صفحة \"اختار البرنامج\" كل ما يفتح.")}`)}
  ${pnum(3, TOTAL)}
</div>

<div class="page inner">
  ${top("اللوجو والتسليم")}
  ${card("image", "لوجو العميل (اختياري)", `
    ${steps([
      `ادخل Supabase ← ${k("Storage")} ← فولدر <span class="k">logos</span>.`,
      `دوس ${k("Upload file")} واختار صورة اللوجو — <b>PNG</b> أو <b>JPG</b>، أقل من ٢ ميجا، ويُفضّل مربعة وخلفيتها شفافة أو بيضا.`,
      `دوس على الصورة بعد ما تترفع ← ${k("Copy URL")}.`,
      `ارجع لجدول <span class="k">licenses</span>، دوس مرتين على خانة <span class="k">logo_url</span> بتاعة العميل، والصق اللينك، و<b>Save</b>.`,
    ])}
    ${note("ينفع تحط اللوجو بعد ما العميل يبدأ: البرنامج عنده بيجيب اللوجو الجديد لوحده أول ما يتصل بالنت (أو يقفل ويفتح).", "ok")}`)}
  ${card("send", "تبعت للعميل إيه", `
    <p>حاجتين بس: <b>ملف "دليل التسطيب" PDF</b> (فيه لينكات اللاب والتابلت والموبايل والآيفون) و<b>الكود</b>. مثال رسالة:</p>
    <div class="msg">أهلًا يا فندم 👋<br>ده دليل تسطيب برنامج MK-Tech، اختار الجهاز اللي تحبه وتابع الخطوات.<br>كود التفعيل بتاعكم: <span class="code">MKTECH-XXXX-XXXX-XXXX</span><br>الكود شغال على ٣ أجهزة. أول مرة لازم يكون فيه نت. لو احتجت أي حاجة كلمني.</div>`)}
  ${card("user", "العميل بيشوف إيه", steps([
    "يفتح البرنامج ← صفحة <b>MK-Tech</b> بتطلب الكود.",
    "يكتب الكود ← البرنامج يتحول لاسم شركته ولوجوها في كل الشاشات والطباعة.",
    "لو الكود بالبرنامجين ← صفحة <b>\"أهلًا، النور\"</b> يختار منها التأجير أو التشغيل.",
    "كل أجهزته بتتزامن مع بعض بس — محدش من عملائك التانيين يشوف بياناته.",
  ]))}
  ${note("لو عملت كود للتجربة، ماتنساش توقفه بعد كده (الصفحة الجاية) علشان مايفضلش شغال.")}
  ${pnum(4, TOTAL)}
</div>

<div class="page inner">
  ${top("إدارة العملاء")}
  <div class="h1">كل حاجة من نفس الجدول</div>
  <p class="lead">دوس مرتين على الخانة، اكتب، و<b>Save</b> — البرنامج عند العميل بيعرف التغيير أول ما يتصل بالنت.</p>
  <div class="grid2">
    ${card("calendar", "تجديد اشتراك", `<p>غيّر <span class="k">expires_at</span> لآخر يوم في المدة الجديدة. لو فضّيته، الاشتراك بيبقى مفتوح.</p>`)}
    ${card("stop", "إيقاف عميل", `<p>خلّي <span class="k">revoked</span> = <span class="k">true</span>. البرنامج بيقفل عنده أول ما يتصل بالنت (أو بعد ١٤ يوم بالكتير لو مقفل النت). بياناته <b>مابتتمسحش</b> — رجّعها <span class="k">false</span> ويرجع زي ما كان.</p>`)}
    ${card("plus", "زيادة جهاز", `<p>زوّد الرقم في <span class="k">max_devices</span>، والعميل يدخّل نفس الكود على الجهاز الجديد.</p>`)}
    ${card("refresh", "العميل غيّر جهازه", `<p>افتح جدول <span class="k">license_devices</span> ← لاقي الجهاز القديم (بالاسم وآخر مرة فتح) ← خلّي <span class="k">revoked</span> = <span class="k">true</span>. مكانه بيفضى، والعميل يفعّل الجديد بنفس الكود.</p>`)}
  </div>
  ${card("devices", "تعرف مين شغال على إيه", `
    <p>جدول <span class="k">license_devices</span> — فوق دوس <b>Filter</b> واختار <span class="k">license_id</span> = رقم العميل (الـ <span class="k">id</span> بتاعه في جدول licenses):</p>
    <table class="t"><tr><th>الخانة</th><th>معناها</th></tr>
      <tr><td><span class="f">device_name</span></td><td>اسم الجهاز (مثلًا "Samsung SM-X200" أو "آيفون")</td></tr>
      <tr><td><span class="f">platform</span></td><td><span class="en">windows</span> = لاب، <span class="en">android</span> = تابلت/موبايل، <span class="en">web</span> = آيفون أو متصفح</td></tr>
      <tr><td><span class="f">last_seen_at</span></td><td>آخر مرة الجهاز اتصل — لو من شهور، غالبًا الجهاز ده مابقاش مستخدم</td></tr>
    </table>`)}
  ${card("warn", "العميل كلمك وقالك الرسالة دي", `
    <table class="t"><tr><th>الرسالة اللي عنده</th><th>السبب</th><th>تعمل إيه</th></tr>
      <tr><td>الكود ده مش صحيح</td><td>غلط في الكتابة</td><td>انسخ له الكود من الجدول تاني</td></tr>
      <tr><td>الكود ده اتوقف</td><td><span class="en">revoked = true</span></td><td>رجّعها <span class="en">false</span> لو هيكمل</td></tr>
      <tr><td>الاشتراك خلص</td><td><span class="en">expires_at</span> عدّى</td><td>جدد التاريخ</td></tr>
      <tr><td>متفعّل على أقصى عدد أجهزة</td><td>كل الأماكن مليانة</td><td>زوّد <span class="en">max_devices</span> أو شيل جهاز قديم</td></tr>
      <tr><td>الجهاز ده اتشال من الترخيص</td><td>انت شلت الجهاز ده</td><td>رجّع <span class="en">revoked</span> بتاعه <span class="en">false</span></td></tr>
      <tr><td>مقدرناش نوصل للنت</td><td>النت عنده، أو السحابة نايمة</td><td>يجرب نت تاني؛ لو لسه، شوف الصفحة الجاية</td></tr>
    </table>`)}
  ${pnum(5, TOTAL)}
</div>

<div class="page inner">
  ${top("السيستم يفضل شغال")}
  ${card("cloud", "السحابة ماتنامش", `
    <p>نسخة Supabase المجانية بتنام لوحدها لو فضلت أسبوع من غير استخدام. علشان كده فيه مهمة على GitHub اسمها <b class="en">Cloud keep-alive</b> بتصحّيها كل يوم.</p>
    ${steps([
      "GitHub بيوقف المهمة دي لو الريبو فضل <b>٦٠ يوم</b> من غير أي تعديل، وبيبعتلك <b>إيميل</b> قبلها.",
      `لو جالك الإيميل: ادخل ${link(LINKS.actions)} ← <b class="en">Cloud keep-alive</b> ← ${k("Enable workflow")}.`,
      "لو السحابة نامت فعلًا (كل العملاء بيقولوا \"مقدرناش نوصل للنت\"): ادخل Supabase ← المشروع ← ${k}. بتصحى في دقايق، ومفيش بيانات بتضيع، والبرامج كانت شغالة أوفلاين في الوقت ده.".replace("${k}", k("Restore project")),
    ])}`)}
  ${card("warn", "ماتمسحش ولا تغيّر", `
    <table class="t"><tr><th>الحاجة</th><th>ليه</th></tr>
      <tr><td>ريبو <span class="en">albunyan-rental-releases</span></td><td>منه العملاء بيحمّلوا ويتحدّثوا — لازم يفضل public</td></tr>
      <tr><td>جداول السحابة غير licenses و license_devices</td><td>فيها بيانات العملاء ومفاتيح التوقيع</td></tr>
      <tr><td>Edge Function اسمها <span class="en">license</span></td><td>هي اللي بتفعّل الأكواد</td></tr>
      <tr><td>صف عميل شغال (ماتمسحوش)</td><td>لو عايز توقفه استخدم <span class="en">revoked</span> — المسح بيضيّع ربطه ببياناته</td></tr>
    </table>`)}
  ${card("check", "قبل ما اشتراك Claude يخلص", `
    <ul class="check">
      <li><span>قولّي <b>"ابعت التحديث"</b> بعد ما تتفق مع عميل البنيان — نقل برنامج التشغيل محتاج شغل مني.</span></li>
      <li><span>اتأكد إنك داخل على <b>GitHub</b> و<b>Supabase</b> بإيميلك وباسوردك، وشغّلت <b>التحقق بخطوتين</b>.</span></li>
      <li><span>اطلب مني أقفل ريبو الكود (private) — بعد ما أتأكد إن كل الأجهزة القديمة اتحدّثت.</span></li>
      <li><span>احتفظ بالدليلين (التسطيب والإدارة) عندك وعلى Google Drive.</span></li>
      <li><span>جرّب تعمل عميل تجربة بنفسك من الدليل ده، وتوقفه، علشان تتأكد إنك ماسك الخطوات.</span></li>
    </ul>`)}
  ${card("db", "بعد Claude وتكلفة الكبر", `
    <p>العملاء هيفضلوا شغالين عادي، وانت بتضيف وتجدد وتوقف بنفسك من الدليل ده. <b>مميزات جديدة أو تصليح أخطاء</b> محتاجين مبرمج — والكود كله على GitHub ومعاه شرح، فأي مبرمج يكمّل. لو العملاء كتروا: باقة Supabase المدفوعة حوالي <b class="en">$25</b> في الشهر، ومعاها السحابة مابتنامش خالص.</p>`)}
  ${pnum(6, TOTAL)}
</div>
</body></html>`;

(async () => {
  const out = path.join(__dirname, "guide.html");
  fs.writeFileSync(out, html);
  const b = await chromium.launch();
  const p = await b.newPage();
  await p.goto("file://" + out);
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(500);
  // nothing may spill past its page
  const over = await p.evaluate(() => [...document.querySelectorAll(".page")].map((pg, i) => [i + 1, pg.scrollHeight - pg.clientHeight]).filter(([, d]) => d > 0));
  if (over.length) console.log("overflow", JSON.stringify(over));
  await p.pdf({ path: path.join(__dirname, "MK-Tech-دليل-الإدارة.pdf"), format: "A4", printBackground: true, preferCSSPageSize: true });
  await p.setViewportSize({ width: 794, height: 1123 });
  for (let i = 0; i < TOTAL; i++) await p.screenshot({ path: path.join(__dirname, `p${i + 1}.png`), clip: { x: 0, y: i * 1123, width: 794, height: 1123 }, fullPage: true });
  await b.close();
  console.log("ok");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
