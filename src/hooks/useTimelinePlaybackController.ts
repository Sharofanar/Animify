import { useCallback, useEffect, useRef, useState } from "react";

export type TimelinePlaybackStatus = "idle" | "playing" | "paused";

type TimelinePlaybackSnapshot = {
  slideId: string;
  currentTimeMs: number;
  status: TimelinePlaybackStatus;
  rangeStartTimeMs?: number;
  rangeEndTimeMs?: number;
};

type TimelinePlaybackAnchor = {
  wallClockMs: number;
  timelineTimeMs: number;
};

type UseTimelinePlaybackControllerOptions = {
  slideId: string;
  durationMs: number;
};

function clampTime(value: number, durationMs: number) {
  return Math.min(Math.max(0, value), Math.max(0, durationMs));
}

/**
 * Shared editor Timeline playback clock.
 *
 * This controller owns time navigation only. Rendering remains inside
 * SlideCanvas, which samples the compiled animation state at currentTimeMs.
 */
export function useTimelinePlaybackController({
  slideId,
  durationMs,
}: UseTimelinePlaybackControllerOptions) {
  const safeDurationMs = Math.max(0, durationMs);

  const [snapshot, setSnapshot] = useState<TimelinePlaybackSnapshot>({
    slideId: "",
    currentTimeMs: 0,
    status: "idle",
  });

  const animationFrameRef = useRef<number | null>(null);

  const playbackAnchorRef = useRef<TimelinePlaybackAnchor | null>(null);

  const snapshotBelongsToSlide = snapshot.slideId === slideId;

  const playbackRangeStartTimeMs = snapshotBelongsToSlide
    ? snapshot.rangeStartTimeMs
    : undefined;

  const playbackRangeEndTimeMs = snapshotBelongsToSlide
    ? snapshot.rangeEndTimeMs
    : undefined;

  const hasPlaybackRange =
    playbackRangeStartTimeMs !== undefined &&
    playbackRangeEndTimeMs !== undefined &&
    playbackRangeEndTimeMs > playbackRangeStartTimeMs;

  const currentTimelineLimitMs = Math.max(
    safeDurationMs,
    hasPlaybackRange ? playbackRangeEndTimeMs : 0,
  );

  const currentTimeMs = snapshotBelongsToSlide
    ? clampTime(snapshot.currentTimeMs, currentTimelineLimitMs)
    : 0;

  const status: TimelinePlaybackStatus = snapshotBelongsToSlide
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
   * Seek immediately.
   *
   * Seeking while playing keeps playback running from the new position.
   * Seeking while stopped enters a paused inspection state.
   */
  const seek = useCallback(
    (timeMs: number) => {
      const nextTimeMs = clampTime(timeMs, safeDurationMs);

      playbackAnchorRef.current = {
        wallClockMs: performance.now(),
        timelineTimeMs: nextTimeMs,
      };

      setSnapshot((currentSnapshot) => {
        const currentStatus =
          currentSnapshot.slideId === slideId &&
          currentSnapshot.status === "playing"
            ? "playing"
            : "paused";

        return {
          slideId,
          currentTimeMs: nextTimeMs,
          status: currentStatus,
        };
      });
    },
    [safeDurationMs, slideId],
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
      slideId,
      currentTimeMs: startTimeMs,
      status: "playing",
      ...(hasPlaybackRange
        ? {
            rangeStartTimeMs: playbackRangeStartTimeMs,
            rangeEndTimeMs: playbackRangeEndTimeMs,
          }
        : {}),
    });
  }, [
    cancelAnimationFrame,
    currentTimeMs,
    hasPlaybackRange,
    playbackRangeEndTimeMs,
    playbackRangeStartTimeMs,
    safeDurationMs,
    slideId,
  ]);

  /**
   * Freeze playback at the currently rendered frame.
   */
  const pause = useCallback(() => {
    cancelAnimationFrame();

    playbackAnchorRef.current = null;

    setSnapshot({
      slideId,
      currentTimeMs,
      status: "paused",
      ...(hasPlaybackRange
        ? {
            rangeStartTimeMs: playbackRangeStartTimeMs,
            rangeEndTimeMs: playbackRangeEndTimeMs,
          }
        : {}),
    });
  }, [
    cancelAnimationFrame,
    currentTimeMs,
    hasPlaybackRange,
    playbackRangeEndTimeMs,
    playbackRangeStartTimeMs,
    slideId,
  ]);

  /**
   * Stop playback and return to the beginning.
   */
  const stop = useCallback(() => {
    cancelAnimationFrame();

    playbackAnchorRef.current = null;

    setSnapshot({
      slideId,
      currentTimeMs: 0,
      status: "idle",
    });
  }, [cancelAnimationFrame, slideId]);

  /**
   * Explicit full-page replay always starts from zero.
   */
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
      slideId,
      currentTimeMs: 0,
      status: "playing",
    });
  }, [cancelAnimationFrame, safeDurationMs, slideId, stop]);

  /**
   * Start one isolated Clip preview on the shared absolute Timeline.
   *
   * Repeated preview requests replace the previous range and animation frame,
   * so rapid clicks can never create overlapping playback loops.
   */
  const playRange = useCallback(
    (startTimeMs: number, endTimeMs: number) => {
      const safeStartTimeMs = Math.max(0, startTimeMs);

      const safeEndTimeMs = Math.max(safeStartTimeMs, endTimeMs);

      if (safeEndTimeMs <= safeStartTimeMs) {
        return;
      }

      cancelAnimationFrame();

      playbackAnchorRef.current = {
        wallClockMs: performance.now(),
        timelineTimeMs: safeStartTimeMs,
      };

      setSnapshot({
        slideId,
        currentTimeMs: safeStartTimeMs,
        status: "playing",
        rangeStartTimeMs: safeStartTimeMs,
        rangeEndTimeMs: safeEndTimeMs,
      });
    },
    [cancelAnimationFrame, slideId],
  );

  /**
   * Leave Clip-preview mode and restore the full-page Timeline position.
   */
  const clearPlaybackRange = useCallback(
    (timeMs: number) => {
      cancelAnimationFrame();

      playbackAnchorRef.current = null;

      const nextTimeMs = clampTime(timeMs, safeDurationMs);

      setSnapshot({
        slideId,
        currentTimeMs: nextTimeMs,
        status: nextTimeMs > 0 ? "paused" : "idle",
      });
    },
    [cancelAnimationFrame, safeDurationMs, slideId],
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

      setSnapshot({
        slideId,
        currentTimeMs: nextTimeMs,
        status: reachedEnd ? "paused" : "playing",
        ...(hasPlaybackRange
          ? {
              rangeStartTimeMs: playbackRangeStartTimeMs,
              rangeEndTimeMs: playbackRangeEndTimeMs,
            }
          : {}),
      });

      if (reachedEnd) {
        playbackAnchorRef.current = null;

        animationFrameRef.current = null;

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
    playbackRangeEndTimeMs,
    playbackRangeStartTimeMs,
    safeDurationMs,
    slideId,
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
