import type {
  AnimationClip,
  AnimationEasing,
  AnimationScene,
  Slide,
  SlideElement,
  SlideElementAnimation,
} from "../types/presentation";
import {
  cloneAnimationScene,
  ensureClipInLegacySequence,
  getLegacyAnimationId,
  getLegacySequenceId,
  removeAnimationClipsAndDirectEmptySequences,
} from "./animationCommandHelpers";
import {
  cloneElementAnimationsForInsertedElements,
} from "./animationElementClone";
import {
  applyElementBatchUpdatesToSlide,
} from "./animationLegacyCompatibility";
import { createAnimationSceneFromLegacyElements } from "./animationSchema";
import {
  getAnimationSequenceForClip,
  getAnimationSequenceLastTargetEndMs,
} from "./animationSequence";
import {
  animationEasingsEqual,
  normalizeAnimationEasing,
} from "./animationKeyframeRules";

/**
 * Preserve the original public import path while Sequence commands live in a
 * lower-level domain module that never imports this compatibility barrel.
 */
export {
  createAnimationClickStepInSlide,
  getAnimationClickSteps,
  moveAnimationClickStepInSlide,
  setAnimationSequenceTriggerInSlide,
  updateAnimationClickStepInSlide,
} from "./animationSequenceCommands";
export type {
  CreateAnimationClickStepCommand,
  MoveAnimationClickStepCommand,
  SetAnimationSequenceTriggerCommand,
  UpdateAnimationClickStepCommand,
} from "./animationSequenceCommands";

/**
 * Preserve the original public import path while Keyframe commands live in a
 * pure domain module that does not import this compatibility barrel.
 */
export {
  addAnimationKeyframeToSlide,
  deleteAnimationKeyframeFromSlide,
  updateAnimationKeyframeEasingInSlide,
  updateAnimationKeyframeOffsetInSlide,
  updateAnimationKeyframeValueInSlide,
} from "./animationKeyframeCommands";
export type {
  AddAnimationKeyframeCommand,
  AddAnimationKeyframeRequest,
  AddAnimationKeyframeResult,
  DeleteAnimationKeyframeCommand,
  UpdateAnimationKeyframeEasingCommand,
  UpdateAnimationKeyframeOffsetCommand,
  UpdateAnimationKeyframeValueCommand,
} from "./animationKeyframeCommands";

/**
 * Preserve the original public import path while legacy/V2 synchronization and
 * Scene cleanup live below this compatibility barrel.
 */
export {
  applyElementBatchUpdatesToSlide,
  deleteSlideElementsWithAnimations,
  isAnimationClipLiveForElements,
} from "./animationLegacyCompatibility";
export type {
  AnimationCommandBatchUpdate,
  AnimationCommandElementUpdates,
} from "./animationLegacyCompatibility";

export type AddAnimationClipCommand = {
  elementId: string;
  presetId: string;
  name: string;
  category?: SlideElementAnimation["type"];
  durationMs?: number;
  easing?: string;
};

export type DuplicateAnimationClipCommand = {
  clipId: string;
};

export type DeleteAnimationClipCommand = {
  clipId: string;
};

export type UpdateAnimationClipTimingCommand = {
  clipId: string;
  updates: {
    startMs?: number;
    durationMs?: number;
    iterations?: number;
    direction?: AnimationClip["direction"];
    playbackRate?: number;
  };
};

export type UpdateAnimationClipEasingCommand = {
  clipId: string;

  /**
   * Apply one easing to every outgoing keyframe segment inside the Clip.
   */
  easing?: AnimationEasing;
};

/**
 * Add one preset-based Clip to an element.
 *
 * The compatibility animation entry remains on the element while the command
 * layer incrementally creates the matching V2 Clip. New Clips are placed after
 * the final Clip targeting the same element inside the slide-enter Sequence.
 */
