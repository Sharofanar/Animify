import type { Slide } from "../types/presentation";
import {
  getAnimationPageClickSteps,
  getAnimationPrimarySlideEnterSequence,
  getAnimationSequenceLocalDurationMs,
} from "./animationSequence";

export type PresentationSlidePlaybackPlan = {
  slideId: string;
  slideEnterSequenceId?: string;
  clickStepSequenceIds: string[];
  sequenceDurationMs: Record<string, number>;
};

export type PresentationPlaybackState = {
  slideId: string;
  completedSequenceIds: string[];
  activeSequenceId?: string;
  activeSequenceTimeMs: number;
  activeSequenceDurationMs: number;
};

export type PresentationSequenceSample = {
  sequenceId: string;
  localTimeMs: number;
  phase: "pending" | "completed" | "active";
};

export type PresentationAnimationTiming = {
  delay: number;
};

export type PresentationSampledAnimation<
  TAnimation extends {
    sequenceId: string;
    timing: PresentationAnimationTiming;
  },
> = {
  compiledAnimation: TAnimation;
  sequenceSample: PresentationSequenceSample;
  pendingBaseline: boolean;
};

export type PresentationPlaybackTransition = {
  state: PresentationPlaybackState;
  navigation: "none" | "next-slide" | "previous-slide";
};

/**
 * Resolve the V1 presentation order from the persisted Sequence order.
 *
 * A click trigger with a target belongs to the later object-trigger phase. The
 * page-level PPT controller intentionally consumes only targetless Click Steps.
 */
export function createPresentationSlidePlaybackPlan(
  slide: Pick<Slide, "id" | "animationScene">,
): PresentationSlidePlaybackPlan {
  const slideEnterSequence = getAnimationPrimarySlideEnterSequence(
    slide.animationScene,
  );
  const clickStepSequences = getAnimationPageClickSteps(slide.animationScene);
  const sequenceIds = [
    ...(slideEnterSequence ? [slideEnterSequence.id] : []),
    ...clickStepSequences.map((sequence) => sequence.id),
  ];

  return {
    slideId: slide.id,
    slideEnterSequenceId: slideEnterSequence?.id,
    clickStepSequenceIds: clickStepSequences.map((sequence) => sequence.id),
    sequenceDurationMs: Object.fromEntries(
      sequenceIds.map((sequenceId) => [
        sequenceId,
        getAnimationSequenceLocalDurationMs(
          slide.animationScene,
          sequenceId,
        ),
      ]),
    ),
  };
}

export function createPresentationPageStartState(
  plan: PresentationSlidePlaybackPlan,
): PresentationPlaybackState {
  return {
    slideId: plan.slideId,
    completedSequenceIds: [],
    activeSequenceTimeMs: 0,
    activeSequenceDurationMs: 0,
  };
}

/**
 * Enter a page either at its normal beginning or at its final settled state.
 *
 * Normal entry immediately starts slide-enter from that Sequence's local 0ms.
 * Backward page navigation uses the final state so it behaves like PowerPoint.
 */
export function enterPresentationSlide(
  plan: PresentationSlidePlaybackPlan,
  position: "start" | "end" = "start",
): PresentationPlaybackState {
  const initialState = createPresentationPageStartState(plan);

  if (position === "end") {
    return {
      ...initialState,
      completedSequenceIds: getPresentationSequenceOrder(plan),
    };
  }

  return plan.slideEnterSequenceId
    ? startPresentationSequence(
        initialState,
        plan.slideEnterSequenceId,
        plan,
      )
    : initialState;
}

/**
 * Advance exactly one logical Sequence. While a Sequence is playing, repeated
 * forward input is ignored instead of creating an overlapping playback run.
 */
