// Builds the 3-month test scenario for برنامج التأجير (Arabic, RTL): every
// entry to type in by hand, month by month, and the numbers the program should
// show after each month. The expected numbers come from the program's own
// engine (tests/exampleQuarter.test.ts → expected.json), never typed by hand:
//   OUT=docs/test-scenario/expected.json npx vitest run tests/exampleQuarter.test.ts
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const X = JSON.parse(fs.readFileSync(path.join(__dirname, "expected.json"), "utf8"));
const NM = path.join(__dirname, "../install-guide/node_modules");
const F = (p) => "file://" + path.join(NM, "@fontsource", p);
const ICON = path.join(__dirname, "../install-guide/mk-icon.png");

const n = (v) => Number(v).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const money = (v) => `<span class="num">${n(v)}</span>`;
const table = (head, rows, cls = "") => `<table class="t ${cls}"><tr>${head.map((h) => `<th>${h}</th>`).join("")}</tr>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")}</table>`;
const steps = (list) => table(["التاريخ", "تعمل إيه", "فين في البرنامج"], list.map(([d, what, where]) => [`<span class="num">${d}</span>`, what, `<span class="where">${where}</span>`]), "steps");
const top = (t) => `<div class="top"><div class="mini"><img src="${ICON}"><b>MK-Tech</b></div><div class="pt">${t}</div></div>`;
const pnum = (i, total) => `<div class="pnum"><span>مثال تجربة — برنامج التأجير</span><span class="num">${i} / ${total}</span></div>`;

function monthResults(key, title) {
  const m = X.months[key];
  const rows = m.contracts.map((c) => [c.contract, c.clientDays, money(c.clientBase), money(c.vat), money(c.invoice), money(c.supplierCost), money(c.margin), money(c.tax5), money(c.contractExpenses), money(c.net)]);
  return `
    <h3>النتيجة المتوقعة — ${title}</h3>
    ${table(["العقد", "أيام", "على العميل", "ق.م ١٤٪", "الفاتورة", "لصاحب المعدة", "الهامش", "٥٪", "مصروفات العقد", "صافي العقد"], rows, "res")}
    <div class="kpis">
      <div><span>مصروفات عامة</span><b>${money(m.generalExpenses)}</b></div>
      <div><span>صافي ربح الشهر</span><b class="ok">${money(m.monthNet)}</b></div>
      <div><span>الإدارة ٥٠٪</span><b>${money(m.management)}</b></div>
      ${m.investors.map((i) => `<div><span>${i.name}</span><b>${money(i.share)}</b></div>`).join("")}
    </div>`;
}

function checkpoint(i) {
  const c = X.checkpoints[i];
  return `
    <h3>الأرصدة المتوقعة — ${c.label} (${c.date})</h3>
    <div class="grid2">
      ${table(["صاحب المعدة", "من السركي", "خصومات", "اتدفعله", "الباقي له"], c.suppliers.map((s) => [s.name, money(s.fromSarki), money(s.deductions), money(s.paid), `<b>${money(s.remaining)}</b>`]))}
      ${table(["العميل", "فواتير", "دفع", "الباقي عليه"], c.clients.map((s) => [s.name, money(s.invoiced), money(s.paid), `<b>${money(s.remaining)}</b>`]))}
    </div>
    <div class="kpis">
      <div><span>رصيد الخزنة</span><b>${money(c.treasury.balance)}</b></div>
      <div><span>فلوس ضرايب فيها</span><b>${money(c.treasury.taxHeld)}</b></div>
      <div><span>أرباح مستحقة الصرف</span><b>${money(c.treasury.profitsDue)}</b></div>
      <div><span>المتاح للتشغيل</span><b class="ok">${money(c.treasury.available)}</b></div>
    </div>`;
}

