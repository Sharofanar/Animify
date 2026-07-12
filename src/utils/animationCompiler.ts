import type {
  AnimationClip,
  AnimationEasing,
  AnimationKeyframe,
  AnimationScene,
  AnimationTrack,
  AnimationValue,
} from "../types/presentation";

/**
 * One browser-ready animation frame compiled from multiple V2 property tracks.
 */
export type CompiledAnimationKeyframe = {
  offset: number;
  opacity?: number;
  transform?: string;
  easing?: string;
};

/**
 * One animation that can be played on one rendered slide element.
 */
export type CompiledElementAnimation = {
  id: string;
  sequenceId: string;
  clipId: string;
  elementId: string;
  keyframes: CompiledAnimationKeyframe[];
  timing: {
    delay: number;
    duration: number;
    fill: AnimationClip["fill"];
    iterations: number;
    direction: AnimationClip["direction"];
  };
  playbackRate: number;
};

export type AnimationCompilerDiagnostic = {
  level: "warning";
  sequenceId: string;
  clipId?: string;
  trackId?: string;
  message: string;
};

export type CompiledSlideAnimations = {
  revision: number;
  byElementId: Record<string, CompiledElementAnimation[]>;
  diagnostics: AnimationCompilerDiagnostic[];
};

type PreparedTrack = {
  track: AnimationTrack;
  keyframes: AnimationKeyframe[];
};

type TransformChannels = {
  x: number;
  y: number;
  z: number;
  scaleX: number;
  scaleY: number;
  rotateX: number;
  rotateY: number;
  rotateZ: number;
  skewX: number;
  skewY: number;
};

/**
 * Compile all slide-enter sequences into browser-ready element animations.
 *
 * The compiler is intentionally independent from React and the DOM. The editor,
 * presentation player, and exported HTML can therefore share the same compiler.
 */
export function compileSlideAnimations(
  scene?: AnimationScene,
): CompiledSlideAnimations {
  const compiled: CompiledSlideAnimations = {
    revision: scene?.revision ?? 0,
    byElementId: {},
    diagnostics: [],
  };

  if (!scene || scene.schemaVersion !== 2) {
    return compiled;
  }

  for (const sequenceId of scene.sequenceOrder) {
    const sequence = scene.sequences[sequenceId];

    if (!sequence) {
      compiled.diagnostics.push({
        level: "warning",
        sequenceId,
        message: `找不到动画序列：${sequenceId}`,
      });
      continue;
    }

    /**
     * Compiler V1 only automatically plays slide-enter sequences.
     * Click, hover, keyboard, and media triggers will be connected later.
     */
    if (sequence.trigger.type !== "slide-enter") {
      continue;
    }

    for (const clipId of sequence.clipIds) {
      const clip = scene.clips[clipId];

      if (!clip) {
        compiled.diagnostics.push({
          level: "warning",
          sequenceId,
          clipId,
          message: `找不到动画片段：${clipId}`,
        });
        continue;
      }

      if (!clip.enabled) {
        continue;
      }

      const keyframes = compileClipKeyframes(
        sequenceId,
        clip,
        compiled.diagnostics,
      );

      if (keyframes.length === 0) {
        continue;
      }

      clip.targets.forEach((target, targetIndex) => {
        /**
         * Character, word, line, and SVG-part targets require a later rendering
         * stage that can split one element into independent visual sub-targets.
         */
        if (target.subTarget) {
          compiled.diagnostics.push({
            level: "warning",
            sequenceId,
            clipId,
            message: `Compiler V1 暂不支持子目标：${target.elementId}`,
          });
          return;
        }

        const staggerDelay = getStaggerDelay(
          clip,
          targetIndex,
          clip.targets.length,
        );

        const sequenceRepeat = Math.max(1, sequence.playback.repeat || 1);

        const compiledAnimation: CompiledElementAnimation = {
          id: `${sequenceId}-${clipId}-${target.elementId}-${targetIndex}`,
          sequenceId,
          clipId,
          elementId: target.elementId,
          keyframes,
          timing: {
            delay: Math.max(0, clip.startMs + staggerDelay),
            duration: Math.max(1, clip.durationMs),
            fill: clip.fill,
            iterations: Math.max(1, clip.iterations * sequenceRepeat),
            direction:
              clip.direction === "normal"
                ? sequence.playback.direction
                : clip.direction,
          },
          playbackRate:
            sequence.playback.playbackRate > 0
              ? sequence.playback.playbackRate
              : 1,
        };

        const elementAnimations = compiled.byElementId[target.elementId] ?? [];

        elementAnimations.push(compiledAnimation);
        compiled.byElementId[target.elementId] = elementAnimations;
      });
    }
  }

  /**
   * Stable ordering ensures earlier clips start first and makes compiler output
   * predictable for preview, presentation, and export.
   */
  Object.values(compiled.byElementId).forEach((animations) => {
    animations.sort(
      (left, right) =>
        left.timing.delay - right.timing.delay ||
        left.clipId.localeCompare(right.clipId),
    );
  });

  return compiled;
}

