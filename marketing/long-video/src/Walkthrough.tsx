import React from "react";
import { AbsoluteFill, Audio, Easing, Img, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import story from "./story.json";
import onsets from "./sfx-onsets.json";

// The long explainer, built from frames filmed in the real app (capture/capture.cjs).
// Each filmed frame knows the element being used, so the camera zooms on it,
// the cursor goes there and clicks, and it gets a soft highlight.

export const FPS = 30;
export const W = 1920;
export const H = 1080;

type Box = { x: number; y: number; w: number; h: number } | null;
type Frame = { file: string; chapter: string; kind: "view" | "point" | "click" | "type"; target: Box; note: string };
const frames = (story as { frames: Frame[] }).frames;

export const CHAPTERS: Record<string, [string, string]> = {
  activate: ["١", "استلام الكود والتفعيل"],
  password: ["٢", "الإعدادات"],
  tour: ["٣", "جولة في البرنامج"],
  supplier: ["٤", "أصحاب المعدات"],
  equipment: ["٥", "معدات صاحب المعدة"],
  client: ["٦", "الشركات والأفراد"],
  contract: ["٧", "العقد الجديد"],
  sarki: ["٩", "تسجيل الأيام في السركي"],
  invoice: ["١٠", "الفاتورة ودفعة الشركة"],
  supplierAccount: ["١٢", "حساب صاحب المعدة"],
  home: ["١٧", "الرئيسية"],
  activity: ["١٨", "سجل التعديلات"],
};

const DUR = { view: 54, point: 14, click: 10, type: 4 } as const;
const TITLE = 70;
const HOLD = 24;

type Seg =
  | { type: "title"; from: number; len: number; chapter: string; first: string }
  | { type: "frame"; from: number; len: number; f: Frame; cam: Cam; cur: { x: number; y: number } | null };
type Cam = { cx: number; cy: number; z: number };

/** camera for a target: zoom so the element reads well, never below full screen */
function camFor(t: Box, kind: Frame["kind"]): Cam {
  if (!t) return { cx: 0.5, cy: 0.5, z: 1 };
  const z = kind === "view" ? Math.min(1.6, Math.max(1, 0.55 / Math.max(t.w, t.h * 1.2))) : Math.min(2.1, Math.max(1.15, 0.32 / Math.max(t.w, t.h * 2)));
  return { cx: t.x + t.w / 2, cy: t.y + t.h / 2, z };
}

export function build(): { segs: Seg[]; total: number } {
  const segs: Seg[] = [];
  let at = 0;
  let chapter = "";
  let cam: Cam = { cx: 0.5, cy: 0.5, z: 1 };
  frames.forEach((f, i) => {
    if (f.chapter !== chapter) {
      if (chapter) at += HOLD;
      chapter = f.chapter;
      segs.push({ type: "title", from: at, len: TITLE, chapter, first: f.file });
      at += TITLE;
    }
    // a "view" right after a click keeps the camera where it was, then eases out
    if (f.target || f.kind === "view") cam = f.target ? camFor(f.target, f.kind) : { cx: 0.5, cy: 0.5, z: 1 };
    const cur = f.target && f.kind !== "view" ? { x: f.target.x + f.target.w / 2, y: f.target.y + f.target.h / 2 } : null;
    const len = DUR[f.kind] + (i === frames.length - 1 ? 60 : 0);
    segs.push({ type: "frame", from: at, len, f, cam, cur });
    at += len;
  });
  return { segs, total: at + HOLD };
}

const { segs } = build();
const frameSegs = segs.filter((s): s is Extract<Seg, { type: "frame" }> => s.type === "frame");

const ease = Easing.inOut(Easing.cubic);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** the app screen, with the moving camera, highlight, cursor and click ripple */
const Screen: React.FC = () => {
  const f = useCurrentFrame();
  // the latest filmed frame that has started (holds between chapters keep the last one)
  let i = 0;
  for (let k = 0; k < frameSegs.length && frameSegs[k].from <= f; k++) i = k;
  const s = frameSegs[i];
  const prev = frameSegs[i - 1] ?? s;
  const chapterStart = i === 0 || prev.f.chapter !== s.f.chapter;
  const t = ease(interpolate(f - s.from, [0, 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));
  const from = chapterStart ? { cx: 0.5, cy: 0.5, z: 1 } : prev.cam;
  const cam = { cx: lerp(from.cx, s.cam.cx, t), cy: lerp(from.cy, s.cam.cy, t), z: lerp(from.z, s.cam.z, t) };
  const sw = W * cam.z;
  const sh = H * cam.z;
  const tx = Math.min(0, Math.max(W - sw, W / 2 - cam.cx * sw));
  const ty = Math.min(0, Math.max(H - sh, H / 2 - cam.cy * sh));
  const toScreen = (x: number, y: number) => ({ x: tx + x * sw, y: ty + y * sh });

  // cursor glides from the last place it was to this target
  const lastCur = [...frameSegs.slice(0, i)].reverse().find((p) => p.cur && p.f.chapter === s.f.chapter)?.cur ?? { x: 0.62, y: 0.7 };
  const tc = ease(interpolate(f - s.from, [0, 10], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));
  const curN = s.cur ? { x: lerp(lastCur.x, s.cur.x, tc), y: lerp(lastCur.y, s.cur.y, tc) } : null;
  const cur = curN ? toScreen(curN.x, curN.y) : null;
  const tb = s.f.target && s.f.kind !== "view" ? s.f.target : null;
  const hl = tb ? { ...toScreen(tb.x, tb.y), w: tb.w * sw, h: tb.h * sh } : null;
  const press = s.f.kind === "click" ? interpolate(f - s.from, [0, 3, 8], [1, 0.82, 1], { extrapolateRight: "clamp" }) : 1;
  const ripple = s.f.kind === "click" ? interpolate(f - s.from, [0, 10], [0, 1], { extrapolateRight: "clamp" }) : 0;

  return (
    <AbsoluteFill style={{ background: "#0A1330", overflow: "hidden" }}>
      <Img src={staticFile(`story/${s.f.file}`)} style={{ position: "absolute", left: tx, top: ty, width: sw, height: sh }} />
      {hl && (
        <div
          style={{
            position: "absolute",
            left: hl.x - 8,
            top: hl.y - 8,
            width: hl.w + 16,
            height: hl.h + 16,
            borderRadius: 14,
            border: "4px solid #FACC15",
            boxShadow: "0 0 0 9999px rgba(10,19,48,.28), 0 0 30px #FACC15aa",
            opacity: interpolate(f - s.from, [0, 6], [0, 1], { extrapolateRight: "clamp" }),
          }}
        />
      )}
      {cur && s.f.kind === "click" && (
        <div
          style={{
            position: "absolute",
            left: cur.x - 60 * ripple,
            top: cur.y - 60 * ripple,
            width: 120 * ripple,
            height: 120 * ripple,
            borderRadius: "50%",
            border: "5px solid #FACC15",
            opacity: 1 - ripple,
          }}
        />
      )}
      {cur && (
        <svg width={46} height={46} viewBox="0 0 24 24" style={{ position: "absolute", left: cur.x - 6, top: cur.y - 4, transform: `scale(${press})`, transformOrigin: "6px 4px", filter: "drop-shadow(0 4px 6px rgba(0,0,0,.45))" }}>
          <path d="M4 2l15 9-6.5 1.6L16 20l-2.8 1.3-3.5-7.4L4 18z" fill="#fff" stroke="#0F172A" strokeWidth={1.4} strokeLinejoin="round" />
        </svg>
      )}
    </AbsoluteFill>
  );
};

const fontFaces = `
@font-face{font-family:Cairo;src:url(${staticFile("fonts/cairo-arabic-700-normal.woff2")}) format("woff2");font-weight:700}
@font-face{font-family:Cairo;src:url(${staticFile("fonts/cairo-arabic-900-normal.woff2")}) format("woff2");font-weight:900}
@font-face{font-family:Cairo;src:url(${staticFile("fonts/cairo-latin-900-normal.woff2")}) format("woff2");font-weight:900;unicode-range:U+0000-00FF}
`;

/** chapter title: the first screen blurred behind a big number and name */
const Title: React.FC<{ chapter: string; first: string }> = ({ chapter, first }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const [num, name] = CHAPTERS[chapter] ?? ["", chapter];
  const p = spring({ frame: f, fps, config: { damping: 13, stiffness: 140 } });
  const p2 = spring({ frame: f - 8, fps, config: { damping: 14 } });
  const out = interpolate(f, [TITLE - 10, TITLE], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ opacity: out }}>
      <Img src={staticFile(`story/${first}`)} style={{ width: W, height: H, filter: "blur(18px) brightness(.45)", transform: "scale(1.08)" }} />
      <AbsoluteFill style={{ background: "radial-gradient(900px 600px at 50% 50%, #0B5FFF55, transparent 70%)" }} />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", direction: "rtl", fontFamily: "Cairo", color: "#fff" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 40, transform: `scale(${0.8 + p * 0.2})`, opacity: p }}>
          <div style={{ width: 170, height: 170, borderRadius: 40, background: "#0B5FFF", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 110, fontWeight: 900, boxShadow: "0 0 80px #0B5FFFaa" }}>{num}</div>
          <div style={{ fontSize: 110, fontWeight: 900, transform: `translateX(${(1 - p2) * -80}px)`, opacity: p2, textShadow: "0 10px 50px rgba(0,0,0,.5)" }}>{name}</div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const Sfx: React.FC<{ file: string; vol: number; max?: number }> = ({ file, vol, max = 30 }) => (
  <Audio
    src={staticFile(`sfx-lib/${file}.mp3`)}
    trimBefore={Math.round(((onsets as Record<string, number>)[file] ?? 0) * FPS)}
    volume={(f) => vol * interpolate(f, [max - 6, max], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}
  />
);

export const Walkthrough: React.FC = () => (
  <AbsoluteFill style={{ background: "#0A1330" }}>
    <style>{fontFaces}</style>
    <Screen />
    {segs.map((s, k) =>
      s.type === "title" ? (
        <Sequence key={k} from={s.from} durationInFrames={s.len} name={`title ${s.chapter}`}>
          <Title chapter={s.chapter} first={s.first} />
          <Sfx file="whoosh-cinematic-fast" vol={0.45} />
          <Sequence from={8}>
            <Sfx file="impact-whoosh-presentation" vol={0.35} max={40} />
          </Sequence>
        </Sequence>
      ) : s.f.kind === "click" ? (
        <Sequence key={k} from={s.from} durationInFrames={20} name="click">
          <Sfx file="click-interface" vol={0.55} max={12} />
        </Sequence>
      ) : s.f.kind === "type" ? (
        <Sequence key={k} from={s.from} durationInFrames={6} name="key">
          <Sfx file="click-tech-select" vol={0.12} max={5} />
        </Sequence>
      ) : null,
    )}
  </AbsoluteFill>
);
