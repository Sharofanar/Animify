import type {
  AnimationClip,
  AnimationKeyframe,
  AnimationTrack,
  Slide,
} from "../types/presentation";
import { updateAnimationClipTimingInSlide } from "./animationCommands";
import { compileAnimationSequence } from "./animationCompiler";
import {
  updateAnimationKeyframeOffsetInSlide,
  updateAnimationKeyframeOffsetsInSlide,
} from "./animationKeyframeCommands";
import {
  getAnimationKeyframeGroupOffsetBounds,
  getAnimationKeyframeOffsetBounds,
  normalizeAnimationKeyframeOffset,
  normalizeAnimationKeyframeOffsetDelta,
  type AnimationKeyframeGroupMember,
  type AnimationKeyframeGroupOffsetBounds,
  type AnimationKeyframeIdentity,
  type AnimationKeyframeOffsetBounds,
} from "./animationKeyframeRules";
import { getAnimationTimelineViewModel } from "./animationTimeline";

export const ANIMATION_TIMELINE_TIMING_DRAG_THRESHOLD_PX = 3;
export const ANIMATION_TIMELINE_CLIP_START_DRAG_THRESHOLD_PX =
  ANIMATION_TIMELINE_TIMING_DRAG_THRESHOLD_PX;
export const ANIMATION_TIMELINE_TIMING_SNAP_THRESHOLD_PX = 6;
export const ANIMATION_TIMELINE_TIMING_PRECISION_MS = 10;
export const ANIMATION_TIMELINE_MINIMUM_CLIP_DURATION_MS = 1;

export type AnimationTimelineTimingSnapKind =
  | "zero"
  | "ruler-grid"
  | "playhead";

export type AnimationTimelineTimingSnap = {
  kind: AnimationTimelineTimingSnapKind;
  timeMs: number;
};

export type AnimationTimelineClipStartCandidate = {
  startMs: number;
  snap?: AnimationTimelineTimingSnap;
};

export type AnimationTimelineClipDurationCandidate = {
  durationMs: number;
  authoredEndMs: number;
  snap?: AnimationTimelineTimingSnap;
};

export type AnimationTimelineKeyframeOffsetCandidate = {
  offset: number;
  localTimeMs: number;
  snap?: AnimationTimelineTimingSnap;
};

export type AnimationTimelineKeyframeGroupOffsetCandidate = {
  deltaOffset: number;
  anchorLocalTimeMs: number;
  snap?: AnimationTimelineTimingSnap;
};

type AnimationTimelineTimingEditSessionBase = {
  slideId: string;
  sequenceId: string;
  clipId: string;
  pointerId: number;
  sourceSlide: Slide;
  sourceSceneRevision: number;
  sourceStartMs: number;
  sourceDurationMs: number;
  dragging: boolean;
  snap?: AnimationTimelineTimingSnap;
};

export type AnimationTimelineClipStartEditSession =
  AnimationTimelineTimingEditSessionBase & {
    kind: "clip-start";
    candidateStartMs: number;
  };

export type AnimationTimelineClipDurationEditSession =
  AnimationTimelineTimingEditSessionBase & {
    kind: "clip-duration";
    sourceAuthoredEndMs: number;
    candidateDurationMs: number;
    candidateAuthoredEndMs: number;
  };

export type AnimationTimelineKeyframeOffsetEditSession =
  AnimationTimelineTimingEditSessionBase & {
    kind: "keyframe-offset";
    trackId: string;
    keyframeId: string;
    sourceOffset: number;
    sourceLocalTimeMs: number;
    minimumOffset: number;
    maximumOffset: number;
    candidateOffset: number;
    candidateLocalTimeMs: number;
  };

export type AnimationTimelineKeyframeGroupOffsetEditSession =
  AnimationTimelineTimingEditSessionBase & {
    kind: "keyframe-group-offset";
    anchorTrackId: string;
    anchorKeyframeId: string;
    sourceAnchorOffset: number;
    sourceAnchorLocalTimeMs: number;
    keyframes: AnimationKeyframeGroupMember[];
    minimumDeltaOffset: number;
    maximumDeltaOffset: number;
    candidateDeltaOffset: number;
    candidateAnchorLocalTimeMs: number;
  };

export type AnimationTimelineTimingEditSession =
  | AnimationTimelineClipStartEditSession
  | AnimationTimelineClipDurationEditSession
  | AnimationTimelineKeyframeOffsetEditSession
  | AnimationTimelineKeyframeGroupOffsetEditSession;

export type BeginAnimationTimelineTimingEditRequest =
  | {
      kind: "clip-start" | "clip-duration";
      sequenceId: string;
      clipId: string;
      pointerId: number;
    }
  | {
      kind: "keyframe-offset";
      sequenceId: string;
      clipId: string;
      trackId: string;
      keyframeId: string;
      pointerId: number;
    }
  | {
      kind: "keyframe-group-offset";
      sequenceId: string;
      clipId: string;
      anchorTrackId: string;
      anchorKeyframeId: string;
      keyframes: AnimationKeyframeIdentity[];
      pointerId: number;
    };

export type BeginAnimationTimelineClipStartEditRequest = {
  sequenceId: string;
  clipId: string;
  pointerId: number;
};

export type GetAnimationTimelineClipStartCandidateRequest = {
  sourceStartMs: number;
  deltaPixels: number;
  pixelsPerMs: number;
  rulerGridStepMs: number;
  playheadTimeMs: number;
};

