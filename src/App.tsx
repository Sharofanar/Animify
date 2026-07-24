import { DndContext, type DragEndEvent } from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import { ComponentLibrary } from "./components/editor/ComponentLibrary";
import { AnimationFloatingPanel } from "./components/editor/AnimationFloatingPanel";
import { AnimationTimeline } from "./components/editor/AnimationTimeline";
import { PropertyPanel } from "./components/editor/PropertyPanel";
import { ResourceCenter } from "./components/editor/ResourceCenter";
import { DuplicateResourceReviewPanel } from "./components/editor/DuplicateResourceReviewPanel";
import { SlideCanvas } from "./components/editor/SlideCanvas";
import { demoProject } from "./data/demoProject";
import { exportProjectAsHtml } from "./utils/exportHtml";
import { getAnimationClipPreviewWindow } from "./utils/animationCompiler";
import {
  computeBlobSha256,
  dataUrlToBlob,
  deleteAssetBlob,
  getAssetBlob,
  putVerifiedAssetBlob,
} from "./utils/assetStore";
import {
  createAnimationSceneFromLegacyElements,
  createEmptyAnimationScene,
  normalizeProjectAnimationScenes,
} from "./utils/animationSchema";
import {
  addAnimationClipToSlide,
  addAnimationKeyframeToSlide,
  applyElementBatchUpdatesToSlide,
  cloneElementAnimationsToInsertedElements,
  deleteAnimationClipFromSlide,
  deleteAnimationKeyframeFromSlide,
  duplicateAnimationClipInSlide,
  isAnimationClipLiveForElements,
  updateAnimationClipEasingInSlide,
  updateAnimationClipTimingInSlide,
  updateAnimationKeyframeEasingInSlide,
  updateAnimationKeyframeOffsetInSlide,
  updateAnimationKeyframeValueInSlide,
  type AddAnimationClipCommand,
  type AddAnimationKeyframeCommand,
  type DeleteAnimationClipCommand,
  type DeleteAnimationKeyframeCommand,
  type DuplicateAnimationClipCommand,
  type UpdateAnimationClipEasingCommand,
  type UpdateAnimationClipTimingCommand,
  type UpdateAnimationKeyframeEasingCommand,
  type UpdateAnimationKeyframeOffsetCommand,
  type UpdateAnimationKeyframeValueCommand,
} from "./utils/animationCommands";
import type {
  AnimationScene,
  PresentationAsset,
  PresentationAssetType,
  PresentationProject,
  SlideElement,
  SlideElementType,
} from "./types/presentation";
import { useTimelinePlaybackController } from "./hooks/useTimelinePlaybackController";

const STORAGE_KEY = "animify-project";

const ANIMATION_WORKSPACE_DISPLAY_MODE_KEY =
  "animify-animation-workspace-display-mode";

type AnimationWorkspaceDisplayMode = "on-demand" | "always";

/**
 * Read the local editor preference without coupling it to presentation data.
 *
 * This setting controls only the Animify workspace layout on the current
 * browser and must never be serialized into PresentationProject.
 */
function loadAnimationWorkspaceDisplayMode(): AnimationWorkspaceDisplayMode {
  try {
    return localStorage.getItem(ANIMATION_WORKSPACE_DISPLAY_MODE_KEY) ===
      "always"
      ? "always"
      : "on-demand";
  } catch {
    return "on-demand";
  }
}

type LegacyPresentationAsset = PresentationAsset & {
  source?: string;
};

type LegacyPresentationProject = Omit<PresentationProject, "assets"> & {
  assets?: Record<string, LegacyPresentationAsset>;
};

/**
 * Legacy Data URLs are collected during synchronous project loading and moved
 * into IndexedDB immediately after App mounts.
 */
const pendingLegacyAssetSources = new Map<string, string>();

let legacyAssetMigrationPromise: Promise<void> | null = null;

/**
 * Migrate every legacy project asset only once, including during React
 * development Strict Mode's mount/unmount verification cycle.
 */
function migratePendingLegacyAssets() {
  if (legacyAssetMigrationPromise) {
    return legacyAssetMigrationPromise;
  }

  legacyAssetMigrationPromise = (async () => {
    for (const [assetId, source] of pendingLegacyAssetSources) {
      const existingBlob = await getAssetBlob(assetId);

      if (existingBlob) {
        continue;
      }

      const blob = await dataUrlToBlob(source);

      await putVerifiedAssetBlob(assetId, blob);
    }

    pendingLegacyAssetSources.clear();
  })();

  return legacyAssetMigrationPromise;
}

type EditorMode = "edit" | "animation" | "present";

type LeftPanelMode = "components" | "assets";

type ElementContextMenuState = {
  elementId: string;
  x: number;
  y: number;
} | null;

type CanvasContextMenuState = {
  x: number;
  y: number;
  slideX: number;
  slideY: number;
} | null;

type ProjectUpdater = (
  currentProject: PresentationProject,
) => PresentationProject;

type ElementUpdates = Partial<Omit<SlideElement, "style">> & {
  style?: Partial<SlideElement["style"]>;
};

type ElementBatchUpdate = {
  elementId: string;
  updates: ElementUpdates;
};

type CopiedElementClipboard = {
  sourceSlideId: string;
  elements: SlideElement[];
  animationScene: AnimationScene;
};

type ActiveAnimationContext = {
  elementId: string;
  clipId: string;

  /**
   * Increment when an outside editor requests the same Clip again.
   *
   * The ID allows the track inspector to reopen and scroll to an already
   * selected Clip without duplicating any animation data in UI state.
   */
  requestId: number;
};

/**
 * Temporary editor-only state for one isolated Clip preview.
 *
 * The project scene remains the authority for every animation value. This state
 * only remembers which compiled Clip is sampled and where the page Playhead
 * should return when preview stops.
 */
type AnimationClipPreviewState = {
  slideId: string;
  clipId: string;
  returnTimeMs: number;
};

type PendingDuplicateResource = {
  id: string;
  file: File;
  assetType: PresentationAssetType;
  contentHash: string;
  duplicateAssetId: string;
  reviewIndex: number;
  reviewTotal: number;
};

const MAX_HISTORY_LENGTH = 60;

const featureCards = [
  {
    title: "可视化演示编排",
    description: "提供拖拽式画布、组件布局、样式编辑、图层管理和动画编排能力。",
  },
  {
    title: "端侧智能辅助",
    description:
      "通过本地大模型把自然语言指令转换为动画代码，辅助用户快速创作。",
  },
  {
    title: "性能审计优化",
    description:
      "检查动画代码中的高消耗属性，并给出基于 transform 和 opacity 的优化建议。",
  },
  {
    title: "隐私协同演示",
    description: "采用本地优先架构，支持局域网内多设备扫码同步播放演示内容。",
  },
];

function isSlideElementType(value: unknown): value is SlideElementType {
  return (
    value === "text" ||
    value === "shape" ||
    value === "image" ||
    value === "video" ||
    value === "audio" ||
    value === "svg"
  );
}

function createSlideElement(
  type: SlideElementType,
  elementIndex: number,
  position?: { x: number; y: number },
): SlideElement {
  const id = `element-${type}-${Date.now()}`;
  const baseX = position?.x ?? 120;
  const baseY = position?.y ?? 120 + elementIndex * 24;

  if (type === "text") {
    return {
      id,
      type,
      name: `文本元素 ${elementIndex + 1}`,
      content: "双击编辑文本",
      style: {
        x: baseX,
        y: baseY,
        width: 360,
        height: 64,
        rotate: 0,
        opacity: 1,
        color: "#0f172a",
        fontSize: 40,
        fontWeight: 700,
      },
      animations: [],
    };
  }

  if (type === "image") {
    return {
      id,
      type,
      name: `图像元素 ${elementIndex + 1}`,
      content: "IMAGE",
      style: {
        x: position?.x ?? 520,
        y: position?.y ?? 180,
        width: 260,
        height: 160,
        rotate: 0,
        opacity: 1,
        backgroundColor: "#dcfce7",
        color: "#16a34a",
        fontSize: 36,
        fontWeight: 800,
        borderRadius: 28,
      },
      animations: [],
    };
  }

  if (type === "video") {
    return {
      id,
      type,
      name: `视频元素 ${elementIndex + 1}`,
      content: "VIDEO",
      media: {
        startBehavior: "manual",
        loop: false,
        muted: false,
        volume: 1,
      },
      style: {
        x: position?.x ?? 380,
        y: position?.y ?? 180,
        width: 520,
        height: 292,
        rotate: 0,
        opacity: 1,
        backgroundColor: "#020617",
        borderRadius: 12,
      },
      animations: [],
    };
  }

  if (type === "audio") {
    return {
      id,
      type,
      name: `音频元素 ${elementIndex + 1}`,
      content: "AUDIO",
      media: {
        startBehavior: "manual",
        loop: false,
        muted: false,
        volume: 1,
      },
      style: {
        x: position?.x ?? 430,
        y: position?.y ?? 310,
        width: 420,
        height: 88,
        rotate: 0,
        opacity: 1,
        backgroundColor: "#f8fafc",
        borderRadius: 16,
      },
      animations: [],
    };
  }

  if (type === "svg") {
    return {
      id,
      type,
      name: `SVG 元素 ${elementIndex + 1}`,
      content: "SVG",
      style: {
        x: position?.x ?? 580,
        y: position?.y ?? 380,
        width: 220,
        height: 140,
        rotate: 0,
        opacity: 1,
        backgroundColor: "#fef3c7",
        color: "#d97706",
        fontSize: 36,
        fontWeight: 800,
        borderRadius: 28,
      },
      animations: [],
    };
  }

  return {
    id,
    type,
    name: `形状元素 ${elementIndex + 1}`,
    content: "SHAPE",
    style: {
      x: position?.x ?? 760,
      y: position?.y ?? 180,
      width: 240,
      height: 150,
      rotate: 0,
      opacity: 1,
      backgroundColor: "#ede9fe",
      color: "#7c3aed",
      fontSize: 34,
      fontWeight: 800,
      borderRadius: 28,
    },
    animations: [],
  };
}

