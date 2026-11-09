// Films the rental app step by step (a fresh company, from the activation code),
// one frame per click / typed letter, into ../public/story/NNNN.jpg + ../src/story.json.
// Each frame records the element being acted on, so the video can zoom, point and click on it.
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const OUT = path.join(__dirname, "..", "public", "story");
const JSON_OUT = path.join(__dirname, "..", "src", "story.json");
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

const W = 1600, H = 900, DSF = 2;
const frames = [];
let chapter = "";
let n = 0;

(async () => {
  const b = await chromium.launch();
  const c = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: DSF, locale: "ar-EG" });
  // a brand-new company on every run; hide the dev-only sync line and version number
  await c.addInitScript(() => {
    if (!sessionStorage.getItem("shots_init")) {
      localStorage.clear();
      localStorage.setItem("shots_state", "needed");
      sessionStorage.setItem("shots_init", "1");
    }
    const hide = () =>
      document.querySelectorAll("div,span,small,p,b,strong").forEach((e) => {
        if ((e.textContent || "").length < 60 && /بيدخل على حساب|^الإصدار|متزامن|اتزامن|بيتزامن/.test((e.textContent || "").trim())) e.style.visibility = "hidden";
      });
    new MutationObserver(hide).observe(document, { subtree: true, childList: true, characterData: true });
  });
  const p = await c.newPage();
  p.on("pageerror", (e) => console.log("PAGE ERROR", e.message.slice(0, 200)));

  const box = async (loc) => {
    if (!loc) return null;
    const bb = await loc.first().boundingBox();
    return bb ? { x: bb.x / W, y: bb.y / H, w: bb.width / W, h: bb.height / H } : null;
  };
  /** one frame: kind = view | point (cursor goes to target) | click | type */
  const shot = async (kind, target, note = "") => {
    await p.waitForTimeout(kind === "type" ? 30 : 250);
    const file = `${String(++n).padStart(4, "0")}.jpg`;
    await p.screenshot({ path: path.join(OUT, file), type: "jpeg", quality: 88 });
    frames.push({ file, chapter, kind, target: await box(target), note });
    if (process.env.DBG) console.log(file, chapter, kind, note);
  };
  const click = async (loc, note = "", settle = 900) => {
    await loc.first().scrollIntoViewIfNeeded();
    await shot("point", loc, note);
    await shot("click", loc, note);
    await loc.first().click();
    await p.waitForTimeout(settle);
    await shot("view", null, note);
  };
  const type = async (loc, text, note = "") => {
    await loc.first().scrollIntoViewIfNeeded();
    await shot("point", loc, note);
    await loc.first().click();
    await loc.first().fill("");
    let typed = "";
    for (const ch of [...text]) {
      typed += ch;
      await loc.first().fill(typed);
      await shot("type", loc, note);
    }
  };
  const select = async (loc, value, note = "") => {
    await loc.first().scrollIntoViewIfNeeded();
    await shot("point", loc, note);
    await shot("click", loc, note);
    await loc.first().selectOption(value);
    await p.waitForTimeout(400);
    await shot("view", loc, note);
  };
  const nav = (label) => p.locator("aside, nav").getByText(label, { exact: true });
  const field = (label, root = p) => root.getByLabel(label, { exact: false });
  const modal = () => p.locator('[role="dialog"], .fixed').last();
  const step = async (name, fn) => {
    chapter = name;
    try {
      await fn();
      console.log("ok", name, n);
    } catch (e) {
      console.log("FAIL", name, e.message.split("\n")[0]);
      await p.screenshot({ path: path.join(__dirname, `fail-${name}.png`) });
      throw e;
    }
  };

  await p.goto("http://localhost:4173/");
  await p.waitForTimeout(2500);

  await step("activate", async () => {
    await shot("view");
    await type(p.getByLabel("كود التفعيل"), "MKTECH-7K2P-9QX4-B1NA", "الكود");
    await click(p.getByText("فعّل البرنامج"), "فعّل", 2500);
    await p.waitForTimeout(1500);
    await shot("view");
  });

  await step("password", async () => {
    await click(nav("الإعدادات"), "الإعدادات");
    for (const t of ["النسب", "النسخ الاحتياطي", "المزامنة بين الأجهزة", "الترخيص", "التحديثات"]) {
      const sec = p.locator("section", { has: p.locator("h2", { hasText: t }) }).first();
      await sec.scrollIntoViewIfNeeded();
      await shot("view", sec, t);
    }
    const panel = p.locator("section", { hasText: "باسورد الشركة" });
    await panel.scrollIntoViewIfNeeded();
    await shot("view", panel);
    await type(field("الباسورد", panel).first(), "1234", "الباسورد");
    await type(field("اكتبه تاني", panel), "1234", "تأكيد");
    await click(panel.getByText("حط باسورد"), "حط باسورد");
    await p.reload(); await p.waitForTimeout(2500); await shot("view", null, "البرنامج بيطلب الباسورد");
    await type(p.locator("input").first(), "1234", "باسورد الدخول");
    await click(p.getByText("دخول", { exact: true }), "دخول", 2500);
  });

  await step("tour", async () => {
    await shot("view");
    for (const s of ["السركي", "أصحاب المعدات", "الشركات والأفراد", "الخزنة", "الملف الضريبي", "الرئيسية"]) await click(nav(s), s, 700);
  });

  await step("supplier", async () => {
    await click(nav("أصحاب المعدات"), "أصحاب المعدات");
    await click(p.getByText("+ صاحب معدة").first(), "+ صاحب معدة");
    await type(field("الاسم", modal()), "الحاج محمد", "الاسم");
    await type(field("التليفون", modal()), "01012345678", "التليفون");
    await click(modal().getByText("حفظ", { exact: true }), "حفظ", 1200);
  });

  await step("equipment", async () => {
    await click(p.getByText("معداته", { exact: true }).first(), "معداته", 700);
    await click(p.getByText("+ معدة", { exact: true }).first(), "+ معدة");
    await type(field("اسم المعدة", modal()), "مان لفت ٣٦", "اسم المعدة");
    await click(modal().getByText("حفظ", { exact: true }), "حفظ", 1200);
  });

  await step("client", async () => {
    await click(nav("الشركات والأفراد"), "الشركات والأفراد");
    await click(p.getByText("+ عميل").first(), "+ عميل");
    await shot("view", field("النوع", modal()), "النوع");
    await type(field("الاسم", modal()), "شركة البناء", "الاسم");
    await type(field("التليفون", modal()), "01098765432", "التليفون");
    await type(field("الرقم الضريبي", modal()), "512-345-678", "الرقم الضريبي");
    await shot("point", modal().getByText("عليه ١٤٪"), "١٤٪");
    await click(modal().getByText("حفظ", { exact: true }), "حفظ", 1200);
  });


  await step("contract", async () => {
    await click(nav("السركي"), "السركي");
    await click(p.getByText("عقد جديد").first(), "+ عقد جديد");
    const m = modal();
    await select(m.getByLabel("العميل"), { label: "شركة البناء" }, "العميل");
    const eq = m.getByLabel("المعدة", { exact: true });
    const eqVal = await eq.locator("option", { hasText: "مان لفت" }).first().getAttribute("value");
    await select(eq, eqVal, "المعدة");
    await shot("view", m.getByLabel("المحاسبة"), "المحاسبة");
    await type(field("سعر الشركة", m), "4500", "سعر الشركة");
    await type(field("سعر صاحب المعدة", m), "3500", "سعر صاحب المعدة");
    await type(field("الموقع", m), "التجمع الخامس", "الموقع");
    await field("من", m).first().fill("2026-10-01");
    await shot("point", field("من", m), "من");
    await click(m.getByText("حفظ العقد"), "حفظ العقد", 1500);
  });

  await step("sarki", async () => {
    await select(p.getByLabel("الشهر"), "2026-10", "الشهر");
    await type(field("من يوم"), "1", "من يوم");
    await type(field("لحد يوم"), "22", "لحد يوم");
    await shot("point", field("سعر اليوم"), "سعر اليوم");
    await click(p.getByText("تطبيق على الأيام").first(), "تطبيق", 1500);
    const days = p.getByText(/الإجمالي — ٢٢ يوم شغل|22 يوم/).first();
    await days.scrollIntoViewIfNeeded().catch(() => {});
    await shot("view", null, "الأيام");
    await p.mouse.wheel(0, -4000);
    await click(p.getByText("سركي صاحب المعدة").first(), "سركي صاحب المعدة", 1000);
    await click(p.getByText("سركي الشركة").first(), "سركي الشركة", 800);
  });

  await step("invoice", async () => {
    await click(nav("الشركات والأفراد"), "الشركات والأفراد", 1200);
    await click(p.getByText("الفواتير", { exact: true }).first(), "الفواتير", 900);
    await click(p.getByText("+ دفعة من عميل").first(), "+ دفعة", 900);
    await type(field("المبلغ"), "60000", "المبلغ");
    await p.locator('input[type="date"]:visible').first().fill("2026-11-03");
    await select(field("عن أنهي شهر"), { index: 1 }, "عن أنهي شهر");
    await click(p.getByText("حفظ الدفعة").first(), "حفظ الدفعة", 1500);
    await p.mouse.wheel(0, -4000);
    await shot("view", p.getByText("الباقي عليه").first(), "الباقي عليه");
  });

  await step("supplierAccount", async () => {
    await click(nav("أصحاب المعدات"), "أصحاب المعدات", 1200);
    await shot("view", p.getByText("إجمالي المستحق له").first(), "المستحق له");
    await click(p.getByText("الخصومات", { exact: true }).first(), "الخصومات", 900);
    await type(field("المبلغ"), "4000", "مبلغ السولار");
    await type(field("البيان"), "سولار", "البيان");
    await click(p.getByText("حفظ الخصم").first(), "حفظ الخصم", 1500);
    await click(p.getByText("+ دفعة لصاحب معدة").first(), "+ دفعة", 900);
    await type(field("المبلغ"), "50000", "مبلغ الدفعة");
    await select(field("عن أنهي شهر"), { index: 1 }, "عن أنهي شهر");
    await click(p.getByText("حفظ الدفعة").first(), "حفظ الدفعة", 1500);
    await p.mouse.wheel(0, -4000);
    await shot("view", p.getByText("الباقي له").first(), "الباقي له");
    await click(p.getByText("كشف الحساب").first(), "كشف الحساب", 900);
  });

  await step("home", async () => {
    await click(nav("الرئيسية"), "الرئيسية", 1200);
    await select(p.locator("select:visible").first(), "2026-10", "الشهر");
    const show = p.getByText("اظهر الأرقام").first();
    if (await show.isVisible().catch(() => false)) await click(show, "اظهر الأرقام", 800);
    await shot("view", p.getByText("مستحق من العملاء").first(), "ليك");
    await shot("view", p.getByText("علينا للموردين").first(), "عليك");
    await click(p.getByText("اخفي الأرقام").first(), "اخفي الأرقام", 800);
    await click(p.getByText("اظهر الأرقام").first(), "اظهر الأرقام", 800);
  });

  await step("activity", async () => {
    await click(nav("سجل التعديلات"), "سجل التعديلات", 1200);
    await shot("view", p.getByText("تراجع").first(), "تراجع");
  });

  fs.writeFileSync(JSON_OUT, JSON.stringify({ w: W, h: H, frames }, null, 1));
  await b.close();
})().catch((e) => {
  fs.writeFileSync(JSON_OUT, JSON.stringify({ w: W, h: H, frames }, null, 1));
  console.error("stopped:", e.message.split("\n")[0]);
  process.exit(1);
});
