import type {
  AnimationEasing,
  AnimationKeyframe,
  AnimationTrack,
  AnimationValue,
} from "../types/presentation";

/**
 * Basic timeline editing keeps adjacent keyframes at least 0.1% apart.
 * Offsets remain normalized local positions inside one Clip track.
 */
export const MINIMUM_KEYFRAME_OFFSET_GAP = 0.001;

/**
 * Percentage inputs can introduce tiny floating-point differences between
 * property tracks that represent the same Clip segment.
 */
export const EASING_OFFSET_MATCH_TOLERANCE = 0.000001;

export type AnimationKeyframeOffsetBounds =
  | {
      editable: true;
      minimumOffset: number;
      maximumOffset: number;
    }
  | {
      editable: false;
      minimumOffset: number;
      maximumOffset: number;
      reason: "missing-keyframe" | "non-finite-offset" | "no-finite-interval";
    };

export type AnimationKeyframeIdentity = {
  trackId: string;
  keyframeId: string;
};

export type AnimationKeyframeGroupMember = AnimationKeyframeIdentity & {
  offset: number;
};

export type AnimationKeyframeGroupOffsetBounds =
  | {
      editable: true;
      minimumDeltaOffset: number;
      maximumDeltaOffset: number;
      keyframes: AnimationKeyframeGroupMember[];
    }
  | {
      editable: false;
      minimumDeltaOffset: number;
      maximumDeltaOffset: number;
      keyframes: AnimationKeyframeGroupMember[];
      reason:
        | "empty-selection"
        | "duplicate-identity"
        | "malformed-selection"
        | "missing-track"
        | "malformed-track"
        | "missing-keyframe"
        | "non-finite-offset"
        | "no-finite-interval";
    };

export type AnimationKeyframeInsertion = {
  leftKeyframe: AnimationKeyframe;
  rightKeyframe: AnimationKeyframe;
  offset: number;
  insertionIndex: number;
};

export function sortAnimationKeyframes(
  keyframes: readonly AnimationKeyframe[],
) {
  return [...keyframes].sort(
    (left, right) =>
      left.offset - right.offset || left.id.localeCompare(right.id),
  );
}

/**
 * Neighbor bounds keep the basic editor from crossing keyframes or removing
 * the minimum gap. A malformed track returns an explicit finite lock instead
 * of leaking NaN / Infinity into UI or command arithmetic.
 */
export function getAnimationKeyframeOffsetBounds(
  keyframes: readonly AnimationKeyframe[],
  keyframeId: string,
): AnimationKeyframeOffsetBounds {
  if (keyframes.some((keyframe) => !Number.isFinite(keyframe.offset))) {
    return {
      editable: false,
      minimumOffset: 0,
      maximumOffset: 0,
      reason: "non-finite-offset",
    };
  }

  const sortedKeyframes = sortAnimationKeyframes(keyframes);
  const keyframeIndex = sortedKeyframes.findIndex(
    (keyframe) => keyframe.id === keyframeId,
  );

  if (keyframeIndex < 0) {
    return {
      editable: false,
      minimumOffset: 0,
      maximumOffset: 0,
      reason: "missing-keyframe",
    };
  }

  const currentKeyframe = sortedKeyframes[keyframeIndex];
  const previousKeyframe = sortedKeyframes[keyframeIndex - 1];
  const followingKeyframe = sortedKeyframes[keyframeIndex + 1];
  const minimumOffset = previousKeyframe
    ? Math.min(1, previousKeyframe.offset + MINIMUM_KEYFRAME_OFFSET_GAP)
    : 0;
  const maximumOffset = followingKeyframe
    ? Math.max(0, followingKeyframe.offset - MINIMUM_KEYFRAME_OFFSET_GAP)
    : 1;

  if (
    !Number.isFinite(minimumOffset) ||
    !Number.isFinite(maximumOffset) ||
    minimumOffset > maximumOffset
  ) {
    return {
      editable: false,
      minimumOffset: Math.min(1, Math.max(0, currentKeyframe.offset)),
      maximumOffset: Math.min(1, Math.max(0, currentKeyframe.offset)),
      reason: "no-finite-interval",
    };
  }

  return {
    editable: true,
    minimumOffset,
    maximumOffset,
  };
}

