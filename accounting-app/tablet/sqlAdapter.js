// قاعدة بيانات التابلت: SQLite حقيقي (sql.js) جوه التطبيق، ملفوف بنفس واجهة
// better-sqlite3 اللي اللاب بيستخدمها — عشان نفس كود الحسابات (ipc.js) ونفس
// الجداول (schema.js) يشتغلوا على التابلت من غير أي تغيير. القاعدة بتتحفظ
// في ذاكرة الجهاز (IndexedDB) بعد أي تعديل.

const IDB_NAME = "albunyan";
const IDB_STORE = "db";
const IDB_KEY = "main";

function idb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function loadSavedDatabase() {
  const db = await idb();
  return new Promise((resolve, reject) => {
    const req = db.transaction(IDB_STORE, "readonly").objectStore(IDB_STORE).get(IDB_KEY);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

async function saveDatabase(bytes) {
  const db = await idb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).put(bytes, IDB_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function normalize(value) {
  if (value === undefined) return null;
  if (typeof value === "boolean") return value ? 1 : 0;
  return value;
}

export function createDatabase(SQL, bytes) {
  const raw = bytes ? new SQL.Database(bytes) : new SQL.Database();
  raw.exec("PRAGMA foreign_keys = ON");
  const cache = new Map();
  let txDepth = 0;
  let dirty = false;
  let saving = null;

  function statement(sql) {
    let stmt = cache.get(sql);
    if (!stmt) {
      stmt = raw.prepare(sql);
      cache.set(sql, stmt);
    }
    return stmt;
  }

  // better-sqlite3 بياخد يا قيم بالترتيب يا object بأسماء (@name)، و sql.js
  // محتاج الأسماء ببادئتها — بنكتب كل اسم بالتلات بادئات.
  function params(args) {
    if (args.length === 1 && args[0] && typeof args[0] === "object" && !Array.isArray(args[0])) {
      const out = {};
      for (const [k, v] of Object.entries(args[0])) {
        const val = normalize(v);
        out[`@${k}`] = val;
        out[`:${k}`] = val;
        out[`$${k}`] = val;
      }
      return out;
    }
    return args.map(normalize);
  }

  function prepare(sql) {
    return {
      run(...args) {
        const stmt = statement(sql);
        try {
          stmt.bind(params(args));
          stmt.step();
        } finally {
          stmt.reset();
        }
        dirty = true;
        const changes = raw.getRowsModified();
        const lastInsertRowid = raw.exec("SELECT last_insert_rowid()")[0].values[0][0];
        return { changes, lastInsertRowid };
      },
      get(...args) {
        const stmt = statement(sql);
        try {
          stmt.bind(params(args));
          return stmt.step() ? stmt.getAsObject() : undefined;
        } finally {
          stmt.reset();
        }
      },
      all(...args) {
        const stmt = statement(sql);
        const rows = [];
        try {
          stmt.bind(params(args));
          while (stmt.step()) rows.push(stmt.getAsObject());
        } finally {
          stmt.reset();
        }
        return rows;
      },
    };
  }

  function transaction(fn) {
    return (...args) => {
      const savepoint = `sp_${txDepth}`;
      raw.exec(txDepth === 0 ? "BEGIN" : `SAVEPOINT ${savepoint}`);
      txDepth++;
      try {
        const result = fn(...args);
        txDepth--;
        raw.exec(txDepth === 0 ? "COMMIT" : `RELEASE ${savepoint}`);
        dirty = true;
        return result;
      } catch (err) {
        txDepth--;
        raw.exec(txDepth === 0 ? "ROLLBACK" : `ROLLBACK TO ${savepoint}; RELEASE ${savepoint}`);
        throw err;
      }
    };
  }

  // الحفظ بيصدّر القاعدة كلها — sql.js بيقفل كل الـ statements وبيرجّع
  // الـ PRAGMAs لأصلها بعد التصدير، فبنفضي الكاش ونرجّع foreign_keys.
  async function flush() {
    if (!dirty || txDepth > 0) return;
    if (saving) return saving;
    dirty = false;
    for (const stmt of cache.values()) {
      try {
        stmt.free();
      } catch {
        /* already freed */
      }
    }
    cache.clear();
    const bytes = raw.export();
    raw.exec("PRAGMA foreign_keys = ON");
    saving = saveDatabase(bytes).finally(() => {
      saving = null;
    });
    return saving;
  }

  return {
    prepare,
    transaction,
    exec(sql) {
      raw.exec(sql);
      dirty = true;
    },
    pragma(text) {
      raw.exec(`PRAGMA ${text}`);
    },
    flush,
    isDirty: () => dirty,
  };
}
