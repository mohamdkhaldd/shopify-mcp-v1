import { Db } from "../db";

// تصفير البرنامج على الجهاز ده: كل بيانات الشغل وسجل التعديلات وحالة المزامنة
// بتتمسح، والترخيص والإعدادات (app_settings) بيفضلوا — فالبرنامج يفتح على طول
// فاضي ويسحب من السحابة من الأول (فاضي بعد التصفير، أو النسخة اللي MK رجّعتها).
// بعدها لازم البرنامج يتقفل ويتفتح: setupDatabase بترجّع الحمايات والقيم الأساسية.

export function wipeCompanyData(db: Db) {
  const tables = (db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name <> 'app_settings'").all() as { name: string }[]).map(
    (r) => r.name,
  );
  const triggers = (db.prepare("SELECT name FROM sqlite_master WHERE type = 'trigger'").all() as { name: string }[]).map((r) => r.name);
  db.exec("PRAGMA foreign_keys = OFF");
  try {
    db.transaction(() => {
      // الحمايات (مفيش مسح، الشهر المقفول، المزامنة) بتترجع لوحدها أول ما البرنامج يفتح
      for (const t of triggers) db.exec(`DROP TRIGGER IF EXISTS "${t}"`);
      for (const t of tables) db.exec(`DELETE FROM "${t}"`);
      if (db.prepare("SELECT 1 FROM sqlite_master WHERE name = 'sqlite_sequence'").get()) db.exec("DELETE FROM sqlite_sequence");
      db.prepare("DELETE FROM app_settings WHERE key = 'current_action'").run();
    })();
  } finally {
    db.exec("PRAGMA foreign_keys = ON");
  }
  return tables.length;
}
