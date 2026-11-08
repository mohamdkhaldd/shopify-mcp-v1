import React from "react";
import { AbsoluteFill, Audio, Sequence, interpolate, staticFile, useCurrentFrame } from "remotion";
import { layout, OVERLAP, SceneId } from "./timeline";
import { fontFaces, Subtitle, clamp } from "./ui";
import { Hook, Question, Pain, MonthEnd, Reveal, Sarki, Home, Tax, Secure, Cta } from "./scenes";

const map: Record<SceneId, React.FC> = { hook: Hook, question: Question, pain: Pain, monthEnd: MonthEnd, reveal: Reveal, sarki: Sarki, home: Home, tax: Tax, secure: Secure, cta: Cta };

/** each scene slides/zooms in over the previous one */
const Enter: React.FC<{ children: React.ReactNode; first: boolean }> = ({ children, first }) => {
  const f = useCurrentFrame();
  const p = first ? 1 : interpolate(f, [0, OVERLAP], [0, 1], clamp);
  return <AbsoluteFill style={{ opacity: p, transform: `scale(${1.08 - p * 0.08})` }}>{children}</AbsoluteFill>;
};

export const ShortAd: React.FC<{ subtitles: boolean }> = ({ subtitles }) => (
  <AbsoluteFill style={{ background: "#0A1330" }}>
    <style>{fontFaces}</style>
    {layout().map((s, i) => {
      const S = map[s.id];
      return (
        <Sequence key={s.id} from={s.from} durationInFrames={s.len} name={s.id}>
          <Enter first={i === 0}>
            <S />
          </Enter>
          {subtitles && <Subtitle text={s.say} len={s.len} />}
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