export function addAnimationClipToSlide(
  slide: Slide,
  command: AddAnimationClipCommand,
): Slide {
  const element = slide.elements.find(
    (currentElement) => currentElement.id === command.elementId,
  );

  if (!element) {
    return slide;
  }

  const scene =
    slide.animationScene?.schemaVersion === 2
      ? slide.animationScene
      : createAnimationSceneFromLegacyElements(slide.id, slide.elements);

  const targetSequenceId = getLegacySequenceId(slide.id);
  const startMs = getAnimationSequenceLastTargetEndMs(
    scene,
    targetSequenceId,
    [element.id],
  );
  const animationId = createUniqueLegacyAnimationId(slide, element.id);

  const animation: SlideElementAnimation = {
    id: animationId,
    name: command.name.trim() || "新动画",
    type: command.category ?? "enter",
    duration: Math.max(1, command.durationMs ?? 600),
    delay: startMs,
    easing: command.easing?.trim() || "ease-out",
    keyframes: command.presetId,
  };

  return applyElementBatchUpdatesToSlide(slide, [
    {
      elementId: element.id,
      updates: {
        animations: [...element.animations, animation],
      },
    },
  ]);
}

/**
 * Duplicate one V2 Clip without rebuilding its customized tracks.
 *
 * Track values, keyframe positions, and easing definitions are copied with new
 * IDs. The compatibility animation mirror is duplicated when the source Clip
 * originated from a legacy-compatible preset.
 */
export function duplicateAnimationClipInSlide(
  slide: Slide,
  command: DuplicateAnimationClipCommand,
): Slide {
  const scene = slide.animationScene;
  const sourceClip = scene?.clips[command.clipId];

  if (!scene || scene.schemaVersion !== 2 || !sourceClip) {
    return slide;
  }

  const targetElementIds = sourceClip.targets.map((target) => target.elementId);
  const sourceSequence = getAnimationSequenceForClip(scene, sourceClip.id);
  const targetSequenceId =
    sourceSequence?.id ?? getLegacySequenceId(slide.id);
  const startMs = getAnimationSequenceLastTargetEndMs(
    scene,
    targetSequenceId,
    targetElementIds,
  );
  const nextClipId = createUniqueClipId(scene, `${sourceClip.id}-copy`);
  const sourceLegacyAnimationId = getLegacyAnimationId(sourceClip);

  const nextLegacyAnimationId = sourceLegacyAnimationId
    ? createUniqueLegacyAnimationId(
        slide,
        targetElementIds[0] ?? "element",
      )
    : undefined;

  const nextClip = cloneAnimationClipForDuplicate(
    sourceClip,
    nextClipId,
    nextLegacyAnimationId,
    startMs,
  );

  const nextScene = cloneAnimationScene(scene);
  nextScene.clips[nextClipId] = nextClip;

  const insertedIntoSequence = sourceSequence
    ? insertClipAfterSourceInSequence(
        nextScene,
        sourceSequence.id,
        sourceClip.id,
        nextClipId,
      )
    : false;

  if (!insertedIntoSequence) {
    ensureClipInLegacySequence(nextScene, slide.id, nextClipId);
  }

  nextScene.revision = Math.max(1, scene.revision + 1);

  let elementsChanged = false;

  const nextElements =
    sourceLegacyAnimationId && nextLegacyAnimationId
      ? slide.elements.map((element) => {
          if (!targetElementIds.includes(element.id)) {
            return element;
          }

          const sourceAnimation = element.animations.find(
            (animation) => animation.id === sourceLegacyAnimationId,
          );

          if (!sourceAnimation) {
            return element;
          }

          elementsChanged = true;

          return {
            ...element,
            animations: [
              ...element.animations,
              {
                ...sourceAnimation,
                id: nextLegacyAnimationId,
                name: `${sourceAnimation.name} 副本`,
                delay: startMs,
                duration: sourceClip.durationMs,
              },
            ],
          };
        })
      : slide.elements;

  return {
    ...slide,
    elements: elementsChanged ? nextElements : slide.elements,
    animationScene: nextScene,
  };
}

/**
 * Copy the exact V2 Clips belonging to inserted element copies.
 *
 * This preserves customized tracks, keyframes, easing, sequence-local timing,
 * playback configuration, and stagger settings. The pure kernel owns the
 * locked cross-slide trigger and slide-enter rules.
 *
 * The source scene may come from the current slide or from an internal clipboard
 * snapshot captured before the user switched to another slide.
 */
export function cloneElementAnimationsToInsertedElements(
  targetSlide: Slide,
  sourceScene: AnimationScene,
  sourceSlideId: string,
  sourceElements: SlideElement[],
  insertedElements: SlideElement[],
  operationId: string,
): Slide {
  return cloneElementAnimationsForInsertedElements({
    targetSlide,
    sourceScene,
    sourceSlideId,
    sourceElements,
    insertedElements,
    operationId,
  });
}

