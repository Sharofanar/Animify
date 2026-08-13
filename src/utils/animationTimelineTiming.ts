import type { Slide } from "../types/presentation";
import { updateAnimationClipTimingInSlide } from "./animationCommands";
import { getAnimationTimelineViewModel } from "./animationTimeline";

export const ANIMATION_TIMELINE_CLIP_START_DRAG_THRESHOLD_PX = 3;
export const ANIMATION_TIMELINE_TIMING_SNAP_THRESHOLD_PX = 6;
export const ANIMATION_TIMELINE_TIMING_PRECISION_MS = 10;

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

export type AnimationTimelineClipStartEditSession = {
  kind: "clip-start";
  slideId: string;
  sequenceId: string;
  clipId: string;
  pointerId: number;
  sourceSlide: Slide;
  sourceSceneRevision: number;
  sourceStartMs: number;
  candidateStartMs: number;
  dragging: boolean;
  snap?: AnimationTimelineTimingSnap;
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

function getDirectEditableClip(
  slide: Slide,
  sequenceId: string,
  clipId: string,
) {
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

/**
 * Timeline direct timing is intentionally narrower than the generic Inspector
 * command surface. Protected or malformed historical state stays inspect-only.
 */
export function canDirectEditAnimationTimelineClipStart(
  slide: Slide,
  sequenceId: string,
  clipId: string,
) {
  return getDirectEditableClip(slide, sequenceId, clipId) !== undefined;
}

export function createAnimationTimelineClipStartEditSession(
  slide: Slide,
  request: BeginAnimationTimelineClipStartEditRequest,
): AnimationTimelineClipStartEditSession | null {
  const clip = getDirectEditableClip(
    slide,
    request.sequenceId,
    request.clipId,
  );

  if (!clip) {
    return null;
  }

  return {
    kind: "clip-start",
    slideId: slide.id,
    sequenceId: request.sequenceId,
    clipId: request.clipId,
    pointerId: request.pointerId,
    sourceSlide: slide,
    sourceSceneRevision: slide.animationScene.revision,
    sourceStartMs: clip.startMs,
    candidateStartMs: clip.startMs,
    dragging: false,
  };
}

function normalizeToPrecision(value: number) {
  return Math.max(
    0,
    Math.round(value / ANIMATION_TIMELINE_TIMING_PRECISION_MS) *
      ANIMATION_TIMELINE_TIMING_PRECISION_MS,
  );
}

/**
 * Convert horizontal motion through the Timeline's existing pixels-per-ms
 * scale. Snap tolerance is measured in CSS pixels so zoom does not change the
 * perceived attraction distance.
 */
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

  // Returning to the exact pointer origin must preserve an authored non-grid
  // value so a round trip remains a true no-op.
  if (Math.abs(rawStartMs - sourceStartMs) < 0.000001) {
    return { startMs: sourceStartMs };
  }

  const gridStepMs =
    Number.isFinite(rulerGridStepMs) && rulerGridStepMs > 0
      ? rulerGridStepMs
      : ANIMATION_TIMELINE_TIMING_PRECISION_MS;
  const snappedPlayheadMs = Number.isFinite(playheadTimeMs)
    ? normalizeToPrecision(playheadTimeMs)
    : undefined;
  const nearestRulerGridMs = Math.max(
    0,
    Math.round(rawStartMs / gridStepMs) * gridStepMs,
  );
  const snapCandidates: AnimationTimelineTimingSnap[] = [
    { kind: "zero", timeMs: 0 },
    ...(snappedPlayheadMs === undefined
      ? []
      : [{ kind: "playhead" as const, timeMs: snappedPlayheadMs }]),
    ...(nearestRulerGridMs === 0
      ? []
      : [{ kind: "ruler-grid" as const, timeMs: nearestRulerGridMs }]),
  ];
  const snap = snapCandidates
    .map((candidate, priority) => ({
      ...candidate,
      priority,
      distancePixels: Math.abs(rawStartMs - candidate.timeMs) * pixelsPerMs,
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

  if (snap) {
    return {
      startMs: Math.max(0, Math.round(snap.timeMs)),
      snap: {
        kind: snap.kind,
        timeMs: Math.max(0, Math.round(snap.timeMs)),
      },
    };
  }

  return { startMs: normalizeToPrecision(rawStartMs) };
}

export function updateAnimationTimelineClipStartEditSession(
  session: AnimationTimelineClipStartEditSession,
  candidate: AnimationTimelineClipStartCandidate,
) {
  if (!Number.isFinite(candidate.startMs)) {
    return session;
  }

  const candidateStartMs = Math.max(0, Math.round(candidate.startMs));

  return {
    ...session,
    candidateStartMs,
    dragging: true,
    snap: candidate.snap,
  };
}

export function getAnimationTimelineClipStartDragSession(
  session: AnimationTimelineClipStartEditSession,
  request: Omit<
    GetAnimationTimelineClipStartCandidateRequest,
    "sourceStartMs"
  >,
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
  left: AnimationTimelineClipStartEditSession,
  right: AnimationTimelineClipStartEditSession,
) {
  return (
    left.kind === right.kind &&
    left.slideId === right.slideId &&
    left.sequenceId === right.sequenceId &&
    left.clipId === right.clipId &&
    left.pointerId === right.pointerId &&
    left.sourceSlide === right.sourceSlide &&
    left.sourceSceneRevision === right.sourceSceneRevision &&
    Object.is(left.sourceStartMs, right.sourceStartMs)
  );
}

function sessionStillMatchesSlide(
  slide: Slide,
  session: AnimationTimelineClipStartEditSession,
) {
  const clip = getDirectEditableClip(
    slide,
    session.sequenceId,
    session.clipId,
  );

  return (
    slide.id === session.slideId &&
    slide === session.sourceSlide &&
    slide.animationScene.revision === session.sourceSceneRevision &&
    clip !== undefined &&
    Object.is(clip.startMs, session.sourceStartMs)
  );
}

export function isAnimationTimelineClipStartEditSessionCurrent(
  slide: Slide,
  session: AnimationTimelineClipStartEditSession,
) {
  return sessionStillMatchesSlide(slide, session);
}

/**
 * Project one candidate into an editor-only Slide. Revision, metadata, legacy
 * mirrors, ownership, and every unrelated authored object stay untouched.
 */
export function applyAnimationTimelineTimingDraftToSlide(
  slide: Slide,
  session: AnimationTimelineClipStartEditSession | null,
): Slide {
  if (
    !session ||
    !session.dragging ||
    !Number.isFinite(session.candidateStartMs) ||
    !sessionStillMatchesSlide(slide, session) ||
    Object.is(session.candidateStartMs, session.sourceStartMs)
  ) {
    return slide;
  }

  const scene = slide.animationScene;
  const clip = scene.clips[session.clipId];

  return {
    ...slide,
    animationScene: {
      ...scene,
      clips: {
        ...scene.clips,
        [clip.id]: {
          ...clip,
          startMs: session.candidateStartMs,
        },
      },
    },
  };
}

/**
 * Revalidate the direct-edit boundary against the latest committed Slide, then
 * delegate revision and safe legacy-delay mirroring to the existing command.
 */
export function commitAnimationTimelineClipStartEditInSlide(
  slide: Slide,
  session: AnimationTimelineClipStartEditSession,
): Slide {
  if (
    !session.dragging ||
    !Number.isFinite(session.candidateStartMs) ||
    session.candidateStartMs < 0 ||
    !sessionStillMatchesSlide(slide, session)
  ) {
    return slide;
  }

  return updateAnimationClipTimingInSlide(slide, {
    clipId: session.clipId,
    updates: {
      startMs: session.candidateStartMs,
    },
  });
}
