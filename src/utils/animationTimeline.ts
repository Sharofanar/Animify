import type {
  AnimationClip,
  AnimationScene,
  AnimationSequence,
  AnimationTargetSubTarget,
  SlideElement,
} from "../types/presentation";
import { isAnimationClipLiveForElements } from "./animationLegacyCompatibility";
import {
  EASING_OFFSET_MATCH_TOLERANCE,
  getAnimationKeyframeOffsetBounds,
  sortAnimationKeyframes,
} from "./animationKeyframeRules";
import {
  getAnimationClipStage6Capabilities,
  getAnimationClipSequenceContext,
  type AnimationClipSequenceContext,
  type AnimationClipStage6ProtectionReason,
} from "./animationSequenceCommands";
import {
  getAnimationClipDirection,
  getAnimationClipEffectiveDurationMs,
  getAnimationClipIterations,
  getAnimationClipLocalEndMs,
  getAnimationClipLocalStartMs,
  getAnimationClipOwnerSequences,
  getAnimationClipPlaybackRate,
  getAnimationPageClickSteps,
  getAnimationPrimarySlideEnterSequence,
  getAnimationSequenceClips,
  getAnimationSequenceLocalDurationMs,
  getOrderedAnimationSequences,
} from "./animationSequence";

export type AnimationTimelineSequenceKind =
  | "slide-enter"
  | "page-click"
  | "targeted-click"
  | "hover"
  | "keyboard"
  | "media-time"
  | "manual"
  | "invalid"
  | "orphan";

export type AnimationTimelineProtectionReason =
  | AnimationClipStage6ProtectionReason
  | "missing-target"
  | "inactive-legacy-clip";

export type AnimationTimelineDiagnosticCode =
  | "advanced-trigger"
  | "ambiguous-ownership"
  | "empty-sequence"
  | "inactive-legacy-clip"
  | "invalid-clip-list"
  | "malformed-trigger"
  | "missing-clip-reference"
  | "missing-target"
  | "omitted-sequence-order"
  | "orphan"
  | "protected-sequence";

export type AnimationTimelineDiagnostic = {
  code: AnimationTimelineDiagnosticCode;
  relatedId?: string;
};

export type AnimationTimelineKeyframeEntry = {
  id: string;
  sourceIndex: number;
  offset: number;
  displayOffset: number;
  localTimeMs: number;
  timingEditable: boolean;
};

export type AnimationTimelineTrackEntry = {
  id: string;
  sourceIndex: number;
  name: string;
  property: string;
  enabled: boolean;
  keyframes: AnimationTimelineKeyframeEntry[];
};

export type AnimationTimelineTargetEntry = {
  sourceIndex: number;
  elementId: string;
  elementName?: string;
  available: boolean;
  subTarget?: AnimationTargetSubTarget;
};

export type AnimationTimelineClipEntry = {
  id: string;
  name: string;
  category: AnimationClip["category"];
  enabled: boolean;
  status: "normal" | "protected";
  protectionReason?: AnimationTimelineProtectionReason;
  diagnostics: AnimationTimelineDiagnostic[];

  sequenceGroupId: string;
  sequenceId?: string;
  sequenceName?: string;
  sequenceLabel: string;
  sequenceClipIndex?: number;
  ownerSequenceIds: string[];
  sequenceContext?: AnimationClipSequenceContext;

  authoredStartMs: number;
  localStartMs: number;
  authoredDurationMs: number;
  effectiveDurationMs?: number;
  effectiveEndMs?: number;
  playback: {
    iterations: number;
    direction: AnimationClip["direction"];
    playbackRate: number;
    effectiveIterations?: number;
    effectiveDirection?: AnimationClip["direction"];
    effectivePlaybackRate?: number;
  };

  targets: AnimationTimelineTargetEntry[];
  targetElementIds: string[];
  liveTargetElementIds: string[];
  missingTargetElementIds: string[];
  anchorElementId?: string;
  multiTarget: boolean;
  liveForElements: boolean;

  tracks: AnimationTimelineTrackEntry[];
  keyframeLocalTimesMs: number[];
};

export type AnimationTimelineSequenceGroup = {
  id: string;
  sequenceId?: string;
  name: string;
  label: string;
  kind: AnimationTimelineSequenceKind;
  status: "normal" | "protected";
  protectionReason?: AnimationTimelineProtectionReason;
  triggerType: string;
  sequenceOrderIndex?: number;
  viewOrder: number;
  clickStepNumber?: number;
  semanticDurationMs: number;
  sourceClipIds: string[];
  missingClipIds: string[];
  diagnostics: AnimationTimelineDiagnostic[];
  clips: AnimationTimelineClipEntry[];
};

export type AnimationTimelineObjectRow = {
  elementId: string;
  elementName: string;
  label: string;
  sourceElementIndex: number;
  clips: AnimationTimelineClipEntry[];
};