export type GetAnimationTimelineClipDurationCandidateRequest = {
  sourceStartMs: number;
  sourceDurationMs: number;
  deltaPixels: number;
  pixelsPerMs: number;
  rulerGridStepMs: number;
  playheadTimeMs: number;
};

export type GetAnimationTimelineKeyframeOffsetCandidateRequest = {
  sourceStartMs: number;
  sourceDurationMs: number;
  sourceOffset: number;
  minimumOffset: number;
  maximumOffset: number;
  deltaPixels: number;
  pixelsPerMs: number;
  rulerGridStepMs: number;
  playheadTimeMs: number;
};

export type GetAnimationTimelineKeyframeGroupOffsetCandidateRequest = {
  sourceStartMs: number;
  sourceDurationMs: number;
  sourceAnchorOffset: number;
  minimumDeltaOffset: number;
  maximumDeltaOffset: number;
  deltaPixels: number;
  pixelsPerMs: number;
  rulerGridStepMs: number;
  playheadTimeMs: number;
};

type DirectEditableKeyframe = {
  clip: AnimationClip;
  track: AnimationTrack;
  keyframe: AnimationKeyframe;
  bounds: Extract<AnimationKeyframeOffsetBounds, { editable: true }>;
};

type DirectEditableKeyframeGroup = {
  clip: AnimationClip;
  bounds: Extract<AnimationKeyframeGroupOffsetBounds, { editable: true }>;
  anchor: AnimationKeyframeGroupMember;
};

function getDirectEditableClip(
  slide: Slide,
  sequenceId: string,
  clipId: string,
): AnimationClip | undefined {
  const scene = slide.animationScene;
  const clip = scene?.clips[clipId];

  if (
    !scene ||
    scene.schemaVersion !== 2 ||
    !clip ||
    !Number.isFinite(clip.startMs)
  ) {
    return undefined;
  }

  const entry = getAnimationTimelineViewModel(scene, slide.elements).clips.find(
    (candidate) => candidate.id === clipId,
  );

  if (
    !entry ||
    entry.status !== "normal" ||
    !entry.liveForElements ||
    entry.sequenceId !== sequenceId ||
    entry.ownerSequenceIds.length !== 1 ||
    entry.ownerSequenceIds[0] !== sequenceId
  ) {
    return undefined;
  }

  return clip;
}

/** Protected or malformed historical state remains inspect-only. */
export function canDirectEditAnimationTimelineClipStart(
  slide: Slide,
  sequenceId: string,
  clipId: string,
) {
  return getDirectEditableClip(slide, sequenceId, clipId) !== undefined;
}

export function canDirectEditAnimationTimelineClipDuration(
  slide: Slide,
  sequenceId: string,
  clipId: string,
) {
  const clip = getDirectEditableClip(slide, sequenceId, clipId);

  if (
    !clip ||
    !Number.isFinite(clip.durationMs) ||
    clip.durationMs < ANIMATION_TIMELINE_MINIMUM_CLIP_DURATION_MS
  ) {
    return false;
  }

  try {
    return Object.values(
      compileAnimationSequence(slide.animationScene, sequenceId).byElementId,
    ).some((animations) =>
      animations.some((animation) => animation.clipId === clipId),
    );
  } catch {
    /** Malformed historical track data stays inspect-only. */
    return false;
  }
}

function getDirectEditableKeyframe(
  slide: Slide,
  sequenceId: string,
  clipId: string,
  trackId: string,
  keyframeId: string,
): DirectEditableKeyframe | undefined {
  const clip = getDirectEditableClip(slide, sequenceId, clipId);

  if (
    !clip ||
    !Number.isFinite(clip.durationMs) ||
    clip.durationMs <= 0
  ) {
    return undefined;
  }

  const track = Array.isArray(clip.tracks)
    ? clip.tracks.find((candidate) => candidate.id === trackId)
    : undefined;
  const keyframe = Array.isArray(track?.keyframes)
    ? track.keyframes.find((candidate) => candidate.id === keyframeId)
    : undefined;

  if (!track || !keyframe || !Number.isFinite(keyframe.offset)) {
    return undefined;
  }

  const bounds = getAnimationKeyframeOffsetBounds(track.keyframes, keyframeId);

  return bounds.editable ? { clip, track, keyframe, bounds } : undefined;
}

function getDirectEditableKeyframeGroup(
  slide: Slide,
  sequenceId: string,
  clipId: string,
  anchorTrackId: string,
  anchorKeyframeId: string,
  keyframes: readonly AnimationKeyframeIdentity[],
): DirectEditableKeyframeGroup | undefined {
  const clip = getDirectEditableClip(slide, sequenceId, clipId);

  if (
    !clip ||
    !Number.isFinite(clip.durationMs) ||
    clip.durationMs <= 0 ||
    !Array.isArray(clip.tracks)
  ) {
    return undefined;
  }

  const bounds = getAnimationKeyframeGroupOffsetBounds(clip.tracks, keyframes);

  if (!bounds.editable) {
    return undefined;
  }

  const anchor = bounds.keyframes.find(
    (keyframe) =>
      keyframe.trackId === anchorTrackId &&
      keyframe.keyframeId === anchorKeyframeId,
  );

  return anchor ? { clip, bounds, anchor } : undefined;
}

export function canDirectEditAnimationTimelineKeyframeOffset(
  slide: Slide,
  sequenceId: string,
  clipId: string,
  trackId: string,
  keyframeId: string,
) {
  return (
    getDirectEditableKeyframe(
      slide,
      sequenceId,
      clipId,
      trackId,
      keyframeId,
    ) !== undefined
  );
}

