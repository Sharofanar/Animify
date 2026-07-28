import type {
  AnimationClip,
  AnimationScene,
  AnimationTrigger,
  PresentationProject,
  SlideElement,
} from "../types/presentation";
import { createEmptyAnimationScene } from "./animationSchema";

function isDefaultPageTitle(title: string) {
  return /^第\s*\d+\s*页$/.test(title);
}

function cloneAnimationSceneSnapshot(scene: AnimationScene) {
  return JSON.parse(JSON.stringify(scene)) as AnimationScene;
}

function remapAnimationTriggerTarget(
  trigger: AnimationTrigger,
  elementIdBySourceId: Map<string, string>,
): AnimationTrigger {
  if (trigger.type !== "click" && trigger.type !== "hover") {
    return trigger;
  }

  const targetElementId = trigger.targetElementId;
  const nextTargetElementId = targetElementId
    ? elementIdBySourceId.get(targetElementId)
    : undefined;

  return nextTargetElementId
    ? {
        ...trigger,
        targetElementId: nextTargetElementId,
      }
    : trigger;
}

function getDuplicatedLegacyAnimationId(
  clip: AnimationClip,
  sourceElements: SlideElement[],
  duplicatedElements: SlideElement[],
) {
  const sourceLegacyAnimationId = clip.metadata?.legacyAnimationId;

  if (typeof sourceLegacyAnimationId !== "string") {
    return undefined;
  }

  for (const target of clip.targets) {
    const sourceElementIndex = sourceElements.findIndex(
      (element) => element.id === target.elementId,
    );

    if (sourceElementIndex < 0) {
      continue;
    }

    const sourceAnimationIndex = sourceElements[
      sourceElementIndex
    ].animations.findIndex(
      (animation) => animation.id === sourceLegacyAnimationId,
    );

    if (sourceAnimationIndex < 0) {
      continue;
    }

    return duplicatedElements[sourceElementIndex]?.animations[
      sourceAnimationIndex
    ]?.id;
  }

  return undefined;
}

/**
 * Clone the complete V2 animation scene for a duplicated slide.
 *
 * Scene-local paths and markers keep their IDs and semantics, while every
 * identity participating in animation ownership is remapped to the copied
 * slide. The JSON snapshot also isolates nested easing and keyframe values from
 * later edits on either slide.
 */
function duplicateAnimationScene(
  sourceScene: AnimationScene,
  sourceElements: SlideElement[],
  duplicatedElements: SlideElement[],
  operationId: string,
): AnimationScene {
  const sceneSnapshot = cloneAnimationSceneSnapshot(sourceScene);
  const elementIdBySourceId = new Map(
    sourceElements.map((element, index) => [
      element.id,
      duplicatedElements[index]?.id ?? element.id,
    ]),
  );
  const sequenceIdBySourceId = new Map(
    Object.keys(sceneSnapshot.sequences).map((sequenceId) => [
      sequenceId,
      `${sequenceId}-${operationId}`,
    ]),
  );
  const clipIdBySourceId = new Map(
    Object.keys(sceneSnapshot.clips).map((clipId, clipIndex) => [
      clipId,
      `${clipId}-${operationId}-${clipIndex}`,
    ]),
  );

  const sequences = Object.fromEntries(
    Object.entries(sceneSnapshot.sequences).map(
      ([sourceSequenceId, sequence]) => {
        const nextSequenceId =
          sequenceIdBySourceId.get(sourceSequenceId) ??
          `${sourceSequenceId}-${operationId}`;

        return [
          nextSequenceId,
          {
            ...sequence,
            id: nextSequenceId,
            trigger: remapAnimationTriggerTarget(
              sequence.trigger,
              elementIdBySourceId,
            ),
            clipIds: sequence.clipIds.flatMap((clipId) => {
              const nextClipId = clipIdBySourceId.get(clipId);
              return nextClipId ? [nextClipId] : [];
            }),
          },
        ];
      },
    ),
  );

  const clips = Object.fromEntries(
    Object.entries(sceneSnapshot.clips).map(
      ([sourceClipId, clip], clipIndex) => {
        const nextClipId =
          clipIdBySourceId.get(sourceClipId) ??
          `${sourceClipId}-${operationId}-${clipIndex}`;
        const nextLegacyAnimationId = getDuplicatedLegacyAnimationId(
          clip,
          sourceElements,
          duplicatedElements,
        );
        const metadata = nextLegacyAnimationId
          ? {
              ...clip.metadata,
              legacyAnimationId: nextLegacyAnimationId,
            }
          : clip.metadata;

        return [
          nextClipId,
          {
            ...clip,
            id: nextClipId,
            targets: clip.targets.map((target) => ({
              ...target,
              elementId:
                elementIdBySourceId.get(target.elementId) ?? target.elementId,
            })),
            tracks: clip.tracks.map((track, trackIndex) => {
              const nextTrackId = `${nextClipId}-track-${trackIndex}`;

              return {
                ...track,
                id: nextTrackId,
                keyframes: track.keyframes.map(
                  (keyframe, keyframeIndex) => ({
                    ...keyframe,
                    id: `${nextTrackId}-keyframe-${keyframeIndex}`,
                  }),
                ),
              };
            }),
            metadata,
          },
        ];
      },
    ),
  );

  return {
    ...sceneSnapshot,
    sequenceOrder: sceneSnapshot.sequenceOrder.flatMap((sequenceId) => {
      const nextSequenceId = sequenceIdBySourceId.get(sequenceId);
      return nextSequenceId ? [nextSequenceId] : [];
    }),
    sequences,
    clips,
  };
}