export type AnimationTimelineViewModel = {
  sequenceGroups: AnimationTimelineSequenceGroup[];
  objectRows: AnimationTimelineObjectRow[];
  clips: AnimationTimelineClipEntry[];
  markers: Array<{
    id: string;
    name: string;
    timeMs: number;
  }>;
  /** Compatibility extent for the existing V2-B shared local playback clock. */
  maximumAuthoredLocalEndMs: number;
  /** Presentation-only ruler extent; it is not a page-global animation time. */
  rulerExtentMs: number;
  visibleClipCount: number;
  protectedClipCount: number;
  unanchoredClipCount: number;
};

export type AnimationTimelineEditorSequencePhase =
  | "completed"
  | "active"
  | "pending";

/**
 * One derived Sequence-local editor sample.
 *
 * Pending samples never actively participate, but the Canvas may compile them
 * so the shared per-element resolver can derive a low-priority pre-trigger
 * baseline when no completed or active history exists. Nothing is persisted.
 */
export type AnimationTimelineEditorSequenceSample = {
  sequenceId: string;
  phase: AnimationTimelineEditorSequencePhase;
  localTimeMs: number;
  normalClipIds: string[];
};

/**
 * One editor-only Timeline selection with every parent identity preserved.
 *
 * Sequence groups without a persisted Sequence (for example orphan Clips) use
 * sequenceGroupId as their stable diagnostic context. This state never enters
 * AnimationScene, persistence, or History.
 */
export type AnimationTimelineSelection =
  | {
      kind: "clip";
      sequenceGroupId: string;
      sequenceId?: string;
      clipId: string;
    }
  | {
      kind: "track";
      sequenceGroupId: string;
      sequenceId?: string;
      clipId: string;
      trackId: string;
    }
  | {
      kind: "keyframe";
      sequenceGroupId: string;
      sequenceId?: string;
      clipId: string;
      primary: {
        trackId: string;
        keyframeId: string;
      };
      selectedKeyframes: Array<{
        trackId: string;
        keyframeId: string;
      }>;
    };

export type AnimationTimelineKeyframeSelection = Extract<
  AnimationTimelineSelection,
  { kind: "keyframe" }
>;

/**
 * External navigation intent stays separate from selection and playback.
 * requestId allows the same Clip to be revealed repeatedly.
 */
export type AnimationTimelineRevealRequest = {
  clipId: string;
  requestId: number;
};

export type AnimationTimelineHierarchyClipNode = {
  id: string;
  clip: AnimationTimelineClipEntry;
  objectElementId?: string;
  objectLabel: string;
  targetLabels: string[];
  selectionElementId?: string;
};

export type AnimationTimelineHierarchySequenceNode = {
  id: string;
  group: AnimationTimelineSequenceGroup;
  clips: AnimationTimelineHierarchyClipNode[];
};

export type AnimationTimelineHierarchy = {
  sequences: AnimationTimelineHierarchySequenceNode[];
};

type SequenceGroupBuilder = Omit<
  AnimationTimelineSequenceGroup,
  "clips" | "viewOrder"
> & {
  clips: AnimationTimelineClipEntry[];
};

const RULER_MINIMUM_DURATION_MS = 4000;
const RULER_END_PADDING_MS = 750;
const RULER_ROUNDING_STEP_MS = 500;

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}

function getSafeDurationMs(value: number) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, value)
    : 0;
}

function getNormalPlaybackSequenceGroups(
  model: AnimationTimelineViewModel,
) {
  return model.sequenceGroups.filter(
    (group) =>
      group.status === "normal" &&
      group.sequenceId !== undefined &&
      group.clips.some(
        (clip) => clip.status === "normal" && clip.liveForElements,
      ),
  );
}

function getAnimationTimelineClipSelection(
  clip: AnimationTimelineClipEntry,
): AnimationTimelineSelection {
  return {
    kind: "clip",
    sequenceGroupId: clip.sequenceGroupId,
    sequenceId: clip.sequenceId,
    clipId: clip.id,
  };
}

/**
 * Project the existing canonical Sequence / Clip read model into render-ready
 * hierarchy nodes. No Clip is duplicated for secondary targets.
 */
export function getAnimationTimelineHierarchy(
  model: AnimationTimelineViewModel,
): AnimationTimelineHierarchy {
  const objectRowByElementId = new Map(
    model.objectRows.map((row) => [row.elementId, row]),
  );

  return {
    sequences: model.sequenceGroups.map((group) => ({
      id: group.id,
      group,
      clips: group.clips.map((clip) => {
        const objectRow = clip.anchorElementId
          ? objectRowByElementId.get(clip.anchorElementId)
          : undefined;
        const targetLabels = clip.targets.map(
          (target) =>
            target.elementName ??
            `${target.elementId}${target.available ? "" : "（缺失）"}`,
        );

        return {
          id: clip.id,
          clip,
          objectElementId: objectRow?.elementId,
          objectLabel:
            objectRow?.label ?? targetLabels[0] ?? "无可用动画对象",
          targetLabels,
          selectionElementId:
            clip.anchorElementId ?? clip.targetElementIds[0],
        };
      }),
    })),
  };
}

