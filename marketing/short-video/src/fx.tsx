import React from "react";
import { AbsoluteFill, interpolate, random, useCurrentFrame } from "remotion";
import { clamp } from "./ui";

/** particles flying out from a point at a given frame (sparks, or emoji/glyphs) */
export const Burst: React.FC<{
  at: number;
  x: number;
  y: number;
  count?: number;
  colors?: string[];
  glyphs?: string[];
  spread?: number;
  size?: number;
  seed?: string;
  gravity?: number;
}> = ({ at, x, y, count = 18, colors = ["#FACC15", "#FFFFFF", "#38BDF8"], glyphs, spread = 520, size = 22, seed = "b", gravity = 0.9 }) => {
  const f = useCurrentFrame();
  const t = f - at;
  if (t < 0 || t > 40) return null;
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {new Array(count).fill(0).map((_, i) => {
        const ang = random(`${seed}a${i}`) * Math.PI * 2;
        const sp = (0.45 + random(`${seed}s${i}`) * 0.55) * spread;
        const p = interpolate(t, [0, 26], [0, 1], { ...clamp, easing: (v) => 1 - Math.pow(1 - v, 3) });
        const px = x + Math.cos(ang) * sp * p;
        const py = y + Math.sin(ang) * sp * p + gravity * t * t * 0.35;
        const o = interpolate(t, [0, 4, 26, 40], [0, 1, 1, 0], clamp);
        const s = (glyphs ? size * 2.2 : size) * (0.6 + random(`${seed}z${i}`) * 0.8) * interpolate(t, [0, 6, 40], [0.3, 1, 0.7], clamp);
        const c = colors[i % colors.length];
        return glyphs ? (
          <div key={i} style={{ position: "absolute", left: px, top: py, fontSize: s, opacity: o, transform: `translate(-50%,-50%) rotate(${(random(`${seed}r${i}`) - 0.5) * 120 + t * 4}deg)` }}>
            {glyphs[i % glyphs.length]}
          </div>
        ) : (
          <div
            key={i}
            style={{
              position: "absolute",
              left: px,
              top: py,
              width: s,
              height: s * (i % 3 === 0 ? 3 : 1),
              borderRadius: i % 3 === 0 ? 4 : "50%",
              background: c,
              boxShadow: `0 0 ${s}px ${c}`,
              opacity: o,
              transform: `translate(-50%,-50%) rotate(${(ang * 180) / Math.PI + 90}deg)`,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

/** a diagonal light sweep across its parent (parent needs position:relative + overflow:hidden) */
export const Shine: React.FC<{ at: number; dur?: number }> = ({ at, dur = 22 }) => {
  const f = useCurrentFrame();
  const p = interpolate(f, [at, at + dur], [-0.4, 1.4], clamp);
  if (f < at || f > at + dur) return null;
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        borderRadius: "inherit",
        overflow: "hidden",
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: "-50%",
          bottom: "-50%",
          width: "35%",
          left: `${p * 100}%`,
          background: "linear-gradient(90deg, transparent, rgba(255,255,255,.75), transparent)",
          transform: "rotate(18deg)",
        }}
      />
    </div>
  );
};

/** quick white flash */
export const Flash: React.FC<{ at: number; strength?: number }> = ({ at, strength = 0.8 }) => {
  const f = useCurrentFrame();
  const o = interpolate(f, [at, at + 2, at + 10], [0, strength, 0], clamp);
  return <AbsoluteFill style={{ background: "#fff", opacity: o, pointerEvents: "none" }} />;
};