function getLockedAnimationKeyframeGroupBounds(
  reason: Extract<AnimationKeyframeGroupOffsetBounds, { editable: false }>["reason"],
  keyframes: AnimationKeyframeGroupMember[] = [],
): AnimationKeyframeGroupOffsetBounds {
  return {
    editable: false,
    minimumDeltaOffset: 0,
    maximumDeltaOffset: 0,
    keyframes,
    reason,
  };
}

/**
 * Intersect the legal rigid-translation interval for selected Keyframes across
 * every affected Track. Selected-to-selected neighbors do not constrain one
 * another; only outside boundaries and the normalized 0..1 range do.
 */
export function getAnimationKeyframeGroupOffsetBounds(
  tracks: readonly AnimationTrack[],
  selectedKeyframes: readonly AnimationKeyframeIdentity[],
): AnimationKeyframeGroupOffsetBounds {
  if (!Array.isArray(tracks)) {
    return getLockedAnimationKeyframeGroupBounds("malformed-track");
  }

  if (!Array.isArray(selectedKeyframes)) {
    return getLockedAnimationKeyframeGroupBounds("malformed-selection");
  }

  if (selectedKeyframes.length === 0) {
    return getLockedAnimationKeyframeGroupBounds("empty-selection");
  }

  const selectedIdentityKeys = new Set<string>();

  for (const selectedKeyframe of selectedKeyframes) {
    const identityKey = `${selectedKeyframe.trackId}\u0000${selectedKeyframe.keyframeId}`;

    if (selectedIdentityKeys.has(identityKey)) {
      return getLockedAnimationKeyframeGroupBounds("duplicate-identity");
    }

    selectedIdentityKeys.add(identityKey);
  }

  const selectedByTrackId = new Map<string, Set<string>>();

  for (const selectedKeyframe of selectedKeyframes) {
    const selectedIds = selectedByTrackId.get(selectedKeyframe.trackId);

    if (selectedIds) {
      selectedIds.add(selectedKeyframe.keyframeId);
    } else {
      selectedByTrackId.set(
        selectedKeyframe.trackId,
        new Set([selectedKeyframe.keyframeId]),
      );
    }
  }

  let minimumDeltaOffset = Number.NEGATIVE_INFINITY;
  let maximumDeltaOffset = Number.POSITIVE_INFINITY;
  const resolvedKeyframes: AnimationKeyframeGroupMember[] = [];
  const resolvedTrackIds = new Set<string>();

  for (const track of tracks) {
    const selectedIds = selectedByTrackId.get(track.id);

    if (!selectedIds) {
      continue;
    }

    if (resolvedTrackIds.has(track.id)) {
      return getLockedAnimationKeyframeGroupBounds(
        "missing-track",
        resolvedKeyframes,
      );
    }

    resolvedTrackIds.add(track.id);

    if (
      !Array.isArray(
        (track as { keyframes?: unknown }).keyframes,
      )
    ) {
      return getLockedAnimationKeyframeGroupBounds(
        "malformed-track",
        resolvedKeyframes,
      );
    }

    const trackKeyframes = track.keyframes as readonly AnimationKeyframe[];

    if (trackKeyframes.some((keyframe) => !Number.isFinite(keyframe.offset))) {
      return getLockedAnimationKeyframeGroupBounds(
        "non-finite-offset",
        resolvedKeyframes,
      );
    }

    const sortedKeyframes = sortAnimationKeyframes(trackKeyframes);
    const resolvedIds = new Set<string>();

    for (const keyframe of sortedKeyframes) {
      if (!selectedIds.has(keyframe.id)) {
        continue;
      }

      if (resolvedIds.has(keyframe.id)) {
        return getLockedAnimationKeyframeGroupBounds(
          "duplicate-identity",
          resolvedKeyframes,
        );
      }

      resolvedIds.add(keyframe.id);
      resolvedKeyframes.push({
        trackId: track.id,
        keyframeId: keyframe.id,
        offset: keyframe.offset,
      });
      minimumDeltaOffset = Math.max(
        minimumDeltaOffset,
        -keyframe.offset,
      );
      maximumDeltaOffset = Math.min(
        maximumDeltaOffset,
        1 - keyframe.offset,
      );
    }

    if (resolvedIds.size !== selectedIds.size) {
      return getLockedAnimationKeyframeGroupBounds(
        "missing-keyframe",
        resolvedKeyframes,
      );
    }

    for (let index = 0; index < sortedKeyframes.length - 1; index += 1) {
      const leftKeyframe = sortedKeyframes[index];
      const rightKeyframe = sortedKeyframes[index + 1];
      const leftSelected = selectedIds.has(leftKeyframe.id);
      const rightSelected = selectedIds.has(rightKeyframe.id);

      if (!leftSelected && rightSelected) {
        minimumDeltaOffset = Math.max(
          minimumDeltaOffset,
          leftKeyframe.offset +
            MINIMUM_KEYFRAME_OFFSET_GAP -
            rightKeyframe.offset,
        );
      } else if (leftSelected && !rightSelected) {
        maximumDeltaOffset = Math.min(
          maximumDeltaOffset,
          rightKeyframe.offset -
            MINIMUM_KEYFRAME_OFFSET_GAP -
            leftKeyframe.offset,
        );
      }
    }
  }

  if (resolvedTrackIds.size !== selectedByTrackId.size) {
    return getLockedAnimationKeyframeGroupBounds(
      "missing-track",
      resolvedKeyframes,
    );
  }

  if (
    !Number.isFinite(minimumDeltaOffset) ||
    !Number.isFinite(maximumDeltaOffset) ||
    minimumDeltaOffset > maximumDeltaOffset
  ) {
    return getLockedAnimationKeyframeGroupBounds(
      "no-finite-interval",
      resolvedKeyframes,
    );
  }

  return {
    editable: true,
    minimumDeltaOffset,
    maximumDeltaOffset,
    keyframes: resolvedKeyframes,
  };
}