/**
 * Return the canonical Clip-level selection used when another editor changes
 * Active Clip or a descendant selection becomes invalid.
 */
export function getAnimationTimelineSelectionForClip(
  model: AnimationTimelineViewModel,
  clipId: string | undefined,
) {
  const clip = clipId
    ? model.clips.find((entry) => entry.id === clipId)
    : undefined;

  return clip ? getAnimationTimelineClipSelection(clip) : null;
}

function getAnimationTimelineKeyframeIdentityKey(
  identity: AnimationTimelineKeyframeSelection["primary"],
) {
  return `${identity.trackId}\u0000${identity.keyframeId}`;
}

function getOrderedAnimationTimelineKeyframeIdentities(
  clip: AnimationTimelineClipEntry,
  identityKeys: ReadonlySet<string>,
) {
  return clip.tracks.flatMap((track) =>
    track.keyframes.flatMap((keyframe) => {
      const identity = { trackId: track.id, keyframeId: keyframe.id };

      return identityKeys.has(getAnimationTimelineKeyframeIdentityKey(identity))
        ? [identity]
        : [];
    }),
  );
}

function canJoinAnimationTimelineKeyframeMultiSelection(
  clip: AnimationTimelineClipEntry,
  trackId: string,
  keyframeId: string,
) {
  const keyframe = clip.tracks
    .find((track) => track.id === trackId)
    ?.keyframes.find((entry) => entry.id === keyframeId);

  return (
    clip.status === "normal" &&
    clip.liveForElements &&
    clip.sequenceId !== undefined &&
    clip.ownerSequenceIds.length === 1 &&
    clip.ownerSequenceIds[0] === clip.sequenceId &&
    keyframe?.timingEditable === true
  );
}

/**
 * Derive replace/toggle Keyframe selection from the one Timeline selection
 * source. View-model order owns deterministic member and primary fallback order.
 */
export function getAnimationTimelineKeyframeSelection(
  clip: AnimationTimelineClipEntry,
  requestedSelection: AnimationTimelineSelection | null | undefined,
  identity: AnimationTimelineKeyframeSelection["primary"],
  toggle: boolean,
): AnimationTimelineSelection {
  const context = {
    sequenceGroupId: clip.sequenceGroupId,
    sequenceId: clip.sequenceId,
    clipId: clip.id,
  };
  const targetExists = clip.tracks
    .find((track) => track.id === identity.trackId)
    ?.keyframes.some((keyframe) => keyframe.id === identity.keyframeId);

  if (!targetExists) {
    return { kind: "clip", ...context };
  }

  const singleton: AnimationTimelineKeyframeSelection = {
    kind: "keyframe",
    ...context,
    primary: identity,
    selectedKeyframes: [identity],
  };

  if (
    !toggle ||
    requestedSelection?.kind !== "keyframe" ||
    requestedSelection.clipId !== clip.id
  ) {
    return singleton;
  }

  const targetCanJoin = canJoinAnimationTimelineKeyframeMultiSelection(
    clip,
    identity.trackId,
    identity.keyframeId,
  );
  const currentCanJoin = requestedSelection.selectedKeyframes.every(
    (selectedKeyframe) =>
      canJoinAnimationTimelineKeyframeMultiSelection(
        clip,
        selectedKeyframe.trackId,
        selectedKeyframe.keyframeId,
      ),
  );

  if (!targetCanJoin || !currentCanJoin) {
    return requestedSelection;
  }

  const targetKey = getAnimationTimelineKeyframeIdentityKey(identity);
  const selectedIdentityKeys = new Set(
    requestedSelection.selectedKeyframes.map(
      getAnimationTimelineKeyframeIdentityKey,
    ),
  );
  const removing = selectedIdentityKeys.delete(targetKey);

  if (!removing) {
    selectedIdentityKeys.add(targetKey);
  }

  const selectedKeyframes = getOrderedAnimationTimelineKeyframeIdentities(
    clip,
    selectedIdentityKeys,
  );

  if (selectedKeyframes.length === 0) {
    return {
      kind: "track",
      ...context,
      trackId: identity.trackId,
    };
  }

  const requestedPrimaryKey = getAnimationTimelineKeyframeIdentityKey(
    requestedSelection.primary,
  );
  const primary = !removing
    ? identity
    : selectedIdentityKeys.has(requestedPrimaryKey)
      ? requestedSelection.primary
      : selectedKeyframes[0];

  return {
    kind: "keyframe",
    ...context,
    primary,
    selectedKeyframes,
  };
}

/**
 * Reconcile transient Timeline selection against the latest pure read model.
 *
 * A valid normal selection must belong to the current Active Sequence. A
 * protected Clip may remain selected for inspection without becoming normal
 * playback context. Missing descendants fall back toward their surviving Clip.
 */
