import type { Database as SqlJsDatabase, SqlJsStatic, Statement as SqlJsStatement } from "sql.js";
import type { Db } from "../core/db";

// The tablet's database: real SQLite (sql.js, WebAssembly) wrapped in the same
// better-sqlite3 shape the laptop uses, so core/ (schema, calculations, sync)
// runs unchanged. Same adapter as the old app's tablet, typed. Saving to the
// device is separate (see storage.ts) so the tests can run this under Node.

export interface TabletDb extends Db {
  /** Whole database as a file, or null when nothing changed since last time. */
  exportIfDirty(): Uint8Array | null;
  /** Whole database as a file right now (a backup copy); doesn't count as saved. */
  exportNow(): Uint8Array;
  isDirty(): boolean;
}

const normalize = (v: unknown) => (v === undefined ? null : typeof v === "boolean" ? (v ? 1 : 0) : v);

export function createDatabase(SQL: SqlJsStatic, bytes?: Uint8Array | null): TabletDb {
  const raw: SqlJsDatabase = bytes ? new SQL.Database(bytes) : new SQL.Database();
  raw.exec("PRAGMA foreign_keys = ON");
  const cache = new Map<string, SqlJsStatement>();
  let txDepth = 0;
  let dirty = false;

  const statement = (sql: string) => {
    let stmt = cache.get(sql);
    if (!stmt) {
      stmt = raw.prepare(sql);
      cache.set(sql, stmt);
    }
    return stmt;
  };

  // better-sqlite3 takes positional values or one object of @names; sql.js
  // wants the prefix in the key — each name is written with all three.
  const params = (args: unknown[]): any => {
    if (args.length === 1 && args[0] && typeof args[0] === "object" && !Array.isArray(args[0])) {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(args[0] as Record<string, unknown>)) {
        const val = normalize(v);
        out[`@${k}`] = val;
        out[`:${k}`] = val;
        out[`$${k}`] = val;
      }
      return out;
    }
    return args.map(normalize);
  };

  const prepare = (sql: string) => ({
    run(...args: unknown[]) {
      const stmt = statement(sql);
      try {
        stmt.bind(params(args));
        stmt.step();
      } finally {
        stmt.reset();
      }
      dirty = true;
      const changes = raw.getRowsModified();
      const lastInsertRowid = raw.exec("SELECT last_insert_rowid()")[0].values[0][0] as number;
      return { changes, lastInsertRowid };
    },
    get(...args: unknown[]) {
      const stmt = statement(sql);
      try {
        stmt.bind(params(args));
        return stmt.step() ? stmt.getAsObject() : undefined;
      } finally {
        stmt.reset();
      }
    },
    all(...args: unknown[]) {
      const stmt = statement(sql);
      const rows: any[] = [];
      try {
        stmt.bind(params(args));
        while (stmt.step()) rows.push(stmt.getAsObject());
      } finally {
        stmt.reset();
      }
      return rows;
    },
  });

  const transaction = <F extends (...args: any[]) => any>(fn: F): F =>
    ((...args: any[]) => {
      const sp = `sp_${txDepth}`;
      raw.exec(txDepth === 0 ? "BEGIN" : `SAVEPOINT ${sp}`);
      txDepth++;
      try {
        const result = fn(...args);
        txDepth--;
        raw.exec(txDepth === 0 ? "COMMIT" : `RELEASE ${sp}`);
        dirty = true;
        return result;
      } catch (err) {
        txDepth--;
        raw.exec(txDepth === 0 ? "ROLLBACK" : `ROLLBACK TO ${sp}; RELEASE ${sp}`);
        throw err;
      }
    }) as F;

  // export() closes every statement and resets PRAGMAs: empty the cache and
  // turn foreign keys back on.
  const exportRaw = () => {
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
    return bytes;
  };
  const exportIfDirty = () => {
    if (!dirty || txDepth > 0) return null;
    dirty = false;
    return exportRaw();
  };

  return {
    prepare,
    transaction,
    exec(sql: string) {
      raw.exec(sql);
      dirty = true;
    },
    pragma(text: string) {
      raw.exec(`PRAGMA ${text}`);
    },
    exportIfDirty,
    exportNow: exportRaw,
    isDirty: () => dirty,
  };
}
