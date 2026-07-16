import type {
  AnimationClip,
  AnimationKeyframe,
  AnimationScene,
  AnimationValue,
  Slide,
  SlideElement,
  SlideElementAnimation,
} from "../types/presentation";
import { createAnimationSceneFromLegacyElements } from "./animationSchema";

export type AnimationCommandElementUpdates = Partial<
  Omit<SlideElement, "style">
> & {
  style?: Partial<SlideElement["style"]>;
};

export type AnimationCommandBatchUpdate = {
  elementId: string;
  updates: AnimationCommandElementUpdates;
};

export type UpdateAnimationKeyframeValueCommand = {
  clipId: string;
  trackId: string;
  keyframeId: string;
  value: AnimationValue;
};

export type UpdateAnimationKeyframeOffsetCommand = {
  clipId: string;
  trackId: string;
  keyframeId: string;

  /**
   * Normalized position inside the animation track, from 0 to 1.
   */
  offset: number;
};

export type AddAnimationKeyframeCommand = {
  clipId: string;
  trackId: string;
};

export type DeleteAnimationKeyframeCommand = {
  clipId: string;
  trackId: string;
  keyframeId: string;
};

/**
 * Basic timeline editing keeps adjacent keyframes at least 0.1% apart.
 *
 * Advanced overlapping and instant-jump keyframes can be enabled later through
 * a dedicated expert editing mode.
 */
const MINIMUM_KEYFRAME_OFFSET_GAP = 0.001;

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
 * Update one Animation Schema V2 keyframe value.
 *
 * This command edits animationScene directly. Legacy element.animations has no
 * place to store arbitrary keyframe values, so it remains only a compatibility
 * mirror for preset name, duration, delay, and easing.
 */
