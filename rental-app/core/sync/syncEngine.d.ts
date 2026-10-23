import type { Db } from "../db";

export interface SyncStatus {
  deviceId: string;
  deviceName: string;
  pending: number;
  deferred: number;
  online: boolean;
  needsLogin: boolean;
  lastError: string | null;
  lastSyncAt: string | null;
}

export interface SyncEngine {
  setup(): void;
  start(): Promise<void>;
  stop(): void;
  login(password: string): Promise<SyncStatus>;
  push(): Promise<void>;
  pull(): Promise<void>;
  syncNow(): Promise<SyncStatus>;
  status(): SyncStatus;
  setDeviceName(name: string): SyncStatus;
  _applyBatch(rows: unknown[]): { applied: number; devices: string[] };
  _buildBatch(limit?: number): { entries: unknown[]; records: any[] };
}

export function createSyncEngine(opts: {
  db: Db;
  createClient: (...args: any[]) => any;
  supabaseUrl: string;
  supabaseKey: string;
  email: string;
  clientOptions?: Record<string, unknown>;
  defaultDeviceName?: string;
  onRemoteChanges?: (info: { count: number; devices: string[] }) => void;
  logger?: Pick<Console, "error" | "warn">;
}): SyncEngine;
