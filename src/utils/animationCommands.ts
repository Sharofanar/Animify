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
  getLegacySequenceId,
  removeEmptySequences,
} from "./animationCommandHelpers";
import {
  cloneElementAnimationsForInsertedElements,
} from "./animationElementClone";
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

export type AnimationCommandElementUpdates = Partial<
  Omit<SlideElement, "style">
> & {
  style?: Partial<SlideElement["style"]>;
};

export type AnimationCommandBatchUpdate = {
  elementId: string;
  updates: AnimationCommandElementUpdates;
};

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

/**
 * Delete slide elements and repair every animation reference in the same
 * transaction. Multi-target Clips keep their remaining targets; targetless Clips
 * and empty Sequences are removed.
 */
export function deleteSlideElementsWithAnimations(
  slide: Slide,
  elementIds: string[],
): Slide {
  const requestedElementIds = new Set(elementIds);
  const deletedElementIds = new Set(
    slide.elements
      .filter((element) => requestedElementIds.has(element.id))
      .map((element) => element.id),
  );

  if (deletedElementIds.size === 0) {
    return slide;
  }

  const nextElements = slide.elements.filter(
    (element) => !deletedElementIds.has(element.id),
  );
  const scene = slide.animationScene;

  if (!scene || scene.schemaVersion !== 2) {
    return {
      ...slide,
      elements: nextElements,
    };
  }

  const nextScene = cloneAnimationScene(scene);
  let animationChanged = false;

  for (const clip of Object.values(scene.clips)) {
    const nextTargets = clip.targets.filter(
      (target) => !deletedElementIds.has(target.elementId),
    );

    if (nextTargets.length === clip.targets.length) {
      continue;
    }

    animationChanged = true;

    if (nextTargets.length === 0) {
      removeClipFromScene(nextScene, clip.id);
      continue;
    }

    nextScene.clips[clip.id] = {
      ...clip,
      targets: nextTargets,
    };
  }

  for (const [sequenceId, sequence] of Object.entries(nextScene.sequences)) {
    const trigger = sequence.trigger;

    if (
      trigger.type !== "click" &&
      trigger.type !== "hover"
    ) {
      continue;
    }

    if (
      !trigger.targetElementId ||
      !deletedElementIds.has(trigger.targetElementId)
    ) {
      continue;
    }

    animationChanged = true;
    nextScene.sequences[sequenceId] = {
      ...sequence,

      // Page-click remains valid; hover falls back to explicit manual playback.
      trigger: trigger.type === "click" ? { type: "click" } : { type: "manual" },
    };
  }

  if (animationChanged) {
    removeEmptySequences(nextScene);
    nextScene.revision = Math.max(1, scene.revision + 1);
  }

  return {
    ...slide,
    elements: nextElements,
    animationScene: animationChanged ? nextScene : scene,
  };
}

/**
 * Check whether one Clip still belongs to live slide elements.
 *
 * Pure V2 Clips only need a valid target element. Legacy-compatible Clips must
 * additionally keep their matching element.animations entry; otherwise they are
 * stale migration records and must not appear in current editor views.
 */
export function isAnimationClipLiveForElements(
  clip: AnimationClip,
  elements: SlideElement[],
) {
  const targetElements =
    clip.targets.flatMap(
      (target) => {
        const element =
          elements.find(
            (item) =>
              item.id ===
              target.elementId,
          );

        return element
          ? [element]
          : [];
      },
    );

  if (
    targetElements.length === 0
  ) {
    return false;
  }

  const legacyAnimationId =
    getLegacyAnimationId(
      clip,
    );

  /**
   * Native V2 Clips do not require the temporary legacy compatibility mirror.
   */
  if (!legacyAnimationId) {
    return true;
  }

  return targetElements.some(
    (element) =>
      element.animations.some(
        (animation) =>
          animation.id ===
          legacyAnimationId,
      ),
  );
}

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
 * Apply a batch of element updates to one slide.
 *
 * Legacy element animation edits are synchronized into Animation Schema V2
 * incrementally. Timing changes preserve customized tracks and keyframes,
 * while choosing a different preset intentionally replaces that preset Clip.
 */
