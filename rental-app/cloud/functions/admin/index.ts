// Supabase Edge Function "admin": لوحة إدارة MK-Tech (لصاحب الشركة بس).
// الدخول بكود + باسورد (متخزنين hash في licensing.secrets)، والرد توكن جلسة
// موقّع HMAC بمفتاح في licensing.secrets (admin_session_key) — صالح ٣٠ يوم.
// كل الكلام مع قاعدة البيانات من هنا (SUPABASE_DB_URL)؛ الصفحة نفسها
// (admin-web) مفيهاش أي مفتاح سري. ٨ محاولات غلط في ربع ساعة = قفل مؤقت.
// Deployed with the Supabase MCP tool (verify_jwt off: الحماية بالتوكن ده).
// التنبيهات على الآيفون (Web Push): مفاتيح VAPID في licensing.secrets، والاشتراكات
// في licensing.admin_push؛ pg_cron بينادي action "cron" كل يوم بمفتاح cron_key.
import postgres from "npm:postgres@3.4.5";
import webpush from "npm:web-push@3.6.7";

const sql = postgres(Deno.env.get("SUPABASE_DB_URL")!, { prepare: false, max: 2 });
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const fail = (error: string, status = 200) => json({ ok: false, error }, status);

// الباقات (التأجير): الحد بيتبعت موقّع مع التفعيل
const PLANS: Record<string, { label: string; max: number | null; price: number }> = {
  p5: { label: "١–٥ معدات", max: 5, price: 500 },
  p10: { label: "٦–١٠ معدات", max: 10, price: 1000 },
  p15: { label: "١١–١٥ معدة", max: 15, price: 1500 },
  p20: { label: "١٦–٢٠ معدة", max: 20, price: 2000 },
  p20plus: { label: "أكتر من ٢٠ معدة", max: null, price: 3000 },
};

const enc = new TextEncoder();
const b64url = (b: Uint8Array) => btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromB64url = (s: string) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));
let hmacKey: CryptoKey | null = null;
async function key() {
  if (hmacKey) return hmacKey;
  const [s] = await sql`select v from licensing.secrets where k = 'admin_session_key'`;
  hmacKey = await crypto.subtle.importKey("raw", enc.encode(s.v), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
  return hmacKey;
}
async function makeToken() {
  const body = enc.encode(JSON.stringify({ a: 1, exp: Math.floor(Date.now() / 1000) + 30 * 86400 }));
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", await key(), body));
  return `${b64url(body)}.${b64url(sig)}`;
}
async function validToken(t: string | undefined) {
  if (!t) return false;
  const [b, s] = t.split(".");
  if (!b || !s) return false;
  try {
    if (!(await crypto.subtle.verify("HMAC", await key(), fromB64url(s), fromB64url(b)))) return false;
    const p = JSON.parse(new TextDecoder().decode(fromB64url(b)));
    return p.a === 1 && p.exp > Date.now() / 1000;
  } catch {
    return false;
  }
}
const normCode = (c: string) => (c ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");

async function uploadLogo(logo: { data: string; type: string } | undefined) {
  if (!logo?.data) return undefined;
  const type = /^image\/(png|jpeg|webp)$/.test(logo.type) ? logo.type : "image/png";
  const bytes = Uint8Array.from(atob(logo.data), (c) => c.charCodeAt(0));
  if (bytes.length > 2_000_000) throw new Error("logo_too_big");
  const name = `${crypto.randomUUID()}.${type === "image/jpeg" ? "jpg" : type.split("/")[1]}`;
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/logos/${name}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY, "Content-Type": type, "x-upsert": "false" },
    body: bytes,
  });
  if (!res.ok) throw new Error(`logo_upload_${res.status}`);
  return `${SUPABASE_URL}/storage/v1/object/public/logos/${name}`;
}

// جداول بتتكتب لوحدها (إعدادات/بذور) — مش شغل حقيقي من العميل
const SYSTEM_TABLES = ["rate_settings", "treasury_accounts", "withholding_rates", "app_settings"];
const DAY = 86_400_000;
/** حالة العميل من آخر فتح وآخر تسجيل */
function activityStatus(lastSeen: string | null, lastEntry: string | null) {
  const now = Date.now();
  const seen = lastSeen ? (now - new Date(lastSeen).getTime()) / DAY : Infinity;
  const entry = lastEntry ? (now - new Date(lastEntry).getTime()) / DAY : Infinity;
  if (entry <= 3) return "active"; // بيسجّل
  if (seen <= 7 && entry > 7) return "viewing"; // بيفتح بس مش بيسجّل
  if (Math.min(seen, entry) <= 14) return "slow"; // قليل
  return "idle"; // واقف
}

