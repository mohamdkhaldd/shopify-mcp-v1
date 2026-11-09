import { Db, UserError } from "../db";

// باقات اشتراك التأجير بعدد المعدات. الباقة بتيجي مع كود التفعيل (موقّعة من
// السيرفر)، والجهاز بيحفظ الحد في app_settings (plan_max_equipment) — فاضي =
// من غير حد (العميل ملوش باقة، أو على أعلى باقة).

export const PLANS = [
  { key: "p5", label: "باقة ١–٥ معدات", max: 5, pricePerMonth: 500 },
  { key: "p10", label: "باقة ٦–١٠ معدات", max: 10, pricePerMonth: 1000 },
  { key: "p15", label: "باقة ١١–١٥ معدة", max: 15, pricePerMonth: 1500 },
  { key: "p20", label: "باقة ١٦–٢٠ معدة", max: 20, pricePerMonth: 2000 },
  { key: "p20plus", label: "باقة أكتر من ٢٠ معدة", max: null, pricePerMonth: 3000 },
] as const;

export const planOf = (key?: string | null) => PLANS.find((p) => p.key === key) ?? null;

const setting = (db: Db, k: string) => (db.prepare("SELECT value FROM app_settings WHERE key = ?").get(k) as { value: string | null } | undefined)?.value ?? null;

export function equipmentLimit(db: Db): number | null {
  const v = setting(db, "plan_max_equipment");
  return v ? Number(v) : null;
}

export const equipmentCount = (db: Db) => (db.prepare("SELECT COUNT(*) AS n FROM equipment WHERE deleted_at IS NULL").get() as { n: number }).n;

/** الباقة والاستخدام — لصفحة الإعدادات. */
export function planUsage(db: Db) {
  const plan = planOf(setting(db, "plan_key"));
  return { plan, limit: equipmentLimit(db), used: equipmentCount(db) };
}

/** قبل إضافة معدة: لو الباقة خلصت، رسالة فيها الباقة اللي بعدها والأسعار. */
export function assertCanAddEquipment(db: Db) {
  const limit = equipmentLimit(db);
  if (limit == null) return;
  const used = equipmentCount(db);
  if (used < limit) return;
  const next = PLANS.find((p) => p.max == null || p.max > limit);
  const prices = PLANS.map((p) => `${p.label}: ${p.pricePerMonth.toLocaleString("en-US")} ج في الشهر`).join(" — ");
  throw new UserError(
    `الباقة بتاعتك خلصت: عندك ${used} معدات من ${limit}. عشان تضيف معدة جديدة رقّي ل${next ? next.label : "باقة أكبر"} — كلّم MK-Tech.\nالأسعار: ${prices}`,
    "plan_limit",
  );
}
