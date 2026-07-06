import { DndContext, type DragEndEvent } from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useCallback, useEffect, useRef, useState } from "react";
import { ComponentLibrary } from "./components/editor/ComponentLibrary";
import { PropertyPanel } from "./components/editor/PropertyPanel";
import { SlideCanvas } from "./components/editor/SlideCanvas";
import { demoProject } from "./data/demoProject";
import { exportProjectAsHtml } from "./utils/exportHtml";
import type {
  PresentationProject,
  SlideElement,
  SlideElementType,
} from "./types/presentation";

const STORAGE_KEY = "animify-project";

type EditorMode = "edit" | "animation" | "present";

type ProjectUpdater = (
  currentProject: PresentationProject,
) => PresentationProject;

const MAX_HISTORY_LENGTH = 60;
const HISTORY_MERGE_DELAY = 600;

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

function loadSavedProject(): PresentationProject {
  const savedProject = localStorage.getItem(STORAGE_KEY);

  if (!savedProject) {
    return demoProject;
  }

  try {
    const parsedProject = JSON.parse(savedProject) as PresentationProject;

    return {
      ...parsedProject,
      slides: normalizeSlideTitles(parsedProject.slides),
    };
  } catch {
    return demoProject;
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

  return {
    ...slide,
    id: `slide-copy-${now}`,
    title: `第 ${slideNumber} 页`,
    elements: slide.elements.map((element, elementIndex) => ({
      ...element,
      id: `${element.id}-copy-${now}-${elementIndex}`,
      style: {
        ...element.style,
      },
      animations: element.animations.map((animation, animationIndex) => ({
        ...animation,
        id: `${animation.id}-copy-${now}-${elementIndex}-${animationIndex}`,
      })),
    })),
  };
}

function areElementsOverlapping(
  firstElement: SlideElement,
  secondElement: SlideElement,
) {
  const firstStyle = firstElement.style;
  const secondStyle = secondElement.style;

  return (
    firstStyle.x < secondStyle.x + secondStyle.width &&
    firstStyle.x + firstStyle.width > secondStyle.x &&
    firstStyle.y < secondStyle.y + secondStyle.height &&
    firstStyle.y + firstStyle.height > secondStyle.y
  );
}

function App() {
  const [project, setProject] = useState<PresentationProject>(loadSavedProject);
  const [mode, setMode] = useState<EditorMode>("edit");
  const [componentPanelOpen, setComponentPanelOpen] = useState(false);
  const [animationPreviewKey, setAnimationPreviewKey] = useState(0);
  const [presentToolbarOpen, setPresentToolbarOpen] = useState(false);
  const undoStackRef = useRef<PresentationProject[]>([]);
  const redoStackRef = useRef<PresentationProject[]>([]);
  const lastHistoryAtRef = useRef(0);
  const lastHistoryKeyRef = useRef<string | null>(null);
  const slideSurfaceRef = useRef<HTMLDivElement | null>(null);
  const canvasAreaRef = useRef<HTMLDivElement | null>(null);
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

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
  }, [project]);

  const commitProjectChange = useCallback(
    (updater: ProjectUpdater, historyKey = "default") => {
      setProject((currentProject) => {
        const nextProject = updater(currentProject);

        if (nextProject === currentProject) {
          return currentProject;
        }

        const now = Date.now();
        const isContinuousElementChange =
          historyKey.startsWith("move:") ||
          historyKey.startsWith("resize:") ||
          historyKey.startsWith("rotate:");

        const shouldMergeWithPrevious =
          lastHistoryKeyRef.current === historyKey &&
          (isContinuousElementChange ||
            now - lastHistoryAtRef.current < HISTORY_MERGE_DELAY);

        if (!shouldMergeWithPrevious) {
          undoStackRef.current = [
            ...undoStackRef.current,
            currentProject,
          ].slice(-MAX_HISTORY_LENGTH);
        }

        redoStackRef.current = [];
        lastHistoryAtRef.current = now;
        lastHistoryKeyRef.current = historyKey;

        return nextProject;
      });
    },
    [],
  );

  const finishProjectHistoryGroup = useCallback(() => {
    lastHistoryAtRef.current = 0;
    lastHistoryKeyRef.current = null;
  }, []);

  const undoProject = useCallback(() => {
    setProject((currentProject) => {
      const previousProject = undoStackRef.current.at(-1);

      if (!previousProject) {
        return currentProject;
      }

      undoStackRef.current = undoStackRef.current.slice(0, -1);
      redoStackRef.current = [...redoStackRef.current, currentProject].slice(
        -MAX_HISTORY_LENGTH,
      );
      lastHistoryAtRef.current = 0;
      lastHistoryKeyRef.current = null;

      const previousActiveSlide = previousProject.slides.find(
        (slide) => slide.id === previousProject.activeSlideId,
      );

      setSelectedElementId(previousActiveSlide?.elements[0]?.id ?? "");
      setAnimationPreviewKey((key) => key + 1);

      return previousProject;
    });
  }, [setAnimationPreviewKey, setSelectedElementId]);

  const redoProject = useCallback(() => {
    setProject((currentProject) => {
      const nextProject = redoStackRef.current.at(-1);

      if (!nextProject) {
        return currentProject;
      }

      redoStackRef.current = redoStackRef.current.slice(0, -1);
      undoStackRef.current = [...undoStackRef.current, currentProject].slice(
        -MAX_HISTORY_LENGTH,
      );
      lastHistoryAtRef.current = 0;
      lastHistoryKeyRef.current = null;

      const nextActiveSlide = nextProject.slides.find(
        (slide) => slide.id === nextProject.activeSlideId,
      );

      setSelectedElementId(nextActiveSlide?.elements[0]?.id ?? "");
      setAnimationPreviewKey((key) => key + 1);

      return nextProject;
    });
  }, [setAnimationPreviewKey, setSelectedElementId]);

  useEffect(() => {
    function handleHistoryKeyDown(event: KeyboardEvent) {
      const target = event.target;

      const isTyping =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target instanceof HTMLElement && target.isContentEditable);

      if (isTyping || mode === "present") {
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
    if (mode === "present" || !selectedElementId) {
      return;
    }

    function handleElementNudge(event: KeyboardEvent) {
      const target = event.target;

      const isTyping =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target instanceof HTMLElement && target.isContentEditable);

      if (isTyping) {
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
              if (element.id !== selectedElementId) {
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
      }, `nudge:${selectedElementId}`);
    }

    window.addEventListener("keydown", handleElementNudge);

    return () => {
      window.removeEventListener("keydown", handleElementNudge);
    };
  }, [commitProjectChange, mode, selectedElementId]);

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
          <SlideCanvas
            slide={activeSlide}
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

  const selectedElement =
    activeSlide.elements.find((element) => element.id === selectedElementId) ??
    activeSlide.elements[0];

  const activeSlideElementCount = activeSlide.elements.length;

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
  }

  function handleUpdateElement(
    elementId: string,
    updates: Partial<Omit<SlideElement, "style">> & {
      style?: Partial<SlideElement["style"]>;
    },
    historyKey = `update-element:${elementId}`,
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
      historyKey,
    );
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
  }

  function handleLayerElement(
    elementId: string,
    action:
      | "bring-forward"
      | "send-backward"
      | "bring-to-front"
      | "send-to-back",
  ) {
    commitProjectChange((currentProject) => {
      let changed = false;

      const nextSlides = currentProject.slides.map((slide) => {
        if (slide.id !== currentProject.activeSlideId) {
          return slide;
        }

        const currentIndex = slide.elements.findIndex(
          (element) => element.id === elementId,
        );

        if (currentIndex === -1) {
          return slide;
        }

        const currentElement = slide.elements[currentIndex];

        if (!currentElement) {
          return slide;
        }

        let nextIndex = currentIndex;

        if (action === "bring-forward") {
          const overlappingUpperIndex = slide.elements.findIndex(
            (element, index) =>
              index > currentIndex &&
              areElementsOverlapping(currentElement, element),
          );

          if (overlappingUpperIndex === -1) {
            return slide;
          }

          nextIndex = overlappingUpperIndex;
        }

        if (action === "send-backward") {
          for (let index = currentIndex - 1; index >= 0; index -= 1) {
            const element = slide.elements[index];

            if (element && areElementsOverlapping(currentElement, element)) {
              nextIndex = index;
              break;
            }
          }

          if (nextIndex === currentIndex) {
            return slide;
          }
        }

        if (action === "bring-to-front") {
          nextIndex = slide.elements.length - 1;
        }

        if (action === "send-to-back") {
          nextIndex = 0;
        }

        if (nextIndex === currentIndex) {
          return slide;
        }

        const nextElements = [...slide.elements];
        const [targetElement] = nextElements.splice(currentIndex, 1);

        if (!targetElement) {
          return slide;
        }

        nextElements.splice(nextIndex, 0, targetElement);
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

  function handleExportHtml() {
    exportProjectAsHtml(project);
  }

  function handleResetProject() {
    const firstElementId = demoProject.slides[0]?.elements[0]?.id ?? "";

    localStorage.removeItem(STORAGE_KEY);
    commitProjectChange(() => demoProject);
    setSelectedElementId(firstElementId);
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

  function handleDragEnd(event: DragEndEvent) {
    const draggedKind = event.active.data.current?.kind;

    if (draggedKind === "slide") {
      const overSlideId = event.over?.id;

      if (!overSlideId) {
        return;
      }

      handleReorderSlide(String(event.active.id), String(overSlideId));
      return;
    }

    if (event.over?.id !== "slide-canvas-droppable") {
      return;
    }

    const draggedType = event.active.data.current?.type;

    if (!isSlideElementType(draggedType)) {
      return;
    }

    handleAddElement(draggedType, getDropPosition(event));
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
                  onClick={() => setMode("animation")}
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
                ? "xl:grid-cols-[280px_180px_minmax(0,1fr)_320px]"
                : "xl:grid-cols-[72px_180px_minmax(0,1fr)_320px]"
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

                <ComponentLibrary onAddElement={handleAddElement} />
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
                  scale={canvasScale}
                  selectedElementId={selectedElement?.id}
                  onSelectElement={setSelectedElementId}
                  onMoveElement={(elementId, position) =>
                    handleUpdateElement(
                      elementId,
                      {
                        style: position,
                      },
                      `move:${elementId}`,
                    )
                  }
                  onResizeElement={(elementId, style) =>
                    handleUpdateElement(
                      elementId,
                      {
                        style,
                      },
                      `resize:${elementId}`,
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
                      `rotate:${elementId}`,
                    )
                  }
                  onUpdateElementContent={(elementId, content, style) =>
                    handleUpdateElement(
                      elementId,
                      {
                        content,
                        style,
                      },
                      `content:${elementId}:${Date.now()}`,
                    )
                  }
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
                      const animation = element.animations[0];

                      return (
                        <div
                          key={element.id}
                          className="grid grid-cols-[120px_minmax(0,1fr)] items-center gap-3 rounded-2xl bg-slate-50 px-3 py-1"
                        >
                          <div className="truncate text-sm font-semibold text-slate-700">
                            {index + 1}. {element.content || element.id}
                          </div>

                          <div className="relative h-6 rounded-full bg-white">
                            {animation ? (
                              <div
                                className="absolute top-1 h-5 rounded-full bg-violet-400 px-3 text-xs font-semibold leading-5 text-white shadow-sm"
                                style={{
                                  left: `${Math.min(animation.delay / 30, 70)}%`,
                                  width: `${Math.min(
                                    Math.max(animation.duration / 40, 12),
                                    80,
                                  )}%`,
                                }}
                              >
                                {animation.keyframes}
                              </div>
                            ) : (
                              <span className="px-3 text-xs leading-7 text-slate-400">
                                暂无动画
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              ) : null}
            </div>
            <div className="min-h-0 overflow-y-auto pr-1">
              <PropertyPanel
                selectedElement={selectedElement}
                onUpdateElement={handleUpdateElement}
                onDeleteElement={handleDeleteElement}
                onLayerElement={handleLayerElement}
              />
            </div>
          </section>
        </section>
      </main>
    </DndContext>
  );
}

function SlideNavigator({
  project,
  activeSlideId,
  onAddSlide,
  onSelectSlide,
  onDeleteSlide,
  onDuplicateSlide,
}: {
  project: PresentationProject;
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
              {element.content}
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
