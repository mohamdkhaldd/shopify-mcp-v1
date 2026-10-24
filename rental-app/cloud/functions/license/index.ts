// Supabase Edge Function "license": checks an activation code for a device
// (licensing.activate in the database does the rules: unknown / stopped /
// expired / too many devices) and signs the answer with the Ed25519 key kept
// in licensing.secrets. The app verifies the signature with the public key,
// so an activation can't be faked by editing files on the device.
// It also hands the device its company's name, logo and the login of its own
// cloud space for each program the code opens (rental / operations): each
// customer syncs only with its own devices.
// Besides activating ("activate", the default): "release" signs a device out
// (its place on the code is free again), "setPassword" / "checkPassword" handle
// the company password asked when the code is entered on a new device.
// Deployed with the Supabase MCP tool; this copy is the source of truth.
import postgres from "npm:postgres@3.4.5";
import * as ed from "npm:@noble/ed25519@2.1.0";
import { sha512 } from "npm:@noble/hashes@1.5.0/sha512";

ed.etc.sha512Sync = (...m: Uint8Array[]) => sha512(ed.etc.concatBytes(...m));

const sql = postgres(Deno.env.get("SUPABASE_DB_URL")!, { prepare: false, max: 2 });
let privateKey: Uint8Array | null = null;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const b64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ ok: false, error: "method" }, 405);
  let body: {
    action?: "activate" | "release" | "setPassword" | "checkPassword";
    key?: string;
    deviceId?: string;
    deviceName?: string;
    platform?: string;
    appVersion?: string;
    password?: string;
    current?: string;
    next?: string;
  };
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: "bad_request" }, 400);
  }
  try {
    const key = body.key ?? "";
    const device = body.deviceId ?? "";
    if (body.action === "release") return json((await sql`select licensing.release(${key}, ${device}) as r`)[0].r);
    if (body.action === "setPassword") return json((await sql`select licensing.set_password(${key}, ${device}, ${body.current ?? ""}, ${body.next ?? ""}) as r`)[0].r);
    if (body.action === "checkPassword") return json((await sql`select licensing.check_password(${key}, ${device}, ${body.password ?? ""}) as r`)[0].r);
    const [row] = await sql`select licensing.activate(${key}, ${device}, ${body.deviceName ?? null}, ${body.platform ?? null}, ${body.appVersion ?? null}, ${body.password ?? null}) as r`;
    const r = row.r as {
      ok: boolean;
      error?: string;
      licenseId?: number;
      customer?: string;
      name?: string;
      logoUrl?: string | null;
      expiresAt?: string | null;
      iat?: number;
      exp?: number;
      maxDevices?: number;
      products?: string[];
      hasPassword?: boolean;
      sync?: { email: string; password: string };
      syncByProduct?: Record<string, { email: string; password: string }>;
    };
    if (!r.ok) return json(r);
    if (!privateKey) {
      const [s] = await sql`select v from licensing.secrets where k = 'signing_key'`;
      privateKey = ed.etc.hexToBytes(s.v);
    }
    const payload = { v: 1, lic: r.licenseId, customer: r.customer, name: r.name, products: r.products ?? ["rental"], device: body.deviceId, expiresAt: r.expiresAt ?? null, iat: r.iat, exp: r.exp };
    const bytes = new TextEncoder().encode(JSON.stringify(payload));
    const token = `${b64url(bytes)}.${b64url(ed.sign(bytes, privateKey))}`;
    return json({ ok: true, token, customer: r.customer, name: r.name, logoUrl: r.logoUrl ?? null, expiresAt: r.expiresAt ?? null, products: r.products, hasPassword: !!r.hasPassword, sync: r.sync, syncByProduct: r.syncByProduct });
  } catch (e) {
    console.error(e);
    return json({ ok: false, error: "server" }, 500);
  }
});
