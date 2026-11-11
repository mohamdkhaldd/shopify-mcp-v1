import { useEffect, useRef, useState } from "react";
import { api, shellApi } from "../../api/client";
import type { AssistantAction } from "../../../core/ai/assistant";
import { Button, PageHeader } from "../../components/ui";
import { TextInput } from "../../components/Field";

// المساعد: تكتب اللي حصل بالعامية، والذكاء الاصطناعي يفهمه ويقولك هيسجل إيه.
// مفيش حاجة بتتسجل غير لما تدوس «سجّل»، والتسجيل بيتعمل بنفس دوال البرنامج
// (فيه تراجع زي أي تعديل تاني من سجل التعديلات). المسح بباسورد الشركة بس.
// بيجاوب كمان على "إزاي أعمل كذا" وعلى أسئلة الأرقام (كسبت كام، النسبة…).
// المحادثة محفوظة على الجهاز ده.

type Msg =
  | { role: "user"; text: string }
  | { role: "assistant"; text: string; actions?: AssistantAction[]; lines?: string[]; problem?: string; state?: "pending" | "saved" | "cancelled" | "error" };

const STORE = "mk-assistant-chat";
const loadChat = (): Msg[] => {
  try {
    const v = JSON.parse(localStorage.getItem(STORE) ?? "[]");
    return Array.isArray(v) ? v.slice(-60) : [];
  } catch {
    return [];
  }
};
const saveChat = (m: Msg[]) => {
  try {
    localStorage.setItem(STORE, JSON.stringify(m.slice(-60)));
  } catch {
    /* مش مهم لو مقدرش يحفظ */
  }
};

const EXAMPLES = [
  "دخلت لودر ٩٥٠ صاحبه محمد علي لشركة النور في التجمع، الشركة بـ ١٥٠٠ في اليوم وصاحبه ياخد ١٢٠٠ من أول الشهر",
  "صرفت ٢٠٠٠ للسواق أحمد سلفة، وجبت زيت هيدروليك بـ ١٥٠٠ للودر بتاع محمد",
  "شركة النور دفعت ٣٠ ألف انستا باي",
  "اللودر اشتغل من ١ لحد ١٠ الشهر ده",
  "كسبت كام الشهر ده؟ ومكسبي كام في المية على فلوسي؟",
  "إزاي أعمل عقد جديد؟",
];

export default function Assistant() {
  const [msgs, setMsgs] = useState<Msg[]>(loadChat);
  const [password, setPassword] = useState("");
  useEffect(() => saveChat(msgs), [msgs]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  // بين قوسين: scrollIntoView في Chrome الجديد بيرجّع Promise، وReact فاكره cleanup
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [msgs, busy]);

  const update = (i: number, patch: Partial<Extract<Msg, { role: "assistant" }>>) =>
    setMsgs((m) => m.map((x, j) => (j === i && x.role === "assistant" ? { ...x, ...patch } : x)));

  async function send(said = text) {
    const t = said.trim();
    if (!t || busy) return;
    setText("");
    const history = msgs.slice(-8).map((m) => ({ role: m.role, text: m.text }));
    setMsgs((m) => [...m, { role: "user", text: t }]);
    setBusy(true);
    try {
      const [names, facts] = await Promise.all([api.assistantContext(), api.assistantFacts()]);
      const context = { ...names, facts };
      const r = await shellApi.askAssistant({ text: t, context, history });
      if (!r.ok) {
        setMsgs((m) => [...m, { role: "assistant", text: r.message, state: "error" }]);
        return;
      }
      if (!r.actions.length) {
        setMsgs((m) => [...m, { role: "assistant", text: r.reply || "مفهمتش — اكتبها تاني بتفاصيل أكتر" }]);
        return;
      }
      // قبل ما يتسجل: البرنامج يجرّب ويقول هيعمل إيه بالظبط
      const p = await api.assistantPreview(r.actions);
      setMsgs((m) => [
        ...m,
        p.ok
          ? { role: "assistant", text: r.reply, actions: r.actions, lines: p.lines, state: "pending" }
          : { role: "assistant", text: r.reply, actions: r.actions, problem: p.message, state: "error" },
      ]);
    } catch (e) {
      setMsgs((m) => [...m, { role: "assistant", text: (e as Error).message, state: "error" }]);
    } finally {
      setBusy(false);
    }
  }

  async function save(i: number) {
    const m = msgs[i];
    if (m.role !== "assistant" || !m.actions) return;
    setBusy(true);
    try {
      const deleting = m.actions.some((a) => a.type === "delete");
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
          <Button onClick={() => !busy && setMsgs([])} disabled={busy}>
            محادثة جديدة
          </Button>
        )}
      </PageHeader>

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
            <div key={i} className="justify-self-start max-w-[85%] rounded-2xl rounded-ss-sm bg-amber-soft px-4 py-2.5 whitespace-pre-wrap">
              {m.text}
            </div>
          ) : (
            <div key={i} className="justify-self-end max-w-[90%] w-full sm:w-auto rounded-2xl rounded-se-sm border border-line bg-surface-2 px-4 py-3 grid gap-2">
              {m.text && <div className="whitespace-pre-wrap">{m.text}</div>}
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
              {m.state === "pending" && m.actions?.some((a) => a.type === "delete") && (
                <label className="grid gap-1 text-sm">
                  <span className="font-semibold text-out">ده مسح — اكتب باسورد الشركة:</span>
                  <TextInput type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="off" className="max-w-[220px]" />
                </label>
              )}
              {m.state === "pending" && (
                <div className="flex gap-2 pt-1">
                  <Button primary danger={m.actions?.some((a) => a.type === "delete")} onClick={() => save(i)} disabled={busy}>
                    {m.actions?.some((a) => a.type === "delete") ? "امسح" : "سجّل"}
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
        <Button primary onClick={() => send()} disabled={busy || !text.trim()}>
          ابعت
        </Button>
      </div>
    </div>
  );
}
