import type {
  AnimationScene,
  AnimationSequence,
  Slide,
} from "../types/presentation";
import {
  cloneAnimationScene,
  getLegacySequenceId,
} from "./animationCommandHelpers";
import {
  getAnimationClipOwnerSequences,
  getAnimationPageClickSteps,
  getAnimationPrimarySlideEnterSequence,
  getOrderedAnimationSequences,
} from "./animationSequence";

export { getAnimationPageClickSteps } from "./animationSequence";

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

export type AnimationEditorTriggerType = Extract<
  AnimationSequence["trigger"]["type"],
  "slide-enter" | "click"
>;

export type SetAnimationSequenceTriggerCommand = {
  sequenceId: string;

  /** V1 exposes only slide-enter and page-click; advanced triggers stay intact. */
  triggerType: AnimationEditorTriggerType;
};

export type SetAnimationClipTriggerCommand = {
  clipId: string;
  triggerType: AnimationEditorTriggerType;

  /** A click Clip may explicitly leave its current Step for a new Step. */
  createNewClickStep?: boolean;

  /** Supplied once by orchestration so Click Step ID allocation is deterministic. */
  operationId: string;
};

export type SetAnimationClipTriggerRequest = Omit<
  SetAnimationClipTriggerCommand,
  "operationId"
>;

export type AnimationClipSequenceContext = {
  sequenceId: string;
  sequenceName: string;
  sequenceClipCount: number;
  triggerType: AnimationSequence["trigger"]["type"] | "unsupported";
  isPageClickStep: boolean;

  /** One-based position among page-level Click Steps. */
  clickStepNumber?: number;
};

export type AnimationClipStage6ProtectionReason =
  | "missing-clip"
  | "orphan"
  | "ambiguous-ownership"
  | "additional-slide-enter"
  | "advanced-trigger"
  | "invalid-sequence";

export type AnimationClipStage6Capabilities = {
  canEditTrigger: boolean;
  editableTriggerType?: AnimationEditorTriggerType;
  protectionReason?: AnimationClipStage6ProtectionReason;
};

export type AnimationClipGroup = {
  id: string;
  type: "slide-enter" | "page-click" | "other";
  clipIds: string[];
  sequenceId?: string;
  sequenceName?: string;
  clickStepNumber?: number;
};

export type MoveAnimationClickStepCommand = {
  sequenceId: string;

  /** Zero-based position among Click Steps. */
  clickStepIndex: number;
};

export type MoveAnimationClipToClickStepCommand = {
  clipId: string;
  targetSequenceId: string;
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
    (sequence) => sequence.trigger?.type === "click",
  );
}

/**
 * Derive the Inspector's visual groups without changing persisted ownership.
 * Ambiguous ownership, unsupported triggers, additional slide-enter Sequences,
 * and orphan Clips remain visible in one protected fallback group.
 */