/**
 * Delete one Clip and remove its temporary compatibility animation entry.
 */
export function deleteAnimationClipFromSlide(
  slide: Slide,
  command: DeleteAnimationClipCommand,
): Slide {
  const scene = slide.animationScene;
  const clip = scene?.clips[command.clipId];

  if (!scene || scene.schemaVersion !== 2 || !clip) {
    return slide;
  }

  const legacyAnimationId = getLegacyAnimationId(clip);
  const targetElementIds = new Set(
    clip.targets.map((target) => target.elementId),
  );
  const nextScene = cloneAnimationScene(scene);

  removeAnimationClipsAndDirectEmptySequences(
    nextScene,
    new Set([clip.id]),
  );
  nextScene.revision = Math.max(1, scene.revision + 1);

  let elementsChanged = false;

  const nextElements = legacyAnimationId
    ? slide.elements.map((element) => {
        if (!targetElementIds.has(element.id)) {
          return element;
        }

        const nextAnimations = element.animations.filter(
          (animation) => animation.id !== legacyAnimationId,
        );

        if (nextAnimations.length === element.animations.length) {
          return element;
        }

        elementsChanged = true;

        return {
          ...element,
          animations: nextAnimations,
        };
      })
    : slide.elements;

  return {
    ...slide,
    elements: elementsChanged ? nextElements : slide.elements,
    animationScene: nextScene,
  };
}

/**
 * Update timing and playback settings on one Animation Schema V2 Clip.
 *
 * Start time and duration are mirrored back into the matching legacy
 * element.animations entry. This keeps the narrow quick-property panel in sync
 * while animationScene remains the authoritative advanced-animation source.
 */
export function updateAnimationClipTimingInSlide(
  slide: Slide,
  command: UpdateAnimationClipTimingCommand,
): Slide {
  const scene = slide.animationScene;
  const clip = scene?.clips[command.clipId];

  if (!scene || scene.schemaVersion !== 2 || !clip) {
    return slide;
  }

  const updates = command.updates;
  let nextClip: AnimationClip = {
    ...clip,
  };
  let changed = false;

  const updatesStartMs = Object.prototype.hasOwnProperty.call(
    updates,
    "startMs",
  );

  const updatesDurationMs = Object.prototype.hasOwnProperty.call(
    updates,
    "durationMs",
  );

  if (
    updatesStartMs &&
    typeof updates.startMs === "number" &&
    Number.isFinite(updates.startMs)
  ) {
    const nextStartMs = Math.max(0, Math.round(updates.startMs));

    if (nextStartMs !== nextClip.startMs) {
      nextClip = {
        ...nextClip,
        startMs: nextStartMs,
      };
      changed = true;
    }
  }

  if (
    updatesDurationMs &&
    typeof updates.durationMs === "number" &&
    Number.isFinite(updates.durationMs)
  ) {
    const nextDurationMs = Math.max(1, Math.round(updates.durationMs));

    if (nextDurationMs !== nextClip.durationMs) {
      nextClip = {
        ...nextClip,
        durationMs: nextDurationMs,
      };
      changed = true;
    }
  }

  if (
    typeof updates.iterations === "number" &&
    Number.isFinite(updates.iterations)
  ) {
    /**
     * Basic mode uses whole repeat counts. Fractional repeats may be exposed
     * later through an expert playback mode.
     */
    const nextIterations = Math.min(
      100,
      Math.max(1, Math.round(updates.iterations)),
    );

    if (nextIterations !== nextClip.iterations) {
      nextClip = {
        ...nextClip,
        iterations: nextIterations,
      };
      changed = true;
    }
  }

  if (
    updates.direction !== undefined &&
    updates.direction !== nextClip.direction
  ) {
    nextClip = {
      ...nextClip,
      direction: updates.direction,
    };
    changed = true;
  }

  if (
    typeof updates.playbackRate === "number" &&
    Number.isFinite(updates.playbackRate)
  ) {
    /**
     * Extremely small or large playback rates are difficult to control and can
     * make browser animation timing appear frozen, so basic mode limits them.
     */
    const nextPlaybackRate = Math.min(16, Math.max(0.05, updates.playbackRate));

    if (!Object.is(nextPlaybackRate, nextClip.playbackRate ?? 1)) {
      nextClip = {
        ...nextClip,
        playbackRate: nextPlaybackRate,
      };
      changed = true;
    }
  }

  if (!changed) {
    return slide;
  }

  nextClip = {
    ...nextClip,
    metadata: {
      ...nextClip.metadata,
      customized: true,
    },
  };

  const legacyAnimationId = getLegacyAnimationId(clip);
  const targetElementIds = new Set(
    clip.targets.map((target) => target.elementId),
  );

  /**
   * Only delay and duration have equivalents in the temporary legacy model.
   * Looping, direction, and Clip speed remain V2-only settings.
   */
  const nextElements =
    legacyAnimationId && (updatesStartMs || updatesDurationMs)
      ? slide.elements.map((element) => {
          if (!targetElementIds.has(element.id)) {
            return element;
          }

          let animationChanged = false;

          const nextAnimations = element.animations.map((animation) => {
            if (animation.id !== legacyAnimationId) {
              return animation;
            }

            const nextDelay = updatesStartMs
              ? nextClip.startMs
              : animation.delay;

            const nextDuration = updatesDurationMs
              ? nextClip.durationMs
              : animation.duration;

            if (
              nextDelay === animation.delay &&
              nextDuration === animation.duration
            ) {
              return animation;
            }

            animationChanged = true;

            return {
              ...animation,
              delay: nextDelay,
              duration: nextDuration,
            };
          });

          if (!animationChanged) {
            return element;
          }

          return {
            ...element,
            animations: nextAnimations,
          };
        })
      : slide.elements;

  return {
    ...slide,
    elements: nextElements,
    animationScene: {
      ...scene,
      revision: Math.max(1, scene.revision + 1),
      clips: {
        ...scene.clips,
        [clip.id]: nextClip,
      },
    },
  };
}