function clampPosition(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function loadSavedProject(): PresentationProject {
  pendingLegacyAssetSources.clear();

  const savedProject = localStorage.getItem(STORAGE_KEY);

  if (!savedProject) {
    return normalizeProjectAnimationScenes(demoProject);
  }

  try {
    const parsedProject = JSON.parse(savedProject) as LegacyPresentationProject;

    const normalizedAssets: Record<string, PresentationAsset> = {};

    for (const [assetId, legacyAsset] of Object.entries(
      parsedProject.assets ?? {},
    )) {
      const { source, ...assetMetadata } = legacyAsset;

      if (typeof source === "string" && source.length > 0) {
        pendingLegacyAssetSources.set(assetId, source);
      }

      normalizedAssets[assetId] = {
        ...assetMetadata,
        id: assetMetadata.id || assetId,
      };
    }

    const normalizedProject: PresentationProject = {
      ...parsedProject,
      assets: normalizedAssets,
      slides: normalizeSlideTitles(parsedProject.slides),
    };

    return normalizeProjectAnimationScenes(normalizedProject);
  } catch {
    return normalizeProjectAnimationScenes(demoProject);
  }
}

function isDefaultPageTitle(title: string) {
  return /^第\s*\d+\s*页$/.test(title);
}

function normalizeSlideTitles(slides: PresentationProject["slides"]) {
  return slides.map((slide, index) => {
    if (!isDefaultPageTitle(slide.title)) {
      return slide;
    }

    const nextTitle = `第 ${index + 1} 页`;

    if (slide.title === nextTitle) {
      return slide;
    }

    return {
      ...slide,
      title: nextTitle,
    };
  });
}

function createBlankSlide(
  slideNumber: number,
): PresentationProject["slides"][number] {
  const now = Date.now();
  const slideId = `slide-${now}`;

  return {
    id: slideId,
    title: `第 ${slideNumber} 页`,
    backgroundColor: "#f8fafc",
    animationScene: createEmptyAnimationScene(),
    elements: [
      {
        id: `element-title-${now}`,
        type: "text",
        name: "标题",
        content: "双击编辑标题",
        style: {
          x: 130,
          y: 180,
          width: 1020,
          height: 96,
          rotate: 0,
          opacity: 1,
          color: "#0f172a",
          fontSize: 64,
          fontWeight: 800,
        },
        animations: [],
      },
      {
        id: `element-subtitle-${now}`,
        type: "text",
        name: "副标题",
        content: "双击编辑副标题",
        style: {
          x: 220,
          y: 320,
          width: 840,
          height: 64,
          rotate: 0,
          opacity: 1,
          color: "#475569",
          fontSize: 36,
          fontWeight: 500,
        },
        animations: [],
      },
    ],
  };
}

function duplicateSlide(
  slide: PresentationProject["slides"][number],
  slideNumber: number,
): PresentationProject["slides"][number] {
  const now = Date.now();
  const duplicatedSlideId = `slide-copy-${now}`;

  const duplicatedElements = slide.elements.map((element, elementIndex) => ({
    ...element,
    id: `${element.id}-copy-${now}-${elementIndex}`,

    media: element.media
      ? {
          ...element.media,
        }
      : undefined,

    style: {
      ...element.style,
    },
    animations: element.animations.map((animation, animationIndex) => ({
      ...animation,
      id: `${animation.id}-copy-${now}-${elementIndex}-${animationIndex}`,
    })),
  }));

  return {
    ...slide,
    id: duplicatedSlideId,
    title: `第 ${slideNumber} 页`,
    elements: duplicatedElements,

    /**
     * Rebuild the V2 scene so every animation target points to the duplicated
     * element IDs instead of the original slide elements.
     */
    animationScene: createAnimationSceneFromLegacyElements(
      duplicatedSlideId,
      duplicatedElements,
    ),
  };
}

function cloneProjectSnapshot(project: PresentationProject) {
  return JSON.parse(JSON.stringify(project)) as PresentationProject;
}

/**
 * Clone an element for duplicate or paste operations.
 *
 * The copied element keeps assetId, so images reuse the same asset record
 * instead of duplicating large image data.
 */
function cloneSlideElementForInsert(
  sourceElement: SlideElement,
  newElementId: string,
  now: number,
  nameSuffix: string,
): SlideElement {
  return {
    ...sourceElement,
    id: newElementId,
    name: `${sourceElement.name} ${nameSuffix}`,

    media: sourceElement.media
      ? {
          ...sourceElement.media,
        }
      : undefined,

    style: {
      ...sourceElement.style,
      x: sourceElement.style.x + 32,
      y: sourceElement.style.y + 32,
    },
    animations: sourceElement.animations.map((animation, animationIndex) => ({
      ...animation,
      id: `${animation.id}-${nameSuffix}-${now}-${animationIndex}`,
    })),
  };
}

/**
 * Deep-clone an Animation Schema V2 scene before clipboard operations modify it.
 */
function cloneAnimationSceneSnapshot(scene: AnimationScene) {
  return JSON.parse(JSON.stringify(scene)) as AnimationScene;
}

/**
 * Resolve a local file into Animify's persistent resource category.
 *
 * MIME type is preferred, but some browsers and operating systems return an
 * empty or generic MIME type for formats such as FLV. File-extension fallback
 * keeps those resources importable without weakening the asset category model.
 */
function getPresentationAssetType(file: File): PresentationAssetType | null {
  if (file.type.startsWith("image/")) {
    return "image";
  }

  if (file.type.startsWith("video/")) {
    return "video";
  }

  if (file.type.startsWith("audio/")) {
    return "audio";
  }

  const fileName = file.name.toLowerCase();

  const extension = fileName.includes(".") ? fileName.split(".").pop() : "";

  const imageExtensions = new Set([
    "png",
    "jpg",
    "jpeg",
    "gif",
    "webp",
    "bmp",
    "svg",
    "avif",
  ]);

  const videoExtensions = new Set([
    "mp4",
    "webm",
    "mov",
    "m4v",
    "avi",
    "mkv",
    "flv",
    "wmv",
  ]);

  const audioExtensions = new Set([
    "mp3",
    "wav",
    "ogg",
    "m4a",
    "aac",
    "flac",
    "opus",
  ]);

  if (extension && imageExtensions.has(extension)) {
    return "image";
  }

  if (extension && videoExtensions.has(extension)) {
    return "video";
  }

  if (extension && audioExtensions.has(extension)) {
    return "audio";
  }

  return null;
}

/**
 * Read the natural image size and scale it into a comfortable canvas size.
 *
 * The image keeps its original aspect ratio. Large images are scaled down so
 * they fit the slide better, while small images keep their real size instead
 * of being stretched.
 */
function getImageDisplaySize(source: string) {
  return new Promise<{ width: number; height: number }>((resolve, reject) => {
    const image = new Image();

    image.onload = () => {
      const naturalWidth = image.naturalWidth || 420;
      const naturalHeight = image.naturalHeight || 260;
      const maxWidth = 520;
      const maxHeight = 360;
      const scale = Math.min(
        maxWidth / naturalWidth,
        maxHeight / naturalHeight,
        1,
      );

      resolve({
        width: Math.round(naturalWidth * scale),
        height: Math.round(naturalHeight * scale),
      });
    };

    image.onerror = () => {
      reject(new Error("Failed to read image size."));
    };

    image.src = source;
  });
}

/**
 * Read native video dimensions and scale the video into a comfortable canvas
 * size without stretching small media unnecessarily.
 */
function getVideoDisplaySize(source: string) {
  return new Promise<{
    width: number;
    height: number;
  }>((resolve, reject) => {
    const video =
      document.createElement("video");

    video.preload = "metadata";

    video.onloadedmetadata = () => {
      const naturalWidth =
        video.videoWidth || 640;

      const naturalHeight =
        video.videoHeight || 360;

      const maxWidth = 640;
      const maxHeight = 360;

      const scale = Math.min(
        maxWidth / naturalWidth,
        maxHeight / naturalHeight,
        1,
      );

      resolve({
        width: Math.round(
          naturalWidth * scale,
        ),
        height: Math.round(
          naturalHeight * scale,
        ),
      });
    };

    video.onerror = () => {
      reject(
        new Error(
          "Failed to read video metadata.",
        ),
      );
    };

    video.src = source;
    video.load();
  });
}

function App() {
  const [project, setProject] = useState<PresentationProject>(loadSavedProject);
  const latestProjectRef = useRef(project);
  const [mode, setMode] = useState<EditorMode>("edit");
  const [componentPanelOpen, setComponentPanelOpen] = useState(false);

  /**
   * Keep the existing expanded/collapsed panel behavior while allowing the same
   * left-side workspace to switch between components and reusable project assets.
   */
  const [leftPanelMode, setLeftPanelMode] =
    useState<LeftPanelMode>("components");

  const [animationPreviewKey, setAnimationPreviewKey] = useState(0);

  const [animationClipPreview, setAnimationClipPreview] =
    useState<AnimationClipPreviewState | null>(null);

  const [presentToolbarOpen, setPresentToolbarOpen] = useState(false);
  const [propertyPanelOpen, setPropertyPanelOpen] = useState(true);

  /**
   * Runtime Blob URLs used by canvas, thumbnails, and presentation preview.
   *
   * These URLs are temporary browser-session values and never enter the project
   * JSON or undo history.
   */
  const [assetSources, setAssetSources] = useState<Record<string, string>>({});

  /**
   * Asset metadata may survive while its IndexedDB Blob is missing.
   *
   * Keep that condition explicit so the canvas and future resource center can
   * distinguish a broken resource from an ordinary text element.
   */
  const [missingAssetIds, setMissingAssetIds] = useState<string[]>([]);

  const [assetStoreReady, setAssetStoreReady] = useState(false);

  /**
   * Files waiting for an explicit duplicate-resource decision.
   *
   * The File itself stays only in transient React state. It must not enter
   * IndexedDB or project.assets until the user chooses "keep duplicate".
   */
  const [duplicateReviewQueue, setDuplicateReviewQueue] = useState<
    PendingDuplicateResource[]
  >([]);

  const duplicateReviewQueueRef = useRef<PendingDuplicateResource[]>([]);

  const duplicateReviewActiveRef = useRef(false);

  /**
   * Request the Resource Center to reveal and highlight one exact asset.
   *
   * requestId lets the same resource be located repeatedly.
   */
  const [resourceFocusRequest, setResourceFocusRequest] = useState<{
    assetId: string;
    requestId: number;
  } | null>(null);

  const isDuplicateReviewActive = duplicateReviewQueue.length > 0;

  const activeDuplicateReview = duplicateReviewQueue[0];

  /**
   * Decide whether the advanced animation workspace is permanently visible in
   * animation mode or opened only when detailed editing is requested.
   */
  const [animationWorkspaceDisplayMode, setAnimationWorkspaceDisplayMode] =
    useState<AnimationWorkspaceDisplayMode>(loadAnimationWorkspaceDisplayMode);

  /**
   * In on-demand mode this stores whether the user explicitly opened the advanced
   * workspace. Always mode ignores this flag because visibility is persistent.
   */
  const [animationPanelOpen, setAnimationPanelOpen] = useState(false);

  /**
   * The Clip currently selected across every animation editor.
   *
   * The project remains the source of truth. This state stores only navigation
   * information shared by the property panel, timeline, and track inspector.
   */
  const [activeAnimationContext, setActiveAnimationContext] =
    useState<ActiveAnimationContext | null>(null);

  const [elementContextMenu, setElementContextMenu] =
    useState<ElementContextMenuState>(null);
  const [canvasContextMenu, setCanvasContextMenu] =
    useState<CanvasContextMenuState>(null);
  const undoStackRef = useRef<PresentationProject[]>([]);
  const redoStackRef = useRef<PresentationProject[]>([]);
  const historyGroupSnapshotRef = useRef<PresentationProject | null>(null);
  const historyGroupChangedRef = useRef(false);

  /**
   * Keep outside animation-navigation requests increasing even after the active
   * Clip is cleared by a normal canvas or slide selection.
   */
  const animationContextRequestCounterRef = useRef(0);

  const slideSurfaceRef = useRef<HTMLDivElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);

  /**
   * Resource Center import is separate from the component-library image picker:
   * it stores files in the project library without automatically creating canvas
   * elements.
   */
  const resourceInputRef = useRef<HTMLInputElement | null>(null);

  /**
   * Relinking writes a new Blob under an existing asset ID so every element using
   * that resource recovers automatically.
   */
  const relinkInputRef = useRef<HTMLInputElement | null>(null);

  const pendingRelinkAssetIdRef = useRef<string | null>(null);

  const canvasAreaRef = useRef<HTMLDivElement | null>(null);

  /**
   * Keep the latest runtime URL map available for cleanup without reading a Ref
   * during render.
   */
  const assetSourcesRef = useRef<Record<string, string>>({});

  /**
   * Store elements copied with Ctrl + C or the context menu.
   *
   * The clipboard stores one or more slide elements. Image elements keep assetId,
   * so pasted images reuse the same asset record instead of duplicating image data.
   */
  const copiedElementsRef = useRef<CopiedElementClipboard | null>(null);

  /**
   * Reflect whether the internal element clipboard contains usable content.
   *
   * The actual copied elements remain in a Ref, while this State is used only
   * for rendering the enabled state of paste buttons.
   */
  const [hasCopiedElements, setHasCopiedElements] = useState(false);

  const [canvasAreaSize, setCanvasAreaSize] = useState({
    width: 0,
    height: 0,
  });
  const [presentViewportSize, setPresentViewportSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });

  const activeSlide = project.slides.find(
    (slide) => slide.id === project.activeSlideId,
  );

  const effectiveAnimationClipPreview =
    animationClipPreview &&
    activeSlide?.animationScene?.schemaVersion === 2 &&
    animationClipPreview.slideId === activeSlide.id &&
    activeSlide.animationScene.clips[animationClipPreview.clipId] &&
    isAnimationClipLiveForElements(
      activeSlide.animationScene.clips[animationClipPreview.clipId],
      activeSlide.elements,
    )
      ? animationClipPreview
      : null;

  /**
   * PlaybackController must be created before the active-slide early return so
   * React Hooks always execute in the same order.
   */
  const animationPlaybackDurationMs =
    activeSlide?.animationScene?.schemaVersion === 2
      ? Math.max(
          0,
          ...Object.values(activeSlide.animationScene.clips)
            .filter((clip) =>
              isAnimationClipLiveForElements(clip, activeSlide.elements),
            )
            .map((clip) => clip.startMs + clip.durationMs),
        )
      : 0;

  const timelinePlayback = useTimelinePlaybackController({
    slideId: project.activeSlideId,
    durationMs: animationPlaybackDurationMs,
  });

  const animationTimelineCurrentTimeMs = timelinePlayback.currentTimeMs;
  const clearTimelinePlaybackRange = timelinePlayback.clearPlaybackRange;
  const stopTimelinePlayback = timelinePlayback.stop;

  const [selectedElementId, setSelectedElementId] = useState(
    demoProject.slides[0]?.elements[0]?.id ?? "",
  );

  const [selectedElementIds, setSelectedElementIds] = useState<string[]>(() => {
    const firstElementId = demoProject.slides[0]?.elements[0]?.id ?? "";

    return firstElementId ? [firstElementId] : [];
  });

  /**
   * Elements currently enabled as property-panel operation targets.
   *
   * Canvas selection and property targets are intentionally stored separately:
   * unchecking an item in the property panel must not remove it from the canvas
   * multi-selection.
   */
  const [propertyTargetElementIds, setPropertyTargetElementIds] = useState<
    string[]
  >(() => {
    const firstElementId = demoProject.slides[0]?.elements[0]?.id ?? "";

    return firstElementId ? [firstElementId] : [];
  });

  /**
   * Keep event handlers synchronized with the latest project independently from
   * persistent saving.
   */
  useEffect(() => {
    latestProjectRef.current = project;
  }, [project]);

  /**
   * Initialize IndexedDB, migrate old Data URLs, and create runtime Blob URLs.
   */
  useEffect(() => {
    let cancelled = false;

    async function initializeAssetStore() {
      try {
        await migratePendingLegacyAssets();

        if (cancelled) {
          return;
        }

        const nextAssetSources: Record<string, string> = {};

        const nextMissingAssetIds: string[] = [];

        for (const assetId of Object.keys(
          latestProjectRef.current.assets ?? {},
        )) {
          const blob = await getAssetBlob(assetId);

          if (!blob) {
            nextMissingAssetIds.push(assetId);
            continue;
          }

          nextAssetSources[assetId] = URL.createObjectURL(blob);
        }

        if (cancelled) {
          for (const source of Object.values(nextAssetSources)) {
            URL.revokeObjectURL(source);
          }

          return;
        }

        assetSourcesRef.current = nextAssetSources;

        setAssetSources(nextAssetSources);
        setMissingAssetIds(nextMissingAssetIds);
        setAssetStoreReady(true);

        if (nextMissingAssetIds.length > 0) {
          console.warn(
            "Animify detected missing asset Blobs:",
            nextMissingAssetIds,
          );
        }
      } catch (error) {
        console.error("Failed to initialize the asset store.", error);

        if (cancelled) {
          return;
        }

        /**
         * Keep old projects visible when migration fails. Persistence remains
         * disabled so the original Data URLs are not overwritten or lost.
         */
        const fallbackSources = Object.fromEntries(pendingLegacyAssetSources);

        assetSourcesRef.current = fallbackSources;

        setAssetSources(fallbackSources);

        window.alert(
          "资源存储初始化失败。旧图片仍会临时显示，但本次项目修改不会自动保存，请刷新后重试。",
        );
      }
    }

    void initializeAssetStore();

    return () => {
      cancelled = true;

      for (const source of Object.values(assetSourcesRef.current)) {
        if (source.startsWith("blob:")) {
          URL.revokeObjectURL(source);
        }
      }

      assetSourcesRef.current = {};
    };
  }, []);

  /**
   * Save only metadata after IndexedDB initialization or migration succeeds.
   */
  useEffect(() => {
    if (!assetStoreReady) {
      return;
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
  }, [assetStoreReady, project]);

  /**
   * Persist editor UI preferences independently from the presentation project.
   */
  useEffect(() => {
    try {
      localStorage.setItem(
        ANIMATION_WORKSPACE_DISPLAY_MODE_KEY,
        animationWorkspaceDisplayMode,
      );
    } catch (error) {
      console.warn(
        "Failed to save animation workspace display preference.",
        error,
      );
    }
  }, [animationWorkspaceDisplayMode]);

  useEffect(() => {
    if (!elementContextMenu && !canvasContextMenu) {
      return;
    }

    function closeContextMenus() {
      setElementContextMenu(null);
      setCanvasContextMenu(null);
    }

    function handleContextMenuKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeContextMenus();
      }
    }

    window.addEventListener("click", closeContextMenus);
    window.addEventListener("resize", closeContextMenus);
    window.addEventListener("keydown", handleContextMenuKeyDown);

    return () => {
      window.removeEventListener("click", closeContextMenus);
      window.removeEventListener("resize", closeContextMenus);
      window.removeEventListener("keydown", handleContextMenuKeyDown);
    };
  }, [canvasContextMenu, elementContextMenu]);

  const pushUndoSnapshot = useCallback((snapshot: PresentationProject) => {
    undoStackRef.current = [
      ...undoStackRef.current,
      cloneProjectSnapshot(snapshot),
    ].slice(-MAX_HISTORY_LENGTH);

    redoStackRef.current = [];
  }, []);

  /**
   * Clip preview is transient editor state. Every navigation or project mutation
   * exits that mode before changing the underlying slide/scene data.
   */
  const clearAnimationClipPreview = useCallback(() => {
    if (!animationClipPreview) {
      return;
    }

    if (animationClipPreview.slideId === project.activeSlideId) {
      clearTimelinePlaybackRange(animationClipPreview.returnTimeMs);
    } else {
      stopTimelinePlayback();
    }

    setAnimationClipPreview(null);
  }, [
    animationClipPreview,
    project.activeSlideId,
    clearTimelinePlaybackRange,
    stopTimelinePlayback,
  ]);

  const commitProjectChange = useCallback(
    (updater: ProjectUpdater, options: { recordHistory?: boolean } = {}) => {
      /**
       * Duplicate review is a global read-only inspection context.
       */
      if (duplicateReviewActiveRef.current) {
        return;
      }

      const currentProject = latestProjectRef.current;
      const nextProject = updater(currentProject);

      if (nextProject === currentProject) {
        return;
      }

      clearAnimationClipPreview();

      if (options.recordHistory === false) {
        if (historyGroupSnapshotRef.current) {
          historyGroupChangedRef.current = true;
        } else {
          pushUndoSnapshot(currentProject);
        }
      } else {
        pushUndoSnapshot(currentProject);
      }

      latestProjectRef.current = nextProject;
      setProject(nextProject);
    },
    [clearAnimationClipPreview, pushUndoSnapshot],
  );

  const beginProjectHistoryGroup = useCallback(() => {
    if (historyGroupSnapshotRef.current) {
      return;
    }

    historyGroupSnapshotRef.current = cloneProjectSnapshot(
      latestProjectRef.current,
    );
    historyGroupChangedRef.current = false;
  }, []);

  const finishProjectHistoryGroup = useCallback(() => {
    const snapshot = historyGroupSnapshotRef.current;

    if (snapshot && historyGroupChangedRef.current) {
      pushUndoSnapshot(snapshot);
    }

    historyGroupSnapshotRef.current = null;
    historyGroupChangedRef.current = false;
  }, [pushUndoSnapshot]);

  const undoProject = useCallback(() => {
    if (duplicateReviewActiveRef.current) {
      return;
    }

    const previousProject = undoStackRef.current.at(-1);

    if (!previousProject) {
      return;
    }

    clearAnimationClipPreview();

    const currentProject = latestProjectRef.current;

    undoStackRef.current = undoStackRef.current.slice(0, -1);
    redoStackRef.current = [
      ...redoStackRef.current,
      cloneProjectSnapshot(currentProject),
    ].slice(-MAX_HISTORY_LENGTH);

    const projectToRestore = cloneProjectSnapshot(previousProject);
    const previousActiveSlide = projectToRestore.slides.find(
      (slide) => slide.id === projectToRestore.activeSlideId,
    );

    latestProjectRef.current = projectToRestore;
    setProject(projectToRestore);
    setSelectedElementId(previousActiveSlide?.elements[0]?.id ?? "");
    setAnimationPreviewKey((key) => key + 1);
  }, [
    clearAnimationClipPreview,
    setAnimationPreviewKey,
    setSelectedElementId,
  ]);

  const redoProject = useCallback(() => {
    if (duplicateReviewActiveRef.current) {
      return;
    }

    const nextProject = redoStackRef.current.at(-1);

    if (!nextProject) {
      return;
    }

    clearAnimationClipPreview();

    const currentProject = latestProjectRef.current;

    redoStackRef.current = redoStackRef.current.slice(0, -1);
    undoStackRef.current = [
      ...undoStackRef.current,
      cloneProjectSnapshot(currentProject),
    ].slice(-MAX_HISTORY_LENGTH);

    const projectToRestore = cloneProjectSnapshot(nextProject);
    const nextActiveSlide = projectToRestore.slides.find(
      (slide) => slide.id === projectToRestore.activeSlideId,
    );

    latestProjectRef.current = projectToRestore;
    setProject(projectToRestore);
    setSelectedElementId(nextActiveSlide?.elements[0]?.id ?? "");
    setAnimationPreviewKey((key) => key + 1);
  }, [
    clearAnimationClipPreview,
    setAnimationPreviewKey,
    setSelectedElementId,
  ]);

  useEffect(() => {
    function handleHistoryKeyDown(event: KeyboardEvent) {
      const target = event.target;

      /**
       * Text-editing controls keep their native undo behavior.
       *
       * Select controls are intentionally excluded because changing an animation
       * preset edits project data rather than editable text. Ctrl + Z must therefore
       * undo the project immediately while the select still has focus.
       */
      const isTextEditing =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        (target instanceof HTMLElement && target.isContentEditable);

      if (isTextEditing || mode === "present") {
        return;
      }

      const isControlKey = event.ctrlKey || event.metaKey;

      if (!isControlKey) {
        return;
      }

      const key = event.key.toLowerCase();

      if (key === "z" && event.shiftKey) {
        event.preventDefault();
        redoProject();
        return;
      }

      if (key === "z") {
        event.preventDefault();
        undoProject();
        return;
      }

      if (key === "y") {
        event.preventDefault();
        redoProject();
      }
    }

    window.addEventListener("keydown", handleHistoryKeyDown);

    return () => {
      window.removeEventListener("keydown", handleHistoryKeyDown);
    };
  }, [mode, redoProject, undoProject]);

  const handlePresentSlideStep = useCallback(
    (direction: 1 | -1) => {
      setProject((currentProject) => {
        const currentIndex = currentProject.slides.findIndex(
          (slide) => slide.id === currentProject.activeSlideId,
        );

        if (currentIndex === -1) {
          return currentProject;
        }

        const nextSlide = currentProject.slides[currentIndex + direction];

        if (!nextSlide) {
          return currentProject;
        }

        setSelectedElementId(nextSlide.elements[0]?.id ?? "");
        setAnimationPreviewKey((key) => key + 1);

        return {
          ...currentProject,
          activeSlideId: nextSlide.id,
          updatedAt: new Date().toISOString(),
        };
      });
    },
    [setSelectedElementId],
  );

  useEffect(() => {
    if (mode !== "present") {
      return;
    }

    function handlePresentKeyDown(event: KeyboardEvent) {
      const target = event.target;

      /**
       * Media controls keep their native keyboard behavior. Pressing Space while a
       * video or audio control is focused must not advance the presentation.
       */
      if (target instanceof HTMLMediaElement) {
        return;
      }

      if (
        event.key === "ArrowRight" ||
        event.key === " " ||
        event.key === "Enter" ||
        event.key === "PageDown"
      ) {
        event.preventDefault();
        handlePresentSlideStep(1);
        return;
      }

      if (event.key === "ArrowLeft" || event.key === "PageUp") {
        event.preventDefault();
        handlePresentSlideStep(-1);
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        setMode("edit");
      }
    }

    window.addEventListener("keydown", handlePresentKeyDown);

    return () => {
      window.removeEventListener("keydown", handlePresentKeyDown);
    };
  }, [handlePresentSlideStep, mode]);

  useEffect(() => {
    function updateCanvasAreaSize() {
      const canvasArea = canvasAreaRef.current;

      if (!canvasArea) {
        return;
      }

      const rect = canvasArea.getBoundingClientRect();

      setCanvasAreaSize({
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      });
    }

    updateCanvasAreaSize();

    const resizeObserver = new ResizeObserver(updateCanvasAreaSize);
    const canvasArea = canvasAreaRef.current;

    if (canvasArea) {
      resizeObserver.observe(canvasArea);
    }

    window.addEventListener("resize", updateCanvasAreaSize);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateCanvasAreaSize);
    };
  }, [mode, componentPanelOpen]);

  useEffect(() => {
    function updatePresentViewportSize() {
      setPresentViewportSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    }

    updatePresentViewportSize();

    window.addEventListener("resize", updatePresentViewportSize);

    return () => {
      window.removeEventListener("resize", updatePresentViewportSize);
    };
  }, []);

  useEffect(() => {
    if (mode === "present") {
      return;
    }

    /**
     * Handle keyboard shortcuts for the selected element.
     *
     * - Arrow keys move the element by 1px.
     * - Shift + Arrow keys move the element by 10px.
     * - Delete / Backspace removes the selected element.
     *
     * Inputs and textareas are ignored so normal typing, deleting text, and
     * editing element content are not interrupted.
     */
    function handleSelectedElementKeyDown(event: KeyboardEvent) {
      if (duplicateReviewActiveRef.current) {
        return;
      }

      const target = event.target;

      const isTyping =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target instanceof HTMLElement && target.isContentEditable);

      if (isTyping) {
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "v") {
        event.preventDefault();

        const clipboard = copiedElementsRef.current;

        const copiedElements = clipboard?.elements ?? [];

        if (!clipboard || copiedElements.length === 0) {
          return;
        }

        const now = Date.now();
        const pastedElementIds = copiedElements.map(
          (element, index) => `${element.id}-paste-${now}-${index}`,
        );

        const pastedElements = copiedElements.map((copiedElement, index) =>
          cloneSlideElementForInsert(
            copiedElement,
            pastedElementIds[index],
            now,
            "粘贴",
          ),
        );

        commitProjectChange((currentProject) => ({
          ...currentProject,
          updatedAt: new Date().toISOString(),
          slides: currentProject.slides.map((slide) => {
            if (slide.id !== currentProject.activeSlideId) {
              return slide;
            }

            const nextSlide = {
              ...slide,
              elements: [...slide.elements, ...pastedElements],
            };

            return cloneElementAnimationsToInsertedElements(
              nextSlide,
              clipboard.animationScene,
              clipboard.sourceSlideId,
              copiedElements,
              pastedElements,
              `paste-${now}`,
            );
          }),
        }));

        setSelectedElementId(pastedElementIds.at(-1) ?? "");
        setSelectedElementIds(pastedElementIds);
        setPropertyPanelOpen(pastedElementIds.length === 1);
        return;
      }

      if (selectedElementIds.length === 0) {
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "c") {
        event.preventDefault();

        const currentProject = latestProjectRef.current;
        const currentSlide = currentProject.slides.find(
          (slide) => slide.id === currentProject.activeSlideId,
        );

        if (!currentSlide) {
          return;
        }

        const selectedIdSet = new Set(selectedElementIds);
        const copiedElements = currentSlide.elements.filter((element) =>
          selectedIdSet.has(element.id),
        );

        if (copiedElements.length === 0) {
          return;
        }

        // Deep clone the copied elements so later edits to the original elements
        // will not mutate the internal clipboard copy.
        copiedElementsRef.current = {
          sourceSlideId: currentSlide.id,
          elements: JSON.parse(
            JSON.stringify(copiedElements),
          ) as SlideElement[],
          animationScene: cloneAnimationSceneSnapshot(
            currentSlide.animationScene,
          ),
        };

        setHasCopiedElements(true);
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "d") {
        event.preventDefault();

        const now = Date.now();
        const duplicateElementId = `${selectedElementId}-copy-${now}`;
        let duplicated = false;

        commitProjectChange((currentProject) => {
          const nextSlides = currentProject.slides.map((slide) => {
            if (slide.id !== currentProject.activeSlideId) {
              return slide;
            }

            const sourceElementIndex = slide.elements.findIndex(
              (element) => element.id === selectedElementId,
            );

            if (sourceElementIndex === -1) {
              return slide;
            }

            const sourceElement = slide.elements[sourceElementIndex];

            duplicated = true;

            const duplicateElement: SlideElement = {
              ...sourceElement,
              id: duplicateElementId,
              name: `${sourceElement.name} 副本`,
              style: {
                ...sourceElement.style,
                x: sourceElement.style.x + 32,
                y: sourceElement.style.y + 32,
              },
              animations: sourceElement.animations.map(
                (animation, animationIndex) => ({
                  ...animation,
                  id: `${animation.id}-copy-${now}-${animationIndex}`,
                }),
              ),
            };

            const nextElements = [
              ...slide.elements.slice(0, sourceElementIndex + 1),
              duplicateElement,
              ...slide.elements.slice(sourceElementIndex + 1),
            ];

            const nextSlide = {
              ...slide,
              elements: nextElements,
            };

            /**
             * Ctrl + D duplicates both the visual element and every exact V2 Clip targeting
             * it. The original timing is preserved and the new Clips target only the copy.
             */
            return cloneElementAnimationsToInsertedElements(
              nextSlide,
              slide.animationScene,
              slide.id,
              [sourceElement],
              [duplicateElement],
              `duplicate-${now}`,
            );
          });

          if (!duplicated) {
            return currentProject;
          }

          return {
            ...currentProject,
            updatedAt: new Date().toISOString(),
            slides: nextSlides,
          };
        });

        if (duplicated) {
          setSelectedElementId(duplicateElementId);
        }

        return;
      }

      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();

        commitProjectChange((currentProject) => ({
          ...currentProject,
          updatedAt: new Date().toISOString(),
          slides: currentProject.slides.map((slide) => {
            if (slide.id !== currentProject.activeSlideId) {
              return slide;
            }

            return {
              ...slide,
              elements: slide.elements.filter(
                (element) => !selectedElementIds.includes(element.id),
              ),
            };
          }),
        }));

        setSelectedElementId("");
        setSelectedElementIds([]);
        return;
      }

      const step = event.shiftKey ? 10 : 1;
      let deltaX = 0;
      let deltaY = 0;

      if (event.key === "ArrowLeft") {
        deltaX = -step;
      } else if (event.key === "ArrowRight") {
        deltaX = step;
      } else if (event.key === "ArrowUp") {
        deltaY = -step;
      } else if (event.key === "ArrowDown") {
        deltaY = step;
      } else {
        return;
      }

      event.preventDefault();

      commitProjectChange((currentProject) => {
        let moved = false;

        const nextSlides = currentProject.slides.map((slide) => {
          if (slide.id !== currentProject.activeSlideId) {
            return slide;
          }

          return {
            ...slide,
            elements: slide.elements.map((element) => {
              if (!selectedElementIds.includes(element.id)) {
                return element;
              }

              moved = true;

              return {
                ...element,
                style: {
                  ...element.style,
                  x: element.style.x + deltaX,
                  y: element.style.y + deltaY,
                },
              };
            }),
          };
        });

        if (!moved) {
          return currentProject;
        }

        return {
          ...currentProject,
          updatedAt: new Date().toISOString(),
          slides: nextSlides,
        };
      });
    }

    window.addEventListener("keydown", handleSelectedElementKeyDown);

    return () => {
      window.removeEventListener("keydown", handleSelectedElementKeyDown);
    };
  }, [commitProjectChange, mode, selectedElementId, selectedElementIds]);

  if (!activeSlide) {
    return (
      <main
        className="flex min-h-screen items-center justify-center bg-slate-100 text-slate-950"
        onClick={() => handlePresentSlideStep(1)}
      >
        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <h1 className="text-2xl font-bold">没有找到当前演示页面</h1>
          <p className="mt-2 text-slate-500">
            请检查 project.activeSlideId 是否与 slides 中的页面 id 一致。
          </p>
        </div>
      </main>
    );
  }
  const presentScale = Math.min(
    presentViewportSize.width / project.width,
    presentViewportSize.height / project.height,
  );
  const presentSlideWidth = project.width * presentScale;
  const presentSideGap = Math.max(
    0,
    (presentViewportSize.width - presentSlideWidth) / 2,
  );

  const presentControlWidth = 112;

  const presentControlRight =
    presentSideGap > presentControlWidth + 16
      ? Math.round((presentSideGap - presentControlWidth) / 2)
      : 12;

  if (mode === "present") {
    return (
      <main
        className="relative h-screen w-screen overflow-hidden bg-slate-950 text-white"
        onClick={() => handlePresentSlideStep(1)}
      >
        <section className="absolute inset-0 flex items-center justify-center">
          {/* Present mode reuses SlideCanvas without editor chrome.
    Pass project.assets so image elements can resolve assetId into real image data
    instead of showing the image file name. */}
          <SlideCanvas
            slide={activeSlide}
            assets={project.assets}
            assetSources={assetSources}
            assetStoreReady={assetStoreReady}
            missingAssetIds={missingAssetIds}
            scale={presentScale}
            animationPreviewKey={animationPreviewKey}
            chrome={false}
            clipOverflow={true}
            bare={true}
          />
        </section>

        <div
          className="fixed top-4 z-50 flex flex-col items-end"
          style={{ right: presentControlRight }}
          onClick={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            className={`flex h-12 w-12 items-center justify-center rounded-full border border-white/30 bg-white/20 text-white shadow-2xl backdrop-blur-md transition hover:scale-105 hover:bg-white/30 ${
              presentToolbarOpen ? "bg-violet-500/80" : ""
            }`}
            onClick={() => setPresentToolbarOpen((open) => !open)}
            aria-label="打开放映控制"
            title="放映控制"
          >
            <span className="h-3 w-3 rounded-full bg-white shadow-sm" />
          </button>

          {presentToolbarOpen ? (
            <div className="mt-3 flex w-32 flex-col gap-2 rounded-2xl bg-slate-950/95 p-2 shadow-xl ring-1 ring-white/10 backdrop-blur">
              <div className="px-1 pb-1">
                <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-violet-300">
                  ANIMIFY
                </p>
                <h1 className="mt-1 text-sm font-bold text-white">放映模式</h1>
              </div>

              <button
                type="button"
                className="rounded-full bg-white px-3 py-2 text-xs font-semibold text-slate-900 shadow-sm transition hover:bg-slate-100"
                onClick={() => setMode("edit")}
              >
                退出放映
              </button>

              <button
                type="button"
                className="rounded-full bg-violet-500 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-violet-600"
                onClick={() => setAnimationPreviewKey((key) => key + 1)}
              >
                重新播放
              </button>
            </div>
          ) : null}
        </div>
      </main>
    );
  }

  const selectedElement = selectedElementId
    ? activeSlide.elements.find((element) => element.id === selectedElementId)
    : undefined;

  /**
   * Preserve selectedElementIds order so canvas number badges and the property
   * panel element list always use the same numbering.
   */
  const selectedElements = selectedElementIds.flatMap((elementId) => {
    const element = activeSlide.elements.find((item) => item.id === elementId);

    return element ? [element] : [];
  });

  const validPropertyTargetElementIds = propertyTargetElementIds.filter(
    (elementId) => selectedElementIds.includes(elementId),
  );

  /**
   * New selections default to targeting every selected element.
   *
   * This fallback also keeps paste, duplicate, undo, and slide-switch workflows
   * safe even when they change selectedElementIds directly.
   */
  const effectivePropertyTargetElementIds =
    validPropertyTargetElementIds.length > 0
      ? validPropertyTargetElementIds
      : selectedElementIds;

  const showPropertyPanel = propertyPanelOpen && selectedElements.length > 0;

  const activeSlideElementCount = activeSlide.elements.length;

  const activeAnimationScene = activeSlide.animationScene;

  /**
   * The lower timeline reads Animation Schema V2 directly rather than the
   * temporary element.animations compatibility array.
   */
  const activeSlideTimelineClips =
    activeAnimationScene?.schemaVersion === 2
      ? Object.values(activeAnimationScene.clips)
          .filter((clip) =>
            isAnimationClipLiveForElements(clip, activeSlide.elements),
          )
          .sort(
            (left, right) =>
              left.startMs - right.startMs ||
              left.name.localeCompare(right.name),
          )
      : [];

  /**
   * Keep stale UI selection harmless after delete, undo, redo, or slide changes.
   *
   * The original context is retained in State so undo can restore the same Clip,
   * while editors receive only a context that is valid for the active slide.
   */
  const effectiveActiveAnimationContext =
    activeAnimationContext &&
    activeAnimationScene?.schemaVersion === 2 &&
    activeAnimationScene.clips[activeAnimationContext.clipId]?.targets.some(
      (target) => target.elementId === activeAnimationContext.elementId,
    )
      ? activeAnimationContext
      : null;

  const selectedClipPreviewWindow = effectiveActiveAnimationContext
    ? getAnimationClipPreviewWindow(
        activeAnimationScene,
        effectiveActiveAnimationContext.clipId,
      )
    : null;

  const selectedClipPreviewStatus =
    effectiveAnimationClipPreview && selectedClipPreviewWindow
      ? timelinePlayback.status === "paused" &&
        animationTimelineCurrentTimeMs >= selectedClipPreviewWindow.endTimeMs
        ? "idle"
        : timelinePlayback.status
      : undefined;

  const slideCanvasHorizontalChrome = mode === "animation" ? 96 : 88;
  const slideCanvasVerticalChrome = mode === "animation" ? 142 : 132;

  const availableCanvasWidth = Math.max(
    1,
    canvasAreaSize.width - slideCanvasHorizontalChrome,
  );

  const availableCanvasHeight = Math.max(
    1,
    canvasAreaSize.height - slideCanvasVerticalChrome,
  );

  const widthFitScale = availableCanvasWidth / project.width;
  const heightFitScale = availableCanvasHeight / project.height;

  const fitScale = Math.min(widthFitScale, heightFitScale);

  const maxCanvasScale = mode === "animation" ? 0.72 : 0.88;
  const fallbackCanvasScale = mode === "animation" ? 0.58 : 0.68;

  const canvasScale = Number.isFinite(fitScale)
    ? Math.max(0.24, Math.min(maxCanvasScale, fitScale))
    : fallbackCanvasScale;

  function handleAddElement(
    type: SlideElementType,
    position?: { x: number; y: number },
  ) {
    const newElement = createSlideElement(
      type,
      activeSlideElementCount,
      position,
    );

    commitProjectChange((currentProject) => ({
      ...currentProject,
      updatedAt: new Date().toISOString(),
      slides: currentProject.slides.map((slide) => {
        if (slide.id !== currentProject.activeSlideId) {
          return slide;
        }

        return {
          ...slide,
          elements: [...slide.elements, newElement],
        };
      }),
    }));

    setSelectedElementId(newElement.id);
    setSelectedElementIds([newElement.id]);
  }

  /**
   * Open the hidden image file input from a normal toolbar button.
   */
  function handleOpenImagePicker() {
    if (duplicateReviewActiveRef.current) {
      return;
    }

    if (!assetStoreReady) {
      window.alert("资源存储正在初始化，请稍后再添加图片。");
      return;
    }

    imageInputRef.current?.click();
  }

  /**
   * Replace the duplicate-review queue while keeping the mutation guard Ref in
   * sync with React rendering state.
   */
  function replaceDuplicateReviewQueue(nextQueue: PendingDuplicateResource[]) {
    duplicateReviewQueueRef.current = nextQueue;

    duplicateReviewActiveRef.current = nextQueue.length > 0;

    setDuplicateReviewQueue(nextQueue);
  }

  /**
   * Advance to the next unresolved duplicate candidate.
   */
  function finishCurrentDuplicateReview() {
    const nextQueue = duplicateReviewQueueRef.current.slice(1);

    replaceDuplicateReviewQueue(nextQueue);
  }

  /**
   * Merge resource metadata into the live project and every history snapshot.
   *
   * Resource persistence is independent from ordinary canvas undo, so an
   * unrelated Ctrl+Z must never discard a verified hash or imported asset.
   */
  function mergePersistentAssetMetadata(
    assetUpdates: Record<string, PresentationAsset>,
    updatedAt = new Date().toISOString(),
  ) {
    if (Object.keys(assetUpdates).length === 0) {
      return;
    }

    function mergeAssets(sourceProject: PresentationProject) {
      return {
        ...sourceProject,

        assets: {
          ...sourceProject.assets,
          ...assetUpdates,
        },
      };
    }

    undoStackRef.current = undoStackRef.current.map(mergeAssets);

    redoStackRef.current = redoStackRef.current.map(mergeAssets);

    if (historyGroupSnapshotRef.current) {
      historyGroupSnapshotRef.current = mergeAssets(
        historyGroupSnapshotRef.current,
      );
    }

    const nextProject = {
      ...mergeAssets(latestProjectRef.current),

      updatedAt,
    };

    latestProjectRef.current = nextProject;

    clearAnimationClipPreview();
    setProject(nextProject);
  }

  /**
   * Older Animify projects do not contain content hashes.
   *
   * Backfill fingerprints lazily only when duplicate detection is actually needed.
   * Missing resource Blobs are skipped because they cannot be fingerprinted.
   */
  async function ensureProjectAssetContentHashes() {
    const currentProject = latestProjectRef.current;

    const updates: Record<string, PresentationAsset> = {};

    for (const asset of Object.values(currentProject.assets)) {
      if (asset.contentHash) {
        continue;
      }

      const blob = await getAssetBlob(asset.id);

      if (!blob) {
        continue;
      }

      updates[asset.id] = {
        ...asset,

        contentHash: await computeBlobSha256(blob),
      };
    }

    mergePersistentAssetMetadata(updates);

    return latestProjectRef.current.assets;
  }

  /**
   * Open the Resource Center importer.
   *
   * Imported files become reusable project assets. Unlike the image component
   * picker, this action does not automatically insert anything onto the slide.
   */
  function handleOpenResourcePicker() {
    if (duplicateReviewActiveRef.current) {
      return;
    }

    if (!assetStoreReady) {
      window.alert("资源存储正在初始化，请稍后再上传资源。");
      return;
    }

    resourceInputRef.current?.click();
  }

  /**
   * Import images, videos, and audio files into the reusable project resource
   * library without creating slide elements.
   */
  async function handleResourceFilesChange(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const selectedFiles = Array.from(event.target.files ?? []);

    event.target.value = "";

    if (duplicateReviewActiveRef.current) {
      return;
    }

    if (selectedFiles.length === 0) {
      return;
    }

    if (!assetStoreReady) {
      window.alert("资源存储尚未准备完成，请稍后重试。");

      return;
    }

    const supportedFiles = selectedFiles.flatMap((file) => {
      const assetType = getPresentationAssetType(file);

      return assetType
        ? [
            {
              file,
              assetType,
            },
          ]
        : [];
    });

    if (supportedFiles.length === 0) {
      window.alert("请选择图片、视频或音频文件。");

      return;
    }

    const storedAssetIds: string[] = [];

    const createdObjectUrls: string[] = [];

    try {
      /**
       * Hash existing legacy assets before comparing the incoming files.
       */
      const existingAssets = await ensureProjectAssetContentHashes();

      const knownAssetIdByHash = new Map<string, string>();

      for (const asset of Object.values(existingAssets)) {
        if (asset.contentHash) {
          knownAssetIdByHash.set(asset.contentHash, asset.id);
        }
      }

      const timestamp = Date.now();

      const createdAt = new Date().toISOString();

      const uniqueCandidates: Array<{
        file: File;
        assetType: PresentationAssetType;
        contentHash: string;
        assetId: string;
      }> = [];

      const duplicateCandidates: Array<
        Omit<PendingDuplicateResource, "reviewIndex" | "reviewTotal">
      > = [];

      /**
       * Hash every selected file before writing anything to IndexedDB.
       */
      for (let index = 0; index < supportedFiles.length; index += 1) {
        const { file, assetType } = supportedFiles[index];

        const contentHash = await computeBlobSha256(file);

        const duplicateAssetId = knownAssetIdByHash.get(contentHash);

        if (duplicateAssetId) {
          duplicateCandidates.push({
            id: `duplicate-review-${timestamp}-${index}`,
            file,
            assetType,
            contentHash,
            duplicateAssetId,
          });

          continue;
        }

        const assetId = `asset-${assetType}-${timestamp}-${index}`;

        /**
         * Remember this candidate immediately so another file in the same picker
         * batch can be recognized as its duplicate.
         */
        knownAssetIdByHash.set(contentHash, assetId);

        uniqueCandidates.push({
          file,
          assetType,
          contentHash,
          assetId,
        });
      }

      /**
       * Only genuinely unique files are persisted immediately.
       */
      const importedItems: Array<{
        asset: PresentationAsset;
        objectUrl: string;
      }> = [];

      for (const candidate of uniqueCandidates) {
        const storedBlob = await putVerifiedAssetBlob(
          candidate.assetId,
          candidate.file,
        );

        storedAssetIds.push(candidate.assetId);

        const objectUrl = URL.createObjectURL(storedBlob);

        createdObjectUrls.push(objectUrl);

        importedItems.push({
          asset: {
            id: candidate.assetId,
            type: candidate.assetType,

            name: candidate.file.name || `未命名${candidate.assetType}`,

            mimeType: candidate.file.type || `${candidate.assetType}/*`,

            size: candidate.file.size,

            createdAt,

            contentHash: candidate.contentHash,
          },

          objectUrl,
        });
      }

      if (importedItems.length > 0) {
        const newAssets = Object.fromEntries(
          importedItems.map(({ asset }) => [asset.id, asset]),
        );

        mergePersistentAssetMetadata(newAssets, createdAt);

        const importedSources = Object.fromEntries(
          importedItems.map(({ asset, objectUrl }) => [asset.id, objectUrl]),
        );

        setAssetSources((currentSources) => {
          const nextSources = {
            ...currentSources,
            ...importedSources,
          };

          assetSourcesRef.current = nextSources;

          return nextSources;
        });

        const importedAssetIdSet = new Set(
          importedItems.map(({ asset }) => asset.id),
        );

        setMissingAssetIds((currentMissingAssetIds) =>
          currentMissingAssetIds.filter(
            (assetId) => !importedAssetIdSet.has(assetId),
          ),
        );
      }

      if (duplicateCandidates.length > 0) {
        const reviewTotal = duplicateCandidates.length;

        const reviewQueue = duplicateCandidates.map((candidate, index) => ({
          ...candidate,

          reviewIndex: index + 1,

          reviewTotal,
        }));

        /**
         * Duplicate candidates remain only as temporary File objects at this point.
         * None of them has entered project.assets or IndexedDB.
         */
        replaceDuplicateReviewQueue(reviewQueue);

        clearAnimationClipPreview();
        setMode("edit");

        setAnimationPanelOpen(false);

        setElementContextMenu(null);

        setCanvasContextMenu(null);
      }
    } catch (error) {
      console.error("Failed to import project resources.", error);

      for (const objectUrl of createdObjectUrls) {
        URL.revokeObjectURL(objectUrl);
      }

      await Promise.allSettled(
        storedAssetIds.map((assetId) => deleteAssetBlob(assetId)),
      );

      window.alert("资源导入失败，本次尚未完成的资源已安全回滚。");
    }
  }

  function handleLocateExistingDuplicateResource() {
    const currentReview = duplicateReviewQueueRef.current[0];

    if (!currentReview) {
      return;
    }

    /**
     * Keep the duplicate-review window open while revealing the existing asset.
     */
    setLeftPanelMode("assets");
    setComponentPanelOpen(true);

    setResourceFocusRequest((currentRequest) => ({
      assetId: currentReview.duplicateAssetId,

      requestId: (currentRequest?.requestId ?? 0) + 1,
    }));
  }

  function handleUseExistingDuplicateResource() {
    handleLocateExistingDuplicateResource();

    finishCurrentDuplicateReview();
  }

  async function handleKeepDuplicateResource() {
    const currentReview = duplicateReviewQueueRef.current[0];

    if (!currentReview) {
      return;
    }

    const suffix = Math.random().toString(36).slice(2, 8);

    const assetId = `asset-${currentReview.assetType}-${Date.now()}-${suffix}`;

    let objectUrl: string | null = null;

    try {
      const storedBlob = await putVerifiedAssetBlob(
        assetId,
        currentReview.file,
      );

      objectUrl = URL.createObjectURL(storedBlob);

      const asset: PresentationAsset = {
        id: assetId,

        type: currentReview.assetType,

        name: currentReview.file.name || `未命名${currentReview.assetType}`,

        mimeType: currentReview.file.type || `${currentReview.assetType}/*`,

        size: currentReview.file.size,

        createdAt: new Date().toISOString(),

        /**
         * Intentionally preserve the same fingerprint. The user explicitly chose
         * to keep two metadata entries pointing to identical binary contents.
         */
        contentHash: currentReview.contentHash,
      };

      mergePersistentAssetMetadata({
        [asset.id]: asset,
      });

      setAssetSources((currentSources) => {
        const nextSources = {
          ...currentSources,
          [asset.id]: objectUrl as string,
        };

        assetSourcesRef.current = nextSources;

        return nextSources;
      });

      setMissingAssetIds((currentMissingAssetIds) =>
        currentMissingAssetIds.filter(
          (missingAssetId) => missingAssetId !== asset.id,
        ),
      );

      finishCurrentDuplicateReview();
    } catch (error) {
      console.error("Failed to keep duplicate resource.", error);

      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }

      await Promise.allSettled([deleteAssetBlob(assetId)]);

      window.alert("重复资源保留失败，请稍后重试。");
    }
  }

  function handleSkipDuplicateResource() {
    finishCurrentDuplicateReview();
  }

  /**
   * Open a file picker for one missing project asset.
   */
  function handleOpenAssetRelink(assetId: string) {
    if (duplicateReviewActiveRef.current) {
      return;
    }

    const asset = latestProjectRef.current.assets[assetId];

    if (!asset) {
      return;
    }

    pendingRelinkAssetIdRef.current = assetId;

    relinkInputRef.current?.click();
  }

  /**
   * Restore one missing resource by writing a verified Blob under its existing
   * asset ID. Every slide element referencing that ID recovers automatically.
   */
  async function handleRelinkAssetFileChange(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];

    event.target.value = "";

    const assetId = pendingRelinkAssetIdRef.current;

    pendingRelinkAssetIdRef.current = null;

    if (!file || !assetId) {
      return;
    }

    const asset = latestProjectRef.current.assets[assetId];

    if (!asset) {
      return;
    }

    const selectedAssetType = getPresentationAssetType(file);

    if (selectedAssetType !== asset.type) {
      window.alert(`请选择与原资源相同类型的文件。当前资源类型：${asset.type}`);
      return;
    }

    try {
      const storedBlob = await putVerifiedAssetBlob(assetId, file);

      const objectUrl = URL.createObjectURL(storedBlob);

      const previousSource = assetSourcesRef.current[assetId];

      if (previousSource?.startsWith("blob:")) {
        URL.revokeObjectURL(previousSource);
      }

      setAssetSources((currentSources) => {
        const nextSources = {
          ...currentSources,
          [assetId]: objectUrl,
        };

        assetSourcesRef.current = nextSources;

        return nextSources;
      });

      setMissingAssetIds((currentMissingAssetIds) =>
        currentMissingAssetIds.filter(
          (missingAssetId) => missingAssetId !== assetId,
        ),
      );
    } catch (error) {
      console.error("Failed to relink asset.", error);

      window.alert("资源重新挂载失败，请检查文件后重试。");
    }
  }

  /**
   * Insert one existing reusable asset into the active slide.
   *
   * No new Blob or PresentationAsset is created. The new slide element keeps the
   * original assetId so images, videos, and audio all reuse one persistent file.
   */
  async function handleInsertExistingAsset(assetId: string) {
    const asset = project.assets[assetId];

    if (!asset) {
      return;
    }

    if (missingAssetIds.includes(assetId)) {
      window.alert("该资源文件已缺失，请先在资源中心重新挂载。");
      return;
    }

    /**
     * FLV can be stored safely in the resource library, but the browser does not
     * provide native FLV playback. Keep it out of the canvas until the dedicated
     * FLV playback layer is implemented.
     */
    if (asset.type === "video" && asset.name.toLowerCase().endsWith(".flv")) {
      window.alert(
        "FLV 资源已安全保存在资源库中，但当前浏览器原生播放器无法直接播放。FLV 播放将在后续专门接入。",
      );
      return;
    }

    const source = assetSources[assetId];

    if (!source) {
      window.alert("资源仍在加载，请稍后重试。");
      return;
    }

    try {
      let displaySize: {
        width: number;
        height: number;
      };

      if (asset.type === "image") {
        displaySize = await getImageDisplaySize(source);
      } else if (asset.type === "video") {
        displaySize = await getVideoDisplaySize(source);
      } else {
        /**
         * Audio has no visual dimensions. Its canvas element acts as a compact media
         * control card.
         */
        displaySize = {
          width: 420,
          height: 88,
        };
      }

      const now = Date.now();

      const elementId = `element-${asset.type}-reuse-${now}`;

      const elementType: SlideElementType = asset.type;

      commitProjectChange((currentProject) => {
        const activeProjectSlide = currentProject.slides.find(
          (slide) => slide.id === currentProject.activeSlideId,
        );

        if (!activeProjectSlide) {
          return currentProject;
        }

        const elementOffsetX = 36;

        const lastSameTypeElement = activeProjectSlide.elements
          .filter((element) => element.type === elementType)
          .at(-1);

        const centerX = Math.round(
          (currentProject.width - displaySize.width) / 2,
        );

        const centerY = Math.round(
          (currentProject.height - displaySize.height) / 2,
        );

        const nextElement: SlideElement = {
          id: elementId,
          type: elementType,
          name: asset.name,
          content: asset.name,

          /**
           * Reuse the persistent resource instead of copying its binary file.
           */
          assetId,

          /**
           * Images do not need playback state. Video and audio start with conservative
           * manual-playback defaults and can be customized from the property panel.
           */
          media:
            asset.type === "video" || asset.type === "audio"
              ? {
                  startBehavior: "manual",
                  loop: false,
                  muted: false,
                  volume: 1,
                }
              : undefined,

          style: {
            x: lastSameTypeElement
              ? lastSameTypeElement.style.x + elementOffsetX
              : centerX,

            y: lastSameTypeElement ? lastSameTypeElement.style.y : centerY,

            width: displaySize.width,

            height: displaySize.height,

            rotate: 0,
            opacity: 1,

            backgroundColor:
              asset.type === "video"
                ? "#020617"
                : asset.type === "audio"
                  ? "#f8fafc"
                  : undefined,

            borderRadius:
              asset.type === "video" ? 12 : asset.type === "audio" ? 16 : 0,
          },

          animations: [],
        };

        return {
          ...currentProject,

          updatedAt: new Date().toISOString(),

          slides: currentProject.slides.map((slide) =>
            slide.id === currentProject.activeSlideId
              ? {
                  ...slide,
                  elements: [...slide.elements, nextElement],
                }
              : slide,
          ),
        };
      });

      setSelectedElementId(elementId);

      setSelectedElementIds([elementId]);

      setPropertyTargetElementIds([elementId]);

      setPropertyPanelOpen(true);
    } catch (error) {
      console.error("Failed to insert an existing asset.", error);

      window.alert(
        asset.type === "video"
          ? "视频无法被当前浏览器读取或播放，请检查视频格式和编码。"
          : "资源插入失败，请稍后重试。",
      );
    }
  }

  /**
   * Permanently delete one or more project assets that have no live element
   * references.
   *
   * Binary deletion is intentionally outside normal undo history because an
   * IndexedDB Blob cannot be reconstructed from a project snapshot.
   */
  async function deleteUnusedProjectAssets(
    requestedAssetIds: string[],
    confirmationMessage: string,
  ) {
    const currentProject = latestProjectRef.current;

    const uniqueAssetIds = [...new Set(requestedAssetIds)].filter((assetId) =>
      Boolean(currentProject.assets[assetId]),
    );

    if (uniqueAssetIds.length === 0) {
      return;
    }

    /**
     * Recheck references using the latest project. The Resource Center count may
     * have been rendered before another edit added a new reference.
     */
    const referencedAssetIds = new Set<string>();

    for (const slide of currentProject.slides) {
      for (const element of slide.elements) {
        if (element.assetId) {
          referencedAssetIds.add(element.assetId);
        }
      }
    }

    const blockedAssetIds = uniqueAssetIds.filter((assetId) =>
      referencedAssetIds.has(assetId),
    );

    if (blockedAssetIds.length > 0) {
      window.alert(
        `有 ${blockedAssetIds.length} 项资源仍被页面元素引用，已取消删除。`,
      );
      return;
    }

    const confirmed = window.confirm(confirmationMessage);

    if (!confirmed) {
      return;
    }

    const deletionResults = await Promise.allSettled(
      uniqueAssetIds.map((assetId) => deleteAssetBlob(assetId)),
    );

    const deletedAssetIds: string[] = [];

    const failedAssetIds: string[] = [];

    deletionResults.forEach((result, index) => {
      const assetId = uniqueAssetIds[index];

      if (result.status === "fulfilled") {
        deletedAssetIds.push(assetId);
        return;
      }

      failedAssetIds.push(assetId);

      console.error(`Failed to delete asset Blob: ${assetId}`, result.reason);
    });

    if (deletedAssetIds.length === 0) {
      window.alert("资源删除失败，没有资源被移除。");
      return;
    }

    const deletedAssetIdSet = new Set(deletedAssetIds);

    /**
     * Revoke and remove every runtime Blob URL belonging to successfully deleted
     * assets.
     */
    const nextAssetSources = {
      ...assetSourcesRef.current,
    };

    for (const assetId of deletedAssetIds) {
      const runtimeSource = nextAssetSources[assetId];

      if (runtimeSource?.startsWith("blob:")) {
        URL.revokeObjectURL(runtimeSource);
      }

      delete nextAssetSources[assetId];
    }

    assetSourcesRef.current = nextAssetSources;

    setAssetSources(nextAssetSources);

    setMissingAssetIds((currentMissingAssetIds) =>
      currentMissingAssetIds.filter(
        (assetId) => !deletedAssetIdSet.has(assetId),
      ),
    );

    /**
     * The internal clipboard may still contain an image element whose project
     * asset has just been permanently deleted.
     */
    if (
      copiedElementsRef.current?.elements.some((element) =>
        Boolean(element.assetId && deletedAssetIdSet.has(element.assetId)),
      )
    ) {
      copiedElementsRef.current = null;

      setHasCopiedElements(false);
    }

    /**
     * Remove deleted metadata from one project snapshot.
     */
    function removeAssetMetadata(sourceProject: PresentationProject) {
      let changed = false;

      const nextAssets = {
        ...sourceProject.assets,
      };

      for (const assetId of deletedAssetIds) {
        if (!nextAssets[assetId]) {
          continue;
        }

        delete nextAssets[assetId];

        changed = true;
      }

      if (!changed) {
        return sourceProject;
      }

      return {
        ...sourceProject,
        assets: nextAssets,
      };
    }

    /**
     * Prevent later undo or redo operations from restoring metadata whose Blob
     * has already been permanently removed.
     */
    undoStackRef.current = undoStackRef.current.map(removeAssetMetadata);

    redoStackRef.current = redoStackRef.current.map(removeAssetMetadata);

    if (historyGroupSnapshotRef.current) {
      historyGroupSnapshotRef.current = removeAssetMetadata(
        historyGroupSnapshotRef.current,
      );
    }

    const nextProject = {
      ...removeAssetMetadata(latestProjectRef.current),
      updatedAt: new Date().toISOString(),
    };

    latestProjectRef.current = nextProject;

    clearAnimationClipPreview();
    setProject(nextProject);

    if (failedAssetIds.length > 0) {
      window.alert(
        `已清理 ${deletedAssetIds.length} 项资源，另有 ${failedAssetIds.length} 项删除失败并已保留。`,
      );
    }
  }

  /**
   * Delete one unused resource from its card.
   */
  async function handleDeleteUnusedAsset(assetId: string) {
    if (duplicateReviewActiveRef.current) {
      return;
    }

    const asset = latestProjectRef.current.assets[assetId];

    if (!asset) {
      return;
    }

    await deleteUnusedProjectAssets(
      [assetId],
      `确定永久删除资源“${asset.name}”吗？\n\n该操作会同时清理本地资源文件，无法通过撤销恢复。`,
    );
  }

  /**
   * Permanently remove every project resource with zero live references.
   */
  /**
   * Permanently remove every project resource with zero live references.
   */
  async function handleCleanupUnusedAssets() {
    if (duplicateReviewActiveRef.current) {
      return;
    }

    const currentProject = latestProjectRef.current;

    const referencedAssetIds = new Set<string>();

    for (const slide of currentProject.slides) {
      for (const element of slide.elements) {
        if (element.assetId) {
          referencedAssetIds.add(element.assetId);
        }
      }
    }

    const unusedAssets = Object.values(currentProject.assets).filter(
      (asset) => !referencedAssetIds.has(asset.id),
    );

    if (unusedAssets.length === 0) {
      window.alert("当前没有未使用资源。");
      return;
    }

    await deleteUnusedProjectAssets(
      unusedAssets.map((asset) => asset.id),
      `确定永久清理 ${unusedAssets.length} 项未使用资源吗？\n\n这会删除对应的本地资源文件，无法通过撤销恢复。`,
    );
  }

  /**
   * Insert one or more selected images into the active slide.
   *
   * Binary files are stored in IndexedDB. Project assets contain metadata only,
   * while slide elements reference the shared asset through assetId.
   */
  async function handleImageFileChange(event: ChangeEvent<HTMLInputElement>) {
    const selectedFiles = Array.from(event.target.files ?? []);

    // Allow the same file to be selected again later.
    event.target.value = "";

    if (selectedFiles.length === 0) {
      return;
    }

    if (!assetStoreReady) {
      window.alert("资源存储尚未准备完成，请稍后重试。");
      return;
    }

    const imageFiles = selectedFiles.filter((file) =>
      file.type.startsWith("image/"),
    );

    if (imageFiles.length === 0) {
      window.alert("请选择图片文件。");
      return;
    }

    const createdObjectUrls: string[] = [];

    const storedAssetIds: string[] = [];

    try {
      const now = new Date().toISOString();
      const timestamp = Date.now();

      const imageItems: Array<{
        file: File;
        assetId: string;
        elementId: string;
        objectUrl: string;
        displaySize: {
          width: number;
          height: number;
        };
      }> = [];

      /**
       * Process sequentially so failed batches can safely revoke every URL already
       * created by this operation.
       */
      for (let index = 0; index < imageFiles.length; index += 1) {
        const file = imageFiles[index];
        const idSuffix = `${timestamp}-${index}`;

        const assetId = `asset-image-${idSuffix}`;

        const elementId = `element-image-${idSuffix}`;

        const previewUrl = URL.createObjectURL(file);

        let displaySize: {
          width: number;
          height: number;
        };

        try {
          displaySize = await getImageDisplaySize(previewUrl);
        } finally {
          URL.revokeObjectURL(previewUrl);
        }

        /**
         * The project must not know about this asset until IndexedDB has confirmed that
         * the complete Blob can be read back successfully.
         */
        const storedBlob = await putVerifiedAssetBlob(assetId, file);

        storedAssetIds.push(assetId);

        const objectUrl = URL.createObjectURL(storedBlob);

        createdObjectUrls.push(objectUrl);

        imageItems.push({
          file,
          assetId,
          elementId,
          objectUrl,
          displaySize,
        });
      }

      const lastInsertedElementId = imageItems.at(-1)?.elementId ?? "";

      commitProjectChange((currentProject) => {
        const imageOffsetX = 36;

        const firstImageSize = imageItems[0]?.displaySize ?? {
          width: 420,
          height: 260,
        };

        const centerX = Math.round(
          (currentProject.width - firstImageSize.width) / 2,
        );

        const centerY = Math.round(
          (currentProject.height - firstImageSize.height) / 2,
        );

        const activeProjectSlide = currentProject.slides.find(
          (slide) => slide.id === currentProject.activeSlideId,
        );

        const lastImageElement = activeProjectSlide?.elements
          .filter((element) => element.type === "image")
          .at(-1);

        const startX = lastImageElement
          ? lastImageElement.style.x + imageOffsetX
          : centerX;

        const startY = lastImageElement ? lastImageElement.style.y : centerY;

        const newAssets: Record<string, PresentationAsset> = {};

        const newElements: SlideElement[] = imageItems.map((item, index) => {
          const fileName = item.file.name || "未命名图片";

          const imageAsset: PresentationAsset = {
            id: item.assetId,
            type: "image",
            name: fileName,
            mimeType: item.file.type || "image/*",
            size: item.file.size,
            createdAt: now,
          };

          newAssets[item.assetId] = imageAsset;

          return {
            id: item.elementId,
            type: "image",
            name: fileName,
            content: fileName,
            assetId: item.assetId,
            style: {
              x: startX + imageOffsetX * index,
              y: startY,
              width: item.displaySize.width,
              height: item.displaySize.height,
              rotate: 0,
              opacity: 1,
              borderRadius: 0,
            },
            animations: [],
          };
        });

        return {
          ...currentProject,
          updatedAt: now,
          assets: {
            ...(currentProject.assets ?? {}),
            ...newAssets,
          },
          slides: currentProject.slides.map((slide) => {
            if (slide.id !== currentProject.activeSlideId) {
              return slide;
            }

            return {
              ...slide,
              elements: [...slide.elements, ...newElements],
            };
          }),
        };
      });

      const newRuntimeSources = Object.fromEntries(
        imageItems.map((item) => [item.assetId, item.objectUrl]),
      );

      setAssetSources((currentSources) => {
        const nextSources = {
          ...currentSources,
          ...newRuntimeSources,
        };

        assetSourcesRef.current = nextSources;

        return nextSources;
      });

      const importedAssetIds = new Set(imageItems.map((item) => item.assetId));

      setMissingAssetIds((currentMissingAssetIds) =>
        currentMissingAssetIds.filter(
          (assetId) => !importedAssetIds.has(assetId),
        ),
      );

      setSelectedElementId(lastInsertedElementId);
    } catch (error) {
      console.error("Failed to insert image assets.", error);

      for (const objectUrl of createdObjectUrls) {
        URL.revokeObjectURL(objectUrl);
      }

      /**
       * A multi-file import is treated as one operation. When any file fails,
       * remove every Blob already written by this unfinished batch.
       *
       * Project metadata has not been committed yet, so no broken asset references
       * are left behind.
       */
      await Promise.allSettled(
        storedAssetIds.map((assetId) => deleteAssetBlob(assetId)),
      );

      window.alert(
        "图片保存失败，本次导入已安全回滚。请检查浏览器存储权限后重试。",
      );
    }
  }

  function handleUpdateElement(
    elementId: string,
    updates: Partial<Omit<SlideElement, "style">> & {
      style?: Partial<SlideElement["style"]>;
    },
    options?: { recordHistory?: boolean },
  ) {
    commitProjectChange(
      (currentProject) => ({
        ...currentProject,
        updatedAt: new Date().toISOString(),
        slides: currentProject.slides.map((slide) => {
          if (slide.id !== currentProject.activeSlideId) {
            return slide;
          }

          return {
            ...slide,
            elements: slide.elements.map((element) => {
              if (element.id !== elementId) {
                return element;
              }

              return {
                ...element,
                ...updates,
                style: updates.style
                  ? {
                      ...element.style,
                      ...updates.style,
                    }
                  : element.style,
              };
            }),
          };
        }),
      }),
      options,
    );
  }

  /**
   * Update multiple elements in one project transaction.
   *
   * The command layer applies the element changes and keeps the legacy animation
   * array synchronized with Animation Schema V2. One batch still creates only one
   * undo snapshot.
   */
  function handleUpdateElements(
    batchUpdates: ElementBatchUpdate[],
    options?: { recordHistory?: boolean },
  ) {
    if (batchUpdates.length === 0) {
      return;
    }

    commitProjectChange((currentProject) => {
      let changed = false;

      const nextSlides = currentProject.slides.map((slide) => {
        if (slide.id !== currentProject.activeSlideId) {
          return slide;
        }

        const nextSlide = applyElementBatchUpdatesToSlide(slide, batchUpdates);

        if (nextSlide === slide) {
          return slide;
        }

        changed = true;
        return nextSlide;
      });

      if (!changed) {
        return currentProject;
      }

      return {
        ...currentProject,
        updatedAt: new Date().toISOString(),
        slides: nextSlides,
      };
    }, options);
  }

  /**
   * Update one Animation Schema V2 keyframe value.
   *
   * The animation command edits only animationScene. Continuous number input can
   * join one history group, so typing several digits still creates one undo step.
   */
  function handleUpdateAnimationKeyframeValue(
    command: UpdateAnimationKeyframeValueCommand,
    options?: { recordHistory?: boolean },
  ) {
    commitProjectChange((currentProject) => {
      let changed = false;

      const nextSlides = currentProject.slides.map((slide) => {
        if (slide.id !== currentProject.activeSlideId) {
          return slide;
        }

        const nextSlide = updateAnimationKeyframeValueInSlide(slide, command);

        if (nextSlide === slide) {
          return slide;
        }

        changed = true;
        return nextSlide;
      });

      if (!changed) {
        return currentProject;
      }

      return {
        ...currentProject,
        updatedAt: new Date().toISOString(),
        slides: nextSlides,
      };
    }, options);
  }

  /**
   * Update one Animation Schema V2 keyframe timeline position.
   *
   * Offset input uses the same history grouping as keyframe value input, so one
   * focus-to-blur editing session creates only one undo step.
   */
  function handleUpdateAnimationKeyframeOffset(
    command: UpdateAnimationKeyframeOffsetCommand,
    options?: { recordHistory?: boolean },
  ) {
    commitProjectChange((currentProject) => {
      let changed = false;

      const nextSlides = currentProject.slides.map((slide) => {
        if (slide.id !== currentProject.activeSlideId) {
          return slide;
        }

        const nextSlide = updateAnimationKeyframeOffsetInSlide(slide, command);

        if (nextSlide === slide) {
          return slide;
        }

        changed = true;
        return nextSlide;
      });

      if (!changed) {
        return currentProject;
      }

      return {
        ...currentProject,
        updatedAt: new Date().toISOString(),
        slides: nextSlides,
      };
    }, options);
  }

  /**
   * Update easing for the animation segment beginning at one V2 keyframe.
   *
   * Select changes are discrete history entries. Custom numeric parameters use
   * the existing focus-to-blur history group.
   */
  function handleUpdateAnimationKeyframeEasing(
    command: UpdateAnimationKeyframeEasingCommand,
    options?: { recordHistory?: boolean },
  ) {
    commitProjectChange((currentProject) => {
      let changed = false;

      const nextSlides = currentProject.slides.map((slide) => {
        if (slide.id !== currentProject.activeSlideId) {
          return slide;
        }

        const nextSlide = updateAnimationKeyframeEasingInSlide(slide, command);

        if (nextSlide === slide) {
          return slide;
        }

        changed = true;
        return nextSlide;
      });

      if (!changed) {
        return currentProject;
      }

      return {
        ...currentProject,
        updatedAt: new Date().toISOString(),
        slides: nextSlides,
      };
    }, options);
  }

  /**
   * Update one V2 Clip's timing and playback parameters.
   *
   * Number fields use the existing focus-to-blur history group, while select
   * changes such as direction are committed as one discrete undo step.
   */
  function handleUpdateAnimationClipTiming(
    command: UpdateAnimationClipTimingCommand,
    options?: { recordHistory?: boolean },
  ) {
    commitProjectChange((currentProject) => {
      let changed = false;

      const nextSlides = currentProject.slides.map((slide) => {
        if (slide.id !== currentProject.activeSlideId) {
          return slide;
        }

        const nextSlide = updateAnimationClipTimingInSlide(slide, command);

        if (nextSlide === slide) {
          return slide;
        }

        changed = true;
        return nextSlide;
      });

      if (!changed) {
        return currentProject;
      }

      return {
        ...currentProject,
        updatedAt: new Date().toISOString(),
        slides: nextSlides,
      };
    }, options);
  }

  /**
   * Update several V2 Clips through one project transaction.
   *
   * Regardless of how many selected elements are changed, the batch creates only
   * one undo snapshot.
   */
  function handleUpdateAnimationClipTimings(
    commands: UpdateAnimationClipTimingCommand[],
    options?: { recordHistory?: boolean },
  ) {
    if (commands.length === 0) {
      return;
    }

    commitProjectChange((currentProject) => {
      let changed = false;

      const nextSlides = currentProject.slides.map((slide) => {
        if (slide.id !== currentProject.activeSlideId) {
          return slide;
        }

        let nextSlide = slide;

        for (const command of commands) {
          nextSlide = updateAnimationClipTimingInSlide(nextSlide, command);
        }

        if (nextSlide === slide) {
          return slide;
        }

        changed = true;
        return nextSlide;
      });

      if (!changed) {
        return currentProject;
      }

      return {
        ...currentProject,
        updatedAt: new Date().toISOString(),
        slides: nextSlides,
      };
    }, options);
  }

  /**
   * Apply one whole-Clip easing setting to several selected animations.
   */
  function handleUpdateAnimationClipEasings(
    commands: UpdateAnimationClipEasingCommand[],
    options?: { recordHistory?: boolean },
  ) {
    if (commands.length === 0) {
      return;
    }

    commitProjectChange((currentProject) => {
      let changed = false;

      const nextSlides = currentProject.slides.map((slide) => {
        if (slide.id !== currentProject.activeSlideId) {
          return slide;
        }

        let nextSlide = slide;

        for (const command of commands) {
          nextSlide = updateAnimationClipEasingInSlide(nextSlide, command);
        }

        if (nextSlide === slide) {
          return slide;
        }

        changed = true;
        return nextSlide;
      });

      if (!changed) {
        return currentProject;
      }

      return {
        ...currentProject,
        updatedAt: new Date().toISOString(),
        slides: nextSlides,
      };
    }, options);
  }

  /**
   * Add one keyframe through one project transaction.
   *
   * Button actions are discrete changes, so every click creates exactly one undo
   * snapshot without opening a continuous property-editing history group.
   */
  function handleAddAnimationKeyframe(command: AddAnimationKeyframeCommand) {
    commitProjectChange((currentProject) => {
      let changed = false;

      const nextSlides = currentProject.slides.map((slide) => {
        if (slide.id !== currentProject.activeSlideId) {
          return slide;
        }

        const nextSlide = addAnimationKeyframeToSlide(slide, command);

        if (nextSlide === slide) {
          return slide;
        }

        changed = true;
        return nextSlide;
      });

      if (!changed) {
        return currentProject;
      }

      return {
        ...currentProject,
        updatedAt: new Date().toISOString(),
        slides: nextSlides,
      };
    });
  }

  /**
   * Delete one keyframe through one project transaction.
   */
  function handleDeleteAnimationKeyframe(
    command: DeleteAnimationKeyframeCommand,
  ) {
    commitProjectChange((currentProject) => {
      let changed = false;

      const nextSlides = currentProject.slides.map((slide) => {
        if (slide.id !== currentProject.activeSlideId) {
          return slide;
        }

        const nextSlide = deleteAnimationKeyframeFromSlide(slide, command);

        if (nextSlide === slide) {
          return slide;
        }

        changed = true;
        return nextSlide;
      });

      if (!changed) {
        return currentProject;
      }

      return {
        ...currentProject,
        updatedAt: new Date().toISOString(),
        slides: nextSlides,
      };
    });
  }

  /**
   * Add one preset animation Clip to the active slide.
   */
  function handleAddAnimationClip(command: AddAnimationClipCommand) {
    commitProjectChange((currentProject) => {
      let changed = false;

      const nextSlides = currentProject.slides.map((slide) => {
        if (slide.id !== currentProject.activeSlideId) {
          return slide;
        }

        const nextSlide = addAnimationClipToSlide(slide, command);

        if (nextSlide === slide) {
          return slide;
        }

        changed = true;
        return nextSlide;
      });

      if (!changed) {
        return currentProject;
      }

      return {
        ...currentProject,
        updatedAt: new Date().toISOString(),
        slides: nextSlides,
      };
    });
  }

  /**
   * Duplicate one Clip with its customized tracks and keyframes.
   */
  function handleDuplicateAnimationClip(
    command: DuplicateAnimationClipCommand,
  ) {
    commitProjectChange((currentProject) => {
      let changed = false;

      const nextSlides = currentProject.slides.map((slide) => {
        if (slide.id !== currentProject.activeSlideId) {
          return slide;
        }

        const nextSlide = duplicateAnimationClipInSlide(slide, command);

        if (nextSlide === slide) {
          return slide;
        }

        changed = true;
        return nextSlide;
      });

      if (!changed) {
        return currentProject;
      }

      return {
        ...currentProject,
        updatedAt: new Date().toISOString(),
        slides: nextSlides,
      };
    });
  }

  /**
   * Delete one Clip and its compatibility animation mirror.
   */
  function handleDeleteAnimationClip(command: DeleteAnimationClipCommand) {
    commitProjectChange((currentProject) => {
      let changed = false;

      const nextSlides = currentProject.slides.map((slide) => {
        if (slide.id !== currentProject.activeSlideId) {
          return slide;
        }

        const nextSlide = deleteAnimationClipFromSlide(slide, command);

        if (nextSlide === slide) {
          return slide;
        }

        changed = true;
        return nextSlide;
      });

      if (!changed) {
        return currentProject;
      }

      return {
        ...currentProject,
        updatedAt: new Date().toISOString(),
        slides: nextSlides,
      };
    });
  }

  /**
   * Move one element or the whole current multi-selection.
   *
   * SlideCanvas reports the dragged element's next absolute position. App converts
   * that into a delta and applies the same delta to every selected element.
   */
  function handleMoveSelectedElements(
    elementId: string,
    position: { x: number; y: number },
  ) {
    commitProjectChange(
      (currentProject) => {
        const activeSelectionIds = selectedElementIds.includes(elementId)
          ? selectedElementIds
          : [elementId];

        const selectedIdSet = new Set(activeSelectionIds);
        let moved = false;

        const nextSlides = currentProject.slides.map((slide) => {
          if (slide.id !== currentProject.activeSlideId) {
            return slide;
          }

          const draggedElement = slide.elements.find(
            (element) => element.id === elementId,
          );

          if (!draggedElement) {
            return slide;
          }

          const deltaX = position.x - draggedElement.style.x;
          const deltaY = position.y - draggedElement.style.y;

          if (deltaX === 0 && deltaY === 0) {
            return slide;
          }

          moved = true;

          return {
            ...slide,
            elements: slide.elements.map((element) => {
              if (!selectedIdSet.has(element.id)) {
                return element;
              }

              return {
                ...element,
                style: {
                  ...element.style,
                  x: element.style.x + deltaX,
                  y: element.style.y + deltaY,
                },
              };
            }),
          };
        });

        if (!moved) {
          return currentProject;
        }

        return {
          ...currentProject,
          updatedAt: new Date().toISOString(),
          slides: nextSlides,
        };
      },
      { recordHistory: false },
    );
  }

  /**
   * Apply exact style updates produced by the multi-selection resize frame.
   *
   * All pointer-move updates use recordHistory: false. SlideCanvas wraps the
   * complete resize gesture with begin/finish history calls, so one drag creates
   * only one undo entry.
   */
  function handleResizeSelectedElements(
    updates: Array<{
      elementId: string;
      style: Partial<SlideElement["style"]>;
    }>,
  ) {
    if (updates.length === 0) {
      return;
    }

    const updatesByElementId = new Map(
      updates.map((update) => [update.elementId, update.style]),
    );

    commitProjectChange(
      (currentProject) => {
        let changed = false;

        const nextSlides = currentProject.slides.map((slide) => {
          if (slide.id !== currentProject.activeSlideId) {
            return slide;
          }

          return {
            ...slide,
            elements: slide.elements.map((element) => {
              const styleUpdate = updatesByElementId.get(element.id);

              if (!styleUpdate) {
                return element;
              }

              changed = true;

              return {
                ...element,
                style: {
                  ...element.style,
                  ...styleUpdate,
                },
              };
            }),
          };
        });

        if (!changed) {
          return currentProject;
        }

        return {
          ...currentProject,
          updatedAt: new Date().toISOString(),
          slides: nextSlides,
        };
      },
      { recordHistory: false },
    );
  }

  /**
   * Open the element context menu without destroying an existing multi-selection.
   *
   * Right-clicking an element inside the selected group keeps the group. An
   * unselected element becomes the only selected element before its menu opens.
   */
  function handleOpenElementContextMenu(
    elementId: string,
    position: { x: number; y: number },
  ) {
    const menuWidth = 180;
    const menuHeight = 260;
    const elementAlreadySelected = selectedElementIds.includes(elementId);

    setSelectedElementId(elementId);

    if (!elementAlreadySelected) {
      setSelectedElementIds([elementId]);
    }

    setPropertyPanelOpen(true);
    setCanvasContextMenu(null);

    setElementContextMenu({
      elementId,
      x: Math.min(position.x, window.innerWidth - menuWidth),
      y: Math.min(position.y, window.innerHeight - menuHeight),
    });
  }
  /**
   * Open the canvas context menu near the mouse position.
   *
   * Screen coordinates place the menu. Slide coordinates are used by actions such
   * as adding text, adding shapes, or pasting copied elements onto the slide.
   */
  function handleOpenCanvasContextMenu(position: {
    x: number;
    y: number;
    slideX: number;
    slideY: number;
  }) {
    const menuWidth = 180;
    const menuHeight = 220;

    setElementContextMenu(null);
    setCanvasContextMenu({
      x: clampPosition(position.x, 8, window.innerWidth - menuWidth - 8),
      y: clampPosition(position.y, 8, window.innerHeight - menuHeight - 8),
      slideX: position.slideX,
      slideY: position.slideY,
    });
  }

  /**
   * Run an action from the element context menu.
   *
   * Copy and paste use copiedElementsRef so keyboard shortcuts and the context
   * menu share the same internal clipboard.
   */
  function handleElementContextMenuAction(
    action:
      | "copy"
      | "paste"
      | "duplicate"
      | "delete"
      | "bring-to-front"
      | "send-to-back",
  ) {
    const menuState = elementContextMenu;

    if (!menuState) {
      return;
    }

    if (action === "copy") {
      const currentProject = latestProjectRef.current;
      const currentSlide = currentProject.slides.find(
        (slide) => slide.id === currentProject.activeSlideId,
      );

      if (!currentSlide) {
        setElementContextMenu(null);
        return;
      }

      const shouldCopyCurrentSelection = selectedElementIds.includes(
        menuState.elementId,
      );

      const idsToCopy =
        shouldCopyCurrentSelection && selectedElementIds.length > 0
          ? selectedElementIds
          : [menuState.elementId];

      const selectedIdSet = new Set(idsToCopy);
      const copiedElements = currentSlide.elements.filter((element) =>
        selectedIdSet.has(element.id),
      );

      if (copiedElements.length > 0) {
        copiedElementsRef.current = {
          sourceSlideId: currentSlide.id,
          elements: JSON.parse(
            JSON.stringify(copiedElements),
          ) as SlideElement[],
          animationScene: cloneAnimationSceneSnapshot(
            currentSlide.animationScene,
          ),
        };

        setHasCopiedElements(true);
      }

      setElementContextMenu(null);
      return;
    }

    if (action === "paste") {
      const clipboard = copiedElementsRef.current;

      const copiedElements = clipboard?.elements ?? [];

      if (!clipboard || copiedElements.length === 0) {
        setElementContextMenu(null);
        return;
      }

      let pastedElementIds: string[] = [];

      /**
       * Generate operation IDs inside the event-triggered project transaction.
       *
       * This prevents an impure Date.now() call from being evaluated in the
       * component's render scope.
       */
      commitProjectChange((currentProject) => {
        const now = Date.now();

        pastedElementIds = copiedElements.map(
          (element, index) => `${element.id}-paste-${now}-${index}`,
        );

        const pastedElements = copiedElements.map((copiedElement, index) =>
          cloneSlideElementForInsert(
            copiedElement,
            pastedElementIds[index],
            now,
            "粘贴",
          ),
        );

        return {
          ...currentProject,
          updatedAt: new Date().toISOString(),
          slides: currentProject.slides.map((slide) => {
            if (slide.id !== currentProject.activeSlideId) {
              return slide;
            }

            const nextSlide = {
              ...slide,
              elements: [...slide.elements, ...pastedElements],
            };

            return cloneElementAnimationsToInsertedElements(
              nextSlide,
              clipboard.animationScene,
              clipboard.sourceSlideId,
              copiedElements,
              pastedElements,
              `paste-${now}`,
            );
          }),
        };
      });

      setSelectedElementId(pastedElementIds.at(-1) ?? "");
      setSelectedElementIds(pastedElementIds);
      setPropertyTargetElementIds(pastedElementIds);
      setPropertyPanelOpen(pastedElementIds.length > 0);
      setElementContextMenu(null);
      return;
    }

    if (action === "duplicate") {
      let duplicateElementId = "";

      commitProjectChange((currentProject) => {
        let duplicated = false;
        const now = Date.now();

        const nextSlides = currentProject.slides.map((slide) => {
          if (slide.id !== currentProject.activeSlideId) {
            return slide;
          }

          const sourceElementIndex = slide.elements.findIndex(
            (element) => element.id === menuState.elementId,
          );

          if (sourceElementIndex === -1) {
            return slide;
          }

          const sourceElement = slide.elements[sourceElementIndex];

          if (!sourceElement) {
            return slide;
          }

          duplicateElementId = `${sourceElement.id}-copy-${now}`;

          const duplicateElement = cloneSlideElementForInsert(
            sourceElement,
            duplicateElementId,
            now,
            "副本",
          );

          duplicated = true;

          const nextElements = [
            ...slide.elements.slice(0, sourceElementIndex + 1),
            duplicateElement,
            ...slide.elements.slice(sourceElementIndex + 1),
          ];

          const nextSlide = {
            ...slide,
            elements: nextElements,
          };

          return cloneElementAnimationsToInsertedElements(
            nextSlide,
            slide.animationScene,
            slide.id,
            [sourceElement],
            [duplicateElement],
            `duplicate-${now}`,
          );
        });

        if (!duplicated) {
          return currentProject;
        }

        return {
          ...currentProject,
          updatedAt: new Date().toISOString(),
          slides: nextSlides,
        };
      });

      if (duplicateElementId) {
        setSelectedElementId(duplicateElementId);
      }

      setElementContextMenu(null);
      return;
    }

    if (action === "delete") {
      handleDeleteElement(menuState.elementId);
      setElementContextMenu(null);
      return;
    }

    handleLayerElement(menuState.elementId, action);
    setElementContextMenu(null);
  }

  /**
   * Run an action from the blank-canvas context menu.
   *
   * Pasting from the canvas menu places the copied group near the right-clicked
   * slide position. Adding text or shape also uses that slide position.
   */
  function handleCanvasContextMenuAction(
    action: "paste" | "add-text" | "add-shape" | "add-image",
  ) {
    const menuState = canvasContextMenu;

    if (!menuState) {
      return;
    }

    if (action === "add-text") {
      handleAddElement("text", {
        x: menuState.slideX,
        y: menuState.slideY,
      });
      setCanvasContextMenu(null);
      return;
    }

    if (action === "add-shape") {
      handleAddElement("shape", {
        x: menuState.slideX,
        y: menuState.slideY,
      });
      setCanvasContextMenu(null);
      return;
    }

    if (action === "add-image") {
      setCanvasContextMenu(null);
      handleOpenImagePicker();
      return;
    }

    const clipboard = copiedElementsRef.current;

    const copiedElements = clipboard?.elements ?? [];

    if (!clipboard || copiedElements.length === 0) {
      setCanvasContextMenu(null);
      return;
    }

    let pastedElementIds: string[] = [];

    commitProjectChange((currentProject) => {
      const now = Date.now();

      const sourceLeft = Math.min(
        ...copiedElements.map((element) => element.style.x),
      );

      const sourceTop = Math.min(
        ...copiedElements.map((element) => element.style.y),
      );

      pastedElementIds = copiedElements.map(
        (element, index) => `${element.id}-paste-${now}-${index}`,
      );

      const pastedElements = copiedElements.map((copiedElement, index) => {
        const pastedElement = cloneSlideElementForInsert(
          copiedElement,
          pastedElementIds[index],
          now,
          "粘贴",
        );

        return {
          ...pastedElement,
          style: {
            ...pastedElement.style,
            x: menuState.slideX + (copiedElement.style.x - sourceLeft),
            y: menuState.slideY + (copiedElement.style.y - sourceTop),
          },
        };
      });

      return {
        ...currentProject,
        updatedAt: new Date().toISOString(),
        slides: currentProject.slides.map((slide) => {
          if (slide.id !== currentProject.activeSlideId) {
            return slide;
          }

          const nextSlide = {
            ...slide,
            elements: [...slide.elements, ...pastedElements],
          };

          return cloneElementAnimationsToInsertedElements(
            nextSlide,
            clipboard.animationScene,
            clipboard.sourceSlideId,
            copiedElements,
            pastedElements,
            `paste-${now}`,
          );
        }),
      };
    });

    setSelectedElementId(pastedElementIds.at(-1) ?? "");
    setSelectedElementIds(pastedElementIds);
    setPropertyTargetElementIds(pastedElementIds);
    setPropertyPanelOpen(pastedElementIds.length > 0);
    setCanvasContextMenu(null);
  }

  /**
   * Select exactly one element and make it the property-panel target.
   */
  function handleSelectElement(elementId: string) {
    setSelectedElementId(elementId);
    setSelectedElementIds([elementId]);
    setPropertyTargetElementIds([elementId]);
    setPropertyPanelOpen(true);
    setActiveAnimationContext(null);
  }

  /**
   * Toggle an element in the canvas multi-selection.
   *
   * Every newly changed canvas selection initially becomes the property-panel
   * target set. The user can later uncheck individual property targets without
   * changing the canvas selection.
   */
  function handleToggleElementSelection(elementId: string) {
    const isAlreadySelected = selectedElementIds.includes(elementId);
    const nextSelectedElementIds = isAlreadySelected
      ? selectedElementIds.filter((id) => id !== elementId)
      : [...selectedElementIds, elementId];

    setSelectedElementIds(nextSelectedElementIds);
    setSelectedElementId(nextSelectedElementIds.at(-1) ?? "");
    setPropertyTargetElementIds(nextSelectedElementIds);
    setElementContextMenu(null);
    setPropertyPanelOpen(nextSelectedElementIds.length > 0);
    setActiveAnimationContext(null);
  }

  /**
   * Select all elements inside the box-selection area.
   */
  function handleSelectElements(elementIds: string[]) {
    setSelectedElementIds(elementIds);
    setSelectedElementId(elementIds.at(-1) ?? "");
    setPropertyTargetElementIds(elementIds);
    setElementContextMenu(null);
    setCanvasContextMenu(null);
    setPropertyPanelOpen(elementIds.length > 0);
    setActiveAnimationContext(null);
  }

  /**
   * Update the checked property-panel targets without changing canvas selection.
   *
   * At least one target must remain checked while elements are selected.
   */
  function handlePropertyTargetElementIdsChange(elementIds: string[]) {
    const selectedIdSet = new Set(selectedElementIds);
    const nextTargetIds = elementIds.filter((elementId) =>
      selectedIdSet.has(elementId),
    );

    if (selectedElementIds.length > 0 && nextTargetIds.length === 0) {
      return;
    }

    setPropertyTargetElementIds(nextTargetIds);
  }

  /**
   * Clear both canvas selection and property-panel operation targets.
   */
  function handleClearElementSelection() {
    setSelectedElementId("");
    setSelectedElementIds([]);
    setPropertyTargetElementIds([]);
    setElementContextMenu(null);
    setPropertyPanelOpen(false);
  }

  function handleDeleteElement(elementId: string) {
    commitProjectChange((currentProject) => ({
      ...currentProject,
      updatedAt: new Date().toISOString(),
      slides: currentProject.slides.map((slide) => {
        if (slide.id !== currentProject.activeSlideId) {
          return slide;
        }

        return {
          ...slide,
          elements: slide.elements.filter(
            (element) => element.id !== elementId,
          ),
        };
      }),
    }));

    setSelectedElementId("");
    setSelectedElementIds([]);
  }

  /**
   * Change the layer order of one element or a specified element group.
   *
   * Context-menu actions can omit explicitTargetElementIds to use the current
   * canvas selection. The property panel passes its checked target IDs so layer
   * actions affect only the checked subset.
   */
  function handleLayerElement(
    elementId: string,
    action:
      | "bring-forward"
      | "send-backward"
      | "bring-to-front"
      | "send-to-back",
    explicitTargetElementIds?: string[],
  ) {
    const targetElementIds =
      explicitTargetElementIds && explicitTargetElementIds.length > 0
        ? explicitTargetElementIds
        : selectedElementIds.includes(elementId) &&
            selectedElementIds.length > 1
          ? selectedElementIds
          : [elementId];

    const targetElementIdSet = new Set(targetElementIds);

    commitProjectChange((currentProject) => {
      let changed = false;

      const nextSlides = currentProject.slides.map((slide) => {
        if (slide.id !== currentProject.activeSlideId) {
          return slide;
        }

        const hasTargetElement = slide.elements.some((element) =>
          targetElementIdSet.has(element.id),
        );

        if (!hasTargetElement) {
          return slide;
        }

        let nextElements = [...slide.elements];

        if (action === "bring-forward") {
          /*
           * Iterate from top to bottom. A selected element swaps with the first
           * unselected element directly above it. Consecutive selected elements
           * therefore move together as one group.
           */
          for (let index = nextElements.length - 2; index >= 0; index -= 1) {
            const currentElement = nextElements[index];
            const upperElement = nextElements[index + 1];

            if (
              currentElement &&
              upperElement &&
              targetElementIdSet.has(currentElement.id) &&
              !targetElementIdSet.has(upperElement.id)
            ) {
              nextElements[index] = upperElement;
              nextElements[index + 1] = currentElement;
            }
          }
        }

        if (action === "send-backward") {
          /*
           * Iterate from bottom to top so each selected element moves down by
           * one layer without changing the selected group's internal order.
           */
          for (let index = 1; index < nextElements.length; index += 1) {
            const currentElement = nextElements[index];
            const lowerElement = nextElements[index - 1];

            if (
              currentElement &&
              lowerElement &&
              targetElementIdSet.has(currentElement.id) &&
              !targetElementIdSet.has(lowerElement.id)
            ) {
              nextElements[index] = lowerElement;
              nextElements[index - 1] = currentElement;
            }
          }
        }

        if (action === "bring-to-front") {
          const unselectedElements = nextElements.filter(
            (element) => !targetElementIdSet.has(element.id),
          );

          const selectedElements = nextElements.filter((element) =>
            targetElementIdSet.has(element.id),
          );

          nextElements = [...unselectedElements, ...selectedElements];
        }

        if (action === "send-to-back") {
          const selectedElements = nextElements.filter((element) =>
            targetElementIdSet.has(element.id),
          );

          const unselectedElements = nextElements.filter(
            (element) => !targetElementIdSet.has(element.id),
          );

          nextElements = [...selectedElements, ...unselectedElements];
        }

        const orderChanged = slide.elements.some(
          (element, index) => element.id !== nextElements[index]?.id,
        );

        if (!orderChanged) {
          return slide;
        }

        changed = true;

        return {
          ...slide,
          elements: nextElements,
        };
      });

      if (!changed) {
        return currentProject;
      }

      return {
        ...currentProject,
        updatedAt: new Date().toISOString(),
        slides: nextSlides,
      };
    });
  }

  async function handleExportHtml() {
    try {
      await exportProjectAsHtml(project);
    } catch (error) {
      console.error("Failed to export project.", error);

      const message =
        error instanceof Error
          ? error.message
          : "HTML 导出失败。可能存在缺失或无法读取的资源文件。";

      window.alert(message);
    }
  }

  function handleResetProject() {
    if (duplicateReviewActiveRef.current) {
      return;
    }

    const firstElementId = demoProject.slides[0]?.elements[0]?.id ?? "";

    localStorage.removeItem(STORAGE_KEY);
    commitProjectChange(() => demoProject);
    setSelectedElementId(firstElementId);
    setSelectedElementIds(firstElementId ? [firstElementId] : []);
    setAnimationPreviewKey((key) => key + 1);
  }

  function handleAddSlide() {
    commitProjectChange((currentProject) => {
      const newSlide = createBlankSlide(currentProject.slides.length + 1);
      const nextSlides = normalizeSlideTitles([
        ...currentProject.slides,
        newSlide,
      ]);

      setSelectedElementId(newSlide.elements[0]?.id ?? "");
      setAnimationPreviewKey((key) => key + 1);

      return {
        ...currentProject,
        activeSlideId: newSlide.id,
        updatedAt: new Date().toISOString(),
        slides: nextSlides,
      };
    });
  }

  function handleSelectSlide(slideId: string) {
    const nextSlide = project.slides.find((slide) => slide.id === slideId);

    if (!nextSlide) {
      return;
    }

    if (slideId !== project.activeSlideId) {
      clearAnimationClipPreview();
    }

    setProject((currentProject) => ({
      ...currentProject,
      activeSlideId: slideId,
      updatedAt: new Date().toISOString(),
    }));

    setSelectedElementId(nextSlide.elements[0]?.id ?? "");
    setActiveAnimationContext(null);
    setAnimationPreviewKey((key) => key + 1);
  }

  /**
   * Navigate from the Resource Center to one concrete asset reference.
   *
   * Navigation does not create an undo snapshot because it changes editor focus,
   * not presentation content.
   */
  function handleFocusAssetReference(slideId: string, elementId: string) {
    const targetProject = latestProjectRef.current;

    const targetSlide = targetProject.slides.find(
      (slide) => slide.id === slideId,
    );

    const targetElement = targetSlide?.elements.find(
      (element) => element.id === elementId,
    );

    if (!targetSlide || !targetElement) {
      return;
    }

    const nextProject = {
      ...targetProject,
      activeSlideId: slideId,
      updatedAt: new Date().toISOString(),
    };

    latestProjectRef.current = nextProject;

    clearAnimationClipPreview();
    setProject(nextProject);

    setMode("edit");
    setSelectedElementId(elementId);
    setSelectedElementIds([elementId]);
    setPropertyTargetElementIds([elementId]);
    setPropertyPanelOpen(true);
    setActiveAnimationContext(null);
    setAnimationPreviewKey((key) => key + 1);
  }

  function handleDeleteSlide(slideId: string) {
    commitProjectChange((currentProject) => {
      if (currentProject.slides.length <= 1) {
        return currentProject;
      }

      const deleteIndex = currentProject.slides.findIndex(
        (slide) => slide.id === slideId,
      );

      if (deleteIndex === -1) {
        return currentProject;
      }

      const remainingSlides = normalizeSlideTitles(
        currentProject.slides.filter((slide) => slide.id !== slideId),
      );

      const fallbackSlide =
        remainingSlides[Math.min(deleteIndex, remainingSlides.length - 1)] ??
        remainingSlides[0];

      const nextActiveSlide =
        slideId === currentProject.activeSlideId
          ? fallbackSlide
          : (remainingSlides.find(
              (slide) => slide.id === currentProject.activeSlideId,
            ) ?? fallbackSlide);

      setSelectedElementId(nextActiveSlide.elements[0]?.id ?? "");
      setAnimationPreviewKey((key) => key + 1);

      return {
        ...currentProject,
        activeSlideId: nextActiveSlide.id,
        updatedAt: new Date().toISOString(),
        slides: remainingSlides,
      };
    });
  }

  function handleDuplicateSlide(slideId: string) {
    commitProjectChange((currentProject) => {
      const sourceIndex = currentProject.slides.findIndex(
        (slide) => slide.id === slideId,
      );

      if (sourceIndex === -1) {
        return currentProject;
      }

      const sourceSlide = currentProject.slides[sourceIndex];
      const copiedSlide = duplicateSlide(
        sourceSlide,
        currentProject.slides.length + 1,
      );

      const nextSlides = normalizeSlideTitles([
        ...currentProject.slides.slice(0, sourceIndex + 1),
        copiedSlide,
        ...currentProject.slides.slice(sourceIndex + 1),
      ]);

      setSelectedElementId(copiedSlide.elements[0]?.id ?? "");
      setAnimationPreviewKey((key) => key + 1);

      return {
        ...currentProject,
        activeSlideId: copiedSlide.id,
        updatedAt: new Date().toISOString(),
        slides: nextSlides,
      };
    });
  }

  function handleReorderSlide(activeSlideId: string, overSlideId: string) {
    if (activeSlideId === overSlideId) {
      return;
    }

    commitProjectChange((currentProject) => {
      const oldIndex = currentProject.slides.findIndex(
        (slide) => slide.id === activeSlideId,
      );

      const newIndex = currentProject.slides.findIndex(
        (slide) => slide.id === overSlideId,
      );

      if (oldIndex === -1 || newIndex === -1) {
        return currentProject;
      }

      const nextSlides = normalizeSlideTitles(
        arrayMove(currentProject.slides, oldIndex, newIndex),
      );

      return {
        ...currentProject,
        updatedAt: new Date().toISOString(),
        slides: nextSlides,
      };
    });
  }

  function getDropPosition(event: DragEndEvent) {
    const surface = slideSurfaceRef.current;
    const translatedRect = event.active.rect.current.translated;

    if (!surface || !translatedRect) {
      return undefined;
    }

    const surfaceRect = surface.getBoundingClientRect();

    const x = (translatedRect.left - surfaceRect.left - 24) / canvasScale;
    const y = (translatedRect.top - surfaceRect.top - 24) / canvasScale;

    return {
      x: Math.round(clampPosition(x, -project.width, project.width * 2)),
      y: Math.round(clampPosition(y, -project.height, project.height * 2)),
    };
  }

  /**
   * Handle the end of a drag operation.
   *
   * There are two drag sources in the editor:
   * 1. Slide thumbnails: reorder slides in the left sidebar.
   * 2. Component library items: drop text / shape / SVG elements onto the canvas.
   *
   * Image components are intentionally excluded from drag-to-create because an
   * image element must be backed by a real asset record from the file picker.
   */
  function handleDragEnd(event: DragEndEvent) {
    if (duplicateReviewActiveRef.current) {
      return;
    }

    const draggedKind = event.active.data.current?.kind;

    // Slide thumbnail dragging: reorder slides instead of creating canvas elements.
    if (draggedKind === "slide") {
      const overSlideId = event.over?.id;

      if (!overSlideId) {
        return;
      }

      handleReorderSlide(String(event.active.id), String(overSlideId));
      return;
    }

    // Component items should only create elements when dropped on the canvas.
    if (event.over?.id !== "slide-canvas-droppable") {
      return;
    }

    const draggedType = event.active.data.current?.type;

    if (!isSlideElementType(draggedType)) {
      return;
    }

    // Images must be inserted through the file picker so the project can create
    // a matching asset record. Dragging an image component should not create an
    // empty placeholder element.
    if (draggedType === "image") {
      return;
    }

    handleAddElement(draggedType, getDropPosition(event));
  }

  /**
   * Select one Clip from an outside animation editor.
   *
   * Property-panel and timeline selections increment requestId so an already
   * selected Clip can still be reopened and scrolled into view.
   */
  function handleSelectAnimationClip(elementId: string, clipId: string) {
    if (
      effectiveAnimationClipPreview &&
      effectiveAnimationClipPreview.clipId !== clipId
    ) {
      handleStopAnimationClipPreview();
    }

    animationContextRequestCounterRef.current += 1;

    setMode("animation");
    setSelectedElementId(elementId);
    setSelectedElementIds([elementId]);
    setPropertyTargetElementIds([elementId]);
    setPropertyPanelOpen(true);

    setActiveAnimationContext({
      elementId,
      clipId,
      requestId: animationContextRequestCounterRef.current,
    });
  }

  /**
   * Seek the shared editor Timeline.
   *
   * Manual seeking exits isolated preview because the ruler represents the full
   * page Timeline rather than Clip-local navigation.
   */
  function handleAnimationTimelineTimeChange(timeMs: number) {
    if (effectiveAnimationClipPreview) {
      setAnimationClipPreview(null);
      timelinePlayback.clearPlaybackRange(timeMs);
      return;
    }

    timelinePlayback.seek(timeMs);
  }

  /**
   * Replay the complete active page from zero using the shared Timeline clock.
   */
  function handleReplayCurrentSlideAnimation() {
    setMode("animation");
    setAnimationClipPreview(null);
    timelinePlayback.replay();
  }

  /**
   * Toggle full-page Timeline playback.
   *
   * Choosing full-page playback while a Clip is isolated deliberately replaces
   * preview mode rather than allowing two playback intents to compete.
   */
  function handleToggleTimelinePlayback() {
    if (effectiveAnimationClipPreview) {
      setAnimationClipPreview(null);
      timelinePlayback.replay();
      return;
    }

    if (timelinePlayback.status === "playing") {
      timelinePlayback.pause();
      return;
    }

    timelinePlayback.play();
  }

  /**
   * Start or restart the selected Clip inside one shared absolute time range.
   */
  function handleReplaySelectedAnimationClip() {
    if (!effectiveActiveAnimationContext || !selectedClipPreviewWindow) {
      return;
    }

    const previewingSameClip =
      effectiveAnimationClipPreview?.clipId ===
      effectiveActiveAnimationContext.clipId;

    setMode("animation");

    setAnimationClipPreview({
      slideId: project.activeSlideId,
      clipId: effectiveActiveAnimationContext.clipId,
      returnTimeMs: previewingSameClip
        ? effectiveAnimationClipPreview.returnTimeMs
        : animationTimelineCurrentTimeMs,
    });

    timelinePlayback.playRange(
      selectedClipPreviewWindow.startTimeMs,
      selectedClipPreviewWindow.endTimeMs,
    );
  }

  /**
   * Pause or continue the active Clip preview without resetting its frame.
   */
  function handleToggleSelectedAnimationClipPreview() {
    if (
      effectiveAnimationClipPreview?.clipId !==
      effectiveActiveAnimationContext?.clipId
    ) {
      handleReplaySelectedAnimationClip();
      return;
    }

    if (timelinePlayback.status === "playing") {
      timelinePlayback.pause();
      return;
    }

    timelinePlayback.play();
  }

  /**
   * Stop isolated preview and restore the page frame visible before it started.
   */
  function handleStopAnimationClipPreview() {
    if (!effectiveAnimationClipPreview) {
      return;
    }

    clearAnimationClipPreview();
  }

  /**
   * Stop whichever editor playback mode is currently active.
   */
  function handleStopTimelinePlayback() {
    if (effectiveAnimationClipPreview) {
      handleStopAnimationClipPreview();
      return;
    }

    timelinePlayback.stop();
  }

  /**
   * Select one lower-timeline Clip without forcing the advanced workspace open.
   *
   * In on-demand mode a normal click is navigation only.
   */
  function handleFocusTimelineClip(elementId: string, clipId: string) {
    handleSelectAnimationClip(elementId, clipId);
  }

  /**
   * Explicitly open one Clip in the advanced track editor.
   *
   * This is used by double-click and detailed-edit actions.
   */
  function handleOpenAnimationClipDetails(elementId: string, clipId: string) {
    handleSelectAnimationClip(elementId, clipId);

    setAnimationPanelOpen(true);
  }

  /**
   * Synchronize a Clip selected inside the already-open track inspector.
   *
   * Existing canvas multi-selection is preserved when the Clip target already
   * belongs to that selection. Only the property target changes to the Clip's
   * element.
   */
  function handleSelectAnimationClipFromWorkspace(
    elementId: string,
    clipId: string,
  ) {
    if (
      effectiveAnimationClipPreview &&
      effectiveAnimationClipPreview.clipId !== clipId
    ) {
      handleStopAnimationClipPreview();
    }

    const selectingDifferentClip =
      activeAnimationContext?.elementId !== elementId ||
      activeAnimationContext?.clipId !== clipId;

    /**
     * Selecting another Clip is a new navigation request, so every Clip card can
     * synchronize its expanded state. Re-clicking the current Clip keeps the same
     * request ID and therefore still allows manual collapse and expansion.
     */
    if (selectingDifferentClip) {
      animationContextRequestCounterRef.current += 1;
    }

    setMode("animation");
    setSelectedElementId(elementId);

    if (!selectedElementIds.includes(elementId)) {
      setSelectedElementIds([elementId]);
    }

    setPropertyTargetElementIds([elementId]);
    setPropertyPanelOpen(true);

    setActiveAnimationContext({
      elementId,
      clipId,
      requestId: selectingDifferentClip
        ? animationContextRequestCounterRef.current
        : (activeAnimationContext?.requestId ?? 0),
    });
  }

  /**
   * Enter animation mode without treating mode navigation as a request for the
   * advanced editor.
   *
   * Always mode reveals the workspace through the render condition. On-demand
   * mode starts clean whenever the user enters animation mode from another mode.
   */
  function handleEnterAnimationMode() {
    const enteringFromAnotherMode = mode !== "animation";

    setMode("animation");

    if (
      enteringFromAnotherMode &&
      animationWorkspaceDisplayMode === "on-demand"
    ) {
      setAnimationPanelOpen(false);
    }
  }

  /**
   * Change the local advanced-editor visibility preference.
   */
  function handleAnimationWorkspaceDisplayModeChange(
    nextMode: AnimationWorkspaceDisplayMode,
  ) {
    setAnimationWorkspaceDisplayMode(nextMode);

    /**
     * Switching back to on-demand should immediately remove a previously
     * persistent panel. The user can reopen it through an explicit detail action.
     */
    if (nextMode === "on-demand") {
      setAnimationPanelOpen(false);
    }
  }

  /**
   * Enter animation mode and show the floating V2 animation workspace.
   */
  function handleOpenAnimationWorkspace() {
    setMode("animation");
    setAnimationPanelOpen(true);
  }

  return (
    <DndContext onDragEnd={handleDragEnd}>
      <main className="h-screen overflow-hidden bg-slate-100 text-slate-950">
        <section className="flex h-full w-full flex-col gap-3 px-3 py-3">
          <header className="flex shrink-0 items-center justify-between rounded-3xl border border-white/70 bg-white/80 px-6 py-3 shadow-sm backdrop-blur">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.35em] text-violet-500">
                Animify
              </p>
              <h1 className="mt-1 text-2xl font-bold text-slate-950">
                Web 演示生成系统
              </h1>
            </div>
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-violet-100 px-4 py-2 text-sm font-medium text-violet-700">
                Local-First
              </div>
              <div className="flex rounded-full bg-slate-100 p-1">
                <button
                  type="button"
                  className="rounded-full px-3 py-2 text-sm font-semibold text-slate-500 transition hover:bg-white hover:text-violet-600"
                  onClick={undoProject}
                  title="撤销 Ctrl + Z"
                >
                  撤销
                </button>

                <button
                  type="button"
                  className="rounded-full px-3 py-2 text-sm font-semibold text-slate-500 transition hover:bg-white hover:text-violet-600"
                  onClick={redoProject}
                  title="重做 Ctrl + Y / Ctrl + Shift + Z"
                >
                  重做
                </button>
              </div>
              <div className="flex rounded-full bg-slate-100 p-1">
                <button
                  type="button"
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                    mode === "edit"
                      ? "bg-white text-violet-600 shadow-sm"
                      : "text-slate-500 hover:text-slate-900"
                  }`}
                  onClick={() => {
                    clearAnimationClipPreview();
                    setMode("edit");
                  }}
                >
                  编辑
                </button>

                <button
                  type="button"
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                    mode === "animation"
                      ? "bg-white text-violet-600 shadow-sm"
                      : "text-slate-500 hover:text-slate-900"
                  }`}
                  onClick={handleEnterAnimationMode}
                >
                  动画
                </button>

                <button
                  type="button"
                  className="rounded-full px-4 py-2 text-sm font-semibold text-slate-500 transition hover:text-slate-900"
                  onClick={() => {
                    clearAnimationClipPreview();
                    setMode("present");
                  }}
                >
                  放映
                </button>
              </div>

              <button
                type="button"
                className="rounded-full bg-violet-500 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-600"
                onClick={handleReplayCurrentSlideAnimation}
              >
                播放动画
              </button>

              <button
                type="button"
                className={`rounded-full px-5 py-2 text-sm font-semibold shadow-sm transition ${
                  selectedElement
                    ? propertyPanelOpen
                      ? "bg-violet-100 text-violet-700 hover:bg-violet-200"
                      : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                    : "cursor-not-allowed bg-slate-100 text-slate-300"
                }`}
                disabled={!selectedElement}
                onClick={() => setPropertyPanelOpen((open) => !open)}
                title={propertyPanelOpen ? "隐藏属性栏" : "显示属性栏"}
              >
                属性栏
              </button>

              <button
                type="button"
                className="rounded-full bg-slate-200 px-5 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-300"
                onClick={handleResetProject}
              >
                重置项目
              </button>

              <button
                type="button"
                className="rounded-full bg-slate-950 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
                onClick={handleExportHtml}
              >
                导出 HTML
              </button>

              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageFileChange}
                style={{ display: "none" }}
              />

              <input
                ref={resourceInputRef}
                type="file"
                accept="image/*,video/*,audio/*,.flv,.mkv,.avi,.wmv"
                multiple
                onChange={handleResourceFilesChange}
                style={{
                  display: "none",
                }}
              />

              <input
                ref={relinkInputRef}
                type="file"
                accept="image/*,video/*,audio/*,.flv,.mkv,.avi,.wmv"
                onChange={handleRelinkAssetFileChange}
                style={{
                  display: "none",
                }}
              />
            </div>
          </header>

          {isDuplicateReviewActive ? (
            <div className="shrink-0 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-center text-sm font-black text-amber-700 shadow-sm">
              🔒 重复资源确认中 · 当前为只读模式
            </div>
          ) : null}

          <div className="hidden">
            <section className="grid gap-4 py-4 md:grid-cols-2 xl:grid-cols-4">
              {featureCards.map((card) => (
                <article
                  key={card.title}
                  className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <h2 className="text-lg font-bold text-slate-950">
                    {card.title}
                  </h2>
                  <p className="mt-3 text-sm leading-6 text-slate-600">
                    {card.description}
                  </p>
                </article>
              ))}
            </section>
          </div>

          <section
            className={`grid min-h-0 flex-1 gap-3 ${
              componentPanelOpen
                ? showPropertyPanel
                  ? "xl:grid-cols-[280px_180px_minmax(0,1fr)_320px]"
                  : "xl:grid-cols-[280px_180px_minmax(0,1fr)]"
                : showPropertyPanel
                  ? "xl:grid-cols-[72px_180px_minmax(0,1fr)_320px]"
                  : "xl:grid-cols-[72px_180px_minmax(0,1fr)]"
            }`}
          >
            {componentPanelOpen ? (
              <div className="flex min-h-0 flex-col gap-2">
                <div className="flex shrink-0 items-center gap-2">
                  <div className="grid flex-1 grid-cols-2 rounded-2xl border border-slate-200 bg-white p-1 shadow-sm">
                    <button
                      type="button"
                      className={`rounded-xl px-3 py-2 text-xs font-bold transition ${
                        leftPanelMode === "components"
                          ? "bg-violet-500 text-white shadow-sm"
                          : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                      }`}
                      onClick={() => setLeftPanelMode("components")}
                    >
                      组件
                    </button>

                    <button
                      type="button"
                      className={`rounded-xl px-3 py-2 text-xs font-bold transition ${
                        leftPanelMode === "assets"
                          ? "bg-violet-500 text-white shadow-sm"
                          : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                      }`}
                      onClick={() => setLeftPanelMode("assets")}
                    >
                      资源
                    </button>
                  </div>

                  <button
                    type="button"
                    className="shrink-0 rounded-full bg-slate-100 px-3 py-2 text-xs font-bold text-slate-500 transition hover:bg-slate-200 hover:text-slate-900"
                    onClick={() => setComponentPanelOpen(false)}
                  >
                    收起
                  </button>
                </div>

                <div
                  className={`min-h-0 flex-1 ${
                    leftPanelMode === "assets"
                      ? "overflow-hidden"
                      : "overflow-y-auto overscroll-contain"
                  }`}
                >
                  {leftPanelMode === "components" ? (
                    <ComponentLibrary
                      onAddElement={handleAddElement}
                      onAddImage={handleOpenImagePicker}
                    />
                  ) : (
                    <ResourceCenter
                      assets={project.assets}
                      assetSources={assetSources}
                      missingAssetIds={missingAssetIds}
                      slides={project.slides}
                      readOnly={isDuplicateReviewActive}
                      focusAssetId={resourceFocusRequest?.assetId}
                      focusRequestId={resourceFocusRequest?.requestId ?? 0}
                      onUploadResource={handleOpenResourcePicker}
                      onInsertAsset={handleInsertExistingAsset}
                      onRelinkAsset={handleOpenAssetRelink}
                      onFocusReference={handleFocusAssetReference}
                      onDeleteAsset={handleDeleteUnusedAsset}
                      onCleanupUnusedAssets={handleCleanupUnusedAssets}
                    />
                  )}
                </div>
              </div>
            ) : (
              <aside className="flex min-h-130 flex-col items-center gap-3 rounded-3xl border border-slate-200 bg-white px-3 py-4 shadow-sm">
                <button
                  type="button"
                  className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-500 text-lg font-black text-white shadow-sm transition hover:bg-violet-600"
                  onClick={() => {
                    setLeftPanelMode("components");
                    setComponentPanelOpen(true);
                  }}
                  title="展开组件库"
                >
                  +
                </button>

                <button
                  type="button"
                  className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-100 text-lg font-black text-violet-600 shadow-sm transition hover:bg-violet-200"
                  onClick={() => {
                    setLeftPanelMode("assets");
                    setComponentPanelOpen(true);
                  }}
                  title="打开资源中心"
                >
                  ▦
                </button>

                <div className="[writing-mode:vertical-rl] text-xs font-bold tracking-[0.3em] text-slate-400">
                  {leftPanelMode === "assets" ? "资源中心" : "组件库"}
                </div>
              </aside>
            )}

            <SlideNavigator
              project={project}
              readOnly={isDuplicateReviewActive}
              assetSources={assetSources}
              assetStoreReady={assetStoreReady}
              missingAssetIds={missingAssetIds}
              activeSlideId={activeSlide.id}
              onAddSlide={handleAddSlide}
              onSelectSlide={handleSelectSlide}
              onDeleteSlide={handleDeleteSlide}
              onDuplicateSlide={handleDuplicateSlide}
            />

            <div className="flex min-h-0 min-w-0 flex-col gap-3">
              <div className="mb-2 h-0" />

              <div ref={canvasAreaRef} className="min-h-0 flex-1">
                <SlideCanvas
                  slide={activeSlide}
                  assets={project.assets}
                  assetSources={assetSources}
                  assetStoreReady={assetStoreReady}
                  missingAssetIds={missingAssetIds}
                  readOnly={isDuplicateReviewActive}
                  scale={canvasScale}
                  selectedElementId={selectedElement?.id}
                  selectedElementIds={selectedElementIds}
                  propertyTargetElementIds={effectivePropertyTargetElementIds}
                  onSelectElement={handleSelectElement}
                  onToggleElementSelection={handleToggleElementSelection}
                  onSelectElements={handleSelectElements}
                  onClearSelection={handleClearElementSelection}
                  onOpenElementContextMenu={handleOpenElementContextMenu}
                  onOpenCanvasContextMenu={handleOpenCanvasContextMenu}
                  onMoveElement={handleMoveSelectedElements}
                  onResizeSelectedElements={handleResizeSelectedElements}
                  onResizeElement={(elementId, style) =>
                    handleUpdateElement(
                      elementId,
                      {
                        style,
                      },
                      { recordHistory: false },
                    )
                  }
                  onRotateElement={(elementId, rotate) =>
                    handleUpdateElement(
                      elementId,
                      {
                        style: {
                          rotate,
                        },
                      },
                      { recordHistory: false },
                    )
                  }
                  onUpdateElementContent={(elementId, content, style) =>
                    handleUpdateElement(elementId, {
                      content,
                      style,
                    })
                  }
                  onBeginElementChange={beginProjectHistoryGroup}
                  onFinishElementChange={finishProjectHistoryGroup}
                  slideSurfaceRef={slideSurfaceRef}
                  animationPreviewKey={animationPreviewKey}
                  animationTimelineTimeMs={
                    mode === "animation"
                      ? animationTimelineCurrentTimeMs
                      : undefined
                  }
                  animationClipPreviewId={
                    mode === "animation"
                      ? effectiveAnimationClipPreview?.clipId
                      : undefined
                  }
                />
              </div>
              {mode === "animation" ? (
                <AnimationTimeline
                  elements={activeSlide.elements}
                  clips={activeSlideTimelineClips}
                  currentTimeMs={animationTimelineCurrentTimeMs}
                  playbackStatus={
                    effectiveAnimationClipPreview
                      ? "idle"
                      : timelinePlayback.status
                  }
                  clipPreviewStatus={selectedClipPreviewStatus}
                  clipPreviewAvailable={Boolean(selectedClipPreviewWindow)}
                  activeAnimationContext={
                    effectiveActiveAnimationContext ?? undefined
                  }
                  onCurrentTimeChange={handleAnimationTimelineTimeChange}
                  onSelectClip={handleFocusTimelineClip}
                  onOpenClipDetails={handleOpenAnimationClipDetails}
                  onTogglePlayback={handleToggleTimelinePlayback}
                  onToggleClipPreview={
                    handleToggleSelectedAnimationClipPreview
                  }
                  onReplayClipPreview={handleReplaySelectedAnimationClip}
                  onStopClipPreview={handleStopAnimationClipPreview}
                  onStopPlayback={handleStopTimelinePlayback}
                />
              ) : null}
            </div>
            {showPropertyPanel ? (
              <div className="min-h-0 overflow-y-auto pr-1">
                <PropertyPanel
                  selectedElements={selectedElements}
                  targetElementIds={effectivePropertyTargetElementIds}
                  slideElements={activeSlide.elements}
                  readOnly={isDuplicateReviewActive}
                  animationScene={activeSlide.animationScene}
                  activeAnimationContext={
                    effectiveActiveAnimationContext ?? undefined
                  }
                  animationWorkspaceDisplayMode={animationWorkspaceDisplayMode}
                  onAnimationWorkspaceDisplayModeChange={
                    handleAnimationWorkspaceDisplayModeChange
                  }
                  onOpenAnimationClipDetails={handleOpenAnimationClipDetails}
                  onSelectAnimationClip={handleSelectAnimationClip}
                  onUpdateAnimationClipTiming={handleUpdateAnimationClipTiming}
                  onOpenAnimationWorkspace={handleOpenAnimationWorkspace}
                  onTargetElementIdsChange={
                    handlePropertyTargetElementIdsChange
                  }
                  onUpdateElements={handleUpdateElements}
                  onBeginPropertyChange={beginProjectHistoryGroup}
                  onFinishPropertyChange={finishProjectHistoryGroup}
                  onDeleteElement={handleDeleteElement}
                  onLayerElement={handleLayerElement}
                />
              </div>
            ) : null}
          </section>
        </section>
      </main>

      <AnimationFloatingPanel
        visible={
          mode === "animation" &&
          (animationWorkspaceDisplayMode === "always" || animationPanelOpen)
        }
        persistent={animationWorkspaceDisplayMode === "always"}
        scene={activeSlide.animationScene}
        elements={selectedElements}
        activeAnimationContext={effectiveActiveAnimationContext ?? undefined}
        onSelectClip={handleSelectAnimationClipFromWorkspace}
        onClose={() => setAnimationPanelOpen(false)}
        onReplayAnimation={handleReplayCurrentSlideAnimation}
        clipPreviewStatus={selectedClipPreviewStatus}
        clipPreviewAvailable={Boolean(selectedClipPreviewWindow)}
        onToggleClipPreview={handleToggleSelectedAnimationClipPreview}
        onReplayClipPreview={handleReplaySelectedAnimationClip}
        onStopClipPreview={handleStopAnimationClipPreview}
        onAddClip={handleAddAnimationClip}
        onDuplicateClip={handleDuplicateAnimationClip}
        onDeleteClip={handleDeleteAnimationClip}
        onUpdateClipTiming={handleUpdateAnimationClipTiming}
        onUpdateElements={handleUpdateElements}
        onUpdateClipTimings={handleUpdateAnimationClipTimings}
        onUpdateClipEasings={handleUpdateAnimationClipEasings}
        onUpdateKeyframeValue={handleUpdateAnimationKeyframeValue}
        onUpdateKeyframeEasing={handleUpdateAnimationKeyframeEasing}
        onUpdateKeyframeOffset={handleUpdateAnimationKeyframeOffset}
        onAddKeyframe={handleAddAnimationKeyframe}
        onDeleteKeyframe={handleDeleteAnimationKeyframe}
        onBeginChange={beginProjectHistoryGroup}
        onFinishChange={finishProjectHistoryGroup}
      />

      {activeDuplicateReview &&
      project.assets[activeDuplicateReview.duplicateAssetId] ? (
        <DuplicateResourceReviewPanel
          candidate={{
            name: activeDuplicateReview.file.name,

            size: activeDuplicateReview.file.size,

            type: activeDuplicateReview.assetType,
          }}
          existingAsset={project.assets[activeDuplicateReview.duplicateAssetId]}
          existingUsageCount={project.slides.reduce(
            (usageCount, slide) =>
              usageCount +
              slide.elements.filter(
                (element) =>
                  element.assetId === activeDuplicateReview.duplicateAssetId,
              ).length,
            0,
          )}
          reviewIndex={activeDuplicateReview.reviewIndex}
          reviewTotal={activeDuplicateReview.reviewTotal}
          onLocateExisting={handleLocateExistingDuplicateResource}
          onUseExisting={handleUseExistingDuplicateResource}
          onKeepDuplicate={handleKeepDuplicateResource}
          onSkip={handleSkipDuplicateResource}
        />
      ) : null}

      {elementContextMenu ? (
        <div
          className="fixed z-9999 w-44 overflow-hidden rounded-2xl border border-slate-200 bg-white p-1 text-sm shadow-2xl"
          style={{
            left: elementContextMenu.x,
            top: elementContextMenu.y,
          }}
          onClick={(event) => event.stopPropagation()}
          onContextMenu={(event) => event.preventDefault()}
        >
          <button
            type="button"
            className="w-full rounded-xl px-3 py-2 text-left font-semibold text-slate-700 transition hover:bg-violet-50 hover:text-violet-600"
            onClick={() => handleElementContextMenuAction("copy")}
          >
            复制
          </button>

          <button
            type="button"
            className="w-full rounded-xl px-3 py-2 text-left font-semibold text-slate-700 transition hover:bg-violet-50 hover:text-violet-600 disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:bg-white"
            disabled={!hasCopiedElements}
            onClick={() => handleElementContextMenuAction("paste")}
          >
            粘贴
          </button>

          <button
            type="button"
            className="w-full rounded-xl px-3 py-2 text-left font-semibold text-slate-700 transition hover:bg-violet-50 hover:text-violet-600"
            onClick={() => handleElementContextMenuAction("duplicate")}
          >
            复制副本
          </button>

          <div className="my-1 h-px bg-slate-100" />

          <button
            type="button"
            className="w-full rounded-xl px-3 py-2 text-left font-semibold text-slate-700 transition hover:bg-violet-50 hover:text-violet-600"
            onClick={() => handleElementContextMenuAction("bring-to-front")}
          >
            置于顶层
          </button>

          <button
            type="button"
            className="w-full rounded-xl px-3 py-2 text-left font-semibold text-slate-700 transition hover:bg-violet-50 hover:text-violet-600"
            onClick={() => handleElementContextMenuAction("send-to-back")}
          >
            置于底层
          </button>

          <div className="my-1 h-px bg-slate-100" />

          <button
            type="button"
            className="w-full rounded-xl px-3 py-2 text-left font-semibold text-red-600 transition hover:bg-red-50"
            onClick={() => handleElementContextMenuAction("delete")}
          >
            删除
          </button>
        </div>
      ) : null}

      {canvasContextMenu ? (
        <div
          className="fixed z-9999 w-44 overflow-hidden rounded-2xl border border-slate-200 bg-white p-1 text-sm shadow-2xl"
          style={{
            left: canvasContextMenu.x,
            top: canvasContextMenu.y,
          }}
          onClick={(event) => event.stopPropagation()}
          onContextMenu={(event) => event.preventDefault()}
        >
          <button
            type="button"
            className="w-full rounded-xl px-3 py-2 text-left font-semibold text-slate-700 transition hover:bg-violet-50 hover:text-violet-600 disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:bg-white"
            disabled={!hasCopiedElements}
            onClick={() => handleCanvasContextMenuAction("paste")}
          >
            粘贴
          </button>

          <div className="my-1 h-px bg-slate-100" />

          <button
            type="button"
            className="w-full rounded-xl px-3 py-2 text-left font-semibold text-slate-700 transition hover:bg-violet-50 hover:text-violet-600"
            onClick={() => handleCanvasContextMenuAction("add-text")}
          >
            添加文本
          </button>

          <button
            type="button"
            className="w-full rounded-xl px-3 py-2 text-left font-semibold text-slate-700 transition hover:bg-violet-50 hover:text-violet-600"
            onClick={() => handleCanvasContextMenuAction("add-shape")}
          >
            添加形状
          </button>

          <button
            type="button"
            className="w-full rounded-xl px-3 py-2 text-left font-semibold text-slate-700 transition hover:bg-violet-50 hover:text-violet-600"
            onClick={() => handleCanvasContextMenuAction("add-image")}
          >
            添加图片
          </button>
        </div>
      ) : null}
    </DndContext>
  );
}