// ---- الدفع = التجديد (الاشتراك مقدّم: يدفع يتمد، مدفعش يخلص ويقف لوحده) ----
const addMonthsToDate = (iso: string, n: number) => {
  const [y, m, d] = iso.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1 + n, 1));
  const last = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate();
  t.setUTCDate(Math.min(d, last));
  return t.toISOString().slice(0, 10);
};
const cairoToday = () => new Date(Date.now() + 2 * 3600_000).toISOString().slice(0, 10);

async function customers() {
  const lic = await sql`
    select l.id, l.key, l.customer, l.display_name, l.logo_url, l.products, l.max_devices, l.expires_at, l.revoked, l.renews,
           l.plan, l.max_equipment, l.note, l.created_at, l.data_from, (l.password_hash is not null) as has_password, l.phone,
           (select count(*) from public.license_devices d where d.license_id = l.id and not d.revoked)::int as devices
    from public.licenses l
    -- عملاء التجربة مش بيظهروا (to_jsonb: يشتغل حتى قبل ما العمود يتعمل)
    where not coalesce((to_jsonb(l) ->> 'is_test')::boolean, false)
    order by l.id`;
  const owners = new Map<number, any>();
  for (const l of lic) {
    const owner = l.data_from ?? l.id;
    if (!owners.has(owner)) owners.set(owner, { id: owner, codes: [] as any[] });
    owners.get(owner).codes.push(l);
  }
  const out = [];
  for (const g of owners.values()) {
    const main = g.codes.find((c: any) => c.id === g.id) ?? g.codes[0];
    const live = g.codes.filter((c: any) => !c.revoked);
    const head = live[0] ?? main;
    const [eq] = await sql`select count(*)::int as n from public.sync_rows where tenant_id = ${g.id} and tbl = 'equipment' and not deleted and coalesce(data->>'deleted_at', '') = ''`;
    const ids = g.codes.map((c: any) => Number(c.id));
    const [act] = await sql`
      select (select max(last_seen_at) from public.license_devices where license_id = any(${ids}) and not revoked) as last_seen,
             max(at) as last_entry,
             count(*) filter (where at > now() - interval '7 days')::int as entries7,
             count(*) filter (where at > now() - interval '30 days')::int as entries30,
             count(distinct (at at time zone 'Africa/Cairo')::date) filter (where at > now() - interval '30 days')::int as days30
      from public.sync_log where tenant_id in (${g.id}, ${-g.id}) and tbl <> all(${SYSTEM_TABLES})`;
    out.push({
      id: g.id,
      customer: head.customer,
      displayName: head.display_name,
      logoUrl: head.logo_url,
      phone: g.codes.find((c: any) => c.phone)?.phone ?? null,
      since: g.codes.reduce((m: string, c: any) => (String(c.created_at) < m ? String(c.created_at) : m), String(main.created_at)),
      plan: head.plan,
      planLabel: head.plan ? PLANS[head.plan]?.label ?? head.plan : null,
      price: head.plan ? PLANS[head.plan]?.price ?? null : null,
      maxEquipment: head.max_equipment,
      equipment: eq.n,
      expiresAt: head.expires_at,
      renews: head.renews,
      active: live.length > 0,
      devices: live.reduce((s: number, c: any) => s + c.devices, 0),
      activity: {
        lastSeen: act.last_seen,
        lastEntry: act.last_entry,
        entries7: act.entries7,
        entries30: act.entries30,
        days30: act.days30,
        status: activityStatus(act.last_seen, act.last_entry),
      },
      codes: g.codes.map((c: any) => ({
        id: c.id, key: c.key, products: c.products, maxDevices: c.max_devices, devices: c.devices, revoked: c.revoked,
        expiresAt: c.expires_at, hasPassword: c.has_password, note: c.note,
      })),
    });
  }
  return out;
}

