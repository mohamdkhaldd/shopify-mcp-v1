import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";
import { createSyncEngine, SyncEngine } from "../core/sync/syncEngine";
import { cloud } from "../core/sync/cloudConfig";
import { Db } from "../core/db";

// Laptop ↔ tablet sync through the rental app's own Supabase project. The
// engine's triggers must be in place before the first edit from the screen,
// so setup() runs synchronously and only the network part is async.
export function startDeviceSync(db: Db, onRemoteChanges: (info: { count: number; devices: string[] }) => void): SyncEngine {
  const engine = createSyncEngine({
    db,
    createClient,
    ...cloud,
    clientOptions: { realtime: { transport: WebSocket } },
    defaultDeviceName: "اللاب",
    onRemoteChanges,
  });
  engine.setup();
  engine.start().catch((e) => console.error("sync start failed", e));
  return engine;
}
