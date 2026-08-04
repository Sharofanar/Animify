import type {
  AnimationClip,
  AnimationScene,
  AnimationSequence,
  AnimationTarget,
  AnimationTrigger,
  Slide,
  SlideElement,
} from "../types/presentation";

export type CloneElementAnimationsCommand = {
  targetSlide: Slide;
  sourceScene: AnimationScene;
  sourceSlideId: string;
  sourceElements: SlideElement[];
  insertedElements: SlideElement[];
  operationId: string;
};

type OrderedSequenceEntry = {
  key: string;
  sequence: AnimationSequence;
};

/**
 * Clone persistent animation data without retaining nested mutable references.
 * Animation data is JSON-shaped, but the recursive copy also preserves explicit
 * undefined values used by in-memory command callers.
 */
function clonePersistentValue<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => clonePersistentValue(item)) as T;
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        clonePersistentValue(item),
      ]),
    ) as T;
  }

  return value;
}

function getOrderedSequenceEntries(
  scene: AnimationScene,
): OrderedSequenceEntry[] {
  const seenSequenceKeys = new Set<string>();
  const entries: OrderedSequenceEntry[] = [];

  for (const sequenceKey of [
    ...scene.sequenceOrder,
    ...Object.keys(scene.sequences),
  ]) {
    const sequence = scene.sequences[sequenceKey];

    if (!sequence || seenSequenceKeys.has(sequenceKey)) {
      continue;
    }

    seenSequenceKeys.add(sequenceKey);
    entries.push({ key: sequenceKey, sequence });
  }

  return entries;
}

function createUniqueId(preferredId: string, usedIds: Set<string>) {
  // Explicit operation-derived candidates keep cloning reproducible; suffixes
  // resolve target-scene collisions without introducing time or randomness.
  const safeBaseId =
    preferredId.replace(/[^a-zA-Z0-9-_]/g, "-") || "animation-clone";
  let nextId = safeBaseId;
  let suffix = 1;

  while (usedIds.has(nextId)) {
    nextId = `${safeBaseId}-${suffix}`;
    suffix += 1;
  }

  usedIds.add(nextId);
  return nextId;
}

function collectTrackIds(scene: AnimationScene) {
  return new Set(
    Object.values(scene.clips).flatMap((clip) =>
      clip.tracks.map((track) => track.id),
    ),
  );
}

function collectKeyframeIds(scene: AnimationScene) {
  return new Set(
    Object.values(scene.clips).flatMap((clip) =>
      clip.tracks.flatMap((track) =>
        track.keyframes.map((keyframe) => keyframe.id),
      ),
    ),
  );
}

function getLegacyAnimationId(clip: AnimationClip) {
  const value = clip.metadata?.legacyAnimationId;

  return typeof value === "string" ? value : undefined;
}

function getClonedLegacyAnimationId(
  sourceClip: AnimationClip,
  sourceElements: SlideElement[],
  insertedElementBySourceId: Map<string, SlideElement>,
) {
  const sourceLegacyAnimationId = getLegacyAnimationId(sourceClip);

  if (!sourceLegacyAnimationId) {
    return undefined;
  }

  for (const target of sourceClip.targets) {
    const insertedElement = insertedElementBySourceId.get(target.elementId);

    if (!insertedElement) {
      continue;
    }

    const sourceElement = sourceElements.find(
      (element) => element.id === target.elementId,
    );
    const sourceAnimationIndex =
      sourceElement?.animations.findIndex(
        (animation) => animation.id === sourceLegacyAnimationId,
      ) ?? -1;

    if (sourceAnimationIndex >= 0) {
      return insertedElement.animations[sourceAnimationIndex]?.id;
    }
  }

  return undefined;
}

function remapClipTargets(
  sourceClip: AnimationClip,
  insertedElementBySourceId: Map<string, SlideElement>,
): AnimationTarget[] {
  return sourceClip.targets.flatMap((target) => {
    const insertedElement = insertedElementBySourceId.get(target.elementId);

    if (!insertedElement) {
      return [];
    }

    return [
      {
        ...target,
        elementId: insertedElement.id,
        subTarget: target.subTarget
          ? clonePersistentValue(target.subTarget)
          : undefined,
      },
    ];
  });
}

function remapCrossSlideTrigger(
  trigger: AnimationTrigger,
  insertedElementBySourceId: Map<string, SlideElement>,
): AnimationTrigger {
  // Cross-slide triggers must never retain an element ID owned by the source
  // slide; click can safely fall back to the page, while hover becomes manual.
  if (trigger.type === "click") {
    if (!trigger.targetElementId) {
      return { type: "click" };
    }

    const insertedElement = insertedElementBySourceId.get(
      trigger.targetElementId,
    );

    return insertedElement
      ? {
          type: "click",
          targetElementId: insertedElement.id,
        }
      : { type: "click" };
  }

  if (trigger.type === "hover") {
    const insertedElement = insertedElementBySourceId.get(
      trigger.targetElementId,
    );

    return insertedElement
      ? {
          type: "hover",
          targetElementId: insertedElement.id,
        }
      : { type: "manual" };
  }

  return clonePersistentValue(trigger);
}

