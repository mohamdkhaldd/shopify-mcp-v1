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
// بنختار أحدث موديل "flash" ثابت متاح للمفتاح (أو GEMINI_MODEL لو اتحدد)،
// عشان أسماء الموديلات بتتغير.
const GEMINI = "https://generativelanguage.googleapis.com/v1beta";
let geminiModel: string | null = Deno.env.get("GEMINI_MODEL") ?? null;
async function pickGeminiModel(key: string) {
  if (geminiModel) return geminiModel;
  const res = await fetch(`${GEMINI}/models?pageSize=200`, { headers: { "x-goog-api-key": key } });
  if (!res.ok) throw new GeminiError(res.status);
  const list = ((await res.json()).models ?? []) as { name: string; supportedGenerationMethods?: string[] }[];
  const ver = (n: string) => Number(/gemini-(\d+(?:\.\d+)?)/.exec(n)?.[1] ?? 0);
  const ok = list
    .map((m) => m.name.replace(/^models\//, ""))
    .filter((n, i) => list[i].supportedGenerationMethods?.includes("generateContent"))
    .filter((n) => /^gemini-[\d.]+-flash$/.test(n));
  ok.sort((a, b) => ver(b) - ver(a));
  geminiModel = ok[0] ?? "gemini-2.5-flash";
  return geminiModel;
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
async function readWithGemini(key: string, image: string, mediaType: string, text: string) {
  const model = await pickGeminiModel(key);
  const body = (schema: boolean) => ({
    systemInstruction: { parts: [{ text: SYSTEM }] },
    contents: [{ role: "user", parts: [{ inline_data: { mime_type: mediaType, data: image } }, { text }] }],
    generationConfig: { responseMimeType: "application/json", temperature: 0, ...(schema ? { responseSchema: geminiSchema(SCHEMA) } : {}) },
  });
  const send = (schema: boolean) =>
    fetch(`${GEMINI}/models/${model}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify(body(schema)),
      signal: AbortSignal.timeout(110_000),
    });
  let res = await send(true);
  if (res.status === 400) res = await send(false); // موديل مش بيقبل الشكل ← الشكل في الكلام بس
  if (!res.ok) {
    if (res.status === 404) geminiModel = null;
    throw new GeminiError(res.status);
  }
  const j = await res.json();
  const parts = j.candidates?.[0]?.content?.parts ?? [];
  return {
    text: parts.map((p: { text?: string }) => p.text ?? "").join(""),
    blocked: !parts.length,
    inTokens: j.usageMetadata?.promptTokenCount ?? null,
    outTokens: j.usageMetadata?.candidatesTokenCount ?? null,
  };
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
                values (${lic.id}, ${b.deviceId ?? null}, 'sarki-gemini', ${g.inTokens}, ${g.outTokens}, ${!g.blocked})`;
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
    if (e instanceof GeminiError) return fail(e.status === 429 || e.status >= 500 ? "busy" : "ai_error", 502);
    if (e instanceof Anthropic.APIError) return fail(e.status === 429 || (e.status ?? 0) >= 500 ? "busy" : "ai_error", 502);
    if ((e as Error)?.name === "TimeoutError") return fail("busy", 502);
    return fail("server", 500);
  }
});
