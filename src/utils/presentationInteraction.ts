export const PRESENTATION_INPUT_OWNER_ATTRIBUTE =
  "data-presentation-input-owner";

export type PresentationInteractionReason =
  | "static-visible"
  | "static-hidden"
  | "pending-opacity-visible"
  | "pending-opacity-hidden"
  | "active-opacity"
  | "completed-opacity-visible"
  | "completed-opacity-hidden";

type PresentationInteractionKeyframe = {
  offset?: number;
  opacity?: number;
};

type PresentationInteractionAnimation = {
  keyframes?: readonly PresentationInteractionKeyframe[];
  timing?: {
    delay?: number;
    duration?: number;
    fill?: string;
    iterations?: number;
    direction?: string;
  };
  playbackRate?: number;
};

type PresentationInteractionAnimationSample = {
  compiledAnimation?: PresentationInteractionAnimation;
  sequenceSample?: {
    localTimeMs?: number;
    phase?: string;
  };
  pendingBaseline?: boolean;
};

export type PresentationInteractionState = {
  ownsInput: boolean;
  reason: PresentationInteractionReason;
};

export const PRESENTATION_MEDIA_DEFINITELY_HIDDEN_REASONS = [
  "static-hidden",
  "pending-opacity-hidden",
  "completed-opacity-hidden",
] as const satisfies readonly PresentationInteractionReason[];

/**
 * Report only stable opacity authorities that make media definitely hidden.
 * Active animation frames and input ownership are intentionally excluded so
 * transient opacity values cannot pause playback mid-animation.
 */
export function isPresentationMediaDefinitelyHidden(
  state: PresentationInteractionState | undefined,
) {
  return PRESENTATION_MEDIA_DEFINITELY_HIDDEN_REASONS.some(
    (reason) => reason === state?.reason,
  );
}

type PresentationInteractionInput = {
  staticOpacity?: number;
  samples?: readonly PresentationInteractionAnimationSample[];
};

type OpacityFrame = {
  offset: number;
  opacity: number;
};

function normalizePositiveNumber(value: unknown, fallback: number) {
  const numericValue = Number(value);

  return Number.isFinite(numericValue) && numericValue > 0
    ? numericValue
    : fallback;
}

function getOpacityFrames(
  animation: PresentationInteractionAnimation,
): OpacityFrame[] {
  if (!Array.isArray(animation.keyframes)) {
    return [];
  }

  return animation.keyframes
    .flatMap((frame) => {
      if (
        typeof frame.opacity !== "number" ||
        !Number.isFinite(frame.opacity)
      ) {
        return [];
      }

      const rawOffset = Number(frame.offset);

      return [
        {
          offset: Number.isFinite(rawOffset)
            ? Math.min(1, Math.max(0, rawOffset))
            : 0,
          opacity: frame.opacity,
        },
      ];
    })
    .sort((left, right) => left.offset - right.offset);
}

function sampleOpacityAtProgress(frames: readonly OpacityFrame[], progress: number) {
  const normalizedProgress = Math.min(1, Math.max(0, progress));
  const firstFrame = frames[0];
  const lastFrame = frames[frames.length - 1];

  if (!firstFrame || !lastFrame) {
    return undefined;
  }

  if (normalizedProgress <= firstFrame.offset) {
    return firstFrame.opacity;
  }

  if (normalizedProgress >= lastFrame.offset) {
    return lastFrame.opacity;
  }

  for (let index = 1; index < frames.length; index += 1) {
    const rightFrame = frames[index];
    const leftFrame = frames[index - 1];

    if (!rightFrame || !leftFrame || normalizedProgress > rightFrame.offset) {
      continue;
    }

    const segmentLength = rightFrame.offset - leftFrame.offset;

    if (segmentLength <= 0) {
      return rightFrame.opacity;
    }

    const segmentProgress =
      (normalizedProgress - leftFrame.offset) / segmentLength;

    return (
      leftFrame.opacity +
      (rightFrame.opacity - leftFrame.opacity) * segmentProgress
    );
  }

  return lastFrame.opacity;
}

function getDirectedProgress(
  direction: string | undefined,
  iterationIndex: number,
  simpleProgress: number,
) {
  const reversed =
    direction === "reverse" ||
    (direction === "alternate" && iterationIndex % 2 === 1) ||
    (direction === "alternate-reverse" && iterationIndex % 2 === 0);

  return reversed ? 1 - simpleProgress : simpleProgress;
}