export function createAnimationTimelineTimingEditSession(
  slide: Slide,
  request: BeginAnimationTimelineTimingEditRequest,
): AnimationTimelineTimingEditSession | null {
  const clip = getDirectEditableClip(slide, request.sequenceId, request.clipId);

  if (!clip) {
    return null;
  }

  if (request.kind === "keyframe-group-offset") {
    const target = getDirectEditableKeyframeGroup(
      slide,
      request.sequenceId,
      request.clipId,
      request.anchorTrackId,
      request.anchorKeyframeId,
      request.keyframes,
    );

    if (!target) {
      return null;
    }

    const sourceAnchorLocalTimeMs =
      clip.startMs + clip.durationMs * target.anchor.offset;

    return {
      kind: "keyframe-group-offset",
      slideId: slide.id,
      sequenceId: request.sequenceId,
      clipId: request.clipId,
      anchorTrackId: request.anchorTrackId,
      anchorKeyframeId: request.anchorKeyframeId,
      pointerId: request.pointerId,
      sourceSlide: slide,
      sourceSceneRevision: slide.animationScene.revision,
      sourceStartMs: clip.startMs,
      sourceDurationMs: clip.durationMs,
      sourceAnchorOffset: target.anchor.offset,
      sourceAnchorLocalTimeMs,
      keyframes: target.bounds.keyframes,
      minimumDeltaOffset: target.bounds.minimumDeltaOffset,
      maximumDeltaOffset: target.bounds.maximumDeltaOffset,
      candidateDeltaOffset: 0,
      candidateAnchorLocalTimeMs: sourceAnchorLocalTimeMs,
      dragging: false,
    };
  }

  if (request.kind === "keyframe-offset") {
    const target = getDirectEditableKeyframe(
      slide,
      request.sequenceId,
      request.clipId,
      request.trackId,
      request.keyframeId,
    );

    if (!target) {
      return null;
    }

    const sourceLocalTimeMs =
      clip.startMs + clip.durationMs * target.keyframe.offset;

    return {
      kind: "keyframe-offset",
      slideId: slide.id,
      sequenceId: request.sequenceId,
      clipId: request.clipId,
      trackId: request.trackId,
      keyframeId: request.keyframeId,
      pointerId: request.pointerId,
      sourceSlide: slide,
      sourceSceneRevision: slide.animationScene.revision,
      sourceStartMs: clip.startMs,
      sourceDurationMs: clip.durationMs,
      sourceOffset: target.keyframe.offset,
      sourceLocalTimeMs,
      minimumOffset: target.bounds.minimumOffset,
      maximumOffset: target.bounds.maximumOffset,
      candidateOffset: target.keyframe.offset,
      candidateLocalTimeMs: sourceLocalTimeMs,
      dragging: false,
    };
  }

  if (
    request.kind === "clip-duration" &&
      (!Number.isFinite(clip.durationMs) ||
        clip.durationMs < ANIMATION_TIMELINE_MINIMUM_CLIP_DURATION_MS ||
        !canDirectEditAnimationTimelineClipDuration(
          slide,
          request.sequenceId,
          request.clipId,
        ))
  ) {
    return null;
  }

  const base: AnimationTimelineTimingEditSessionBase = {
    slideId: slide.id,
    sequenceId: request.sequenceId,
    clipId: request.clipId,
    pointerId: request.pointerId,
    sourceSlide: slide,
    sourceSceneRevision: slide.animationScene.revision,
    sourceStartMs: clip.startMs,
    sourceDurationMs: clip.durationMs,
    dragging: false,
  };

  if (request.kind === "clip-duration") {
    const sourceAuthoredEndMs = clip.startMs + clip.durationMs;

    return {
      ...base,
      kind: "clip-duration",
      sourceAuthoredEndMs,
      candidateDurationMs: clip.durationMs,
      candidateAuthoredEndMs: sourceAuthoredEndMs,
    };
  }

  return {
    ...base,
    kind: "clip-start",
    candidateStartMs: clip.startMs,
  };
}

export function createAnimationTimelineClipStartEditSession(
  slide: Slide,
  request: BeginAnimationTimelineClipStartEditRequest,
): AnimationTimelineClipStartEditSession | null {
  const session = createAnimationTimelineTimingEditSession(slide, {
    ...request,
    kind: "clip-start",
  });

  return session?.kind === "clip-start" ? session : null;
}

function normalizeToPrecision(value: number) {
  return Math.max(
    0,
    Math.round(value / ANIMATION_TIMELINE_TIMING_PRECISION_MS) *
      ANIMATION_TIMELINE_TIMING_PRECISION_MS,
  );
}

