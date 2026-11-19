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
import webpush from "npm:web-push@3.6.7";

ed.etc.sha512Sync = (...m: Uint8Array[]) => sha512(ed.etc.concatBytes(...m));

const sql = postgres(Deno.env.get("SUPABASE_DB_URL")!, { prepare: false, max: 2 });
let privateKey: Uint8Array | null = null;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

// «نسيت الباسورد»: تنبيه على موبايل MK (نفس تنبيهات صفحة الإدارة) فيه اسم
// الشركة وتليفونها — MK بتغيّر باسورد الشركة من صفحة الإدارة. مرة كل ١٠ دقايق.
let vapidReady = false;
async function notifyMk(title: string, text: string, url: string) {
  if (!vapidReady) {
    const rows = await sql`select k, v from licensing.secrets where k in ('vapid_public', 'vapid_private')`;
    const m = Object.fromEntries(rows.map((r: { k: string; v: string }) => [r.k, r.v]));
    webpush.setVapidDetails("mailto:admin@mk-tech.app", m.vapid_public, m.vapid_private);
    vapidReady = true;
  }
  let sent = 0;
  for (const s of await sql`select endpoint, keys from licensing.admin_push`) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: s.keys }, JSON.stringify({ title, body: text, url }), { TTL: 86400 });
      sent++;
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) await sql`delete from licensing.admin_push where endpoint = ${s.endpoint}`;
    }
  }
  return sent;
}

const b64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ ok: false, error: "method" }, 405);
  let body: {
    action?: "activate" | "release" | "setPassword" | "checkPassword" | "reset" | "passwordHelp";
    what?: string;
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
    // تصفير بيانات التأجير بتاعة الشركة (بباسورد الشركة) — بعد نسخة محفوظة ترجّعها MK
    if (body.action === "reset") return json((await sql`select licensing.reset_company(${key}, ${device}, ${body.password ?? ""}) as r`)[0].r);
    if (body.action === "checkPassword") return json((await sql`select licensing.check_password(${key}, ${device}, ${body.password ?? ""}) as r`)[0].r);
    if (body.action === "passwordHelp") {
      const [lic] = await sql`
        select l.id, coalesce(l.data_from, l.id) as owner, l.customer, l.display_name, l.phone, d.device_name
        from public.licenses l join public.license_devices d on d.license_id = l.id
        where l.key = licensing.normalize_key(${key}) and d.device_id = ${device} and not l.revoked and not d.revoked`;
      if (!lic) return json({ ok: false, error: "not_found" });
      const recent = await sql`select 1 from licensing.alert_log where kind = 'password_help' and owner_id = ${lic.owner} and sent_at > now() - interval '10 minutes'`;
      if (recent.length) return json({ ok: true, already: true });
      await sql`insert into licensing.alert_log (kind, owner_id) values ('password_help', ${lic.owner})`;
      const what = body.what === "hassan" ? "باسورد صفحة الكوميشن (والشركة)" : "باسورد الشركة";
      const sent = await notifyMk(
        `🔑 ${lic.display_name || lic.customer} نسي ${what}`,
        `${lic.customer}${lic.phone ? ` — ${lic.phone}` : ""}${lic.device_name ? ` — من جهاز ${lic.device_name}` : ""}. كلّمه وغيّر باسورد الشركة من صفحة الإدارة.`,
        `./#c/${lic.owner}`,
      );
      return json({ ok: true, sent });
    }
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
      plan?: string | null;
      maxEquipment?: number | null;
      hasPassword?: boolean;
      dataEpoch?: number | null;
      sync?: { email: string; password: string };
      syncByProduct?: Record<string, { email: string; password: string }>;
    };
    if (!r.ok) return json(r);
    if (!privateKey) {
      const [s] = await sql`select v from licensing.secrets where k = 'signing_key'`;
      privateKey = ed.etc.hexToBytes(s.v);
    }
    const payload = { v: 1, lic: r.licenseId, customer: r.customer, name: r.name, products: r.products ?? ["rental"], device: body.deviceId, expiresAt: r.expiresAt ?? null, plan: r.plan ?? null, maxEquipment: r.maxEquipment ?? null, iat: r.iat, exp: r.exp };
    const bytes = new TextEncoder().encode(JSON.stringify(payload));
    const token = `${b64url(bytes)}.${b64url(ed.sign(bytes, privateKey))}`;
    return json({ ok: true, token, customer: r.customer, name: r.name, logoUrl: r.logoUrl ?? null, expiresAt: r.expiresAt ?? null, products: r.products, plan: r.plan ?? null, maxEquipment: r.maxEquipment ?? null, hasPassword: !!r.hasPassword, dataEpoch: r.dataEpoch ?? null, sync: r.sync, syncByProduct: r.syncByProduct });
  } catch (e) {
    console.error(e);
    return json({ ok: false, error: "server" }, 500);
  }
});