export function applyElementBatchUpdatesToSlide(
  slide: Slide,
  batchUpdates: AnimationCommandBatchUpdate[],
): Slide {
  if (batchUpdates.length === 0) {
    return slide;
  }

  const updatesByElementId = new Map(
    batchUpdates.map((item) => [item.elementId, item.updates]),
  );

  const animationChangedElementIds = new Set<string>();
  let changed = false;

  const nextElements = slide.elements.map((element) => {
    const updates = updatesByElementId.get(element.id);

    if (!updates) {
      return element;
    }

    changed = true;

    /**
     * An empty animations array still represents an animation change.
     */
    if (Object.prototype.hasOwnProperty.call(updates, "animations")) {
      animationChangedElementIds.add(element.id);
    }

    return {
      ...element,
      ...updates,
      style: updates.style
        ? {
            ...element.style,
            ...updates.style,
          }
        : element.style,
    };
  });

  if (!changed) {
    return slide;
  }

  if (animationChangedElementIds.size === 0) {
    return {
      ...slide,
      elements: nextElements,
    };
  }

  return {
    ...slide,
    elements: nextElements,
    animationScene: synchronizeLegacyAnimationsToScene(
      slide,
      nextElements,
      animationChangedElementIds,
    ),
  };
}

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

  removeClipFromScene(nextScene, clip.id);
  removeEmptySequences(nextScene);
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

/**
 * Synchronize only the legacy animations belonging to changed elements.
 *
 * Unlike rebuilding the entire scene, this preserves customized tracks on
 * every other element. Duration and delay changes also preserve customized
 * tracks on the same Clip.
 */
function synchronizeLegacyAnimationsToScene(
  slide: Slide,
  nextElements: SlideElement[],
  changedElementIds: Set<string>,
): AnimationScene {
  if (!slide.animationScene || slide.animationScene.schemaVersion !== 2) {
    const rebuiltScene = createAnimationSceneFromLegacyElements(
      slide.id,
      nextElements,
    );

    return {
      ...rebuiltScene,
      revision: Math.max(1, (slide.animationScene?.revision ?? 0) + 1),
    };
  }

  const nextScene = cloneAnimationScene(slide.animationScene);

  for (const elementId of changedElementIds) {
    const nextElement = nextElements.find(
      (element) => element.id === elementId,
    );

    if (!nextElement) {
      continue;
    }

    synchronizeOneElementLegacyAnimations(nextScene, slide.id, nextElement);
  }

  removeEmptyLegacySequence(nextScene, slide.id);

  return {
    ...nextScene,
    revision: Math.max(1, slide.animationScene.revision + 1),
  };
}

/**
 * Synchronize every legacy animation belonging to one element.
 */
function synchronizeOneElementLegacyAnimations(
  scene: AnimationScene,
  slideId: string,
  element: SlideElement,
) {
  const nextLegacyAnimationIds = new Set(
    element.animations.map((animation) => animation.id),
  );

  /**
   * Remove legacy-origin Clips that no longer exist on the element.
   * Custom Clips without legacyAnimationId are intentionally preserved.
   */
  for (const clip of Object.values(scene.clips)) {
    const legacyAnimationId = getLegacyAnimationId(clip);

    if (
      !legacyAnimationId ||
      !clipTargetsElement(clip, element.id) ||
      nextLegacyAnimationIds.has(legacyAnimationId)
    ) {
      continue;
    }

    removeClipFromScene(scene, clip.id);
  }

  for (const animation of element.animations) {
    synchronizeOneLegacyAnimation(scene, slideId, element, animation);
  }
}

/**
 * Synchronize one old element animation into its corresponding V2 Clip.
 */
