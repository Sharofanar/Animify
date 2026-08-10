import type {
  AnimationClip,
  AnimationScene,
  AnimationSequence,
} from "../types/presentation";

function normalizePositiveNumber(value: number | undefined, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : fallback;
}

/**
 * Return every valid Sequence once, preserving the persisted sequenceOrder and
 * appending malformed legacy omissions deterministically.
 */
export function getOrderedAnimationSequences(
  scene?: AnimationScene,
): AnimationSequence[] {
  if (!scene || scene.schemaVersion !== 2) {
    return [];
  }

  const seenSequenceIds = new Set<string>();
  const orderedSequences: AnimationSequence[] = [];

  for (const sequenceId of [
    ...scene.sequenceOrder,
    ...Object.keys(scene.sequences),
  ]) {
    const sequence = scene.sequences[sequenceId];

    if (!sequence || seenSequenceIds.has(sequenceId)) {
      continue;
    }

    seenSequenceIds.add(sequenceId);
    orderedSequences.push(sequence);
  }

  return orderedSequences;
}

/**
 * Resolve live Clips in one Sequence's persisted Clip order.
 */
export function getAnimationSequenceClips(
  scene: AnimationScene | undefined,
  sequenceId: string,
): AnimationClip[] {
  const sequence = scene?.sequences[sequenceId];

  if (!scene || scene.schemaVersion !== 2 || !sequence) {
    return [];
  }

  const seenClipIds = new Set<string>();
  const clipIds = Array.isArray(sequence.clipIds) ? sequence.clipIds : [];

  return clipIds.flatMap((clipId) => {
    const clip = scene.clips[clipId];

    if (!clip || seenClipIds.has(clipId)) {
      return [];
    }

    seenClipIds.add(clipId);
    return [clip];
  });
}

/**
 * Resolve every persisted owner for one live Clip without repairing malformed
 * ownership. Missing/duplicate sequenceOrder references are normalized only in
 * the returned query view by getOrderedAnimationSequences.
 */
export function getAnimationClipOwnerSequences(
  scene: AnimationScene | undefined,
  clipId: string,
): AnimationSequence[] {
  if (!scene || scene.schemaVersion !== 2 || !scene.clips[clipId]) {
    return [];
  }

  return getOrderedAnimationSequences(scene).filter(
    (sequence) =>
      Array.isArray(sequence.clipIds) && sequence.clipIds.includes(clipId),
  );
}

function sequenceHasSafelyOwnedLiveClip(
  scene: AnimationScene,
  sequence: AnimationSequence,
) {
  if (!scene.sequenceOrder.includes(sequence.id)) {
    return false;
  }

  return getAnimationSequenceClips(scene, sequence.id).some((clip) => {
    const owners = getAnimationClipOwnerSequences(scene, clip.id);
    return owners.length === 1 && owners[0]?.id === sequence.id;
  });
}

/**
 * Return the first effective automatic Sequence. Empty, missing-only, duplicate
 * ownership, and additional slide-enter Sequences remain protected historical
 * state and are not presented as the normal Stage 6 auto group.
 */
export function getAnimationPrimarySlideEnterSequence(
  scene?: AnimationScene,
): AnimationSequence | undefined {
  if (!scene || scene.schemaVersion !== 2) {
    return undefined;
  }

  return getOrderedAnimationSequences(scene).find(
    (sequence) =>
      sequence.trigger?.type === "slide-enter" &&
      sequenceHasSafelyOwnedLiveClip(scene, sequence),
  );
}

/**
 * Single normal Click Step query shared by Stage 6 UI, commands, Presentation,
 * and Export. The query is read-only and never removes malformed references.
 */
export function getAnimationPageClickSteps(
  scene?: AnimationScene,
): AnimationSequence[] {
  if (!scene || scene.schemaVersion !== 2) {
    return [];
  }

  return getOrderedAnimationSequences(scene).filter(
    (sequence) =>
      sequence.trigger?.type === "click" &&
      sequence.trigger.targetElementId === undefined &&
      sequenceHasSafelyOwnedLiveClip(scene, sequence),
  );
}

/**
 * Resolve the single owning Sequence for a Clip using persisted Sequence order.
 */
export function getAnimationSequenceForClip(
  scene: AnimationScene | undefined,
  clipId: string,
) {
  return getOrderedAnimationSequences(scene).find(
    (sequence) =>
      Array.isArray(sequence.clipIds) && sequence.clipIds.includes(clipId),
  );
}

/**
 * A Clip's persisted start is always measured from its owning Sequence's local
 * 0ms. The Sequence trigger time is runtime state and is not part of this value.
 */
export function getAnimationClipLocalStartMs(clip: AnimationClip) {
  return Math.max(0, clip.startMs);
}

export function getAnimationClipPlaybackRate(
  clip: AnimationClip,
  sequence: AnimationSequence,
) {
  return (
    normalizePositiveNumber(sequence.playback.playbackRate, 1) *
    normalizePositiveNumber(clip.playbackRate, 1)
  );
}