function getTimingSnap(
  rawTimeMs: number,
  pixelsPerMs: number,
  rulerGridStepMs: number,
  playheadTimeMs: number,
  minimumTimeMs = 0,
  maximumTimeMs = Number.POSITIVE_INFINITY,
) {
  const gridStepMs =
    Number.isFinite(rulerGridStepMs) && rulerGridStepMs > 0
      ? rulerGridStepMs
      : ANIMATION_TIMELINE_TIMING_PRECISION_MS;
  const snappedPlayheadMs = Number.isFinite(playheadTimeMs)
    ? normalizeToPrecision(playheadTimeMs)
    : undefined;
  const nearestRulerGridMs = Math.max(
    0,
    Math.round(rawTimeMs / gridStepMs) * gridStepMs,
  );
  const candidates: AnimationTimelineTimingSnap[] = [
    { kind: "zero", timeMs: 0 },
    ...(snappedPlayheadMs === undefined
      ? []
      : [{ kind: "playhead" as const, timeMs: snappedPlayheadMs }]),
    ...(nearestRulerGridMs === 0
      ? []
      : [{ kind: "ruler-grid" as const, timeMs: nearestRulerGridMs }]),
  ];

  return candidates
    .filter(
      (candidate) =>
        candidate.timeMs >= minimumTimeMs &&
        candidate.timeMs <= maximumTimeMs,
    )
    .map((candidate, priority) => ({
      ...candidate,
      priority,
      distancePixels: Math.abs(rawTimeMs - candidate.timeMs) * pixelsPerMs,
    }))
    .filter(
      (candidate) =>
        candidate.distancePixels <=
        ANIMATION_TIMELINE_TIMING_SNAP_THRESHOLD_PX,
    )
    .sort(
      (left, right) =>
        left.distancePixels - right.distancePixels ||
        left.priority - right.priority,
    )[0];
}

/** Convert body motion through the Timeline's existing pixels-per-ms scale. */
export function getAnimationTimelineClipStartCandidate({
  sourceStartMs,
  deltaPixels,
  pixelsPerMs,
  rulerGridStepMs,
  playheadTimeMs,
}: GetAnimationTimelineClipStartCandidateRequest): AnimationTimelineClipStartCandidate {
  if (
    !Number.isFinite(sourceStartMs) ||
    !Number.isFinite(deltaPixels) ||
    !Number.isFinite(pixelsPerMs) ||
    pixelsPerMs <= 0
  ) {
    return { startMs: sourceStartMs };
  }

  const rawStartMs = Math.max(0, sourceStartMs + deltaPixels / pixelsPerMs);

  if (Math.abs(rawStartMs - sourceStartMs) < 0.000001) {
    return { startMs: sourceStartMs };
  }

  const snap = getTimingSnap(
    rawStartMs,
    pixelsPerMs,
    rulerGridStepMs,
    playheadTimeMs,
  );

  if (snap) {
    return {
      startMs: Math.max(0, Math.round(snap.timeMs)),
      snap: { kind: snap.kind, timeMs: Math.max(0, Math.round(snap.timeMs)) },
    };
  }

  return { startMs: normalizeToPrecision(rawStartMs) };
}

/**
 * Resize geometry follows the authored right edge, never the bar's 12px visual
 * minimum. Normal candidates use 10ms precision; the lower boundary remains
 * exactly sourceStart + 1ms so the document minimum stays reachable.
 */
export function getAnimationTimelineClipDurationCandidate({
  sourceStartMs,
  sourceDurationMs,
  deltaPixels,
  pixelsPerMs,
  rulerGridStepMs,
  playheadTimeMs,
}: GetAnimationTimelineClipDurationCandidateRequest): AnimationTimelineClipDurationCandidate {
  const sourceAuthoredEndMs = sourceStartMs + sourceDurationMs;

  if (
    !Number.isFinite(sourceStartMs) ||
    !Number.isFinite(sourceDurationMs) ||
    sourceDurationMs < ANIMATION_TIMELINE_MINIMUM_CLIP_DURATION_MS ||
    !Number.isFinite(deltaPixels) ||
    !Number.isFinite(pixelsPerMs) ||
    pixelsPerMs <= 0
  ) {
    return {
      durationMs: sourceDurationMs,
      authoredEndMs: sourceAuthoredEndMs,
    };
  }

  const minimumEndMs = sourceStartMs + ANIMATION_TIMELINE_MINIMUM_CLIP_DURATION_MS;
  const rawAuthoredEndMs = sourceAuthoredEndMs + deltaPixels / pixelsPerMs;

  if (Math.abs(rawAuthoredEndMs - sourceAuthoredEndMs) < 0.000001) {
    return {
      durationMs: sourceDurationMs,
      authoredEndMs: sourceAuthoredEndMs,
    };
  }

  if (rawAuthoredEndMs <= minimumEndMs) {
    return {
      durationMs: ANIMATION_TIMELINE_MINIMUM_CLIP_DURATION_MS,
      authoredEndMs: minimumEndMs,
    };
  }

  const snap = getTimingSnap(
    rawAuthoredEndMs,
    pixelsPerMs,
    rulerGridStepMs,
    playheadTimeMs,
    minimumEndMs,
  );
  const candidateAuthoredEndMs = snap
    ? Math.max(minimumEndMs, Math.round(snap.timeMs))
    : Math.max(minimumEndMs, normalizeToPrecision(rawAuthoredEndMs));
  const candidateDurationMs = Math.max(
    ANIMATION_TIMELINE_MINIMUM_CLIP_DURATION_MS,
    Math.round(candidateAuthoredEndMs - sourceStartMs),
  );

  return {
    durationMs: candidateDurationMs,
    authoredEndMs: sourceStartMs + candidateDurationMs,
    snap: snap
      ? { kind: snap.kind, timeMs: sourceStartMs + candidateDurationMs }
      : undefined,
  };
}

/**
 * Keyframe gestures operate in Sequence-local milliseconds for pointer and
 * snap feedback, then map back to the selected Clip's normalized offset.
 * Neighbor bounds remain authoritative over the visual 10ms precision.
 */
