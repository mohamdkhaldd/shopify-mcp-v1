import React from "react";
import { AbsoluteFill, Audio, Sequence, interpolate, staticFile, useCurrentFrame } from "remotion";
import { layout, OVERLAP, SceneId, totalFrames, hasVoice } from "./timeline";
import music from "./music.json";
import { cues } from "./sfx";
import { fontFaces, Subtitle, clamp } from "./ui";
import { Hook, Question, Pain, MonthEnd, Reveal, Sarki, Home, Tax, Secure, Cta } from "./scenes";

const map: Record<SceneId, React.FC> = { hook: Hook, question: Question, pain: Pain, monthEnd: MonthEnd, reveal: Reveal, sarki: Sarki, home: Home, tax: Tax, secure: Secure, cta: Cta };

/** each scene slides/zooms in over the previous one */
const Enter: React.FC<{ children: React.ReactNode; first: boolean }> = ({ children, first }) => {
  const f = useCurrentFrame();
  const p = first ? 1 : interpolate(f, [0, OVERLAP], [0, 1], clamp);
  return <AbsoluteFill style={{ opacity: p, transform: `scale(${1.08 - p * 0.08})` }}>{children}</AbsoluteFill>;
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
          <Enter first={i === 0}>
            <S />
          </Enter>
          {subtitles && (s.clip || !hasVoice) && <Subtitle text={s.say} len={s.len} />}
          {cues[s.id].map(([at, file, vol], k) => (
            <Sequence key={k} from={at} durationInFrames={75} name={`sfx ${file}`}>
              <Audio src={staticFile(`sfx/${file}.mp3`)} volume={vol} />
            </Sequence>
          ))}
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