export function advancePresentationPlayback(
  state: PresentationPlaybackState,
  plan: PresentationSlidePlaybackPlan,
): PresentationPlaybackTransition {
  if (state.slideId !== plan.slideId) {
    return {
      state: enterPresentationSlide(plan),
      navigation: "none",
    };
  }

  if (state.activeSequenceId) {
    return {
      state,
      navigation: "none",
    };
  }

  if (
    plan.slideEnterSequenceId &&
    !state.completedSequenceIds.includes(plan.slideEnterSequenceId)
  ) {
    return {
      state: startPresentationSequence(
        state,
        plan.slideEnterSequenceId,
        plan,
      ),
      navigation: "none",
    };
  }

  const nextClickStepId = plan.clickStepSequenceIds.find(
    (sequenceId) => !state.completedSequenceIds.includes(sequenceId),
  );

  if (nextClickStepId) {
    return {
      state: startPresentationSequence(state, nextClickStepId, plan),
      navigation: "none",
    };
  }

  return {
    state,
    navigation: "next-slide",
  };
}

/**
 * Cross exactly one forward presentation-state boundary.
 *
 * An active Sequence settles at its own local end and stops there. Only a later
 * forced gesture may start the next Step or navigate, preserving one boundary
 * per wheel gesture. Normal forward input remains locked during active playback.
 */
export function forceAdvancePresentationPlayback(
  state: PresentationPlaybackState,
  plan: PresentationSlidePlaybackPlan,
): PresentationPlaybackTransition {
  if (state.slideId !== plan.slideId || !state.activeSequenceId) {
    return advancePresentationPlayback(state, plan);
  }

  return {
    state: completeActivePresentationSequence(state),
    navigation: "none",
  };
}

/**
 * Retreat one visual step without depending on temporary DOM animation state.
 *
 * An active Sequence is cancelled first. Settled Click Steps are then removed
 * one at a time, followed by slide-enter, before page navigation is requested.
 */
export function retreatPresentationPlayback(
  state: PresentationPlaybackState,
  plan: PresentationSlidePlaybackPlan,
): PresentationPlaybackTransition {
  if (state.slideId !== plan.slideId) {
    return {
      state: enterPresentationSlide(plan),
      navigation: "none",
    };
  }

  if (state.activeSequenceId) {
    return {
      state: {
        ...state,
        activeSequenceId: undefined,
        activeSequenceTimeMs: 0,
        activeSequenceDurationMs: 0,
      },
      navigation: "none",
    };
  }

  const finalCompletedClickStepId = [...plan.clickStepSequenceIds]
    .reverse()
    .find((sequenceId) => state.completedSequenceIds.includes(sequenceId));

  if (finalCompletedClickStepId) {
    return {
      state: {
        ...state,
        completedSequenceIds: state.completedSequenceIds.filter(
          (sequenceId) => sequenceId !== finalCompletedClickStepId,
        ),
      },
      navigation: "none",
    };
  }

  if (
    plan.slideEnterSequenceId &&
    state.completedSequenceIds.includes(plan.slideEnterSequenceId)
  ) {
    return {
      state: {
        ...state,
        completedSequenceIds: state.completedSequenceIds.filter(
          (sequenceId) => sequenceId !== plan.slideEnterSequenceId,
        ),
      },
      navigation: "none",
    };
  }

  return {
    state,
    navigation: "previous-slide",
  };
}

export function completeActivePresentationSequence(
  state: PresentationPlaybackState,
): PresentationPlaybackState {
  const activeSequenceId = state.activeSequenceId;

  if (!activeSequenceId) {
    return state;
  }

  return {
    ...state,
    completedSequenceIds: state.completedSequenceIds.includes(activeSequenceId)
      ? state.completedSequenceIds
      : [...state.completedSequenceIds, activeSequenceId],
    activeSequenceId: undefined,
    activeSequenceTimeMs: 0,
    activeSequenceDurationMs: 0,
  };
}

/**
 * Convert runtime progress into independent Sequence-local Canvas samples.
 */