/** Keep persisted offsets aligned with the existing six-decimal editor rule. */
export function normalizeAnimationKeyframeOffset(offset: number) {
  if (!Number.isFinite(offset)) {
    return undefined;
  }

  return Number(Math.min(1, Math.max(0, offset)).toFixed(6));
}

/** Normalize one shared rigid-group delta without clamping its sign. */
export function normalizeAnimationKeyframeOffsetDelta(deltaOffset: number) {
  if (!Number.isFinite(deltaOffset)) {
    return undefined;
  }

  return Number(deltaOffset.toFixed(6));
}

/**
 * Basic insertion uses the first largest adjacent gap, matching the existing
 * Inspector and command behavior. It never creates frames outside the ends.
 */
export function getAnimationKeyframeInsertion(
  keyframes: readonly AnimationKeyframe[],
): AnimationKeyframeInsertion | undefined {
  const sortedKeyframes = sortAnimationKeyframes(keyframes);

  if (sortedKeyframes.length < 2) {
    return undefined;
  }

  let insertionIndex = 1;
  let leftKeyframe = sortedKeyframes[0];
  let rightKeyframe = sortedKeyframes[1];
  let largestGap = rightKeyframe.offset - leftKeyframe.offset;

  for (let index = 1; index < sortedKeyframes.length - 1; index += 1) {
    const currentLeft = sortedKeyframes[index];
    const currentRight = sortedKeyframes[index + 1];
    const currentGap = currentRight.offset - currentLeft.offset;

    if (currentGap > largestGap) {
      insertionIndex = index + 1;
      leftKeyframe = currentLeft;
      rightKeyframe = currentRight;
      largestGap = currentGap;
    }
  }

  if (largestGap <= MINIMUM_KEYFRAME_OFFSET_GAP * 2) {
    return undefined;
  }

  return {
    leftKeyframe,
    rightKeyframe,
    offset: Number((leftKeyframe.offset + largestGap / 2).toFixed(6)),
    insertionIndex,
  };
}

export function canAddAnimationKeyframe(
  keyframes: readonly AnimationKeyframe[],
) {
  return getAnimationKeyframeInsertion(keyframes) !== undefined;
}

export function canDeleteAnimationKeyframe(
  keyframes: readonly AnimationKeyframe[],
) {
  return keyframes.length > 2;
}

export function canEditAnimationKeyframeEasing(
  keyframes: readonly AnimationKeyframe[],
  keyframeId: string,
) {
  const sortedKeyframes = sortAnimationKeyframes(keyframes);
  const keyframeIndex = sortedKeyframes.findIndex(
    (keyframe) => keyframe.id === keyframeId,
  );

  return keyframeIndex >= 0 && keyframeIndex < sortedKeyframes.length - 1;
}

