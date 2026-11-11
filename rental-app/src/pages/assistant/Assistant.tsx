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

// المساعد: تكتب اللي حصل بالعامية، والذكاء الاصطناعي يفهمه ويقولك هيسجل إيه.
// مفيش حاجة بتتسجل غير لما تدوس «سجّل»، والتسجيل بيتعمل بنفس دوال البرنامج
// (فيه تراجع زي أي تعديل تاني من سجل التعديلات). المسح بباسورد الشركة بس.
// بيجاوب كمان على "إزاي أعمل كذا" وعلى أسئلة الأرقام (كسبت كام، النسبة…).
// المحادثة واحدة لكل الشركاء (team_chat — بتتزامن)، وكل رسالة عليها اسم اللي كتبها،
// وكل تعديل بيتسجل باسم الشريك (team_log). كل جهاز عليه اسم الشريك اللي بيستخدمه.
// يقدر يعمل أي حاجة في البرنامج (core/ai/catalog.ts): يقرا أي رقم لوحده (من غير
// ما يسأل)، ويضيف ويعدّل ويمسح بعد ما يقولك هيعمل إيه وتوافق، ويفتح أي صفحة ويطلع PDF.

type Meta = { id?: number; who?: string | null };
type Msg =
  | ({ role: "user"; text: string } & Meta)
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
    } & Meta);

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

// «محادثة جديدة» بتخفي القديم على الجهاز ده بس (المحادثة نفسها مشتركة)
const SINCE = "mk-assistant-since";
const since = () => {
  try {
    return Number(localStorage.getItem(SINCE) ?? 0) || 0;
  } catch {
    return 0;
  }
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
  const [password, setPassword] = useState("");
  const [me, setMe] = useState<string | null | undefined>(undefined);
  const [names, setNames] = useState<string[]>([]);
  const [meDraft, setMeDraft] = useState("");
  const busyRef = useRef(false);
  const load = () =>
    api.chatList(80).then(
      (rows) => {
        if (busyRef.current) return;
        const cut = since();
        setMsgs((cur) => [...rows.filter((r) => r.id > cut).map(fromRow), ...cur.filter((m) => m.id == null)]);
      },
      () => {},
    );
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
      const id = await api.chatAdd(m.role, m.text, extraOf(m));
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
    const t = said.trim();
    if (!t || busy || !me) return;
    setText("");
    // الرسايل القديمة باسم اللي كتبها (المحادثة مشتركة بين الشركاء)
    const history = msgs.slice(-8).map((m) => ({ role: m.role, text: m.role === "user" && m.who ? `${m.who}: ${m.text}` : m.text }));
    setBusy(true);
    busyRef.current = true;
    await push({ role: "user", text: t });
    try {
      const [ctxNames, facts] = await Promise.all([api.assistantContext(), api.assistantFacts()]);
      const context = { ...ctxNames, facts };
      const catalog = catalogText();
      // لو محتاج يقرا حاجة (تصفية، خزنة، سركي…) البرنامج بيقراها ويبعتهاله، لحد ٤ مرات
      const reads: { fn: string; args?: unknown; result: unknown }[] = [];
      const looked: string[] = [];
      let r = await shellApi.askAssistant({ text: t, context, history, catalog });
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
      const opens = r.actions.filter((a) => a.type === "open" && a.page);
      const sends = r.actions.filter((a) => a.type === "whatsapp" && a.text);
      const todo = r.actions.filter((a) => a.type !== "read" && a.type !== "open" && a.type !== "whatsapp");
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
        {msgs.length > 0 && (
          <Button
            onClick={() => {
              if (busy) return;
              try {
                localStorage.setItem(SINCE, String(Math.max(0, ...msgs.map((m) => m.id ?? 0))));
              } catch {
                /* مش مهم */
              }
              setMsgs([]);
            }}
            disabled={busy}
          >
            محادثة جديدة
          </Button>
        )}
      </PageHeader>

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
              <div className="rounded-2xl rounded-ss-sm bg-amber-soft px-4 py-2.5 whitespace-pre-wrap">{m.text}</div>
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
              {m.state === "pending" && (
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

      <div className="flex gap-2 items-end">
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
          placeholder="مثلاً: صرفت ٥٠٠ سولار للبوكلين النهارده"
          className="flex-1 resize-none rounded-xl border border-line bg-surface px-3 py-2.5 text-[15px] focus:outline-none focus:border-amber"
        />
        <Button primary onClick={() => send()} disabled={busy || !text.trim() || !me}>
          ابعت
        </Button>
      </div>
    </div>
  );
}