export function normalizeSlideTitles(slides: PresentationProject["slides"]) {
  return slides.map((slide, index) => {
    if (!isDefaultPageTitle(slide.title)) {
      return slide;
    }

    const nextTitle = `第 ${index + 1} 页`;

    if (slide.title === nextTitle) {
      return slide;
    }

    return {
      ...slide,
      title: nextTitle,
    };
  });
}

export function createBlankSlide(
  slideNumber: number,
): PresentationProject["slides"][number] {
  const now = Date.now();
  const slideId = `slide-${now}`;

  return {
    id: slideId,
    title: `第 ${slideNumber} 页`,
    backgroundColor: "#f8fafc",
    animationScene: createEmptyAnimationScene(),
    elements: [
      {
        id: `element-title-${now}`,
        type: "text",
        name: "标题",
        content: "双击编辑标题",
        style: {
          x: 130,
          y: 180,
          width: 1020,
          height: 96,
          rotate: 0,
          opacity: 1,
          color: "#0f172a",
          fontSize: 64,
          fontWeight: 800,
        },
        animations: [],
      },
      {
        id: `element-subtitle-${now}`,
        type: "text",
        name: "副标题",
        content: "双击编辑副标题",
        style: {
          x: 220,
          y: 320,
          width: 840,
          height: 64,
          rotate: 0,
          opacity: 1,
          color: "#475569",
          fontSize: 36,
          fontWeight: 500,
        },
        animations: [],
      },
    ],
  };
}

export function duplicateSlide(
  slide: PresentationProject["slides"][number],
  slideNumber: number,
): PresentationProject["slides"][number] {
  const now = Date.now();
  const duplicatedSlideId = `slide-copy-${now}`;
  const operationId = `slide-copy-${now}`;

  const duplicatedElements = slide.elements.map((element, elementIndex) => ({
    ...element,
    id: `${element.id}-copy-${now}-${elementIndex}`,

    media: element.media
      ? {
          ...element.media,
        }
      : undefined,

    style: {
      ...element.style,
    },
    animations: element.animations.map((animation, animationIndex) => ({
      ...animation,
      id: `${animation.id}-copy-${now}-${elementIndex}-${animationIndex}`,
    })),
  }));

  return {
    ...slide,
    id: duplicatedSlideId,
    title: `第 ${slideNumber} 页`,
    elements: duplicatedElements,

    /**
     * Preserve the exact V2 Scene instead of rebuilding it from the temporary
     * legacy mirror, which cannot represent custom Tracks or Keyframes.
     */
    animationScene: duplicateAnimationScene(
      slide.animationScene,
      slide.elements,
      duplicatedElements,
      operationId,
    ),
  };
}
