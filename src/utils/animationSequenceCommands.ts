import type {
  AnimationScene,
  AnimationSequence,
  Slide,
} from "../types/presentation";
import {
  cloneAnimationScene,
  getLegacySequenceId,
  removeEmptySequences,
} from "./animationCommandHelpers";
import { getOrderedAnimationSequences } from "./animationSequence";

export type CreateAnimationClickStepCommand = {
  /** Stable ID generated once by the caller and persisted in sequenceOrder. */
  sequenceId: string;
  name?: string;
  clipIds: string[];

  /** Zero-based position among Click Steps, not among every Sequence. */
  clickStepIndex?: number;
};

export type UpdateAnimationClickStepCommand = {
  sequenceId: string;
  name?: string;
  clipIds?: string[];
};

export type SetAnimationSequenceTriggerCommand = {
  sequenceId: string;

  /** Phase 3 intentionally exposes only slide-enter and page-click behavior. */
  triggerType: Extract<
    AnimationSequence["trigger"]["type"],
    "slide-enter" | "click"
  >;
};

export type MoveAnimationClickStepCommand = {
  sequenceId: string;

  /** Zero-based position among Click Steps. */
  clickStepIndex: number;
};

/**
 * Read Click Steps in their stable persisted order. One click Sequence is one
 * step, and its clipIds array groups every Clip that runs in that step.
 */
export function getAnimationClickSteps(
  scene?: AnimationScene,
): AnimationSequence[] {
  if (!scene || scene.schemaVersion !== 2) {
    return [];
  }

  return getOrderedAnimationSequences(scene).filter(
    (sequence) => sequence.trigger.type === "click",
  );
}

/**
 * Create one Click Step from existing Clips. Clip ownership is moved rather than
 * copied so one Clip cannot be triggered by two different Sequences.
 */
export function createAnimationClickStepInSlide(
  slide: Slide,
  command: CreateAnimationClickStepCommand,
): Slide {
  const scene = slide.animationScene;
  const sequenceId = command.sequenceId.trim();

  if (
    !scene ||
    scene.schemaVersion !== 2 ||
    !sequenceId ||
    scene.sequences[sequenceId]
  ) {
    return slide;
  }

  const clipIds = getUniqueExistingClipIds(scene, command.clipIds);

  if (clipIds.length === 0) {
    return slide;
  }

  const nextScene = cloneAnimationScene(scene);

  /**
   * Clip ownership exists only in sequence.clipIds. Moving ownership preserves
   * startMs because it remains an offset from the destination Sequence local 0ms.
   */
  removeClipIdsFromSequences(nextScene, new Set(clipIds));
  removeEmptySequences(nextScene);

  nextScene.sequences[sequenceId] = {
    id: sequenceId,
    name:
      command.name?.trim() ||
      `点击步骤 ${getAnimationClickSteps(nextScene).length + 1}`,
    trigger: {
      type: "click",
    },
    clipIds,
    durationMode: "auto",
    playback: {
      repeat: 1,
      direction: "normal",
      playbackRate: 1,
    },
  };

  insertClickStepSequenceId(
    nextScene,
    sequenceId,
    command.clickStepIndex,
  );
  nextScene.revision = Math.max(1, scene.revision + 1);

  return {
    ...slide,
    animationScene: nextScene,
  };
}

/**
 * Update a Click Step without creating orphan Clips. Clips removed from the step
 * return to the slide-enter Sequence, while newly assigned Clips are detached
 * from their previous Sequence.
 */
