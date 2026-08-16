export const ANIMATION_TIMELINE_REGION_PRECISION_MS = 10;

export type AnimationTimelineRegion = {
  slideId: string;
  sequenceId: string;
  startMs: number;
  endMs: number;
};

export type AnimationTimelinePlaybackLoopRange = {
  startTimeMs: number;
  endTimeMs: number;
};

type AnimationTimelineRegionContext = {
  slideId: string;
  sequenceId: string | null;
  durationMs: number;
};

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}

function getWholeDurationMs(durationMs: number) {
  return Number.isFinite(durationMs) ? Math.max(0, Math.floor(durationMs)) : 0;
}

function normalizePointerTimeMs(timeMs: number, durationMs: number) {
  const wholeDurationMs = getWholeDurationMs(durationMs);

  if (!Number.isFinite(timeMs) || wholeDurationMs < 1) {
    return null;
  }

  if (timeMs <= 0) {
    return 0;
  }

  if (timeMs >= wholeDurationMs) {
    return wholeDurationMs;
  }

  return clamp(
    Math.round(timeMs / ANIMATION_TIMELINE_REGION_PRECISION_MS) *
      ANIMATION_TIMELINE_REGION_PRECISION_MS,
    0,
    wholeDurationMs,
  );
}

/**
 * Normalize one editor-only Region without repairing reversed endpoints.
 * Creation owns direction normalization; persisted editor state must already
 * express the invariant startMs < endMs.
 */
export function normalizeAnimationTimelineRegion(
  region: AnimationTimelineRegion,
  durationMs: number,
): AnimationTimelineRegion | null {
  const wholeDurationMs = getWholeDurationMs(durationMs);

  if (
    !region.slideId ||
    !region.sequenceId ||
    !Number.isFinite(region.startMs) ||
    !Number.isFinite(region.endMs) ||
    wholeDurationMs < 1
  ) {
    return null;
  }

  const startMs = clamp(Math.round(region.startMs), 0, wholeDurationMs);
  const endMs = clamp(Math.round(region.endMs), 0, wholeDurationMs);

  if (startMs >= endMs) {
    return null;
  }

  return startMs === region.startMs && endMs === region.endMs
    ? region
    : { ...region, startMs, endMs };
}

/**
 * Reconcile transient Region ownership against the committed editor context.
 * Duration shrink clamps only the right endpoint; it never moves start left or
 * keeps an invalid hidden range for a later Undo to resurrect.
 */
export function reconcileAnimationTimelineRegion(
  region: AnimationTimelineRegion | null,
  context: AnimationTimelineRegionContext,
): AnimationTimelineRegion | null {
  if (
    !region ||
    !context.sequenceId ||
    region.slideId !== context.slideId ||
    region.sequenceId !== context.sequenceId
  ) {
    return null;
  }

  return normalizeAnimationTimelineRegion(region, context.durationMs);
}

/** Build a bidirectional, 10ms-precision Region creation candidate. */
export function getAnimationTimelineRegionCandidate({
  slideId,
  sequenceId,
  anchorTimeMs,
  pointerTimeMs,
  durationMs,
}: {
  slideId: string;
  sequenceId: string;
  anchorTimeMs: number;
  pointerTimeMs: number;
  durationMs: number;
}): AnimationTimelineRegion | null {
  const anchorMs = normalizePointerTimeMs(anchorTimeMs, durationMs);
  const pointerMs = normalizePointerTimeMs(pointerTimeMs, durationMs);

  if (anchorMs === null || pointerMs === null) {
    return null;
  }

  if (anchorMs === pointerMs && anchorTimeMs !== pointerTimeMs) {
    const wholeDurationMs = getWholeDurationMs(durationMs);
    const draggingForward = pointerTimeMs > anchorTimeMs;
    const startMs = draggingForward
      ? Math.min(anchorMs, wholeDurationMs - 1)
      : Math.max(0, anchorMs - 1);

    return normalizeAnimationTimelineRegion(
      {
        slideId,
        sequenceId,
        startMs,
        endMs: startMs + 1,
      },
      durationMs,
    );
  }

  return normalizeAnimationTimelineRegion(
    {
      slideId,
      sequenceId,
      startMs: Math.min(anchorMs, pointerMs),
      endMs: Math.max(anchorMs, pointerMs),
    },
    durationMs,
  );
}

