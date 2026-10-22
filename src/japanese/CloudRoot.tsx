// Cloud render entry for the public render repo (Dreamint99/aiu-render): the lesson spec arrives as --props.
import React from "react";
import { Composition } from "remotion";
import { JapaneseVideo, jpLen, Spec } from "./JapaneseEngine";

const EMPTY: Spec = { id: "x", course: "", lessonNo: "", title: "", titleJp: "", next: { bn: "", jp: "" }, cast: {}, scenes: [], total: 300 };
export const CloudRoot: React.FC = () => (
  <Composition id="JapaneseLesson" component={JapaneseVideo as any} fps={30} width={1920} height={1080} durationInFrames={300}
    defaultProps={{ spec: EMPTY }} calculateMetadata={({ props }: any) => ({ durationInFrames: jpLen(props.spec) })} />
);
