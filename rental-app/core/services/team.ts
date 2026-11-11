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
}

export const TEAM_TABLES = ["team_log", "team_chat"];

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

export function chatList(db: Db, limit = 80): ChatRow[] {
  const rows = db.prepare("SELECT id, at, who, role, text, extra FROM team_chat ORDER BY at DESC, id DESC LIMIT ?").all(limit) as (Omit<ChatRow, "extra"> & { extra: string | null })[];
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

export function chatAdd(db: Db, m: { role: "user" | "assistant"; text: string; extra?: unknown }) {
  const role = m.role === "assistant" ? "assistant" : "user";
  const r = db.prepare("INSERT INTO team_chat (who, role, text, extra) VALUES (?, ?, ?, ?)").run(myName(db), role, String(m.text ?? "").slice(0, 8000), m.extra == null ? null : JSON.stringify(m.extra).slice(0, 200_000));
  return Number(r.lastInsertRowid);
}

export function chatUpdate(db: Db, id: number, extra: unknown) {
  db.prepare("UPDATE team_chat SET extra = ? WHERE id = ?").run(extra == null ? null : JSON.stringify(extra).slice(0, 200_000), id);
}