export function getAnimationClipGroups(
  scene?: AnimationScene,
): AnimationClipGroup[] {
  if (!scene || scene.schemaVersion !== 2) {
    return [];
  }

  const orderedSequences = getOrderedAnimationSequences(scene);
  const slideEnterSequence = getAnimationPrimarySlideEnterSequence(scene);
  const pageClickSequenceIds = new Set(
    getAnimationPageClickSteps(scene).map((sequence) => sequence.id),
  );
  const claimedClipIds = new Set<string>();
  let slideEnterGroup: AnimationClipGroup | undefined;
  const pageClickGroups: AnimationClipGroup[] = [];
  const otherClipIds: string[] = [];

  for (const sequence of orderedSequences) {
    const clipIds: string[] = [];

    for (const clipId of getUniqueExistingClipIds(scene, sequence.clipIds)) {
      if (claimedClipIds.has(clipId)) {
        continue;
      }

      claimedClipIds.add(clipId);

      if (getAnimationClipOwnerSequences(scene, clipId).length !== 1) {
        otherClipIds.push(clipId);
        continue;
      }

      clipIds.push(clipId);
    }

    if (clipIds.length === 0) {
      continue;
    }

    if (sequence.id === slideEnterSequence?.id) {
      slideEnterGroup = {
        id: `animation-group-${sequence.id}`,
        type: "slide-enter",
        sequenceId: sequence.id,
        sequenceName: sequence.name,
        clipIds,
      };
      continue;
    }

    if (pageClickSequenceIds.has(sequence.id)) {
      pageClickGroups.push({
        id: `animation-group-${sequence.id}`,
        type: "page-click",
        sequenceId: sequence.id,
        sequenceName: sequence.name,
        clickStepNumber: pageClickGroups.length + 1,
        clipIds,
      });
      continue;
    }

    otherClipIds.push(...clipIds);
  }

  for (const clipId of Object.keys(scene.clips)) {
    if (!claimedClipIds.has(clipId)) {
      claimedClipIds.add(clipId);
      otherClipIds.push(clipId);
    }
  }

  return [
    ...(slideEnterGroup ? [slideEnterGroup] : []),
    ...pageClickGroups,
    ...(otherClipIds.length > 0
      ? [
          {
            id: "animation-group-other-triggers",
            type: "other" as const,
            clipIds: otherClipIds,
          },
        ]
      : []),
  ];
}

/**
 * Describe whether one live Clip can safely use the ordinary Stage 6 trigger
 * editor. This is a pure capability query; protected historical state is never
 * repaired or normalized in the document.
 */
export function getAnimationClipStage6Capabilities(
  scene: AnimationScene | undefined,
  clipId: string,
): AnimationClipStage6Capabilities {
  if (!scene || scene.schemaVersion !== 2 || !scene.clips[clipId]) {
    return { canEditTrigger: false, protectionReason: "missing-clip" };
  }

  const owners = getAnimationClipOwnerSequences(scene, clipId);

  if (owners.length === 0) {
    return { canEditTrigger: false, protectionReason: "orphan" };
  }

  if (owners.length !== 1) {
    return {
      canEditTrigger: false,
      protectionReason: "ambiguous-ownership",
    };
  }

  const sequence = owners[0];
  const group = getAnimationClipGroups(scene).find((currentGroup) =>
    currentGroup.clipIds.includes(clipId),
  );

  if (group?.type === "slide-enter") {
    return { canEditTrigger: true, editableTriggerType: "slide-enter" };
  }

  if (group?.type === "page-click") {
    return { canEditTrigger: true, editableTriggerType: "click" };
  }

  if (!scene.sequenceOrder.includes(sequence.id)) {
    return { canEditTrigger: false, protectionReason: "invalid-sequence" };
  }

  if (sequence.trigger?.type === "slide-enter") {
    return {
      canEditTrigger: false,
      protectionReason: "additional-slide-enter",
    };
  }

  if (sequence.trigger?.type) {
    return { canEditTrigger: false, protectionReason: "advanced-trigger" };
  }

  return { canEditTrigger: false, protectionReason: "invalid-sequence" };
}

/**
 * Resolve the persisted Sequence and user-facing page Click Step number for one
 * Clip. Targeted click triggers remain outside the Stage 6 page-click editor.
 */
export function getAnimationClipSequenceContext(
  scene: AnimationScene | undefined,
  clipId: string,
): AnimationClipSequenceContext | undefined {
  if (!scene || scene.schemaVersion !== 2 || !scene.clips[clipId]) {
    return undefined;
  }

  const orderedSequences = getOrderedAnimationSequences(scene);
  const sequence = orderedSequences.find(
    (currentSequence) =>
      Array.isArray(currentSequence.clipIds) &&
      currentSequence.clipIds.includes(clipId),
  );

  if (!sequence) {
    return undefined;
  }

  const pageClickSteps = getAnimationPageClickSteps(scene);
  const clickStepIndex = pageClickSteps.findIndex(
    (currentSequence) => currentSequence.id === sequence.id,
  );
  const isPageClickStep = clickStepIndex >= 0;

  return {
    sequenceId: sequence.id,
    sequenceName: sequence.name,
    sequenceClipCount: getUniqueExistingClipIds(
      scene,
      sequence.clipIds,
    ).length,
    triggerType: sequence.trigger?.type ?? "unsupported",
    isPageClickStep,
    clickStepNumber: clickStepIndex >= 0 ? clickStepIndex + 1 : undefined,
  };
}