export function reconcileAnimationTimelineSelection(
  model: AnimationTimelineViewModel,
  activeSequenceId: string | null,
  activeClipId: string | undefined,
  requestedSelection: AnimationTimelineSelection | null,
): AnimationTimelineSelection | null {
  const activeClip = activeClipId
    ? model.clips.find((clip) => clip.id === activeClipId)
    : undefined;
  const activeClipCanBeSelected =
    activeClip !== undefined &&
    (activeClip.status === "protected" ||
      activeClip.sequenceId === activeSequenceId);
  const fallbackSelection = activeClipCanBeSelected
    ? getAnimationTimelineClipSelection(activeClip)
    : null;

  if (!requestedSelection) {
    return fallbackSelection;
  }

  const clip = model.clips.find(
    (entry) => entry.id === requestedSelection.clipId,
  );

  if (!clip || clip.id !== activeClipId) {
    return fallbackSelection;
  }

  if (clip.status === "normal" && clip.sequenceId !== activeSequenceId) {
    return null;
  }

  const currentContext = {
    sequenceGroupId: clip.sequenceGroupId,
    sequenceId: clip.sequenceId,
    clipId: clip.id,
  };

  if (requestedSelection.kind === "clip") {
    return requestedSelection.sequenceGroupId === currentContext.sequenceGroupId &&
      requestedSelection.sequenceId === currentContext.sequenceId
      ? requestedSelection
      : { kind: "clip", ...currentContext };
  }

  if (requestedSelection.kind === "track") {
    const track = clip.tracks.find(
      (entry) => entry.id === requestedSelection.trackId,
    );

    if (!track) {
      return { kind: "clip", ...currentContext };
    }

    const trackSelection = {
      kind: "track" as const,
      ...currentContext,
      trackId: track.id,
    };

    return requestedSelection.sequenceGroupId === currentContext.sequenceGroupId &&
      requestedSelection.sequenceId === currentContext.sequenceId
      ? requestedSelection
      : trackSelection;
  }

  const requestedIdentityKeys = new Set(
    requestedSelection.selectedKeyframes.map(
      getAnimationTimelineKeyframeIdentityKey,
    ),
  );
  const selectedKeyframes = getOrderedAnimationTimelineKeyframeIdentities(
    clip,
    requestedIdentityKeys,
  );

  if (selectedKeyframes.length === 0) {
    const primaryTrack = clip.tracks.find(
      (entry) => entry.id === requestedSelection.primary.trackId,
    );

    return primaryTrack
      ? {
          kind: "track",
          ...currentContext,
          trackId: primaryTrack.id,
        }
      : { kind: "clip", ...currentContext };
  }

  const primaryKey = getAnimationTimelineKeyframeIdentityKey(
    requestedSelection.primary,
  );
  const primary = requestedIdentityKeys.has(primaryKey)
    ? selectedKeyframes.find(
        (identity) =>
          getAnimationTimelineKeyframeIdentityKey(identity) === primaryKey,
      ) ?? selectedKeyframes[0]
    : selectedKeyframes[0];
  const selectionAlreadyCanonical =
    requestedSelection.sequenceGroupId === currentContext.sequenceGroupId &&
    requestedSelection.sequenceId === currentContext.sequenceId &&
    requestedSelection.primary.trackId === primary.trackId &&
    requestedSelection.primary.keyframeId === primary.keyframeId &&
    requestedSelection.selectedKeyframes.length === selectedKeyframes.length &&
    requestedSelection.selectedKeyframes.every(
      (identity, index) =>
        identity.trackId === selectedKeyframes[index].trackId &&
        identity.keyframeId === selectedKeyframes[index].keyframeId,
    );

  return selectionAlreadyCanonical
    ? requestedSelection
    : {
        kind: "keyframe",
        ...currentContext,
        primary,
        selectedKeyframes,
      };
}

/**
 * Resolve the unique normal Sequence owned by one selectable Clip.
 *
 * Protected, ambiguous, orphaned, and otherwise non-normal Clips deliberately
 * return null instead of being promoted into the editor playback path.
 */
export function getAnimationTimelineNormalSequenceIdForClip(
  model: AnimationTimelineViewModel,
  clipId: string | undefined,
) {
  if (!clipId) {
    return null;
  }

  return (
    getNormalPlaybackSequenceGroups(model).find((group) =>
      group.clips.some(
        (clip) => clip.id === clipId && clip.status === "normal",
      ),
    )?.sequenceId ?? null
  );
}

/**
 * Reconcile one editor-only Active Sequence without changing Scene data.
 *
 * A still-valid explicit request wins. Active Clip ownership is only a fallback
 * here; Clip selection events request their owner explicitly in App so an old
 * Clip cannot steal an independently selected Sequence on every render.
 */
