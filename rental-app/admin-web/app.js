// لوحة إدارة MK-Tech (لصاحب الشركة بس): بتكلم خدمة "admin" على السيرفر.
// مفيش هنا أي مفتاح سري: الدخول بالكود والباسورد، والسيرفر بيرد بتوكن جلسة.
// (المفتاح اللي تحت هو المفتاح العام المعروف بتاع المشروع، مش بيفتح أي بيانات)
(() => {
  "use strict";
  const API = "https://dbzgiaxsxadzkfqppknm.supabase.co/functions/v1/admin";
  const ANON =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRiemdpYXhzeGFkemtmcXBwa25tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI3NDIyMjgsImV4cCI6MjEwODMxODIyOH0.GO54cbGOK61LUTM64kG4-HX6l8SpBGNegnpvIsqBDh0";
  const LINKS = {
    windows: "https://github.com/mohamdkhaldd/mk-tech/releases/latest/download/mk-tech-rental-setup.exe",
    android: "https://github.com/mohamdkhaldd/mk-tech/releases/download/tablet-latest/mk-tech-rental-tablet.apk",
    web: "https://mohamdkhaldd.github.io/mk-tech/",
  };
  const PRODUCTS = { rental: "التأجير", operations: "التشغيل" };
  const ERRORS = {
    wrong: "الكود أو الباسورد غلط",
    locked: "محاولات غلط كتير — استنى ربع ساعة وجرب تاني",
    auth: "انتهت الجلسة — ادخل تاني",
    name_required: "اكتب اسم العميل",
    short: "الباسورد لازم ٦ حروف على الأقل",
    logo_too_big: "اللوجو كبير — اختار صورة أصغر من ٢ ميجا",
    not_found: "مش لاقي العميل ده",
    server: "حصلت مشكلة في السيرفر — جرب تاني",
    network: "مفيش نت أو السيرفر مش بيرد",
    stop_first: "وقّف العميل الأول (كل أكواده) وبعدين امسحه",
    confirm: "الاسم اللي اتكتب مش زي اسم العميل — متمسحش",
  };

  const store = {
    get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
    set: (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch {} },
  };
  let token = store.get("mk-admin-token");
  let data = null; // آخر رد من dashboard

  const $ = (s, el = document) => el.querySelector(s);
  const app = $("#app");
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const ar = (n) => Number(n ?? 0).toLocaleString("ar-EG");
  const day = (d) => (d ? new Date(d).toLocaleDateString("ar-EG", { year: "numeric", month: "long", day: "numeric" }) : "—");
  const isoDay = (d) => { const x = new Date(d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`; };
  const daysLeft = (d) => (d ? Math.ceil((new Date(d) - Date.now()) / 86400000) : null);

  function toast(msg) {
    const t = $("#toast");
    t.textContent = msg;
    t.classList.add("on");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => t.classList.remove("on"), 2600);
  }

  async function call(action, body = {}) {
    let res;
    try {
      res = await fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: ANON, Authorization: `Bearer ${ANON}` },
        body: JSON.stringify({ action, token, ...body }),
      });
    } catch {
      throw new Error("network");
    }
    let r;
    try { r = await res.json(); } catch { throw new Error("server"); }
    if (!r.ok) {
      if (r.error === "auth") { logout(); }
      throw new Error(r.error || "server");
    }
    return r;
  }
  const msg = (e) => ERRORS[e?.message] || e?.message || ERRORS.server;

  async function busy(btn, fn) {
    const old = btn?.textContent;
    if (btn) { btn.disabled = true; btn.textContent = "…"; }
    try { return await fn(); }
    catch (e) { toast(msg(e)); }
    finally { if (btn) { btn.disabled = false; btn.textContent = old; } }
  }

  function logout() {
    token = null; data = null;
    store.set("mk-admin-token", null);
    location.hash = "";
    render();
  }

  // ---- الشكل العام ----
  function shell(title, inner, { back } = {}) {
    const route = location.hash.split("/")[0] || "#";
    const tab = (h, icon, label) => `<a href="${h}" class="${route === h || (h === "#" && route === "#c") ? "on" : ""}"><b>${icon}</b>${label}</a>`;
    app.innerHTML = `
      <header>
        ${back ? `<button onclick="history.back()">‹ رجوع</button>` : `<img src="../mk-icon-192.png" alt="">`}
        <h1>${esc(title)}</h1>
      </header>
      <main>${inner}</main>
      <nav class="tabs">
        ${tab("#", "👥", "العملاء")}${tab("#new", "＋", "عميل جديد")}${tab("#company", "🏢", "MK")}${tab("#me", "⚙︎", "الحساب")}
      </nav>`;
  }

  // ---- الدخول ----
  function loginView() {
    app.innerHTML = `
      <div class="center"><form class="card login" id="f">
        <img src="../mk-icon-192.png" alt="">
        <h2 style="text-align:center">إدارة MK-Tech</h2>
        <label>كود الدخول</label>
        <input name="code" autocomplete="username" autocapitalize="characters" dir="ltr" required>
        <label>الباسورد</label>
        <input name="password" type="password" autocomplete="current-password" dir="ltr" required>
        <div class="err" id="err"></div>
        <button class="btn full" id="go">دخول</button>
      </form></div>`;
    $("#f").onsubmit = (e) => {
      e.preventDefault();
      const f = e.target;
      busy($("#go"), async () => {
        try {
          const r = await call("login", { code: f.code.value, password: f.password.value });
          token = r.token;
          store.set("mk-admin-token", token);
          render();
        } catch (er) {
          $("#err").textContent = msg(er);
        }
      });
    };
  }

  async function load(force) {
    if (!data || force) data = await call("dashboard");
    return data;
  }

  // "bundled:…" = اللوجو اللي جوه البرنامج نفسه (البنيان): نفس الصورة على الموقع
  const logoSrc = (u) => (/^bundled:/.test(u || "") ? "../logo.png" : /^https:/.test(u || "") ? u : null);
  const logoBox = (c) => (logoSrc(c.logoUrl) ? `<img class="logo" src="${esc(logoSrc(c.logoUrl))}" alt="" onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'logo',textContent:'${esc((c.displayName || c.customer || "?").trim().slice(0, 1))}'}))">` : `<div class="logo">${esc((c.displayName || c.customer || "?").trim().slice(0, 1))}</div>`);
  function statusPill(c) {
    if (!c.active) return `<span class="pill bad">موقوف</span>`;
    const d = daysLeft(c.expiresAt);
    if (d == null) return `<span class="pill ok">شغال · مفتوح</span>`;
    if (d < 0) return `<span class="pill bad">منتهي من ${ar(-d)} يوم</span>`;
    if (d <= 7) return `<span class="pill warn">باقي ${ar(d)} يوم</span>`;
    return `<span class="pill ok">شغال</span>`;
  }

  // ---- النشاط: مين شغال فعلاً ومين قافل ----
  const ACT = {
    active: ["شغال", "ok"],
    viewing: ["بيفتح بس", "warn"],
    slow: ["قليل", "warn"],
    idle: ["واقف", "bad"],
  };
  /** "من ٣ ساعات" / "من يومين" / "من ١٢ يوم" */
  function ago(t) {
    if (!t) return "ولا مرة";
    const m = (Date.now() - new Date(t).getTime()) / 60000;
    if (m < 2) return "دلوقتي";
    if (m < 60) return `من ${ar(Math.round(m))} دقيقة`;
    const h = m / 60;
    if (h < 24) return `من ${ar(Math.round(h))} ساعة`;
    const dd = Math.round(h / 24);
    return dd === 1 ? "امبارح" : dd === 2 ? "من يومين" : `من ${ar(dd)} يوم`;
  }
  function activityPill(c) {
    const a = c.activity;
    if (!a || !c.active) return "";
    const [label, tone] = ACT[a.status] || ACT.idle;
    const since = a.status === "idle" ? ` ${ago(a.lastEntry || a.lastSeen)}` : "";
    return `<span class="pill ${tone}">● ${label}${since}</span>`;
  }
  // جداول البرنامج بالعربي (التأجير / التشغيل)
  const TABLES = {
    work_logs: "السركي", daily_logs: "شيت المعدات", contracts: "العقود", equipment: "المعدات", clients: "الشركات", suppliers: "أصحاب المعدات",
    client_payments: "دفعات الشركات", supplier_payments: "دفعات أصحاب المعدات", expenses: "مصروفات", treasury_entries: "الخزنة",
    treasury_transfers: "تحويلات الخزنة", treasury_holds: "فلوس مع حد", capital_movements: "رأس المال", profit_payouts: "صرف أرباح",
    investors: "المستثمرين", contract_managers: "شركاء الإدارة", adjustments: "تسويات", invoices: "فواتير", month_closes: "قفل شهر",
    monthly_expenses: "مصروفات شهرية", employee_advances: "سلف", salary_payments: "مرتبات", employees: "السواقين", contractors: "المقاولين",
    contractor_payments: "دفعات المقاولين", partner_payments: "دفعات الشركا", custody_entries: "العهد", custodies: "العهد",
    hassan_ledger: "حساب صاحب الكوميشن", hassan_treasury_expenses: "مصاريف الكوميشن", obligations: "مواعيد الدفع", car_fuel: "العربية",
    equipment_paper_sheets: "صور السركي", expense_categories: "أنواع المصروفات", hassan_installments: "الأقساط", hassan_installment_payments: "دفع الأقساط",
    treasury_adjustments: "تعديلات الخزنة", employee_bonuses: "حوافز", employee_deductions: "خصومات", supplier_purchases: "مشتريات", expense_payments: "دفع مصروفات",
    hassan_workers: "العمال", hassan_worker_entries: "حساب العمال", hassan_worker_attendance: "حضور العمال", other_income: "دخل تاني", partners: "الشركا", transfer_fees: "عمولات التحويل",
  };
  const tableName = (t, ops) => (TABLES[t] || t) + (ops ? " (تشغيل)" : "");

  // ---- واتساب ----
  /** 010... ← 2010... (مصر) */
  const waNumber = (p) => {
    let d = String(p || "").replace(/[٠-٩]/g, (x) => "٠١٢٣٤٥٦٧٨٩".indexOf(x)).replace(/\D/g, "");
    if (d.startsWith("00")) d = d.slice(2);
    if (d.startsWith("0")) d = "2" + d;
    return d.length >= 10 ? d : null;
  };
  /** رسالة جاهزة حسب حالة العميل */
  function waText(c) {
    const name = c.displayName || c.customer;
    const left = daysLeft(c.expiresAt);
    if (c.active && left != null && left <= 7)
      return `أهلاً ${name}، اشتراكك في برنامج MK-Tech ${left < 0 ? "خلص" : left === 0 ? "بيخلص النهارده" : `هيخلص بعد ${left} يوم`}. تحب نجدده؟`;
    if (c.active && c.activity && c.activity.status !== "active")
      return `أهلاً ${name}، لاحظنا إنك مش شغال على برنامج MK-Tech الفترة دي. محتاج أي مساعدة أو شرح؟ إحنا موجودين.`;
    return `أهلاً ${name}، معاك MK-Tech.`;
  }
  const waLink = (c) => (waNumber(c.phone) ? `https://wa.me/${waNumber(c.phone)}?text=${encodeURIComponent(waText(c))}` : null);
  const waButton = (c, label = "واتساب") =>
    waLink(c) ? `<a class="btn green" href="${esc(waLink(c))}" target="_blank" rel="noopener" onclick="event.stopPropagation()">💬 ${label}</a>` : "";

  // ---- العملاء ----
  async function listView() {
    shell("العملاء", `<div class="muted">بيحمّل…</div>`);
    let d;
    try { d = await load(true); } catch (e) { shell("العملاء", `<div class="card err">${esc(msg(e))}</div>`); return; }
    const cs = d.customers;
    const active = cs.filter((c) => c.active);
    const monthly = active.reduce((s, c) => s + (c.price || 0), 0);
    const soon = active.filter((c) => { const x = daysLeft(c.expiresAt); return x != null && x <= 7; }).length;
    const working = active.filter((c) => c.activity?.status === "active").length;
    const quiet = active.filter((c) => c.activity && c.activity.status !== "active").length;
    const card = (c) => `
      <div class="card cust" data-id="${c.id}" data-act="${c.active ? c.activity?.status || "idle" : "off"}" data-q="${esc((c.customer + " " + (c.displayName || "") + " " + c.codes.map((k) => k.key).join(" ")).toLowerCase())}">
        ${logoBox(c)}
        <div class="grow">
          <div class="row"><b class="grow">${esc(c.displayName || c.customer)}</b>${statusPill(c)}</div>
          <div class="muted">${c.planLabel ? `${esc(c.planLabel)} · ${ar(c.price)} ج/شهر` : "من غير باقة"} · ${ar(c.equipment)}${c.maxEquipment ? `/${ar(c.maxEquipment)}` : ""} معدة · ${ar(c.devices)} جهاز</div>
          <div class="muted">ينتهي: ${c.expiresAt ? day(c.expiresAt) : "مفتوح"}${c.renews === false ? " · مش هيتجدد" : ""}</div>
          ${c.active && c.activity ? `<div class="row" style="gap:6px;margin-top:4px">${activityPill(c)}<span class="muted">فتح ${ago(c.activity.lastSeen)} · سجّل ${ago(c.activity.lastEntry)}</span></div>` : ""}
        </div>
      </div>`;
    // محتاج انتباهك: واقف، بيفتح بس، أو اشتراكه قرّب يخلص
    const attention = active
      .map((c) => {
        const left = daysLeft(c.expiresAt);
        const why =
          left != null && left <= 3 ? (left < 0 ? `اشتراكه خلص من ${ar(-left)} يوم` : left === 0 ? "اشتراكه بيخلص النهارده" : `اشتراكه باقي عليه ${ar(left)} يوم`)
          : c.activity?.status === "idle" ? `واقف — آخر حاجة ${ago(c.activity.lastEntry || c.activity.lastSeen)}`
          : c.activity?.status === "viewing" ? `بيفتح بس — مسجّلش حاجة ${ago(c.activity.lastEntry)}`
          : null;
        return why ? { c, why } : null;
      })
      .filter(Boolean);
    const week = Date.now() - 7 * 86400000;
    const fresh = cs.filter((c) => new Date(c.since).getTime() > week).length;
    const idleN = active.filter((c) => c.activity?.status === "idle").length;
    shell("العملاء", `
      ${attention.length ? `<div class="card" style="border-color:var(--amber)">
        <h2>محتاج انتباهك</h2>
        ${attention.map(({ c, why }) => `<div class="row sub" style="margin-top:0;padding-top:8px">
          <a class="grow" href="#c/${c.id}" style="color:inherit;text-decoration:none"><b>${esc(c.displayName || c.customer)}</b><div class="muted">${esc(why)}</div></a>
          ${waButton(c) || `<a class="btn ghost" href="#c/${c.id}">ضيف رقمه</a>`}
        </div>`).join("")}
      </div>` : ""}
      <div class="card">
        <h2 style="margin-bottom:6px">آخر ٧ أيام</h2>
        <div class="muted">${ar(working)} شغال · ${ar(idleN)} واقف · ${ar(fresh)} عميل جديد · ${ar(monthly)} ج اشتراكات في الشهر</div>
      </div>
      <div class="stats">
        <div class="stat"><b>${ar(active.length)}</b><span>عميل شغال</span></div>
        <div class="stat"><b>${ar(monthly)}</b><span>جنيه في الشهر</span></div>
        <div class="stat"><b>${ar(soon)}</b><span>قرب ينتهي</span></div>
      </div>
      <div class="row" id="filters" style="margin-bottom:12px;gap:6px">
        <button class="btn soft" data-f="">الكل (${ar(cs.length)})</button>
        <button class="btn ghost" data-f="active">● شغالين (${ar(working)})</button>
        <button class="btn ghost" data-f="quiet">● مش شغالين (${ar(quiet)})</button>
      </div>
      ${cs.length > 3 ? `<input class="search" id="q" placeholder="دوّر باسم أو كود…">` : ""}
      <div id="list">${cs.map(card).join("") || `<div class="card muted">لسه مفيش عملاء — اضغط "عميل جديد".</div>`}</div>`);
    app.querySelectorAll(".cust").forEach((el) => (el.onclick = () => (location.hash = `#c/${el.dataset.id}`)));
    let f = "";
    const q = $("#q");
    const apply = () =>
      app.querySelectorAll(".cust").forEach((el) => {
        const okQ = !q || el.dataset.q.includes(q.value.trim().toLowerCase());
        const a = el.dataset.act;
        const okF = !f || (f === "active" ? a === "active" : a !== "active" && a !== "off");
        el.style.display = okQ && okF ? "" : "none";
      });
    if (q) q.oninput = apply;
    app.querySelectorAll("#filters [data-f]").forEach((b) => (b.onclick = () => {
      f = b.dataset.f;
      app.querySelectorAll("#filters [data-f]").forEach((x) => (x.className = `btn ${x === b ? "soft" : "ghost"}`));
      apply();
    }));
  }

  const planOptions = (plans, cur) =>
    `<option value="">من غير باقة (مفتوح)</option>` +
    Object.entries(plans).map(([k, p]) => `<option value="${k}" ${k === cur ? "selected" : ""}>${esc(p.label)} — ${ar(p.price)} ج/شهر</option>`).join("");

  const readLogo = (file) =>
    new Promise((ok, no) => {
      if (!file) return ok(undefined);
      // نصغّر الصورة لـ ٤٠٠ بكسل قبل الرفع
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        const s = Math.min(1, 400 / Math.max(img.width, img.height));
        const cv = document.createElement("canvas");
        cv.width = Math.round(img.width * s); cv.height = Math.round(img.height * s);
        cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
        URL.revokeObjectURL(url);
        ok({ data: cv.toDataURL("image/png").split(",")[1], type: "image/png" });
      };
      img.onerror = () => no(new Error("الصورة دي مش مقروءة"));
      img.src = url;
    });

  // ---- تفاصيل عميل ----
  async function customerView(id) {
    shell("العميل", `<div class="muted">بيحمّل…</div>`, { back: true });
    let d;
    try { d = await load(); } catch (e) { shell("العميل", `<div class="card err">${esc(msg(e))}</div>`, { back: true }); return; }
    const c = d.customers.find((x) => String(x.id) === String(id));
    if (!c) { shell("العميل", `<div class="card">مش لاقي العميل ده.</div>`, { back: true }); return; }
    const left = daysLeft(c.expiresAt);
    shell(c.displayName || c.customer, `
      <div class="card">
        <div class="cust" style="cursor:default">${logoBox(c)}
          <div class="grow"><b>${esc(c.displayName || c.customer)}</b><div class="muted">${esc(c.customer)}</div></div>${statusPill(c)}</div>
        <dl class="kv sub">
          <dt>عميل من</dt><dd>${day(c.since)}</dd>
          <dt>الباقة</dt><dd>${c.planLabel ? `${esc(c.planLabel)} — ${ar(c.price)} ج/شهر` : "من غير باقة"}</dd>
          <dt>المعدات</dt><dd>${ar(c.equipment)}${c.maxEquipment ? ` من ${ar(c.maxEquipment)}` : " (من غير حد)"}</dd>
          <dt>الأجهزة</dt><dd>${ar(c.devices)}</dd>
          <dt>ينتهي</dt><dd>${c.expiresAt ? `${day(c.expiresAt)}${left != null ? ` (${left >= 0 ? `باقي ${ar(left)} يوم` : `عدّى ${ar(-left)} يوم`})` : ""}` : "مفتوح من غير ميعاد"}</dd>
          <dt>تجديد</dt><dd>${c.renews === false ? "مش هيتجدد" : "بيتجدد"}</dd>
          <dt>التليفون</dt><dd>${c.phone ? `<a href="tel:${esc(c.phone)}" dir="ltr">${esc(c.phone)}</a>` : `<span class="muted">مش متسجل — ضيفه من «البيانات» تحت</span>`}</dd>
        </dl>
        ${c.phone ? `<div class="row sub">${waButton(c, "ابعت واتساب")}<span class="muted grow" style="font-size:12px">${esc(waText(c))}</span></div>` : ""}
      </div>

      <div class="card">
        <div class="row"><h2 class="grow" style="margin:0">النشاط</h2>${activityPill(c)}</div>
        <dl class="kv sub">
          <dt>آخر فتح للبرنامج</dt><dd>${ago(c.activity?.lastSeen)}</dd>
          <dt>آخر تسجيل</dt><dd>${ago(c.activity?.lastEntry)}</dd>
          <dt>آخر ٧ أيام</dt><dd>${ar(c.activity?.entries7 ?? 0)} تعديل</dd>
          <dt>آخر ٣٠ يوم</dt><dd>${ar(c.activity?.entries30 ?? 0)} تعديل في ${ar(c.activity?.days30 ?? 0)} يوم</dd>
        </dl>
        <div id="act" class="sub muted">بيحمّل التفاصيل…</div>
      </div>

      <div class="card">
        <h2>التجديد</h2>
        <div class="row">
          <button class="btn" data-renew="1">+ شهر</button>
          <button class="btn" data-renew="3">+ ٣ شهور</button>
          <button class="btn" data-renew="12">+ سنة</button>
        </div>
        <label>أو اختار تاريخ</label>
        <div class="row"><input type="date" id="exp" class="grow" value="${c.expiresAt ? isoDay(c.expiresAt) : ""}"><button class="btn soft" id="setExp">احفظ</button></div>
        <div class="row" style="margin-top:8px"><button class="btn ghost" id="openEnded">من غير ميعاد انتهاء</button></div>
        <label class="check"><input type="checkbox" id="renews" ${c.renews === false ? "" : "checked"}> العميل بيجدد (لو شلتها: مش هيتجدد)</label>
      </div>

      <div class="card">
        <h2>الباقة</h2>
        <select id="plan">${planOptions(d.plans, c.plan)}</select>
        <div class="muted" style="margin-top:6px">الحد بيوصل الأجهزة أول ما تفتح البرنامج بنت.</div>
        <button class="btn soft" id="savePlan" style="margin-top:8px">احفظ الباقة</button>
      </div>

      <div class="card">
        <h2>الأكواد</h2>
        ${c.codes.map((k) => `
          <div class="sub">
            <div class="row"><span class="code grow">${esc(k.key)}</span>${k.revoked ? `<span class="pill bad">موقوف</span>` : `<span class="pill ok">شغال</span>`}</div>
            <div class="muted">${k.products.map((p) => PRODUCTS[p] || p).join(" + ")} · ${ar(k.devices)} من ${ar(k.maxDevices)} جهاز${k.note ? ` · ${esc(k.note)}` : ""}</div>
            <div class="row" style="margin-top:6px">
              <button class="btn ghost" data-copy="${esc(k.key)}">نسخ</button>
              <button class="btn ghost" data-sheet="${k.id}">ورقة العميل</button>
              <button class="btn ghost" data-max="${k.id}" data-cur="${k.maxDevices}">عدد الأجهزة</button>
              <button class="btn ghost" data-stop="${k.id}" data-rev="${k.revoked ? 1 : 0}">${k.revoked ? "رجّعه" : "وقّفه"}</button>
            </div>
          </div>`).join("")}
        <div class="sub">
          <label>كود جديد لنفس الشركة (على نفس البيانات)</label>
          <div class="row">
            <select id="newProd" class="grow"><option value="rental">التأجير بس</option><option value="operations">التشغيل بس</option><option value="rental,operations">الاتنين</option></select>
            <button class="btn soft" id="addCode">اعمل كود</button>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="row"><h2 class="grow" style="margin:0">الأجهزة</h2><button class="btn ghost" id="loadDev">اعرض</button></div>
        <div id="devs"></div>
      </div>

      <div class="card">
        <h2>البيانات</h2>
        <label>اسم العميل (عندك)</label><input id="eName" value="${esc(c.customer)}">
        <label>الاسم اللي بيظهر في البرنامج</label><input id="eDisp" value="${esc(c.displayName || "")}">
        <label>تليفون العميل (واتساب)</label><input id="ePhone" value="${esc(c.phone || "")}" dir="ltr" inputmode="tel" placeholder="01xxxxxxxxx">
        <label>لوجو جديد</label><input id="eLogo" type="file" accept="image/*">
        <label>باسورد الشركة (بيتطلب أول مرة على أي جهاز) — سيبه فاضي لو مش هتغيره</label><input id="ePw" type="text" dir="ltr" autocomplete="off">
        <label class="check"><input type="checkbox" id="ePwOff"> شيل الباسورد خالص</label>
        <button class="btn soft" id="saveInfo" style="margin-top:6px">احفظ البيانات</button>
      </div>

      <div class="card">
        ${c.active
          ? `<button class="btn red full" id="stopAll">وقّف العميل ده (كل أكواده)</button><div class="muted" style="margin-top:6px">البرنامج هيقفل عندهم أول ما يتصل بالنت. البيانات مش بتتمسح.</div>`
          : `<button class="btn green full" id="resumeAll">رجّع العميل ده</button>
             <button class="btn red full" id="delAll" style="margin-top:10px">امسح العميل ده خالص</button>
             <div class="muted" style="margin-top:6px">بيمسح أكواده وأجهزته وكل بياناته على السيرفر — مفيش رجوع.</div>`}
      </div>`, { back: true });

    const update = (fields, codeId) => call("license.update", codeId ? { codeId, fields } : { id: c.id, fields });
    const done = async (t) => { toast(t || "اتحفظ ✓"); await load(true); customerView(id); };

    app.querySelectorAll("[data-renew]").forEach((b) => (b.onclick = () => busy(b, async () => {
      const base = c.expiresAt && new Date(c.expiresAt) > new Date() ? new Date(c.expiresAt) : new Date();
      base.setMonth(base.getMonth() + Number(b.dataset.renew));
      await update({ expiresAt: isoDay(base), revoked: false, renews: true });
      await done(`اتجدد لحد ${day(base)} ✓`);
    })));
    $("#setExp").onclick = (e) => busy(e.target, async () => {
      if (!$("#exp").value) return toast("اختار تاريخ");
      await update({ expiresAt: $("#exp").value });
      await done();
    });
    $("#openEnded").onclick = (e) => busy(e.target, async () => { await update({ expiresAt: null }); await done(); });
    $("#renews").onchange = (e) => busy(null, async () => { await update({ renews: e.target.checked }); await done(); });
    $("#savePlan").onclick = (e) => busy(e.target, async () => { await update({ plan: $("#plan").value || null }); await done(); });
    app.querySelectorAll("[data-copy]").forEach((b) => (b.onclick = async () => {
      try { await navigator.clipboard.writeText(b.dataset.copy); toast("اتنسخ ✓"); } catch { prompt("انسخ الكود:", b.dataset.copy); }
    }));
    app.querySelectorAll("[data-sheet]").forEach((b) => (b.onclick = () => (location.hash = `#sheet/${c.id}/${b.dataset.sheet}`)));
    app.querySelectorAll("[data-max]").forEach((b) => (b.onclick = () => {
      const v = prompt("أقصى عدد أجهزة على الكود ده:", b.dataset.cur);
      if (v == null) return;
      const n = parseInt(String(v).replace(/[٠-٩]/g, (x) => "٠١٢٣٤٥٦٧٨٩".indexOf(x)), 10);
      if (!(n >= 1)) return toast("اكتب رقم صحيح");
      busy(b, async () => { await update({ maxDevices: n }, b.dataset.max); await done(); });
    }));
    app.querySelectorAll("[data-stop]").forEach((b) => (b.onclick = () => {
      const stop = b.dataset.rev !== "1";
      if (stop && !confirm("توقف الكود ده؟ الأجهزة اللي عليه هتقفل.")) return;
      busy(b, async () => { await update({ revoked: stop }, b.dataset.stop); await done(); });
    }));
    $("#addCode").onclick = (e) => busy(e.target, async () => {
      const r = await call("code.add", { id: c.id, products: $("#newProd").value.split(",") });
      toast(`الكود الجديد: ${r.key}`);
      await load(true);
      location.hash = `#sheet/${c.id}/${r.id}`;
    });
    $("#loadDev").onclick = (e) => busy(e.target, () => devicesInto($("#devs"), c));
    activityInto($("#act"), c).catch((e) => ($("#act").textContent = msg(e)));
    $("#saveInfo").onclick = (e) => busy(e.target, async () => {
      const fields = {};
      if ($("#eName").value.trim() !== c.customer) fields.customer = $("#eName").value;
      if ($("#eDisp").value.trim() !== (c.displayName || "")) fields.displayName = $("#eDisp").value;
      if ($("#ePhone").value.trim() !== (c.phone || "")) fields.phone = $("#ePhone").value;
      const logo = await readLogo($("#eLogo").files[0]);
      if (logo) fields.logo = logo;
      if ($("#ePwOff").checked) fields.password = null;
      else if ($("#ePw").value.trim()) fields.password = $("#ePw").value.trim();
      if (!Object.keys(fields).length) return toast("مفيش حاجة اتغيرت");
      await update(fields);
      await done();
    });
    const del = $("#delAll");
    if (del) del.onclick = () => {
      const name = prompt(`المسح نهائي ومفيش رجوع.\nللتأكيد اكتب اسم العميل بالظبط:\n${c.customer}`);
      if (name == null) return;
      busy(del, async () => {
        await call("customer.delete", { id: c.id, confirm: name });
        toast("اتمسح ✓");
        await load(true);
        location.hash = "#";
      });
    };
    const all = $("#stopAll") || $("#resumeAll");
    all.onclick = () => {
      const stop = !!$("#stopAll");
      if (stop && !confirm(`توقف ${c.displayName || c.customer} خالص؟`)) return;
      busy(all, async () => { await update({ revoked: stop }); await done(stop ? "اتوقف ✓" : "رجع ✓"); });
    };
  }

  /** تفاصيل النشاط: كل يوم في آخر ٣٠ يوم، بيسجلوا إيه، مين بيسجل، آخر الحاجات */
  async function activityInto(box, c) {
    const r = await call("activity", { id: c.id });
    const byDay = new Map(r.days.map((x) => [x.day, x.n]));
    const days = [...Array(30)].map((_, i) => {
      const t = new Date(Date.now() - (29 - i) * 86400000);
      const k = isoDay(t);
      return { k, n: byDay.get(k) || 0, label: t.getDate() };
    });
    const max = Math.max(1, ...days.map((x) => x.n));
    const bars = days
      .map((x) => `<div title="${x.k}: ${x.n}" style="flex:1;display:flex;flex-direction:column;justify-content:flex-end;height:64px"><div style="height:${x.n ? Math.max(4, (x.n / max) * 64) : 2}px;background:${x.n ? "var(--blue)" : "var(--line)"};border-radius:3px 3px 0 0"></div></div>`)
      .join("");
    const list = (rows, f) => (rows.length ? rows.map(f).join("") : `<div class="muted">مفيش</div>`);
    box.innerHTML = `
      <div class="muted" style="margin-bottom:4px">كل يوم في آخر ٣٠ يوم</div>
      <div style="display:flex;gap:2px;align-items:flex-end">${bars}</div>
      <div class="row muted" style="justify-content:space-between;font-size:11px"><span>${days[0].label}</span><span>النهارده</span></div>
      <h3>مين بيسجل</h3>
      ${list(r.people, (p) => `<div class="row"><span class="grow">${esc(p.device)}</span><b>${ar(p.n)}</b><span class="muted">${ago(p.last)}</span></div>`)}`;
  }

  async function devicesInto(box, c) {
    const r = await call("devices", { id: c.id });
    if (!r.devices.length) { box.innerHTML = `<div class="muted">مفيش أجهزة لسه.</div>`; return; }
    box.innerHTML = r.devices.map((v) => `
      <div class="dev">
        <div class="grow">
          <b>${esc(v.device_name || "جهاز")}</b> ${v.revoked ? `<span class="pill bad">طالع</span>` : ""}
          <div class="muted">${esc(v.platform || "")}${v.app_version ? ` · ${esc(v.app_version)}` : ""} · <span class="code" style="font-weight:400">${esc(v.key)}</span></div>
          <div class="muted">آخر ظهور: ${v.last_seen_at ? new Date(v.last_seen_at).toLocaleString("ar-EG") : "—"}</div>
        </div>
        <button class="btn ${v.revoked ? "green" : "red"}" data-dev="${v.id}" data-rev="${v.revoked ? 1 : 0}">${v.revoked ? "رجّعه" : "طلّعه"}</button>
      </div>`).join("");
    box.querySelectorAll("[data-dev]").forEach((b) => (b.onclick = () => {
      const out = b.dataset.rev !== "1";
      if (out && !confirm("تطلّع الجهاز ده؟ مكانه على الكود هيفضى.")) return;
      busy(b, async () => {
        await call("device.revoke", { deviceId: Number(b.dataset.dev), revoked: out });
        await load(true);
        await devicesInto(box, c);
      });
    }));
  }

  // ---- عميل جديد ----
  async function newView() {
    shell("عميل جديد", `<div class="muted">بيحمّل…</div>`);
    let d;
    try { d = await load(); } catch (e) { shell("عميل جديد", `<div class="card err">${esc(msg(e))}</div>`); return; }
    const m = new Date(); m.setMonth(m.getMonth() + 1);
    shell("عميل جديد", `
      <form class="card" id="f">
        <label>اسم العميل (عندك)</label><input name="customer" required>
        <label>الاسم اللي بيظهر في البرنامج</label><input name="displayName" placeholder="لو فاضي: اسم العميل">
        <label>تليفون العميل (واتساب)</label><input name="phone" dir="ltr" inputmode="tel" placeholder="01xxxxxxxxx">
        <label>اللوجو</label><input name="logo" type="file" accept="image/*">
        <label>البرنامج</label>
        <select name="products"><option value="rental">التأجير</option><option value="operations">التشغيل</option><option value="rental,operations">الاتنين</option></select>
        <label>الباقة</label><select name="plan">${planOptions(d.plans, "p5")}</select>
        <label>أقصى عدد أجهزة</label><input name="maxDevices" type="number" min="1" value="2" inputmode="numeric">
        <label>ينتهي في</label><input name="expiresAt" type="date" value="${isoDay(m)}">
        <label>باسورد الشركة (اختياري — بيتطلب أول مرة على أي جهاز)</label><input name="password" dir="ltr" autocomplete="off">
        <label>ملاحظة</label><input name="note">
        <button class="btn full" id="go" style="margin-top:14px">اعمل العميل والكود</button>
      </form>`);
    $("#f").onsubmit = (e) => {
      e.preventDefault();
      const f = e.target;
      busy($("#go"), async () => {
        const r = await call("customer.create", {
          customer: f.customer.value, displayName: f.displayName.value, phone: f.phone.value, products: f.products.value.split(","),
          plan: f.plan.value || null, maxDevices: Number(f.maxDevices.value) || 2, expiresAt: f.expiresAt.value || null,
          password: f.password.value.trim() || null, note: f.note.value, logo: await readLogo(f.logo.files[0]),
        });
        toast(`اتعمل ✓ الكود: ${r.key}`);
        await load(true);
        location.hash = `#sheet/${r.id}/${r.id}`;
      });
    };
  }

  // ---- ورقة العميل (للطباعة / PDF) ----
  async function sheetView(ownerId, codeId) {
    let d;
    try { d = await load(); } catch (e) { shell("ورقة العميل", `<div class="card err">${esc(msg(e))}</div>`, { back: true }); return; }
    const c = d.customers.find((x) => String(x.id) === String(ownerId));
    const k = c?.codes.find((x) => String(x.id) === String(codeId));
    if (!k) { shell("ورقة العميل", `<div class="card">مش لاقي الكود ده.</div>`, { back: true }); return; }
    const co = d.company || {};
    const way = (key, title, steps) => `
      <div class="way"><b>${title}</b><br><img src="qr-${key}.png" alt=""><br><a href="${LINKS[key]}">${LINKS[key].replace("https://", "")}</a>
      <ol>${steps.map((s) => `<li>${s}</li>`).join("")}</ol></div>`;
    shell("ورقة العميل", `
      <div class="row noprint" style="margin-bottom:12px">
        <button class="btn grow" onclick="print()">اطبع / احفظ PDF</button>
        <button class="btn soft" id="share">ابعت</button>
      </div>
      <div class="sheet">
        <div class="head">
          <img src="${esc(co.logoUrl || "../mk-icon-192.png")}" alt="">
          <div class="grow"><b style="font-size:18px">${esc(co.name || "MK-Tech")}</b><div style="color:#64748b;font-size:13px">برنامج ${k.products.map((p) => PRODUCTS[p] || p).join(" و")} — ${esc(c.displayName || c.customer)}</div></div>
        </div>
        <div class="codebox">
          <div style="color:#0b5fff;font-weight:700">كود التفعيل</div>
          <div style="margin:8px 0"><span class="code">${esc(k.key)}</span></div>
          <div>الكود ده بيفتح: <b style="color:#0b5fff">${k.products.map((p) => PRODUCTS[p] || p).join(" + ")}</b> · على ${ar(k.maxDevices)} جهاز</div>
          <div style="color:#64748b;font-size:13px">اكتبه مرة واحدة على كل جهاز — وأول مرة لازم يكون فيه نت.${k.hasPassword ? " وهيطلب <b>باسورد الشركة</b> — خده من الإدارة." : ""}</div>
        </div>
        <div class="ways">
          ${way("windows", "💻 اللابتوب (ويندوز)", ["افتح اللينك أو امسح الكود ونزّل البرنامج", "افتح الملف ودوس تسطيب", "اكتب كود التفعيل"])}
          ${way("android", "📱 التابلت / موبايل أندرويد", ["امسح الكود ونزّل الملف", "اسمح بالتسطيب من المصدر ده", "افتح البرنامج واكتب الكود"])}
          ${way("web", "🍎 آيفون / أي متصفح", ["افتح اللينك من Safari", "مشاركة ← إضافة إلى الشاشة الرئيسية", "افتحه من الأيقونة واكتب الكود"])}
        </div>
        <div style="text-align:center;color:#64748b;font-size:13px;margin-top:14px">
          محتاج مساعدة؟ كلّم ${esc(co.name || "MK-Tech")}${co.phone ? ` — <span dir="ltr">${esc(co.phone)}</span>` : ""}${co.whatsapp && co.whatsapp !== co.phone ? ` · واتساب <span dir="ltr">${esc(co.whatsapp)}</span>` : ""}
        </div>
      </div>`, { back: true });
    $("#share").onclick = async () => {
      const text = `كود تفعيل ${k.products.map((p) => PRODUCTS[p] || p).join(" + ")}: ${k.key}\n\nاللابتوب: ${LINKS.windows}\nالتابلت: ${LINKS.android}\nالآيفون / المتصفح: ${LINKS.web}`;
      try { if (navigator.share) await navigator.share({ text }); else { await navigator.clipboard.writeText(text); toast("اتنسخ ✓"); } } catch {}
    };
  }

  // ---- بيانات MK ----
  async function companyView() {
    shell("MK-Tech", `<div class="muted">بيحمّل…</div>`);
    let d;
    try { d = await load(); } catch (e) { shell("MK-Tech", `<div class="card err">${esc(msg(e))}</div>`); return; }
    const co = d.company || {};
    const f = (k, label, o = "") => `<label>${label}</label><input name="${k}" value="${esc(co[k] || "")}" ${o}>`;
    shell("MK-Tech", `
      <form class="card" id="f">
        <h2>بيانات الشركة</h2>
        <div class="muted">بتظهر في ورقة العميل.</div>
        ${co.logoUrl ? `<img class="logo" src="${esc(co.logoUrl)}" alt="" style="margin-top:10px">` : ""}
        ${f("name", "الاسم")}
        <label>اللوجو</label><input name="logo" type="file" accept="image/*">
        ${f("phone", "التليفون", 'dir="ltr" inputmode="tel"')}
        ${f("whatsapp", "واتساب", 'dir="ltr" inputmode="tel"')}
        ${f("email", "الإيميل", 'dir="ltr" type="email"')}
        ${f("address", "العنوان")}
        ${f("instapay", "حساب إنستاباي", 'dir="ltr"')}
        ${f("wallet", "رقم المحفظة", 'dir="ltr" inputmode="tel"')}
        <label>ملاحظات</label><textarea name="notes" rows="3">${esc(co.notes || "")}</textarea>
        <button class="btn full" id="go" style="margin-top:14px">احفظ</button>
      </form>`);
    $("#f").onsubmit = (e) => {
      e.preventDefault();
      const el = e.target;
      busy($("#go"), async () => {
        const next = { ...co };
        for (const k of ["name", "phone", "whatsapp", "email", "address", "instapay", "wallet", "notes"]) next[k] = el[k].value.trim();
        const logo = await readLogo(el.logo.files[0]);
        await call("company.save", { data: next, logo });
        toast("اتحفظ ✓");
        await load(true);
        companyView();
      });
    };
  }

  // ---- الحساب ----
  function meView() {
    shell("الحساب", `
      <form class="card" id="f">
        <h2>غيّر باسورد اللوحة</h2>
        <label>الباسورد الحالي</label><input name="current" type="password" dir="ltr" autocomplete="current-password" required>
        <label>الباسورد الجديد</label><input name="next" type="password" dir="ltr" autocomplete="new-password" minlength="6" required>
        <label>اكتبه تاني</label><input name="again" type="password" dir="ltr" autocomplete="new-password" required>
        <button class="btn full" id="go" style="margin-top:14px">غيّر</button>
      </form>
      <div class="card">
        <h2>على الآيفون</h2>
        <div class="muted">من Safari: زرار المشاركة ← "إضافة إلى الشاشة الرئيسية" — هتبقى أيقونة زي أي أبلكيشن.</div>
      </div>
      <div class="card">
        <h2>التنبيهات</h2>
        <div class="muted">بيوصلك إشعار لما عميل يقف أسبوعين، أو اشتراكه يقرّب يخلص (٣ أيام)، وملخص كل يوم حد الصبح.
          ${data?.push?.devices ? `<br>متفعّلة على ${ar(data.push.devices)} جهاز.` : ""}</div>
        <div class="row" style="margin-top:10px">
          <button class="btn" id="pushOn">🔔 فعّل التنبيهات على الجهاز ده</button>
          <button class="btn soft" id="pushTest">ابعت تنبيه تجربة</button>
        </div>
        <div class="muted" id="pushNote" style="margin-top:6px;font-size:12px"></div>
      </div>
      <button class="btn red full" id="out">تسجيل خروج</button>`);
    $("#f").onsubmit = (e) => {
      e.preventDefault();
      const f = e.target;
      if (f.next.value !== f.again.value) return toast("الباسوردين مش زي بعض");
      busy($("#go"), async () => {
        await call("admin.password", { current: f.current.value, next: f.next.value });
        f.reset();
        toast("اتغير ✓");
      });
    };
    $("#out").onclick = logout;
    $("#pushOn").onclick = (e) => busy(e.target, enablePush);
    $("#pushTest").onclick = (e) => busy(e.target, async () => {
      const r = await call("push.test");
      toast(r.sent ? `اتبعت لـ ${ar(r.sent)} جهاز ✓` : "مفيش جهاز متفعّل عليه التنبيهات لسه");
    });
  }

  const b64ToBytes = (b) => Uint8Array.from(atob(b.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((b.length + 3) % 4)), (c) => c.charCodeAt(0));
  async function enablePush() {
    const note = $("#pushNote");
    const standalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      note.textContent = /iPhone|iPad/.test(navigator.userAgent) && !standalone
        ? "على الآيفون: ضيف اللوحة للشاشة الرئيسية الأول (مشاركة ← إضافة إلى الشاشة الرئيسية)، وافتحها من الأيقونة، وبعدين دوس هنا."
        : "الجهاز ده مش بيدعم التنبيهات.";
      return;
    }
    const perm = await Notification.requestPermission();
    if (perm !== "granted") { note.textContent = "لازم توافق على الإشعارات (من إعدادات الآيفون ← الإشعارات ← إدارة MK)."; return; }
    const d = await load();
    if (!d.push?.key) throw new Error("server");
    const reg = await navigator.serviceWorker.register("sw.js", { scope: "./" });
    await navigator.serviceWorker.ready;
    const sub = (await reg.pushManager.getSubscription()) || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(d.push.key) }));
    await call("push.subscribe", { subscription: sub.toJSON(), device: /iPhone/.test(navigator.userAgent) ? "آيفون" : "جهاز" });
    await load(true);
    note.textContent = "اتفعّلت ✓ — دوس «ابعت تنبيه تجربة» عشان تتأكد.";
  }

  function render() {
    if (!token) return loginView();
    const [r, a, b] = location.hash.replace(/^#/, "").split("/");
    window.scrollTo(0, 0);
    if (r === "c" && a) return customerView(a);
    if (r === "new") return newView();
    if (r === "company") return companyView();
    if (r === "me") return meView();
    if (r === "sheet" && a && b) return sheetView(a, b);
    return listView();
  }
  addEventListener("hashchange", render);
  render();
})();
