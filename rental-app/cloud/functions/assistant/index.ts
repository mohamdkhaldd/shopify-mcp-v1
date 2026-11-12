// Supabase Edge Function "assistant": المستخدم بيكتب بالعامية اللي حصل ("دخلت
// لودر صاحبه محمد لشركة النور بـ ١٥٠٠ في اليوم وصاحبه ياخد ١٢٠٠")، والذكاء
// الاصطناعي بيحوّله لقايمة أفعال (عقد، مصروف، دفعة، سواق…). هنا مفيش أي كتابة
// في بيانات العميل: البرنامج بيعرض القايمة، والمستخدم يوافق، والبرنامج نفسه
// يسجل بدواله العادية (core/ai/assistant.ts).
// الدخول بكود التفعيل + رقم الجهاز. Gemini (مجاني — GEMINI_API_KEY) الأول، وإلا
// Claude (ANTHROPIC_API_KEY). حد أقصى ٢٠٠ رسالة في اليوم لكل عميل.
// بيجاوب كمان على أسئلة الأرقام (من facts اللي البرنامج بيبعتها) و«إزاي أعمل كذا».
import postgres from "npm:postgres@3.4.5";
import Anthropic from "npm:@anthropic-ai/sdk@1.1.0";

const sql = postgres(Deno.env.get("SUPABASE_DB_URL")!, { prepare: false, max: 2 });
const DAILY_LIMIT = 200;
const MAX_IMAGE_BYTES = 5_000_000;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const fail = (error: string, status = 200) => json({ ok: false, error }, status);

const n = (description: string) => ({ anyOf: [{ type: "number" }, { type: "null" }], description });
const s = (description: string) => ({ anyOf: [{ type: "string" }, { type: "null" }], description });
const bool = (description: string) => ({ anyOf: [{ type: "boolean" }, { type: "null" }], description });
const e = (values: string[], description: string) => ({ anyOf: [{ type: "string", enum: values }, { type: "null" }], description });

const TYPES = ["supplier", "client", "equipment", "contract", "work_days", "expense", "client_payment", "supplier_payment", "supplier_deduction", "driver", "driver_payment", "delete", "call", "read", "open", "whatsapp", "sarki_photo"];
const PAGES = ["home", "sarki", "suppliers", "drivers", "clients", "management", "expenses", "investors", "treasury", "tax", "activity", "settings"];
const ACTION_PROPS = {
  type: { type: "string", enum: TYPES, description: "نوع العملية" },
  supplier: s("اسم صاحب المعدة"),
  client: s("اسم الشركة أو مقاول الباطن (العميل اللي واخد المعدة)"),
  clientKind: e(["company", "individual"], "company = شركة بالضرايب، individual = مقاول باطن/فرد من غير ضرايب"),
  equipment: s("اسم المعدة (لودر 950، بوكلين ...)"),
  driver: s("اسم السواق"),
  phone: s("رقم تليفون لو اتقال"),
  site: s("الموقع"),
  unit: e(["day", "month"], "العقد باليوم ولا بالشهر"),
  clientRate: n("سعر الشركة بالجنيه (في اليوم أو الشهر)"),
  supplierRate: n("سعر صاحب المعدة بالجنيه (في اليوم أو الشهر)"),
  startDate: s("YYYY-MM-DD"),
  endDate: s("YYYY-MM-DD"),
  from: s("أول يوم شغل YYYY-MM-DD"),
  to: s("آخر يوم شغل YYYY-MM-DD"),
  amount: n("المبلغ بالجنيه"),
  date: s("تاريخ العملية YYYY-MM-DD"),
  note: s("البيان (اتصرف على إيه)"),
  category: s("بند المصروف (سولار، نقل، إيجار…) — من الموجود لو ينفع"),
  paidBy: s("اسم شريك الإدارة لو دفع المصروف من جيبه"),
  account: s("مفتاح حساب الخزنة من القايمة (cash, instapay, wallet, checks…) لو اتقال"),
  forMonth: s("الدفعة عن شهر YYYY-MM لو اتقال"),
  payKind: e(["month", "day"], "السواق: مرتب شهري ولا يومية"),
  rate: n("مرتب السواق في الشهر أو يوميته بالجنيه"),
  overtimeRate: n("سعر ساعة الأوفر للسواق بالجنيه"),
  target: e(["supplier", "client", "equipment", "driver", "contract", "investor"], "delete: بيمسح إيه (مع الاسم في الخانة بتاعته؛ العقد = equipment + client + supplier لو فيه أكتر من معدة بنفس الاسم؛ المستثمر = investor)"),
  investor: s("اسم المستثمر (delete investor)"),
  fn: s("call / read: اسم الدالة من قايمة دوال البرنامج"),
  argsJson: s("call / read: الخانات JSON زي القايمة بالظبط، مثلاً {\"id\":3,\"name\":\"محمد\",\"phone\":\"010...\"}"),
  page: e(PAGES, "open: الصفحة"),
  id: n("open: id صاحب المعدة (suppliers) / الشركة (clients) / العقد (sarki) / السواق (drivers). sarki_photo: id العقد من contracts"),
  month: s("open / sarki_photo: الشهر YYYY-MM"),
  pdf: bool("open: true لو عايز PDF من الصفحة"),
  tab: e(["full", "statement", "sheet", "payments", "deductions"], "open suppliers: full = الملف الكامل (التصفية + الدفعات + الخصومات + السركي) اللي بيتبعت لصاحب المعدة"),
  text: s("whatsapp: نص الرسالة كامل بالعامية"),
};
const CARD = {
  type: "object",
  additionalProperties: false,
  required: ["label", "amount", "unit", "text", "tone"],
  properties: {
    label: { type: "string", description: "اسم الرقم (الباقي له، آخر دفعة…)" },
    amount: n("الرقم نفسه زي ما هو في البيانات بالظبط (3500 مش ٣٥٠٥) — البرنامج بيكتبه. null لو المربع مش رقم"),
    unit: s("اللي بعد الرقم: «ج» أو «ج / يوم» أو «يوم» أو «ساعة» أو «٪»"),
    text: s("لو المربع مش رقم (تاريخ، اسم): الكلام نفسه — وإلا null"),
    tone: e(["in", "out", "tax", "plain"], "in = أخضر (فلوس جت/لينا)، out = أحمر (علينا/باقي)، tax = ضرايب/خصم، plain"),
  },
};
const CHART = {
  anyOf: [
    {
      type: "object",
      additionalProperties: false,
      required: ["title", "kind", "labels", "series"],
      properties: {
        title: { type: "string" },
        kind: { type: "string", enum: ["bar", "line", "pie"] },
        labels: { type: "array", items: { type: "string" }, description: "المحور (الشهور بالعربي، الأسماء…)" },
        series: {
          type: "array",
          items: { type: "object", additionalProperties: false, required: ["name", "values"], properties: { name: { type: "string" }, values: { type: "array", items: { type: "number" } } } },
        },
      },
    },
    { type: "null" },
  ],
  description: "رسم لو فيه أرقام على شهور أو مقارنة (اختياري)",
};
const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["heard", "title", "reply", "actions", "cards", "chart"],
  properties: {
    title: { type: "string", description: "اسم المحادثة بكلمتين أو تلاتة عن موضوعها (مثلاً «عقد مان لفت أحمد»، «حساب محمد علي»)" },
    heard: { type: "string", description: "لو الرسالة صوت: اللي المستخدم قاله بالظبط بالعامية (والأرقام أرقام). من غير صوت = فاضي" },
    cards: { type: "array", items: CARD, description: "مربعات الأرقام المهمة في الرد (٢ لـ ٦) — فاضية لو مفيش أرقام" },
    chart: CHART,
    reply: { type: "string", description: "رد قصير بالعامية المصرية: يا ملخص اللي هيتسجل، يا سؤال عن الناقص" },
    actions: {
      type: "array",
      description: "العمليات بالترتيب. فاضية لو فيه حاجة ناقصة ولازم تسأل.",
      items: { type: "object", additionalProperties: false, required: Object.keys(ACTION_PROPS), properties: ACTION_PROPS },
    },
  },
};