export function resolveAnimationTimelineActiveSequenceId(
  model: AnimationTimelineViewModel,
  requestedSequenceId: string | null | undefined,
  activeClipId?: string,
) {
  const normalGroups = getNormalPlaybackSequenceGroups(model);

  /** Null is the explicit editor-only All Elements View, not a stale request. */
  if (requestedSequenceId === null) {
    return null;
  }

  if (
    requestedSequenceId &&
    normalGroups.some((group) => group.sequenceId === requestedSequenceId)
  ) {
    return requestedSequenceId;
  }

  const activeClipSequenceId = getAnimationTimelineNormalSequenceIdForClip(
    model,
    activeClipId,
  );

  if (activeClipSequenceId) {
    return activeClipSequenceId;
  }

  return normalGroups[0]?.sequenceId ?? null;
}

/**
 * Derive the editor frame from ordered normal Sequence groups.
 *
 * Earlier Sequences sample their semantic completion, the current Sequence
 * samples its local Playhead, and later Sequences remain pending. A later sample
 * can only become a contextual baseline through the shared per-element resolver;
 * it never actively participates. Cross-Sequence offsets are never accumulated.
 */
export function getAnimationTimelineEditorSamples(
  model: AnimationTimelineViewModel,
  activeSequenceId: string | null,
  localTimeMs: number,
): AnimationTimelineEditorSequenceSample[] {
  if (!activeSequenceId) {
    return [];
  }

  const normalGroups = getNormalPlaybackSequenceGroups(model);
  const activeGroupIndex = normalGroups.findIndex(
    (group) => group.sequenceId === activeSequenceId,
  );

  if (activeGroupIndex < 0) {
    return [];
  }

  return normalGroups.flatMap((group, groupIndex) => {
    if (!group.sequenceId) {
      return [];
    }

    const semanticDurationMs = getSafeDurationMs(group.semanticDurationMs);
    const phase: AnimationTimelineEditorSequencePhase =
      groupIndex < activeGroupIndex
        ? "completed"
        : groupIndex === activeGroupIndex
          ? "active"
          : "pending";

    return [
      {
        sequenceId: group.sequenceId,
        phase,
        normalClipIds: group.clips.flatMap((clip) =>
          clip.status === "normal" && clip.liveForElements ? [clip.id] : [],
        ),
        localTimeMs:
          phase === "completed"
            ? semanticDurationMs
            : phase === "active"
              ? clamp(localTimeMs, 0, semanticDurationMs)
              : 0,
      },
    ];
  });
}

function getSafeTriggerType(sequence: AnimationSequence) {
  const trigger = (sequence as { trigger?: { type?: unknown } }).trigger;

  return typeof trigger?.type === "string" ? trigger.type : "unsupported";
}

function getSequenceKind(
  sequence: AnimationSequence,
): AnimationTimelineSequenceKind {
  const triggerType = getSafeTriggerType(sequence);

  switch (triggerType) {
    case "slide-enter":
      return "slide-enter";
    case "click":
      return sequence.trigger?.type === "click" &&
        sequence.trigger.targetElementId !== undefined
        ? "targeted-click"
        : "page-click";
    case "hover":
    case "keyboard":
    case "media-time":
    case "manual":
      return triggerType;
    default:
      return "invalid";
  }
}

function getProtectedSequenceReason(
  sequence: AnimationSequence,
  omittedFromSequenceOrder: boolean,
): AnimationTimelineProtectionReason {
  if (omittedFromSequenceOrder) {
    return "invalid-sequence";
  }

  const kind = getSequenceKind(sequence);

  if (kind === "slide-enter") {
    return "additional-slide-enter";
  }

  if (
    kind === "targeted-click" ||
    kind === "hover" ||
    kind === "keyboard" ||
    kind === "media-time" ||
    kind === "manual"
  ) {
    return "advanced-trigger";
  }

  return "invalid-sequence";
}

function createSequenceGroupBuilder(
  scene: AnimationScene,
  sequence: AnimationSequence,
  status: "normal" | "protected",
  clickStepNumber?: number,
): SequenceGroupBuilder {
  const sequenceOrderIndex = scene.sequenceOrder.indexOf(sequence.id);
  const omittedFromSequenceOrder = sequenceOrderIndex < 0;
  const kind = getSequenceKind(sequence);
  const triggerType = getSafeTriggerType(sequence);
  const sourceClipIds = Array.isArray(sequence.clipIds)
    ? [...sequence.clipIds]
    : [];
  const missingClipIds = sourceClipIds.filter(
    (clipId) => !scene.clips[clipId],
  );
  const existingClipCount = getAnimationSequenceClips(scene, sequence.id).length;
  const diagnostics: AnimationTimelineDiagnostic[] = [];

  if (!Array.isArray(sequence.clipIds)) {
    diagnostics.push({ code: "invalid-clip-list" });
  }

  if (sourceClipIds.length === 0) {
    diagnostics.push({ code: "empty-sequence" });
  }

  missingClipIds.forEach((clipId) => {
    diagnostics.push({ code: "missing-clip-reference", relatedId: clipId });
  });

  if (sourceClipIds.length > 0 && existingClipCount === 0) {
    diagnostics.push({ code: "empty-sequence" });
  }

  if (omittedFromSequenceOrder) {
    diagnostics.push({
      code: "omitted-sequence-order",
      relatedId: sequence.id,
    });
  }

  if (kind === "invalid") {
    diagnostics.push({ code: "malformed-trigger", relatedId: sequence.id });
  } else if (
    kind === "targeted-click" ||
    kind === "hover" ||
    kind === "keyboard" ||
    kind === "media-time" ||
    kind === "manual"
  ) {
    diagnostics.push({ code: "advanced-trigger", relatedId: sequence.id });
  }

  if (status === "protected") {
    diagnostics.push({ code: "protected-sequence", relatedId: sequence.id });
  }

  const label =
    status === "normal" && kind === "slide-enter"
      ? "页面进入 · 自动播放"
      : status === "normal" && kind === "page-click" && clickStepNumber
        ? `点击播放 · Step ${clickStepNumber}`
        : sequence.name || `Sequence ${sequence.id}`;

  return {
    id: `animation-timeline-sequence-${sequence.id}`,
    sequenceId: sequence.id,
    name: sequence.name,
    label,
    kind,
    status,
    protectionReason:
      status === "protected"
        ? getProtectedSequenceReason(sequence, omittedFromSequenceOrder)
        : undefined,
    triggerType,
    sequenceOrderIndex:
      sequenceOrderIndex >= 0 ? sequenceOrderIndex : undefined,
    clickStepNumber,
    semanticDurationMs: getAnimationSequenceLocalDurationMs(
      scene,
      sequence.id,
    ),
    sourceClipIds,
    missingClipIds,
    diagnostics,
    clips: [],
  };
}