/**
 * Merge separate opacity and transform tracks into complete keyframes.
 */
function compileClipKeyframes(
  sequenceId: string,
  clip: AnimationClip,
  diagnostics: AnimationCompilerDiagnostic[],
): CompiledAnimationKeyframe[] {
  const preparedTracks: PreparedTrack[] = [];

  for (const track of clip.tracks) {
    if (!track.enabled || track.keyframes.length === 0) {
      continue;
    }

    if (!isCompilerV1Property(track.property)) {
      diagnostics.push({
        level: "warning",
        sequenceId,
        clipId: clip.id,
        trackId: track.id,
        message: `Compiler V1 暂不支持属性：${track.property}`,
      });
      continue;
    }

    const containsNonNumber = track.keyframes.some(
      (keyframe) => typeof keyframe.value !== "number",
    );

    if (containsNonNumber) {
      diagnostics.push({
        level: "warning",
        sequenceId,
        clipId: clip.id,
        trackId: track.id,
        message: `Compiler V1 仅支持数值关键帧：${track.property}`,
      });
      continue;
    }

    preparedTracks.push({
      track,
      keyframes: [...track.keyframes].sort(
        (left, right) => left.offset - right.offset,
      ),
    });
  }

  if (preparedTracks.length === 0) {
    return [];
  }

  const offsets = new Set<number>([0, 1]);

  preparedTracks.forEach(({ keyframes }) => {
    keyframes.forEach((keyframe) => {
      offsets.add(clampOffset(keyframe.offset));
    });
  });

  return [...offsets]
    .sort((left, right) => left - right)
    .map((offset) => compileFrameAtOffset(preparedTracks, offset));
}

/**
 * Sample every active track at one normalized timeline offset.
 */
function compileFrameAtOffset(
  preparedTracks: PreparedTrack[],
  offset: number,
): CompiledAnimationKeyframe {
  const channels: TransformChannels = {
    x: 0,
    y: 0,
    z: 0,
    scaleX: 1,
    scaleY: 1,
    rotateX: 0,
    rotateY: 0,
    rotateZ: 0,
    skewX: 0,
    skewY: 0,
  };

  let opacity: number | undefined;
  let hasTransformTrack = false;
  let easing: string | undefined;

  for (const preparedTrack of preparedTracks) {
    const value = sampleNumericTrack(preparedTrack.keyframes, offset);

    if (value === undefined) {
      continue;
    }

    easing ??= getTrackEasingAtOffset(preparedTrack.keyframes, offset);

    switch (preparedTrack.track.property) {
      case "opacity":
        opacity = value;
        break;

      case "transform.x":
        channels.x = value;
        hasTransformTrack = true;
        break;

      case "transform.y":
        channels.y = value;
        hasTransformTrack = true;
        break;

      case "transform.z":
        channels.z = value;
        hasTransformTrack = true;
        break;

      case "transform.scaleX":
        channels.scaleX = value;
        hasTransformTrack = true;
        break;

      case "transform.scaleY":
        channels.scaleY = value;
        hasTransformTrack = true;
        break;

      case "transform.rotateX":
        channels.rotateX = value;
        hasTransformTrack = true;
        break;

      case "transform.rotateY":
        channels.rotateY = value;
        hasTransformTrack = true;
        break;

      case "transform.rotateZ":
        channels.rotateZ = value;
        hasTransformTrack = true;
        break;

      case "transform.skewX":
        channels.skewX = value;
        hasTransformTrack = true;
        break;

      case "transform.skewY":
        channels.skewY = value;
        hasTransformTrack = true;
        break;

      default:
        break;
    }
  }

  return {
    offset,
    opacity,
    transform: hasTransformTrack ? createTransformValue(channels) : undefined,
    easing,
  };
}

/**
 * Interpolate one numeric animation track at the requested offset.
 */
function sampleNumericTrack(
  keyframes: AnimationKeyframe[],
  offset: number,
): number | undefined {
  if (keyframes.length === 0) {
    return undefined;
  }

  const firstKeyframe = keyframes[0];
  const lastKeyframe = keyframes[keyframes.length - 1];

  if (offset <= firstKeyframe.offset) {
    return getNumericValue(firstKeyframe.value);
  }

  if (offset >= lastKeyframe.offset) {
    return getNumericValue(lastKeyframe.value);
  }

  for (let index = 0; index < keyframes.length - 1; index += 1) {
    const left = keyframes[index];
    const right = keyframes[index + 1];

    if (offset < left.offset || offset > right.offset) {
      continue;
    }

    const leftValue = getNumericValue(left.value);
    const rightValue = getNumericValue(right.value);

    if (leftValue === undefined || rightValue === undefined) {
      return undefined;
    }

    if (left.hold || right.offset === left.offset) {
      return leftValue;
    }

    const progress = (offset - left.offset) / (right.offset - left.offset);

    return leftValue + (rightValue - leftValue) * progress;
  }

  return undefined;
}