export function getAnimationTimelineKeyframeOffsetCandidate({
  sourceStartMs,
  sourceDurationMs,
  sourceOffset,
  minimumOffset,
  maximumOffset,
  deltaPixels,
  pixelsPerMs,
  rulerGridStepMs,
  playheadTimeMs,
}: GetAnimationTimelineKeyframeOffsetCandidateRequest): AnimationTimelineKeyframeOffsetCandidate {
  const sourceLocalTimeMs = sourceStartMs + sourceDurationMs * sourceOffset;
  const validRequest =
    Number.isFinite(sourceStartMs) &&
    Number.isFinite(sourceDurationMs) &&
    sourceDurationMs > 0 &&
    Number.isFinite(sourceOffset) &&
    Number.isFinite(minimumOffset) &&
    Number.isFinite(maximumOffset) &&
    minimumOffset <= maximumOffset &&
    Number.isFinite(deltaPixels) &&
    Number.isFinite(pixelsPerMs) &&
    pixelsPerMs > 0;

  if (!validRequest) {
    return { offset: sourceOffset, localTimeMs: sourceLocalTimeMs };
  }

  if (Math.abs(deltaPixels) < 0.000001) {
    return { offset: sourceOffset, localTimeMs: sourceLocalTimeMs };
  }

  const minimumLocalTimeMs = sourceStartMs + sourceDurationMs * minimumOffset;
  const maximumLocalTimeMs = sourceStartMs + sourceDurationMs * maximumOffset;
  const rawLocalTimeMs = sourceLocalTimeMs + deltaPixels / pixelsPerMs;
  const snap = getTimingSnap(
    rawLocalTimeMs,
    pixelsPerMs,
    rulerGridStepMs,
    playheadTimeMs,
    minimumLocalTimeMs,
    maximumLocalTimeMs,
  );
  const timelineCandidateMs = snap
    ? snap.timeMs
    : normalizeToPrecision(rawLocalTimeMs);
  const rawOffset = (timelineCandidateMs - sourceStartMs) / sourceDurationMs;
  const boundedOffset = Math.min(
    maximumOffset,
    Math.max(minimumOffset, rawOffset),
  );
  const normalizedOffset = normalizeAnimationKeyframeOffset(boundedOffset);
  const candidateOffset =
    normalizedOffset === undefined
      ? sourceOffset
      : Math.min(maximumOffset, Math.max(minimumOffset, normalizedOffset));
  const candidateLocalTimeMs =
    sourceStartMs + sourceDurationMs * candidateOffset;
  const snapStillApplies =
    snap && Math.abs(candidateLocalTimeMs - snap.timeMs) < 0.000001;

  return {
    offset: candidateOffset,
    localTimeMs: candidateLocalTimeMs,
    snap: snapStillApplies
      ? { kind: snap.kind, timeMs: candidateLocalTimeMs }
      : undefined,
  };
}

/**
 * Snap only the pointer-down anchor, then normalize and clamp one shared delta
 * before projecting it to every selected Keyframe.
 */
export function getAnimationTimelineKeyframeGroupOffsetCandidate({
  sourceStartMs,
  sourceDurationMs,
  sourceAnchorOffset,
  minimumDeltaOffset,
  maximumDeltaOffset,
  deltaPixels,
  pixelsPerMs,
  rulerGridStepMs,
  playheadTimeMs,
}: GetAnimationTimelineKeyframeGroupOffsetCandidateRequest): AnimationTimelineKeyframeGroupOffsetCandidate {
  const sourceAnchorLocalTimeMs =
    sourceStartMs + sourceDurationMs * sourceAnchorOffset;
  const validRequest =
    Number.isFinite(sourceStartMs) &&
    Number.isFinite(sourceDurationMs) &&
    sourceDurationMs > 0 &&
    Number.isFinite(sourceAnchorOffset) &&
    Number.isFinite(minimumDeltaOffset) &&
    Number.isFinite(maximumDeltaOffset) &&
    minimumDeltaOffset <= maximumDeltaOffset &&
    Number.isFinite(deltaPixels) &&
    Number.isFinite(pixelsPerMs) &&
    pixelsPerMs > 0;

  if (!validRequest || Math.abs(deltaPixels) < 0.000001) {
    return {
      deltaOffset: 0,
      anchorLocalTimeMs: sourceAnchorLocalTimeMs,
    };
  }

  const minimumAnchorLocalTimeMs =
    sourceAnchorLocalTimeMs + sourceDurationMs * minimumDeltaOffset;
  const maximumAnchorLocalTimeMs =
    sourceAnchorLocalTimeMs + sourceDurationMs * maximumDeltaOffset;
  const rawAnchorLocalTimeMs =
    sourceAnchorLocalTimeMs + deltaPixels / pixelsPerMs;
  const snap = getTimingSnap(
    rawAnchorLocalTimeMs,
    pixelsPerMs,
    rulerGridStepMs,
    playheadTimeMs,
    minimumAnchorLocalTimeMs,
    maximumAnchorLocalTimeMs,
  );
  const timelineCandidateMs = snap
    ? snap.timeMs
    : normalizeToPrecision(rawAnchorLocalTimeMs);
  const rawDeltaOffset =
    (timelineCandidateMs - sourceAnchorLocalTimeMs) / sourceDurationMs;
  const boundedDeltaOffset = Math.min(
    maximumDeltaOffset,
    Math.max(minimumDeltaOffset, rawDeltaOffset),
  );
  const normalizedDeltaOffset = normalizeAnimationKeyframeOffsetDelta(
    boundedDeltaOffset,
  );
  const candidateDeltaOffset =
    normalizedDeltaOffset === undefined
      ? 0
      : Math.min(
          maximumDeltaOffset,
          Math.max(minimumDeltaOffset, normalizedDeltaOffset),
        );
  const candidateAnchorLocalTimeMs =
    sourceAnchorLocalTimeMs + sourceDurationMs * candidateDeltaOffset;
  const snapStillApplies =
    snap && Math.abs(candidateAnchorLocalTimeMs - snap.timeMs) < 0.000001;

  return {
    deltaOffset: candidateDeltaOffset,
    anchorLocalTimeMs: candidateAnchorLocalTimeMs,
    snap: snapStillApplies
      ? { kind: snap.kind, timeMs: candidateAnchorLocalTimeMs }
      : undefined,
  };
}

