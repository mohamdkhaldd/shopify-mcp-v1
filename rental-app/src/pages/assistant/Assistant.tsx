import { useEffect, useRef, useState } from "react";
import { api, shellApi } from "../../api/client";
import type { AssistantAction } from "../../../core/ai/assistant";
import { Button, PageHeader } from "../../components/ui";
import { TextInput } from "../../components/Field";
import { catalogText, PAGES } from "../../../core/ai/catalog";
import { footerItems, navItems, OPEN_EVENT, OpenRequest, SectionId } from "../../nav";
import type { AssistantCard, AssistantChart } from "../../../core/license/manager";
import { Cards, Chart } from "./Visuals";
import { appApi } from "../../api/client";
import type { ChatRow } from "../../../core/services/team";
import { photoForReading, ReadSheet } from "../../../core/ai/sarkiRead";
import { ReadPhoto } from "../sarki/ReadPhoto";
import type { OpenSarki } from "../../api/client";
import { MAX_SECONDS, Recording, startRecording } from "./voice";

// المساعد: تكتب اللي حصل بالعامية، والذكاء الاصطناعي يفهمه ويقولك هيسجل إيه.
// مفيش حاجة بتتسجل غير لما تدوس «سجّل»، والتسجيل بيتعمل بنفس دوال البرنامج
// (فيه تراجع زي أي تعديل تاني من سجل التعديلات). المسح بباسورد الشركة بس.
// بيجاوب كمان على "إزاي أعمل كذا" وعلى أسئلة الأرقام (كسبت كام، النسبة…).
// المحادثة واحدة لكل الشركاء (team_chat — بتتزامن)، وكل رسالة عليها اسم اللي كتبها،
// وكل تعديل بيتسجل باسم الشريك (team_log). كل جهاز عليه اسم الشريك اللي بيستخدمه.
// يقدر يعمل أي حاجة في البرنامج (core/ai/catalog.ts): يقرا أي رقم لوحده (من غير
// ما يسأل)، ويضيف ويعدّل ويمسح بعد ما يقولك هيعمل إيه وتوافق، ويفتح أي صفحة ويطلع PDF.

type Meta = { id?: number; who?: string | null };
/** صورة سركي اتقرت: العقد والشهر واللي اتقرا — بيتراجع في الشات ويتسجل */
type SarkiRead = { contractId: number; month: string; sheet: ReadSheet; title?: string };
type Msg =
  | ({ role: "user"; text: string; photo?: boolean } & Meta)
  | ({
      role: "assistant";
      text: string;
      actions?: AssistantAction[];
      lines?: string[];
      problem?: string;
      state?: "pending" | "saved" | "cancelled" | "error";
      /** صفحات يفتحها (وممكن PDF) */
      opens?: AssistantAction[];
      /** قرا إيه عشان يجاوب */
      looked?: string[];
      cards?: AssistantCard[];
      chart?: AssistantChart | null;
      /** رسايل واتساب جاهزة */
      sends?: AssistantAction[];
      sarki?: SarkiRead;
    } & Meta);

const thisMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

/** مراجعة السركي اللي اتقرا من الصورة جوه الشات (نفس شاشة صفحة السركي) */
function SarkiReview({ r, onDone, onCancel }: { r: SarkiRead; onDone: (msg: string) => void; onCancel: () => void }) {
  const [v, setV] = useState<OpenSarki | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  useEffect(() => {
    api.sarki(r.contractId, r.month).then(
      (x) => (x.contract ? setV(x as OpenSarki) : setProblem("العقد ده مش موجود")),
      (e) => setProblem((e as Error).message),
    );
  }, [r.contractId, r.month]);
  if (problem) return <div className="text-sm font-semibold text-out">{problem}</div>;
  if (!v) return <div className="text-sm text-muted">بيجهز السركي…</div>;
  if (v.closed) return <div className="text-sm font-semibold text-out">شهر {r.month} مقفول — مينفعش يتسجل عليه أيام</div>;
  // السركي بيفتح أقرب شهر للعقد لو الشهر المطلوب برا مدته — ساعتها منسجلش على شهر غلط
  if (v.month !== r.month)
    return (
      <div className="text-sm font-semibold text-out">
        العقد ده ({v.contract.equipment} — {v.contract.client}) مش شغال في شهر {r.month} — اتأكد من الشهر أو من تاريخ بداية العقد ونهايته، وابعت الصورة تاني.
      </div>
    );
  return (
    <div className="rounded-xl border border-line bg-surface -mx-2">
      <div className="px-4 pt-3 text-sm font-bold">
        سركي {v.contract.equipment} — {v.contract.client} — شهر {r.month}
      </div>
      <ReadPhoto v={v} initialSheet={r.sheet} onDone={onDone} onError={setProblem} onCancel={onCancel} />
    </div>
  );
}

