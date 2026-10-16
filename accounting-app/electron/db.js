const path = require("path");
const fs = require("fs");
const { app } = require("electron");
const Database = require("better-sqlite3");
const { setupDatabase } = require("./schema");

// قاعدة بيانات اللاب: ملف SQLite في مجلد بيانات البرنامج. الجداول نفسها
// والترحيلات في schema.js (نفس اللي بيستخدمه التابلت).
function initDatabase() {
  const userDataDir = app.getPath("userData");
  if (!fs.existsSync(userDataDir)) fs.mkdirSync(userDataDir, { recursive: true });

  const dbPath = path.join(userDataDir, "al-bunyan.db");
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  return setupDatabase(db);
}

module.exports = { initDatabase };