/**
 * Apply one easing to every segment of one Animation Schema V2 Clip.
 *
 * This is used by multi-selection batch editing. Specific per-segment easing
 * remains available through the single-element track inspector.
 */
export function updateAnimationClipEasingInSlide(
  slide: Slide,
  command: UpdateAnimationClipEasingCommand,
): Slide {
  const scene = slide.animationScene;
  const clip = scene?.clips[command.clipId];

  if (!scene || scene.schemaVersion !== 2 || !clip) {
    return slide;
  }

  const normalizedEasing =
    normalizeAnimationEasing(command.easing);

  let tracksChanged = false;

  const nextTracks = clip.tracks.map((track) => {
    const sortedKeyframes = [...track.keyframes].sort(
      (left, right) =>
        left.offset - right.offset ||
        left.id.localeCompare(right.id),
    );

    const finalKeyframeId =
      sortedKeyframes.at(-1)?.id;

    if (!finalKeyframeId) {
      return track;
    }

    let trackChanged = false;

    const nextKeyframes = track.keyframes.map(
      (keyframe) => {
        const nextEasing =
          keyframe.id === finalKeyframeId
            ? undefined
            : normalizedEasing;

        if (
          animationEasingsEqual(
            keyframe.easing,
            nextEasing,
          )
        ) {
          return keyframe;
        }

        trackChanged = true;
        tracksChanged = true;

        return {
          ...keyframe,
          easing: nextEasing,
        };
      },
    );

    if (!trackChanged) {
      return track;
    }

    return {
      ...track,
      keyframes: nextKeyframes,
    };
  });

  /**
   * Keep the temporary legacy animation mirror aligned where the selected
   * easing has a CSS-compatible string representation.
   */
  const legacyAnimationId =
    getLegacyAnimationId(clip);

  const legacyEasing =
    animationEasingToLegacyString(
      normalizedEasing,
    );

  const targetElementIds = new Set(
    clip.targets.map(
      (target) => target.elementId,
    ),
  );

  let elementsChanged = false;

  const nextElements =
    legacyAnimationId && legacyEasing
      ? slide.elements.map((element) => {
          if (
            !targetElementIds.has(element.id)
          ) {
            return element;
          }

          let elementChanged = false;

          const nextAnimations =
            element.animations.map(
              (animation) => {
                if (
                  animation.id !==
                    legacyAnimationId ||
                  animation.easing ===
                    legacyEasing
                ) {
                  return animation;
                }

                elementChanged = true;
                elementsChanged = true;

                return {
                  ...animation,
                  easing: legacyEasing,
                };
              },
            );

          if (!elementChanged) {
            return element;
          }

          return {
            ...element,
            animations: nextAnimations,
          };
        })
      : slide.elements;

  if (!tracksChanged && !elementsChanged) {
    return slide;
  }

  const nextClip: AnimationClip = tracksChanged
    ? {
        ...clip,
        tracks: nextTracks,
        metadata: {
          ...clip.metadata,
          customized: true,
        },
      }
    : clip;

  return {
    ...slide,
    elements: nextElements,
    animationScene: tracksChanged
      ? {
          ...scene,
          revision: Math.max(
            1,
            scene.revision + 1,
          ),
          clips: {
            ...scene.clips,
            [clip.id]: nextClip,
          },
        }
      : scene,
  };
}