function getInitialDirectedProgress(direction: string | undefined) {
  return getDirectedProgress(direction, 0, 0);
}

function getCompletedDirectedProgress(
  direction: string | undefined,
  iterationsValue: unknown,
) {
  const iterations = normalizePositiveNumber(iterationsValue, 1);
  const completedWholeIterations = Math.floor(iterations);
  const fractionalIteration = iterations - completedWholeIterations;
  const hasFractionalIteration = fractionalIteration > 1e-8;
  const iterationIndex = hasFractionalIteration
    ? completedWholeIterations
    : Math.max(0, completedWholeIterations - 1);
  const simpleProgress = hasFractionalIteration ? fractionalIteration : 1;

  return getDirectedProgress(direction, iterationIndex, simpleProgress);
}

function ownsInputAtOpacity(opacity: number | undefined) {
  return opacity !== undefined && opacity > 0;
}

/**
 * Resolve media input ownership from the same ordered samples that already
 * drive deterministic Presentation rendering.
 *
 * Only opacity animations replace the current opacity authority. Transform-only
 * effects leave the latest opacity result intact, and an active opacity effect
 * owns input from its participation boundary without using a visibility
 * threshold. The DOM gate and media playback lifecycle intentionally stay out
 * of this pure rule.
 */
export function getPresentationInteractionState({
  staticOpacity,
  samples,
}: PresentationInteractionInput): PresentationInteractionState {
  const normalizedStaticOpacity =
    typeof staticOpacity === "number" && Number.isFinite(staticOpacity)
      ? staticOpacity
      : 1;
  let state: PresentationInteractionState = ownsInputAtOpacity(
    normalizedStaticOpacity,
  )
    ? {
        ownsInput: true,
        reason: "static-visible",
      }
    : {
        ownsInput: false,
        reason: "static-hidden",
      };
  let hasAuthoritativeOpacity = false;

  if (!Array.isArray(samples)) {
    return state;
  }

  for (const sample of samples) {
    const animation = sample?.compiledAnimation;

    if (!animation) {
      continue;
    }

    const opacityFrames = getOpacityFrames(animation);

    if (opacityFrames.length === 0) {
      continue;
    }

    const timing = animation.timing ?? {};

    if (sample.pendingBaseline) {
      if (hasAuthoritativeOpacity) {
        continue;
      }

      const opacity = sampleOpacityAtProgress(
        opacityFrames,
        getInitialDirectedProgress(timing.direction),
      );

      state = ownsInputAtOpacity(opacity)
        ? {
            ownsInput: true,
            reason: "pending-opacity-visible",
          }
        : {
            ownsInput: false,
            reason: "pending-opacity-hidden",
          };
      continue;
    }

    const phase = sample.sequenceSample?.phase;

    if (phase === "active") {
      const localTimeMs = Math.max(
        0,
        Number(sample.sequenceSample?.localTimeMs ?? 0),
      );
      const startTimeMs = Math.max(0, Number(timing.delay ?? 0));
      const durationMs = normalizePositiveNumber(timing.duration, 1);
      const iterations = normalizePositiveNumber(timing.iterations, 1);
      const playbackRate = normalizePositiveNumber(animation.playbackRate, 1);
      const sampledAnimationTimeMs =
        Math.max(0, localTimeMs - startTimeMs) * playbackRate;
      const reachedEnd =
        sampledAnimationTimeMs >= durationMs * iterations;

      if (!reachedEnd) {
        state = {
          ownsInput: true,
          reason: "active-opacity",
        };
        hasAuthoritativeOpacity = true;
        continue;
      }
    } else if (phase !== "completed") {
      continue;
    }

    const keepsFinalFrame =
      timing.fill === "forwards" ||
      timing.fill === "both" ||
      timing.fill === undefined;

    if (!keepsFinalFrame) {
      continue;
    }

    const completedOpacity = sampleOpacityAtProgress(
      opacityFrames,
      getCompletedDirectedProgress(timing.direction, timing.iterations),
    );

    state = ownsInputAtOpacity(completedOpacity)
      ? {
          ownsInput: true,
          reason: "completed-opacity-visible",
        }
      : {
          ownsInput: false,
          reason: "completed-opacity-hidden",
        };
    hasAuthoritativeOpacity = true;
  }

  return state;
}