const TOTAL = 6;
const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>MK-Tech — مثال تجربة برنامج التأجير</title>
<style>
@font-face{font-family:Tajawal;font-weight:400;src:url(${F("tajawal/files/tajawal-arabic-400-normal.woff2")})}
@font-face{font-family:Tajawal;font-weight:700;src:url(${F("tajawal/files/tajawal-arabic-700-normal.woff2")})}
@font-face{font-family:Tajawal;font-weight:800;src:url(${F("tajawal/files/tajawal-arabic-800-normal.woff2")})}
@font-face{font-family:Inter;font-weight:400;src:url(${F("inter/files/inter-latin-400-normal.woff2")})}
@font-face{font-family:Inter;font-weight:700;src:url(${F("inter/files/inter-latin-700-normal.woff2")})}
@font-face{font-family:Inter;font-weight:800;src:url(${F("inter/files/inter-latin-800-normal.woff2")})}
:root{--navy:#0F172A;--blue:#0B5FFF;--bg:#F8FAFC;--muted:#64748B;--line:#E2E8F0;--ok:#059669}
@page{size:A4;margin:0}
*{box-sizing:border-box}html,body{margin:0}
body{font-family:Tajawal,Inter,sans-serif;color:var(--navy);-webkit-print-color-adjust:exact;print-color-adjust:exact}
.num{font-family:Inter;direction:ltr;unicode-bidi:isolate;white-space:nowrap}
.page{width:210mm;height:297mm;position:relative;overflow:hidden;page-break-after:always;background:var(--bg);padding:11mm 11mm 14mm}
.page:last-child{page-break-after:auto}
.top{display:flex;align-items:center;justify-content:space-between;padding-bottom:7px;margin-bottom:8px;border-bottom:2px solid var(--line)}
.top .mini{display:flex;align-items:center;gap:8px;direction:ltr}.top .mini img{width:24px;height:24px;border-radius:6px}.top .mini b{font-family:Inter;font-weight:800;font-size:14px}
.top .pt{font-size:12.5px;color:var(--muted);font-weight:700}
h1{font-size:26px;font-weight:800;margin:4px 0 4px}h2{font-size:19px;font-weight:800;margin:6px 0 5px}h3{font-size:14.5px;font-weight:800;margin:9px 0 5px;color:var(--blue)}
p{margin:3px 0;font-size:12.5px;line-height:1.65;color:#334155}
.t{width:100%;border-collapse:separate;border-spacing:0;background:#fff;border:1px solid var(--line);border-radius:10px;overflow:hidden;font-size:11.2px;margin-bottom:6px}
.t th{background:var(--navy);color:#fff;font-weight:700;padding:5px 6px;text-align:right;white-space:nowrap}
.t td{padding:4px 6px;border-top:1px solid var(--line);vertical-align:top;line-height:1.5}
.steps td:first-child{width:62px}.steps td:last-child{width:120px}
.where{color:var(--blue);font-weight:700;font-size:10.5px}
.res td,.res th{text-align:center}.res td:first-child{text-align:right;font-weight:700;white-space:nowrap}
.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin:4px 0 6px}
.kpis div{background:#fff;border:1px solid var(--line);border-radius:9px;padding:5px 8px}
.kpis span{display:block;font-size:10.5px;color:var(--muted)}.kpis b{font-size:14px}.kpis .ok{color:var(--ok)}
.grid2{display:grid;grid-template-columns:1.25fr 1fr;gap:6px}
.note{background:#FFFBEB;border:1px solid #FDE68A;color:#92400E;border-radius:9px;padding:6px 9px;font-size:11.5px;line-height:1.6;margin:5px 0}
.info{background:#EFF6FF;border:1px solid #DBEAFE;color:#1E3A8A;border-radius:9px;padding:6px 9px;font-size:11.5px;line-height:1.6;margin:5px 0}
.pnum{position:absolute;bottom:6mm;left:11mm;right:11mm;display:flex;justify-content:space-between;font-size:10px;color:var(--muted)}
</style></head><body>

<div class="page">
  ${top("مثال تجربة — أغسطس لأكتوبر ٢٠٢٦")}
  <h1>مثال كامل تجرّب بيه برنامج التأجير</h1>
  <p>شركة تأجير معدات وهمية لمدة ٣ شهور: ٣ مستثمرين (بيدخلوا فلوسهم أول الشهر بس)، ٣ أصحاب معدات منهم واحد عنده معدتين، ٣ عملاء (شركتين عليهم ضرايب وفرد من غير ضرايب)، مصروفات، خصومات، دفعات، ضرايب، قفل شهور وصرف أرباح. سجّل كل حاجة بإيدك بالترتيب، وقارن أرقامك بالأرقام المتوقعة تحت كل شهر — كلها طالعة من نفس حسابات البرنامج.</p>
  <div class="info">النسب: الافتراضية في البرنامج — قيمة مضافة <b>١٤٪</b>، ضريبة <b>٥٪</b> من الهامش، الإدارة <b>٥٠٪</b> والمستثمرين <b>٥٠٪</b> (الإعدادات ← النسب). الجمعة إجازة للودر والحفار؛ الونش والبلدوزر بيشتغلوا كل يوم.</div>
  <h2>١. المستثمرين</h2>
  ${table(["الاسم", "التليفون", "رأس المال", "يوم الإيداع"], [
    ["م. أحمد سالم", '<span class="num">0122 555 1010</span>', money(300000), '<span class="num">2026-08-01</span>'],
    ["أ. خالد منصور", '<span class="num">0111 777 2020</span>', `${money(200000)} + ${money(100000)} زيادة`, '<span class="num">2026-08-01</span> و <span class="num">2026-10-01</span>'],
    ["د. منى عادل", '<span class="num">0100 333 4040</span>', money(150000), '<span class="num">2026-09-01</span>'],
  ])}
  <h2>٢. أصحاب المعدات ومعداتهم</h2>
  ${table(["صاحب المعدة", "التليفون", "المعدة", "سعره في اليوم", "الموقع"], [
    ["الحاج سيد عبد الله", '<span class="num">0100 234 5678</span>', "لودر كاتربيلر 950", money(2500), "كمبوند الياسمين — التجمع"],
    ["الحاج سيد عبد الله", "", "حفار كوماتسو PC300", money(3200), "كمبوند الياسمين — التجمع"],
    ["م. عادل فهمي", '<span class="num">0112 456 7890</span>', "ونش 50 طن", money(4000), "برج النور — مدينة نصر"],
    ["أبو يوسف للمعدات", '<span class="num">0155 123 4567</span>', "بلدوزر كاتربيلر D8", money(3500), "أرض حسام — العاشر"],
  ])}
  <h2>٣. العملاء</h2>
  ${table(["العميل", "النوع", "الضرايب"], [
    ["شركة الأمل للمقاولات", 'شركة — بطاقة ضريبية <span class="num">512-845-307</span>', "قيمة مضافة + ٥٪"],
    ["شركة النور للإنشاءات", 'شركة — بطاقة ضريبية <span class="num">618-220-411</span>', "قيمة مضافة + ٥٪"],
    ["م. حسام فؤاد", 'فرد — <span class="num">0109 888 1212</span>', "من غير ضرايب"],
  ])}
  <h2>٤. العقود (السركي ← عقد جديد) — كلها باليوم</h2>
  ${table(["العقد", "العميل", "المعدة", "سعر العميل", "سعر صاحب المعدة", "من", "لحد"], [
    ["١", "شركة الأمل", "لودر 950", money(3000), money(2500), '<span class="num">2026-08-01</span>', '<span class="num">2026-10-31</span>'],
    ["٢", "شركة الأمل", "حفار PC300", money(4000), money(3200), '<span class="num">2026-08-15</span>', '<span class="num">2026-10-31</span>'],
    ["٣", "شركة النور", "ونش 50 طن", money(5200), money(4000), '<span class="num">2026-09-01</span>', '<span class="num">2026-10-31</span>'],
    ["٤", "م. حسام فؤاد", "بلدوزر D8", money(4500), money(3500), '<span class="num">2026-09-01</span>', '<span class="num">2026-09-30</span>'],
  ])}
  <p><b>أنواع المصروفات</b> (الإعدادات): نقل معدات، إيجار مكتب، مرتبات.</p>
  <div class="note">البرنامج بيحسب لحد النهارده: لو بتجرب قبل يوم <span class="num">31</span> أكتوبر، اليوم ده هيبان في أرقام أكتوبر لما ييجي. وقفل أكتوبر بيشتغل من أول نوفمبر.</div>
  ${pnum(1, TOTAL)}
</div>

<div class="page">
  ${top("أغسطس ٢٠٢٦")}
  <h2>أغسطس — اللودر بيبدأ، والحفار من نص الشهر</h2>
  ${steps([
    ["08-01", `إيداع رأس مال: م. أحمد سالم ${money(300000)}، أ. خالد منصور ${money(200000)}`, "المستثمرين"],
    ["08-01", `مصروف عام: إيجار مكتب ${money(5000)}`, "الخزنة ← مصروف"],
    ["08-01", `مصروف على العقد ١ (اللودر): نقل معدات ${money(1500)}`, "الخزنة ← مصروف"],
    ["08-01→31", "سركي اللودر: املا أيام الشهر كله، وبعدين افرغ أيام الجمعة <span class='num'>7، 14، 21، 28</span> (إجازة) — شيت صاحب المعدة بيمشي لوحده", "السركي"],
    ["08-10", `خصم على الحاج سيد (العقد ١): سولار دفعناه عنه ${money(4000)} — من الخزنة`, "أصحاب المعدات"],
    ["08-15", `مصروف على العقد ٢ (الحفار): نقل معدات ${money(2000)}`, "الخزنة ← مصروف"],
    ["08-15→31", "سركي الحفار: املا من <span class='num'>15</span> لـ <span class='num'>31</span>، وافرغ الجمعة <span class='num'>21، 28</span>", "السركي"],
    ["08-20", `دفعة للحاج سيد (العقد ١): ${money(30000)} تحت الحساب`, "أصحاب المعدات"],
    ["08-28", `مصروف عام: مرتبات (المحاسب) ${money(6000)}`, "الخزنة ← مصروف"],
  ])}
  ${monthResults("2026-08", "أغسطس")}
  <p>اللودر <span class="num">27</span> يوم × <span class="num">3,000</span> = <span class="num">81,000</span> + قيمة مضافة <span class="num">11,340</span>؛ لصاحبه <span class="num">27 × 2,500 = 67,500</span>؛ الهامش <span class="num">13,500</span> − ٥٪ <span class="num">675</span> − نقل <span class="num">1,500</span> = <span class="num">11,325</span>. الصافي بعد المصروفات العامة (<span class="num">11,000</span>) بيتقسم نص للإدارة ونص للمستثمرين على قد فلوس كل واحد (أحمد ٦٠٪، خالد ٤٠٪).</p>
  ${checkpoint(0)}
  ${pnum(2, TOTAL)}
</div>

<div class="page">
  ${top("سبتمبر ٢٠٢٦")}
  <h2>سبتمبر — ٤ معدات شغالة، ومستثمرة جديدة</h2>
  ${steps([
    ["09-01", `إيداع رأس مال: د. منى عادل ${money(150000)}`, "المستثمرين"],
    ["09-01", `مصروف عام: إيجار مكتب ${money(5000)}؛ ومصروف نقل على العقد ٣ (الونش) ${money(2500)} وعلى العقد ٤ (البلدوزر) ${money(1800)}`, "الخزنة ← مصروف"],
    ["09-02", "اقفل شهر أغسطس (بيتعمل بعد ما أغسطس يخلص)", "الإدارة ← قفل الشهر"],
    ["09-03", `تحصيل من شركة الأمل: ${money(X.firstMonthInvoices)} (فواتير أغسطس كاملة)`, "الشركات والأفراد"],
    ["09-05", `دفعة للحاج سيد: ${money(60000)} (من غير عقد محدد)`, "أصحاب المعدات"],
    ["09-01→30", "سركي اللودر والحفار: املا الشهر كله وافرغ الجمعة <span class='num'>4، 11، 18، 25</span>", "السركي"],
    ["09", "أوفر تايم الحفار (شيت الشركة): أيام <span class='num'>5، 10، 12</span> — <span class='num'>3</span> ساعات زيادة بسعر <span class='num'>500</span> للساعة (صاحب المعدة بياخد بسعره: يوميته ÷ ٨ = <span class='num'>400</span>)", "السركي ← أوفر تايم"],
    ["09-01→30", "سركي الونش: املا الشهر كله (من غير إجازة جمعة)، وافرغ <span class='num'>20، 21، 22</span> — عطل في الونش", "السركي"],
    ["09-01→30", "سركي البلدوزر: املا الشهر كله", "السركي"],
    ["09-10", `اصرف أرباح أغسطس: أحمد ${money(X.payoutsAug.ahmed)}، خالد ${money(X.payoutsAug.khaled)}، الإدارة ${money(X.payoutsAug.management)}`, "المستثمرين / الإدارة"],
    ["09-15", `ادفع ضرايب أغسطس: قيمة مضافة ${money(X.taxes.julVat)} و ٥٪ ${money(X.taxes.julT5)}`, "الملف الضريبي"],
    ["09-18", `خصم على م. عادل (العقد ٣): قطع غيار ${money(6000)} — من الخزنة`, "أصحاب المعدات"],
    ["09-25", `دفعة لـ م. عادل (العقد ٣): ${money(50000)}`, "أصحاب المعدات"],
    ["09-28", `مصروف عام: مرتبات ${money(6000)}`, "الخزنة ← مصروف"],
  ])}
  ${monthResults("2026-09", "سبتمبر")}
  <p>منى دخلت أول الشهر، فبتاخد نصيبها من سبتمبر كله: المستثمرين <span class="num">300</span> + <span class="num">200</span> + <span class="num">150</span> ألف ⇒ أحمد ٤٦٪، خالد ٣١٪، منى ٢٣٪ من نصيب المستثمرين.</p>
  ${pnum(3, TOTAL)}
</div>

<div class="page">
  ${top("سبتمبر ٢٠٢٦ — الأرصدة")}
  ${checkpoint(1)}
  <div class="info">الأرباح بتتصرف على قد اللي العميل دفعه: أغسطس اتحصّل كله، فأرباحه اتصرفت كاملة. سبتمبر لسه متحصّلش، فمفيش أرباح جاهزة للصرف آخر سبتمبر.</div>
  <h2>أكتوبر — زيادة رأس مال، والبلدوزر خلص</h2>
  ${steps([
    ["10-01", `زيادة رأس مال: أ. خالد منصور ${money(100000)}`, "المستثمرين"],
    ["10-01", `مصروف عام: إيجار مكتب ${money(5000)}`, "الخزنة ← مصروف"],
    ["10-02", "اقفل شهر سبتمبر", "الإدارة ← قفل الشهر"],
    ["10-02", `تحصيل من م. حسام فؤاد: ${money(110000)} كاش (باقي عليه ${money(25000)})`, "الشركات والأفراد"],
    ["10-04", `تحصيل من شركة الأمل: ${money(200000)} شيك`, "الشركات والأفراد"],
    ["10-05", `دفعة للحاج سيد ${money(120000)}؛ ودفعة لأبو يوسف (العقد ٤) ${money(70000)}`, "أصحاب المعدات"],
    ["10-06", `تحصيل من شركة النور: ${money(150000)}`, "الشركات والأفراد"],
    ["10-01→31", "سركي اللودر والحفار: املا الشهر وافرغ الجمعة <span class='num'>2، 9، 16، 23، 30</span>؛ الونش: الشهر كله", "السركي"],
    ["10-10", `اصرف الأرباح الجاهزة: أحمد ${money(X.payoutsSep.ahmed)}، خالد ${money(X.payoutsSep.khaled)}، منى ${money(X.payoutsSep.mona)}، الإدارة ${money(X.payoutsSep.management)}`, "المستثمرين / الإدارة"],
    ["10-15", `ادفع ضرايب سبتمبر: قيمة مضافة ${money(X.taxes.augVat)} و ٥٪ ${money(X.taxes.augT5)}`, "الملف الضريبي"],
    ["10-25", `دفعة لـ م. عادل: ${money(80000)}`, "أصحاب المعدات"],
    ["10-28", `مصروف عام: مرتبات ${money(6000)}؛ وتحصيل من شركة الأمل ${money(100000)}`, "الخزنة / الشركات"],
  ])}
  ${pnum(4, TOTAL)}
</div>

<div class="page">
  ${top("أكتوبر ٢٠٢٦")}
  ${monthResults("2026-10", "أكتوبر")}
  <p>خالد زوّد رأس ماله أول أكتوبر لـ <span class="num">300</span> ألف، فبقى زي أحمد بالظبط في أكتوبر (٤٠٪ لكل واحد، ومنى ٢٠٪).</p>
  ${checkpoint(2)}
  <div class="info">آخر أكتوبر فيه أرباح جاهزة للصرف (من فلوس سبتمبر وأكتوبر اللي اتحصّلت بعد ١٠ أكتوبر) — تقدر تصرفها وتجرّب "حطها في رأس ماله" لو حبيت (ده بيبقى إيداع جديد، فاعمله أول نوفمبر).</div>
  ${pnum(5, TOTAL)}
</div>

<div class="page">
  ${top("تجارب زيادة")}
  <h2>حاجات تجرّبها بعد ما تخلص</h2>
  ${table(["التجربة", "إزاي", "المتوقع"], [
    ["إلغاء حركة", "الغي دفعة م. عادل يوم 12-25 (اكتب السبب)", "الباقي له يرجع يزيد 80,000، والخزنة تزيد بنفس المبلغ"],
    ["تعديل شهر مقفول", "حاول تعدّل يوم في سركي أغسطس بعد ما قفلته", "البرنامج يرفض — والتعديل بيبقى تسوية في شهر مفتوح"],
    ["تسوية", "تسوية على العقد ١ لشهر أغسطس في أكتوبر (مثلًا يوم اتنسى)", "بتتحسب في أكتوبر من غير ما أغسطس يتغير"],
    ["مصروف أكبر من الفلوس", "مصروف كبير (مثلًا مليون)", "البرنامج يحذّرك إن الخزنة هتبقى بالسالب"],
    ["صرف أرباح أكتر من الجاهز", "اصرف لمستثمر أكتر من المكتوب", "البرنامج يرفض: الأرباح بتتصرف على قد اللي اتحصّل"],
    ["سحب رأس مال", "اسحب جزء من رأس مال منى", "نصيبها في الشهر اللي بعده بيقل"],
    ["الطباعة والإكسل", "اطبع فاتورة، كشف صاحب معدة، كشف عميل، والملف الضريبي", "PDF / Excel بنفس الأرقام"],
    ["المزامنة", "افتح نفس الكود على جهاز تاني", "نفس البيانات تظهر"],
  ])}
  <div class="note">لما تخلص تجربة: امسح البيانات من الإعدادات، أو استخدم كود تجربة واعمل "خروج" — البيانات بتتمسح من الجهاز، وتقدر تبدأ من الأول.</div>
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
  const over = await p.evaluate(() => [...document.querySelectorAll(".page")].map((pg, i) => [i + 1, pg.scrollHeight - pg.clientHeight]).filter(([, d]) => d > 0));
  if (over.length) console.log("overflow", JSON.stringify(over));
  await p.pdf({ path: path.join(__dirname, "MK-Tech-مثال-تجربة-التأجير.pdf"), format: "A4", printBackground: true, preferCSSPageSize: true });
  await p.setViewportSize({ width: 794, height: 1123 });
  for (let i = 0; i < TOTAL; i++) await p.screenshot({ path: path.join(__dirname, `p${i + 1}.png`), clip: { x: 0, y: i * 1123, width: 794, height: 1123 }, fullPage: true });
  await b.close();
  console.log("ok");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