export function getPresentationSequenceSamples(
  state: PresentationPlaybackState | null,
  plan: PresentationSlidePlaybackPlan,
): PresentationSequenceSample[] {
  if (!state || state.slideId !== plan.slideId) {
    return [];
  }

  const samples: PresentationSequenceSample[] =
    state.completedSequenceIds.map((sequenceId) => ({
      sequenceId,
      localTimeMs: plan.sequenceDurationMs[sequenceId] ?? 0,
      phase: "completed",
    }));

  if (state.activeSequenceId) {
    samples.push({
      sequenceId: state.activeSequenceId,
      localTimeMs: state.activeSequenceTimeMs,
      phase: "active",
    });
  }

  /**
   * Pending Sequences establish the pre-animation visual state for elements that
   * have no earlier completed or active contribution. Canvas resolves that
   * target-level priority so a future Step can never cover settled history.
   */
  const pendingSequenceIds = [
    ...(plan.slideEnterSequenceId ? [plan.slideEnterSequenceId] : []),
    ...plan.clickStepSequenceIds,
  ].filter(
    (sequenceId) =>
      !state.completedSequenceIds.includes(sequenceId) &&
      state.activeSequenceId !== sequenceId,
  );

  pendingSequenceIds.forEach((sequenceId) => {
    samples.push({
      sequenceId,
      localTimeMs: 0,
      phase: "pending",
    });
  });

  return samples;
}

/**
 * Resolve the exact compiled animations that may control one rendered element.
 *
 * A Sequence becoming active does not make its delayed Clips participate.
 * Earlier completed or already-started active animations remain authoritative
 * until the Sequence-local clock reaches each animation's delay.
 *
 * If an element has no participating history, the earliest active-or-pending
 * Sequence may retain its earliest animation frame as a pending baseline. That
 * baseline prevents the element's design-final state from leaking, but it is
 * deliberately distinct from active Clip participation before startMs.
 */
export function getPresentationRenderableAnimationSamples<
  TAnimation extends {
    sequenceId: string;
    timing: PresentationAnimationTiming;
  },
>(
  samples: readonly PresentationSequenceSample[],
  elementAnimations: readonly TAnimation[],
): PresentationSampledAnimation<TAnimation>[] {
  const samplesBySequenceId = new Map(
    samples.map((sample) => [sample.sequenceId, sample]),
  );
  const participatingAnimations = elementAnimations.flatMap(
    (compiledAnimation) => {
      const sequenceSample = samplesBySequenceId.get(
        compiledAnimation.sequenceId,
      );
      const startTimeMs = Math.max(
        0,
        Number(compiledAnimation.timing.delay),
      );

      if (
        !sequenceSample ||
        sequenceSample.phase === "pending" ||
        sequenceSample.localTimeMs < startTimeMs
      ) {
        return [];
      }

      return [
        {
          compiledAnimation,
          sequenceSample,
          pendingBaseline: false,
        },
      ];
    },
  );

  if (participatingAnimations.length > 0) {
    return participatingAnimations;
  }

  const baselineSample = samples.find(
    (sample) =>
      (sample.phase === "active" || sample.phase === "pending") &&
      elementAnimations.some(
        (animation) => animation.sequenceId === sample.sequenceId,
      ),
  );

  if (!baselineSample) {
    return [];
  }

  const baselineAnimations = elementAnimations.filter(
    (animation) => animation.sequenceId === baselineSample.sequenceId,
  );
  const earliestStartMs = Math.min(
    ...baselineAnimations.map((animation) =>
      Math.max(0, Number(animation.timing.delay)),
    ),
  );

  return baselineAnimations
    .filter(
      (animation) =>
        Math.max(0, Number(animation.timing.delay)) === earliestStartMs,
    )
    .map((compiledAnimation) => ({
      compiledAnimation,
      sequenceSample: baselineSample,
      pendingBaseline: true,
    }));
}

function startPresentationSequence(
  state: PresentationPlaybackState,
  sequenceId: string,
  plan: PresentationSlidePlaybackPlan,
) {
  const durationMs = Math.max(0, plan.sequenceDurationMs[sequenceId] ?? 0);
  const playingState: PresentationPlaybackState = {
    ...state,
    activeSequenceId: sequenceId,
    activeSequenceTimeMs: 0,
    activeSequenceDurationMs: durationMs,
  };

  return durationMs > 0
    ? playingState
    : completeActivePresentationSequence(playingState);
}

function getPresentationSequenceOrder(plan: PresentationSlidePlaybackPlan) {
  return [
    ...(plan.slideEnterSequenceId ? [plan.slideEnterSequenceId] : []),
    ...plan.clickStepSequenceIds,
  ];
}
