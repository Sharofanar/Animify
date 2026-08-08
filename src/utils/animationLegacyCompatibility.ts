import type {
  AnimationClip,
  AnimationScene,
  Slide,
  SlideElement,
  SlideElementAnimation,
} from "../types/presentation";
import {
  ensureClipInLegacySequence,
  getLegacyAnimationId,
  removeAnimationClipsAndDirectEmptySequences,
} from "./animationCommandHelpers";
import { createAnimationSceneFromLegacyElements } from "./animationSchema";
import {
  cloneAnimationEasing,
  normalizeAnimationEasing,
  sortAnimationKeyframes,
} from "./animationKeyframeRules";

export type AnimationCommandElementUpdates = Partial<
  Omit<SlideElement, "style">
> & {
  style?: Partial<SlideElement["style"]>;
};

export type AnimationCommandBatchUpdate = {
  elementId: string;
  updates: AnimationCommandElementUpdates;
};

/**
 * Compatibility commands own immutable document transforms only. History,
 * Selection, Preview, assets, and Project timestamps remain with their callers.
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
  let elementsChanged = false;

  const nextElements = slide.elements.map((element) => {
    const updates = updatesByElementId.get(element.id);

    if (!updates) {
      return element;
    }

    const result = applyElementUpdates(element, updates);

    if (result.element === element) {
      return element;
    }

    elementsChanged = true;

    if (result.animationsChanged) {
      animationChangedElementIds.add(element.id);
    }

    return result.element;
  });

  if (!elementsChanged) {
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
 * Delete elements and repair every animation reference in the same immutable
 * transaction. Clip ownership cleanup is delegated to one shared Scene core.
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

  const nextScene = cloneSceneForCompatibility(scene);
  const removedClipIds = new Set<string>();
  let sceneChanged = false;

  for (const clip of Object.values(scene.clips)) {
    const nextTargets = clip.targets.filter(
      (target) => !deletedElementIds.has(target.elementId),
    );

    if (nextTargets.length === clip.targets.length) {
      continue;
    }

    sceneChanged = true;

    if (nextTargets.length === 0) {
      removedClipIds.add(clip.id);
      continue;
    }

    nextScene.clips[clip.id] = {
      ...clip,
      targets: nextTargets,
    };
  }

  if (
    removeAnimationClipsAndDirectEmptySequences(nextScene, removedClipIds)
  ) {
    sceneChanged = true;
  }

  for (const [sequenceId, sequence] of Object.entries(nextScene.sequences)) {
    const trigger = sequence.trigger;

    if (trigger.type !== "click" && trigger.type !== "hover") {
      continue;
    }

    if (
      !trigger.targetElementId ||
      !deletedElementIds.has(trigger.targetElementId)
    ) {
      continue;
    }

    sceneChanged = true;
    nextScene.sequences[sequenceId] = {
      ...sequence,

      // Page click remains valid; hover needs an explicit non-target fallback.
      trigger: trigger.type === "click" ? { type: "click" } : { type: "manual" },
    };
  }

  if (sceneChanged) {
    nextScene.revision = Math.max(1, scene.revision + 1);
  }

  return {
    ...slide,
    elements: nextElements,
    animationScene: sceneChanged ? nextScene : scene,
  };
}

/**
 * Native V2 Clips only need one live target. Legacy-backed Clips additionally
 * require a matching temporary element.animations mirror on a live target.
 */
export function isAnimationClipLiveForElements(
  clip: AnimationClip,
  elements: readonly SlideElement[],
) {
  const targetElements = clip.targets.flatMap((target) => {
    const element = elements.find((item) => item.id === target.elementId);
    return element ? [element] : [];
  });

  if (targetElements.length === 0) {
    return false;
  }

  const legacyAnimationId = getLegacyAnimationId(clip);

  if (!legacyAnimationId) {
    return true;
  }

  return targetElements.some((element) =>
    element.animations.some(
      (animation) => animation.id === legacyAnimationId,
    ),
  );
}

