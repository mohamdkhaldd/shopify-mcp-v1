import React from "react";
import { AbsoluteFill, Audio, Sequence, interpolate, staticFile, useCurrentFrame } from "remotion";
import { layout, OVERLAP, SceneId, totalFrames, hasVoice } from "./timeline";
import music from "./music.json";
import { cues } from "./sfx";
import onsets from "./sfx-onsets.json";
import { fontFaces, clamp, C, FONT } from "./ui";
import { random, Easing } from "remotion";
import { Hook, Question, Pain, MonthEnd, Reveal, Sarki, Home, Tax, Secure, Cta } from "./scenes";

const map: Record<SceneId, React.FC> = { hook: Hook, question: Question, pain: Pain, monthEnd: MonthEnd, reveal: Reveal, sarki: Sarki, home: Home, tax: Tax, secure: Secure, cta: Cta };

type Tr = "zoom" | "slide" | "up" | "spin" | "whip";
const TRANSITIONS: Tr[] = ["zoom", "slide", "up", "spin", "whip", "zoom", "slide", "up", "whip", "spin"];
const TR_SOUND = ["", "whoosh-cinematic-fast", "sweep-fast", "whoosh-arrow", "swoosh-fast", "zoom-impact", "whoosh-air", "sweep-fast", "glitch-small", "whoosh-cinematic-fast"];