export function updateAnimationTimelineClipStartEditSession(
  session: AnimationTimelineClipStartEditSession,
  candidate: AnimationTimelineClipStartCandidate,
) {
  if (!Number.isFinite(candidate.startMs)) {
    return session;
  }

  return {
    ...session,
    candidateStartMs: Math.max(0, Math.round(candidate.startMs)),
    dragging: true,
    snap: candidate.snap,
  };
}

export function updateAnimationTimelineClipDurationEditSession(
  session: AnimationTimelineClipDurationEditSession,
  candidate: AnimationTimelineClipDurationCandidate,
) {
  if (
    !Number.isFinite(candidate.durationMs) ||
    !Number.isFinite(candidate.authoredEndMs) ||
    candidate.durationMs < ANIMATION_TIMELINE_MINIMUM_CLIP_DURATION_MS
  ) {
    return session;
  }

  const candidateDurationMs = Math.max(
    ANIMATION_TIMELINE_MINIMUM_CLIP_DURATION_MS,
    Math.round(candidate.durationMs),
  );

  return {
    ...session,
    candidateDurationMs,
    candidateAuthoredEndMs: session.sourceStartMs + candidateDurationMs,
    dragging: true,
    snap: candidate.snap,
  };
}

export function updateAnimationTimelineKeyframeOffsetEditSession(
  session: AnimationTimelineKeyframeOffsetEditSession,
  candidate: AnimationTimelineKeyframeOffsetCandidate,
) {
  if (
    !Number.isFinite(candidate.offset) ||
    !Number.isFinite(candidate.localTimeMs) ||
    candidate.offset < session.minimumOffset ||
    candidate.offset > session.maximumOffset
  ) {
    return session;
  }

  return {
    ...session,
    candidateOffset: candidate.offset,
    candidateLocalTimeMs: candidate.localTimeMs,
    dragging: true,
    snap: candidate.snap,
  };
}

export function updateAnimationTimelineKeyframeGroupOffsetEditSession(
  session: AnimationTimelineKeyframeGroupOffsetEditSession,
  candidate: AnimationTimelineKeyframeGroupOffsetCandidate,
) {
  if (
    !Number.isFinite(candidate.deltaOffset) ||
    !Number.isFinite(candidate.anchorLocalTimeMs) ||
    candidate.deltaOffset < session.minimumDeltaOffset ||
    candidate.deltaOffset > session.maximumDeltaOffset
  ) {
    return session;
  }

  return {
    ...session,
    candidateDeltaOffset: candidate.deltaOffset,
    candidateAnchorLocalTimeMs: candidate.anchorLocalTimeMs,
    dragging: true,
    snap: candidate.snap,
  };
}

export function getAnimationTimelineTimingDragSession(
  session: AnimationTimelineTimingEditSession,
  request: {
    deltaPixels: number;
    pixelsPerMs: number;
    rulerGridStepMs: number;
    playheadTimeMs: number;
  },
): AnimationTimelineTimingEditSession {
  if (session.kind === "keyframe-group-offset") {
    return updateAnimationTimelineKeyframeGroupOffsetEditSession(
      session,
      getAnimationTimelineKeyframeGroupOffsetCandidate({
        ...request,
        sourceStartMs: session.sourceStartMs,
        sourceDurationMs: session.sourceDurationMs,
        sourceAnchorOffset: session.sourceAnchorOffset,
        minimumDeltaOffset: session.minimumDeltaOffset,
        maximumDeltaOffset: session.maximumDeltaOffset,
      }),
    );
  }

  if (session.kind === "keyframe-offset") {
    return updateAnimationTimelineKeyframeOffsetEditSession(
      session,
      getAnimationTimelineKeyframeOffsetCandidate({
        ...request,
        sourceStartMs: session.sourceStartMs,
        sourceDurationMs: session.sourceDurationMs,
        sourceOffset: session.sourceOffset,
        minimumOffset: session.minimumOffset,
        maximumOffset: session.maximumOffset,
      }),
    );
  }

  if (session.kind === "clip-duration") {
    return updateAnimationTimelineClipDurationEditSession(
      session,
      getAnimationTimelineClipDurationCandidate({
        ...request,
        sourceStartMs: session.sourceStartMs,
        sourceDurationMs: session.sourceDurationMs,
      }),
    );
  }

  return updateAnimationTimelineClipStartEditSession(
    session,
    getAnimationTimelineClipStartCandidate({
      ...request,
      sourceStartMs: session.sourceStartMs,
    }),
  );
}

export function getAnimationTimelineClipStartDragSession(
  session: AnimationTimelineClipStartEditSession,
  request: Omit<GetAnimationTimelineClipStartCandidateRequest, "sourceStartMs">,
) {
  return updateAnimationTimelineClipStartEditSession(
    session,
    getAnimationTimelineClipStartCandidate({
      ...request,
      sourceStartMs: session.sourceStartMs,
    }),
  );
}

