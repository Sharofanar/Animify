import type { AnimationScene } from "../types/presentation";

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