/**
 * Move one Clip between automatic page entry and a page Click Step.
 *
 * The Clip keeps its Sequence-local startMs. Moving to click creates a new Step;
 * moving back to automatic playback joins the existing slide-enter Sequence and
 * removes the source Step only when it becomes empty.
 */
export function setAnimationClipTriggerInSlide(
  slide: Slide,
  command: SetAnimationClipTriggerCommand,
): Slide {
  const scene = slide.animationScene;
  const clip = scene?.clips[command.clipId];
  const operationId = command.operationId.trim();

  if (!scene || scene.schemaVersion !== 2 || !clip || !operationId) {
    return slide;
  }

  const capabilities = getAnimationClipStage6Capabilities(scene, clip.id);
  const sequence = getAnimationClipOwnerSequences(scene, clip.id)[0];

  if (!capabilities.canEditTrigger || !sequence) {
    return slide;
  }

  const currentTriggerType = capabilities.editableTriggerType;

  const shouldCreateNewClickStep =
    currentTriggerType === "click" &&
    command.triggerType === "click" &&
    command.createNewClickStep === true;

  if (
    !currentTriggerType ||
    (currentTriggerType === command.triggerType && !shouldCreateNewClickStep)
  ) {
    return slide;
  }

  if (command.triggerType === "click") {
    return createAnimationClickStepInSlide(slide, {
      sequenceId: createDeterministicClickStepSequenceId(
        scene,
        slide.id,
        clip.id,
        operationId,
      ),
      clipIds: [clip.id],
    });
  }

  const nextScene = cloneAnimationScene(scene);

  const changedSequenceIds = removeClipIdsFromSequences(
    nextScene,
    new Set([clip.id]),
  );
  removeEmptySequenceIds(nextScene, changedSequenceIds);
  ensureClipsInSlideEnterSequence(nextScene, slide.id, [clip.id]);
  nextScene.revision = Math.max(1, scene.revision + 1);

  return {
    ...slide,
    animationScene: nextScene,
  };
}

/**
 * Move one Clip into an existing page Click Step without rebuilding the Clip.
 * Ownership must already be unambiguous, and advanced trigger Sequences remain
 * outside this command's mutation boundary.
 */
