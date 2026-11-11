import { Db } from "../db";

// الشركاء في الإدارة: كل جهاز عليه اسم الشريك اللي بيستخدمه (app_settings — على
// الجهاز ده بس). وجدولين بيتزامنوا لكل الأجهزة:
//  - team_log:  مين عمل إيه وامتى (كل تعديل بيتسجل هنا باسم الشريك).
//  - team_chat: محادثة المساعد — واحدة للكل، وكل رسالة عليها اسم اللي كتبها.
// الجدولين برا الحمايات وسجل التعديلات (مش بيانات شغل) — schema.ts.

export function ensureTeamTables(db: Db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS team_log (
      id INTEGER PRIMARY KEY,
      at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      who TEXT,
      label TEXT NOT NULL,
      action_id TEXT
    );
    CREATE TABLE IF NOT EXISTS team_chat (
      id INTEGER PRIMARY KEY,
      at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      who TEXT,
      role TEXT NOT NULL,
      text TEXT NOT NULL,
      extra TEXT
    );
  `);
  // كل محادثة ليها رقم (زي أي شات AI): «محادثة جديدة» بتبدأ واحدة، والقديمة بتفضل في القايمة
  const cols = (db.prepare("PRAGMA table_info(team_chat)").all() as { name: string }[]).map((c) => c.name);
  if (!cols.includes("conv")) db.exec("ALTER TABLE team_chat ADD COLUMN conv TEXT");
  // اللي المساعد اتعلمه من تصحيح الشركاء («لا أنا قصدي كذا») — بيتبعت معاه في كل سؤال
  db.exec(`CREATE TABLE IF NOT EXISTS team_lessons (
    id INTEGER PRIMARY KEY,
    at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    who TEXT,
    text TEXT NOT NULL
  )`);
}

/** المحادثات القديمة (من قبل ما يبقى فيه أكتر من محادثة) ليها الرقم ده */
export const OLD_CONV = "old";

export const TEAM_TABLES = ["team_log", "team_chat", "team_lessons"];

export function myName(db: Db): string | null {
  const r = db.prepare("SELECT value FROM app_settings WHERE key = 'partner_name'").get() as { value: string } | undefined;
  return r?.value?.trim() || null;
}

export function setMyName(db: Db, name: string) {
  const n = name.trim().replace(/\s+/g, " ").slice(0, 60);
  if (!n) db.prepare("DELETE FROM app_settings WHERE key = 'partner_name'").run();
  else db.prepare("INSERT INTO app_settings (key, value) VALUES ('partner_name', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(n);
  return n || null;
}

/** الأسامي اللي ممكن تختار منها: شركاء الإدارة في العقود + اللي سجلوا قبل كده */
export function teamNames(db: Db): string[] {
  const has = (t: string) => !!db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(t);
  const names = new Set<string>();
  if (has("contract_managers")) for (const r of db.prepare("SELECT DISTINCT name FROM contract_managers WHERE deleted_at IS NULL").all() as { name: string }[]) names.add(r.name);
  for (const r of db.prepare("SELECT DISTINCT who FROM team_log WHERE who IS NOT NULL UNION SELECT DISTINCT who FROM team_chat WHERE who IS NOT NULL").all() as { who: string }[]) names.add(r.who);
  return [...names].filter(Boolean).sort();
}

export function logTeam(db: Db, actionId: string, label: string) {
  db.prepare("INSERT INTO team_log (who, label, action_id) VALUES (?, ?, ?)").run(myName(db), label, actionId);
}

export function teamLogView(db: Db, f: { from?: string; to?: string; limit?: number } = {}) {
  const where: string[] = [];
  const p: unknown[] = [];
  if (f.from) {
    where.push("at >= ?");
    p.push(f.from);
  }
  if (f.to) {
    where.push("at < ?");
    p.push(`${f.to}T99`);
  }
  return db
    .prepare(`SELECT id, at, who, label, action_id AS actionId FROM team_log ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY at DESC, id DESC LIMIT ?`)
    .all(...p, f.limit ?? 300) as { id: number; at: string; who: string | null; label: string; actionId: string | null }[];
}

export interface ChatRow {
  id: number;
  at: string;
  who: string | null;
  role: "user" | "assistant";
  text: string;
  extra: unknown;
}

export function chatList(db: Db, conv: string = OLD_CONV, limit = 120): ChatRow[] {
  const rows = db
    .prepare("SELECT id, at, who, role, text, extra FROM team_chat WHERE COALESCE(conv, 'old') = ? ORDER BY at DESC, id DESC LIMIT ?")
    .all(conv, limit) as (Omit<ChatRow, "extra"> & { extra: string | null })[];
  return rows.reverse().map((r) => {
    let extra: unknown = null;
    try {
      extra = r.extra ? JSON.parse(r.extra) : null;
    } catch {
      /* رسالة قديمة */
    }
    return { ...r, extra };
  });
}

export function chatAdd(db: Db, m: { role: "user" | "assistant"; text: string; extra?: unknown; conv?: string }) {
  const role = m.role === "assistant" ? "assistant" : "user";
  const conv = m.conv && m.conv !== OLD_CONV ? String(m.conv).slice(0, 64) : null;
  const r = db
    .prepare("INSERT INTO team_chat (who, role, text, extra, conv) VALUES (?, ?, ?, ?, ?)")
    .run(myName(db), role, String(m.text ?? "").slice(0, 8000), m.extra == null ? null : JSON.stringify(m.extra).slice(0, 200_000), conv);
  return Number(r.lastInsertRowid);
}

export function chatUpdate(db: Db, id: number, extra: unknown) {
  db.prepare("UPDATE team_chat SET extra = ? WHERE id = ?").run(extra == null ? null : JSON.stringify(extra).slice(0, 200_000), id);
}

/** قايمة المحادثات: العنوان = أول رسالة فيها، والأحدث فوق */
export function chatConversations(db: Db, limit = 60) {
  return db
    .prepare(
      `SELECT COALESCE(conv, 'old') AS conv, MIN(at) AS started, MAX(at) AS last, COUNT(*) AS count,
         (SELECT t.text FROM team_chat t WHERE COALESCE(t.conv, 'old') = COALESCE(c.conv, 'old') AND t.role = 'user' ORDER BY t.at, t.id LIMIT 1) AS title,
         (SELECT t.who FROM team_chat t WHERE COALESCE(t.conv, 'old') = COALESCE(c.conv, 'old') AND t.role = 'user' ORDER BY t.at, t.id LIMIT 1) AS who
       FROM team_chat c GROUP BY COALESCE(conv, 'old') ORDER BY last DESC LIMIT ?`,
    )
    .all(limit) as { conv: string; started: string; last: string; count: number; title: string | null; who: string | null }[];
}

/** الدروس: قواعد الشركة اللي المساعد بيمشي عليها (الأحدث الأول) */
export function lessonsList(db: Db) {
  return db.prepare("SELECT id, at, who, text FROM team_lessons ORDER BY at DESC, id DESC LIMIT 200").all() as { id: number; at: string; who: string | null; text: string }[];
}
export function lessonAdd(db: Db, text: string) {
  const t = String(text ?? "").trim().replace(/\s+/g, " ").slice(0, 400);
  if (!t) return null;
  const dup = db.prepare("SELECT id FROM team_lessons WHERE text = ?").get(t) as { id: number } | undefined;
  if (dup) return dup.id;
  return Number(db.prepare("INSERT INTO team_lessons (who, text) VALUES (?, ?)").run(myName(db), t).lastInsertRowid);
}
export function lessonDelete(db: Db, id: number) {
  db.prepare("DELETE FROM team_lessons WHERE id = ?").run(id);
}
