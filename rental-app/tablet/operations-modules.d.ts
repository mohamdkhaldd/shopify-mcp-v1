// The operations backend is the old app's plain JavaScript (CommonJS).
declare module "*/operations/electron/schema.js" {
  const m: { setupDatabase(db: unknown, opts?: { seed?: boolean }): unknown };
  export default m;
}
declare module "*/operations/electron/ipc.js" {
  const m: { registerIpcHandlers(db: unknown): void };
  export default m;
}
declare module "*/operations/electron/syncEngine.js" {
  const m: { createSyncEngine(opts: Record<string, unknown>): any };
  export default m;
  export const createSyncEngine: (opts: Record<string, unknown>) => any;
}
declare module "*/operations/electron/cloudConfig.js" {
  const m: { supabaseUrl: string; supabaseKey: string; email: string };
  export default m;
}
declare module "*/operations/electron/schema.js" {
  export const setupDatabase: (db: unknown, opts?: { seed?: boolean }) => any;
}
declare module "*/operations/tablet/electronShim.js" {
  export const handlers: Record<string, (event: unknown, payload: unknown) => unknown>;
}