function SlideNavigator({
  project,
  assetSources,
  assetStoreReady,
  missingAssetIds,
  activeSlideId,
  readOnly,
  onAddSlide,
  onSelectSlide,
  onDeleteSlide,
  onDuplicateSlide,
}: {
  project: PresentationProject;
  assetSources: Record<string, string>;
  assetStoreReady: boolean;
  missingAssetIds: string[];
  activeSlideId: string;
  readOnly: boolean;
  onAddSlide: () => void;
  onSelectSlide: (slideId: string) => void;
  onDeleteSlide: (slideId: string) => void;
  onDuplicateSlide: (slideId: string) => void;
}) {
  const previewWidth = 112;
  const previewScale = previewWidth / project.width;
  const previewHeight = Math.round(project.height * previewScale);
  const slideIds = project.slides.map((slide) => slide.id);

  return (
    <aside className="flex min-h-0 flex-col rounded-3xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex shrink-0 items-center justify-between">
        <div>
          <p className="text-xs font-bold text-violet-400">页面</p>
          <h2 className="text-base font-black text-slate-950">幻灯片</h2>
        </div>

        <button
          type="button"
          disabled={readOnly}
          className={`flex h-9 w-9 items-center justify-center rounded-2xl text-lg font-black transition ${
            readOnly
              ? "cursor-not-allowed bg-slate-200 text-slate-400"
              : "bg-violet-500 text-white shadow-sm hover:bg-violet-600"
          }`}
          onClick={onAddSlide}
          title={readOnly ? "重复资源确认期间不可新增页面" : "新增页面"}
        >
          +
        </button>
      </div>

      <div className="mt-3 min-h-0 flex-1 space-y-3 overflow-y-auto overflow-x-hidden pr-2">
        <SortableContext
          items={slideIds}
          strategy={verticalListSortingStrategy}
        >
          {project.slides.map((slide, index) => (
            <SortableSlideCard
              key={slide.id}
              readOnly={readOnly}
              slide={slide}
              index={index}
              isActive={slide.id === activeSlideId}
              slideCount={project.slides.length}
              previewWidth={previewWidth}
              previewHeight={previewHeight}
              previewScale={previewScale}
              assets={project.assets}
              assetSources={assetSources}
              assetStoreReady={assetStoreReady}
              missingAssetIds={missingAssetIds}
              onSelectSlide={onSelectSlide}
              onDeleteSlide={onDeleteSlide}
              onDuplicateSlide={onDuplicateSlide}
            />
          ))}
        </SortableContext>
      </div>
    </aside>
  );
}

