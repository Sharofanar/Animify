import { useCallback, useEffect, useRef, useState } from "react";
import type { TimelinePlaybackStatus } from "../types/editor";
import {
  normalizeAnimationTimelinePlaybackLoopRange,
  wrapAnimationTimelineRegionTime,
  type AnimationTimelinePlaybackLoopRange,
} from "../utils/animationTimelineRegion";

export type { TimelinePlaybackStatus } from "../types/editor";

type TimelinePlaybackSnapshot = {
  contextKey: string;
  currentTimeMs: number;
  status: TimelinePlaybackStatus;
  rangeStartTimeMs?: number;
  rangeEndTimeMs?: number;
  rangeReturnTimeMs?: number;
};

type TimelinePlaybackAnchor = {
  wallClockMs: number;
  timelineTimeMs: number;
};

type UseTimelinePlaybackControllerOptions = {
  contextKey: string;
  durationMs: number;
  loopRange?: AnimationTimelinePlaybackLoopRange | null;
  onRangeComplete?: () => void;
};

function clampTime(value: number, durationMs: number) {
  const safeValue = Number.isFinite(value) ? value : 0;
  const safeDurationMs = Number.isFinite(durationMs)
    ? Math.max(0, durationMs)
    : 0;

  return Math.min(Math.max(0, safeValue), safeDurationMs);
}

/**
 * Shared editor Timeline playback clock.
 *
 * This controller owns time navigation only. Rendering remains inside
 * SlideCanvas, which samples the compiled animation state at currentTimeMs.
 */