/**
 * Command inputs must not remain aliased with persisted keyframe data. The
 * recursive fallback also protects forward-compatible array-shaped values.
 */
function cloneStructuredValue<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => cloneStructuredValue(item)) as T;
  }

  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        cloneStructuredValue(item),
      ]),
    ) as T;
  }

  return value;
}

export function cloneAnimationValue(value: AnimationValue): AnimationValue {
  return cloneStructuredValue(value);
}

export function cloneAnimationEasing(
  easing?: AnimationEasing,
): AnimationEasing | undefined {
  return easing ? cloneStructuredValue(easing) : undefined;
}

/** Normalize user-facing easing parameters before persisting them. */
export function normalizeAnimationEasing(
  easing?: AnimationEasing,
): AnimationEasing | undefined {
  if (!easing) {
    return undefined;
  }

  switch (easing.type) {
    case "css":
      return {
        type: "css",
        value: easing.value.trim() || "linear",
      };

    case "cubic-bezier":
      return {
        type: "cubic-bezier",
        x1: normalizeFiniteNumber(easing.x1, 0.25, 0, 1),
        y1: normalizeFiniteNumber(easing.y1, 0.1, -4, 4),
        x2: normalizeFiniteNumber(easing.x2, 0.25, 0, 1),
        y2: normalizeFiniteNumber(easing.y2, 1, -4, 4),
      };

    case "steps":
      return {
        type: "steps",
        count: Math.round(normalizeFiniteNumber(easing.count, 4, 1, 100)),
        position: easing.position,
      };

    case "spring":
    case "bounce":
    case "custom-curve":
      return cloneAnimationEasing(easing);
  }
}

function normalizeFiniteNumber(
  value: number,
  fallback: number,
  minimum: number,
  maximum: number,
) {
  const finiteValue = Number.isFinite(value) ? value : fallback;
  return Math.min(maximum, Math.max(minimum, finiteValue));
}

export function animationEasingsEqual(
  left?: AnimationEasing,
  right?: AnimationEasing,
) {
  if (Object.is(left, right)) {
    return true;
  }

  if (!left || !right) {
    return false;
  }

  return JSON.stringify(left) === JSON.stringify(right);
}

export function animationValuesEqual(
  left: AnimationValue,
  right: AnimationValue,
) {
  if (Object.is(left, right)) {
    return true;
  }

  if (
    typeof left !== "object" ||
    left === null ||
    typeof right !== "object" ||
    right === null
  ) {
    return false;
  }

  return JSON.stringify(left) === JSON.stringify(right);
}

export function interpolateAnimationValue(
  leftValue: AnimationValue,
  rightValue: AnimationValue,
  progress: number,
): AnimationValue {
  const safeProgress = Math.min(1, Math.max(0, progress));

  if (typeof leftValue === "number" && typeof rightValue === "number") {
    return interpolateNumber(leftValue, rightValue, safeProgress);
  }

  if (typeof leftValue !== "object" || typeof rightValue !== "object") {
    return cloneAnimationValue(safeProgress < 0.5 ? leftValue : rightValue);
  }

  if ("r" in leftValue && "r" in rightValue) {
    return {
      r: interpolateNumber(leftValue.r, rightValue.r, safeProgress),
      g: interpolateNumber(leftValue.g, rightValue.g, safeProgress),
      b: interpolateNumber(leftValue.b, rightValue.b, safeProgress),
      a: interpolateNumber(leftValue.a, rightValue.a, safeProgress),
    };
  }

  if ("z" in leftValue && "z" in rightValue) {
    return {
      x: interpolateNumber(leftValue.x, rightValue.x, safeProgress),
      y: interpolateNumber(leftValue.y, rightValue.y, safeProgress),
      z: interpolateNumber(leftValue.z, rightValue.z, safeProgress),
    };
  }

  if ("x" in leftValue && "x" in rightValue) {
    return {
      x: interpolateNumber(leftValue.x, rightValue.x, safeProgress),
      y: interpolateNumber(leftValue.y, rightValue.y, safeProgress),
    };
  }

  return cloneAnimationValue(safeProgress < 0.5 ? leftValue : rightValue);
}

function interpolateNumber(
  startValue: number,
  endValue: number,
  progress: number,
) {
  return Number((startValue + (endValue - startValue) * progress).toFixed(6));
}