export function animationTimelineTimingSessionsMatch(
  left: AnimationTimelineTimingEditSession,
  right: AnimationTimelineTimingEditSession,
) {
  const baseMatches =
    left.kind === right.kind &&
    left.slideId === right.slideId &&
    left.sequenceId === right.sequenceId &&
    left.clipId === right.clipId &&
    left.pointerId === right.pointerId &&
    left.sourceSlide === right.sourceSlide &&
    left.sourceSceneRevision === right.sourceSceneRevision &&
    Object.is(left.sourceStartMs, right.sourceStartMs) &&
    Object.is(left.sourceDurationMs, right.sourceDurationMs);

  if (!baseMatches) {
    return false;
  }

  if (
    left.kind === "keyframe-group-offset" &&
    right.kind === "keyframe-group-offset"
  ) {
    return (
      left.anchorTrackId === right.anchorTrackId &&
      left.anchorKeyframeId === right.anchorKeyframeId &&
      Object.is(left.sourceAnchorOffset, right.sourceAnchorOffset) &&
      Object.is(left.minimumDeltaOffset, right.minimumDeltaOffset) &&
      Object.is(left.maximumDeltaOffset, right.maximumDeltaOffset) &&
      left.keyframes.length === right.keyframes.length &&
      left.keyframes.every(
        (keyframe, index) =>
          keyframe.trackId === right.keyframes[index].trackId &&
          keyframe.keyframeId === right.keyframes[index].keyframeId &&
          Object.is(keyframe.offset, right.keyframes[index].offset),
      )
    );
  }

  if (left.kind === "keyframe-offset" && right.kind === "keyframe-offset") {
    return (
      left.trackId === right.trackId &&
      left.keyframeId === right.keyframeId &&
      Object.is(left.sourceOffset, right.sourceOffset) &&
      Object.is(left.minimumOffset, right.minimumOffset) &&
      Object.is(left.maximumOffset, right.maximumOffset)
    );
  }

  return true;
}

function sessionStillMatchesSlide(
  slide: Slide,
  session: AnimationTimelineTimingEditSession,
) {
  const clip = getDirectEditableClip(slide, session.sequenceId, session.clipId);

  if (
    slide.id !== session.slideId ||
    slide !== session.sourceSlide ||
    slide.animationScene.revision !== session.sourceSceneRevision ||
    !clip ||
    !Object.is(clip.startMs, session.sourceStartMs) ||
    !Object.is(clip.durationMs, session.sourceDurationMs)
  ) {
    return false;
  }

  if (session.kind === "keyframe-group-offset") {
    const target = getDirectEditableKeyframeGroup(
      slide,
      session.sequenceId,
      session.clipId,
      session.anchorTrackId,
      session.anchorKeyframeId,
      session.keyframes,
    );

    return (
      target !== undefined &&
      Object.is(target.anchor.offset, session.sourceAnchorOffset) &&
      Object.is(
        target.bounds.minimumDeltaOffset,
        session.minimumDeltaOffset,
      ) &&
      Object.is(
        target.bounds.maximumDeltaOffset,
        session.maximumDeltaOffset,
      ) &&
      target.bounds.keyframes.length === session.keyframes.length &&
      target.bounds.keyframes.every(
        (keyframe, index) =>
          keyframe.trackId === session.keyframes[index].trackId &&
          keyframe.keyframeId === session.keyframes[index].keyframeId &&
          Object.is(keyframe.offset, session.keyframes[index].offset),
      )
    );
  }

  if (session.kind === "keyframe-offset") {
    const target = getDirectEditableKeyframe(
      slide,
      session.sequenceId,
      session.clipId,
      session.trackId,
      session.keyframeId,
    );

    return (
      target !== undefined &&
      Object.is(target.keyframe.offset, session.sourceOffset) &&
      Object.is(target.bounds.minimumOffset, session.minimumOffset) &&
      Object.is(target.bounds.maximumOffset, session.maximumOffset)
    );
  }

  return (
    session.kind !== "clip-duration" ||
    canDirectEditAnimationTimelineClipDuration(
      slide,
      session.sequenceId,
      session.clipId,
    )
  );
}

export function isAnimationTimelineTimingEditSessionCurrent(
  slide: Slide,
  session: AnimationTimelineTimingEditSession,
) {
  return sessionStillMatchesSlide(slide, session);
}

export function isAnimationTimelineClipStartEditSessionCurrent(
  slide: Slide,
  session: AnimationTimelineClipStartEditSession,
) {
  return isAnimationTimelineTimingEditSessionCurrent(slide, session);
}

