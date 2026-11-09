import { SceneId } from "./timeline";

// Sound effects, in frames from the start of each scene, matched to the
// animation moments in scenes.tsx. [frame, file, volume]
export type Cue = [number, string, number];

const W: Cue = [0, "whoosh", 0.35]; // every scene comes in with a whoosh

export const cues: Record<SceneId, Cue[]> = {
  hook: [
    [2, "pop", 0.4],
    [14, "scribble", 0.55],
    [28, "buzz", 0.35],
    [43, "bills", 0.6],
    [55, "bills", 0.45],
  ],
  question: [W, [42, "pop", 0.45], [76, "pop", 0.45], [119, "pop", 0.5]],
  pain: [W, [6, "pop", 0.35], [16, "buzz", 0.25], [32, "pop", 0.35], [42, "buzz", 0.25], [64, "pop", 0.35], [74, "buzz", 0.25], [96, "thud", 0.55], [100, "counter", 0.3]],
  monthEnd: [W, [10, "calendar", 0.5], [60, "thud", 0.35]],
  reveal: [[0, "whoosh", 0.45], [6, "boom", 0.7], [26, "pop", 0.35]],
  sarki: [W, [52, "whoosh", 0.3], [62, "pop", 0.35], [76, "pop", 0.35], [90, "counter", 0.3], [106, "ding", 0.35]],
  home: [W, [83, "pop", 0.4], [87, "counter", 0.25], [105, "pop", 0.4], [109, "counter", 0.25], [140, "pop", 0.4], [144, "counter", 0.25], [164, "ding", 0.35]],
  tax: [W, [8, "pop", 0.35], [14, "counter", 0.25], [16, "pop", 0.3], [30, "pop", 0.3], [50, "lock", 0.55]],
  secure: [W, [20, "keypad", 0.5], [62, "lock", 0.45], [66, "pop", 0.3]],
  cta: [W, [2, "boom", 0.45], [14, "pop", 0.35], [34, "ding", 0.4]],
};
