import { SceneId } from "./timeline";

// Sound effects from public/sfx-lib (Mixkit, see its README), in frames from
// the start of each scene, matched to the animation moments in scenes.tsx.
// [frame, file, volume, max length in frames]
export type Cue = [number, string, number, number?];


export const cues: Record<SceneId, Cue[]> = {
  hook: [
    [2, "pop-explainer", 0.5],
    [14, "paper-scribble", 0.6, 30],
    [28, "error-bass-buzzer", 0.35, 30],
    [43, "paper-blowing-wind", 0.5, 60],
    [44, "money-coins-clink", 0.4],
  ],
  question: [[0, "glitch-intro-text", 0.2, 20], [42, "pop-hard-click", 0.5, 20], [76, "pop-hard-click", 0.5, 20], [119, "click-tech-select", 0.6]],
  pain: [
    [4, "whoosh-arrow", 0.25, 20],
    [6, "pop-long", 0.4],
    [30, "whoosh-arrow", 0.25, 20],
    [62, "whoosh-arrow", 0.25, 20],
    [16, "error-gameshow-buzz", 0.25, 20],
    [32, "pop-long", 0.4],
    [42, "error-gameshow-buzz", 0.25, 20],
    [64, "pop-long", 0.4],
    [74, "error-gameshow-buzz", 0.25, 20],
    [96, "hit-short-bass", 0.6],
    [100, "money-bag-drop", 0.5],
  ],
  monthEnd: [[10, "paper-book-pages", 0.5, 50], [60, "hit-blow", 0.5]],
  reveal: [[6, "impact-big-cinematic", 0.7, 70], [30, "pop-explainer", 0.45], [48, "sparkle-whoosh", 0.35, 40], [50, "pop-long", 0.4]],
  sarki: [[4, "camera-shutter", 0.35], [52, "swoosh-fast", 0.4], [100, "sparkle-whoosh", 0.25, 30], [62, "click-interface", 0.5], [76, "click-interface", 0.5], [90, "key-atm-press", 0.4], [106, "success-confirmation", 0.4]],
  home: [
    [4, "camera-shutter", 0.35],
    [83, "pop-hard-click", 0.45, 20],
    [87, "money-coins-clink", 0.3],
    [105, "pop-hard-click", 0.45, 20],
    [109, "money-coins-clink", 0.3],
    [140, "pop-hard-click", 0.45, 20],
    [144, "money-coins-clink", 0.3],
    [164, "success-correct-tone", 0.35],
  ],
  tax: [[8, "pop-long", 0.4], [16, "click-interface", 0.4], [30, "click-interface", 0.4], [50, "lock-safe", 0.6]],
  secure: [[4, "camera-shutter", 0.35], [20, "typing-smartphone", 0.5, 40], [62, "lock-electronic-success", 0.45, 40], [66, "pop-explainer", 0.35]],
  cta: [[2, "impact-whoosh-presentation", 0.5, 60], [14, "pop-long", 0.4], [34, "success-confirmation", 0.45], [36, "sparkle-whoosh", 0.35, 45]],
};