export function applyAnimationTimelineTimingDraftToSlide(
  slide: Slide,
  session: AnimationTimelineTimingEditSession | null,
): Slide {
  if (!session || !session.dragging || !sessionStillMatchesSlide(slide, session)) {
    return slide;
  }

  const scene = slide.animationScene;
  const clip = scene.clips[session.clipId];

  if (session.kind === "keyframe-group-offset") {
    if (
      !Number.isFinite(session.candidateDeltaOffset) ||
      session.candidateDeltaOffset < session.minimumDeltaOffset ||
      session.candidateDeltaOffset > session.maximumDeltaOffset ||
      Object.is(session.candidateDeltaOffset, 0)
    ) {
      return slide;
    }

    const selectedByTrackId = new Map<string, Map<string, number>>();

    for (const keyframe of session.keyframes) {
      const selectedOffsets = selectedByTrackId.get(keyframe.trackId);

      if (selectedOffsets) {
        selectedOffsets.set(keyframe.keyframeId, keyframe.offset);
      } else {
        selectedByTrackId.set(
          keyframe.trackId,
          new Map([[keyframe.keyframeId, keyframe.offset]]),
        );
      }
    }

    const nextTracks = clip.tracks.map((track) => {
      const selectedOffsets = selectedByTrackId.get(track.id);

      if (!selectedOffsets) {
        return track;
      }

      return {
        ...track,
        keyframes: track.keyframes.map((keyframe) => {
          const sourceOffset = selectedOffsets.get(keyframe.id);

          return sourceOffset === undefined
            ? keyframe
            : {
                ...keyframe,
                offset: sourceOffset + session.candidateDeltaOffset,
              };
        }),
      };
    });

    // Draft Track arrays stay in authored order; only affected Tracks and
    // selected Keyframes are cloned until the atomic command performs sorting.
    return {
      ...slide,
      animationScene: {
        ...scene,
        clips: {
          ...scene.clips,
          [clip.id]: { ...clip, tracks: nextTracks },
        },
      },
    };
  }

  if (session.kind === "keyframe-offset") {
    if (
      !Number.isFinite(session.candidateOffset) ||
      session.candidateOffset < session.minimumOffset ||
      session.candidateOffset > session.maximumOffset ||
      Object.is(session.candidateOffset, session.sourceOffset)
    ) {
      return slide;
    }

    const trackIndex = clip.tracks.findIndex(
      (track) => track.id === session.trackId,
    );

    if (trackIndex < 0) {
      return slide;
    }

    const track = clip.tracks[trackIndex];
    const keyframeIndex = track.keyframes.findIndex(
      (keyframe) => keyframe.id === session.keyframeId,
    );

    if (keyframeIndex < 0) {
      return slide;
    }

    const nextKeyframes = [...track.keyframes];
    nextKeyframes[keyframeIndex] = {
      ...nextKeyframes[keyframeIndex],
      offset: session.candidateOffset,
    };
    const nextTracks = [...clip.tracks];
    nextTracks[trackIndex] = { ...track, keyframes: nextKeyframes };

    // Draft ordering stays authored; compiler/View Model already sort by ID +
    // offset, so no unrelated identity or historical duplicate is rewritten.
    return {
      ...slide,
      animationScene: {
        ...scene,
        clips: {
          ...scene.clips,
          [clip.id]: { ...clip, tracks: nextTracks },
        },
      },
    };
  }

  const timingUpdate =
    session.kind === "clip-duration"
      ? { durationMs: session.candidateDurationMs }
      : { startMs: session.candidateStartMs };

  if (
    (session.kind === "clip-duration" &&
      (!Number.isFinite(session.candidateDurationMs) ||
        session.candidateDurationMs < ANIMATION_TIMELINE_MINIMUM_CLIP_DURATION_MS ||
        Object.is(session.candidateDurationMs, session.sourceDurationMs))) ||
    (session.kind === "clip-start" &&
      (!Number.isFinite(session.candidateStartMs) ||
        Object.is(session.candidateStartMs, session.sourceStartMs)))
  ) {
    return slide;
  }

  return {
    ...slide,
    animationScene: {
      ...scene,
      clips: {
        ...scene.clips,
        [clip.id]: { ...clip, ...timingUpdate },
      },
    },
  };
}

/** Revalidate context and delegate the one authored document mutation. */
export function commitAnimationTimelineTimingEditInSlide(
  slide: Slide,
  session: AnimationTimelineTimingEditSession,
): Slide {
  if (!session.dragging || !sessionStillMatchesSlide(slide, session)) {
    return slide;
  }

  if (session.kind === "keyframe-group-offset") {
    if (
      !Number.isFinite(session.candidateDeltaOffset) ||
      session.candidateDeltaOffset < session.minimumDeltaOffset ||
      session.candidateDeltaOffset > session.maximumDeltaOffset ||
      Object.is(session.candidateDeltaOffset, 0)
    ) {
      return slide;
    }

    return updateAnimationKeyframeOffsetsInSlide(slide, {
      clipId: session.clipId,
      keyframes: session.keyframes,
      deltaOffset: session.candidateDeltaOffset,
    });
  }

  if (session.kind === "keyframe-offset") {
    if (
      !Number.isFinite(session.candidateOffset) ||
      session.candidateOffset < session.minimumOffset ||
      session.candidateOffset > session.maximumOffset ||
      Object.is(session.candidateOffset, session.sourceOffset)
    ) {
      return slide;
    }

    return updateAnimationKeyframeOffsetInSlide(slide, {
      clipId: session.clipId,
      trackId: session.trackId,
      keyframeId: session.keyframeId,
      offset: session.candidateOffset,
    });
  }

  if (session.kind === "clip-duration") {
    if (
      !Number.isFinite(session.candidateDurationMs) ||
      session.candidateDurationMs < ANIMATION_TIMELINE_MINIMUM_CLIP_DURATION_MS
    ) {
      return slide;
    }

    return updateAnimationClipTimingInSlide(slide, {
      clipId: session.clipId,
      updates: { durationMs: session.candidateDurationMs },
    });
  }

  if (!Number.isFinite(session.candidateStartMs) || session.candidateStartMs < 0) {
    return slide;
  }

  return updateAnimationClipTimingInSlide(slide, {
    clipId: session.clipId,
    updates: { startMs: session.candidateStartMs },
  });
}

export function commitAnimationTimelineClipStartEditInSlide(
  slide: Slide,
  session: AnimationTimelineClipStartEditSession,
): Slide {
  return commitAnimationTimelineTimingEditInSlide(slide, session);
}
