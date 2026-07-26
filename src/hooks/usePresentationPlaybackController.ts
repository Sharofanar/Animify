import { useCallback, useEffect, useRef, useState } from "react";
import {
  advancePresentationPlayback,
  completeActivePresentationSequence,
  enterPresentationSlide,
  forceAdvancePresentationPlayback,
  retreatPresentationPlayback,
  type PresentationPlaybackState,
  type PresentationSlidePlaybackPlan,
} from "../utils/presentationPlayback";

/**
 * Runtime-only PPT presentation controller.
 *
 * It owns one requestAnimationFrame loop for the active Sequence. Editor
 * Timeline playback and isolated Clip preview remain separate modes and never
 * run concurrently with this controller.
 */
export function usePresentationPlaybackController() {
  const [state, setState] = useState<PresentationPlaybackState | null>(null);
  const stateRef = useRef<PresentationPlaybackState | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const commitState = useCallback(
    (nextState: PresentationPlaybackState | null) => {
      stateRef.current = nextState;
      setState(nextState);
    },
    [],
  );

  const cancelAnimationFrame = useCallback(() => {
    if (animationFrameRef.current === null) {
      return;
    }

    window.cancelAnimationFrame(animationFrameRef.current);
    animationFrameRef.current = null;
  }, []);

  const enterSlide = useCallback(
    (
      plan: PresentationSlidePlaybackPlan,
      position: "start" | "end" = "start",
    ) => {
      cancelAnimationFrame();
      commitState(enterPresentationSlide(plan, position));
    },
    [cancelAnimationFrame, commitState],
  );

  const advance = useCallback(
    (plan: PresentationSlidePlaybackPlan) => {
      const storedState = stateRef.current;
      const stateMatchesSlide = storedState?.slideId === plan.slideId;
      const currentState =
        stateMatchesSlide && storedState
          ? storedState
          : enterPresentationSlide(plan);
      const transition = advancePresentationPlayback(currentState, plan);

      if (!stateMatchesSlide || transition.state !== currentState) {
        commitState(transition.state);
      }

      return transition.navigation;
    },
    [commitState],
  );

  const forceAdvance = useCallback(
    (plan: PresentationSlidePlaybackPlan) => {
      const storedState = stateRef.current;
      const stateMatchesSlide = storedState?.slideId === plan.slideId;
      const currentState =
        stateMatchesSlide && storedState
          ? storedState
          : enterPresentationSlide(plan);
      const transition = forceAdvancePresentationPlayback(currentState, plan);

      cancelAnimationFrame();

      if (!stateMatchesSlide || transition.state !== currentState) {
        commitState(transition.state);
      }

      return transition.navigation;
    },
    [cancelAnimationFrame, commitState],
  );

  const retreat = useCallback(
    (plan: PresentationSlidePlaybackPlan) => {
      const storedState = stateRef.current;
      const stateMatchesSlide = storedState?.slideId === plan.slideId;
      const currentState =
        stateMatchesSlide && storedState
          ? storedState
          : enterPresentationSlide(plan);
      const transition = retreatPresentationPlayback(currentState, plan);

      if (!stateMatchesSlide || transition.state !== currentState) {
        cancelAnimationFrame();
        commitState(transition.state);
      }

      return transition.navigation;
    },
    [cancelAnimationFrame, commitState],
  );

  const reset = useCallback(() => {
    cancelAnimationFrame();
    commitState(null);
  }, [cancelAnimationFrame, commitState]);

  useEffect(() => {
    const activeSequenceId = state?.activeSequenceId;
    const activeDurationMs = state?.activeSequenceDurationMs ?? 0;
    const slideId = state?.slideId;

    if (!slideId || !activeSequenceId || activeDurationMs <= 0) {
      return;
    }

    const startLocalTimeMs = stateRef.current?.activeSequenceTimeMs ?? 0;
    const wallClockStartMs = performance.now();
    let disposed = false;

    function updateFrame(now: number) {
      if (disposed) {
        return;
      }

      const currentState = stateRef.current;

      if (
        !currentState ||
        currentState.slideId !== slideId ||
        currentState.activeSequenceId !== activeSequenceId
      ) {
        return;
      }

      const nextLocalTimeMs = Math.min(
        activeDurationMs,
        startLocalTimeMs + (now - wallClockStartMs),
      );

      if (nextLocalTimeMs >= activeDurationMs) {
        animationFrameRef.current = null;
        commitState(completeActivePresentationSequence(currentState));
        return;
      }

      commitState({
        ...currentState,
        activeSequenceTimeMs: nextLocalTimeMs,
      });
      animationFrameRef.current = window.requestAnimationFrame(updateFrame);
    }

    animationFrameRef.current = window.requestAnimationFrame(updateFrame);

    return () => {
      disposed = true;
      cancelAnimationFrame();
    };
  }, [
    cancelAnimationFrame,
    commitState,
    state?.activeSequenceDurationMs,
    state?.activeSequenceId,
    state?.slideId,
  ]);

  return {
    state,
    enterSlide,
    advance,
    forceAdvance,
    retreat,
    reset,
  };
}