/**
 * Find the easing that controls the segment beginning at this offset.
 */
function getTrackEasingAtOffset(
  keyframes: AnimationKeyframe[],
  offset: number,
) {
  let selectedKeyframe = keyframes[0];

  for (const keyframe of keyframes) {
    if (keyframe.offset > offset) {
      break;
    }

    selectedKeyframe = keyframe;
  }

  return selectedKeyframe.easing
    ? easingToCss(selectedKeyframe.easing)
    : undefined;
}

function easingToCss(easing: AnimationEasing): string {
  switch (easing.type) {
    case "css":
      return easing.value;

    case "cubic-bezier":
      return `cubic-bezier(${easing.x1}, ${easing.y1}, ${easing.x2}, ${easing.y2})`;

    case "steps":
      return `steps(${Math.max(1, easing.count)}, ${easing.position})`;

    /**
     * Spring, bounce, and custom curves will later be sampled into additional
     * keyframes. Compiler V1 safely falls back to linear interpolation.
     */
    case "spring":
    case "bounce":
    case "custom-curve":
      return "linear";
  }
}

function getNumericValue(value: AnimationValue) {
  return typeof value === "number" ? value : undefined;
}

function isCompilerV1Property(property: AnimationTrack["property"]) {
  return (
    property === "opacity" ||
    property === "transform.x" ||
    property === "transform.y" ||
    property === "transform.z" ||
    property === "transform.scaleX" ||
    property === "transform.scaleY" ||
    property === "transform.rotateX" ||
    property === "transform.rotateY" ||
    property === "transform.rotateZ" ||
    property === "transform.skewX" ||
    property === "transform.skewY"
  );
}

function createTransformValue(channels: TransformChannels) {
  return [
    `translate3d(${formatNumber(channels.x)}px, ${formatNumber(
      channels.y,
    )}px, ${formatNumber(channels.z)}px)`,
    `rotateX(${formatNumber(channels.rotateX)}deg)`,
    `rotateY(${formatNumber(channels.rotateY)}deg)`,
    `rotateZ(${formatNumber(channels.rotateZ)}deg)`,
    `skewX(${formatNumber(channels.skewX)}deg)`,
    `skewY(${formatNumber(channels.skewY)}deg)`,
    `scale(${formatNumber(channels.scaleX)}, ${formatNumber(channels.scaleY)})`,
  ].join(" ");
}

function formatNumber(value: number) {
  return Number(value.toFixed(4));
}

function clampOffset(value: number) {
  return Math.min(1, Math.max(0, value));
}

/**
 * Convert the configured target order into a deterministic stagger delay.
 */
function getStaggerDelay(
  clip: AnimationClip,
  targetIndex: number,
  targetCount: number,
) {
  const stagger = clip.stagger;

  if (!stagger || targetCount <= 1) {
    return 0;
  }

  const orderedIndices = createOrderedTargetIndices(
    targetCount,
    stagger.order,
    stagger.seed,
  );

  const orderedPosition = orderedIndices.indexOf(targetIndex);

  return Math.max(0, orderedPosition) * Math.max(0, stagger.eachMs);
}

function createOrderedTargetIndices(
  targetCount: number,
  order: NonNullable<AnimationClip["stagger"]>["order"],
  seed = 1,
) {
  const indices = Array.from({ length: targetCount }, (_, index) => index);

  switch (order) {
    case "reverse":
      return indices.reverse();

    case "center": {
      const center = (targetCount - 1) / 2;

      return indices.sort(
        (left, right) =>
          Math.abs(left - center) - Math.abs(right - center) || left - right,
      );
    }

    case "edges": {
      const center = (targetCount - 1) / 2;

      return indices.sort(
        (left, right) =>
          Math.abs(right - center) - Math.abs(left - center) || left - right,
      );
    }

    case "random":
      return shuffleIndices(indices, seed);

    case "forward":
    case "canvas-position":
    case "layer-order":
      return indices;
  }
}

function shuffleIndices(indices: number[], seed: number) {
  const shuffled = [...indices];
  let state = Math.abs(Math.floor(seed)) || 1;

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    state = (state * 16807) % 2147483647;

    const targetIndex = state % (index + 1);

    [shuffled[index], shuffled[targetIndex]] = [
      shuffled[targetIndex],
      shuffled[index],
    ];
  }

  return shuffled;
}
