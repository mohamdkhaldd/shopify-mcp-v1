// كل اللي المساعد يقدر يعمله في البرنامج — بيتبعت للذكاء الاصطناعي مع كل رسالة.
// كل سطر = دالة من دوال البرنامج (electron/ipc.ts) بنفس اسمها ونفس خاناتها.
// الوحدات بالشكل اللي الناس بتتكلم بيه، والبرنامج بيحوّل:
//   خانة آخرها Pt = جنيه، آخرها Bp = نسبة في المية، آخرها Milli = ساعات.
// (نفس الشكل في نتايج القراءة: كل Pt بالجنيه، كل Bp بالمية، كل Milli بالساعات.)

/** دوال بتعدّل (بتتعمل بعد ما المستخدم يوافق، وبتترجع من سجل التعديلات). */
export const WRITE_CATALOG: Record<string, string> = {
  // السركي والعقود
  newContract:
    'عقد جديد: {client:{id}|{kind:"company"|"individual",name}, equipment:{id}|{name, siteName?, supplier:{id}|{name,phone?}}, unit:"day"|"month", clientRatePt, supplierRatePt, startDate, endDate?, siteName?, name?} — الأحسن تستخدم type contract بالأسماء',
  upsertDay:
    'يوم واحد في السركي: {contractId, date, side:"client"|"supplier", patch:{isDayOff?, siteName?, actualHoursMilli?, baseHoursMilli?, dayRatePt?, overtimeRatePt?, note?}} (actualHoursMilli = ساعات الشغل الفعلية، اللي فوق baseHoursMilli أوفر)',
  fillRange: "ملء أيام شغل: {contractId, from, to, dayRatePt?, siteName?, baseHoursMilli?}",
  clearRange: "أيام مشتغلش (بتتشال من السركي): {contractId, from, to, reason}",
  applyOvertime: 'أوفر لأيام: {contractId, month:"YYYY-MM", days:"1,2,5-9", hoursMilli, ratePt?}',
  setSupplierRate: "سعر صاحب المعدة من يوم لـ يوم: {contractId, from, to, dayRatePt?, overtimeRatePt?}",
  updateContract:
    'تعديل عقد موجود (مش عقد جديد!): {id: contractId, startDate?, endDate? (null = مفتوح), siteName?, unit? "day"|"month", clientRatePt?, supplierRatePt?} — ابعت بس الخانات اللي اتغيرت، والباقي بيفضل زي ما هو',
  endContract: "العقد خلص: {id: contractId, endDate}",
  reopenContract: "رجّع العقد شغال: {id: contractId}",
  renameContract: "اسم للعقد: {id: contractId, name}",
  setContractManagers: "شركاء الإدارة في العقد ونسبهم: {contractId, managers:[{name, shareBp}]} (مجموع النسب ١٠٠)",
  adjustment: 'تسوية لشهر مقفول: {targetMonth:"YYYY-MM", contractId, kind:"client_base"|"supplier_cost", amountPt (بالسالب لو تقليل), reason}',
  // أصحاب المعدات والمعدات
  createSupplier: "صاحب معدة جديد: {name, phone?}",
  updateSupplier: "تعديل صاحب معدة: {id, name, phone?}",
  createEquipment: "معدة جديدة: {name, supplierId, siteName?, supplierRatePt?}",
  updateEquipment: "تعديل معدة: {id, name, siteName?, supplierRatePt?}",
  supplierPayment: "فلوس اديناها لصاحب معدة: {supplierId, contractId?, date, amountPt, note?, forMonth?, account?}",
  supplierDeduction: "حاجة دفعناها عن صاحب المعدة وتتخصم منه: {supplierId, contractId?, date, amountPt, note, account?}",
  // السواقين
  createDriver: 'سواق جديد: {name, phone?, supplierId, equipmentId?, payKind:"month"|"day", ratePt, overtimeRatePt?, startDate?}',
  updateDriver: "تعديل سواق: {id, name, phone?, supplierId, equipmentId?, payKind, ratePt, overtimeRatePt?, startDate?}",
  driverPayment: "فلوس لسواق (بتتخصم من صاحب المعدة): {driverId, date, amountPt, note?, account?}",
  // الشركات
  createClient: 'شركة / مقاول باطن جديد: {kind:"company"|"individual", name, phone?, taxId?}',
  updateClient: "تعديل شركة: {id, kind, name, phone?, taxId?}",
  setClientTaxes: "ضرايب الشركة: {id, vatApplies (١٤٪), tax5Applies (٥٪)}",
  clientPayment: "فلوس جت من شركة: {clientId, contractId?, date, amountPt, note?, forMonth?, account?}",
  // الهالك والإدارة
  createExpenseCategory: "بند مصروف جديد: {name}",
  expense: 'مصروف (هالك): {kind:"contract"|"general", contractId? (لو contract), categoryId?, date, amountPt, note?, paidBy? (شريك دفع من جيبه), account?}',
  managementPayout: "صرف من نصيب الإدارة: {date, amountPt, note?, managerName?, account?}",
  closeMonth: 'قفل الشهر (مبيترجعش): {month:"YYYY-MM"}',
  // المستثمرين
  createInvestor: "مستثمر جديد: {name, phone?} — ولو قال إنه حط فلوس: ابعت بعدها في نفس الرد capital {investorId, kind:\"deposit\", date, amountPt}",
  updateInvestor: "تعديل مستثمر: {id, name, phone?}",
  capital: 'رأس مال: {investorId, kind:"deposit"|"withdrawal", date, amountPt, note?, account?}',
  investorPayout: "صرف أرباح لمستثمر: {investorId, date, amountPt, note?, account?}",
  reinvest: "أرباح المستثمر تتحط في رأس المال: {investorId, date, amountPt}",
  // الخزنة
  transfer: "تحويل بين حسابات الخزنة: {date, from (مفتاح الحساب), to, amountPt, note?, transferFee?}",
  hold: "فلوس من الخزنة مع حد: {date, account?, amountPt, heldBy, note?}",
  returnHold: "الفلوس اللي مع حد رجعت: {id (من قراءة treasury), date}",
  markDelivered: "فلوس وصلت الخزنة (كانت مع حد): {id, date}",
  saveAccount: "حساب خزنة جديد أو تعديله: {key? (للتعديل), name, feeBp, feeMinPt, feeMaxPt}",
  // الضرايب
  taxPayment: 'دفع ضرايب: {tax:"vat"|"tax5", periodMonth?, date, amountPt, receiptNo?, note?, account?}',
  // الإعدادات
  setRates: "النسب من تاريخ (مبيترجعش): {effectiveFrom, vat (بالمية، ١٤), tax5 (بالمية، ٥), management (نصيب الإدارة بالمية)}",
  setWithholding: "الاستقطاع من تاريخ (مبيترجعش): {effectiveFrom, bp (بالمية)}",
  // التراجع والتصفير والنسخة الاحتياطية
  undo: "رجّع حاجة اتعملت (زي زرار تراجع في سجل التعديلات): {actionId} — الـ id من قراية activity (اللي canUndo بس)",
  resetCompany: "فضّي البرنامج كله ويبدأ على نضيف (كل العقود والسركي وأصحاب المعدات والشركات والسواقين والمصروفات والخزنة والمستثمرين والضرايب). الترخيص والإعدادات بيفضلوا، وMK بتحتفظ بنسخة قبل المسح: {}",
  backupNow: "نسخة احتياطية دلوقتي في ملف (اللاب توب بس): {}",
  // التذكيرات
  reminderAdd: "فكّرني يوم كذا بحاجة (فلوس عليا لحد، ميعاد دفع، تجديد عقد…): {date: YYYY-MM-DD, text} — text = الحاجة كاملة بالأسماء والمبالغ",
  reminderDone: "التذكير خلص (اتعمل): {id} — الـ id من reminders في السياق",
  // التعلّم
  lessonAdd: "احفظ درس/قاعدة للشركة عشان تمشي عليها كل مرة بعد كده (بيتحفظ لوحده من غير ما المستخدم يوافق أو يشوفه): {text} — جملة واضحة (مثلاً «لما حد يقول (الكبير) يقصد لودر 950 بتاع محمد علي»)",
  // المسح
  delete:
    "مسح أي حاجة بالـ id: {entity, id} — entity واحدة من: client_payments, supplier_payments, supplier_deductions, expenses, capital_movements, profit_payouts, tax_payments, work_logs, contracts, equipment, clients, suppliers, investors, expense_categories, drivers, treasury_transfers, treasury_holds",
};