export function getAnimationClipDirection(
  clip: AnimationClip,
  sequence: AnimationSequence,
) {
  return clip.direction === "normal"
    ? sequence.playback.direction
    : clip.direction;
}

export function getAnimationClipIterations(
  clip: AnimationClip,
  sequence: AnimationSequence,
) {
  return (
    normalizePositiveNumber(clip.iterations, 1) *
    normalizePositiveNumber(sequence.playback.repeat, 1)
  );
}

/**
 * Runtime duration of one Clip after the existing Clip and Sequence playback
 * parameters are applied. startMs is intentionally excluded.
 */
export function getAnimationClipEffectiveDurationMs(
  clip: AnimationClip,
  sequence: AnimationSequence,
) {
  return (
    (Math.max(1, clip.durationMs) *
      getAnimationClipIterations(clip, sequence)) /
    getAnimationClipPlaybackRate(clip, sequence)
  );
}

/**
 * Convert target order into its deterministic Sequence-local stagger delay.
 */
export function getAnimationClipStaggerDelayMs(
  clip: AnimationClip,
  targetIndex: number,
  targetCount: number,
) {
  const stagger = clip.stagger;

  if (!stagger || targetCount <= 1) {
    return 0;
  }

  const orderedIndices = createOrderedTargetIndices(
    targetCount,
    stagger.order,
    stagger.seed,
  );
  const orderedPosition = orderedIndices.indexOf(targetIndex);

  return Math.max(0, orderedPosition) * Math.max(0, stagger.eachMs);
}

/**
 * Effective end on the owning Sequence's local timeline, including the latest
 * staggered target and existing playback rules.
 */
export function getAnimationClipLocalEndMs(
  clip: AnimationClip,
  sequence: AnimationSequence,
) {
  const finalStaggerDelayMs =
    Math.max(0, clip.targets.length - 1) *
    Math.max(0, clip.stagger?.eachMs ?? 0);

  return (
    getAnimationClipLocalStartMs(clip) +
    finalStaggerDelayMs +
    getAnimationClipEffectiveDurationMs(clip, sequence)
  );
}

/**
 * Resolve one Sequence's effective local duration without reading Clips from any
 * other Sequence. A fixed duration remains authoritative when configured.
 */
export function getAnimationSequenceLocalDurationMs(
  scene: AnimationScene | undefined,
  sequenceId: string,
) {
  const sequence = scene?.sequences[sequenceId];

  if (!scene || scene.schemaVersion !== 2 || !sequence) {
    return 0;
  }

  if (
    sequence.durationMode === "fixed" &&
    typeof sequence.durationMs === "number" &&
    Number.isFinite(sequence.durationMs)
  ) {
    return Math.max(0, sequence.durationMs);
  }

  return getAnimationSequenceClips(scene, sequenceId).reduce(
    (durationMs, clip) =>
      Math.max(durationMs, getAnimationClipLocalEndMs(clip, sequence)),
    0,
  );
}

/**
 * Find the next local start position for selected targets inside one Sequence.
 */
export function getAnimationSequenceLastTargetEndMs(
  scene: AnimationScene | undefined,
  sequenceId: string,
  elementIds: string[],
) {
  const sequence = scene?.sequences[sequenceId];

  if (!scene || scene.schemaVersion !== 2 || !sequence) {
    return 0;
  }

  const targetElementIds = new Set(elementIds);

  return getAnimationSequenceClips(scene, sequenceId).reduce(
    (latestEndMs, clip) => {
      const targetsSelectedElement = clip.targets.some((target) =>
        targetElementIds.has(target.elementId),
      );

      return targetsSelectedElement
        ? Math.max(
            latestEndMs,
            getAnimationClipLocalEndMs(clip, sequence),
          )
        : latestEndMs;
    },
    0,
  );
}

function createOrderedTargetIndices(
  targetCount: number,
  order: NonNullable<AnimationClip["stagger"]>["order"],
  seed = 1,
) {
  const indices = Array.from({ length: targetCount }, (_, index) => index);

  switch (order) {
    case "reverse":
      return indices.reverse();

    case "center": {
      const center = (targetCount - 1) / 2;

      return indices.sort(
        (left, right) =>
          Math.abs(left - center) - Math.abs(right - center) || left - right,
      );
    }

    case "edges": {
      const center = (targetCount - 1) / 2;

      return indices.sort(
        (left, right) =>
          Math.abs(right - center) - Math.abs(left - center) || left - right,
      );
    }

    case "random":
      return shuffleIndices(indices, seed);

    case "forward":
    case "canvas-position":
    case "layer-order":
      return indices;
  }
}

function shuffleIndices(indices: number[], seed: number) {
  const shuffled = [...indices];
  let state = Math.abs(Math.floor(seed)) || 1;

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    state = (state * 16807) % 2147483647;

    const targetIndex = state % (index + 1);

    [shuffled[index], shuffled[targetIndex]] = [
      shuffled[targetIndex],
      shuffled[index],
    ];
  }

  return shuffled;
}