function synchronizeOneLegacyAnimation(
  scene: AnimationScene,
  slideId: string,
  element: SlideElement,
  animation: SlideElementAnimation,
) {
  const existingClip = findLegacyClip(scene, element.id, animation.id);

  /**
   * Duration, delay, name, and easing compatibility changes do not require
   * rebuilding tracks when the source preset remains the same.
   */
  if (
    existingClip &&
    existingClip.sourcePreset?.presetId === animation.keyframes
  ) {
    scene.clips[existingClip.id] = {
      ...existingClip,
      name: animation.name,
      category: animation.type,
      startMs: Math.max(0, animation.delay),
      durationMs: Math.max(1, animation.duration),
      sourcePreset: {
        presetId: animation.keyframes,
        presetVersion: existingClip.sourcePreset?.presetVersion ?? 1,
      },
      metadata: {
        ...existingClip.metadata,
        legacyAnimationId: animation.id,
        legacyKeyframes: animation.keyframes,
      },
    };

    ensureClipInLegacySequence(scene, slideId, existingClip.id);

    return;
  }

  /**
   * Choosing another preset intentionally replaces the old preset tracks.
   */
  if (existingClip) {
    removeClipFromScene(scene, existingClip.id);
  }

  const generatedScene = createAnimationSceneFromLegacyElements(slideId, [
    {
      ...element,
      animations: [animation],
    },
  ]);

  const generatedClip = Object.values(generatedScene.clips)[0];

  if (!generatedClip) {
    return;
  }

  scene.clips[generatedClip.id] = generatedClip;

  ensureClipInLegacySequence(scene, slideId, generatedClip.id);
}

function findLegacyClip(
  scene: AnimationScene,
  elementId: string,
  legacyAnimationId: string,
) {
  return Object.values(scene.clips).find(
    (clip) =>
      getLegacyAnimationId(clip) === legacyAnimationId &&
      clipTargetsElement(clip, elementId),
  );
}

function getLegacyAnimationId(clip: AnimationClip) {
  const value = clip.metadata?.legacyAnimationId;

  return typeof value === "string" ? value : undefined;
}

function clipTargetsElement(clip: AnimationClip, elementId: string) {
  return clip.targets.some((target) => target.elementId === elementId);
}

function ensureClipInLegacySequence(
  scene: AnimationScene,
  slideId: string,
  clipId: string,
) {
  /**
   * A legacy-backed Clip may have been moved into a Click Step. Preserve that
   * explicit ownership instead of silently adding a second trigger Sequence.
   */
  if (
    Object.values(scene.sequences).some((sequence) =>
      sequence.clipIds.includes(clipId),
    )
  ) {
    return;
  }

  const sequenceId = getLegacySequenceId(slideId);
  const oldSequence = scene.sequences[sequenceId];

  if (!oldSequence) {
    scene.sequences[sequenceId] = {
      id: sequenceId,
      name: "旧版页面进入动画",
      trigger: {
        type: "slide-enter",
      },
      clipIds: [clipId],
      durationMode: "auto",
      playback: {
        repeat: 1,
        direction: "normal",
        playbackRate: 1,
      },
    };

    if (!scene.sequenceOrder.includes(sequenceId)) {
      scene.sequenceOrder.push(sequenceId);
    }

    return;
  }

  if (oldSequence.clipIds.includes(clipId)) {
    return;
  }

  scene.sequences[sequenceId] = {
    ...oldSequence,
    clipIds: [...oldSequence.clipIds, clipId],
  };
}

function removeClipFromScene(scene: AnimationScene, clipId: string) {
  const nextClips = {
    ...scene.clips,
  };

  delete nextClips[clipId];
  scene.clips = nextClips;

  for (const [sequenceId, sequence] of Object.entries(scene.sequences)) {
    if (!sequence.clipIds.includes(clipId)) {
      continue;
    }

    scene.sequences[sequenceId] = {
      ...sequence,
      clipIds: sequence.clipIds.filter(
        (currentClipId) => currentClipId !== clipId,
      ),
    };
  }
}

function removeEmptyLegacySequence(scene: AnimationScene, slideId: string) {
  const sequenceId = getLegacySequenceId(slideId);
  const sequence = scene.sequences[sequenceId];

  if (!sequence || sequence.clipIds.length > 0) {
    return;
  }

  const nextSequences = {
    ...scene.sequences,
  };

  delete nextSequences[sequenceId];

  scene.sequences = nextSequences;
  scene.sequenceOrder = scene.sequenceOrder.filter(
    (currentSequenceId) => currentSequenceId !== sequenceId,
  );
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
