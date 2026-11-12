import { Db, today } from "../db";
import { computeBooks } from "../services/books";

// التذكيرات اللي المساعد بيقولها لوحده أول ما الصفحة تفتح (من غير ذكاء اصطناعي — من الأرقام بس):
// سركي مش متسجل، شهر فات ومتقفلش، شركة متأخرة في الدفع، الخزنة بالسالب.
// كل تذكير معاه «ask» = الكلام اللي بيتبعت للمساعد لو دوست عليه.

export interface Reminder {
  text: string;
  ask: string;
}

const AR_MONTHS = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
const monthName = (m: string) => `${AR_MONTHS[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`;
const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);
const dm = (d: string) => `${Number(d.slice(8, 10))}/${Number(d.slice(5, 7))}`;

export function assistantReminders(db: Db, now = today()): Reminder[] {
  const out: Reminder[] = [];
  // ١) عقد شغال وآخر يوم في السركي من أكتر من ٣ أيام
  const stale = db
    .prepare(
      `SELECT c.id, e.name AS equipment, cl.name AS client, c.start_date AS start,
              (SELECT MAX(w.date) FROM work_logs w WHERE w.contract_id = c.id AND w.deleted_at IS NULL AND w.side = 'client') AS last
       FROM contracts c JOIN equipment e ON e.id = c.equipment_id JOIN clients cl ON cl.id = c.client_id
       WHERE c.deleted_at IS NULL AND c.status = 'active' AND c.unit = 'day' AND c.start_date <= ? AND (c.end_date IS NULL OR c.end_date >= ?)`,
    )
    .all(now, now) as { id: number; equipment: string; client: string; start: string; last: string | null }[];
  for (const c of stale) {
    const from = c.last ?? c.start;
    const gap = daysBetween(from, now);
    if (gap < 3) continue;
    out.push({
      text: c.last ? `سركي ${c.equipment} عند ${c.client} آخر يوم متسجل فيه ${dm(c.last)} (من ${gap} يوم)` : `سركي ${c.equipment} عند ${c.client} لسه مفيهوش ولا يوم من ${dm(c.start)}`,
      ask: `سركي ${c.equipment} عند ${c.client} — سجّل الأيام اللي فاتت (اسألني اشتغلت من امتى لامتى)`,
    });
  }
  // ٢) الشهر اللي فات لسه مفتوح (بعد يوم ٥)
  const prev = (() => {
    const y = Number(now.slice(0, 4));
    const m = Number(now.slice(5, 7));
    return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
  })();
  const hadWork = db.prepare("SELECT 1 FROM work_logs WHERE deleted_at IS NULL AND substr(date, 1, 7) = ? LIMIT 1").get(prev);
  const closed = db.prepare("SELECT 1 FROM month_closes WHERE month = ?").get(prev);
  if (hadWork && !closed && Number(now.slice(8, 10)) >= 5)
    out.push({ text: `شهر ${monthName(prev)} لسه متقفلش`, ask: `راجع معايا حسابات ${monthName(prev)} (مين ليه ومين عليه) وقولّي لو كله تمام نقفله` });
  // ٣) الخزنة بالسالب
  if (computeBooks(db, now).treasury.balancePt < 0) out.push({ text: "الخزنة بالسالب — فيه فلوس طلعت أكتر من اللي دخل", ask: "الخزنة بالسالب ليه؟ وريني آخر الحركات" });
  return out.slice(0, 6);
}
