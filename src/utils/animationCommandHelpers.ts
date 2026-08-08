import type {
  AnimationClip,
  AnimationScene,
} from "../types/presentation";

/**
 * Shared Scene mutation helpers live below every command domain so neither a
 * domain module nor the compatibility barrel needs to import the other.
 */
export function cloneAnimationScene(scene: AnimationScene): AnimationScene {
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

export function getLegacySequenceId(slideId: string) {
  return `sequence-${slideId}-legacy-slide-enter`;
}

export function getLegacyAnimationId(clip: AnimationClip) {
  const value = clip.metadata?.legacyAnimationId;

  return typeof value === "string" ? value : undefined;
}

/**
 * Legacy-backed Clips may be explicitly moved into a Click Step. Only create
 * default slide-enter ownership when no Sequence already owns the Clip.
 */
export function ensureClipInLegacySequence(
  scene: AnimationScene,
  slideId: string,
  clipId: string,
) {
  if (
    Object.values(scene.sequences).some((sequence) =>
      sequence.clipIds.includes(clipId),
    )
  ) {
    return false;
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

    return true;
  }

  if (oldSequence.clipIds.includes(clipId)) {
    return false;
  }

  scene.sequences[sequenceId] = {
    ...oldSequence,
    clipIds: [...oldSequence.clipIds, clipId],
  };

  return true;
}

/**
 * Remove every reference to the requested Clips and delete only Sequences that
 * this removal changes from non-empty to empty. Historical unrelated empty
 * Sequences remain untouched for a later explicit normalization policy.
 */
export function removeAnimationClipsAndDirectEmptySequences(
  scene: AnimationScene,
  clipIds: ReadonlySet<string>,
) {
  if (clipIds.size === 0) {
    return false;
  }

  let changed = false;
  const nextClips = {
    ...scene.clips,
  };

  for (const clipId of clipIds) {
    if (!Object.prototype.hasOwnProperty.call(nextClips, clipId)) {
      continue;
    }

    delete nextClips[clipId];
    changed = true;
  }

  if (changed) {
    scene.clips = nextClips;
  }

  const directlyEmptiedSequenceIds = new Set<string>();

  for (const [sequenceId, sequence] of Object.entries(scene.sequences)) {
    if (!sequence.clipIds.some((clipId) => clipIds.has(clipId))) {
      continue;
    }

    const nextClipIds = sequence.clipIds.filter(
      (clipId) => !clipIds.has(clipId),
    );

    changed = true;

    if (sequence.clipIds.length > 0 && nextClipIds.length === 0) {
      directlyEmptiedSequenceIds.add(sequenceId);
      continue;
    }

    scene.sequences[sequenceId] = {
      ...sequence,
      clipIds: nextClipIds,
    };
  }

  if (directlyEmptiedSequenceIds.size === 0) {
    return changed;
  }

  scene.sequences = Object.fromEntries(
    Object.entries(scene.sequences).filter(
      ([sequenceId]) => !directlyEmptiedSequenceIds.has(sequenceId),
    ),
  );
  scene.sequenceOrder = scene.sequenceOrder.filter(
    (sequenceId) => !directlyEmptiedSequenceIds.has(sequenceId),
  );

  return true;
}

export function removeEmptySequences(scene: AnimationScene) {
  const emptySequenceIds = new Set(
    Object.values(scene.sequences)
      .filter((sequence) => sequence.clipIds.length === 0)
      .map((sequence) => sequence.id),
  );

  if (emptySequenceIds.size === 0) {
    return;
  }

  scene.sequences = Object.fromEntries(
    Object.entries(scene.sequences).filter(
      ([sequenceId]) => !emptySequenceIds.has(sequenceId),
    ),
  );

  scene.sequenceOrder = scene.sequenceOrder.filter(
    (sequenceId) => !emptySequenceIds.has(sequenceId),
  );
}