export function updateAnimationClickStepInSlide(
  slide: Slide,
  command: UpdateAnimationClickStepCommand,
): Slide {
  const scene = slide.animationScene;
  const sequence = scene?.sequences[command.sequenceId];

  if (
    !scene ||
    scene.schemaVersion !== 2 ||
    sequence?.trigger.type !== "click"
  ) {
    return slide;
  }

  const nextName = command.name?.trim() || sequence.name;
  const nextClipIds = command.clipIds
    ? getUniqueExistingClipIds(scene, command.clipIds)
    : sequence.clipIds;

  /** A Click Step must always contain at least one live Clip. */
  if (nextClipIds.length === 0) {
    return slide;
  }

  const nextScene = cloneAnimationScene(scene);
  const nextClipIdSet = new Set(nextClipIds);
  const removedClipIds = sequence.clipIds.filter(
    (clipId) => !nextClipIdSet.has(clipId) && Boolean(scene.clips[clipId]),
  );
  const removedFromOtherSequences = removeClipIdsFromSequences(
    nextScene,
    nextClipIdSet,
    sequence.id,
  );
  const sequenceChanged =
    nextName !== sequence.name ||
    !stringArraysEqual(nextClipIds, sequence.clipIds);

  if (!sequenceChanged && !removedFromOtherSequences) {
    return slide;
  }

  nextScene.sequences[sequence.id] = {
    ...nextScene.sequences[sequence.id],
    name: nextName,
    clipIds: nextClipIds,
  };

  ensureClipsInSlideEnterSequence(nextScene, slide.id, removedClipIds);
  removeEmptySequences(nextScene);
  nextScene.revision = Math.max(1, scene.revision + 1);

  return {
    ...slide,
    animationScene: nextScene,
  };
}

/**
 * Switch one existing Sequence between automatic slide entry and a page Click
 * Step. The command is immutable so one document mutation remains one Undo/Redo
 * transaction when the Phase 6 editor invokes it.
 */
export function setAnimationSequenceTriggerInSlide(
  slide: Slide,
  command: SetAnimationSequenceTriggerCommand,
): Slide {
  const scene = slide.animationScene;
  const sequence = scene?.sequences[command.sequenceId];

  if (
    !scene ||
    scene.schemaVersion !== 2 ||
    !sequence ||
    sequence.trigger.type === command.triggerType
  ) {
    return slide;
  }

  const nextScene = cloneAnimationScene(scene);

  nextScene.sequences[sequence.id] = {
    ...nextScene.sequences[sequence.id],
    trigger: {
      type: command.triggerType,
    },
  };
  nextScene.revision = Math.max(1, scene.revision + 1);

  return {
    ...slide,
    animationScene: nextScene,
  };
}

/**
 * Move one Click Step while preserving all non-click Sequence positions. This
 * keeps sequenceOrder as the only persisted ordering source.
 */
export function moveAnimationClickStepInSlide(
  slide: Slide,
  command: MoveAnimationClickStepCommand,
): Slide {
  const scene = slide.animationScene;
  const sequence = scene?.sequences[command.sequenceId];

  if (
    !scene ||
    scene.schemaVersion !== 2 ||
    sequence?.trigger.type !== "click"
  ) {
    return slide;
  }

  if (!Number.isFinite(command.clickStepIndex)) {
    return slide;
  }

  const orderedSequenceIds = getOrderedAnimationSequences(scene).map(
    (currentSequence) => currentSequence.id,
  );
  const clickStepIds = orderedSequenceIds.filter(
    (sequenceId) => scene.sequences[sequenceId]?.trigger.type === "click",
  );
  const sourceIndex = clickStepIds.indexOf(sequence.id);
  const targetIndex = Math.min(
    Math.max(0, Math.round(command.clickStepIndex)),
    clickStepIds.length - 1,
  );

  if (sourceIndex < 0 || sourceIndex === targetIndex) {
    return slide;
  }

  const reorderedClickStepIds = [...clickStepIds];
  const [movedSequenceId] = reorderedClickStepIds.splice(sourceIndex, 1);
  reorderedClickStepIds.splice(targetIndex, 0, movedSequenceId);

  let clickStepCursor = 0;
  const nextSequenceOrder = orderedSequenceIds.map((sequenceId) => {
    if (scene.sequences[sequenceId]?.trigger.type !== "click") {
      return sequenceId;
    }

    const nextSequenceId = reorderedClickStepIds[clickStepCursor];
    clickStepCursor += 1;
    return nextSequenceId;
  });

  return {
    ...slide,
    animationScene: {
      ...scene,
      revision: Math.max(1, scene.revision + 1),
      sequenceOrder: nextSequenceOrder,
    },
  };
}

function getUniqueExistingClipIds(
  scene: AnimationScene,
  clipIds: string[],
) {
  const seenClipIds = new Set<string>();

  return clipIds.filter((clipId) => {
    if (!scene.clips[clipId] || seenClipIds.has(clipId)) {
      return false;
    }

    seenClipIds.add(clipId);
    return true;
  });
}