export function updateAnimationKeyframeValueInSlide(
  slide: Slide,
  command: UpdateAnimationKeyframeValueCommand,
): Slide {
  const scene = slide.animationScene;
  const clip = scene?.clips[command.clipId];

  if (!scene || scene.schemaVersion !== 2 || !clip) {
    return slide;
  }

  const trackIndex = clip.tracks.findIndex(
    (track) => track.id === command.trackId,
  );

  if (trackIndex < 0) {
    return slide;
  }

  const track = clip.tracks[trackIndex];
  const keyframeIndex = track.keyframes.findIndex(
    (keyframe) => keyframe.id === command.keyframeId,
  );

  if (keyframeIndex < 0) {
    return slide;
  }

  const oldKeyframe = track.keyframes[keyframeIndex];

  if (animationValuesEqual(oldKeyframe.value, command.value)) {
    return slide;
  }

  const nextKeyframes = [...track.keyframes];

  nextKeyframes[keyframeIndex] = {
    ...oldKeyframe,
    value: command.value,
  };

  const nextTracks = [...clip.tracks];

  nextTracks[trackIndex] = {
    ...track,
    keyframes: nextKeyframes,
  };

  const nextClip: AnimationClip = {
    ...clip,
    tracks: nextTracks,
    metadata: {
      ...clip.metadata,

      /**
       * Customized prevents future compatibility logic from treating this Clip
       * as an untouched copy of its source preset.
       */
      customized: true,
    },
  };

  return {
    ...slide,
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
 * Update one Animation Schema V2 keyframe position.
 *
 * The editor displays the position as a percentage, while animationScene stores
 * it as a normalized offset from 0 to 1. Keyframes are sorted after the update
 * so the inspector and compiler always read them in timeline order.
 */
export function updateAnimationKeyframeOffsetInSlide(
  slide: Slide,
  command: UpdateAnimationKeyframeOffsetCommand,
): Slide {
  const scene = slide.animationScene;
  const clip = scene?.clips[command.clipId];

  if (
    !scene ||
    scene.schemaVersion !== 2 ||
    !clip ||
    !Number.isFinite(command.offset)
  ) {
    return slide;
  }

  const trackIndex = clip.tracks.findIndex(
    (track) => track.id === command.trackId,
  );

  if (trackIndex < 0) {
    return slide;
  }

  const track = clip.tracks[trackIndex];
  const keyframeIndex = track.keyframes.findIndex(
    (keyframe) => keyframe.id === command.keyframeId,
  );

  if (keyframeIndex < 0) {
    return slide;
  }

  const oldKeyframe = track.keyframes[keyframeIndex];

  /**
   * Determine the current keyframe's neighbors in timeline order.
   *
   * Keyframe IDs remain stable even when the array is reordered, so the command
   * can safely calculate limits from a sorted copy.
   */
  const sortedKeyframes = [...track.keyframes].sort(
    (left, right) =>
      left.offset - right.offset || left.id.localeCompare(right.id),
  );

  const sortedKeyframeIndex = sortedKeyframes.findIndex(
    (keyframe) => keyframe.id === command.keyframeId,
  );

  if (sortedKeyframeIndex < 0) {
    return slide;
  }

  const previousKeyframe = sortedKeyframes[sortedKeyframeIndex - 1];
  const followingKeyframe = sortedKeyframes[sortedKeyframeIndex + 1];

  let minimumOffset = previousKeyframe
    ? Math.min(1, previousKeyframe.offset + MINIMUM_KEYFRAME_OFFSET_GAP)
    : 0;

  let maximumOffset = followingKeyframe
    ? Math.max(0, followingKeyframe.offset - MINIMUM_KEYFRAME_OFFSET_GAP)
    : 1;

  /**
   * Malformed legacy data may already contain keyframes that are too close.
   * In that exceptional case, keep this keyframe fixed instead of allowing it to
   * cross another keyframe.
   */
  if (minimumOffset > maximumOffset) {
    minimumOffset = oldKeyframe.offset;
    maximumOffset = oldKeyframe.offset;
  }

  const nextOffset = Math.min(
    maximumOffset,
    Math.max(minimumOffset, command.offset),
  );

  if (Object.is(oldKeyframe.offset, nextOffset)) {
    return slide;
  }

  const nextKeyframes = track.keyframes
    .map((keyframe) =>
      keyframe.id === command.keyframeId
        ? {
            ...keyframe,
            offset: nextOffset,
          }
        : keyframe,
    )
    .sort((left, right) => left.offset - right.offset);

  const nextTracks = [...clip.tracks];

  nextTracks[trackIndex] = {
    ...track,
    keyframes: nextKeyframes,
  };

  const nextClip: AnimationClip = {
    ...clip,
    tracks: nextTracks,
    metadata: {
      ...clip.metadata,
      customized: true,
    },
  };

  return {
    ...slide,
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
 * Add one keyframe to the largest available gap in a V2 animation track.
 *
 * The new position is placed at the middle of the largest gap between two
 * existing keyframes. Its value is interpolated from the keyframes on both
 * sides, so numeric, vector, and color tracks receive a sensible default.
 */
export function addAnimationKeyframeToSlide(
  slide: Slide,
  command: AddAnimationKeyframeCommand,
): Slide {
  const scene = slide.animationScene;
  const clip = scene?.clips[command.clipId];

  if (!scene || scene.schemaVersion !== 2 || !clip) {
    return slide;
  }

  const trackIndex = clip.tracks.findIndex(
    (track) => track.id === command.trackId,
  );

  if (trackIndex < 0) {
    return slide;
  }

  const track = clip.tracks[trackIndex];
  const sortedKeyframes = [...track.keyframes].sort(
    (left, right) =>
      left.offset - right.offset ||
      left.id.localeCompare(right.id),
  );

  /**
   * A new keyframe needs two surrounding keyframes so its value can be
   * interpolated. Existing preset tracks already satisfy this requirement.
   */
  if (sortedKeyframes.length < 2) {
    return slide;
  }

  let leftKeyframe = sortedKeyframes[0];
  let rightKeyframe = sortedKeyframes[1];
  let largestGap =
    rightKeyframe.offset - leftKeyframe.offset;

  for (
    let index = 1;
    index < sortedKeyframes.length - 1;
    index += 1
  ) {
    const currentLeft = sortedKeyframes[index];
    const currentRight = sortedKeyframes[index + 1];
    const currentGap =
      currentRight.offset - currentLeft.offset;

    if (currentGap > largestGap) {
      leftKeyframe = currentLeft;
      rightKeyframe = currentRight;
      largestGap = currentGap;
    }
  }

  /**
   * Both sides of the new keyframe must retain the minimum basic-mode gap.
   */
  if (largestGap <= MINIMUM_KEYFRAME_OFFSET_GAP * 2) {
    return slide;
  }

  const newOffset = Number(
    (
      leftKeyframe.offset +
      largestGap / 2
    ).toFixed(6),
  );

  const interpolationProgress =
    (newOffset - leftKeyframe.offset) /
    largestGap;

  const existingKeyframeIds = new Set(
    track.keyframes.map((keyframe) => keyframe.id),
  );

  const newKeyframe: AnimationKeyframe = {
    id: createUniqueKeyframeId(
      track.id,
      existingKeyframeIds,
    ),
    offset: newOffset,
    value: interpolateAnimationValue(
      leftKeyframe.value,
      rightKeyframe.value,
      interpolationProgress,
    ),

    /**
     * The new keyframe inherits the previous segment's easing as a useful
     * starting point. Independent easing editing will be added later.
     */
    easing: leftKeyframe.easing,
  };

  const nextKeyframes = [
    ...track.keyframes,
    newKeyframe,
  ].sort(
    (left, right) =>
      left.offset - right.offset ||
      left.id.localeCompare(right.id),
  );

  return replaceAnimationTrackInSlide(
    slide,
    scene,
    clip,
    trackIndex,
    {
      ...track,
      keyframes: nextKeyframes,
    },
  );
}

/**
 * Delete one keyframe from a V2 animation track.
 *
 * Basic editing keeps at least two keyframes on every track so the track always
 * retains a clear start and end state.
 */
export function deleteAnimationKeyframeFromSlide(
  slide: Slide,
  command: DeleteAnimationKeyframeCommand,
): Slide {
  const scene = slide.animationScene;
  const clip = scene?.clips[command.clipId];

  if (!scene || scene.schemaVersion !== 2 || !clip) {
    return slide;
  }

  const trackIndex = clip.tracks.findIndex(
    (track) => track.id === command.trackId,
  );

  if (trackIndex < 0) {
    return slide;
  }

  const track = clip.tracks[trackIndex];

  if (track.keyframes.length <= 2) {
    return slide;
  }

  const keyframeExists = track.keyframes.some(
    (keyframe) =>
      keyframe.id === command.keyframeId,
  );

  if (!keyframeExists) {
    return slide;
  }

  const nextKeyframes = track.keyframes
    .filter(
      (keyframe) =>
        keyframe.id !== command.keyframeId,
    )
    .sort(
      (left, right) =>
        left.offset - right.offset ||
        left.id.localeCompare(right.id),
    );

  return replaceAnimationTrackInSlide(
    slide,
    scene,
    clip,
    trackIndex,
    {
      ...track,
      keyframes: nextKeyframes,
    },
  );
}

/**
 * Replace one track and produce a new animationScene revision.
 */
function replaceAnimationTrackInSlide(
  slide: Slide,
  scene: AnimationScene,
  clip: AnimationClip,
  trackIndex: number,
  nextTrack: AnimationClip["tracks"][number],
): Slide {
  const nextTracks = [...clip.tracks];

  nextTracks[trackIndex] = nextTrack;

  const nextClip: AnimationClip = {
    ...clip,
    tracks: nextTracks,
    metadata: {
      ...clip.metadata,
      customized: true,
    },
  };

  return {
    ...slide,
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
 * Create a keyframe ID that cannot collide with the existing track IDs.
 */
function createUniqueKeyframeId(
  trackId: string,
  existingKeyframeIds: Set<string>,
) {
  const baseId = `${trackId}-keyframe-${Date.now()}`;
  let nextId = baseId;
  let suffix = 1;

  while (existingKeyframeIds.has(nextId)) {
    nextId = `${baseId}-${suffix}`;
    suffix += 1;
  }

  return nextId;
}

/**
 * Interpolate a default value for a newly inserted keyframe.
 *
 * Numeric values, vectors, and colors are linearly interpolated. Discrete
 * values such as strings and booleans use the nearest surrounding value.
 */
function interpolateAnimationValue(
  leftValue: AnimationValue,
  rightValue: AnimationValue,
  progress: number,
): AnimationValue {
  const safeProgress = Math.min(
    1,
    Math.max(0, progress),
  );

  if (
    typeof leftValue === "number" &&
    typeof rightValue === "number"
  ) {
    return interpolateNumber(
      leftValue,
      rightValue,
      safeProgress,
    );
  }

  if (
    typeof leftValue !== "object" ||
    typeof rightValue !== "object"
  ) {
    return safeProgress < 0.5
      ? leftValue
      : rightValue;
  }

  if ("r" in leftValue && "r" in rightValue) {
    return {
      r: interpolateNumber(
        leftValue.r,
        rightValue.r,
        safeProgress,
      ),
      g: interpolateNumber(
        leftValue.g,
        rightValue.g,
        safeProgress,
      ),
      b: interpolateNumber(
        leftValue.b,
        rightValue.b,
        safeProgress,
      ),
      a: interpolateNumber(
        leftValue.a,
        rightValue.a,
        safeProgress,
      ),
    };
  }

  if ("z" in leftValue && "z" in rightValue) {
    return {
      x: interpolateNumber(
        leftValue.x,
        rightValue.x,
        safeProgress,
      ),
      y: interpolateNumber(
        leftValue.y,
        rightValue.y,
        safeProgress,
      ),
      z: interpolateNumber(
        leftValue.z,
        rightValue.z,
        safeProgress,
      ),
    };
  }

  if ("x" in leftValue && "x" in rightValue) {
    return {
      x: interpolateNumber(
        leftValue.x,
        rightValue.x,
        safeProgress,
      ),
      y: interpolateNumber(
        leftValue.y,
        rightValue.y,
        safeProgress,
      ),
    };
  }

  return safeProgress < 0.5
    ? leftValue
    : rightValue;
}

function interpolateNumber(
  startValue: number,
  endValue: number,
  progress: number,
) {
  return Number(
    (
      startValue +
      (endValue - startValue) * progress
    ).toFixed(6),
  );
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

function cloneAnimationScene(scene: AnimationScene): AnimationScene {
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
    paths: {
      ...scene.paths,
    },
    markers: scene.markers.map((marker) => ({
      ...marker,
    })),
  };
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

function getLegacySequenceId(slideId: string) {
  return `sequence-${slideId}-legacy-slide-enter`;
}

function ensureClipInLegacySequence(
  scene: AnimationScene,
  slideId: string,
  clipId: string,
) {
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

function animationValuesEqual(left: AnimationValue, right: AnimationValue) {
  if (Object.is(left, right)) {
    return true;
  }

  if (
    typeof left !== "object" ||
    left === null ||
    typeof right !== "object" ||
    right === null
  ) {
    return false;
  }

  return JSON.stringify(left) === JSON.stringify(right);
}
