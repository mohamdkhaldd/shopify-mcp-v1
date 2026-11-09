// Supabase Edge Function "sarki-read": بياخد صورة السركي الورقي (ورقة الشهر
// اللي فيها الأيام والساعات والأوفر تايم) ويقراها بالذكاء الاصطناعي، ويرجّع يوم بيوم.
// البرنامج بيعرض اللي اتقرا للمستخدم يراجعه ويكتب السعر قبل ما يتسجل —
// هنا مفيش أي كتابة في بيانات العميل.
// الدخول بكود التفعيل + رقم الجهاز (لازم يكون جهاز شغال على كود شغال)،
// القراية: Gemini من جوجل (مجاني — GEMINI_API_KEY) لو موجود، وإلا Claude
// (ANTHROPIC_API_KEY). المفاتيح أسرار على السيرفر بس — مش في البرنامج.
// حد أقصى ٦٠ صورة في اليوم لكل عميل. Deployed with the Supabase MCP tool.
import postgres from "npm:postgres@3.4.5";
import Anthropic from "npm:@anthropic-ai/sdk@1.1.0";

const sql = postgres(Deno.env.get("SUPABASE_DB_URL")!, { prepare: false, max: 2 });
const DAILY_LIMIT = 60;
const MAX_IMAGE_BYTES = 5_000_000;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const fail = (error: string, status = 200) => json({ ok: false, error }, status);

const num = { anyOf: [{ type: "number" }, { type: "null" }] };
const str = { anyOf: [{ type: "string" }, { type: "null" }] };
const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["month", "equipment", "person", "site", "days", "warnings"],
  properties: {
    month: { ...str, description: "الشهر والسنة المكتوبين على الورقة بصيغة YYYY-MM لو موجودين، وإلا null" },
    equipment: { ...str, description: "اسم/نوع/رقم المعدة لو مكتوب" },
    person: { ...str, description: "اسم المقاول أو الشركة أو السواق لو مكتوب" },
    site: { ...str, description: "اسم الموقع العام لو مكتوب مرة واحدة للشهر" },
    days: {
      type: "array",
      description: "سطر لكل يوم مكتوب على الورقة، بترتيب الأيام",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["day", "worked", "hours", "overtime", "site", "note", "unclear"],
        properties: {
          day: { type: "integer", description: "رقم اليوم في الشهر (1-31)" },
          worked: { type: "boolean", description: "اشتغل اليوم ده؟ false لو مكتوب إجازة/عطل/جمعة/مشتغلش أو الخانة مشطوبة" },
          hours: { ...num, description: "الساعات المكتوبة في خانة الساعات لليوم ده (بالكسور: ساعة ونص = 1.5) — من غير خانة الأوفر لو الأوفر في خانة لوحده. null لو مش مكتوبة" },
          overtime: { ...num, description: "ساعات الأوفر تايم لو مكتوبة في خانة لوحدها (أو مكتوب جنبها أوفر)، وإلا null" },
          site: { ...str, description: "الموقع لو مكتوب لليوم ده بالذات" },
          note: { ...str, description: "أي ملاحظة مكتوبة لليوم (سبب الإجازة، عطل، ...)" },
          unclear: { type: "boolean", description: "true لو الخط مش واضح ومش متأكد من الرقم" },
        },
      },
    },
    warnings: { type: "array", items: { type: "string" }, description: "تنبيهات بالعربي للمستخدم: حاجات مش واضحة أو ناقصة" },
  },
};

const SYSTEM = `انت بتقرا صورة "سركي" — ورقة شغل شهرية لمعدة تقيلة (لودر، بوكلين، ...) في مصر، غالبًا مكتوبة بخط اليد بالعربي.
الورقة فيها يوم بيوم: التاريخ أو رقم اليوم، عدد ساعات الشغل، وأحيانًا خانة أوفر تايم، والموقع، وملاحظات.
رجّع اللي مكتوب بالظبط — متخمّنش أرقام مش موجودة. الأرقام ممكن تكون هندي (٠١٢٣٤٥٦٧٨٩) أو عربي (0-9).
"إجازة" أو "جمعة" أو "عطل" أو "مشتغلش" أو خانة مشطوبة = worked false.
لو الورقة فيها خانة ساعات بس، حط الرقم في hours زي ما هو وسيب overtime null. لو فيها خانة أوفر لوحدها، حط الساعات في hours والأوفر في overtime (متجمعهمش).
لو يوم مش مكتوب خالص على الورقة متطلعهوش. لو رقم مش واضح علّم unclear true واكتب تنبيه في warnings.`;