function createSyntheticGroupBuilder(
  id: string,
  label: string,
  kind: AnimationTimelineSequenceKind,
  protectionReason: AnimationTimelineProtectionReason,
  diagnosticCode: AnimationTimelineDiagnosticCode,
): SequenceGroupBuilder {
  return {
    id,
    name: label,
    label,
    kind,
    status: "protected",
    protectionReason,
    triggerType: "unsupported",
    semanticDurationMs: 0,
    sourceClipIds: [],
    missingClipIds: [],
    diagnostics: [{ code: diagnosticCode }],
    clips: [],
  };
}

function getClipDiscoveryOrder(
  scene: AnimationScene,
  sequences: readonly AnimationSequence[],
) {
  const seenClipIds = new Set<string>();
  const clipIds: string[] = [];

  for (const sequence of sequences) {
    const sequenceClipIds = Array.isArray(sequence.clipIds)
      ? sequence.clipIds
      : [];

    for (const clipId of sequenceClipIds) {
      if (!scene.clips[clipId] || seenClipIds.has(clipId)) {
        continue;
      }

      seenClipIds.add(clipId);
      clipIds.push(clipId);
    }
  }

  for (const clipId of Object.keys(scene.clips)) {
    if (seenClipIds.has(clipId)) {
      continue;
    }

    seenClipIds.add(clipId);
    clipIds.push(clipId);
  }

  return clipIds;
}