function removeClipIdsFromSequences(
  scene: AnimationScene,
  clipIds: Set<string>,
  exceptSequenceId?: string,
) {
  let changed = false;

  for (const [sequenceId, sequence] of Object.entries(scene.sequences)) {
    if (sequenceId === exceptSequenceId) {
      continue;
    }

    const nextClipIds = sequence.clipIds.filter(
      (clipId) => !clipIds.has(clipId),
    );

    if (nextClipIds.length === sequence.clipIds.length) {
      continue;
    }

    changed = true;
    scene.sequences[sequenceId] = {
      ...sequence,
      clipIds: nextClipIds,
    };
  }

  return changed;
}

function insertClickStepSequenceId(
  scene: AnimationScene,
  sequenceId: string,
  requestedClickStepIndex?: number,
) {
  const orderedSequenceIds = getOrderedAnimationSequences(scene)
    .map((sequence) => sequence.id)
    .filter((currentSequenceId) => currentSequenceId !== sequenceId);
  const clickStepIds = orderedSequenceIds.filter(
    (currentSequenceId) =>
      scene.sequences[currentSequenceId]?.trigger.type === "click",
  );
  const clickStepIndex =
    requestedClickStepIndex === undefined ||
    !Number.isFinite(requestedClickStepIndex)
      ? clickStepIds.length
      : Math.min(
          Math.max(0, Math.round(requestedClickStepIndex)),
          clickStepIds.length,
        );

  if (clickStepIndex < clickStepIds.length) {
    const targetSequenceIndex = orderedSequenceIds.indexOf(
      clickStepIds[clickStepIndex],
    );
    orderedSequenceIds.splice(targetSequenceIndex, 0, sequenceId);
  } else if (clickStepIds.length > 0) {
    const finalClickStepIndex = orderedSequenceIds.indexOf(
      clickStepIds[clickStepIds.length - 1],
    );
    orderedSequenceIds.splice(finalClickStepIndex + 1, 0, sequenceId);
  } else {
    orderedSequenceIds.push(sequenceId);
  }

  scene.sequenceOrder = orderedSequenceIds;
}

function ensureClipsInSlideEnterSequence(
  scene: AnimationScene,
  slideId: string,
  clipIds: string[],
) {
  const orphanClipIds = getUniqueExistingClipIds(scene, clipIds).filter(
    (clipId) =>
      !Object.values(scene.sequences).some((sequence) =>
        sequence.clipIds.includes(clipId),
      ),
  );

  if (orphanClipIds.length === 0) {
    return;
  }

  const orderedSequenceIds = getOrderedAnimationSequences(scene).map(
    (sequence) => sequence.id,
  );
  const existingSequenceId = orderedSequenceIds.find(
    (sequenceId) =>
      scene.sequences[sequenceId]?.trigger.type === "slide-enter",
  );

  if (existingSequenceId) {
    const sequence = scene.sequences[existingSequenceId];
    scene.sequences[existingSequenceId] = {
      ...sequence,
      clipIds: [...sequence.clipIds, ...orphanClipIds],
    };
    return;
  }

  const preferredSequenceId = getLegacySequenceId(slideId);
  let sequenceId = preferredSequenceId;
  let suffix = 1;

  while (scene.sequences[sequenceId]) {
    sequenceId = `${preferredSequenceId}-${suffix}`;
    suffix += 1;
  }

  scene.sequences[sequenceId] = {
    id: sequenceId,
    name: "页面进入动画",
    trigger: {
      type: "slide-enter",
    },
    clipIds: orphanClipIds,
    durationMode: "auto",
    playback: {
      repeat: 1,
      direction: "normal",
      playbackRate: 1,
    },
  };

  const firstClickStepIndex = orderedSequenceIds.findIndex(
    (currentSequenceId) =>
      scene.sequences[currentSequenceId]?.trigger.type === "click",
  );

  if (firstClickStepIndex < 0) {
    scene.sequenceOrder = [...orderedSequenceIds, sequenceId];
  } else {
    const nextSequenceOrder = [...orderedSequenceIds];
    nextSequenceOrder.splice(firstClickStepIndex, 0, sequenceId);
    scene.sequenceOrder = nextSequenceOrder;
  }
}

function stringArraysEqual(left: string[], right: string[]) {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}
