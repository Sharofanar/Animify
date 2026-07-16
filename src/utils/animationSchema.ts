import type {
  AnimationEasing,
  AnimationKeyframe,
  AnimationProperty,
  AnimationScene,
  AnimationTrack,
  AnimationValue,
  PresentationProject,
  Slide,
  SlideElement,
  SlideElementAnimation,
} from "../types/presentation";

type LegacyKeyframeSeed = {
  offset: number;
  value: AnimationValue;
};

/**
 * Create an empty Animation Schema V2 scene for a new slide.
 */
export function createEmptyAnimationScene(): AnimationScene {
  return {
    schemaVersion: 2,
    revision: 1,
    sequenceOrder: [],
    sequences: {},
    clips: {},
    paths: {},
    markers: [],
  };
}

/**
 * Build one animation-property track from normalized keyframe values.
 */
function createTrack(
  clipId: string,
  name: string,
  property: AnimationProperty,
  keyframes: LegacyKeyframeSeed[],
  easing: AnimationEasing,
  valueMode: AnimationTrack["valueMode"] = "absolute",
  blendMode: AnimationTrack["blendMode"] = "replace",
): AnimationTrack {
  const safePropertyName = property.replace(/[^a-zA-Z0-9-]/g, "-");

  return {
    id: `${clipId}-track-${safePropertyName}`,
    name,
    property,
    enabled: true,
    valueMode,
    blendMode,
    keyframes: keyframes.map(
      (keyframe, index): AnimationKeyframe => ({
        id: `${clipId}-track-${safePropertyName}-keyframe-${index}`,
        offset: keyframe.offset,
        value: keyframe.value,

        // Easing controls the segment after the current keyframe.
        easing: index < keyframes.length - 1 ? easing : undefined,
      }),
    ),
  };
}

/**
 * Convert one legacy preset name into editable Animation Schema V2 tracks.
 *
 * Unknown presets fall back to a fade track while preserving their original
 * preset ID in clip metadata, so no legacy information is discarded.
 */
function createLegacyTracks(
  clipId: string,
  animation: SlideElementAnimation,
): AnimationTrack[] {
  const easing: AnimationEasing = {
    type: "css",
    value: animation.easing,
  };

  switch (animation.keyframes) {
    case "slide-up":
    case "fade-in-up":
      return [
        createTrack(
          clipId,
          "透明度",
          "opacity",
          [
            { offset: 0, value: 0 },
            { offset: 1, value: 1 },
          ],
          easing,
        ),
        createTrack(
          clipId,
          "纵向位移",
          "transform.y",
          [
            { offset: 0, value: 28 },
            { offset: 1, value: 0 },
          ],
          easing,
          "relative",
          "add",
        ),
      ];

    case "zoom-in":
    case "scale-in":
      return [
        createTrack(
          clipId,
          "透明度",
          "opacity",
          [
            { offset: 0, value: 0 },
            { offset: 1, value: 1 },
          ],
          easing,
        ),
        createTrack(
          clipId,
          "水平缩放",
          "transform.scaleX",
          [
            { offset: 0, value: 0.92 },
            { offset: 1, value: 1 },
          ],
          easing,
        ),
        createTrack(
          clipId,
          "垂直缩放",
          "transform.scaleY",
          [
            { offset: 0, value: 0.92 },
            { offset: 1, value: 1 },
          ],
          easing,
        ),
      ];

    case "pulse":
      return [
        createTrack(
          clipId,
          "水平脉冲",
          "transform.scaleX",
          [
            { offset: 0, value: 1 },
            { offset: 0.5, value: 1.05 },
            { offset: 1, value: 1 },
          ],
          easing,
          "relative",
          "multiply",
        ),
        createTrack(
          clipId,
          "垂直脉冲",
          "transform.scaleY",
          [
            { offset: 0, value: 1 },
            { offset: 0.5, value: 1.05 },
            { offset: 1, value: 1 },
          ],
          easing,
          "relative",
          "multiply",
        ),
      ];

    case "float":
      return [
        createTrack(
          clipId,
          "浮动位移",
          "transform.y",
          [
            { offset: 0, value: 0 },
            { offset: 0.5, value: -14 },
            { offset: 1, value: 0 },
          ],
          easing,
          "relative",
          "add",
        ),
      ];

    case "fade-in":
    default:
      return [
        createTrack(
          clipId,
          "透明度",
          "opacity",
          [
            { offset: 0, value: 0 },
            { offset: 1, value: 1 },
          ],
          easing,
        ),
      ];
  }
}

/**
 * Convert legacy element animations into one slide-level Animation Schema V2
 * scene. IDs are deterministic so refreshing an old project does not generate
 * a different scene every time.
 */
export function createAnimationSceneFromLegacyElements(
  slideId: string,
  elements: SlideElement[],
): AnimationScene {
  const scene = createEmptyAnimationScene();
  const sequenceId = `sequence-${slideId}-legacy-slide-enter`;
  const clipIds: string[] = [];

  for (const element of elements) {
    for (const animation of element.animations) {
      const clipId = `clip-${element.id}-${animation.id}`;

      clipIds.push(clipId);

      scene.clips[clipId] = {
        id: clipId,
        name: animation.name,
        category: animation.type,
        targets: [
          {
            elementId: element.id,
          },
        ],
        startMs: Math.max(0, animation.delay),
        durationMs: Math.max(1, animation.duration),
        enabled: true,
        fill: "both",
        iterations: 1,
        direction: "normal",
        playbackRate: 1,
        tracks: createLegacyTracks(clipId, animation),
        sourcePreset: {
          presetId: animation.keyframes,
          presetVersion: 1,
        },
        metadata: {
          legacyAnimationId: animation.id,
          legacyKeyframes: animation.keyframes,
        },
      };
    }
  }

  if (clipIds.length === 0) {
    return scene;
  }

  scene.sequenceOrder = [sequenceId];
  scene.sequences[sequenceId] = {
    id: sequenceId,
    name: "旧版页面进入动画",
    trigger: {
      type: "slide-enter",
    },
    clipIds,
    durationMode: "auto",
    playback: {
      repeat: 1,
      direction: "normal",
      playbackRate: 1,
    },
  };

  return scene;
}

/**
 * Add Animation Schema V2 scenes to projects saved before the new schema was
 * introduced. Existing V2 scenes are preserved without being rebuilt.
 */
export function normalizeProjectAnimationScenes(
  project: PresentationProject,
): PresentationProject {
  let changed = false;

  const slides = project.slides.map((slide) => {
    if (slide.animationScene?.schemaVersion === 2) {
      return slide;
    }

    changed = true;

    return {
      ...slide,
      animationScene: createAnimationSceneFromLegacyElements(
        slide.id,
        slide.elements,
      ),
    } satisfies Slide;
  });

  if (!changed) {
    return project;
  }

  return {
    ...project,
    slides,
  };
}
