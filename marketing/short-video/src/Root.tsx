import React from "react";
import { Composition } from "remotion";
import { ShortAd } from "./Video";
import { FPS, HEIGHT, WIDTH, totalFrames } from "./timeline";

export const Root: React.FC = () => (
  <Composition id="ShortAd" component={ShortAd} durationInFrames={totalFrames()} fps={FPS} width={WIDTH} height={HEIGHT} defaultProps={{ subtitles: true }} />
);