function applyElementUpdates(
  element: SlideElement,
  updates: AnimationCommandElementUpdates,
) {
  const { style, animations, ...topLevelUpdates } = updates;
  const hasAnimationUpdate = Object.prototype.hasOwnProperty.call(
    updates,
    "animations",
  );
  const animationsChanged =
    hasAnimationUpdate &&
    animations !== undefined &&
    !legacyAnimationsEqual(element.animations, animations);
  const topLevelChanged = Object.entries(topLevelUpdates).some(
    ([key, value]) =>
      !Object.is((element as unknown as Record<string, unknown>)[key], value),
  );
  const styleChanged =
    style !== undefined &&
    Object.entries(style).some(
      ([key, value]) =>
        !Object.is(
          (element.style as unknown as Record<string, unknown>)[key],
          value,
        ),
    );

  if (!animationsChanged && !topLevelChanged && !styleChanged) {
    return {
      element,
      animationsChanged: false,
    };
  }

  const nextElement: SlideElement = {
    ...element,
    ...topLevelUpdates,
    animations:
      animationsChanged && animations ? animations : element.animations,
    style: styleChanged
      ? {
          ...element.style,
          ...style,
        }
      : element.style,
  };

  return {
    element: nextElement,
    animationsChanged,
  };
}

function legacyAnimationsEqual(
  left: SlideElementAnimation[],
  right: SlideElementAnimation[] | undefined,
) {
  if (Object.is(left, right)) {
    return true;
  }

  if (!right || left.length !== right.length) {
    return false;
  }

  return left.every((animation, index) => {
    const other = right[index];

    return (
      other !== undefined &&
      animation.id === other.id &&
      animation.name === other.name &&
      animation.type === other.type &&
      animation.duration === other.duration &&
      animation.delay === other.delay &&
      animation.easing === other.easing &&
      animation.keyframes === other.keyframes
    );
  });
}

/**
 * Legacy mirrors cannot represent V2-only tracks, playback, or Sequence data,
 * so synchronization edits only the compatibility fields that actually changed.
 */
function synchronizeLegacyAnimationsToScene(
  slide: Slide,
  nextElements: SlideElement[],
  changedElementIds: ReadonlySet<string>,
): AnimationScene {
  const scene = slide.animationScene;

  if (!scene || scene.schemaVersion !== 2) {
    const rebuiltScene = createAnimationSceneFromLegacyElements(
      slide.id,
      nextElements,
    );

    return {
      ...rebuiltScene,
      revision: Math.max(1, (scene?.revision ?? 0) + 1),
    };
  }

  const nextScene = cloneSceneForCompatibility(scene);
  let sceneChanged = false;

  for (const elementId of changedElementIds) {
    const previousElement = slide.elements.find(
      (element) => element.id === elementId,
    );
    const nextElement = nextElements.find(
      (element) => element.id === elementId,
    );

    if (!nextElement) {
      continue;
    }

    if (
      synchronizeOneElementLegacyAnimations(
        nextScene,
        slide.id,
        previousElement,
        nextElement,
      )
    ) {
      sceneChanged = true;
    }
  }

  if (!sceneChanged) {
    return scene;
  }

  nextScene.revision = Math.max(1, scene.revision + 1);
  return nextScene;
}

function synchronizeOneElementLegacyAnimations(
  scene: AnimationScene,
  slideId: string,
  previousElement: SlideElement | undefined,
  element: SlideElement,
) {
  const nextLegacyAnimationIds = new Set(
    element.animations.map((animation) => animation.id),
  );
  const removedClipIds = new Set<string>();
  let changed = false;

  for (const clip of Object.values(scene.clips)) {
    const legacyAnimationId = getLegacyAnimationId(clip);

    if (
      !legacyAnimationId ||
      !clipTargetsElement(clip, element.id) ||
      nextLegacyAnimationIds.has(legacyAnimationId)
    ) {
      continue;
    }

    removedClipIds.add(clip.id);
  }

  if (
    removeAnimationClipsAndDirectEmptySequences(scene, removedClipIds)
  ) {
    changed = true;
  }

  for (const animation of element.animations) {
    const previousAnimation = previousElement?.animations.find(
      (item) => item.id === animation.id,
    );

    if (
      synchronizeOneLegacyAnimation(
        scene,
        slideId,
        element,
        previousAnimation,
        animation,
      )
    ) {
      changed = true;
    }
  }

  return changed;
}

