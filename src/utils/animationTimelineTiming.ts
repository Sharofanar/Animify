import type { AnimationClip, Slide } from "../types/presentation";
import { updateAnimationClipTimingInSlide } from "./animationCommands";
import { compileAnimationSequence } from "./animationCompiler";
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

export type AnimationTimelineTimingEditSession =
  | AnimationTimelineClipStartEditSession
  | AnimationTimelineClipDurationEditSession;

export type BeginAnimationTimelineTimingEditRequest = {
  kind: AnimationTimelineTimingEditSession["kind"];
  sequenceId: string;
  clipId: string;
  pointerId: number;
};

export type BeginAnimationTimelineClipStartEditRequest = Omit<
  BeginAnimationTimelineTimingEditRequest,
  "kind"
>;

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

export function createAnimationTimelineTimingEditSession(
  slide: Slide,
  request: BeginAnimationTimelineTimingEditRequest,
): AnimationTimelineTimingEditSession | null {
  const clip = getDirectEditableClip(slide, request.sequenceId, request.clipId);

  if (
    !clip ||
    (request.kind === "clip-duration" &&
      (!Number.isFinite(clip.durationMs) ||
        clip.durationMs < ANIMATION_TIMELINE_MINIMUM_CLIP_DURATION_MS ||
        !canDirectEditAnimationTimelineClipDuration(
          slide,
          request.sequenceId,
          request.clipId,
        )))
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
    .filter((candidate) => candidate.timeMs >= minimumTimeMs)
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

export function getAnimationTimelineTimingDragSession(
  session: AnimationTimelineTimingEditSession,
  request: {
    deltaPixels: number;
    pixelsPerMs: number;
    rulerGridStepMs: number;
    playheadTimeMs: number;
  },
): AnimationTimelineTimingEditSession {
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
  return (
    left.kind === right.kind &&
    left.slideId === right.slideId &&
    left.sequenceId === right.sequenceId &&
    left.clipId === right.clipId &&
    left.pointerId === right.pointerId &&
    left.sourceSlide === right.sourceSlide &&
    left.sourceSceneRevision === right.sourceSceneRevision &&
    Object.is(left.sourceStartMs, right.sourceStartMs) &&
    Object.is(left.sourceDurationMs, right.sourceDurationMs)
  );
}

function sessionStillMatchesSlide(
  slide: Slide,
  session: AnimationTimelineTimingEditSession,
) {
  const clip = getDirectEditableClip(slide, session.sequenceId, session.clipId);

  return (
    slide.id === session.slideId &&
    slide === session.sourceSlide &&
    slide.animationScene.revision === session.sourceSceneRevision &&
    clip !== undefined &&
    Object.is(clip.startMs, session.sourceStartMs) &&
    Object.is(clip.durationMs, session.sourceDurationMs) &&
    (session.kind !== "clip-duration" ||
      canDirectEditAnimationTimelineClipDuration(
        slide,
        session.sequenceId,
        session.clipId,
      ))
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

/** Revalidate context and delegate authored mutation, revision, and legacy mirror. */
export function commitAnimationTimelineTimingEditInSlide(
  slide: Slide,
  session: AnimationTimelineTimingEditSession,
): Slide {
  if (!session.dragging || !sessionStillMatchesSlide(slide, session)) {
    return slide;
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
