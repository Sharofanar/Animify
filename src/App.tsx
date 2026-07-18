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
import { PropertyPanel } from "./components/editor/PropertyPanel";
import { SlideCanvas } from "./components/editor/SlideCanvas";
import { demoProject } from "./data/demoProject";
import { exportProjectAsHtml } from "./utils/exportHtml";
import {
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
  AnimationClip,
  AnimationScene,
  PresentationAsset,
  PresentationProject,
  SlideElement,
  SlideElementType,
} from "./types/presentation";

const STORAGE_KEY = "animify-project";

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

function getAnimationClipCategoryLabel(category: AnimationClip["category"]) {
  switch (category) {
    case "enter":
      return "进入";

    case "emphasis":
      return "强调";

    case "exit":
      return "退出";

    case "motion":
      return "路径";

    case "interaction":
      return "交互";

    case "custom":
      return "自定义";
  }
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
function cloneAnimationSceneSnapshot(
  scene: AnimationScene,
) {
  return JSON.parse(
    JSON.stringify(scene),
  ) as AnimationScene;
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

function App() {
  const [project, setProject] = useState<PresentationProject>(loadSavedProject);
  const latestProjectRef = useRef(project);
  const [mode, setMode] = useState<EditorMode>("edit");
  const [componentPanelOpen, setComponentPanelOpen] = useState(false);
  const [animationPreviewKey, setAnimationPreviewKey] = useState(0);
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
   * The floating animation workspace is hidden outside animation mode, but its
   * open state and dragged position remain available when the user returns.
   */
  const [animationPanelOpen, setAnimationPanelOpen] = useState(true);

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

  const commitProjectChange = useCallback(
    (updater: ProjectUpdater, options: { recordHistory?: boolean } = {}) => {
      const currentProject = latestProjectRef.current;
      const nextProject = updater(currentProject);

      if (nextProject === currentProject) {
        return;
      }

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
    [pushUndoSnapshot],
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
    const previousProject = undoStackRef.current.at(-1);

    if (!previousProject) {
      return;
    }

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
  }, [setAnimationPreviewKey, setSelectedElementId]);

  const redoProject = useCallback(() => {
    const nextProject = redoStackRef.current.at(-1);

    if (!nextProject) {
      return;
    }

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
  }, [setAnimationPreviewKey, setSelectedElementId]);

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
      ? Object.values(activeAnimationScene.clips).sort(
          (left, right) =>
            left.startMs - right.startMs || left.name.localeCompare(right.name),
        )
      : [];

  /**
   * The furthest Clip end defines the visible timeline scale.
   */
  const animationTimelineDurationMs = Math.max(
    1,
    ...activeSlideTimelineClips.map((clip) => clip.startMs + clip.durationMs),
  );

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
    if (!assetStoreReady) {
      window.alert("资源存储正在初始化，请稍后再添加图片。");
      return;
    }

    imageInputRef.current?.click();
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

    if (mode === "animation") {
      setAnimationPanelOpen(true);
    }
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

    if (mode === "animation" && nextSelectedElementIds.length > 0) {
      setAnimationPanelOpen(true);
    }
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

    if (mode === "animation" && elementIds.length > 0) {
      setAnimationPanelOpen(true);
    }
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

      window.alert("HTML 导出失败。可能存在缺失或无法读取的资源文件。");
    }
  }

  function handleResetProject() {
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

    setProject((currentProject) => ({
      ...currentProject,
      activeSlideId: slideId,
      updatedAt: new Date().toISOString(),
    }));

    setSelectedElementId(nextSlide.elements[0]?.id ?? "");
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
   * Select one lower-timeline Clip and open the detailed track inspector.
   */
  function handleFocusTimelineClip(elementId: string, clipId: string) {
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
                  onClick={() => setMode("edit")}
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
                  onClick={handleOpenAnimationWorkspace}
                >
                  动画
                </button>

                <button
                  type="button"
                  className="rounded-full px-4 py-2 text-sm font-semibold text-slate-500 transition hover:text-slate-900"
                  onClick={() => setMode("present")}
                >
                  放映
                </button>
              </div>

              <button
                type="button"
                className="rounded-full bg-violet-500 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-600"
                onClick={() => setAnimationPreviewKey((key) => key + 1)}
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
            </div>
          </header>

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
              <div className="relative">
                <button
                  type="button"
                  className="absolute right-4 top-4 z-10 rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-500 transition hover:bg-slate-200 hover:text-slate-900"
                  onClick={() => setComponentPanelOpen(false)}
                >
                  收起
                </button>

                <ComponentLibrary
                  onAddElement={handleAddElement}
                  onAddImage={handleOpenImagePicker}
                />
              </div>
            ) : (
              <aside className="flex min-h-130 flex-col items-center gap-4 rounded-3xl border border-slate-200 bg-white px-3 py-4 shadow-sm">
                <button
                  type="button"
                  className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-500 text-lg font-black text-white shadow-sm transition hover:bg-violet-600"
                  onClick={() => setComponentPanelOpen(true)}
                  title="展开组件库"
                >
                  +
                </button>

                <div className="[writing-mode:vertical-rl] text-xs font-bold tracking-[0.3em] text-slate-400">
                  组件库
                </div>
              </aside>
            )}

            <SlideNavigator
              project={project}
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
                />
              </div>
              {mode === "animation" ? (
                <section
                  className="mt-3 flex shrink-0 flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white p-4 shadow-sm"
                  style={{ height: 260 }}
                >
                  <div className="flex shrink-0 items-center justify-between">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.2em] text-violet-500">
                        TIMELINE
                      </p>
                      <h2 className="text-lg font-black text-slate-950">
                        动画时间轴
                      </h2>
                    </div>

                    <button
                      type="button"
                      className="rounded-full bg-violet-500 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-600"
                      onClick={() => setAnimationPreviewKey((key) => key + 1)}
                    >
                      播放当前页动画
                    </button>
                  </div>

                  <div className="mt-3 min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain pr-2">
                    {activeSlide.elements.map((element, index) => {
                      const elementClips = activeSlideTimelineClips.filter(
                        (clip) =>
                          clip.targets.some(
                            (target) => target.elementId === element.id,
                          ),
                      );

                      return (
                        <div
                          key={element.id}
                          className="grid grid-cols-[140px_minmax(0,1fr)] items-start gap-3 rounded-2xl bg-slate-50 px-3 py-1.5"
                        >
                          <div
                            className="truncate pt-1 text-sm font-semibold text-slate-700"
                            title={element.name}
                          >
                            {index + 1}.{" "}
                            {element.content || element.name || element.id}
                          </div>

                          {elementClips.length > 0 ? (
                            <div className="space-y-1">
                              {elementClips.map((clip) => {
                                const leftPercentage = Math.min(
                                  100,
                                  Math.max(
                                    0,
                                    (clip.startMs /
                                      animationTimelineDurationMs) *
                                      100,
                                  ),
                                );

                                const availablePercentage = Math.max(
                                  1,
                                  100 - leftPercentage,
                                );

                                const durationPercentage =
                                  (clip.durationMs /
                                    animationTimelineDurationMs) *
                                  100;

                                const widthPercentage = Math.min(
                                  availablePercentage,
                                  Math.max(4, durationPercentage),
                                );

                                const focused =
                                  effectiveActiveAnimationContext?.elementId ===
                                    element.id &&
                                  effectiveActiveAnimationContext.clipId ===
                                    clip.id;

                                return (
                                  <div
                                    key={clip.id}
                                    className="relative h-7 overflow-hidden rounded-full bg-white"
                                  >
                                    <button
                                      type="button"
                                      className={`absolute top-1 flex h-5 min-w-0 items-center gap-1 overflow-hidden rounded-full px-2 text-left text-[10px] font-black text-white shadow-sm transition hover:z-10 hover:brightness-105 ${
                                        focused
                                          ? "bg-violet-600 ring-2 ring-violet-300"
                                          : "bg-violet-400"
                                      }`}
                                      style={{
                                        left: `${leftPercentage}%`,
                                        width: `${widthPercentage}%`,
                                      }}
                                      title={`${clip.name} · ${getAnimationClipCategoryLabel(
                                        clip.category,
                                      )} · 开始 ${clip.startMs}ms · 时长 ${
                                        clip.durationMs
                                      }ms`}
                                      onClick={(event) => {
                                        event.stopPropagation();

                                        handleFocusTimelineClip(
                                          element.id,
                                          clip.id,
                                        );
                                      }}
                                    >
                                      <span className="min-w-0 flex-1 truncate">
                                        {clip.name}
                                      </span>

                                      <span className="shrink-0 rounded-full bg-white/20 px-1.5 text-[9px]">
                                        {getAnimationClipCategoryLabel(
                                          clip.category,
                                        )}
                                      </span>
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="h-7 rounded-full bg-white px-3 text-xs leading-7 text-slate-400">
                              暂无动画
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>
              ) : null}
            </div>
            {showPropertyPanel ? (
              <div className="min-h-0 overflow-y-auto pr-1">
                <PropertyPanel
                  selectedElements={selectedElements}
                  targetElementIds={effectivePropertyTargetElementIds}
                  slideElements={activeSlide.elements}
                  animationScene={activeSlide.animationScene}
                  activeAnimationContext={
                    effectiveActiveAnimationContext ?? undefined
                  }
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
        visible={mode === "animation" && animationPanelOpen}
        scene={activeSlide.animationScene}
        elements={selectedElements}
        activeAnimationContext={effectiveActiveAnimationContext ?? undefined}
        onSelectClip={handleSelectAnimationClipFromWorkspace}
        onClose={() => setAnimationPanelOpen(false)}
        onReplayAnimation={() => setAnimationPreviewKey((key) => key + 1)}
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
          className="flex h-9 w-9 items-center justify-center rounded-2xl bg-violet-500 text-lg font-black text-white shadow-sm transition hover:bg-violet-600"
          onClick={onAddSlide}
          title="新增页面"
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
            className="flex h-5 w-5 shrink-0 cursor-grab items-center justify-center rounded-md text-xs font-black text-slate-400 transition hover:bg-violet-100 hover:text-violet-500 active:cursor-grabbing"
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
            className="rounded-full bg-violet-50 px-2 py-1 text-xs font-bold text-violet-500 transition hover:bg-violet-100"
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
            disabled={slideCount <= 1}
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