/**
 * Convert one V2 easing into the legacy CSS easing string.
 */
function animationEasingToLegacyString(
  easing?: AnimationEasing,
) {
  if (!easing) {
    return "linear";
  }

  switch (easing.type) {
    case "css":
      return easing.value;

    case "cubic-bezier":
      return `cubic-bezier(${easing.x1}, ${easing.y1}, ${easing.x2}, ${easing.y2})`;

    case "steps":
      return `steps(${easing.count}, ${easing.position})`;

    case "spring":
    case "bounce":
    case "custom-curve":
      return undefined;
  }
}

function createUniqueLegacyAnimationId(slide: Slide, elementId: string) {
  const existingAnimationIds = new Set(
    slide.elements.flatMap((element) =>
      element.animations.map((animation) => animation.id),
    ),
  );

  const baseId = `animation-${elementId}-${Date.now()}`;
  let nextId = baseId;
  let suffix = 1;

  while (existingAnimationIds.has(nextId)) {
    nextId = `${baseId}-${suffix}`;
    suffix += 1;
  }

  return nextId;
}

function createUniqueClipId(scene: AnimationScene, preferredBaseId: string) {
  const safeBaseId = preferredBaseId.replace(/[^a-zA-Z0-9-_]/g, "-");
  const timestampedBaseId = `${safeBaseId}-${Date.now()}`;
  let nextId = timestampedBaseId;
  let suffix = 1;

  while (scene.clips[nextId]) {
    nextId = `${timestampedBaseId}-${suffix}`;
    suffix += 1;
  }

  return nextId;
}

function cloneAnimationClipForDuplicate(
  sourceClip: AnimationClip,
  nextClipId: string,
  nextLegacyAnimationId: string | undefined,
  startMs: number,
): AnimationClip {
  const metadata: Record<string, string | number | boolean> = {
    ...sourceClip.metadata,
    customized: true,
  };

  if (nextLegacyAnimationId) {
    metadata.legacyAnimationId = nextLegacyAnimationId;
  } else {
    delete metadata.legacyAnimationId;
  }

  return {
    ...sourceClip,
    id: nextClipId,
    name: `${sourceClip.name} 副本`,
    targets: sourceClip.targets.map((target) => ({
      ...target,
      subTarget: target.subTarget ? { ...target.subTarget } : undefined,
    })),
    startMs,
    tracks: sourceClip.tracks.map((track, trackIndex) => {
      const nextTrackId = `${nextClipId}-track-${trackIndex}`;

      return {
        ...track,
        id: nextTrackId,
        keyframes: track.keyframes.map((keyframe, keyframeIndex) => ({
          ...keyframe,
          id: `${nextTrackId}-keyframe-${keyframeIndex}`,
        })),
      };
    }),
    stagger: sourceClip.stagger
      ? {
          ...sourceClip.stagger,
        }
      : undefined,
    sourcePreset: sourceClip.sourcePreset
      ? {
          ...sourceClip.sourcePreset,
        }
      : undefined,
    metadata,
  };
}

function insertClipAfterSourceInSequence(
  scene: AnimationScene,
  sequenceId: string,
  sourceClipId: string,
  nextClipId: string,
) {
  const sequence = scene.sequences[sequenceId];
  const sourceIndex = sequence?.clipIds.indexOf(sourceClipId) ?? -1;

  if (!sequence || sourceIndex < 0) {
    return false;
  }

  const nextClipIds = [...sequence.clipIds];
  nextClipIds.splice(sourceIndex + 1, 0, nextClipId);

  scene.sequences[sequenceId] = {
    ...sequence,
    clipIds: nextClipIds,
  };

  return true;
}
