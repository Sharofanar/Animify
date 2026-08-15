import type {
  AnimationClip,
  AnimationEasing,
  AnimationKeyframe,
  AnimationScene,
  AnimationValue,
  Slide,
} from "../types/presentation";
import {
  EASING_OFFSET_MATCH_TOLERANCE,
  animationEasingsEqual,
  animationValuesEqual,
  canDeleteAnimationKeyframe,
  canEditAnimationKeyframeEasing,
  cloneAnimationEasing,
  cloneAnimationValue,
  getAnimationKeyframeGroupOffsetBounds,
  getAnimationKeyframeInsertion,
  getAnimationKeyframeOffsetBounds,
  interpolateAnimationValue,
  normalizeAnimationKeyframeOffset,
  normalizeAnimationKeyframeOffsetDelta,
  normalizeAnimationEasing,
  sortAnimationKeyframes,
  type AnimationKeyframeIdentity,
} from "./animationKeyframeRules";

export type UpdateAnimationKeyframeValueCommand = {
  clipId: string;
  trackId: string;
  keyframeId: string;
  value: AnimationValue;
};

export type UpdateAnimationKeyframeOffsetCommand = {
  clipId: string;
  trackId: string;
  keyframeId: string;

  /** Normalized local position inside the animation track, from 0 to 1. */
  offset: number;
};

export type UpdateAnimationKeyframeOffsetsCommand = {
  clipId: string;
  keyframes: AnimationKeyframeIdentity[];
  deltaOffset: number;
};

export type UpdateAnimationKeyframeEasingCommand = {
  clipId: string;
  trackId: string;
  keyframeId: string;

  /** Undefined represents the compiler's default linear interpolation. */
  easing?: AnimationEasing;
};

export type AddAnimationKeyframeRequest = {
  clipId: string;
  trackId: string;
};

export type AddAnimationKeyframeCommand = AddAnimationKeyframeRequest & {
  /** App supplies this value so the pure command never reads a clock. */
  operationId: string;
};

export type AddAnimationKeyframeResult = {
  slide: Slide;
  createdKeyframeId?: string;
};

export type DeleteAnimationKeyframeCommand = {
  clipId: string;
  trackId: string;
  keyframeId: string;
};

/**
 * Keyframe commands own only immutable document transforms. History, preview,
 * and editor selection remain responsibilities of the App orchestration layer.
 */
export function updateAnimationKeyframeValueInSlide(
  slide: Slide,
  command: UpdateAnimationKeyframeValueCommand,
): Slide {
  const target = getAnimationKeyframeTarget(slide, command);

  if (!target) {
    return slide;
  }

  const { scene, clip, track, trackIndex, keyframe, keyframeIndex } = target;

  if (animationValuesEqual(keyframe.value, command.value)) {
    return slide;
  }

  const nextKeyframes = [...track.keyframes];
  nextKeyframes[keyframeIndex] = {
    ...keyframe,

    // Persisted values must not retain mutable references owned by the caller.
    value: cloneAnimationValue(command.value),
  };

  return replaceAnimationTrackInSlide(slide, scene, clip, trackIndex, {
    ...track,
    keyframes: nextKeyframes,
  });
}

export function updateAnimationKeyframeOffsetInSlide(
  slide: Slide,
  command: UpdateAnimationKeyframeOffsetCommand,
): Slide {
  if (!Number.isFinite(command.offset)) {
    return slide;
  }

  const target = getAnimationKeyframeTarget(slide, command);

  if (!target) {
    return slide;
  }

  const { scene, clip, track, trackIndex, keyframe } = target;
  const bounds = getAnimationKeyframeOffsetBounds(
    track.keyframes,
    command.keyframeId,
  );

  if (!bounds.editable || !Number.isFinite(keyframe.offset)) {
    return slide;
  }

  const boundedOffset = Math.min(
    bounds.maximumOffset,
    Math.max(bounds.minimumOffset, command.offset),
  );
  const normalizedOffset = normalizeAnimationKeyframeOffset(boundedOffset);

  if (normalizedOffset === undefined) {
    return slide;
  }

  const nextOffset = Math.min(
    bounds.maximumOffset,
    Math.max(bounds.minimumOffset, normalizedOffset),
  );

  if (Object.is(keyframe.offset, nextOffset)) {
    return slide;
  }

  const nextKeyframes = sortAnimationKeyframes(
    track.keyframes.map((item) =>
      item.id === command.keyframeId
        ? {
            ...item,
            offset: nextOffset,
          }
        : item,
    ),
  );

  return replaceAnimationTrackInSlide(slide, scene, clip, trackIndex, {
    ...track,
    keyframes: nextKeyframes,
  });
}

