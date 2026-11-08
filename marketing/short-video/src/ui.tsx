import React from "react";
import { AbsoluteFill, Easing, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";

export const C = {
  navy: "#0A1330",
  navy2: "#0F1D4A",
  blue: "#0B5FFF",
  sky: "#38BDF8",
  red: "#EF4444",
  green: "#22C55E",
  amber: "#F59E0B",
  purple: "#7C3AED",
  paper: "#FFF8E7",
  ink: "#0F172A",
  white: "#FFFFFF",
};

export const FONT = "Cairo";

export const fontFaces = `
@font-face{font-family:Cairo;src:url(${staticFile("fonts/cairo-arabic-400-normal.woff2")}) format("woff2");font-weight:400}
@font-face{font-family:Cairo;src:url(${staticFile("fonts/cairo-arabic-700-normal.woff2")}) format("woff2");font-weight:700}
@font-face{font-family:Cairo;src:url(${staticFile("fonts/cairo-arabic-900-normal.woff2")}) format("woff2");font-weight:900}
@font-face{font-family:Cairo;src:url(${staticFile("fonts/cairo-latin-700-normal.woff2")}) format("woff2");font-weight:700;unicode-range:U+0000-00FF}
@font-face{font-family:Cairo;src:url(${staticFile("fonts/cairo-latin-900-normal.woff2")}) format("woff2");font-weight:900;unicode-range:U+0000-00FF}
`;

export const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

export function usePop(delay = 0, damping = 12) {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: f - delay, fps, config: { damping, stiffness: 160, mass: 0.7 } });
}