/** Resize exactly one endpoint and clamp instead of swapping handles. */
export function getAnimationTimelineRegionHandleCandidate({
  region,
  handle,
  pointerTimeMs,
  durationMs,
}: {
  region: AnimationTimelineRegion;
  handle: "start" | "end";
  pointerTimeMs: number;
  durationMs: number;
}): AnimationTimelineRegion | null {
  const sourceRegion = normalizeAnimationTimelineRegion(region, durationMs);
  const candidateTimeMs = normalizePointerTimeMs(pointerTimeMs, durationMs);

  if (!sourceRegion || candidateTimeMs === null) {
    return null;
  }

  const nextRegion =
    handle === "start"
      ? {
          ...sourceRegion,
          startMs: clamp(candidateTimeMs, 0, sourceRegion.endMs - 1),
        }
      : {
          ...sourceRegion,
          endMs: clamp(
            candidateTimeMs,
            sourceRegion.startMs + 1,
            getWholeDurationMs(durationMs),
          ),
        };

  return normalizeAnimationTimelineRegion(nextRegion, durationMs);
}

export function getAnimationTimelinePlaybackLoopRange(
  region: AnimationTimelineRegion | null,
  context: AnimationTimelineRegionContext,
): AnimationTimelinePlaybackLoopRange | null {
  const reconciledRegion = reconcileAnimationTimelineRegion(region, context);

  return reconciledRegion
    ? {
        startTimeMs: reconciledRegion.startMs,
        endTimeMs: reconciledRegion.endMs,
      }
    : null;
}

export function normalizeAnimationTimelinePlaybackLoopRange(
  range: AnimationTimelinePlaybackLoopRange | null | undefined,
  durationMs: number,
): AnimationTimelinePlaybackLoopRange | null {
  const wholeDurationMs = getWholeDurationMs(durationMs);

  if (
    !range ||
    !Number.isFinite(range.startTimeMs) ||
    !Number.isFinite(range.endTimeMs) ||
    wholeDurationMs < 1
  ) {
    return null;
  }

  const startTimeMs = clamp(
    Math.round(range.startTimeMs),
    0,
    wholeDurationMs,
  );
  const endTimeMs = clamp(
    Math.round(range.endTimeMs),
    0,
    wholeDurationMs,
  );

  return startTimeMs < endTimeMs ? { startTimeMs, endTimeMs } : null;
}

/**
 * Wrap a Sequence-local candidate into [start, end) while preserving overshoot.
 */
export function wrapAnimationTimelineRegionTime(
  candidateTimeMs: number,
  range: AnimationTimelinePlaybackLoopRange,
) {
  const startTimeMs = Number.isFinite(range.startTimeMs)
    ? range.startTimeMs
    : 0;
  const endTimeMs = Number.isFinite(range.endTimeMs)
    ? range.endTimeMs
    : startTimeMs;
  const lengthMs = endTimeMs - startTimeMs;

  if (!Number.isFinite(candidateTimeMs) || lengthMs <= 0) {
    return startTimeMs;
  }

  const residueMs =
    (((candidateTimeMs - startTimeMs) % lengthMs) + lengthMs) % lengthMs;
  const floatingToleranceMs =
    Number.EPSILON *
    Math.max(
      1,
      Math.abs(candidateTimeMs),
      Math.abs(startTimeMs),
      Math.abs(endTimeMs),
    ) *
    16;
  const normalizedResidueMs =
    lengthMs - residueMs <= floatingToleranceMs ? 0 : residueMs;
  const wrappedTimeMs = startTimeMs + normalizedResidueMs;

  return wrappedTimeMs >= endTimeMs
    ? startTimeMs
    : Math.max(startTimeMs, wrappedTimeMs);
}