function SortableSlideCard({
  slide,
  index,
  isActive,
  slideCount,
  previewWidth,
  previewHeight,
  previewScale,
  assets,
  assetSources,
  assetStoreReady,
  missingAssetIds,
  readOnly,
  onSelectSlide,
  onDeleteSlide,
  onDuplicateSlide,
}: {
  slide: PresentationProject["slides"][number];
  index: number;
  isActive: boolean;
  slideCount: number;
  previewWidth: number;
  previewHeight: number;
  previewScale: number;
  assets: PresentationProject["assets"];
  assetSources: Record<string, string>;
  assetStoreReady: boolean;
  missingAssetIds: string[];
  readOnly: boolean;
  onSelectSlide: (slideId: string) => void;
  onDeleteSlide: (slideId: string) => void;
  onDuplicateSlide: (slideId: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: slide.id,

    disabled: readOnly,

    data: {
      kind: "slide",
    },
  });

  return (
    <article
      ref={setNodeRef}
      className={`w-full cursor-pointer overflow-hidden rounded-2xl border p-2 text-left transition ${
        isActive
          ? "border-violet-400 bg-violet-50 shadow-sm"
          : "border-slate-200 bg-white hover:border-violet-200 hover:bg-slate-50"
      } ${isDragging ? "z-20 opacity-60 shadow-lg" : ""}`}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      onClick={() => onSelectSlide(slide.id)}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1">
          <button
            type="button"
            disabled={readOnly}
            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-xs font-black transition ${
              readOnly
                ? "cursor-not-allowed text-slate-300"
                : "cursor-grab text-slate-400 hover:bg-violet-100 hover:text-violet-500 active:cursor-grabbing"
            }`}
            onClick={(event) => event.stopPropagation()}
            title="拖拽排序"
            {...attributes}
            {...listeners}
          >
            ⋮⋮
          </button>

          <span className="truncate text-xs font-black text-slate-700">
            {index + 1}. {slide.title}
          </span>
        </div>

        <span
          className={`h-2 w-2 shrink-0 rounded-full ${
            isActive ? "bg-violet-500" : "bg-slate-300"
          }`}
        />
      </div>

      <div
        className="relative mx-auto overflow-hidden rounded-xl border border-slate-200 bg-slate-50 shadow-inner"
        style={{
          width: previewWidth,
          height: previewHeight,
          backgroundColor: slide.backgroundColor,
        }}
      >
        {slide.elements.map((element) => {
          const style = element.style;

          // Thumbnail previews use the same asset store as the main canvas.
          // Image elements only keep assetId, so the real image source must be
          // resolved from project.assets before rendering.
          const asset = element.assetId ? assets[element.assetId] : undefined;

          const assetSource = element.assetId
            ? assetSources[element.assetId]
            : undefined;

          const assetMissing = Boolean(
            element.assetId && missingAssetIds.includes(element.assetId),
          );

          const isImageElement =
            element.type === "image" &&
            asset?.type === "image" &&
            Boolean(assetSource) &&
            !assetMissing;

          return (
            <div
              key={element.id}
              className="absolute flex items-center justify-center overflow-hidden whitespace-nowrap text-center"
              style={{
                left: style.x * previewScale,
                top: style.y * previewScale,
                width: style.width * previewScale,
                height: style.height * previewScale,
                transform: `rotate(${style.rotate}deg)`,
                opacity: style.opacity,
                color: style.color ?? "#0f172a",
                backgroundColor: style.backgroundColor ?? "transparent",
                fontSize: (style.fontSize ?? 16) * previewScale,
                fontWeight: style.fontWeight ?? 400,
                borderRadius: (style.borderRadius ?? 0) * previewScale,
              }}
            >
              {isImageElement ? (
                <img
                  src={assetSource}
                  alt={asset?.name ?? "image"}
                  draggable={false}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    display: "block",
                    pointerEvents: "none",
                    userSelect: "none",
                    borderRadius: (style.borderRadius ?? 0) * previewScale,
                  }}
                />
              ) : element.type === "image" ? (
                <div
                  className={`flex h-full w-full items-center justify-center text-[10px] font-black ${
                    assetStoreReady
                      ? "bg-rose-50 text-rose-500"
                      : "bg-slate-100 text-slate-400"
                  }`}
                  title={
                    assetStoreReady
                      ? `资源缺失：${asset?.name ?? element.content}`
                      : "资源加载中"
                  }
                >
                  {assetStoreReady ? "⚠" : "…"}
                </div>
              ) : (
                element.content
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-slate-400">
          {slide.elements.length} 个元素
        </span>

        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={readOnly}
            className="rounded-full bg-violet-50 px-2 py-1 text-xs font-bold text-violet-500 transition hover:bg-violet-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-300"
            onClick={(event) => {
              event.stopPropagation();
              onDuplicateSlide(slide.id);
            }}
          >
            复制
          </button>

          <button
            type="button"
            className="rounded-full bg-red-50 px-2 py-1 text-xs font-bold text-red-500 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-40"
            disabled={readOnly || slideCount <= 1}
            onClick={(event) => {
              event.stopPropagation();
              onDeleteSlide(slide.id);
            }}
          >
            删除
          </button>
        </div>
      </div>
    </article>
  );
}

export default App;