// ---- Gemini (الخطة المجانية) ----
// الموديلات بتتغير أسماؤها، فبنجيب الموجود للمفتاح: موديلات "flash" الثابتة
// من الأحدث للأقدم، وبعدها "flash-lite". لو موديل مشغول (503/429) أو اتأخر،
// بنجرب اللي بعده. GEMINI_MODEL (اختياري) = موديل بعينه يتجرب الأول.
const GEMINI = "https://generativelanguage.googleapis.com/v1beta";
let geminiModels: string[] | null = null;
async function listGeminiModels(key: string) {
  if (geminiModels) return geminiModels;
  const res = await fetch(`${GEMINI}/models?pageSize=200`, { headers: { "x-goog-api-key": key }, signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new GeminiError(res.status);
  const list = ((await res.json()).models ?? []) as { name: string; supportedGenerationMethods?: string[] }[];
  const names = list.filter((m) => m.supportedGenerationMethods?.includes("generateContent")).map((m) => m.name.replace(/^models\//, ""));
  const ver = (n: string) => Number(/gemini-(\d+(?:\.\d+)?)/.exec(n)?.[1] ?? 0);
  const byVer = (a: string, b: string) => ver(b) - ver(a);
  const flash = names.filter((n) => /^gemini-[\d.]+-flash$/.test(n)).sort(byVer);
  const lite = names.filter((n) => /^gemini-[\d.]+-flash-lite$/.test(n)).sort(byVer);
  const pinned = Deno.env.get("GEMINI_MODEL");
  const all = [...(pinned ? [pinned] : []), ...flash, ...lite];
  geminiModels = [...new Set(all.length ? all : ["gemini-2.5-flash"])].slice(0, 4);
  return geminiModels;
}
class GeminiError extends Error {
  constructor(public status: number) {
    super(`gemini ${status}`);
  }
}
// نفس الشكل بس بصيغة جوجل (nullable بدل anyOf)
function geminiSchema(x: any): any {
  if (Array.isArray(x)) return x.map(geminiSchema);
  if (!x || typeof x !== "object") return x;
  if (x.anyOf) {
    const t = x.anyOf.find((a: any) => a.type !== "null");
    return { ...geminiSchema(t), nullable: true, ...(x.description ? { description: x.description } : {}) };
  }
  const out: any = {};
  for (const [k, v] of Object.entries(x)) if (k !== "additionalProperties") out[k] = geminiSchema(v);
  return out;
}
// تفكير قليل = رد أسرع (القراية مش محتاجة تفكير طويل)
const lightThinking = (model: string) =>
  /^gemini-2\.5-flash/.test(model) ? { thinkingConfig: { thinkingBudget: 0 } } : /^gemini-(\d+)/.exec(model) && Number(/^gemini-(\d+)/.exec(model)![1]) >= 3 ? { thinkingConfig: { thinkingLevel: "low" } } : {};
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function readWithGemini(key: string, image: string, mediaType: string, text: string) {
  const started = Date.now();
  const left = () => 125_000 - (Date.now() - started);
  const models = await listGeminiModels(key);
  let last = 503;
  for (const model of models) {
    // كامل (الشكل + تفكير قليل) ← لو اترفض (400): من غيرهم، والشكل في الكلام بس
    for (const full of [true, false]) {
      if (left() < 8_000) throw new GeminiError(last);
      let res: Response;
      try {
        res = await fetch(`${GEMINI}/models/${model}:generateContent`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": key },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: SYSTEM }] },
            contents: [{ role: "user", parts: [{ inline_data: { mime_type: mediaType, data: image } }, { text }] }],
            generationConfig: { responseMimeType: "application/json", temperature: 0, ...(full ? { responseSchema: geminiSchema(SCHEMA), ...lightThinking(model) } : {}) },
          }),
          signal: AbortSignal.timeout(Math.min(60_000, left() - 3_000)),
        });
      } catch (e) {
        if ((e as Error)?.name !== "TimeoutError") throw e;
        console.warn(`gemini ${model}: timeout`);
        last = 504;
        break; // الموديل ده بطيء ← اللي بعده
      }
      if (res.ok) {
        const j = await res.json();
        const parts = j.candidates?.[0]?.content?.parts ?? [];
        return {
          model,
          text: parts.map((p: { text?: string }) => (p as { thought?: boolean }).thought ? "" : p.text ?? "").join(""),
          blocked: !parts.length,
          inTokens: j.usageMetadata?.promptTokenCount ?? null,
          outTokens: j.usageMetadata?.candidatesTokenCount ?? null,
        };
      }
      last = res.status;
      console.warn(`gemini ${model}: ${res.status} ${(await res.text()).slice(0, 300)}`);
      if (res.status === 400 && full) continue;
      if (res.status === 401 || res.status === 403) throw new GeminiError(res.status);
      if (res.status === 404) geminiModels = null;
      await wait(1_500); // مشغول (503/429) أو مش موجود ← استنى شوية وجرب الموديل اللي بعده
      break;
    }
  }
  throw new GeminiError(last);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return fail("method", 405);
  let b: { key?: string; deviceId?: string; image?: string; mediaType?: string; month?: string; hint?: string };
  try {
    b = await req.json();
  } catch {
    return fail("bad_request", 400);
  }
  try {
    // جهاز شغال على كود شغال
    const [lic] = await sql`
      select l.id, coalesce(l.data_from, l.id) as owner
      from public.licenses l join public.license_devices d on d.license_id = l.id
      where l.key = licensing.normalize_key(${b.key ?? ""}) and d.device_id = ${b.deviceId ?? ""}
        and not l.revoked and not d.revoked
        and (l.expires_at is null or l.expires_at >= (now() at time zone 'Africa/Cairo')::date)`;
    if (!lic) return fail("license");
    const [{ n }] = await sql`select count(*)::int as n from licensing.ai_usage a join public.licenses l on l.id = a.license_id
                               where coalesce(l.data_from, l.id) = ${lic.owner} and a.at > now() - interval '1 day'`;
    if (n >= DAILY_LIMIT) return fail("limit");

    const mediaType = /^image\/(jpeg|png|webp|gif)$/.test(b.mediaType ?? "") ? (b.mediaType as "image/jpeg") : "image/jpeg";
    const image = String(b.image ?? "").replace(/^data:[^,]+,/, "");
    if (!image) return fail("no_image");
    if (image.length * 0.75 > MAX_IMAGE_BYTES) return fail("too_big");

    const ask = `اقرا السركي ده.${b.month ? ` الشهر اللي المستخدم فاتحه في البرنامج: ${b.month}.` : ""}${b.hint ? ` ${String(b.hint).slice(0, 300)}` : ""}`;
    const geminiKey = Deno.env.get("GEMINI_API_KEY");
    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    let text: string;
    if (geminiKey) {
      const g = await readWithGemini(geminiKey, image, mediaType, `${ask}\nرجّع JSON بس بالشكل ده: ${JSON.stringify(SCHEMA)}`);
      await sql`insert into licensing.ai_usage (license_id, device_id, kind, input_tokens, output_tokens, ok)
                values (${lic.id}, ${b.deviceId ?? null}, ${"gemini:" + g.model}, ${g.inTokens}, ${g.outTokens}, ${!g.blocked})`;
      if (g.blocked) return fail("refused");
      text = g.text;
    } else if (apiKey) {
      const client = new Anthropic({ apiKey, timeout: 110_000, maxRetries: 1 });
      const res = await client.beta.messages.create({
        model: "claude-opus-5-5",
        max_tokens: 16000,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        system: SYSTEM,
        output_config: { effort: "medium", format: { type: "json_schema", schema: SCHEMA } },
        messages: [{ role: "user", content: [{ type: "image", source: { type: "base64", media_type: mediaType, data: image } }, { type: "text", text: ask }] }],
      });
      await sql`insert into licensing.ai_usage (license_id, device_id, input_tokens, output_tokens, ok)
                values (${lic.id}, ${b.deviceId ?? null}, ${res.usage?.input_tokens ?? null}, ${res.usage?.output_tokens ?? null}, ${res.stop_reason !== "refusal"})`;
      if (res.stop_reason === "refusal") return fail("refused");
      if (res.stop_reason === "max_tokens") return fail("too_long");
      text = res.content.map((c) => (c.type === "text" ? c.text : "")).join("");
    } else return fail("not_configured");
    let out: unknown;
    try {
      out = JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, ""));
    } catch {
      return fail("unreadable");
    }
    return json({ ok: true, sheet: out });
  } catch (e) {
    console.error(e);
    if (e instanceof GeminiError) return fail(e.status === 401 || e.status === 403 ? "bad_key" : e.status === 429 || e.status >= 500 ? "busy" : "ai_error", 502);
    if (e instanceof Anthropic.APIError) return fail(e.status === 429 || (e.status ?? 0) >= 500 ? "busy" : "ai_error", 502);
    if ((e as Error)?.name === "TimeoutError") return fail("busy", 502);
    return fail("server", 500);
  }
});