const pageLabel = (id: string) => [...navItems, ...footerItems].find((i) => i.id === id)?.label ?? id;
const READ_LABEL: Record<string, string> = {
  dashboard: "الرئيسية",
  sarki: "السركي",
  contractOptions: "العقود",
  suppliers: "أصحاب المعدات",
  partySheet: "حساب العقد",
  clients: "الشركات",
  drivers: "السواقين",
  management: "الإدارة",
  investors: "المستثمرين",
  treasury: "الخزنة",
  accounts: "حسابات الخزنة",
  tax: "الضرايب",
  activity: "سجل التعديلات",
  teamLog: "اللي عمله الشركاء",
  settings: "الإعدادات",
  deletePreview: "اللي هيتمسح",
};
const open = (a: AssistantAction) => {
  if (!a.page || !(PAGES as readonly string[]).includes(a.page)) return;
  const detail: OpenRequest = { page: a.page as SectionId, id: a.id ?? undefined, month: a.month ?? undefined, pdf: !!a.pdf, tab: a.tab ?? undefined };
  window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail }));
};

// كل محادثة ليها رقم، والمحادثات كلها متحفظة (زي أي شات AI) — آخر واحدة فتحتها على الجهاز ده بتفتح تاني
const CONV = "mk-assistant-conv";
const newConv = () => `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
const savedConv = () => {
  try {
    return localStorage.getItem(CONV) || "old";
  } catch {
    return "old";
  }
};
const rememberConv = (c: string) => {
  try {
    localStorage.setItem(CONV, c);
  } catch {
    /* مش مهم */
  }
};
/** اللي المساعد يفتكره من المحادثة: الكلام + اللي اتعمل فعلاً (أو لسه مستني موافقة) */
const memoryOf = (m: Msg) => {
  if (m.role === "user") return m.who ? `${m.who}: ${m.text}${m.photo ? " (مع صورة سركي)" : ""}` : m.text;
  const done = m.lines?.length ? `\n[${m.state === "saved" ? "اتعمل" : m.state === "cancelled" ? "اتلغى" : m.state === "pending" ? "مستني موافقة" : "متعملش"}: ${m.lines.join("؛ ")}]` : "";
  const problem = m.problem ? `\n[مشكلة: ${m.problem}]` : "";
  return `${m.text}${done}${problem}`;
};
const extraOf = (m: Msg) => {
  if (m.role !== "assistant") return null;
  const { role: _r, text: _t, id: _i, who: _w, ...rest } = m;
  return rest;
};
const fromRow = (r: ChatRow): Msg =>
  r.role === "user" ? { role: "user", text: r.text, id: r.id, who: r.who } : { ...((r.extra as object) ?? {}), role: "assistant", text: r.text, id: r.id, who: r.who };

const EXAMPLES = [
  "دخلت لودر ٩٥٠ صاحبه محمد علي لشركة النور في التجمع، الشركة بـ ١٥٠٠ في اليوم وصاحبه ياخد ١٢٠٠ من أول الشهر",
  "صرفت ٢٠٠٠ للسواق أحمد سلفة، وجبت زيت هيدروليك بـ ١٥٠٠ للودر بتاع محمد",
  "شركة النور دفعت ٣٠ ألف انستا باي",
  "اللودر اشتغل من ١ لحد ١٠ الشهر ده",
  "كسبت كام الشهر ده؟ ومكسبي كام في المية على فلوسي؟",
  "إزاي أعمل عقد جديد؟",
  "ابعت لمحمد علي حسابه كله (التصفية والسركي) على الواتساب",
  "محمد علي ناقصله كام؟ وآخر مرة دفعتله امتى؟",
  "وريني الربح شهر بشهر",
  "غيّر تليفون صاحب المعدة محمد علي لـ 01012345678",
];

const PASSWORD_FNS = new Set(["delete", "closeMonth", "setRates", "setWithholding", "adjustment"]);
const needsPassword = (actions?: AssistantAction[]) => !!actions?.some((a) => a.type === "delete" || (a.type === "call" && PASSWORD_FNS.has(String(a.fn))));
const isDelete = (actions?: AssistantAction[]) => !!actions?.some((a) => a.type === "delete" || (a.type === "call" && a.fn === "delete"));

export default function Assistant() {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  // صورة سركي مرفقة مع الرسالة الجاية
  const [photo, setPhoto] = useState<{ image: string; mediaType: string; url: string } | null>(null);
  const photoInput = useRef<HTMLInputElement>(null);
  async function pickPhoto(f?: File) {
    if (!f) return;
    try {
      const p = await photoForReading(f);
      setPhoto({ ...p, url: `data:${p.mediaType};base64,${p.image}` });
    } catch (e) {
      alert((e as Error).message);
    } finally {
      if (photoInput.current) photoInput.current.value = "";
    }
  }
  // الصوت: دوسة تبدأ، ودوسة توقف — والكلام بيتكتب ويتبعت على طول
  const [rec, setRec] = useState<Recording | null>(null);
  const [recSec, setRecSec] = useState(0);
  const [hearing, setHearing] = useState(false);
  const [voiceNote, setVoiceNote] = useState<string | null>(null);
  useEffect(() => {
    if (!rec) return;
    const t = setInterval(() => setRecSec((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, [rec]);
  async function toggleVoice() {
    setVoiceNote(null);
    if (!rec) {
      try {
        setRecSec(0);
        setRec(await startRecording());
      } catch (e) {
        setVoiceNote((e as Error).message);
      }
      return;
    }
    const r = rec;
    setRec(null);
    setHearing(true);
    try {
      const audio = await r.stop();
      if (audio.seconds < 0.7) throw new Error("التسجيل قصير أوي — دوس واتكلم وبعدين دوس تاني");
      const ctx = await api.assistantContext().catch(() => null);
      const hint = ctx
        ? [...ctx.suppliers.map((x) => x.name), ...ctx.clients.map((x) => x.name), ...ctx.equipment.map((x) => x.name), ...ctx.drivers.map((x) => x.name), ...ctx.partners].slice(0, 300).join("، ")
        : undefined;
      const t = await shellApi.transcribe(audio.data, audio.mediaType, hint);
      if (!t.ok) throw new Error(t.message);
      if (!t.text) throw new Error("مسمعتش كلام — جرّب تاني");
      setHearing(false);
      await send(t.text);
    } catch (e) {
      setVoiceNote((e as Error).message);
    } finally {
      setHearing(false);
    }
  }
  // لو وصل للحد الأقصى بيقف لوحده
  useEffect(() => {
    if (rec && recSec >= MAX_SECONDS) toggleVoice();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recSec]);
  const [password, setPassword] = useState("");
  const [me, setMe] = useState<string | null | undefined>(undefined);
  const [names, setNames] = useState<string[]>([]);
  const [meDraft, setMeDraft] = useState("");
  const busyRef = useRef(false);
  const [conv, setConv] = useState(savedConv);
  const convRef = useRef(conv);
  const [convs, setConvs] = useState<{ conv: string; last: string; count: number; title: string | null; who: string | null }[]>([]);
  const [showList, setShowList] = useState(false);
  const load = () => {
    const c = convRef.current;
    api.chatList(c, 300).then(
      (rows) => {
        if (busyRef.current || convRef.current !== c) return;
        setMsgs((cur) => [...rows.map(fromRow), ...cur.filter((m) => m.id == null)]);
      },
      () => {},
    );
    api.chatConversations().then(setConvs, () => {});
  };
  const openConv = (c: string) => {
    if (busyRef.current) return;
    convRef.current = c;
    setConv(c);
    rememberConv(c);
    setMsgs([]);
    setShowList(false);
    load();
  };
  useEffect(() => {
    api.me().then(setMe, () => setMe(null));
    api.teamNames().then(setNames, () => {});
    load();
    // رسايل الشركاء التانيين بتوصل بالمزامنة
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  /** رسالة جديدة: تظهر على طول، وتتحفظ للكل */
  const push = async (m: Msg) => {
    setMsgs((cur) => [...cur, { ...m, who: me ?? null }]);
    try {
      const id = await api.chatAdd(m.role, m.text, extraOf(m), convRef.current);
      api.chatConversations().then(setConvs, () => {});
      setMsgs((cur) => cur.map((x) => (x === m || (x.id == null && x.text === m.text && x.role === m.role) ? { ...x, id } : x)));
    } catch {
      /* لو متحفظتش بتفضل ظاهرة هنا */
    }
  };
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  // بين قوسين: scrollIntoView في Chrome الجديد بيرجّع Promise، وReact فاكره cleanup
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [msgs, busy]);

  const update = (i: number, patch: Partial<Extract<Msg, { role: "assistant" }>>) =>
    setMsgs((m) =>
      m.map((x, j) => {
        if (j !== i || x.role !== "assistant") return x;
        const next = { ...x, ...patch };
        if (next.id != null) api.chatUpdate(next.id, extraOf(next)).catch(() => {});
        return next;
      }),
    );

  async function send(said = text) {
    const pic = photo;
    const t = said.trim() || (pic ? "ده سركي — اقراه" : "");
    if (!t || busy || !me) return;
    setText("");
    // الرسايل القديمة باسم اللي كتبها (المحادثة مشتركة بين الشركاء)
    // ذاكرة المحادثة: المحادثة كلها (لحد ١٠٠ رسالة / حوالي ٨٠ ألف حرف)، ومعاها اللي اتعمل فعلاً
    const all = msgs.slice(-100).map((m) => ({ role: m.role, text: memoryOf(m).slice(0, 3000) }));
    let size = 0;
    const history = all.reverse().filter((m) => (size += m.text.length) <= 80_000).reverse();
    setBusy(true);
    busyRef.current = true;
    await push({ role: "user", text: t, ...(pic ? { photo: true } : {}) });
    try {
      const [ctxNames, facts] = await Promise.all([api.assistantContext(), api.assistantFacts()]);
      const context = { ...ctxNames, facts };
      const catalog = catalogText();
      // لو محتاج يقرا حاجة (تصفية، خزنة، سركي…) البرنامج بيقراها ويبعتهاله، لحد ٤ مرات
      const reads: { fn: string; args?: unknown; result: unknown }[] = [];
      const looked: string[] = [];
      let r = await shellApi.askAssistant({ text: pic ? `${t}\n(مع الرسالة صورة ورقة سركي)` : t, context, history, catalog, ...(pic ? { image: pic.image, mediaType: pic.mediaType } : {}) });
      for (let round = 0; r.ok && round < 4; round++) {
        const want = r.actions.filter((a) => a.type === "read" && a.fn).slice(0, 6);
        if (!want.length) break;
        for (const a of want) {
          let result: unknown;
          try {
            result = JSON.stringify(await api.assistantRead(a.fn!, a.args ?? {})).slice(0, 30_000);
          } catch (e) {
            result = { error: (e as Error).message };
          }
          reads.push({ fn: a.fn!, args: a.args, result });
          looked.push(READ_LABEL[a.fn!] ?? a.fn!);
        }
        r = await shellApi.askAssistant({ text: t, context, history, catalog, reads });
      }
      if (!r.ok) {
        await push({ role: "assistant", text: r.message, state: "error" });
        return;
      }
      // صورة سركي: المساعد عرف العقد → البرنامج يقرا الورقة ويعرضها للمراجعة قبل ما تتسجل
      const sp = pic ? r.actions.find((a) => a.type === "sarki_photo" && a.id) : undefined;
      if (sp && pic) {
        const c = ctxNames.contracts.find((x) => x.id === sp.id);
        const read = await shellApi.readSarki({ image: pic.image, mediaType: pic.mediaType, month: sp.month ?? undefined, hint: c ? `المعدة: ${c.equipment}. الشركة: ${c.client}. صاحب المعدة: ${c.supplier}.` : undefined });
        if (!read.ok) {
          await push({ role: "assistant", text: read.message, state: "error" });
          return;
        }
        if (!read.sheet.days.length) {
          await push({ role: "assistant", text: "ملقتش أيام في الصورة دي — صوّر الورقة كلها بوضوح وابعتها تاني", state: "error" });
          return;
        }
        const month = sp.month && /^\d{4}-\d{2}$/.test(sp.month) ? sp.month : (read.sheet.month ?? thisMonth());
        setPhoto(null);
        await push({ role: "assistant", text: r.reply || "قريت الورقة — راجعها ولو تمام دوس «سجّل»", sarki: { contractId: sp.id!, month, sheet: read.sheet }, state: "pending", cards: r.cards });
        return;
      }
      const opens = r.actions.filter((a) => a.type === "open" && a.page);
      const sends = r.actions.filter((a) => a.type === "whatsapp" && a.text);
      const todo = r.actions.filter((a) => a.type !== "read" && a.type !== "open" && a.type !== "whatsapp" && a.type !== "sarki_photo");
      const seen = looked.length ? [...new Set(looked)] : undefined;
      const extras = { opens, sends, looked: seen, cards: r.cards, chart: r.chart };
      if (!todo.length) {
        await push({ role: "assistant", text: r.reply || "مفهمتش — اكتبها تاني بتفاصيل أكتر", ...extras });
        return;
      }
      // قبل ما يتسجل: البرنامج يجرّب ويقول هيعمل إيه بالظبط
      const p = await api.assistantPreview(todo);
      await push(
        p.ok
          ? { role: "assistant", text: r.reply, actions: todo, lines: p.lines, state: "pending", ...extras }
          : { role: "assistant", text: r.reply, actions: todo, problem: p.message, state: "error", ...extras },
      );
    } catch (e) {
      await push({ role: "assistant", text: (e as Error).message, state: "error" });
    } finally {
      setBusy(false);
      busyRef.current = false;
    }
  }

  async function save(i: number) {
    const m = msgs[i];
    if (m.role !== "assistant" || !m.actions) return;
    setBusy(true);
    try {
      const deleting = needsPassword(m.actions);
      if (deleting && !password) throw new Error("اكتب باسورد الشركة عشان تمسح");
      const lines = await api.assistantApply(m.actions, m.text || (m.lines ?? []).join("، "), deleting ? password : undefined);
      setPassword("");
      update(i, { state: "saved", lines });
    } catch (e) {
      update(i, { state: "error", problem: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-4">
      <PageHeader title="المساعد" subtitle="اكتب اللي حصل بالعامية، أو اسأله عن أي رقم أو إزاي تعمل حاجة">
        <Button onClick={() => setShowList((x) => !x)}>المحادثات{convs.length > 1 ? ` (${convs.length})` : ""}</Button>
        {msgs.length > 0 && (
          <Button primary onClick={() => openConv(newConv())} disabled={busy}>
            + محادثة جديدة
          </Button>
        )}
      </PageHeader>

      {showList && (
        <div className="rounded-card border border-line bg-surface p-2 grid gap-1 max-h-[40vh] overflow-y-auto">
          {convs.length === 0 && <div className="text-sm text-muted p-2">لسه مفيش محادثات.</div>}
          {convs.map((c) => (
            <button
              key={c.conv}
              onClick={() => openConv(c.conv)}
              className={`text-start rounded-xl px-3 py-2 hover:bg-amber-soft ${c.conv === conv ? "bg-amber-soft font-bold" : ""}`}
            >
              <div className="truncate">{c.title ?? "محادثة"}</div>
              <div className="text-xs text-muted">
                {c.who ? `${c.who} · ` : ""}
                {new Date(c.last).toLocaleString("ar-EG", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })} · {c.count} رسالة
              </div>
            </button>
          ))}
        </div>
      )}

      {me === null && (
        <div className="rounded-card border-2 border-amber bg-amber-soft p-4 grid gap-3">
          <b>انت مين من الشركاء؟</b>
          <div className="text-sm text-muted">اسمك بيتكتب على كل رسالة وكل تعديل تعمله من الجهاز ده، و«من جيبي» بتتسجل عليك.</div>
          {names.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {names.map((n) => (
                <Button key={n} onClick={() => api.setMe(n).then(setMe)}>
                  {n}
                </Button>
              ))}
            </div>
          )}
          <div className="flex gap-2 items-center">
            <TextInput value={meDraft} onChange={(e) => setMeDraft(e.target.value)} placeholder="اكتب اسمك" className="max-w-[240px]" />
            <Button primary disabled={!meDraft.trim()} onClick={() => api.setMe(meDraft).then(setMe)}>
              حفظ
            </Button>
          </div>
        </div>
      )}
      {me && (
        <div className="text-sm text-muted -mt-2">
          بتكلم باسم <b className="text-fg">{me}</b> —{" "}
          <button className="text-amber-deep font-bold hover:underline" onClick={() => setMe(null)}>
            مش انت؟
          </button>
        </div>
      )}

      <div className="rounded-card border border-line bg-surface min-h-[55vh] max-h-[65vh] overflow-y-auto p-4 grid content-start gap-3">
        {!msgs.length && (
          <div className="grid gap-2 text-sm">
            <div className="text-muted">جرّب مثلاً:</div>
            {EXAMPLES.map((ex) => (
              <button key={ex} onClick={() => send(ex)} className="text-start rounded-xl border border-line px-3 py-2 hover:border-amber hover:bg-amber-soft">
                {ex}
              </button>
            ))}
          </div>
        )}
        {msgs.map((m, i) =>
          m.role === "user" ? (
            <div key={i} className="justify-self-start max-w-[85%] grid gap-0.5">
              {m.who && <span className="text-xs font-bold text-amber-deep">{m.who === me ? `${m.who} (انت)` : m.who}</span>}
              <div className="rounded-2xl rounded-ss-sm bg-amber-soft px-4 py-2.5 whitespace-pre-wrap">
                {m.photo && <span className="block text-xs font-bold text-amber-deep mb-1">📷 صورة سركي</span>}
                {m.text}
              </div>
            </div>
          ) : (
            <div key={i} className="justify-self-end max-w-[90%] w-full sm:w-auto rounded-2xl rounded-se-sm border border-line bg-surface-2 px-4 py-3 grid gap-2">
              {m.looked && <div className="text-xs text-muted">قريت: {m.looked.join("، ")}</div>}
              {m.text && <div className="whitespace-pre-wrap">{m.text}</div>}
              {m.cards && m.cards.length > 0 && <Cards cards={m.cards} />}
              {m.chart && <Chart chart={m.chart} />}
              {m.lines && m.lines.length > 0 && (
                <ul className="grid gap-1 text-sm list-none p-0 m-0">
                  {m.lines.map((l, k) => (
                    <li key={k} className="flex gap-2">
                      <span className={m.state === "saved" ? "text-in" : "text-muted"}>{m.state === "saved" ? "✓" : "•"}</span>
                      <span>{l}</span>
                    </li>
                  ))}
                </ul>
              )}
              {m.problem && <div className="text-sm font-semibold text-out">{m.problem}</div>}
              {m.opens && m.opens.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {m.opens.map((a, k) => (
                    <Button key={k} onClick={() => open(a)}>
                      {a.pdf ? `PDF — ${a.tab === "full" ? "الملف الكامل" : pageLabel(a.page!)}` : `افتح ${pageLabel(a.page!)}`}
                    </Button>
                  ))}
                </div>
              )}
              {m.sends && m.sends.length > 0 && (
                <div className="grid gap-2">
                  {m.sends.map((a, k) => (
                    <div key={k} className="rounded-xl border border-line bg-surface p-3 grid gap-2">
                      <div className="whitespace-pre-wrap text-sm">{a.text}</div>
                      <div>
                        <Button primary onClick={() => appApi.whatsapp(a.phone, a.text!)}>
                          ابعت واتساب{a.phone ? ` لـ ${a.phone}` : ""}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {m.state === "pending" && needsPassword(m.actions) && (
                <label className="grid gap-1 text-sm">
                  <span className="font-semibold text-out">{isDelete(m.actions) ? "ده مسح" : "دي حاجة مبترجعش"} — اكتب باسورد الشركة:</span>
                  <TextInput type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="off" className="max-w-[220px]" />
                </label>
              )}
              {m.sarki && m.state === "pending" && (
                <SarkiReview r={m.sarki} onDone={(msg) => update(i, { state: "saved", lines: [msg] })} onCancel={() => update(i, { state: "cancelled" })} />
              )}
              {m.state === "pending" && !m.sarki && (
                <div className="flex gap-2 pt-1">
                  <Button primary danger={needsPassword(m.actions)} onClick={() => save(i)} disabled={busy}>
                    {isDelete(m.actions) ? "امسح" : "نفّذ"}
                  </Button>
                  <Button onClick={() => update(i, { state: "cancelled" })} disabled={busy}>
                    لأ
                  </Button>
                </div>
              )}
              {m.state === "saved" && <div className="text-sm font-bold text-in">اتسجل — ولو فيه غلطة ترجعه من «سجل التعديلات»</div>}
              {m.state === "cancelled" && <div className="text-sm text-muted">اتلغى — مفيش حاجة اتسجلت</div>}
              {m.state === "error" && m.actions && <div className="text-sm text-muted">مفيش حاجة اتسجلت — صحّح واكتبها تاني</div>}
            </div>
          ),
        )}
        {busy && <div className="justify-self-end text-muted text-sm">بيفكر…</div>}
        <div ref={end} />
      </div>

      {(rec || hearing || voiceNote) && (
        <div className={`rounded-xl px-3 py-2 text-sm font-semibold ${voiceNote ? "bg-out-soft text-out" : "bg-amber-soft"}`}>
          {voiceNote ?? (rec ? `🔴 بيسجل… اتكلم عادي ودوس ⏹ لما تخلص (لحد ${MAX_SECONDS} ثانية)` : "بيكتب اللي قلته…")}
        </div>
      )}
      {photo && (
        <div className="flex items-center gap-3 rounded-xl border border-amber bg-amber-soft px-3 py-2">
          <img src={photo.url} alt="صورة السركي" className="h-16 w-16 object-cover rounded-md" />
          <div className="text-sm flex-1">
            <b>صورة سركي جاهزة</b>
            <div className="text-muted">اكتب ده سركي أنهي معدة (وصاحبها والشركة أو مقاول الباطن) وابعت</div>
          </div>
          <Button onClick={() => setPhoto(null)}>شيلها</Button>
        </div>
      )}
      <div className="flex gap-2 items-end">
        <input ref={photoInput} type="file" accept="image/*" className="hidden" onChange={(e) => pickPhoto(e.target.files?.[0])} />
        <Button onClick={() => photoInput.current?.click()} disabled={busy || !me || !!rec} title="صورة سركي">
          📷
        </Button>
        <Button danger={!!rec} onClick={toggleVoice} disabled={(busy && !rec) || hearing || !me} title="اتكلم بدل ما تكتب">
          {rec ? `⏹ ${recSec}ث` : hearing ? "…" : "🎤"}
        </Button>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          rows={2}
          placeholder={photo ? "مثلاً: ده سركي اللودر بتاع محمد علي في شركة النور" : "مثلاً: صرفت ٥٠٠ سولار للبوكلين النهارده"}
          className="flex-1 resize-none rounded-xl border border-line bg-surface px-3 py-2.5 text-[15px] focus:outline-none focus:border-amber"
        />
        <Button primary onClick={() => send()} disabled={busy || (!text.trim() && !photo) || !me}>
          ابعت
        </Button>
      </div>
    </div>
  );
}
