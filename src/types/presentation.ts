export type SlideElementType = "text" | "shape" | "image" | "svg";

export type PresentationAssetType = "image" | "video" | "audio";

export type PresentationAsset = {
  id: string;
  type: PresentationAssetType;
  name: string;
  mimeType: string;
  size: number;
  source: string;
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

export type SlideElement = {
  id: string;
  type: SlideElementType;
  name: string;
  content: string;
  assetId?: string;
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