function synchronizeOneLegacyAnimation(
  scene: AnimationScene,
  slideId: string,
  element: SlideElement,
  previousAnimation: SlideElementAnimation | undefined,
  animation: SlideElementAnimation,
) {
  const existingClip = findLegacyClip(scene, element.id, animation.id);

  if (
    existingClip &&
    existingClip.sourcePreset?.presetId === animation.keyframes
  ) {
    const legacyEasingChanged =
      previousAnimation?.easing !== animation.easing;
    const nextTracks = legacyEasingChanged
      ? synchronizeLegacyCssEasing(existingClip, animation.easing)
      : existingClip.tracks;
    const sourcePresetChanged =
      existingClip.sourcePreset.presetVersion === undefined ||
      existingClip.sourcePreset.presetId !== animation.keyframes;
    const metadataChanged =
      existingClip.metadata?.legacyAnimationId !== animation.id ||
      existingClip.metadata?.legacyKeyframes !== animation.keyframes;
    const clipChanged =
      existingClip.name !== animation.name ||
      existingClip.category !== animation.type ||
      existingClip.startMs !== Math.max(0, animation.delay) ||
      existingClip.durationMs !== Math.max(1, animation.duration) ||
      sourcePresetChanged ||
      metadataChanged ||
      nextTracks !== existingClip.tracks;

    if (clipChanged) {
      scene.clips[existingClip.id] = {
        ...existingClip,
        name: animation.name,
        category: animation.type,
        startMs: Math.max(0, animation.delay),
        durationMs: Math.max(1, animation.duration),
        tracks: nextTracks,
        sourcePreset: {
          presetId: animation.keyframes,
          presetVersion: existingClip.sourcePreset.presetVersion ?? 1,
        },
        metadata: {
          ...existingClip.metadata,
          legacyAnimationId: animation.id,
          legacyKeyframes: animation.keyframes,
        },
      };
    }

    const ownershipChanged = ensureClipInLegacySequence(
      scene,
      slideId,
      existingClip.id,
    );

    return clipChanged || ownershipChanged;
  }

  if (existingClip) {
    removeAnimationClipsAndDirectEmptySequences(
      scene,
      new Set([existingClip.id]),
    );
  }

  const generatedScene = createAnimationSceneFromLegacyElements(slideId, [
    {
      ...element,
      animations: [animation],
    },
  ]);
  const generatedClip = Object.values(generatedScene.clips)[0];

  if (!generatedClip) {
    return existingClip !== undefined;
  }

  scene.clips[generatedClip.id] = generatedClip;
  ensureClipInLegacySequence(scene, slideId, generatedClip.id);
  return true;
}

/**
 * A changed legacy CSS easing owns every outgoing segment, but each Keyframe
 * receives an isolated object. Unrelated legacy edits preserve advanced easing.
 */
function synchronizeLegacyCssEasing(
  clip: AnimationClip,
  legacyEasing: string,
) {
  const normalizedEasing = normalizeAnimationEasing({
    type: "css",
    value: legacyEasing,
  });
  let tracksChanged = false;

  const nextTracks = clip.tracks.map((track) => {
    const finalKeyframeId = sortAnimationKeyframes(track.keyframes).at(-1)?.id;

    if (!finalKeyframeId || track.keyframes.length < 2) {
      return track;
    }

    tracksChanged = true;

    return {
      ...track,
      keyframes: track.keyframes.map((keyframe) =>
        keyframe.id === finalKeyframeId
          ? keyframe
          : {
              ...keyframe,
              easing: cloneAnimationEasing(normalizedEasing),
            },
      ),
    };
  });

  return tracksChanged ? nextTracks : clip.tracks;
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

function clipTargetsElement(clip: AnimationClip, elementId: string) {
  return clip.targets.some((target) => target.elementId === elementId);
}

/**
 * Compatibility edits never touch paths or markers, so keep those structures
 * shared while cloning only the Scene ownership records this domain mutates.
 */
function cloneSceneForCompatibility(scene: AnimationScene): AnimationScene {
  return {
    ...scene,
    sequenceOrder: [...scene.sequenceOrder],
    sequences: Object.fromEntries(
      Object.entries(scene.sequences).map(([sequenceId, sequence]) => [
        sequenceId,
        {
          ...sequence,
          clipIds: [...sequence.clipIds],
          playback: {
            ...sequence.playback,
          },
        },
      ]),
    ),
    clips: {
      ...scene.clips,
    },
    paths: scene.paths,
    markers: scene.markers,
  };
}
