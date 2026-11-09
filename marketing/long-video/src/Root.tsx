import React from "react";
import { Composition } from "remotion";
import { Walkthrough, build, FPS, W, H } from "./Walkthrough";

export const Root: React.FC = () => <Composition id="Walkthrough" component={Walkthrough} durationInFrames={build().total} fps={FPS} width={W} height={H} />;