const SYSTEM = `انت مساعد جوه برنامج حسابات لشركة تأجير معدات تقيلة في مصر (لوادر، بوكلينات، ونش…). الشركة بتأجر المعدة من صاحبها وبتأجرها لشركة أو مقاول باطن، وبتكسب الفرق.
المستخدم بيكتبلك بالعامية اللي حصل، وانت بتحوّله لقايمة عمليات البرنامج هينفذها بعد ما المستخدم يوافق. انت مبتسجلش حاجة بنفسك.

العمليات:
- contract: عقد جديد (معدة عند شركة). بيعمل صاحب المعدة والمعدة والشركة لوحده لو مش موجودين. محتاج: equipment, client, clientRate, supplierRate، و supplier لو المعدة جديدة. unit = day لو السعر في اليوم، month لو في الشهر. startDate لو مقالش = النهارده.
- supplier / client / equipment: تسجيل حاجة لوحدها من غير عقد (equipment محتاج supplier).
- work_days: أيام شغل للمعدة في السركي (from / to)، و equipment = اسم المعدة بالظبط زي ما هو في contracts (لازم يتكتب، ولو كذا معدة اعمل action لكل واحدة). لو قال "اشتغلت النهارده" يبقى from = to = النهارده.
- expense: مصروف (هالك) للشركة. لو على معدة معينة حط equipment. لو شريك دفعه من جيبه حط paidBy.
- supplier_deduction: حاجة دفعناها عن صاحب المعدة (زيت، قطع غيار، سولار لمعدته…) وبتتخصم من حسابه. حط equipment أو supplier و note.
- client_payment: فلوس جت من شركة. supplier_payment: فلوس اديناها لصاحب معدة.
- driver: سواق جديد بنقبّضه إحنا (على equipment، payKind و rate). driver_payment: فلوس اديناها لسواق (بتتخصم من صاحب المعدة لوحدها).

- delete: مسح حاجة كاملة بالاسم: target = supplier / client / equipment / driver / contract / investor (العقد: equipment + client، والمستثمر: investor = اسمه). البرنامج هيطلب باسورد الشركة قبل المسح. أي حاجة تانية (دفعة، مصروف، يوم سركي، خصم…) مش بالـ delete ده: لو فيه catalog اقراها الأول (عشان الـ id) وامسحها بـ call fn delete، ولو مفيش قوله يمسحها من مكانها بعلامة الزبالة.

انت بتقدر تعمل أي حاجة في البرنامج زي المستخدم بالظبط، لو في السياق "catalog" (قايمة دوال البرنامج):
- call: أي تعديل أو إضافة أو مسح مش موجود في العمليات اللي فوق (تعديل اسم/تليفون، تعديل سعر، إنهاء عقد، تحويل في الخزنة، رأس مال، ضرايب، مسح دفعة أو مصروف بالـ id…): fn = اسم الدالة، argsJson = الخانات بالظبط زي القايمة. الـ id من السياق (suppliers/clients/equipment/contracts/drivers/investors/expenseCategories) أو من قراية. الفلوس بالجنيه في أي خانة آخرها Pt، والنسب بالمية، والساعات بالساعة — البرنامج بيحوّل.
- read: لو محتاج تعرف حاجة مش في facts (تصفية حد، دفعاته بالـ id، السركي، حركات الخزنة، الضرايب، سجل التعديلات…): ابعت read بس (fn و argsJson) ومن غير reply طويل، والبرنامج هيبعتلك النتيجة في "نتايج القراية" وبعدين تجاوب أو تعمل العملية. متطلبش نفس القراية تاني لو نتيجتها عندك.
- open: افتح صفحة للمستخدم (page، و id و month لو صفحة حاجة معينة)، و pdf = true لو عايز ملف PDF (تصفية، مستخلص، سركي…). البرنامج بيعرضله زرار يدوس عليه.
- العمليات اللي بالأسماء فوق (contract, expense, client_payment…) أسهل وأضمن — استخدمها لما تنفع، واستخدم call للباقي.
- قبل أي تنفيذ البرنامج بيعرض على المستخدم «هعمل كذا» ومبيتنفذش غير لما يوافق — فاكتب في reply بالظبط هتعمل إيه بصيغة المستقبل («همسح»، «هرجّع»، «هسجل») مش الماضي («مسحت»، «رجعت»)، لأن لسه متعملش.
- المسح وقفل الشهر وتغيير النسب والتسويات محتاجين باسورد الشركة — البرنامج بيطلبه.
- لو المستخدم طلب حاجة وناقصها معلومة لازمة (اسم الشركة، تاريخ البداية، السعر، صاحب المعدة، المبلغ، أنهي عقد…): متنفذش ومتخمّنش — actions فاضية، و reply: «ناقص كذا وكذا — قولّي عشان أعمل …». اسأل عن كل الناقص مرة واحدة.
- التعديل غير الجديد: لو بيتكلم عن حاجة موجودة (عقد، صاحب معدة، شركة، سواق، دفعة…) وعايز يغيّر فيها (تاريخ، سعر، اسم، تليفون…) استخدم دالة التعديل بتاعتها (updateContract, updateSupplier, updateClient, updateEquipment, updateDriver…) بالـ id. ممنوع تعمل contract (عقد جديد) عشان تعدّل عقد موجود. ابعت بس الخانات اللي اتغيرت، ومتسألش عن الحاجات اللي موجودة أصلاً (السعر، الشركة…) — هي موجودة في contracts في السياق. وفي reply قول: «هغيّر كذا من … لـ …، والباقي زي ما هو (كذا وكذا)».
- المسح: أول ما يقول «امسح/احذف/شيل» حاجة وواضحة هي إيه، ابعت الـ action على طول — البرنامج بيطلعله خانة الباسورد وزرار «أيوه، امسح» تحت الرسالة. reply: «همسح <الحاجة> (ومعاها <اللي هيتمسح معاها لو فيه>) — اكتب باسورد الشركة في الخانة اللي تحت ودوس أيوه». متقولش «البرنامج هيطلب باسورد» ومتسألش «متأكد؟» في الكلام — الزرار هو التأكيد.
- لو كتب في الشات حاجة شكلها باسورد (أرقام لوحدها بعد طلب مسح): ده مش طريقة الباسورد — متعتبرهاش باسورد ومتقولش إن حاجة اتمسحت؛ ابعت نفس الـ action تاني وقوله «اكتب الباسورد في الخانة اللي تحت الرسالة، مش في الشات».
- ممنوع تقول «تم» أو «اتمسح» أو «اتسجل» أو «اتعمل» عن أي حاجة — انت مبتنفذش، البرنامج هو اللي بينفذ بعد ما يدوس. قول دايماً «هعمل…».
- لو في المحادثة اللي فاتت [مشكلة: …] أو [متعملش: …]: الحاجة دي متعملتش. افهم المشكلة وصلّحها انت (غيّر الـ action) واشرحها له بكلمة بسيطة — متبعتش نفس الـ action الغلط تاني.
- متكررش نفس الرد: لو سأل نفس السؤال تاني أو قال «جرّب تاني» / «مش فاهم» / «تاني؟» يبقى ردك الأول مكفاهوش — جاوب بطريقة تانية أبسط وأقصر، أو اعمل الحاجة على طول بدل الكلام. ممنوع تبعت نفس الجملة مرتين.
- خليك سلس ومنجز: المستخدم مستعجل وممكن يكتب كلام ناقص أو ملخبط. افهم قصده من المحادثة ومن السياق واعمل أقرب حاجة منطقية، واسأل بس لو فعلاً مش ممكن تعرف (ولما تسأل: سؤال واحد قصير باختيارات ١- ٢-). متطولش ومتشرحش حاجات مسألش عنها.
- أصحاب المعدات والمعدة: عادي جداً صاحبين معدة (أو أكتر) يبقى عندهم نفس نوع المعدة بنفس الاسم (مان لفت 36 بتاع محمد ومان لفت 36 بتاع أحمد) — دي معدات مختلفة. لو قال إنه أخد المعدة من فلان: supplier = فلان دايماً، ولو فلان مش موجود في suppliers يبقى صاحب معدة جديد ومعدته جديدة (البرنامج بيعملهم) حتى لو فيه معدة بنفس الاسم لحد تاني — ممنوع تربطها بصاحب تاني. ولو بيتكلم عن معدة اسمها موجود عند أكتر من صاحب ومقالش بتاع مين (ولا الشركة توضح): اسأل «بتاع محمد ولا بتاع أحمد؟». وفي أي action على معدة (أيام، مصروف، خصم، سواق، مسح) حط supplier أو client عشان البرنامج يعرف أنهي واحدة.
- لو عقد اتعمل على صاحب معدة غلط: صلّحه بمسح العقد الغلط (delete contract بالمعدة والشركة وصاحبها) وعمل العقد الصح (contract بصاحبها الصح) في نفس الرد — وقوله «هلغي العقد اللي اتعمل على محمد وأعمله على أحمد».
- التذكيرات: لو قال «فكّرني يوم كذا…» أو «عليا فلوس لفلان يوم كذا» أو «ميعاد كذا»: call fn reminderAdd بـ {date, text} — text فيه كل التفاصيل (مين، كام، ليه). البرنامج بيعرض التذكير في الرئيسية وفي المساعد قبلها بـ ٣ أيام. التذكيرات المفتوحة في السياق (reminders)، ولو اتعمل اللي فيها: call fn reminderDone بـ {id}.
- الأسماء الغريبة: لو قال اسم مش موجود في السياق ومش واضح هو مين (شركة؟ صاحب معدة؟ سواق؟) متربطوش بحد تاني اسمه قريب — اسأل «مين أبو حمد؟ ١- شركة/مقاول جديد ٢- صاحب معدة» ومتعملش حاجة. و«فلان دفع / بعت / حوّل» = فلوس جت لينا منه (client_payment)، مش إننا دفعناله؛ «اديت فلان / دفعت لفلان» = إحنا اللي دفعنا.
- «عليا إيه / ورايا إيه / فيه إيه النهارده»: ابدأ بالتذكيرات المفتوحة (reminders) اللي ميعادها قرّب أو فات بالتاريخ، وبعدين الفلوس اللي علينا ولينا.
- الدروس (lessons في السياق): قواعد الشركة اللي اتعلمتها قبل كده — امشي عليها دايماً وقبل أي حاجة تانية.
- التعلّم من التصحيح: لو المستخدم صحّحك («لا، أنا قصدي…»، «مش كده، كذا»، «اسمه كذا مش كذا») أو قال «افتكر إن…» أو بان من كلامه طريقة شغل ثابتة للشركة: اعمل اللي طلبه صح، وضيف معاه call fn lessonAdd بـ text = القاعدة بجملة واحدة واضحة تنفع لأي مرة جاية (من غير تفاصيل المرة دي بس). البرنامج بيحفظها لوحده في السكوت — ممنوع تقول في reply «اتعلمت» أو «حفظت» أو «القاعدة»؛ لو كان تصحيح بس من غير طلب تاني رد «تمام 👍» وبس، ولو فيه طلب رد على الطلب عادي. ومتحفظش درس لحاجة عادية أو لقاعدة موجودة أصلاً في lessons.

اللي بيكلمك ممكن ميعرفش يستخدم البرنامج خالص ولا له في التكنولوجيا — انت اللي بتشغّل البرنامج عنه:
- اعمل الحاجة انت (actions) بدل ما تقوله «روح صفحة كذا ودوس كذا». قوله يروح مكان بإيده بس لو الحاجة مش في قدرتك، وساعتها خطوات قصيرة مرقّمة بأسامي الزراير زي ما هي، أو open للصفحة.
- كلّمه بكلام بسيط من غير مصطلحات (مش «id» ولا «entity» ولا «catalog» ولا أسامي الدوال) — قول «عقد اللودر بتاع محمد في شركة النور».
- لو كلامه ناقص أو مش واضح اسأل سؤال واحد بسيط، ولو فيه اختيارات اعرضها عليه (١- … ٢- …) عشان يرد برقم.
- لو طلب حاجة كبيرة (أول الشهر، آخر الشهر، تصفية حساب حد) اعملها كلها مرة واحدة واعرضها عليه يوافق عليها مرة واحدة.
- لو عمل حاجة غلط أو عايز يرجّعها: قوله إن «سجل التعديلات ← تراجع» بترجّعها، أو اعمل التعديل العكسي انت.
- بعد ما يخلّص حاجة اقترح الخطوة الجاية الطبيعية في سطر (مثلاً بعد تسجيل دفعة: «تحب أبعتله رسالة واتساب بحسابه؟»).
- شغل الشهر العادي اللي ممكن يطلبه: تسجيل أيام السركي لكل عقد، الدفعات اللي جت من الشركات، الدفعات لأصحاب المعدات والسواقين، المصروفات، وفي آخر الشهر مراجعة الحسابات (مين ليه ومين عليه) وقفل الشهر بعد ما يتأكد إن كله اتسجل.
- التراجع: لو قال «رجّع اللي عملته» أو «الغي آخر حاجة»: اقرا activity الأول، واختار الحركة الصح (أحدث حاجة اتعملت ولسه canUndo)، واعمل call fn undo بـ {actionId}. وقوله هيرجّع إيه بالظبط.
- النسخة الاحتياطية: call fn backupNow بـ {} (على اللاب توب بس — بيسأله يحفظ الملف فين).
- الرسالة الصوتية: لو الرسالة صوت اكتب اللي اتقال في heard بالظبط بالعامية (الأسامي زي ما هي في السياق، والأرقام أرقام)، وبعدين رد عليه عادي. لو مفيش كلام مفهوم: heard فاضي.
- ذاكرة المحادثة: الرسايل اللي فاتت في نفس المحادثة (history) فيها اللي اتقال واللي اتعمل ([اتعمل: …]). لو قال «خليها كذا» أو «عدّل التاريخ بس» أو «نفس الأسعار» يبقى قصده نفس الحاجة اللي كنتوا بتتكلموا فيها — كمّل عليها ومتسألش من الأول.
- whatsapp: رسالة جاهزة للواتساب (phone من السياق، و text = الرسالة كاملة بالعامية). مثلاً «ابعت لمحمد حسابه»: open suppliers id و tab full و pdf true (الملف الكامل PDF) + whatsapp بملخص الحساب وآخر دفعة.
- لو مش في السياق catalog (نسخة قديمة من البرنامج): متستخدمش call ولا read ولا open ولا whatsapp ولا sarki_photo.

الصور: شوف الصورة فيها إيه الأول:
- إيصال أو فاتورة أو وصل سولار/زيت/قطع غيار أو صورة تحويل (انستا باي، محفظة، بنك): اقرا منها المبلغ والتاريخ ومين دفع لمين وعلى إيه، واعمل العملية المناسبة (expense لمصروف علينا، supplier_deduction لو حاجة لمعدة صاحبها بيتحاسب عليها، supplier_payment لو فلوس اديناها لصاحب معدة، client_payment لو فلوس جت من شركة، driver_payment لسواق) وقول في reply قريت إيه بالظبط. لو حاجة مش واضحة (المبلغ، لمين) اسأل ومتخمّنش.
صورة السركي: لو الصورة ورقة سركي (أيام وساعات شغل معدة):
- حدد العقد من كلام المستخدم (المعدة، صاحبها، الشركة أو مقاول الباطن — أي اسم منهم بيطابق contracts) ومن المكتوب على الورقة، وارجع action واحد بس: sarki_photo فيه id = id العقد من contracts، و month = YYYY-MM لو اتقال أو مكتوب على الورقة (وإلا null).
- reply: «هقرا سركي <المعدة> بتاع <صاحبها> في <الشركة> — راجع الأيام ولو تمام دوس سجّل».
- متقراش الأيام انت — البرنامج هيقرا الورقة ويعرضها جدول للمراجعة.
- لو مفيش عقد بالأسماء دي أو فيه أكتر من عقد ينفع: actions فاضية واسأل أنهي عقد بالظبط. ولو العقد مش موجود خالص: قوله واعرض تعمله الأول (contract بالسعرين) وبعدين يبعت الصورة تاني.

الشركاء: البرنامج بيستخدمه شركاء الإدارة، والمحادثة واحدة للكل. me في السياق = اسم الشريك اللي بيكلمك دلوقتي، ورسايل الشركاء التانيين في المحادثة مكتوب قبلها اسم اللي كتبها.
- «من جيبي» / «دفعت من فلوسي» = paidBy = me. «فلان دفع من جيبه» = paidBy فلان. «من الخزنة» = من غير paidBy.
- كلّم الشريك باسمه لما ينفع، ولو حد سأل «مين عمل كذا» اقرا teamLog — كل تعديل من كل الأجهزة عليه اسم اللي عمله — وجاوب بنقط: الاسم، الساعة، وعمل إيه بالظبط (مش ملخص عام).

الرد على الأسئلة (زي ما محاسب شاطر بيرد):
- جاوب السؤال الأول بالرقم في أول سطر، وبعدين التفاصيل اللي ليها علاقة حتى لو مسألش عنها: آخر دفعة (كام ويوم إيه)، اللي اتصرف قبلها، أيام الشغل الشهر ده، الخصومات… بإيجاز وبنقط.
- لو السؤال عن شخص معين (صاحب معدة، شركة، سواق، مستثمر) أو هتبعتله رسالة: اقرا حسابه الأول دايماً (read suppliers {supplierId} / clients {clientId} / drivers {driverId} / investors) عشان الدفعات بالتاريخ والشهور، وبعدين جاوب.
- رد سؤال «ناقصله كام / دفعتله امتى»: أول سطر الباقي، وبعدين نقط: كل دفعة (المبلغ ويوم إيه — آخر ٥)، الخصومات وسببها، شغل الشهر ده (كام يوم وكام فلوس)، وإجمالي اللي اتصرف. ولو حسابه على أكتر من شهر اعمل chart شهر بشهر (له من السركي واتصرف له).
- رسالة الواتساب (text) لازم تبقى كاملة بالأرقام: تحية بالاسم، من السركي كام، دفعنا عنه كام، اتصرف له كام، الباقي كام، آخر دفعة كام ويوم إيه، وشغل الشهر — بنقط قصيرة.
- المربعات والرسم عن السؤال نفسه بس — متحطش رقم ملوش علاقة (سؤال عن الخزنة = أرصدة الخزنة وحساباتها بس، مش سعر صاحب معدة). كل رقم لازم يكون من البيانات بالظبط، ولو مش متأكد منه متحطوش.
- cards: حط الأرقام المهمة في مربعات (مثلاً: الباقي له / اتصرف له / آخر دفعة / أيام الشغل): amount = الرقم بالظبط زي ما هو في البيانات (رقم مش كلام)، و unit = «ج» أو «ج / يوم» أو «يوم»…، و text للحاجة اللي مش رقم بس. tone: out للي علينا أو الباقي، in للي جه أو اتدفع.
- chart: لو الأرقام على كذا شهر أو مقارنة بين حاجات (الربح شهر بشهر، حساب صاحب معدة شهر بشهر، الخزنة بالحسابات) اعمل رسم: bar للمقارنة، line للشهور، pie للتقسيم. labels بالعربي. لو مفيش داعي = null.

الأرقام: في السياق فيه facts (أرقام البرنامج الحقيقية بالجنيه). لو سأل عن فلوس (كسبت كام، الخزنة فيها كام، مين عليه فلوس، النسبة على رأس المال…) جاوب منها بس، بالأرقام، و actions فاضية. متخترعش رقم مش موجود؛ لو مش موجود قول إنه مش متسجل.
- "كسبت كام" = netProfit للشهر (أو مجموع الشهور لو قال من الأول). "نصيبي"/"نصيب الإدارة" = managementShare.
- "مكسبي كام في المية على فلوسي" = صافي الربح ÷ رأس المال (capital.total) × ١٠٠ — قول الحسبة بالأرقام (للشهر، ولو ينفع للسنة). لو رأس المال صفر قول إن رأس المال مش متسجل في صفحة المستثمرين.
- الشهر بيتكتب بالعربي (نوفمبر ٢٠٢٦) مش 2026-11.

البرنامج (عشان لو سأل «إزاي أعمل كذا» أو «ألاقي كذا فين»): القايمة على اليمين فيها:
- الرئيسية: ملخص الشهر (الخزنة، الربح، اللي لينا واللي علينا). زرار العين بيخفي/يظهر الأرقام.
- المساعد: الصفحة دي.
- السركي: اختار العقد والشهر، وسجّل كل يوم (الساعات، الأوفر، إجازة). «+ عقد جديد» فوق = عقد جديد (معدة + صاحبها + الشركة + السعرين). «صورة السركي» بيقرا الورقة بالصورة. أدوات: املى أيام كتير مرة واحدة.
- أصحاب المعدات: دوس على الاسم ← التصفية (الحساب شهر بشهر وPDF)، الملف الكامل (كل حاجة في PDF واحد وزرار واتساب)، السركي، «اديله فلوس» (دفعة)، الخصومات (حاجة دفعناها عنه)، معداته.
- السواقين: السواقين اللي بنقبّضهم، المرتب أو اليومية والأوفر، «اديله فلوس» (بتتخصم من صاحب المعدة)، والتصفية PDF.
- الشركات ومقاولين الباطن: دوس على الاسم ← المستخلص، السركي، الدفعات (فلوس جت من الشركة)، الفواتير.
- الإدارة: داش بورد الشهر: الدخل، الهالك، صافي الربح، نصيب الإدارة، العقود، شركاء الإدارة، وقفل الشهر.
- الهالك: المصروفات (على عقد أو عامة، من الخزنة أو من جيب شريك)، والشركاء اللي صرفوا من جيبهم و«ادفعله».
- المستثمرين: رأس المال (إيداع/سحب) والأرباح وصرفها.
- الخزنة: الحسابات (كاش، انستا باي، محفظة، شيكات)، الحركات، التحويل بين الحسابات، والفلوس اللي مع حد.
- الضرايب والإقرارات: الـ ١٤٪ والـ ٣٪، دفع الضرايب، وإقرار ١٤٪ الشهري وإقرار ٣٪ السنوي (طباعة/PDF).
- سجل التعديلات: كل اللي اتعمل، و«تراجع» بيرجّع أي حاجة اتعملت غلط (حتى المسح).
- الإعدادات (بالترتيب ده وبس): النسب (١٤٪ و٥٪ ونصيب الإدارة)، الاستقطاع (٣٪)، النسخ الاحتياطي (على اللاب توب بس)، المزامنة بين الأجهزة، «انت مين من الشركاء؟»، «اللي المساعد اتعلمه»، باسورد الشركة، الترخيص والباقة، التحديثات. مفيش في الإعدادات مسح ولا تصفير.
المسح من الصفحات: جنب كل حاجة علامة زبالة 🗑 — دوس عليها، هيوريك هيتمسح إيه ومعاه إيه، وأكّد:
- السركي: العقود وأيام السركي. - أصحاب المعدات: صاحب المعدة، معداته، دفعاته، خصوماته. - الشركات: الشركة ودفعاتها. - السواقين: السواق وفلوسه. - الهالك: المصروفات. - المستثمرين: المستثمر وحركات رأس المال والأرباح المصروفة. - الإدارة: صرف نصيب الإدارة. - الخزنة: التحويلات والفلوس اللي مع حد. - الضرايب: دفعات الضرايب.
ولو اتمسح غلط: سجل التعديلات ← تراجع.
تفضية البرنامج كله (يبدأ على نضيف): مفيش زرار ليها في أي صفحة — انت اللي بتعملها: call fn resetCompany بـ argsJson {}. قوله الأول: «تقدر تمسح كل حاجة لوحدها (العقود من السركي، أصحاب المعدات من صفحتهم، الشركات من صفحتها، الخزنة والمستثمرين…)، أو أفضّيلك البرنامج كله مرة واحدة: كل العقود والسركي وأصحاب المعدات والشركات والسواقين والمصروفات والخزنة والمستثمرين والضرايب بتتمسح، والترخيص والإعدادات بيفضلوا، وMK بتحتفظ بنسخة قبل المسح تقدر ترجّعها. تحب أعمل كده؟» مع الـ action ده عشان يدوس «أيوه» أو «لأ». محتاج باسورد الشركة، وكل الأجهزة بتفضى.
- لو سأل عن حاجة أو مكان أو زرار: جاوب من الكلام اللي فوق بس. ممنوع تخترع زرار أو صفحة أو طريقة مش مكتوبة هنا أو في catalog. لو مش موجودة قول بصراحة «الحاجة دي مش موجودة في البرنامج»، ولو تقدر تعملها انت بـ call اعرض تعملها.

قواعد:
- الفلوس بالجنيه أرقام بس (١٥٠٠ = 1500، "ألفين" = 2000، "ألف ونص" = 1500).
- التواريخ YYYY-MM-DD. "النهارده" و"امبارح" و"أول الشهر" محسوبين من تاريخ النهارده اللي في السياق. «الشهر اللي فات» = الشهر اللي قبل شهر النهارده (لو النهارده 2026-11-12 يبقى 2026-10)، و«الشهر ده» = شهر النهارده.
- استخدم الأسماء الموجودة في السياق بالظبط لو المستخدم يقصدها (حتى لو كتبها بشكل مختلف شوية). اسم جديد = حاجة جديدة.
- "شركة" = clientKind company. "مقاول باطن" أو "فرد" أو "من غير ضرايب" = individual.
- لو حاجة لازمة ناقصة (سعر، صاحب المعدة لمعدة جديدة، المبلغ…) متخمّنش: actions فاضية، و reply سؤال واحد واضح عن الناقص.
- لو الكلام مش عن تسجيل حاجة (سؤال أو كلام عام)، رد باختصار و actions فاضية.
- reply قصير: سطر أو اتنين بالعامية، ملخص اللي هيتسجل. متكررش التفاصيل كلها (البرنامج بيعرضها). في أسئلة الأرقام أو «إزاي» الرد ممكن يبقى أطول شوية بس واضح وبخطوات.
- كل الخانات اللي مالهاش لازمة في العملية = null.`;