/** Apply one all-or-nothing rigid Keyframe translation as one Scene mutation. */
export function updateAnimationKeyframeOffsetsInSlide(
  slide: Slide,
  command: UpdateAnimationKeyframeOffsetsCommand,
): Slide {
  const scene = slide.animationScene;
  const clip = scene?.clips[command.clipId];

  if (!scene || scene.schemaVersion !== 2 || !clip) {
    return slide;
  }

  const bounds = getAnimationKeyframeGroupOffsetBounds(
    clip.tracks,
    command.keyframes,
  );
  const normalizedDeltaOffset = normalizeAnimationKeyframeOffsetDelta(
    command.deltaOffset,
  );

  if (!bounds.editable || normalizedDeltaOffset === undefined) {
    return slide;
  }

  const deltaOffset = Math.min(
    bounds.maximumDeltaOffset,
    Math.max(bounds.minimumDeltaOffset, normalizedDeltaOffset),
  );

  if (Object.is(deltaOffset, 0)) {
    return slide;
  }

  const selectedByTrackId = new Map<string, Map<string, number>>();

  for (const keyframe of bounds.keyframes) {
    const selectedOffsets = selectedByTrackId.get(keyframe.trackId);

    if (selectedOffsets) {
      selectedOffsets.set(keyframe.keyframeId, keyframe.offset);
    } else {
      selectedByTrackId.set(
        keyframe.trackId,
        new Map([[keyframe.keyframeId, keyframe.offset]]),
      );
    }
  }

  const nextTracks = clip.tracks.map((track) => {
    const selectedOffsets = selectedByTrackId.get(track.id);

    if (!selectedOffsets) {
      return track;
    }

    return {
      ...track,
      keyframes: sortAnimationKeyframes(
        track.keyframes.map((keyframe) => {
          const sourceOffset = selectedOffsets.get(keyframe.id);

          return sourceOffset === undefined
            ? keyframe
            : {
                ...keyframe,
                offset: sourceOffset + deltaOffset,
              };
        }),
      ),
    };
  });

  return replaceAnimationClipInSlide(slide, scene, clip, {
    ...clip,
    tracks: nextTracks,
    metadata: {
      ...clip.metadata,
      customized: true,
    },
  });
}

/**
 * Compiler V1 merges property tracks into one browser animation, so every
 * outgoing segment at the selected offset shares the same easing.
 */
export function updateAnimationKeyframeEasingInSlide(
  slide: Slide,
  command: UpdateAnimationKeyframeEasingCommand,
): Slide {
  const scene = slide.animationScene;
  const clip = scene?.clips[command.clipId];

  if (!scene || scene.schemaVersion !== 2 || !clip) {
    return slide;
  }

  const targetTrack = clip.tracks.find((track) => track.id === command.trackId);

  if (
    !targetTrack ||
    !canEditAnimationKeyframeEasing(
      targetTrack.keyframes,
      command.keyframeId,
    )
  ) {
    return slide;
  }

  const targetKeyframe = targetTrack.keyframes.find(
    (keyframe) => keyframe.id === command.keyframeId,
  );

  if (!targetKeyframe) {
    return slide;
  }

  const normalizedEasing = normalizeAnimationEasing(command.easing);
  let changed = false;

  const nextTracks = clip.tracks.map((track) => {
    const sortedKeyframes = sortAnimationKeyframes(track.keyframes);
    const matchingKeyframeIndex = sortedKeyframes.findIndex(
      (keyframe) =>
        Math.abs(keyframe.offset - targetKeyframe.offset) <=
        EASING_OFFSET_MATCH_TOLERANCE,
    );

    if (
      matchingKeyframeIndex < 0 ||
      matchingKeyframeIndex >= sortedKeyframes.length - 1
    ) {
      return track;
    }

    const matchingKeyframe = sortedKeyframes[matchingKeyframeIndex];

    if (animationEasingsEqual(matchingKeyframe.easing, normalizedEasing)) {
      return track;
    }

    changed = true;

    return {
      ...track,
      keyframes: track.keyframes.map((keyframe) =>
        keyframe.id === matchingKeyframe.id
          ? {
              ...keyframe,

              // Each synchronized keyframe owns an isolated easing object.
              easing: cloneAnimationEasing(normalizedEasing),
            }
          : keyframe,
      ),
    };
  });

  if (!changed) {
    return slide;
  }

  return replaceAnimationClipInSlide(slide, scene, clip, {
    ...clip,
    tracks: nextTracks,
    metadata: {
      ...clip.metadata,
      customized: true,
    },
  });
}

