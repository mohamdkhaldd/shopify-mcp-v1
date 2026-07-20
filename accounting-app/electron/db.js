const path = require("path");
const fs = require("fs");
const { app } = require("electron");
const Database = require("better-sqlite3");

// Phase 1 only creates the local database file so the app is fully wired to
// disk from day one. The real schema (equipment, partners, drivers, ...) is
// introduced in Phase 2 alongside the settings screen.
function initDatabase() {
  const userDataDir = app.getPath("userData");
  if (!fs.existsSync(userDataDir)) fs.mkdirSync(userDataDir, { recursive: true });

  const dbPath = path.join(userDataDir, "al-bunyan.db");
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  return db;
}

module.exports = { initDatabase };