// ---- التنبيهات على الآيفون ----
let vapidReady = false;
async function vapid() {
  if (vapidReady) return;
  const rows = await sql`select k, v from licensing.secrets where k in ('vapid_public', 'vapid_private')`;
  const m = Object.fromEntries(rows.map((r: any) => [r.k, r.v]));
  webpush.setVapidDetails("mailto:admin@mk-tech.app", m.vapid_public, m.vapid_private);
  vapidReady = true;
}
/** يبعت تنبيه لكل الآيفونات المشتركة؛ اللي اشتراكها انتهى بتتشال */
async function pushAll(title: string, body: string, url = "./") {
  await vapid();
  const subs = await sql`select endpoint, keys from licensing.admin_push`;
  let sent = 0;
  for (const s of subs) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: s.keys }, JSON.stringify({ title, body, url }), { TTL: 86400 });
      sent++;
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) await sql`delete from licensing.admin_push where endpoint = ${s.endpoint}`;
      else console.error("push", code, e);
    }
  }
  return sent;
}
const sentRecently = async (kind: string, owner: number | null, days: number) =>
  (await sql`select 1 from licensing.alert_log where kind = ${kind} and owner_id is not distinct from ${owner} and sent_at > now() - make_interval(days => ${days})`).length > 0;
const arNum = (n: number) => n.toLocaleString("ar-EG");