function createClipEntry(
  scene: AnimationScene,
  elements: readonly SlideElement[],
  clip: AnimationClip,
  group: SequenceGroupBuilder,
  owners: AnimationSequence[],
): AnimationTimelineClipEntry {
  const elementById = new Map(elements.map((element) => [element.id, element]));
  const targets = (Array.isArray(clip.targets) ? clip.targets : []).map(
    (target, sourceIndex) => {
      const element = elementById.get(target.elementId);

      return {
        sourceIndex,
        elementId: target.elementId,
        elementName: element?.name,
        available: element !== undefined,
        subTarget: target.subTarget
          ? ({ ...target.subTarget } as AnimationTargetSubTarget)
          : undefined,
      };
    },
  );
  const targetElementIds = targets.map((target) => target.elementId);
  const liveTargetElementIds = targets.flatMap((target) =>
    target.available ? [target.elementId] : [],
  );
  const missingTargetElementIds = targets.flatMap((target) =>
    target.available ? [] : [target.elementId],
  );
  const anchorElementId = targets.find((target) => target.available)?.elementId;
  const liveForElements = isAnimationClipLiveForElements(clip, elements);
  const sequence = owners.length === 1 ? owners[0] : undefined;
  const sequenceContext = getAnimationClipSequenceContext(scene, clip.id);
  const capabilities = getAnimationClipStage6Capabilities(scene, clip.id);
  const localStartMs = getAnimationClipLocalStartMs(clip);
  const safeAuthoredDurationMs =
    typeof clip.durationMs === "number" && Number.isFinite(clip.durationMs)
      ? Math.max(0, clip.durationMs)
      : 0;
  const tracks = (Array.isArray(clip.tracks) ? clip.tracks : []).map(
    (track, sourceIndex): AnimationTimelineTrackEntry => {
      const sourceKeyframes = Array.isArray(track.keyframes)
        ? track.keyframes
        : [];

      return {
        id: track.id,
        sourceIndex,
        name: track.name,
        property: track.property,
        enabled: track.enabled,
        keyframes: sortAnimationKeyframes(sourceKeyframes).map((keyframe) => {
          const displayOffset = Number.isFinite(keyframe.offset)
            ? clamp(keyframe.offset, 0, 1)
            : 0;
          const bounds = getAnimationKeyframeOffsetBounds(
            sourceKeyframes,
            keyframe.id,
          );

          return {
            id: keyframe.id,
            sourceIndex: sourceKeyframes.indexOf(keyframe),
            offset: keyframe.offset,
            displayOffset,
            localTimeMs:
              localStartMs + safeAuthoredDurationMs * displayOffset,
            timingEditable:
              Number.isFinite(clip.startMs) &&
              Number.isFinite(clip.durationMs) &&
              clip.durationMs > 0 &&
              bounds.editable,
          };
        }),
      };
    },
  );
  const aggregateOffsets = tracks
    .filter((track) => track.enabled)
    .flatMap((track) => track.keyframes.map((keyframe) => keyframe.displayOffset))
    .sort((left, right) => left - right)
    .filter(
      (offset, index, offsets) =>
        index === 0 ||
        Math.abs(offset - offsets[index - 1]) >
          EASING_OFFSET_MATCH_TOLERANCE,
    );
  const diagnostics: AnimationTimelineDiagnostic[] = [];

  missingTargetElementIds.forEach((elementId) => {
    diagnostics.push({ code: "missing-target", relatedId: elementId });
  });

  if (targets.length === 0) {
    diagnostics.push({ code: "missing-target" });
  }

  if (!liveForElements && liveTargetElementIds.length > 0) {
    diagnostics.push({ code: "inactive-legacy-clip", relatedId: clip.id });
  }

  if (owners.length === 0) {
    diagnostics.push({ code: "orphan", relatedId: clip.id });
  } else if (owners.length > 1) {
    diagnostics.push({ code: "ambiguous-ownership", relatedId: clip.id });
  }

  const protectionReason: AnimationTimelineProtectionReason | undefined =
    !capabilities.canEditTrigger
      ? capabilities.protectionReason
      : !liveForElements
        ? liveTargetElementIds.length > 0
          ? "inactive-legacy-clip"
          : "missing-target"
        : group.status === "protected"
          ? group.protectionReason
          : undefined;
  const sequenceClipIndex = sequence
    ? (Array.isArray(sequence.clipIds) ? sequence.clipIds : []).indexOf(clip.id)
    : undefined;

  return {
    id: clip.id,
    name: clip.name,
    category: clip.category,
    enabled: clip.enabled,
    status: protectionReason ? "protected" : "normal",
    protectionReason,
    diagnostics,
    sequenceGroupId: group.id,
    sequenceId: sequence?.id,
    sequenceName: sequence?.name,
    sequenceLabel: group.label,
    sequenceClipIndex:
      sequenceClipIndex !== undefined && sequenceClipIndex >= 0
        ? sequenceClipIndex
        : undefined,
    ownerSequenceIds: owners.map((owner) => owner.id),
    sequenceContext,
    authoredStartMs: clip.startMs,
    localStartMs,
    authoredDurationMs: clip.durationMs,
    effectiveDurationMs: sequence
      ? getAnimationClipEffectiveDurationMs(clip, sequence)
      : undefined,
    effectiveEndMs: sequence
      ? getAnimationClipLocalEndMs(clip, sequence)
      : undefined,
    playback: {
      iterations: clip.iterations,
      direction: clip.direction,
      playbackRate: clip.playbackRate ?? 1,
      effectiveIterations: sequence
        ? getAnimationClipIterations(clip, sequence)
        : undefined,
      effectiveDirection: sequence
        ? getAnimationClipDirection(clip, sequence)
        : undefined,
      effectivePlaybackRate: sequence
        ? getAnimationClipPlaybackRate(clip, sequence)
        : undefined,
    },
    targets,
    targetElementIds,
    liveTargetElementIds,
    missingTargetElementIds,
    anchorElementId,
    multiTarget: targets.length > 1,
    liveForElements,
    tracks,
    keyframeLocalTimesMs: aggregateOffsets.map(
      (offset) => localStartMs + safeAuthoredDurationMs * offset,
    ),
  };
}

/**
 * Build the Timeline's deterministic read model without changing Scene
 * ownership or interpreting Sequence-local offsets as page-global time.
 */