export function moveAnimationClipToClickStepInSlide(
  slide: Slide,
  command: MoveAnimationClipToClickStepCommand,
): Slide {
  const scene = slide.animationScene;
  const clip = scene?.clips[command.clipId];
  const targetSequence = scene?.sequences[command.targetSequenceId];

  if (
    !scene ||
    scene.schemaVersion !== 2 ||
    !clip ||
    !targetSequence ||
    !getAnimationPageClickSteps(scene).some(
      (sequence) => sequence.id === targetSequence.id,
    )
  ) {
    return slide;
  }

  const owningSequences = getAnimationClipOwnerSequences(scene, clip.id);
  const capabilities = getAnimationClipStage6Capabilities(scene, clip.id);

  if (!capabilities.canEditTrigger || owningSequences.length !== 1) {
    return slide;
  }

  const sourceSequence = owningSequences[0];

  if (sourceSequence.id === targetSequence.id) {
    return slide;
  }

  const nextScene = cloneAnimationScene(scene);
  const nextSourceSequence = nextScene.sequences[sourceSequence.id];
  const nextTargetSequence = nextScene.sequences[targetSequence.id];

  nextScene.sequences[sourceSequence.id] = {
    ...nextSourceSequence,
    clipIds: nextSourceSequence.clipIds.filter(
      (clipId) => clipId !== clip.id,
    ),
  };
  nextScene.sequences[targetSequence.id] = {
    ...nextTargetSequence,
    clipIds: [...nextTargetSequence.clipIds, clip.id],
  };

  if (nextScene.sequences[sourceSequence.id].clipIds.length === 0) {
    delete nextScene.sequences[sourceSequence.id];
    nextScene.sequenceOrder = nextScene.sequenceOrder.filter(
      (sequenceId) => sequenceId !== sourceSequence.id,
    );
  }

  nextScene.revision = Math.max(1, scene.revision + 1);

  return {
    ...slide,
    animationScene: nextScene,
  };
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

  if (
    clipIds.some(
      (clipId) =>
        !getAnimationClipStage6Capabilities(scene, clipId).canEditTrigger,
    )
  ) {
    return slide;
  }

  const nextScene = cloneAnimationScene(scene);

  /**
   * Clip ownership exists only in sequence.clipIds. Moving ownership preserves
   * startMs because it remains an offset from the destination Sequence local 0ms.
   */
  const changedSequenceIds = removeClipIdsFromSequences(
    nextScene,
    new Set(clipIds),
  );
  removeEmptySequenceIds(nextScene, changedSequenceIds);

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
    !sequence ||
    !getAnimationPageClickSteps(scene).some(
      (pageClickSequence) => pageClickSequence.id === sequence.id,
    )
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

  if (
    nextClipIds.some(
      (clipId) =>
        !getAnimationClipStage6Capabilities(scene, clipId).canEditTrigger,
    )
  ) {
    return slide;
  }

  const nextScene = cloneAnimationScene(scene);
  const nextClipIdSet = new Set(nextClipIds);
  const removedClipIds = sequence.clipIds.filter(
    (clipId) => !nextClipIdSet.has(clipId) && Boolean(scene.clips[clipId]),
  );
  const changedSequenceIds = removeClipIdsFromSequences(
    nextScene,
    nextClipIdSet,
    sequence.id,
  );
  const sequenceChanged =
    nextName !== sequence.name ||
    !stringArraysEqual(nextClipIds, sequence.clipIds);

  if (!sequenceChanged && changedSequenceIds.size === 0) {
    return slide;
  }

  nextScene.sequences[sequence.id] = {
    ...nextScene.sequences[sequence.id],
    name: nextName,
    clipIds: nextClipIds,
  };

  ensureClipsInSlideEnterSequence(nextScene, slide.id, removedClipIds);
  removeEmptySequenceIds(nextScene, changedSequenceIds);
  nextScene.revision = Math.max(1, scene.revision + 1);

  return {
    ...slide,
    animationScene: nextScene,
  };
}