/** each scene comes in with its own move (zoom / slide / rise / spin / whip pan) */
const Enter: React.FC<{ children: React.ReactNode; i: number }> = ({ children, i }) => {
  const f = useCurrentFrame();
  if (i === 0) return <AbsoluteFill>{children}</AbsoluteFill>;
  const p = interpolate(f, [0, OVERLAP + 2], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const blur = (1 - p) * 14;
  const t = TRANSITIONS[i];
  const tf =
    t === "zoom" ? `scale(${1.35 - p * 0.35})`
    : t === "slide" ? `translateX(${(1 - p) * -1080}px)`
    : t === "up" ? `translateY(${(1 - p) * 1920}px)`
    : t === "spin" ? `rotate(${(1 - p) * -12}deg) scale(${0.7 + p * 0.3})`
    : `translateX(${(1 - p) * 1080}px) skewX(${(1 - p) * -12}deg)`;
  return <AbsoluteFill style={{ opacity: Math.min(1, p * 1.6), transform: tf, filter: blur > 0.5 ? `blur(${blur}px)` : undefined }}>{children}</AbsoluteFill>;
};

/** camera: slow push-in over the scene plus a punch (zoom kick + shake) on every hit */
const KICK: [RegExp, number, boolean][] = [
  [/^(impact|hit|zoom)/, 1, true],
  [/^error/, 0.6, true],
  [/^lock/, 0.5, false],
  [/^(pop|click|camera|key)/, 0.35, false],
  [/^(money|success)/, 0.25, false],
];
const Camera: React.FC<{ id: SceneId; len: number; children: React.ReactNode }> = ({ id, len, children }) => {
  const f = useCurrentFrame();
  let scale = 1 + interpolate(f, [0, len], [0, 0.045], clamp);
  let x = 0;
  let y = 0;
  cues[id].forEach(([at, file], k) => {
    const rule = KICK.find(([re]) => re.test(file));
    if (!rule) return;
    const t = f - at;
    if (t < 0 || t > 14) return;
    const d = Math.exp(-t / 3.5) * rule[1];
    scale += 0.045 * d;
    if (rule[2]) {
      x += (random(`${id}x${k}${t}`) - 0.5) * 28 * d;
      y += (random(`${id}y${k}${t}`) - 0.5) * 28 * d;
    }
  });
  return <AbsoluteFill style={{ transform: `translate(${x}px, ${y}px) scale(${scale})` }}>{children}</AbsoluteFill>;
};

/** reels-style captions: 3-4 words at a time, the spoken word lit up */
const Captions: React.FC<{ text: string; start: number; dur: number }> = ({ text, start, dur }) => {
  const f = useCurrentFrame() - start;
  const words = text.split(" ");
  const chunks: string[][] = [];
  let cur: string[] = [];
  words.forEach((w) => {
    cur.push(w);
    if (cur.length >= 4 || /[.،؟:…!]$/.test(w)) {
      chunks.push(cur);
      cur = [];
    }
  });
  if (cur.length) chunks.push(cur);
  const total = Math.max(1, dur * 30);
  const per = total / words.length;
  const idx = Math.floor(f / per);
  if (f < 0 || idx >= words.length + 6) return null;
  let n = 0;
  const ci = chunks.findIndex((c) => {
    n += c.length;
    return Math.min(idx, words.length - 1) < n;
  });
  const chunk = chunks[ci];
  const first = chunks.slice(0, ci).reduce((a, c) => a + c.length, 0);
  const pop = interpolate(f - first * per, [0, 5], [0.85, 1], clamp);
  return (
    <div style={{ position: "absolute", bottom: 210, left: 50, right: 50, display: "flex", justifyContent: "center", direction: "rtl", fontFamily: FONT }}>
      <div
        style={{
          background: "rgba(5,8,20,.78)",
          borderRadius: 26,
          padding: "14px 30px",
          fontSize: 64,
          fontWeight: 900,
          lineHeight: 1.35,
          textAlign: "center",
          transform: `scale(${pop})`,
          boxShadow: "0 18px 50px rgba(0,0,0,.45)",
        }}
      >
        {chunk.map((w, k) => {
          const on = first + k === idx;
          const said = first + k <= idx;
          return (
            <React.Fragment key={k}>
              <span style={{ color: on ? "#FACC15" : said ? C.white : "rgba(255,255,255,.55)", display: "inline-block", transform: on ? "scale(1.12)" : undefined }}>{w}</span>
              {k < chunk.length - 1 ? <span style={{ display: "inline-block", width: 22 }} /> : null}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

/** background beat: very low and far, ducked further while the voice speaks, faded in/out */
const Music: React.FC = () => {
  const m = music as { file: string | null; volume: number };
  const total = totalFrames();
  if (!m.file) return null;
  // where the voice speaks: each scene's clip starts after its transition
  const voice = layout()
    .filter((s) => s.clip)
    .map((s, i) => {
      const start = s.from + (i === 0 ? 0 : OVERLAP);
      return [start, start + s.len - (i === 0 ? 0 : OVERLAP) - 10] as const;
    });
  const duck = (f: number) => (voice.some(([a, b]) => f >= a - 4 && f <= b) ? 0.55 : 1);
  return <Audio src={staticFile(m.file)} volume={(f) => m.volume * duck(f) * interpolate(f, [0, 20, total - 45, total], [0, 1, 1, 0], clamp)} />;
};

export const ShortAd: React.FC<{ subtitles: boolean }> = ({ subtitles }) => (
  <AbsoluteFill style={{ background: "#0A1330" }}>
    <style>{fontFaces}</style>
    <Music />
    {layout().map((s, i) => {
      const S = map[s.id];
      return (
        <Sequence key={s.id} from={s.from} durationInFrames={s.len} name={s.id}>
          <Enter i={i}>
            <Camera id={s.id} len={s.len}>
              <S />
            </Camera>
          </Enter>
          {subtitles && (s.clip || !hasVoice) && <Captions text={s.say} start={i === 0 ? 0 : OVERLAP} dur={s.clip ? s.len / 30 - 0.4 : s.len / 30} />}
          {TR_SOUND[i] && (
            <Sequence durationInFrames={30} name="transition sfx">
              <Audio src={staticFile(`sfx-lib/${TR_SOUND[i]}.mp3`)} trimBefore={Math.round(((onsets as Record<string, number>)[TR_SOUND[i]] ?? 0) * 30)} volume={(f) => 0.4 * interpolate(f, [22, 30], [1, 0], clamp)} />
            </Sequence>
          )}
          {cues[s.id].map(([at, file, vol, max], k) => {
            // line the sound's attack up with the animation moment
            const lead = Math.round(((onsets as Record<string, number>)[file] ?? 0) * 30);
            const from = Math.max(0, at - lead);
            const trim = Math.max(0, lead - at);
            const len = max ?? 75;
            return (
              <Sequence key={k} from={from} durationInFrames={len} name={`sfx ${file}`}>
                <Audio
                  src={staticFile(`sfx-lib/${file}.mp3`)}
                  trimBefore={trim}
                  volume={(f) => vol * interpolate(f, [len - 8, len], [1, 0], clamp)}
                />
              </Sequence>
            );
          })}
          {s.clip && (
            <Sequence from={i === 0 ? 0 : OVERLAP}>
              <Audio src={staticFile(s.clip)} />
            </Sequence>
          )}
        </Sequence>
      );
    })}
  </AbsoluteFill>
);
