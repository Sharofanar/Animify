import { useCallback, useEffect, useRef, useState } from "react";
import type { TimelinePlaybackStatus } from "../types/editor";

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
   * Seeking while playing keeps playback running from the new position.
   * Seeking while stopped enters a paused inspection state.
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
        const currentStatus =
          currentSnapshot.contextKey === contextKey &&
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
    [cancelAnimationFrame, contextKey, safeDurationMs],
  );

  /**
   * Continue playback from the current Playhead.
   *
   * Starting again from the end automatically restarts from zero.
   */
  const play = useCallback(() => {
    const playbackStartTimeMs = hasPlaybackRange
      ? playbackRangeStartTimeMs
      : 0;

    const playbackEndTimeMs = hasPlaybackRange
      ? playbackRangeEndTimeMs
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

  /** Explicit playback-context replay always starts from zero. */
  const replay = useCallback(() => {
    if (safeDurationMs <= 0) {
      stop();
      return;
    }

    cancelAnimationFrame();

    playbackAnchorRef.current = {
      wallClockMs: performance.now(),
      timelineTimeMs: 0,
    };

    setSnapshot({
      contextKey,
      currentTimeMs: 0,
      status: "playing",
    });
  }, [cancelAnimationFrame, contextKey, safeDurationMs, stop]);

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
   * Advance the single shared Timeline clock.
   *
   * SlideCanvas never owns another playback timer in controlled editor mode.
   */
  useEffect(() => {
    const playbackEndTimeMs = hasPlaybackRange
      ? playbackRangeEndTimeMs
      : safeDurationMs;

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

      const nextTimeMs = clampTime(
        anchor.timelineTimeMs + (now - anchor.wallClockMs),
        playbackEndTimeMs,
      );

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