/** كل يوم: مين وقف، مين اشتراكه قرّب يخلص، والملخص الأسبوعي (يوم الحد) */
async function dailyAlerts() {
  // مفيش آيفون مشترك = مفيش حد يوصله، ومنسجلش إن التنبيه اتبعت
  const [{ n: subs }] = await sql`select count(*)::int as n from licensing.admin_push`;
  if (!subs) return 0;
  const cs = await customers();
  const live = cs.filter((c) => c.active);
  let n = 0;
  for (const c of live) {
    const name = c.displayName || c.customer;
    if (c.activity.status === "idle" && !(await sentRecently("idle", c.id, 7))) {
      const last = c.activity.lastEntry || c.activity.lastSeen;
      const days = last ? Math.floor((Date.now() - new Date(last).getTime()) / DAY) : null;
      n += await pushAll(`${name} واقف`, days != null ? `مش شغال على البرنامج من ${arNum(days)} يوم — كلّمه` : "لسه مشتغلش على البرنامج خالص — كلّمه", `./#c/${c.id}`);
      await sql`insert into licensing.alert_log (kind, owner_id) values ('idle', ${c.id})`;
    }
    if (c.expiresAt) {
      const left = Math.ceil((new Date(c.expiresAt).getTime() - Date.now()) / DAY);
      if (left >= 0 && left <= 3 && !(await sentRecently("expire", c.id, 3))) {
        n += await pushAll(`اشتراك ${name} قرّب يخلص`, left === 0 ? "بيخلص النهارده" : `باقي ${arNum(left)} يوم`, `./#c/${c.id}`);
        await sql`insert into licensing.alert_log (kind, owner_id) values ('expire', ${c.id})`;
      }
    }
  }
  const cairoDay = new Date(Date.now() + 2 * 3600_000).getUTCDay(); // ٠ = الحد
  if (cairoDay === 0 && !(await sentRecently("weekly", null, 6))) {
    const working = live.filter((c) => c.activity.status === "active").length;
    const idle = live.filter((c) => c.activity.status === "idle").length;
    const fresh = cs.filter((c) => Date.now() - new Date(c.since).getTime() < 7 * DAY).length;
    const monthly = live.reduce((s, c) => s + (c.price || 0), 0);
    const [w] = await sql`select coalesce(sum(amount), 0)::float as n from licensing.subscription_payments where paid_at > (now() at time zone 'Africa/Cairo')::date - 7`;
    n += await pushAll("ملخص الأسبوع", `${arNum(working)} شغال · ${arNum(idle)} واقف · ${arNum(fresh)} جديد · اتحصّل ${arNum(w.n)} ج الأسبوع ده`);
    await sql`insert into licensing.alert_log (kind) values ('weekly')`;
  }
  return n;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return fail("method", 405);
  let b: Record<string, any>;
  try {
    b = await req.json();
  } catch {
    return fail("bad_request", 400);
  }
  try {
    if (b.action === "login") {
      const [{ n }] = await sql`select count(*)::int as n from licensing.admin_attempts where not ok and at > now() - interval '15 minutes'`;
      if (n >= 8) return fail("locked");
      const [r] = await sql`
        select (select extensions.crypt(${normCode(b.code)}, v) = v from licensing.secrets where k = 'admin_code_hash') as code_ok,
               (select extensions.crypt(${String(b.password ?? "")}, v) = v from licensing.secrets where k = 'admin_password_hash') as pw_ok`;
      const ok = !!(r.code_ok && r.pw_ok);
      await sql`insert into licensing.admin_attempts (ok) values (${ok})`;
      return ok ? json({ ok: true, token: await makeToken() }) : fail("wrong");
    }
    if (b.action === "cron") {
      const [k] = await sql`select v from licensing.secrets where k = 'cron_key'`;
      if (!k || String(b.cronKey ?? "") !== k.v) return fail("auth", 401);
      return json({ ok: true, sent: await dailyAlerts() });
    }
    if (!(await validToken(b.token))) return fail("auth", 401);

    switch (b.action) {
      case "dashboard": {
        const [c] = await sql`select data from licensing.mk_company where id = 1`;
        const [p] = await sql`select count(*)::int as n from licensing.admin_push`;
        const [v] = await sql`select v from licensing.secrets where k = 'vapid_public'`;
        const [inc] = await sql`
          select coalesce(sum(amount) filter (where to_char(paid_at, 'YYYY-MM') = to_char((now() at time zone 'Africa/Cairo')::date, 'YYYY-MM')), 0)::float as this_month,
                 coalesce(sum(amount) filter (where to_char(paid_at, 'YYYY-MM') = to_char(((now() at time zone 'Africa/Cairo')::date - interval '1 month'), 'YYYY-MM')), 0)::float as last_month
          from licensing.subscription_payments`;
        return json({ ok: true, company: c?.data ?? {}, customers: await customers(), plans: PLANS, push: { devices: p.n, key: v?.v ?? null }, income: { thisMonth: inc.this_month, lastMonth: inc.last_month } });
      }
      case "payments": {
        const rows = await sql`select id, amount::float as amount, to_char(paid_at, 'YYYY-MM-DD') as paid_at, for_month, months, method, note
                               from licensing.subscription_payments where owner_id = ${Number(b.id)} order by paid_at desc, id desc`;
        return json({ ok: true, payments: rows });
      }
      case "payment.add": {
        // دفع = تجديد: الاشتراك بيتمد عدد الشهور من آخر ميعاد (أو من النهارده لو كان خلص)،
        // والفلوس بتتسجل (لو المبلغ صفر = تجديد من غير فلوس، مش بيتسجل)
        const owner = Number(b.id);
        const months = Math.min(24, Math.max(1, Math.trunc(Number(b.months) || 1)));
        const amount = Number(b.amount) || 0;
        if (amount < 0) return fail("amount");
        const paidAt = /^\d{4}-\d{2}-\d{2}$/.test(String(b.paidAt ?? "")) ? String(b.paidAt) : cairoToday();
        const codes = await sql`select id, to_char(expires_at, 'YYYY-MM-DD') as exp from public.licenses where coalesce(data_from, id) = ${owner}`;
        if (!codes.length) return fail("not_found");
        const today = cairoToday();
        const latest = codes.map((c: any) => c.exp).filter(Boolean).sort().pop();
        const from = latest && latest > today ? latest : today;
        const until = addMonthsToDate(from, months);
        await sql`update public.licenses set expires_at = ${until}, renews = true where coalesce(data_from, id) = ${owner}`;
        if (amount > 0)
          await sql`insert into licensing.subscription_payments (owner_id, amount, paid_at, for_month, months, method, note)
                    values (${owner}, ${amount}, ${paidAt}, ${paidAt.slice(0, 7)}, ${months}, ${b.method || null}, ${String(b.note ?? "").trim() || null})`;
        return json({ ok: true, until });
      }
      case "payment.delete": {
        await sql`delete from licensing.subscription_payments where id = ${Number(b.paymentId)}`;
        return json({ ok: true });
      }
      case "push.subscribe": {
        const sub = b.subscription ?? {};
        if (!sub.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) return fail("bad_request", 400);
        await sql`insert into licensing.admin_push (endpoint, keys, device) values (${sub.endpoint}, ${sql.json(sub.keys)}, ${b.device ?? null})
                  on conflict (endpoint) do update set keys = excluded.keys`;
        return json({ ok: true });
      }
      case "push.test": {
        return json({ ok: true, sent: await pushAll("تنبيهات MK شغالة ✓", "هيوصلك هنا لما عميل يقف أو اشتراكه يقرّب يخلص، وملخص كل أسبوع") });
      }
      case "company.save": {
        const data = { ...(b.data ?? {}) };
        const logo = await uploadLogo(b.logo);
        if (logo) data.logoUrl = logo;
        await sql`update licensing.mk_company set data = ${sql.json(data)}, updated_at = now() where id = 1`;
        return json({ ok: true });
      }
      case "customer.create": {
        const products: string[] = Array.isArray(b.products) && b.products.length ? b.products : ["rental"];
        if (!String(b.customer ?? "").trim()) return fail("name_required");
        const plan = b.plan && PLANS[b.plan] ? b.plan : null;
        const logo = (await uploadLogo(b.logo)) ?? null;
        const [l] = await sql`
          insert into public.licenses (customer, display_name, logo_url, products, max_devices, expires_at, plan, max_equipment, renews, password_hash, note, phone)
          values (${String(b.customer).trim()}, ${String(b.displayName ?? "").trim() || null}, ${logo}, ${products}, ${Math.max(1, Number(b.maxDevices) || 2)},
                  ${b.expiresAt || null}, ${plan}, ${plan ? PLANS[plan].max : null}, ${b.renews !== false},
                  ${b.password ? sql`extensions.crypt(${String(b.password)}, extensions.gen_salt('bf'))` : null}, ${b.note || null}, ${String(b.phone ?? "").trim() || null})
          returning id, key`;
        return json({ ok: true, id: l.id, key: l.key });
      }
      case "license.update": {
        // تعديل العميل: بيتطبق على كل أكواده (نفس الشركة) إلا لو اتحدد كود واحد
        const ids: number[] = b.codeId
          ? [Number(b.codeId)]
          : (await sql`select id from public.licenses where coalesce(data_from, id) = ${Number(b.id)}`).map((r: any) => r.id);
        const f = b.fields ?? {};
        const logo = f.logo ? await uploadLogo(f.logo) : undefined;
        for (const id of ids) {
          if (f.customer !== undefined) await sql`update public.licenses set customer = ${String(f.customer).trim()} where id = ${id}`;
          if (f.displayName !== undefined) await sql`update public.licenses set display_name = ${String(f.displayName).trim() || null} where id = ${id}`;
          if (logo !== undefined) await sql`update public.licenses set logo_url = ${logo} where id = ${id}`;
          if (f.expiresAt !== undefined) await sql`update public.licenses set expires_at = ${f.expiresAt || null} where id = ${id}`;
          if (f.renews !== undefined) await sql`update public.licenses set renews = ${!!f.renews} where id = ${id}`;
          if (f.maxDevices !== undefined) await sql`update public.licenses set max_devices = ${Math.max(1, Number(f.maxDevices) || 1)} where id = ${id}`;
          if (f.plan !== undefined) {
            const p = f.plan && PLANS[f.plan] ? f.plan : null;
            await sql`update public.licenses set plan = ${p}, max_equipment = ${p ? PLANS[p].max : null} where id = ${id}`;
          }
          if (f.revoked !== undefined) await sql`update public.licenses set revoked = ${!!f.revoked} where id = ${id}`;
          if (f.phone !== undefined) await sql`update public.licenses set phone = ${String(f.phone ?? "").trim() || null} where id = ${id}`;
          if (f.password !== undefined)
            await sql`update public.licenses set password_hash = ${f.password ? sql`extensions.crypt(${String(f.password)}, extensions.gen_salt('bf'))` : null} where id = ${id}`;
        }
        return json({ ok: true });
      }
      case "code.add": {
        // كود تاني لنفس الشركة (تأجير بس / تشغيل بس / الاتنين) على نفس البيانات
        const [o] = await sql`select * from public.licenses where id = ${Number(b.id)}`;
        if (!o) return fail("not_found");
        const owner = o.data_from ?? o.id;
        const products: string[] = Array.isArray(b.products) && b.products.length ? b.products : ["rental"];
        const [l] = await sql`
          insert into public.licenses (customer, display_name, logo_url, products, max_devices, expires_at, plan, max_equipment, renews, password_hash, note, data_from)
          values (${o.customer}, ${o.display_name}, ${o.logo_url}, ${products}, ${Math.max(1, Number(b.maxDevices) || 2)}, ${o.expires_at}, ${o.plan}, ${o.max_equipment},
                  ${o.renews}, ${o.password_hash}, ${b.note || null}, ${owner})
          returning id, key`;
        return json({ ok: true, id: l.id, key: l.key });
      }
      case "activity": {
        // تفاصيل النشاط: كل يوم في آخر ٣٠ يوم، ومين بيسجل
        const owner = Number(b.id);
        const t = [owner, -owner];
        const days = await sql`
          select to_char((at at time zone 'Africa/Cairo')::date, 'YYYY-MM-DD') as day, count(*)::int as n
          from public.sync_log where tenant_id = any(${t}) and tbl <> all(${SYSTEM_TABLES}) and at > now() - interval '30 days'
          group by 1 order by 1`;
        const people = await sql`
          select coalesce(nullif(device_name, ''), 'جهاز') as device, count(*)::int as n, max(at) as last
          from public.sync_log where tenant_id = any(${t}) and tbl <> all(${SYSTEM_TABLES}) and at > now() - interval '30 days'
          group by 1 order by 3 desc limit 10`;
        return json({ ok: true, days, people });
      }
      case "devices": {
        const rows = await sql`
          select d.id, d.license_id, l.key, d.device_name, d.platform, d.app_version, d.revoked, d.last_seen_at
          from public.license_devices d join public.licenses l on l.id = d.license_id
          where coalesce(l.data_from, l.id) = ${Number(b.id)} order by d.revoked, d.last_seen_at desc nulls last`;
        return json({ ok: true, devices: rows });
      }
      case "device.revoke": {
        await sql`update public.license_devices set revoked = ${b.revoked !== false} where id = ${Number(b.deviceId)}`;
        return json({ ok: true });
      }
      case "customer.delete": {
        // مسح عميل خالص (كل أكواده + أجهزته + بياناته على السيرفر + حسابات المزامنة).
        // لازم يكون موقوف الأول، ولازم اسمه يتكتب بالظبط للتأكيد.
        const owner = Number(b.id);
        const codes = await sql`select id, customer, revoked from public.licenses where coalesce(data_from, id) = ${owner}`;
        if (!codes.length) return fail("not_found");
        if (codes.some((c: any) => !c.revoked)) return fail("stop_first");
        if (String(b.confirm ?? "").trim() !== String(codes.find((c: any) => c.id === owner)?.customer ?? codes[0].customer).trim()) return fail("confirm");
        const ids = codes.map((c: any) => c.id);
        const tenants = [...ids, ...ids.map((i: number) => -i)];
        await sql.begin(async (t: any) => {
          await t`delete from public.sync_rows where tenant_id = any(${tenants})`;
          await t`delete from public.sync_log where tenant_id = any(${tenants})`;
          await t`delete from public.license_devices where license_id = any(${ids})`;
          await t`delete from auth.users where email in (select email from licensing.tenant_creds where license_id = any(${ids}) union select email from licensing.ops_creds where license_id = any(${ids}))`;
          await t`delete from licensing.tenant_creds where license_id = any(${ids})`;
          await t`delete from licensing.ops_creds where license_id = any(${ids})`;
          // الأكواد التانية الأول (data_from بيشاور على الكود الأصلي)
          await t`delete from public.licenses where id = any(${ids}) and id <> ${owner}`;
          await t`delete from public.licenses where id = ${owner}`;
        });
        return json({ ok: true });
      }
      case "admin.password": {
        const [r] = await sql`select extensions.crypt(${String(b.current ?? "")}, v) = v as ok from licensing.secrets where k = 'admin_password_hash'`;
        if (!r?.ok) return fail("wrong");
        if (String(b.next ?? "").length < 6) return fail("short");
        await sql`update licensing.secrets set v = extensions.crypt(${String(b.next)}, extensions.gen_salt('bf')) where k = 'admin_password_hash'`;
        return json({ ok: true });
      }
      default:
        return fail("unknown_action", 400);
    }
  } catch (e) {
    console.error(e);
    return fail(String((e as Error)?.message ?? "server").startsWith("logo") ? String((e as Error).message) : "server", 500);
  }
});