/** دوال بتقرا بس (من غير تعديل) — المساعد بيطلبها، والبرنامج بيبعتله النتيجة على طول. */
export const READ_CATALOG: Record<string, string> = {
  dashboard: '{month?:"YYYY-MM"} ملخص الشهر',
  sarki: "{contractId?, month?} السركي بتاع عقد في شهر (الأيام والساعات والأسعار)",
  contractOptions: "{} كل العقود (id والكود والمعدة والشركة)",
  suppliers: "{supplierId?} أصحاب المعدات — مع supplierId: التصفية والدفعات والخصومات (بالـ id بتاعها) ومعداته",
  partySheet: '{contractId, month, side:"client"|"supplier"} شيت حساب عقد في شهر',
  clients: "{clientId?} الشركات — مع clientId: المستخلص والدفعات (بالـ id) والفواتير",
  drivers: "{month?, driverId?} السواقين وحساباتهم",
  management: "{month?} الإدارة: الدخل والهالك (بالـ id) والربح ونصيب الإدارة",
  investors: "{month?} المستثمرين ورأس المال والأرباح (الحركات بالـ id)",
  treasury: "{from?, to?, type?, party?, account?} الخزنة: الحركات (بالـ id) والأرصدة والفلوس اللي مع حد",
  accounts: "{} حسابات الخزنة",
  tax: "{} الضرايب: المستحق والمدفوع والإقرارات",
  activity: "{from?, to?} سجل التعديلات على الجهاز ده",
  teamLog: "{from?, to?} مين من الشركاء عمل إيه وامتى (من كل الأجهزة)",
  settings: "{} الإعدادات والنسب",
  deletePreview: "{entity, id} لو مسحت دي هيتمسح معاها إيه",
};