export function useTimelinePlaybackController({
  contextKey,
  durationMs,
  loopRange,
  onRangeComplete,
}: UseTimelinePlaybackControllerOptions) {
  const safeDurationMs = Number.isFinite(durationMs)
    ? Math.max(0, durationMs)
    : 0;

  const [snapshot, setSnapshot] = useState<TimelinePlaybackSnapshot>({
    contextKey: "",
    currentTimeMs: 0,
    status: "idle",
  });

  const animationFrameRef = useRef<number | null>(null);

  const playbackAnchorRef = useRef<TimelinePlaybackAnchor | null>(null);

  const previousLoopRangeKeyRef = useRef<string | null>(null);

  const normalizedLoopRange = normalizeAnimationTimelinePlaybackLoopRange(
    loopRange,
    safeDurationMs,
  );

  const snapshotHasPlaybackRange =
    snapshot.rangeStartTimeMs !== undefined &&
    snapshot.rangeEndTimeMs !== undefined;

  /**
   * React permits guarded state adjustment during render when a prop defines a
   * new state identity. This makes the new 0/idle snapshot visible before child
   * rendering and avoids a second effect-driven render with stale context data.
   */
  if (snapshot.contextKey !== contextKey) {
    setSnapshot({
      contextKey,
      currentTimeMs: 0,
      status: "idle",
    });
  } else if (
    !snapshotHasPlaybackRange &&
    (snapshot.currentTimeMs > safeDurationMs ||
      (snapshot.status === "playing" && safeDurationMs <= 0))
  ) {
    setSnapshot({
      ...snapshot,
      currentTimeMs: clampTime(snapshot.currentTimeMs, safeDurationMs),
      status: snapshot.status === "playing" ? "idle" : snapshot.status,
    });
  }

  const snapshotBelongsToContext = snapshot.contextKey === contextKey;

  const playbackRangeStartTimeMs = snapshotBelongsToContext
    ? snapshot.rangeStartTimeMs
    : undefined;

  const playbackRangeEndTimeMs = snapshotBelongsToContext
    ? snapshot.rangeEndTimeMs
    : undefined;

  const playbackRangeReturnTimeMs = snapshotBelongsToContext
    ? snapshot.rangeReturnTimeMs
    : undefined;

  const hasPlaybackRange =
    playbackRangeStartTimeMs !== undefined &&
    playbackRangeEndTimeMs !== undefined &&
    playbackRangeEndTimeMs > playbackRangeStartTimeMs;

  /** Isolated Clip preview owns its one-shot range while it is active. */
  const activeLoopRange = hasPlaybackRange ? null : normalizedLoopRange;
  const hasLoopRange = activeLoopRange !== null;
  const activeLoopRangeKey = hasPlaybackRange
    ? null
    : activeLoopRange
      ? `${activeLoopRange.startTimeMs}:${activeLoopRange.endTimeMs}`
      : "";

  const currentTimelineLimitMs = Math.max(
    safeDurationMs,
    hasPlaybackRange ? playbackRangeEndTimeMs : 0,
  );

  const currentTimeMs = snapshotBelongsToContext
    ? clampTime(snapshot.currentTimeMs, currentTimelineLimitMs)
    : 0;

  const status: TimelinePlaybackStatus = snapshotBelongsToContext
    ? snapshot.status
    : "idle";

  const cancelAnimationFrame = useCallback(() => {
    if (animationFrameRef.current === null) {
      return;
    }

    window.cancelAnimationFrame(animationFrameRef.current);

    animationFrameRef.current = null;
  }, []);

  /**
   * A playback context is one Slide + Active Sequence identity supplied by App.
   * The controller treats it as opaque and mechanically resets every transient
   * clock field whenever it changes.
   */
  useEffect(() => {
    cancelAnimationFrame();
    playbackAnchorRef.current = null;
  }, [cancelAnimationFrame, contextKey]);

  /**
   * Seek immediately.
   *
   * Loop-constrained seeking pauses so users may inspect outside the range.
   * Otherwise seeking while playing keeps the existing playback state.
   */
  const seek = useCallback(
    (timeMs: number) => {
      if (safeDurationMs <= 0) {
        cancelAnimationFrame();
        playbackAnchorRef.current = null;
        setSnapshot({
          contextKey,
          currentTimeMs: 0,
          status: "idle",
        });
        return;
      }

      const nextTimeMs = clampTime(timeMs, safeDurationMs);

      playbackAnchorRef.current = {
        wallClockMs: performance.now(),
        timelineTimeMs: nextTimeMs,
      };

      setSnapshot((currentSnapshot) => {
        const currentStatus = hasLoopRange
          ? "paused"
          : currentSnapshot.contextKey === contextKey &&
              currentSnapshot.status === "playing"
            ? "playing"
            : "paused";

        return {
          contextKey,
          currentTimeMs: nextTimeMs,
          status: currentStatus,
        };
      });
    },
    [cancelAnimationFrame, contextKey, hasLoopRange, safeDurationMs],
  );

  /**
   * Continue playback from the current Playhead.
   *
   * Starting again from the end automatically restarts from zero.
   */
  const play = useCallback(() => {
    const playbackStartTimeMs = hasPlaybackRange
      ? playbackRangeStartTimeMs
      : hasLoopRange
        ? (activeLoopRange?.startTimeMs ?? 0)
        : 0;

    const playbackEndTimeMs = hasPlaybackRange
      ? playbackRangeEndTimeMs
      : hasLoopRange
        ? (activeLoopRange?.endTimeMs ?? safeDurationMs)
        : safeDurationMs;

    if (playbackEndTimeMs <= playbackStartTimeMs) {
      return;
    }

    const startTimeMs =
      currentTimeMs < playbackStartTimeMs ||
      currentTimeMs >= playbackEndTimeMs
        ? playbackStartTimeMs
        : currentTimeMs;

    cancelAnimationFrame();

    playbackAnchorRef.current = {
      wallClockMs: performance.now(),
      timelineTimeMs: startTimeMs,
    };

    setSnapshot({
      contextKey,
      currentTimeMs: startTimeMs,
      status: "playing",
      ...(hasPlaybackRange
        ? {
            rangeStartTimeMs: playbackRangeStartTimeMs,
            rangeEndTimeMs: playbackRangeEndTimeMs,
            rangeReturnTimeMs: playbackRangeReturnTimeMs,
          }
        : {}),
    });
  }, [
    cancelAnimationFrame,
    currentTimeMs,
    hasPlaybackRange,
    hasLoopRange,
    activeLoopRange,
    playbackRangeEndTimeMs,
    playbackRangeReturnTimeMs,
    playbackRangeStartTimeMs,
    safeDurationMs,
    contextKey,
  ]);

  /**
   * Freeze playback at the currently rendered frame.
   */
  const pause = useCallback(() => {
    cancelAnimationFrame();

    playbackAnchorRef.current = null;

    setSnapshot({
      contextKey,
      currentTimeMs,
      status: "paused",
      ...(hasPlaybackRange
        ? {
            rangeStartTimeMs: playbackRangeStartTimeMs,
            rangeEndTimeMs: playbackRangeEndTimeMs,
            rangeReturnTimeMs: playbackRangeReturnTimeMs,
          }
        : {}),
    });
  }, [
    cancelAnimationFrame,
    currentTimeMs,
    hasPlaybackRange,
    playbackRangeEndTimeMs,
    playbackRangeReturnTimeMs,
    playbackRangeStartTimeMs,
    contextKey,
  ]);

  /**
   * Stop playback and return to the beginning.
   */
  const stop = useCallback(() => {
    cancelAnimationFrame();

    playbackAnchorRef.current = null;

    setSnapshot({
      contextKey,
      currentTimeMs: 0,
      status: "idle",
    });
  }, [cancelAnimationFrame, contextKey]);

  /** Replay starts at the active normal-playback boundary, otherwise zero. */
  const replay = useCallback(() => {
    if (safeDurationMs <= 0) {
      stop();
      return;
    }

    cancelAnimationFrame();

    const replayStartTimeMs = normalizedLoopRange?.startTimeMs ?? 0;

    playbackAnchorRef.current = {
      wallClockMs: performance.now(),
      timelineTimeMs: replayStartTimeMs,
    };

    setSnapshot({
      contextKey,
      currentTimeMs: replayStartTimeMs,
      status: "playing",
    });
  }, [
    cancelAnimationFrame,
    contextKey,
    normalizedLoopRange,
    safeDurationMs,
    stop,
  ]);

  /**
   * Start one isolated Clip preview on the shared context-local Timeline.
   *
   * Repeated preview requests replace the previous range and animation frame,
   * so rapid clicks can never create overlapping playback loops.
   */
  const playRange = useCallback(
    (startTimeMs: number, endTimeMs: number, returnTimeMs = currentTimeMs) => {
      const safeStartTimeMs = Number.isFinite(startTimeMs)
        ? Math.max(0, startTimeMs)
        : 0;

      const safeEndTimeMs = Number.isFinite(endTimeMs)
        ? Math.max(safeStartTimeMs, endTimeMs)
        : safeStartTimeMs;

      if (safeEndTimeMs <= safeStartTimeMs) {
        return;
      }

      cancelAnimationFrame();

      playbackAnchorRef.current = {
        wallClockMs: performance.now(),
        timelineTimeMs: safeStartTimeMs,
      };

      setSnapshot({
        contextKey,
        currentTimeMs: safeStartTimeMs,
        status: "playing",
        rangeStartTimeMs: safeStartTimeMs,
        rangeEndTimeMs: safeEndTimeMs,
        rangeReturnTimeMs: clampTime(returnTimeMs, safeDurationMs),
      });
    },
    [cancelAnimationFrame, contextKey, currentTimeMs, safeDurationMs],
  );

  /**
   * Leave Clip-preview mode and restore the Active Sequence local position.
   */
  const clearPlaybackRange = useCallback(
    (timeMs: number) => {
      cancelAnimationFrame();

      playbackAnchorRef.current = null;

      const nextTimeMs = clampTime(timeMs, safeDurationMs);

      setSnapshot({
        contextKey,
        currentTimeMs: nextTimeMs,
        status: nextTimeMs > 0 ? "paused" : "idle",
      });
    },
    [cancelAnimationFrame, contextKey, safeDurationMs],
  );

  /**
   * Loop bounds are a playback constraint, not a new Slide/Sequence context.
   * Re-anchor a running clock when the constraint changes so removing a Region
   * cannot reveal accumulated, previously wrapped wall-clock time as a jump.
   */
  useEffect(() => {
    const previousLoopRangeKey = previousLoopRangeKeyRef.current;

    previousLoopRangeKeyRef.current = activeLoopRangeKey;

    if (
      previousLoopRangeKey === null ||
      previousLoopRangeKey === activeLoopRangeKey ||
      hasPlaybackRange ||
      status !== "playing"
    ) {
      return;
    }

    const nextTimeMs =
      activeLoopRange &&
      (currentTimeMs < activeLoopRange.startTimeMs ||
        currentTimeMs >= activeLoopRange.endTimeMs)
        ? activeLoopRange.startTimeMs
        : currentTimeMs;

    playbackAnchorRef.current = {
      wallClockMs: performance.now(),
      timelineTimeMs: nextTimeMs,
    };
  }, [
    activeLoopRange,
    activeLoopRangeKey,
    contextKey,
    currentTimeMs,
    hasPlaybackRange,
    status,
  ]);

  /**
   * Advance the single shared Timeline clock.
   *
   * SlideCanvas never owns another playback timer in controlled editor mode.
   */
  useEffect(() => {
    const playbackEndTimeMs = hasPlaybackRange
      ? playbackRangeEndTimeMs
      : activeLoopRange?.endTimeMs ?? safeDurationMs;

    if (status !== "playing" || playbackEndTimeMs <= 0) {
      return;
    }

    if (!playbackAnchorRef.current) {
      playbackAnchorRef.current = {
        wallClockMs: performance.now(),
        timelineTimeMs: currentTimeMs,
      };
    }

    let disposed = false;

    function updateFrame(now: number) {
      if (disposed) {
        return;
      }

      const anchor = playbackAnchorRef.current;

      if (!anchor) {
        return;
      }

      const candidateTimeMs =
        anchor.timelineTimeMs + (now - anchor.wallClockMs);

      if (activeLoopRange) {
        const nextTimeMs =
          candidateTimeMs < activeLoopRange.startTimeMs
            ? activeLoopRange.startTimeMs
            : candidateTimeMs >= activeLoopRange.endTimeMs
              ? wrapAnimationTimelineRegionTime(
                  candidateTimeMs,
                  activeLoopRange,
                )
              : candidateTimeMs;

        setSnapshot({
          contextKey,
          currentTimeMs: nextTimeMs,
          status: "playing",
        });

        animationFrameRef.current = window.requestAnimationFrame(updateFrame);
        return;
      }

      const nextTimeMs = clampTime(candidateTimeMs, playbackEndTimeMs);

      const reachedEnd = nextTimeMs >= playbackEndTimeMs;

      const completedRangeReturnTimeMs = hasPlaybackRange
        ? clampTime(playbackRangeReturnTimeMs ?? 0, safeDurationMs)
        : undefined;

      setSnapshot({
        contextKey,
        currentTimeMs:
          reachedEnd && completedRangeReturnTimeMs !== undefined
            ? completedRangeReturnTimeMs
            : nextTimeMs,
        status:
          reachedEnd && completedRangeReturnTimeMs !== undefined
            ? completedRangeReturnTimeMs > 0
              ? "paused"
              : "idle"
            : reachedEnd
              ? "paused"
              : "playing",
        ...(!reachedEnd && hasPlaybackRange
          ? {
              rangeStartTimeMs: playbackRangeStartTimeMs,
              rangeEndTimeMs: playbackRangeEndTimeMs,
              rangeReturnTimeMs: playbackRangeReturnTimeMs,
            }
          : {}),
      });

      if (reachedEnd) {
        playbackAnchorRef.current = null;

        animationFrameRef.current = null;

        if (completedRangeReturnTimeMs !== undefined) {
          onRangeComplete?.();
        }

        return;
      }

      animationFrameRef.current = window.requestAnimationFrame(updateFrame);
    }

    animationFrameRef.current = window.requestAnimationFrame(updateFrame);

    return () => {
      disposed = true;
      cancelAnimationFrame();
    };
  }, [
    activeLoopRange,
    cancelAnimationFrame,
    currentTimeMs,
    hasPlaybackRange,
    onRangeComplete,
    playbackRangeEndTimeMs,
    playbackRangeReturnTimeMs,
    playbackRangeStartTimeMs,
    safeDurationMs,
    contextKey,
    status,
  ]);

  return {
    currentTimeMs,
    status,
    durationMs: safeDurationMs,
    seek,
    play,
    pause,
    stop,
    replay,
    playRange,
    clearPlaybackRange,
  };
}