/**
 * Switch one existing Sequence between automatic slide entry and a page Click
 * Step. The command stays immutable so orchestration can record the document
 * mutation as one Undo/Redo transaction.
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
    !sequence.trigger?.type ||
    sequence.trigger.type === command.triggerType
  ) {
    return slide;
  }

  const isEditableSequence =
    getAnimationPrimarySlideEnterSequence(scene)?.id === sequence.id ||
    getAnimationPageClickSteps(scene).some(
      (pageClickSequence) => pageClickSequence.id === sequence.id,
    );

  if (!isEditableSequence) {
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
 * Move one page-level Click Step while preserving every non-page-click
 * Sequence position. The shared live-Step query remains the single source for
 * numbering, boundary no-ops, and the order consumed by Stage 6 UI.
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
    sequence?.trigger?.type !== "click"
  ) {
    return slide;
  }

  if (!Number.isFinite(command.clickStepIndex)) {
    return slide;
  }

  const pageClickStepIds = getAnimationPageClickSteps(scene).map(
    (currentSequence) => currentSequence.id,
  );
  const sourceIndex = pageClickStepIds.indexOf(sequence.id);
  const targetIndex = Math.min(
    Math.max(0, Math.round(command.clickStepIndex)),
    pageClickStepIds.length - 1,
  );

  if (sourceIndex < 0 || sourceIndex === targetIndex) {
    return slide;
  }

  const reorderedClickStepIds = [...pageClickStepIds];
  const [movedSequenceId] = reorderedClickStepIds.splice(sourceIndex, 1);
  reorderedClickStepIds.splice(targetIndex, 0, movedSequenceId);

  const pageClickStepIdSet = new Set(pageClickStepIds);
  const visitedPageClickStepIds = new Set<string>();
  let clickStepCursor = 0;

  /**
   * Replace only each valid Step's first persisted slot. Historical duplicate
   * or missing references stay untouched, and omitted Sequences stay omitted.
   */
  const nextSequenceOrder = scene.sequenceOrder.map((sequenceId) => {
    if (
      !pageClickStepIdSet.has(sequenceId) ||
      visitedPageClickStepIds.has(sequenceId)
    ) {
      return sequenceId;
    }

    visitedPageClickStepIds.add(sequenceId);
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
  clipIds: string[] | undefined,
) {
  const seenClipIds = new Set<string>();

  return (Array.isArray(clipIds) ? clipIds : []).filter((clipId) => {
    if (!scene.clips[clipId] || seenClipIds.has(clipId)) {
      return false;
    }

    seenClipIds.add(clipId);
    return true;
  });
}

function createDeterministicClickStepSequenceId(
  scene: AnimationScene,
  slideId: string,
  clipId: string,
  operationId: string,
) {
  const baseId = `sequence-${slideId}-click-${clipId}-${operationId}`;
  let candidateId = baseId;
  let suffix = 1;

  while (scene.sequences[candidateId]) {
    candidateId = `${baseId}-${suffix}`;
    suffix += 1;
  }

  return candidateId;
}

function removeClipIdsFromSequences(
  scene: AnimationScene,
  clipIds: Set<string>,
  exceptSequenceId?: string,
) {
  const changedSequenceIds = new Set<string>();

  for (const [sequenceId, sequence] of Object.entries(scene.sequences)) {
    if (sequenceId === exceptSequenceId) {
      continue;
    }

    const currentClipIds = Array.isArray(sequence.clipIds)
      ? sequence.clipIds
      : [];
    const nextClipIds = currentClipIds.filter(
      (clipId) => !clipIds.has(clipId),
    );

    if (nextClipIds.length === currentClipIds.length) {
      continue;
    }

    changedSequenceIds.add(sequenceId);
    scene.sequences[sequenceId] = {
      ...sequence,
      clipIds: nextClipIds,
    };
  }

  return changedSequenceIds;
}

function removeEmptySequenceIds(
  scene: AnimationScene,
  candidateSequenceIds: ReadonlySet<string>,
) {
  const emptySequenceIds = new Set(
    [...candidateSequenceIds].filter(
      (sequenceId) => scene.sequences[sequenceId]?.clipIds.length === 0,
    ),
  );

  if (emptySequenceIds.size === 0) {
    return;
  }

  for (const sequenceId of emptySequenceIds) {
    delete scene.sequences[sequenceId];
  }

  scene.sequenceOrder = scene.sequenceOrder.filter(
    (sequenceId) => !emptySequenceIds.has(sequenceId),
  );
}

function insertClickStepSequenceId(
  scene: AnimationScene,
  sequenceId: string,
  requestedClickStepIndex?: number,
) {
  const orderedSequenceIds = getOrderedAnimationSequences(scene)
    .map((sequence) => sequence.id)
    .filter((currentSequenceId) => currentSequenceId !== sequenceId);
  const clickStepIds = getAnimationPageClickSteps(scene)
    .map((sequence) => sequence.id)
    .filter((currentSequenceId) => currentSequenceId !== sequenceId);
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
        Array.isArray(sequence.clipIds) && sequence.clipIds.includes(clipId),
      ),
  );

  if (orphanClipIds.length === 0) {
    return;
  }

  const orderedSequenceIds = getOrderedAnimationSequences(scene).map(
    (sequence) => sequence.id,
  );
  const existingSequenceId = getAnimationPrimarySlideEnterSequence(scene)?.id;

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
      getAnimationPageClickSteps(scene).some(
        (sequence) => sequence.id === currentSequenceId,
      ),
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