/** dark animated background with soft moving glows */
export const Bg: React.FC<{ tint?: string; children?: React.ReactNode }> = ({ tint = C.blue, children }) => {
  const f = useCurrentFrame();
  const x = 50 + Math.sin(f / 40) * 18;
  const y = 30 + Math.cos(f / 55) * 10;
  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(900px 900px at ${x}% ${y}%, ${tint}55, transparent 70%), radial-gradient(800px 800px at ${100 - x}% ${90 - y / 2}%, ${C.sky}22, transparent 70%), linear-gradient(180deg, ${C.navy} 0%, ${C.navy2} 100%)`,
        direction: "rtl",
        fontFamily: FONT,
        color: C.white,
        overflow: "hidden",
      }}
    >
      <Grid />
      {children}
    </AbsoluteFill>
  );
};

const Grid: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill
      style={{
        backgroundImage: `linear-gradient(${C.white}0A 2px, transparent 2px), linear-gradient(90deg, ${C.white}0A 2px, transparent 2px)`,
        backgroundSize: "90px 90px",
        backgroundPosition: `0 ${(f * 0.6) % 90}px`,
        maskImage: "radial-gradient(circle at 50% 40%, black, transparent 75%)",
      }}
    />
  );
};

/** the on-screen header (sound-off anchor) at the top */
export const Header: React.FC<{ children: React.ReactNode; color?: string; delay?: number; top?: number }> = ({ children, color = C.white, delay = 4, top = 210 }) => {
  const p = usePop(delay, 14);
  return (
    <div
      style={{
        position: "absolute",
        top,
        left: 60,
        right: 60,
        textAlign: "center",
        fontSize: 84,
        fontWeight: 900,
        lineHeight: 1.25,
        color,
        transform: `translateY(${(1 - p) * 60}px) scale(${0.9 + p * 0.1})`,
        opacity: p,
        textShadow: "0 8px 40px rgba(0,0,0,.45)",
      }}
    >
      {children}
    </div>
  );
};

/** a pill label, e.g. "لشركات تأجير المعدات" */
export const Pill: React.FC<{ children: React.ReactNode; bg?: string; color?: string; size?: number; delay?: number; style?: React.CSSProperties }> = ({
  children,
  bg = C.amber,
  color = C.ink,
  size = 46,
  delay = 0,
  style,
}) => {
  const p = usePop(delay, 11);
  return (
    <div
      style={{
        display: "inline-block",
        background: bg,
        color,
        fontWeight: 900,
        fontSize: size,
        padding: `${size * 0.18}px ${size * 0.7}px`,
        borderRadius: 999,
        transform: `scale(${p})`,
        boxShadow: "0 18px 50px rgba(0,0,0,.35)",
        ...style,
      }}
    >
      {children}
    </div>
  );
};

export const fmt = (n: number, dec = 0) => n.toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec });

export const CountUp: React.FC<{ to: number; from?: number; start?: number; dur?: number; dec?: number; prefix?: string; suffix?: string }> = ({
  to,
  from = 0,
  start = 0,
  dur = 30,
  dec = 0,
  prefix = "",
  suffix = "",
}) => {
  const f = useCurrentFrame();
  const v = interpolate(f, [start, start + dur], [from, to], { ...clamp, easing: Easing.out(Easing.cubic) });
  return (
    <span style={{ fontVariantNumeric: "tabular-nums", direction: "ltr", unicodeBidi: "isolate" }}>
      {prefix}
      {fmt(v, dec)}
      {suffix}
    </span>
  );
};

/** phone frame showing a (tall) screenshot, optionally scrolled */
export const Phone: React.FC<{ src: string; scroll?: number; width?: number; style?: React.CSSProperties; children?: React.ReactNode }> = ({
  src,
  scroll = 0,
  width = 760,
  style,
  children,
}) => {
  const h = width * 2.06;
  const pad = width * 0.035;
  return (
    <div
      style={{
        width,
        height: h,
        borderRadius: width * 0.13,
        background: "#05070F",
        padding: pad,
        boxShadow: "0 60px 120px rgba(0,0,0,.6), inset 0 0 0 4px #2A3350",
        position: "relative",
        ...style,
      }}
    >
      <div style={{ width: "100%", height: "100%", borderRadius: width * 0.1, overflow: "hidden", position: "relative", background: "#F1F5F9" }}>
        <Img src={staticFile(src)} style={{ width: "100%", position: "absolute", top: 0, left: 0, transform: `translateY(${-scroll}px)` }} />
        {children}
      </div>
      <div style={{ position: "absolute", top: pad + 14, left: "50%", transform: "translateX(-50%)", width: width * 0.28, height: 34, borderRadius: 20, background: "#05070F" }} />
    </div>
  );
};

/** burned-in subtitles of the spoken line, word by word */
export const Subtitle: React.FC<{ text: string; len: number }> = ({ text, len }) => {
  const f = useCurrentFrame();
  const words = text.split(" ");
  const shown = interpolate(f, [6, Math.max(12, len * 0.82)], [0, words.length], clamp);
  const fade = interpolate(f, [0, 6, len - 6, len], [0, 1, 1, 0], clamp);
  return (
    <div style={{ position: "absolute", bottom: 150, left: 70, right: 70, display: "flex", justifyContent: "center", opacity: fade }}>
      <div
        style={{
          background: "rgba(5,8,20,.72)",
          borderRadius: 28,
          padding: "18px 34px",
          fontSize: 46,
          fontWeight: 700,
          lineHeight: 1.55,
          textAlign: "center",
          direction: "rtl",
          fontFamily: FONT,
          backdropFilter: "blur(6px)",
        }}
      >
        {words.map((w, i) => (
          <span key={i} style={{ color: i < shown ? C.white : "rgba(255,255,255,.35)", transition: "none" }}>
            {w}
            {i < words.length - 1 ? " " : ""}
          </span>
        ))}
      </div>
    </div>
  );
};

export const Logo: React.FC<{ size: number; style?: React.CSSProperties }> = ({ size, style }) => (
  <div
    style={{
      width: size,
      height: size,
      borderRadius: size * 0.24,
      background: "#020617",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      boxShadow: `0 0 ${size * 0.6}px ${C.blue}88, inset 0 0 0 3px #1E3A8A`,
      ...style,
    }}
  >
    <Img src={staticFile("mk-icon.png")} style={{ width: size * 0.8, height: size * 0.8, objectFit: "contain" }} />
  </div>
);