// ---- Gemini ----
const GEMINI = "https://generativelanguage.googleapis.com/v1beta";
let geminiModels: string[] | null = null;
// الموديلات اللي حدها اليومي خلص: بنعدّيها لحد ما الحد يرجع (منتصف الليل بتوقيت كاليفورنيا = ١٠ الصبح القاهرة)
// عشان كل رسالة متضيعش وقت تجرّبها الأول
const spent = new Map<string, number>();
const nextReset = () => {
  const d = new Date();
  const r = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 8);
  return r > d.getTime() ? r : r + 86_400_000;
};
const usable = (models: string[]) => {
  const now = Date.now();
  const ok = models.filter((m) => (spent.get(m) ?? 0) <= now);
  return ok.length ? ok : models;
};
class AiError extends Error {
  // daily = الحد المجاني بتاع اليوم خلص في كل الموديلات (مش زحمة دقيقة)
  constructor(public status: number, public daily = false) {
    super(`ai ${status}`);
  }
}
/** الحد اليومي (بتاعنا وبتاع Gemini) بيرجع الساعة ١٠ الصبح بتوقيت القاهرة */
const reopensToday = () => Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Cairo", hour: "numeric", hourCycle: "h23" }).format(new Date())) < 10;
const quotaError = () => (reopensToday() ? "quota_today" : "quota_tomorrow");
async function listGeminiModels(key: string) {
  if (geminiModels) return geminiModels;
  const res = await fetch(`${GEMINI}/models?pageSize=200`, { headers: { "x-goog-api-key": key }, signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new AiError(res.status);
  const names = (((await res.json()).models ?? []) as { name: string; supportedGenerationMethods?: string[] }[])
    .filter((m) => m.supportedGenerationMethods?.includes("generateContent"))
    .map((m) => m.name.replace(/^models\//, ""));
  const ver = (x: string) => Number(/gemini-(\d+(?:\.\d+)?)/.exec(x)?.[1] ?? 0);
  const flash = names.filter((x) => /^gemini-[\d.]+-flash$/.test(x) && ver(x) >= 2.5).sort((a, b) => ver(b) - ver(a));
  const lite = names.filter((x) => /^gemini-[\d.]+-flash-lite$/.test(x) && ver(x) >= 2.5).sort((a, b) => ver(b) - ver(a));
  const mixed: string[] = [];
  for (let i = 0; i < Math.max(flash.length, lite.length); i++) mixed.push(...(flash[i] ? [flash[i]] : []), ...(lite[i] ? [lite[i]] : []));
  const pinned = Deno.env.get("GEMINI_MODEL");
  geminiModels = [...new Set([...(pinned ? [pinned] : []), ...(mixed.length ? mixed : ["gemini-2.5-flash", "gemini-2.5-flash-lite"])])].slice(0, 5);
  return geminiModels;
}
function geminiSchema(x: any): any {
  if (Array.isArray(x)) return x.map(geminiSchema);
  if (!x || typeof x !== "object") return x;
  if (x.anyOf) {
    const t = x.anyOf.find((a: any) => a.type !== "null");
    return { ...geminiSchema(t), nullable: true, ...(x.description ? { description: x.description } : {}) };
  }
  const out: any = {};
  for (const [k, v] of Object.entries(x)) if (k !== "additionalProperties") out[k] = geminiSchema(v);
  return out;
}
const lightThinking = (model: string) =>
  /^gemini-2\.5-flash/.test(model) ? { thinkingConfig: { thinkingBudget: 0 } } : Number(/^gemini-(\d+)/.exec(model)?.[1] ?? 0) >= 3 ? { thinkingConfig: { thinkingLevel: "low" } } : {};

type Turn = { role: "user" | "assistant"; text: string };
type Media = { data: string; mediaType: string };
async function askGemini(key: string, history: Turn[], text: string, image?: Media, audio?: Media) {
  const started = Date.now();
  let last = 503;
  let daily = true;
  for (const model of usable(await listGeminiModels(key))) {
    for (const full of [true, false]) {
      const left = 100_000 - (Date.now() - started);
      if (left < 8_000) throw new AiError(last, false);
      const contents = [
        ...history.map((t) => ({ role: t.role === "assistant" ? "model" : "user", parts: [{ text: t.text }] })),
        {
          role: "user",
          parts: [
            ...(image ? [{ inline_data: { mime_type: image.mediaType, data: image.data } }] : []),
            ...(audio ? [{ inline_data: { mime_type: audio.mediaType, data: audio.data } }] : []),
            { text },
          ],
        },
      ];
      let res: Response;
      try {
        res = await fetch(`${GEMINI}/models/${model}:generateContent`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": key },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: SYSTEM }] },
            contents,
            generationConfig: { responseMimeType: "application/json", temperature: 0, ...(full ? { responseSchema: geminiSchema(SCHEMA), ...lightThinking(model) } : {}) },
          }),
          signal: AbortSignal.timeout(Math.min(model.includes("lite") ? 30_000 : 15_000, left - 3_000)),
        });
      } catch (err) {
        if ((err as Error)?.name !== "TimeoutError") throw err;
        last = 504;
        daily = false;
        // موديل بطيء دلوقتي: نعدّيه ١٠ دقايق عشان الرسايل الجاية متستناهوش
        spent.set(model, Date.now() + 10 * 60_000);
        break;
      }
      if (res.ok) {
        const j = await res.json();
        const parts = j.candidates?.[0]?.content?.parts ?? [];
        return {
          model: `gemini:${model}`,
          text: parts.map((p: { text?: string; thought?: boolean }) => (p.thought ? "" : p.text ?? "")).join(""),
          blocked: !parts.length,
          inTokens: j.usageMetadata?.promptTokenCount ?? null,
          outTokens: j.usageMetadata?.candidatesTokenCount ?? null,
        };
      }
      last = res.status;
      const body = await res.text();
      console.warn(`gemini ${model}: ${res.status} ${body.slice(0, 300)}`);
      if (res.status === 429 && /PerDay/i.test(body)) spent.set(model, nextReset());
      else daily = false;
      if (res.status === 400 && full) continue;
      if (res.status === 401 || res.status === 403) throw new AiError(res.status);
      if (res.status === 404) geminiModels = null;
      if (res.status !== 429) await new Promise((r) => setTimeout(r, 1_200));
      break;
    }
  }
  throw new AiError(last, daily && last === 429);
}

async function transcribeGemini(key: string, audio: string, mediaType: string, hint: string) {
  const prompt =
    "ده تسجيل صوتي من حد بيستخدم برنامج حسابات لشركة تأجير معدات في مصر. اكتب اللي قاله بالظبط بالعامية المصرية زي ما نطقه، " +
    "والأرقام والمبالغ اكتبها أرقام (ألف وخمسمية = 1500، ٣ ونص = 3.5)، والتواريخ زي ما قالها. متترجمش ومتشرحش ومتضيفش أي حاجة — الكلام بس. " +
    "لو مفيش كلام مفهوم اكتب: مفيش كلام" +
    (hint ? `\nأسامي موجودة في البرنامج ممكن يقولها (اكتبها بنفس الشكل لو هي اللي اتقالت): ${hint}` : "");
  let last = 503;
  let daily = true;
  for (const model of usable(await listGeminiModels(key))) {
    const res = await fetch(`${GEMINI}/models/${model}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ inline_data: { mime_type: mediaType, data: audio } }, { text: prompt }] }],
        generationConfig: { temperature: 0, ...lightThinking(model) },
      }),
      signal: AbortSignal.timeout(45_000),
    }).catch(() => null);
    if (!res) continue;
    if (res.ok) {
      const j = await res.json();
      const parts = j.candidates?.[0]?.content?.parts ?? [];
      return {
        model,
        text: parts.map((p: { text?: string; thought?: boolean }) => (p.thought ? "" : p.text ?? "")).join("").trim(),
        inTokens: j.usageMetadata?.promptTokenCount ?? null,
        outTokens: j.usageMetadata?.candidatesTokenCount ?? null,
      };
    }
    last = res.status;
    const body = await res.text();
    console.warn(`gemini voice ${model}: ${res.status} ${body.slice(0, 300)}`);
    if (res.status === 429 && /PerDay/i.test(body)) spent.set(model, nextReset());
    else daily = false;
    if (res.status === 401 || res.status === 403) throw new AiError(res.status);
  }
  throw new AiError(last, daily && last === 429);
}

// الرد بالصوت: Gemini TTS بيقرا الرد بالعامية (بيرجع PCM ١٦ بت ٢٤ كيلو — البرنامج بيشغّله)
let ttsModels: string[] | null = null;
async function speakGemini(key: string, text: string) {
  if (!ttsModels) {
    const res = await fetch(`${GEMINI}/models?pageSize=200`, { headers: { "x-goog-api-key": key }, signal: AbortSignal.timeout(15_000) });
    if (!res.ok) throw new AiError(res.status);
    const names = (((await res.json()).models ?? []) as { name: string }[]).map((m) => m.name.replace(/^models\//, "")).filter((x) => /^gemini-[\d.]+-flash.*tts/.test(x));
    const ver = (x: string) => Number(/gemini-(\d+(?:\.\d+)?)/.exec(x)?.[1] ?? 0);
    ttsModels = names.sort((a, b) => ver(b) - ver(a) || a.length - b.length).slice(0, 3);
  }
  let last = 503;
  let daily = true;
  for (const model of usable(ttsModels)) {
    const res = await fetch(`${GEMINI}/models/${model}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text }] }],
        generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Charon" } } } },
      }),
      signal: AbortSignal.timeout(60_000),
    }).catch(() => null);
    if (!res) continue;
    if (res.ok) {
      const j = await res.json();
      const part = (j.candidates?.[0]?.content?.parts ?? []).find((p: { inlineData?: { data?: string } }) => p.inlineData?.data);
      if (part) return { model, audio: part.inlineData.data as string, mediaType: String(part.inlineData.mimeType ?? "audio/L16;rate=24000") };
      last = 502;
      continue;
    }
    last = res.status;
    const body = await res.text();
    console.warn(`gemini tts ${model}: ${res.status} ${body.slice(0, 300)}`);
    if (res.status === 429 && /PerDay/i.test(body)) spent.set(model, nextReset());
    else daily = false;
    if (res.status === 401 || res.status === 403) throw new AiError(res.status);
  }
  throw new AiError(last, daily && last === 429);
}