/** الحاجات دي محتاجة باسورد الشركة (مسح، أو حاجة مبترجعش). */
export const PASSWORD_CALLS = new Set(["delete", "closeMonth", "setRates", "setWithholding", "adjustment", "resetCompany"]);
/** ومبتترجعش من سجل التعديلات */
export const NOT_UNDOABLE_CALLS = new Set(["closeMonth", "adjustment", "setRates", "setWithholding", "resetCompany"]);
/** دول البرنامج نفسه بيعملهم (مش دوال البيانات): التصفير والنسخة الاحتياطية — كل واحدة لوحدها */
export const SHELL_CALLS = new Set(["resetCompany", "backupNow"]);

/** الصفحات اللي المساعد يقدر يفتحها (ويطلع منها PDF). */
export const PAGES = ["home", "sarki", "suppliers", "drivers", "clients", "management", "expenses", "investors", "treasury", "tax", "activity", "settings"] as const;
export type PageId = (typeof PAGES)[number];

export function catalogText() {
  const w = Object.entries(WRITE_CATALOG)
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");
  const r = Object.entries(READ_CATALOG)
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");
  return `دوال التعديل (type "call" و fn = الاسم و args):\n${w}\n(حاجة جديدة بتعملها في نفس الرد — مستثمر/صاحب معدة/شركة/معدة/سواق — وبعدها عملية عليها: حط أي رقم في الـ id بتاعها والبرنامج بيربطه بالجديدة. واعمل كل اللي قاله، ومتقولش في reply حاجة مش في actions.)\n\nدوال القراءة (type "read" و fn = الاسم و args):\n${r}\n\nالصفحات (type "open" و page): ${PAGES.join(", ")} — suppliers مع id و tab "full" = الملف الكامل لصاحب المعدة (التصفية + الدفعات + الخصومات + السركي) ولو pdf = true يطلع PDF`;
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

/** من كلام الناس لوحدات البرنامج: جنيه → قروش، نسبة → bp، ساعات → milli. */
export function toInternal(v: unknown, fn?: string): unknown {
  if (Array.isArray(v)) return v.map((x) => toInternal(x));
  if (!isObj(v)) return v;
  const out: Record<string, unknown> = {};
  for (const [k, x] of Object.entries(v)) {
    if (typeof x === "number" && (/Pt$/.test(k) || (fn === "setRates" && ["vat", "tax5", "management"].includes(k)))) out[k] = Math.round(x * 100);
    else if (typeof x === "number" && (/Bp$/.test(k) || (fn === "setWithholding" && k === "bp"))) out[k] = Math.round(x * 100);
    else if (typeof x === "number" && /Milli$/.test(k)) out[k] = Math.round(x * 1000);
    else out[k] = toInternal(x);
  }
  return out;
}

/** العكس للقراءة: قروش → جنيه، bp → نسبة، milli → ساعات. */
export function toHuman(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(toHuman);
  if (!isObj(v)) return v;
  const out: Record<string, unknown> = {};
  for (const [k, x] of Object.entries(v)) {
    if (typeof x === "number" && /(Pt|Bp|_pt|_bp)$/.test(k)) out[k] = x / 100;
    else if (typeof x === "number" && /(Milli|_milli)$/.test(k)) out[k] = x / 1000;
    else out[k] = toHuman(x);
  }
  return out;
}