function cloneClip(
  sourceClip: AnimationClip,
  nextClipId: string,
  nextTargets: AnimationTarget[],
  nextLegacyAnimationId: string | undefined,
  operationId: string,
  copiedClipIndex: number,
  usedTrackIds: Set<string>,
  usedKeyframeIds: Set<string>,
): AnimationClip {
  const metadata = clonePersistentValue(sourceClip.metadata ?? {});
  metadata.customized = true;

  if (nextLegacyAnimationId) {
    metadata.legacyAnimationId = nextLegacyAnimationId;
  } else {
    delete metadata.legacyAnimationId;
  }

  return {
    // startMs is already relative to the owning Sequence and must not be
    // converted or offset when the Clip changes slide or Sequence ownership.
    ...sourceClip,
    id: nextClipId,
    targets: nextTargets,
    tracks: sourceClip.tracks.map((track, trackIndex) => {
      const nextTrackId = createUniqueId(
        `${nextClipId}-${operationId}-track-${copiedClipIndex}-${trackIndex}`,
        usedTrackIds,
      );

      return {
        ...track,
        id: nextTrackId,
        keyframes: track.keyframes.map((keyframe, keyframeIndex) => ({
          ...keyframe,
          id: createUniqueId(
            `${nextTrackId}-keyframe-${keyframeIndex}`,
            usedKeyframeIds,
          ),
          value: clonePersistentValue(keyframe.value),
          easing: keyframe.easing
            ? clonePersistentValue(keyframe.easing)
            : undefined,
        })),
      };
    }),
    stagger: sourceClip.stagger
      ? clonePersistentValue(sourceClip.stagger)
      : undefined,
    sourcePreset: sourceClip.sourcePreset
      ? clonePersistentValue(sourceClip.sourcePreset)
      : undefined,
    metadata,
  };
}

/**
 * Clone V2 animation ownership for already-inserted element copies.
 *
 * The caller owns element/legacy IDs and every editor side effect. This kernel
 * uses only the explicit operation ID, so fixed document inputs produce a
 * deterministic animation graph without time, randomness, or editor runtime state.
 */