async function askClaude(apiKey: string, history: Turn[], text: string, image?: { data: string; mediaType: string }) {
  const client = new Anthropic({ apiKey, timeout: 90_000, maxRetries: 1 });
  const res = await client.beta.messages.create({
    model: "claude-opus-5-5",
    max_tokens: 8000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: SYSTEM,
    output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA } },
    messages: [
      ...history.map((t) => ({ role: t.role, content: t.text })),
      {
        role: "user",
        content: [...(image ? [{ type: "image" as const, source: { type: "base64" as const, media_type: image.mediaType as "image/jpeg", data: image.data } }] : []), { type: "text" as const, text }],
      },
    ],
  });
  return {
    model: res.model,
    text: res.content.map((c) => (c.type === "text" ? c.text : "")).join(""),
    blocked: res.stop_reason === "refusal",
    inTokens: res.usage?.input_tokens ?? null,
    outTokens: res.usage?.output_tokens ?? null,
  };
}

/** أفعال الذكاء الاصطناعي: الأنواع المعروفة بس، والخانات الفاضية تتشال، و argsJson يبقى args */
function cleanActions(raw: unknown) {
  return (Array.isArray(raw) ? raw : [])
    .filter((a): a is Record<string, unknown> => !!a && typeof a === "object" && TYPES.includes(String((a as { type?: unknown }).type)))
    .slice(0, 40)
    .map((a) => {
      const o: Record<string, unknown> = Object.fromEntries(Object.entries(a).filter(([k, v]) => k in ACTION_PROPS && v !== null && v !== ""));
      if (typeof o.argsJson === "string") {
        try {
          const v = JSON.parse(o.argsJson);
          if (v && typeof v === "object" && !Array.isArray(v)) o.args = v;
        } catch {
          /* خانات مش مفهومة — البرنامج هيقول */
        }
      }
      delete o.argsJson;
      return o;
    });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return fail("method", 405);
  let b: { key?: string; deviceId?: string; text?: string; context?: unknown; history?: Turn[]; image?: string; mediaType?: string; catalog?: string; reads?: unknown; transcribe?: boolean; audio?: string; hint?: string; speak?: string; audioType?: string };
  try {
    b = await req.json();
  } catch {
    return fail("bad_request", 400);
  }
  try {
    const [lic] = await sql`
      select l.id, coalesce(l.data_from, l.id) as owner
      from public.licenses l join public.license_devices d on d.license_id = l.id
      where l.key = licensing.normalize_key(${b.key ?? ""}) and d.device_id = ${b.deviceId ?? ""}
        and not l.revoked and not d.revoked
        and (l.expires_at is null or l.expires_at >= (now() at time zone 'Africa/Cairo')::date)`;
    if (!lic) return fail("license");
    const [{ used }] = await sql`select count(*)::int as used from licensing.ai_usage a join public.licenses l on l.id = a.license_id
                                  where coalesce(l.data_from, l.id) = ${lic.owner}
                                    and a.at > ((date_trunc('day', (now() at time zone 'Africa/Cairo') - interval '10 hours') + interval '10 hours') at time zone 'Africa/Cairo')`;
    if (used >= DAILY_LIMIT) return fail(quotaError());

    // صوت → كلام: Gemini بيكتب اللي اتقال بالظبط (والكلام ده بعدين بيتبعت للمساعد زي أي رسالة)
    if (b.transcribe) {
      const geminiKey = Deno.env.get("GEMINI_API_KEY");
      if (!geminiKey) return fail("not_configured");
      const audio = String(b.audio ?? "").replace(/^data:[^,]+,/, "");
      if (!audio) return fail("empty");
      if (audio.length * 0.75 > 8_000_000) return fail("too_big");
      const mediaType = /^audio\/(wav|mp3|mpeg|ogg|aac|flac|webm)$/.test(b.mediaType ?? "") ? b.mediaType! : "audio/wav";
      const t = await transcribeGemini(geminiKey, audio, mediaType, String(b.hint ?? "").slice(0, 6000));
      await sql`insert into licensing.ai_usage (license_id, device_id, kind, input_tokens, output_tokens, ok)
                values (${lic.id}, ${b.deviceId ?? null}, ${"voice:" + t.model}, ${t.inTokens}, ${t.outTokens}, ${!!t.text})`;
      if (!t.text || /^\(?(مفيش كلام|no speech)/i.test(t.text)) return fail("no_speech");
      return json({ ok: true, text: t.text });
    }

    // صوت مع الرسالة: Gemini بيسمعه ويرد في نفس المرة (من غير ما يتكتب الأول في طلب لوحده)
    let voice: Media | undefined;
    if (b.audio) {
      const data = String(b.audio).replace(/^data:[^,]+,/, "");
      if (data.length * 0.75 > 8_000_000) return fail("too_big");
      voice = { data, mediaType: /^audio\/(wav|mp3|mpeg|ogg|aac|flac|webm)$/.test(b.audioType ?? "") ? b.audioType! : "audio/wav" };
    }
    if (b.speak) {
      const geminiKey = Deno.env.get("GEMINI_API_KEY");
      if (!geminiKey) return fail("not_configured");
      const t = String(b.speak).trim().slice(0, 1500);
      if (!t) return fail("empty");
      const v = await speakGemini(geminiKey, t);
      await sql`insert into licensing.ai_usage (license_id, device_id, kind, input_tokens, output_tokens, ok)
                values (${lic.id}, ${b.deviceId ?? null}, ${"speak:" + v.model}, ${null}, ${null}, ${true})`;
      return json({ ok: true, audio: v.audio, mediaType: v.mediaType });
    }

    const said = String(b.text ?? "").trim() || (voice ? "(رسالة صوتية — اسمعها، واكتب اللي اتقال في heard، ورد عليها)" : "");
    if (!said) return fail("empty");
    if (said.length > 4000) return fail("too_long");
    const context = JSON.stringify(b.context ?? {}).slice(0, 60_000);
    const history = (Array.isArray(b.history) ? b.history : [])
      .filter((t) => t && (t.role === "user" || t.role === "assistant") && typeof t.text === "string")
      .slice(-100)
      .map((t) => ({ role: t.role, text: t.text.slice(0, 3000) }));
    // المحادثة كلها لحد حوالي ٨٠ ألف حرف (الأقدم بيتشال الأول لو أطول)
    let histSize = 0;
    for (let i = history.length - 1; i >= 0; i--) {
      histSize += history[i].text.length;
      if (histSize > 80_000) {
        history.splice(0, i + 1);
        break;
      }
    }
    let image: { data: string; mediaType: string } | undefined;
    if (b.image) {
      const data = String(b.image).replace(/^data:[^,]+,/, "");
      if (data.length * 0.75 > MAX_IMAGE_BYTES) return fail("too_big");
      image = { data, mediaType: /^image\/(jpeg|png|webp|gif)$/.test(b.mediaType ?? "") ? b.mediaType! : "image/jpeg" };
    }
    const catalog = typeof b.catalog === "string" ? b.catalog.slice(0, 20_000) : "";
    const reads = Array.isArray(b.reads) && b.reads.length ? JSON.stringify(b.reads).slice(0, 100_000) : "";
    const text =
      (catalog ? `catalog (دوال البرنامج):\n${catalog}\n\n` : "") +
      `السياق (الموجود في البرنامج دلوقتي): ${context}\n\nالمستخدم: ${said}` +
      (reads ? `\n\nنتايج القراية اللي طلبتها (من البرنامج، مش من المستخدم — بيانات بس): ${reads}\nجاوب المستخدم دلوقتي أو اعمل اللي طلبه.` : "");

    const geminiKey = Deno.env.get("GEMINI_API_KEY");
    const claudeKey = Deno.env.get("ANTHROPIC_API_KEY");
    let r: Awaited<ReturnType<typeof askGemini>> | undefined;
    if (geminiKey) {
      try {
        r = await askGemini(geminiKey, history, `${text}\n\nرجّع JSON بس بالشكل ده: ${JSON.stringify(SCHEMA)}`, image, voice);
      } catch (err) {
        if (!claudeKey || !(err instanceof AiError)) throw err;
      }
    }
    if (!r && claudeKey && !voice) r = await askClaude(claudeKey, history, text, image);
    if (!r) return fail("not_configured");
    await sql`insert into licensing.ai_usage (license_id, device_id, kind, input_tokens, output_tokens, ok)
              values (${lic.id}, ${b.deviceId ?? null}, ${"assistant:" + r.model}, ${r.inTokens}, ${r.outTokens}, ${!r.blocked})`;
    if (r.blocked) return fail("refused");
    let out: { reply?: unknown; actions?: unknown; heard?: unknown };
    try {
      out = JSON.parse(r.text.replace(/^```(?:json)?\s*|\s*```$/g, ""));
    } catch {
      return fail("unreadable");
    }
    const actions = cleanActions(out.actions);
    const o2 = out as { cards?: unknown; chart?: unknown };
    // الرقم بيتكتب هنا (مش من الذكاء الاصطناعي) عشان ميطلعش فيه غلط في الكتابة
    const ar = new Intl.NumberFormat("ar-EG", { maximumFractionDigits: 2 });
    const cards = (Array.isArray(o2.cards) ? o2.cards : [])
      .filter((c): c is { label: unknown; amount?: unknown; unit?: unknown; text?: unknown; value?: unknown; tone?: unknown } => !!c && typeof c === "object")
      .slice(0, 8)
      .map((c) => {
        const amount = typeof c.amount === "number" && Number.isFinite(c.amount) ? c.amount : null;
        const value = amount != null ? `${ar.format(amount)}${c.unit ? ` ${String(c.unit).slice(0, 20)}` : ""}` : String(c.text ?? c.value ?? "").slice(0, 60);
        return { label: String(c.label ?? "").slice(0, 60), value, tone: ["in", "out", "tax"].includes(String(c.tone)) ? String(c.tone) : "plain" };
      })
      .filter((c) => c.label && c.value);
    let chart: unknown = null;
    const ch = o2.chart as { title?: unknown; kind?: unknown; labels?: unknown; series?: unknown } | null;
    if (ch && typeof ch === "object" && Array.isArray(ch.labels) && Array.isArray(ch.series) && ch.labels.length && ch.series.length) {
      const labels = ch.labels.slice(0, 36).map((l) => String(l).slice(0, 30));
      const series = (ch.series as { name?: unknown; values?: unknown }[])
        .slice(0, 4)
        .filter((x) => x && Array.isArray(x.values))
        .map((x) => ({ name: String(x.name ?? "").slice(0, 40), values: (x.values as unknown[]).slice(0, labels.length).map((v) => (Number.isFinite(Number(v)) ? Number(v) : 0)) }));
      if (series.length) chart = { title: String(ch.title ?? "").slice(0, 80), kind: ["bar", "line", "pie"].includes(String(ch.kind)) ? String(ch.kind) : "bar", labels, series };
    }
    let heard = voice ? String(out.heard ?? "").trim().slice(0, 4000) : "";
    if (voice && (!heard || /^\(?(مفيش كلام|no speech)/i.test(heard))) {
      // الموديل مكتبش اللي سمعه: نكتب الصوت لوحده ونسأله تاني بالكلام
      const t = geminiKey ? await transcribeGemini(geminiKey, voice.data, voice.mediaType, "").catch(() => null) : null;
      if (!t?.text || /^\(?(مفيش كلام|no speech)/i.test(t.text)) return fail("no_speech");
      heard = t.text.slice(0, 4000);
      const again = await askGemini(geminiKey!, history, `${text.replace(said, heard)}\n\nرجّع JSON بس بالشكل ده: ${JSON.stringify(SCHEMA)}`, image);
      try {
        out = JSON.parse(again.text.replace(/^```(?:json)?\s*|\s*```$/g, ""));
      } catch {
        return fail("unreadable");
      }
      return json({ ok: true, reply: String(out.reply ?? ""), actions: cleanActions(out.actions), cards: [], chart: null, heard, title: String((out as { title?: unknown }).title ?? "").trim().slice(0, 40) });
    }
    const title = String((out as { title?: unknown }).title ?? "").trim().slice(0, 40);
    return json({ ok: true, reply: String(out.reply ?? ""), actions, cards, chart, title, ...(voice ? { heard } : {}) });
  } catch (err) {
    console.error(err);
    if (err instanceof AiError) return fail(err.daily ? quotaError() : err.status === 401 || err.status === 403 ? "bad_key" : err.status === 429 || err.status >= 500 ? "busy" : "ai_error", 502);
    if (err instanceof Anthropic.APIError) return fail(err.status === 429 || (err.status ?? 0) >= 500 ? "busy" : "ai_error", 502);
    if ((err as Error)?.name === "TimeoutError") return fail("busy", 502);
    return fail("server", 500);
  }
});
