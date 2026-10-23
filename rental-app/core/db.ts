// The subset of the better-sqlite3 API the core uses. The desktop app passes a
// real better-sqlite3 Database; the tablet passes a sql.js adapter with the
// same shape (same idea as the old app's tablet/sqlAdapter.js).
export interface RunResult {
  changes: number;
  lastInsertRowid: number | bigint;
}

export interface Statement {
  run(...params: unknown[]): RunResult;
  get(...params: unknown[]): any;
  all(...params: unknown[]): any[];
}

export interface Db {
  prepare(sql: string): Statement;
  exec(sql: string): unknown;
  transaction<F extends (...args: any[]) => any>(fn: F): F;
  pragma?(source: string, options?: { simple?: boolean }): unknown;
}

/** Thrown for anything the user should read (Arabic message). */
export class UserError extends Error {
  constructor(message: string, readonly code: string = "user") {
    super(message);
    this.name = "UserError";
  }
}

/** Thrown when an outgoing payment would push operating cash below zero; retry with confirmNegative. */
export class CashWarning extends UserError {
  constructor(readonly availableAfterPt: number) {
    super("المبلغ ده هيخلّي الفلوس المتاحة للتشغيل بالسالب. لو متأكد، أكّد الصرف.", "cash_negative");
  }
}

// local calendar date (Egypt), not UTC — right after midnight they differ
export const today = () => new Date().toLocaleDateString("en-CA");
export const monthOf = (date: string) => date.slice(0, 7);