export function getAnimationTimelineViewModel(
  scene: AnimationScene | undefined,
  elements: readonly SlideElement[],
): AnimationTimelineViewModel {
  if (!scene || scene.schemaVersion !== 2) {
    return {
      sequenceGroups: [],
      objectRows: [],
      clips: [],
      markers: [],
      maximumAuthoredLocalEndMs: 0,
      rulerExtentMs: RULER_MINIMUM_DURATION_MS,
      visibleClipCount: 0,
      protectedClipCount: 0,
      unanchoredClipCount: 0,
    };
  }

  const orderedSequences = getOrderedAnimationSequences(scene);
  const primarySlideEnter = getAnimationPrimarySlideEnterSequence(scene);
  const pageClickSteps = getAnimationPageClickSteps(scene);
  const normalSequenceIds = new Set([
    ...(primarySlideEnter ? [primarySlideEnter.id] : []),
    ...pageClickSteps.map((sequence) => sequence.id),
  ]);
  const realGroups: SequenceGroupBuilder[] = [
    ...(primarySlideEnter
      ? [createSequenceGroupBuilder(scene, primarySlideEnter, "normal")]
      : []),
    ...pageClickSteps.map((sequence, index) =>
      createSequenceGroupBuilder(scene, sequence, "normal", index + 1),
    ),
    ...orderedSequences
      .filter((sequence) => !normalSequenceIds.has(sequence.id))
      .map((sequence) =>
        createSequenceGroupBuilder(scene, sequence, "protected"),
      ),
  ];
  const groupBySequenceId = new Map(
    realGroups.flatMap((group) =>
      group.sequenceId ? [[group.sequenceId, group] as const] : [],
    ),
  );
  const ambiguousGroup = createSyntheticGroupBuilder(
    "animation-timeline-protected-ambiguous",
    "归属不明确的动画",
    "invalid",
    "ambiguous-ownership",
    "ambiguous-ownership",
  );
  const orphanGroup = createSyntheticGroupBuilder(
    "animation-timeline-protected-orphan",
    "未归入 Sequence 的动画",
    "orphan",
    "orphan",
    "orphan",
  );

  for (const clipId of getClipDiscoveryOrder(scene, orderedSequences)) {
    const clip = scene.clips[clipId];
    const owners = getAnimationClipOwnerSequences(scene, clipId);
    const group =
      owners.length === 0
        ? orphanGroup
        : owners.length > 1
          ? ambiguousGroup
          : groupBySequenceId.get(owners[0].id);

    if (!clip || !group) {
      continue;
    }

    const entry = createClipEntry(scene, elements, clip, group, owners);

    group.clips.push(entry);
    group.sourceClipIds = group.sequenceId
      ? group.sourceClipIds
      : [...group.sourceClipIds, clip.id];

    if (owners.length > 1) {
      owners.forEach((owner) => {
        groupBySequenceId.get(owner.id)?.diagnostics.push({
          code: "ambiguous-ownership",
          relatedId: clip.id,
        });
      });
    }
  }

  const groupBuilders = [
    ...realGroups,
    ...(ambiguousGroup.clips.length > 0 ? [ambiguousGroup] : []),
    ...(orphanGroup.clips.length > 0 ? [orphanGroup] : []),
  ];
  const sequenceGroups = groupBuilders.map(
    (group, viewOrder): AnimationTimelineSequenceGroup => ({
      ...group,
      viewOrder,
    }),
  );
  const clips = sequenceGroups.flatMap((group) => group.clips);
  const elementById = new Map(elements.map((element) => [element.id, element]));
  const rowByElementId = new Map<string, AnimationTimelineObjectRow>();
  const objectRows: AnimationTimelineObjectRow[] = [];

  for (const clip of clips) {
    if (!clip.liveForElements || !clip.anchorElementId) {
      continue;
    }

    const element = elementById.get(clip.anchorElementId);

    if (!element) {
      continue;
    }

    const existingRow = rowByElementId.get(element.id);

    if (existingRow) {
      existingRow.clips.push(clip);
      continue;
    }

    const row: AnimationTimelineObjectRow = {
      elementId: element.id,
      elementName: element.name,
      label: element.content || element.name || element.id,
      sourceElementIndex: elements.indexOf(element),
      clips: [clip],
    };

    rowByElementId.set(element.id, row);
    objectRows.push(row);
  }

  const maximumAuthoredLocalEndMs = clips
    .filter((clip) => clip.liveForElements)
    .reduce(
      (maximumEndMs, clip) =>
        Math.max(
          maximumEndMs,
          clip.authoredStartMs + clip.authoredDurationMs,
        ),
      0,
    );
  const maximumSequenceLocalExtentMs = Math.max(
    maximumAuthoredLocalEndMs,
    ...sequenceGroups.map((group) =>
      getSafeDurationMs(group.semanticDurationMs),
    ),
  );
  const rulerExtentMs = Math.max(
    RULER_MINIMUM_DURATION_MS,
    Math.ceil(
      (maximumSequenceLocalExtentMs + RULER_END_PADDING_MS) /
        RULER_ROUNDING_STEP_MS,
    ) * RULER_ROUNDING_STEP_MS,
  );

  return {
    sequenceGroups,
    objectRows,
    clips,
    markers: scene.markers.map((marker) => ({ ...marker })),
    maximumAuthoredLocalEndMs,
    rulerExtentMs,
    visibleClipCount: objectRows.reduce(
      (clipCount, row) => clipCount + row.clips.length,
      0,
    ),
    protectedClipCount: clips.filter((clip) => clip.status === "protected")
      .length,
    unanchoredClipCount: clips.filter(
      (clip) => !clip.liveForElements || !clip.anchorElementId,
    ).length,
  };
}