export function cloneElementAnimationsForInsertedElements({
  targetSlide,
  sourceScene,
  sourceSlideId,
  sourceElements,
  insertedElements,
  operationId,
}: CloneElementAnimationsCommand): Slide {
  if (
    sourceElements.length === 0 ||
    sourceElements.length !== insertedElements.length
  ) {
    return targetSlide;
  }

  const insertedElementBySourceId = new Map<string, SlideElement>();

  sourceElements.forEach((sourceElement, index) => {
    const insertedElement = insertedElements[index];

    if (insertedElement) {
      insertedElementBySourceId.set(sourceElement.id, insertedElement);
    }
  });

  if (insertedElementBySourceId.size === 0) {
    return targetSlide;
  }

  const sameSlide = sourceSlideId === targetSlide.id;
  const sourceSequenceEntries = getOrderedSequenceEntries(sourceScene);
  const sourceClipOwnerKeys = new Map<string, string>();

  for (const { key, sequence } of sourceSequenceEntries) {
    for (const clipId of sequence.clipIds) {
      if (!sourceClipOwnerKeys.has(clipId)) {
        sourceClipOwnerKeys.set(clipId, key);
      }
    }
  }

  const relevantSourceClipIds = new Set(
    sourceSequenceEntries.flatMap(({ key, sequence }) => {
      if (sameSlide && !targetSlide.animationScene.sequences[key]) {
        return [];
      }

      return sequence.clipIds.filter((clipId) => {
        if (sourceClipOwnerKeys.get(clipId) !== key) {
          return false;
        }

        if (
          sameSlide &&
          !targetSlide.animationScene.sequences[key]?.clipIds.includes(clipId)
        ) {
          return false;
        }

        const clip = sourceScene.clips[clipId];

        return Boolean(
          clip &&
            clip.targets.some((target) =>
              insertedElementBySourceId.has(target.elementId),
            ),
        );
      });
    }),
  );

  if (relevantSourceClipIds.size === 0) {
    return targetSlide;
  }

  const targetScene = targetSlide.animationScene;
  const nextScene: AnimationScene = {
    ...targetScene,
    sequenceOrder: [...targetScene.sequenceOrder],
    sequences: { ...targetScene.sequences },
    clips: { ...targetScene.clips },

    // Paths and markers are target-slide data and are outside element cloning.
    paths: targetScene.paths,
    markers: targetScene.markers,
  };
  const usedClipIds = new Set(Object.keys(targetScene.clips));
  const usedSequenceIds = new Set([
    ...Object.keys(targetScene.sequences),
    ...Object.values(targetScene.sequences).map((sequence) => sequence.id),
  ]);
  const usedTrackIds = collectTrackIds(targetScene);
  const usedKeyframeIds = collectKeyframeIds(targetScene);
  const clonedClipIdBySourceId = new Map<string, string>();
  let copiedClipIndex = 0;

  function getOrCreateClonedClip(sourceClipId: string) {
    const existingClonedClipId = clonedClipIdBySourceId.get(sourceClipId);

    if (existingClonedClipId) {
      return existingClonedClipId;
    }

    const sourceClip = sourceScene.clips[sourceClipId];

    if (!sourceClip) {
      return undefined;
    }

    const nextTargets = remapClipTargets(
      sourceClip,
      insertedElementBySourceId,
    );

    if (nextTargets.length === 0) {
      return undefined;
    }

    const currentCopiedClipIndex = copiedClipIndex;
    const nextClipId = createUniqueId(
      `${sourceClip.id}-${operationId}-${currentCopiedClipIndex}`,
      usedClipIds,
    );
    copiedClipIndex += 1;

    nextScene.clips[nextClipId] = cloneClip(
      sourceClip,
      nextClipId,
      nextTargets,
      getClonedLegacyAnimationId(
        sourceClip,
        sourceElements,
        insertedElementBySourceId,
      ),
      operationId,
      currentCopiedClipIndex,
      usedTrackIds,
      usedKeyframeIds,
    );
    clonedClipIdBySourceId.set(sourceClipId, nextClipId);
    return nextClipId;
  }

  let targetSlideEnterKey = getOrderedSequenceEntries(nextScene).find(
    ({ sequence }) => sequence.trigger.type === "slide-enter",
  )?.key;

  for (const { key: sourceSequenceKey, sequence } of sourceSequenceEntries) {
    const relatedSourceClipIds = sequence.clipIds.filter(
      (clipId, index) =>
        relevantSourceClipIds.has(clipId) &&
        sourceClipOwnerKeys.get(clipId) === sourceSequenceKey &&
        sequence.clipIds.indexOf(clipId) === index,
    );

    if (relatedSourceClipIds.length === 0) {
      continue;
    }

    if (sameSlide) {
      // Same-slide copies stay in the original Step so duplicating an element
      // cannot silently create another Sequence or change its trigger.
      const targetSequence = nextScene.sequences[sourceSequenceKey];

      if (!targetSequence) {
        continue;
      }

      const nextClipIds = [...targetSequence.clipIds];

      for (const sourceClipId of relatedSourceClipIds) {
        const copiedClipId = getOrCreateClonedClip(sourceClipId);
        const sourceIndex = nextClipIds.indexOf(sourceClipId);

        if (!copiedClipId || sourceIndex < 0) {
          continue;
        }

        nextClipIds.splice(sourceIndex + 1, 0, copiedClipId);
      }

      nextScene.sequences[sourceSequenceKey] = {
        ...targetSequence,
        clipIds: nextClipIds,
      };
      continue;
    }

    const copiedClipIds = relatedSourceClipIds.flatMap((sourceClipId) => {
      const copiedClipId = getOrCreateClonedClip(sourceClipId);
      return copiedClipId ? [copiedClipId] : [];
    });

    if (copiedClipIds.length === 0) {
      continue;
    }

    // Presentation executes the first ordered slide-enter Sequence, so all
    // copied entrance Clips must merge into that runnable Sequence.

    if (sequence.trigger.type === "slide-enter") {
      if (!targetSlideEnterKey) {
        targetSlideEnterKey = createUniqueId(
          `${sequence.id}-${operationId}`,
          usedSequenceIds,
        );
        nextScene.sequences[targetSlideEnterKey] = {
          ...sequence,
          id: targetSlideEnterKey,
          trigger: { type: "slide-enter" },
          clipIds: [],
          playback: clonePersistentValue(sequence.playback),
        };
        nextScene.sequenceOrder.push(targetSlideEnterKey);
      }

      const targetSlideEnterSequence =
        nextScene.sequences[targetSlideEnterKey];

      nextScene.sequences[targetSlideEnterKey] = {
        ...targetSlideEnterSequence,
        clipIds: [
          ...targetSlideEnterSequence.clipIds,
          ...copiedClipIds,
        ],
      };
      continue;
    }

    const nextSequenceId = createUniqueId(
      `${sequence.id}-${operationId}`,
      usedSequenceIds,
    );
    nextScene.sequences[nextSequenceId] = {
      ...sequence,
      id: nextSequenceId,
      trigger: remapCrossSlideTrigger(
        sequence.trigger,
        insertedElementBySourceId,
      ),
      clipIds: copiedClipIds,
      playback: clonePersistentValue(sequence.playback),
    };
    nextScene.sequenceOrder.push(nextSequenceId);
  }

  if (clonedClipIdBySourceId.size === 0) {
    return targetSlide;
  }

  return {
    ...targetSlide,
    animationScene: {
      ...nextScene,
      revision: Math.max(1, targetScene.revision + 1),
    },
  };
}
