export type SlideElementType =
  | "text"
  | "shape"
  | "image"
  | "video"
  | "audio"
  | "svg";

export type PresentationAssetType = "image" | "video" | "audio";

/**
 * Persistent asset metadata stored inside the project JSON.
 *
 * Binary file data is stored separately in IndexedDB using the same asset ID.
 * This keeps localStorage and undo snapshots independent from large media data.
 */
export type PresentationAsset = {
  id: string;
  type: PresentationAssetType;
  name: string;
  mimeType: string;
  size: number;
  createdAt: string;
};

/**
 * Legacy animation structure used by the current property panel, canvas preview,
 * presentation mode, and HTML exporter.
 *
 * Keep this structure during the Animation Schema V2 migration. It will be
 * removed only after every animation reader has switched to animationScene.
 */
export type SlideElementAnimation = {
  id: string;
  name: string;
  type: "enter" | "emphasis" | "exit";
  duration: number;
  delay: number;
  easing: string;
  keyframes: string;
};

export type AnimationCategory =
  | "enter"
  | "emphasis"
  | "exit"
  | "motion"
  | "interaction"
  | "custom";

export type AnimationDirection =
  | "normal"
  | "reverse"
  | "alternate"
  | "alternate-reverse";

export type AnimationFillMode = "none" | "forwards" | "backwards" | "both";

export type AnimationBlendMode = "replace" | "add" | "multiply";

export type AnimationValueMode = "absolute" | "relative";

export type AnimationTrigger =
  | {
      type: "slide-enter";
    }
  | {
      type: "click";
      targetElementId?: string;
    }
  | {
      type: "hover";
      targetElementId: string;
    }
  | {
      type: "keyboard";
      key: string;
    }
  | {
      type: "media-time";
      assetId: string;
      timeMs: number;
    }
  | {
      type: "manual";
    };

export type AnimationEasing =
  | {
      type: "css";
      value: string;
    }
  | {
      type: "cubic-bezier";
      x1: number;
      y1: number;
      x2: number;
      y2: number;
    }
  | {
      type: "steps";
      count: number;
      position: "start" | "end";
    }
  | {
      type: "spring";
      mass: number;
      stiffness: number;
      damping: number;
      velocity: number;
    }
  | {
      type: "bounce";
      intensity: number;
    }
  | {
      type: "custom-curve";
      points: Array<{
        x: number;
        y: number;
      }>;
    };

export type AnimationValue =
  | number
  | string
  | boolean
  | {
      x: number;
      y: number;
    }
  | {
      x: number;
      y: number;
      z: number;
    }
  | {
      r: number;
      g: number;
      b: number;
      a: number;
    };

export type AnimationProperty =
  | "transform.x"
  | "transform.y"
  | "transform.z"
  | "transform.scaleX"
  | "transform.scaleY"
  | "transform.rotateX"
  | "transform.rotateY"
  | "transform.rotateZ"
  | "transform.skewX"
  | "transform.skewY"
  | "opacity"
  | "style.color"
  | "style.backgroundColor"
  | "style.borderRadius"
  | "filter.blur"
  | "filter.brightness"
  | "filter.contrast"
  | "filter.saturate"
  | "filter.hueRotate"
  | "clipPath.progress"
  | "motionPath.progress"
  | "svg.strokeDashOffset"
  | "text.revealProgress"
  | `custom.${string}`;

export type AnimationKeyframe = {
  id: string;

  /**
   * Relative position inside the current track, from 0 to 1.
   */
  offset: number;

  value: AnimationValue;
  easing?: AnimationEasing;
  hold?: boolean;
};

export type AnimationTrack = {
  id: string;
  name: string;
  property: AnimationProperty;
  enabled: boolean;
  valueMode: AnimationValueMode;
  blendMode: AnimationBlendMode;
  keyframes: AnimationKeyframe[];
};

export type AnimationTargetSubTarget =
  | {
      type: "text";
      unit: "character" | "word" | "line";
    }
  | {
      type: "svg-part";
      selector: string;
    };

export type AnimationTarget = {
  elementId: string;
  subTarget?: AnimationTargetSubTarget;
};

export type AnimationStagger = {
  eachMs: number;
  order:
    | "forward"
    | "reverse"
    | "center"
    | "edges"
    | "random"
    | "canvas-position"
    | "layer-order";
  seed?: number;
};

export type AnimationClip = {
  id: string;
  name: string;
  category: AnimationCategory;
  targets: AnimationTarget[];
  startMs: number;
  durationMs: number;
  enabled: boolean;
  fill: AnimationFillMode;
  iterations: number;
  direction: AnimationDirection;

  /**
   * Clip-local playback speed.
   *
   * Older saved projects may not contain this field, so readers must treat an
   * absent value as 1. Sequence playback rate is multiplied by this value.
   */
  playbackRate?: number;

  tracks: AnimationTrack[];
  stagger?: AnimationStagger;
  sourcePreset?: {
    presetId: string;
    presetVersion: number;
  };
  metadata?: Record<string, string | number | boolean>;
};

export type AnimationSequence = {
  id: string;
  name: string;
  trigger: AnimationTrigger;
  clipIds: string[];
  durationMode: "auto" | "fixed";
  durationMs?: number;
  playback: {
    repeat: number;
    direction: AnimationDirection;
    playbackRate: number;
  };
};

export type MotionPath = {
  id: string;
  name: string;
  pathData: string;
  coordinateSpace: "slide" | "element";
  autoRotate: boolean;
  rotateOffset: number;
  anchor: {
    x: number;
    y: number;
  };
};

export type AnimationMarker = {
  id: string;
  name: string;
  timeMs: number;
};

export type AnimationScene = {
  schemaVersion: 2;

  /**
   * Increment when a scene edit invalidates compiled animation caches.
   */
  revision: number;

  sequenceOrder: string[];
  sequences: Record<string, AnimationSequence>;
  clips: Record<string, AnimationClip>;
  paths: Record<string, MotionPath>;
  markers: AnimationMarker[];
};

export type SlideElementStyle = {
  x: number;
  y: number;
  width: number;
  height: number;
  rotate: number;
  opacity: number;
  backgroundColor?: string;
  color?: string;
  fontSize?: number;
  fontWeight?: number;
  borderRadius?: number;
};

/**
 * Persistent playback behavior shared by video and audio slide elements.
 *
 * More advanced trigger-driven playback will later be connected to the unified
 * Animation & Interaction system. This structure stores only the media element's
 * basic playback preferences.
 */
export type SlideElementMediaSettings = {
  startBehavior:
    | "manual"
    | "slide-enter";

  loop: boolean;

  muted: boolean;

  /**
   * Normalized volume from 0 to 1.
   */
  volume: number;
};

export type SlideElement = {
  id: string;
  type: SlideElementType;
  name: string;
  content: string;
  assetId?: string;

  /**
   * Video and audio playback preferences.
   *
   * Older projects may not contain this field, so every renderer must preserve
   * backward-compatible defaults when media is undefined.
   */
  media?: SlideElementMediaSettings;

  style: SlideElementStyle;

  /**
   * Legacy animation data retained during the V2 migration.
   */
  animations: SlideElementAnimation[];
};

export type Slide = {
  id: string;
  title: string;
  backgroundColor: string;
  elements: SlideElement[];

  /**
   * Animation Schema V2 scene shared by the timeline, player, and exporter.
   */
  animationScene: AnimationScene;
};

export type PresentationProject = {
  id: string;
  name: string;
  description: string;
  width: number;
  height: number;
  slides: Slide[];
  assets: Record<string, PresentationAsset>;
  activeSlideId: string;
  updatedAt: string;
};