export function addAnimationKeyframeToSlide(
  slide: Slide,
  command: AddAnimationKeyframeCommand,
): AddAnimationKeyframeResult {
  const scene = slide.animationScene;
  const clip = scene?.clips[command.clipId];
  const operationId = command.operationId.trim();

  if (!scene || scene.schemaVersion !== 2 || !clip || !operationId) {
    return { slide };
  }

  const trackIndex = clip.tracks.findIndex(
    (track) => track.id === command.trackId,
  );

  if (trackIndex < 0) {
    return { slide };
  }

  const track = clip.tracks[trackIndex];
  const insertion = getAnimationKeyframeInsertion(track.keyframes);

  if (!insertion) {
    return { slide };
  }

  const interpolationProgress =
    (insertion.offset - insertion.leftKeyframe.offset) /
    (insertion.rightKeyframe.offset - insertion.leftKeyframe.offset);
  const createdKeyframeId = createDeterministicKeyframeId(
    track.id,
    operationId,
    insertion.insertionIndex,
    new Set(track.keyframes.map((keyframe) => keyframe.id)),
  );
  const newKeyframe: AnimationKeyframe = {
    id: createdKeyframeId,
    offset: insertion.offset,
    value: cloneAnimationValue(
      interpolateAnimationValue(
        insertion.leftKeyframe.value,
        insertion.rightKeyframe.value,
        interpolationProgress,
      ),
    ),

    // The new outgoing segment starts with the preceding segment's easing.
    easing: cloneAnimationEasing(insertion.leftKeyframe.easing),
  };
  const nextSlide = replaceAnimationTrackInSlide(
    slide,
    scene,
    clip,
    trackIndex,
    {
      ...track,
      keyframes: sortAnimationKeyframes([...track.keyframes, newKeyframe]),
    },
  );

  return {
    slide: nextSlide,
    createdKeyframeId,
  };
}

export function deleteAnimationKeyframeFromSlide(
  slide: Slide,
  command: DeleteAnimationKeyframeCommand,
): Slide {
  const target = getAnimationKeyframeTarget(slide, command);

  if (!target || !canDeleteAnimationKeyframe(target.track.keyframes)) {
    return slide;
  }

  const { scene, clip, track, trackIndex } = target;

  return replaceAnimationTrackInSlide(slide, scene, clip, trackIndex, {
    ...track,
    keyframes: sortAnimationKeyframes(
      track.keyframes.filter(
        (keyframe) => keyframe.id !== command.keyframeId,
      ),
    ),
  });
}

type AnimationKeyframeTargetCommand = {
  clipId: string;
  trackId: string;
  keyframeId: string;
};

function getAnimationKeyframeTarget(
  slide: Slide,
  command: AnimationKeyframeTargetCommand,
) {
  const scene = slide.animationScene;
  const clip = scene?.clips[command.clipId];

  if (!scene || scene.schemaVersion !== 2 || !clip) {
    return undefined;
  }

  const trackIndex = clip.tracks.findIndex(
    (track) => track.id === command.trackId,
  );

  if (trackIndex < 0) {
    return undefined;
  }

  const track = clip.tracks[trackIndex];
  const keyframeIndex = track.keyframes.findIndex(
    (keyframe) => keyframe.id === command.keyframeId,
  );

  if (keyframeIndex < 0) {
    return undefined;
  }

  return {
    scene,
    clip,
    track,
    trackIndex,
    keyframe: track.keyframes[keyframeIndex],
    keyframeIndex,
  };
}

function replaceAnimationTrackInSlide(
  slide: Slide,
  scene: AnimationScene,
  clip: AnimationClip,
  trackIndex: number,
  nextTrack: AnimationClip["tracks"][number],
) {
  const nextTracks = [...clip.tracks];
  nextTracks[trackIndex] = nextTrack;

  return replaceAnimationClipInSlide(slide, scene, clip, {
    ...clip,
    tracks: nextTracks,
    metadata: {
      ...clip.metadata,
      customized: true,
    },
  });
}

function replaceAnimationClipInSlide(
  slide: Slide,
  scene: AnimationScene,
  clip: AnimationClip,
  nextClip: AnimationClip,
) {
  return {
    ...slide,
    animationScene: {
      ...scene,
      revision: Math.max(1, scene.revision + 1),
      clips: {
        ...scene.clips,
        [clip.id]: nextClip,
      },
    },
  };
}

/** operationId and insertion index make keyframe allocation deterministic. */
function createDeterministicKeyframeId(
  trackId: string,
  operationId: string,
  insertionIndex: number,
  existingKeyframeIds: ReadonlySet<string>,
) {
  const baseId = `${trackId}-keyframe-${operationId}-${insertionIndex}`;
  let candidate = baseId;
  let suffix = 1;

  while (existingKeyframeIds.has(candidate)) {
    candidate = `${baseId}-${suffix}`;
    suffix += 1;
  }

  return candidate;
}
