// Scene timing for the short marketing video, in seconds.
// When the voice-over arrives, each `dur` is set to the length of its spoken
// line (plus a small breath), and the whole video re-times itself.

import voice from "./voice.json";

export const FPS = 30;
export const WIDTH = 1080;
export const HEIGHT = 1920;

export type SceneId = "hook" | "question" | "pain" | "monthEnd" | "reveal" | "sarki" | "home" | "tax" | "secure" | "cta";

export interface SceneSpec {
  id: SceneId;
  dur: number;
  /** the spoken line, shown as subtitles */
  say: string;
}

export const scenes: SceneSpec[] = [
  { id: "hook", dur: 3.4, say: "يوم واحد غلط في السركي… فلوس طالعة من جيبك وانت مش واخد بالك." },
  { id: "question", dur: 4.6, say: "طب لو سألتك دلوقتي: ليك كام عند الشركات؟ وعليك كام لأصحاب المعدات؟… تعرف ترد؟" },
  { id: "pain", dur: 4.6, say: "السركي في كشكول، والحساب على الآلة الحاسبة، ودفعات أصحاب المعدات في ورق." },
  { id: "monthEnd", dur: 4.2, say: "وآخر الشهر تقعد تجمّع وتطرح… عشان تعرف كسبت ولا لأ." },
  { id: "reveal", dur: 2.2, say: "عشان كده عملنالك MK-Tech… سيستم بيحسبلك كل ده لوحده." },
  { id: "sarki", dur: 7, say: "تسجّل السركي… والفاتورة تطلع لوحدها. بالقرش، من غير آلة حاسبة." },
  { id: "home", dur: 8.2, say: "افتح الرئيسية في أي يوم: كسبت كام… ليك كام عند الشركات… وعليك كام لأصحاب المعدات." },
  { id: "tax", dur: 6.2, say: "والضريبة محسوبة لوحدها، ومحجوزة في الخزنة… عشان متصرفهاش وتتفاجئ." },
  { id: "secure", dur: 5, say: "وكل ده عليه باسورد ليك انت بس… محدش يشوف أرقامك غيرك." },
  { id: "cta", dur: 6, say: "متستناش آخر الشهر عشان تعرف كسبت كام. اطلب كود التجربة دلوقتي." },
];

/** frames each scene's transition overlaps the previous one */
export const OVERLAP = 8;

export const frames = (s: number) => Math.round(s * FPS);

/** voice clips cut from the recording (scripts/sync.py): one per scene, in seconds */
const clips: ({ file: string; dur: number } | null)[] = (voice as { clips: ({ file: string; dur: number } | null)[] }).clips;
/** subtitles only for lines that have a voice (once any voice exists) */
export const hasVoice = clips.length > 0;
/** breath after each spoken line before the next scene starts */
const BREATH = 0.12;

export function layout() {
  let at = 0;
  return scenes.map((sc, i) => {
    const clip = clips[i];
    const s = clip ? { ...sc, dur: Math.max(2.2, clip.dur + BREATH + (i === scenes.length - 1 ? 1.6 : 0)), clip: clip.file } : { ...sc, clip: undefined as string | undefined };
    const from = i === 0 ? 0 : at - OVERLAP;
    const len = frames(s.dur) + (i === 0 ? 0 : OVERLAP);
    at = from + len;
    return { ...s, from, len };
  });
}

export const totalFrames = () => {
  const l = layout();
  const last = l[l.length - 1];
  return last.from + last.len;
};
