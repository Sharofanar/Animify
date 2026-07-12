import { useDroppable } from "@dnd-kit/core";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type {
  PresentationAsset,
  Slide,
  SlideElement,
} from "../../types/presentation";
import {
  compileSlideAnimations,
  type CompiledElementAnimation,
} from "../../utils/animationCompiler";

const SLIDE_WIDTH = 1280;
const SLIDE_HEIGHT = 720;

type ResizeDirection = "nw" | "ne" | "sw" | "se";
type SelectionBox = {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
};

type ElementStyleUpdate = {
  elementId: string;
  style: Partial<SlideElement["style"]>;
};

type SelectionBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

function getPointerAngle(
  clientX: number,
  clientY: number,
  centerX: number,
  centerY: number,
) {
  return (Math.atan2(clientY - centerY, clientX - centerX) * 180) / Math.PI;
}

function normalizeRotate(value: number) {
  return Math.round(((value % 360) + 360) % 360);
}

function clampSlideCoordinate(value: number, max: number) {
  return Math.min(Math.max(value, 0), max);
}

/**
 * Calculate the visible axis-aligned bounds of an element.
 *
 * Rotation is included so the multi-selection frame can fully cover rotated
 * elements instead of only using their unrotated width and height.
 */
function getElementVisualBounds(element: SlideElement): SelectionBounds {
  const { x, y, width, height, rotate } = element.style;
  const radians = (rotate * Math.PI) / 180;
  const absoluteCos = Math.abs(Math.cos(radians));
  const absoluteSin = Math.abs(Math.sin(radians));

  const visualWidth = width * absoluteCos + height * absoluteSin;
  const visualHeight = width * absoluteSin + height * absoluteCos;
  const centerX = x + width / 2;
  const centerY = y + height / 2;

  return {
    x: centerX - visualWidth / 2,
    y: centerY - visualHeight / 2,
    width: visualWidth,
    height: visualHeight,
  };
}

/**
 * Calculate one bounding rectangle around every selected element.
 */
function getSelectionBounds(
  elements: SlideElement[],
): SelectionBounds | null {
  if (elements.length === 0) {
    return null;
  }

  const elementBounds = elements.map(getElementVisualBounds);
  const left = Math.min(...elementBounds.map((bounds) => bounds.x));
  const top = Math.min(...elementBounds.map((bounds) => bounds.y));
  const right = Math.max(
    ...elementBounds.map((bounds) => bounds.x + bounds.width),
  );
  const bottom = Math.max(
    ...elementBounds.map((bounds) => bounds.y + bounds.height),
  );

  return {
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
  };
}

const resizeHandleConfigs: Array<{
  direction: ResizeDirection;
  className: string;
  label: string;
}> = [
  {
    direction: "nw",
    className: "-left-1.5 -top-1.5 cursor-nwse-resize",
    label: "左上角调整尺寸",
  },
  {
    direction: "ne",
    className: "-right-1.5 -top-1.5 cursor-nesw-resize",
    label: "右上角调整尺寸",
  },
  {
    direction: "sw",
    className: "-bottom-1.5 -left-1.5 cursor-nesw-resize",
    label: "左下角调整尺寸",
  },
  {
    direction: "se",
    className: "-bottom-1.5 -right-1.5 cursor-nwse-resize",
    label: "右下角调整尺寸",
  },
];

type SlideCanvasProps = {
  slide: Slide;
  assets?: Record<string, PresentationAsset>;
  scale?: number;
  selectedElementId?: string;
  selectedElementIds?: string[];
  propertyTargetElementIds?: string[];
  onSelectElement?: (elementId: string) => void;
  onToggleElementSelection?: (elementId: string) => void;
  onSelectElements?: (elementIds: string[]) => void;
  onClearSelection?: () => void;
  onOpenCanvasContextMenu?: (position: {
    x: number;
    y: number;
    slideX: number;
    slideY: number;
  }) => void;
  onOpenElementContextMenu?: (
    elementId: string,
    position: { x: number; y: number },
  ) => void;
  onMoveElement?: (
    elementId: string,
    position: { x: number; y: number },
  ) => void;
  onResizeElement?: (
    elementId: string,
    style: Partial<SlideElement["style"]>,
  ) => void;
  onResizeSelectedElements?: (updates: ElementStyleUpdate[]) => void;
  onRotateElement?: (elementId: string, rotate: number) => void;
  onBeginElementChange?: () => void;
  onFinishElementChange?: () => void;
  onUpdateElementContent?: (
    elementId: string,
    content: string,
    style?: Partial<SlideElement["style"]>,
  ) => void;
  slideSurfaceRef?: { current: HTMLDivElement | null };
  animationPreviewKey?: number;
  chrome?: boolean;
  clipOverflow?: boolean;
  bare?: boolean;
};

export function SlideCanvas({
  slide,
  assets = {},
  scale = 0.6,
  selectedElementId,
  selectedElementIds = [],
  propertyTargetElementIds = [],
  onSelectElement,
  onToggleElementSelection,
  onSelectElements,
  onClearSelection,
  onOpenCanvasContextMenu,
  onOpenElementContextMenu,
  onMoveElement,
  onResizeElement,
  onResizeSelectedElements,
  onRotateElement,
  onBeginElementChange,
  onFinishElementChange,
  onUpdateElementContent,
  slideSurfaceRef,
  animationPreviewKey = 0,
  chrome = true,
  clipOverflow = false,
  bare = false,
}: SlideCanvasProps) {
  const [editingElementId, setEditingElementId] = useState<string | null>(null);

  const [selectionBox, setSelectionBox] = useState<SelectionBox | null>(null);

  const slideSurfaceNodeRef = useRef<HTMLDivElement | null>(null);

  const { isOver, setNodeRef } = useDroppable({
    id: "slide-canvas-droppable",
  });

  /**
   * Compile the V2 animation scene only when the scene object changes.
   *
   * Selection, movement, and other editor-only rerenders reuse the same compiler
   * result instead of rebuilding every animation.
   */
  const compiledSlideAnimations = useMemo(
    () => compileSlideAnimations(slide.animationScene),
    [slide.animationScene],
  );

  /**
   * Old projects are normally normalized before rendering. This fallback remains
   * available in case a malformed or unmigrated slide reaches the canvas.
   */
  const legacyAnimationFallback =
    !slide.animationScene || slide.animationScene.schemaVersion !== 2;

  function setDropZoneRef(node: HTMLDivElement | null) {
    setNodeRef(node);
  }

  function setSlideSurfaceNode(node: HTMLDivElement | null) {
    slideSurfaceNodeRef.current = node;

    if (slideSurfaceRef) {
      slideSurfaceRef.current = node;
    }
  }

  /**
   * Start box selection from blank slide space.
   *
   * A short click without dragging still clears the current selection. Once the
   * pointer moves far enough, the drag area becomes a selection box and all
   * intersecting elements are selected when the pointer is released.
   */
  function handleSlideSurfacePointerDown(
    event: ReactPointerEvent<HTMLDivElement>,
  ) {
    if (event.button !== 0 || event.target !== event.currentTarget) {
      return;
    }

    event.preventDefault();

    const surfaceRect = event.currentTarget.getBoundingClientRect();
    const startX = clampSlideCoordinate(
      Math.round((event.clientX - surfaceRect.left) / scale),
      SLIDE_WIDTH,
    );
    const startY = clampSlideCoordinate(
      Math.round((event.clientY - surfaceRect.top) / scale),
      SLIDE_HEIGHT,
    );

    let hasDragged = false;

    setSelectionBox({
      startX,
      startY,
      currentX: startX,
      currentY: startY,
    });

    function handlePointerMove(moveEvent: PointerEvent) {
      const currentX = clampSlideCoordinate(
        Math.round((moveEvent.clientX - surfaceRect.left) / scale),
        SLIDE_WIDTH,
      );
      const currentY = clampSlideCoordinate(
        Math.round((moveEvent.clientY - surfaceRect.top) / scale),
        SLIDE_HEIGHT,
      );

      if (Math.abs(currentX - startX) > 4 || Math.abs(currentY - startY) > 4) {
        hasDragged = true;
      }

      setSelectionBox({
        startX,
        startY,
        currentX,
        currentY,
      });
    }

    function handlePointerUp(upEvent: PointerEvent) {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);

      setSelectionBox(null);

      if (!hasDragged) {
        onClearSelection?.();
        return;
      }

      const endX = clampSlideCoordinate(
        Math.round((upEvent.clientX - surfaceRect.left) / scale),
        SLIDE_WIDTH,
      );
      const endY = clampSlideCoordinate(
        Math.round((upEvent.clientY - surfaceRect.top) / scale),
        SLIDE_HEIGHT,
      );

      const boxLeft = Math.min(startX, endX);
      const boxTop = Math.min(startY, endY);
      const boxRight = Math.max(startX, endX);
      const boxBottom = Math.max(startY, endY);

      const selectedIds = slide.elements
        .filter((element) => {
          const elementLeft = element.style.x;
          const elementTop = element.style.y;
          const elementRight = element.style.x + element.style.width;
          const elementBottom = element.style.y + element.style.height;

          return (
            elementLeft < boxRight &&
            elementRight > boxLeft &&
            elementTop < boxBottom &&
            elementBottom > boxTop
          );
        })
        .map((element) => element.id);

      if (selectedIds.length > 0) {
        onSelectElements?.(selectedIds);
        return;
      }

      onClearSelection?.();
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  }

  /**
   * Open the canvas context menu when the user right-clicks blank slide space.
   *
   * The menu receives both screen coordinates for positioning the menu and slide
   * coordinates for inserting new elements near the clicked position.
   */
  function handleSlideSurfaceContextMenu(
    event: ReactMouseEvent<HTMLDivElement>,
  ) {
    if (event.target !== event.currentTarget) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const surfaceRect = event.currentTarget.getBoundingClientRect();

    onClearSelection?.();
    onOpenCanvasContextMenu?.({
      x: event.clientX,
      y: event.clientY,
      slideX: Math.round((event.clientX - surfaceRect.left) / scale),
      slideY: Math.round((event.clientY - surfaceRect.top) / scale),
    });
  }

  const selectedElements = slide.elements.filter((element) =>
    selectedElementIds.includes(element.id),
  );

  const multiSelectionActive = selectedElements.length > 1;
  const multiSelectionBounds = getSelectionBounds(selectedElements);

  /**
   * Move the current multi-selection by dragging one of the outer frame edges.
   *
   * The existing onMoveElement callback already understands multi-selection, so
   * the frame only needs to report the next position of one selected element.
   */
  function handleMultiSelectionMovePointerDown(
    event: ReactPointerEvent<HTMLDivElement>,
  ) {
    const primaryElement = selectedElements[0];

    if (
      event.button !== 0 ||
      !primaryElement ||
      !onMoveElement ||
      !multiSelectionActive
    ) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const startClientX = event.clientX;
    const startClientY = event.clientY;
    const startElementX = primaryElement.style.x;
    const startElementY = primaryElement.style.y;

    onBeginElementChange?.();

    function handlePointerMove(moveEvent: PointerEvent) {
      const deltaX = (moveEvent.clientX - startClientX) / scale;
      const deltaY = (moveEvent.clientY - startClientY) / scale;

      onMoveElement?.(primaryElement.id, {
        x: Math.round(startElementX + deltaX),
        y: Math.round(startElementY + deltaY),
      });
    }

    function handlePointerUp() {
      onFinishElementChange?.();

      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  }

  /**
   * Resize every selected element proportionally from one corner.
   *
   * Element centers, sizes, font sizes, and border radii are scaled around the
   * opposite corner. Rotation angles remain unchanged.
   */
  function handleMultiSelectionResizePointerDown(
    direction: ResizeDirection,
    event: ReactPointerEvent<HTMLButtonElement>,
  ) {
    const surfaceNode = slideSurfaceNodeRef.current;
    const resizeSelectedElements = onResizeSelectedElements;

    if (
      event.button !== 0 ||
      !surfaceNode ||
      !multiSelectionBounds ||
      !resizeSelectedElements ||
      !multiSelectionActive
    ) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const surfaceRect = surfaceNode.getBoundingClientRect();

    // Keep immutable copies so every pointer move is calculated from the same
    // starting state instead of repeatedly scaling already-scaled values.
    const initialElements: SlideElement[] = selectedElements.map((element) => ({
      ...element,
      style: {
        ...element.style,
      },
    }));

    const initialBounds = getSelectionBounds(initialElements);

    if (!initialBounds) {
      return;
    }

    const left = initialBounds.x;
    const top = initialBounds.y;
    const right = initialBounds.x + initialBounds.width;
    const bottom = initialBounds.y + initialBounds.height;

    // The corner opposite the dragged handle stays fixed.
    const anchorX = direction.includes("w") ? right : left;
    const anchorY = direction.includes("n") ? bottom : top;
    const startCornerX = direction.includes("w") ? left : right;
    const startCornerY = direction.includes("n") ? top : bottom;
    const initialVectorX = startCornerX - anchorX;
    const initialVectorY = startCornerY - anchorY;
    const initialVectorLengthSquared =
      initialVectorX * initialVectorX + initialVectorY * initialVectorY;

    if (initialVectorLengthSquared === 0) {
      return;
    }

    onBeginElementChange?.();

    function handlePointerMove(moveEvent: PointerEvent) {
      const pointerX = clampSlideCoordinate(
        (moveEvent.clientX - surfaceRect.left) / scale,
        SLIDE_WIDTH,
      );
      const pointerY = clampSlideCoordinate(
        (moveEvent.clientY - surfaceRect.top) / scale,
        SLIDE_HEIGHT,
      );

      const currentVectorX = pointerX - anchorX;
      const currentVectorY = pointerY - anchorY;

      // Vector projection produces one uniform scale factor, so the group keeps
      // its original aspect ratio regardless of the exact drag direction.
      const projectedScale =
        (currentVectorX * initialVectorX + currentVectorY * initialVectorY) /
        initialVectorLengthSquared;

      const scaleFactor = Math.max(0.08, projectedScale);

      const updates: ElementStyleUpdate[] = initialElements.map((element) => {
        const oldStyle = element.style;
        const oldCenterX = oldStyle.x + oldStyle.width / 2;
        const oldCenterY = oldStyle.y + oldStyle.height / 2;
        const newCenterX = anchorX + (oldCenterX - anchorX) * scaleFactor;
        const newCenterY = anchorY + (oldCenterY - anchorY) * scaleFactor;
        const nextWidth = Math.max(8, oldStyle.width * scaleFactor);
        const nextHeight = Math.max(8, oldStyle.height * scaleFactor);

        const nextStyle: Partial<SlideElement["style"]> = {
          x: Math.round(newCenterX - nextWidth / 2),
          y: Math.round(newCenterY - nextHeight / 2),
          width: Math.round(nextWidth),
          height: Math.round(nextHeight),
        };

        if (oldStyle.fontSize !== undefined) {
          nextStyle.fontSize = Math.max(
            8,
            Math.round(oldStyle.fontSize * scaleFactor),
          );
        }

        if (oldStyle.borderRadius !== undefined) {
          nextStyle.borderRadius = Math.max(
            0,
            Math.round(oldStyle.borderRadius * scaleFactor),
          );
        }

        return {
          elementId: element.id,
          style: nextStyle,
        };
      });

      resizeSelectedElements?.(updates);
    }

    function handlePointerUp() {
      onFinishElementChange?.();

      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  }

  const slideSurface = (
    <div
      ref={setSlideSurfaceNode}
      onPointerDown={handleSlideSurfacePointerDown}
      onContextMenu={handleSlideSurfaceContextMenu}
      className={`relative rounded-2xl shadow-xl ${
        clipOverflow ? "overflow-hidden" : "overflow-visible"
      }`}
      style={{
        width: SLIDE_WIDTH * scale,
        height: SLIDE_HEIGHT * scale,
        backgroundColor: slide.backgroundColor,
      }}
    >
      {selectionBox ? (
        <div
          className="pointer-events-none absolute z-30 border border-violet-500 bg-violet-500/15"
          style={{
            left: Math.min(selectionBox.startX, selectionBox.currentX) * scale,
            top: Math.min(selectionBox.startY, selectionBox.currentY) * scale,
            width:
              Math.abs(selectionBox.currentX - selectionBox.startX) * scale,
            height:
              Math.abs(selectionBox.currentY - selectionBox.startY) * scale,
          }}
        />
      ) : null}

      {slide.elements.map((element) => {
        const compiledAnimations =
          compiledSlideAnimations.byElementId[element.id] ?? [];

        /**
         * animationPreviewKey remounts the visual node when the user explicitly asks
         * to replay the current slide animations.
         */
        const animationKey = `${element.id}-${animationPreviewKey}`;

        const asset = element.assetId ? assets[element.assetId] : undefined;
        const selectionIndex = selectedElementIds.indexOf(element.id);
        const selectionNumber =
          multiSelectionActive && selectionIndex >= 0
            ? selectionIndex + 1
            : undefined;

        const propertyTargeted = propertyTargetElementIds.includes(element.id);

        return (
          <SlideElementView
            key={animationKey}
            element={element}
            asset={asset}
            scale={scale}
            compiledAnimations={compiledAnimations}
            legacyAnimationFallback={legacyAnimationFallback}
            selected={
              element.id === selectedElementId ||
              selectedElementIds.includes(element.id)
            }
            selectionNumber={selectionNumber}
            propertyTargeted={propertyTargeted}
            showTransformControls={!multiSelectionActive}
            isEditing={element.id === editingElementId}
            onSelect={onSelectElement}
            onToggleSelect={onToggleElementSelection}
            onOpenContextMenu={onOpenElementContextMenu}
            onMove={onMoveElement}
            onResize={onResizeElement}
            onRotate={onRotateElement}
            onBeginChange={onBeginElementChange}
            onFinishChange={onFinishElementChange}
            onStartEditing={setEditingElementId}
            onStopEditing={() => setEditingElementId(null)}
            onUpdateContent={onUpdateElementContent}
          />
        );
      })}
      {multiSelectionActive && multiSelectionBounds ? (
        <div
          className="pointer-events-none absolute z-40 border-2 border-violet-500"
          style={{
            left: multiSelectionBounds.x * scale,
            top: multiSelectionBounds.y * scale,
            width: multiSelectionBounds.width * scale,
            height: multiSelectionBounds.height * scale,
          }}
        >
          {/* Transparent edge hit areas let the user drag the unified frame. */}
          <div
            className="pointer-events-auto absolute -left-1 -right-1 -top-2 h-4 cursor-move"
            onPointerDown={handleMultiSelectionMovePointerDown}
          />
          <div
            className="pointer-events-auto absolute -bottom-2 -left-1 -right-1 h-4 cursor-move"
            onPointerDown={handleMultiSelectionMovePointerDown}
          />
          <div
            className="pointer-events-auto absolute -bottom-1 -left-2 -top-1 w-4 cursor-move"
            onPointerDown={handleMultiSelectionMovePointerDown}
          />
          <div
            className="pointer-events-auto absolute -bottom-1 -right-2 -top-1 w-4 cursor-move"
            onPointerDown={handleMultiSelectionMovePointerDown}
          />

          {resizeHandleConfigs.map((handle) => (
            <button
              key={handle.direction}
              type="button"
              className={`pointer-events-auto absolute z-50 h-4 w-4 rounded-full border-2 border-white bg-violet-500 shadow-md ${handle.className}`}
              aria-label={`整组${handle.label}`}
              title={`整组${handle.label}`}
              onPointerDown={(event) =>
                handleMultiSelectionResizePointerDown(handle.direction, event)
              }
              onClick={(event) => event.stopPropagation()}
            />
          ))}
        </div>
      ) : null}
    </div>
  );

  if (bare) {
    return (
      <>
        <CanvasAnimationStyles />
        {slideSurface}
      </>
    );
  }

  return (
    <section className="flex h-full min-h-0 flex-col rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
      <CanvasAnimationStyles />

      {chrome ? (
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-violet-400">当前画布</p>
            <h2 className="text-lg font-black text-slate-950">{slide.title}</h2>
          </div>

          <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-bold text-violet-600">
            {slide.elements.length} 个元素
          </span>
        </div>
      ) : null}

      <div
        ref={setDropZoneRef}
        className={`flex min-h-0 flex-1 items-center justify-center overflow-auto rounded-3xl bg-slate-100 p-6 transition ${
          isOver ? "ring-4 ring-violet-300" : ""
        }`}
      >
        {slideSurface}
      </div>
    </section>
  );
}

function measureTextElementSize(element: SlideElement, content: string) {
  if (element.type !== "text") {
    return undefined;
  }

  const style = element.style;
  const fontSize = style.fontSize ?? 16;
  const fontWeight = style.fontWeight ?? 400;
  const lines = content.split(/\r?\n/);
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context) {
    return undefined;
  }

  context.font = `${fontWeight} ${fontSize}px Inter, ui-sans-serif, system-ui, sans-serif`;

  const maxLineWidth = Math.max(
    ...lines.map((line) => context.measureText(line || " ").width),
  );

  const nextWidth = Math.max(48, Math.ceil(maxLineWidth + 28));
  const nextHeight = Math.max(
    32,
    Math.ceil(lines.length * fontSize * 1.25 + 18),
  );

  return {
    x: Math.round(style.x + (style.width - nextWidth) / 2),
    y: Math.round(style.y + (style.height - nextHeight) / 2),
    width: nextWidth,
    height: nextHeight,
  };
}

function SlideElementView({
  element,
  asset,
  scale,
  compiledAnimations,
  legacyAnimationFallback,
  selected,
  selectionNumber,
  propertyTargeted = false,
  showTransformControls = true,
  isEditing,
  onSelect,
  onToggleSelect,
  onOpenContextMenu,
  onMove,
  onResize,
  onRotate,
  onBeginChange,
  onFinishChange,
  onStartEditing,
  onStopEditing,
  onUpdateContent,
}: {
  element: SlideElement;
  asset?: PresentationAsset;
  scale: number;
  compiledAnimations: CompiledElementAnimation[];
  legacyAnimationFallback: boolean;
  selected: boolean;
  selectionNumber?: number;
  propertyTargeted?: boolean;
  showTransformControls?: boolean;
  isEditing: boolean;
  onSelect?: (elementId: string) => void;
  onToggleSelect?: (elementId: string) => void;
  onOpenContextMenu?: (
    elementId: string,
    position: { x: number; y: number },
  ) => void;
  onMove?: (elementId: string, position: { x: number; y: number }) => void;
  onResize?: (elementId: string, style: Partial<SlideElement["style"]>) => void;
  onRotate?: (elementId: string, rotate: number) => void;
  onBeginChange?: () => void;
  onFinishChange?: () => void;
  onStartEditing?: (elementId: string) => void;
  onStopEditing?: () => void;
  onUpdateContent?: (
    elementId: string,
    content: string,
    style?: Partial<SlideElement["style"]>,
  ) => void;
}) {
  const style = element.style;
  const legacyAnimation = element.animations[0];
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const elementNodeRef = useRef<HTMLDivElement | null>(null);
  const animationNodeRef = useRef<HTMLSpanElement | null>(null);
  const [draftContent, setDraftContent] = useState(element.content);

  const dragStateRef = useRef<{
    startClientX: number;
    startClientY: number;
    startX: number;
    startY: number;
  } | null>(null);

  const resizeStateRef = useRef<{
    startClientX: number;
    startClientY: number;
    startX: number;
    startY: number;
    startWidth: number;
    startHeight: number;
  } | null>(null);

  const rotateStateRef = useRef<{
    centerX: number;
    centerY: number;
    startPointerAngle: number;
    startRotate: number;
  } | null>(null);

  useEffect(() => {
    if (!isEditing) {
      return;
    }

    textareaRef.current?.focus();
    textareaRef.current?.select();
  }, [isEditing]);

  /**
   * Play compiled Animation Schema V2 clips through the Web Animations API.
   *
   * Animations run on the inner content node so editor positioning and element
   * rotation on the outer node remain independent.
   */
  useEffect(() => {
    const animationNode = animationNodeRef.current;

    if (!animationNode || isEditing || compiledAnimations.length === 0) {
      return;
    }

    const runningAnimations = compiledAnimations.map((compiledAnimation) => {
      const keyframes = compiledAnimation.keyframes.map(
        (frame): Keyframe => ({
          offset: frame.offset,
          ...(frame.opacity !== undefined ? { opacity: frame.opacity } : {}),
          ...(frame.transform !== undefined
            ? { transform: frame.transform }
            : {}),
          ...(frame.easing !== undefined ? { easing: frame.easing } : {}),
        }),
      );

      const runningAnimation = animationNode.animate(keyframes, {
        delay: compiledAnimation.timing.delay,
        duration: compiledAnimation.timing.duration,
        fill: compiledAnimation.timing.fill,
        iterations: compiledAnimation.timing.iterations,
        direction: compiledAnimation.timing.direction,

        /**
         * Individual keyframes already contain their own easing values.
         */
        easing: "linear",
      });

      runningAnimation.playbackRate = compiledAnimation.playbackRate;

      return runningAnimation;
    });

    return () => {
      runningAnimations.forEach((runningAnimation) => {
        runningAnimation.cancel();
      });
    };
  }, [compiledAnimations, isEditing]);

  /**
   * Apply the first compiled frame before the browser animation starts.
   *
   * This prevents entrance animations from briefly flashing their final state
   * during the frame before the Web Animations effect is created.
   */
  const initialCompiledFrame =
    !isEditing && compiledAnimations.length > 0
      ? compiledAnimations[0].keyframes[0]
      : undefined;

  const outerStyle: CSSProperties = {
    left: style.x * scale,
    top: style.y * scale,
    width: style.width * scale,
    height: style.height * scale,
    transform: `rotate(${style.rotate}deg)`,
    opacity: style.opacity,
  };

  const innerStyle: CSSProperties = {
    color: style.color ?? "#0f172a",
    backgroundColor: style.backgroundColor ?? "transparent",
    fontSize: (style.fontSize ?? 16) * scale,
    fontWeight: style.fontWeight ?? 400,
    borderRadius: (style.borderRadius ?? 0) * scale,

    /**
     * The initial V2 frame prevents an entrance-animation flash before useEffect
     * starts the Web Animations instance.
     */
    opacity: initialCompiledFrame?.opacity,
    transform: initialCompiledFrame?.transform,

    /**
     * Legacy CSS playback is used only when no valid V2 scene reached the canvas.
     */
    animation:
      legacyAnimationFallback && legacyAnimation
        ? `${legacyAnimation.keyframes} ${legacyAnimation.duration}ms ${legacyAnimation.easing} ${legacyAnimation.delay}ms both`
        : undefined,
  };
  function commitContent() {
    const nextStyle = measureTextElementSize(element, draftContent);

    onUpdateContent?.(element.id, draftContent, nextStyle);
    onStopEditing?.();
  }

  function cancelEditing() {
    setDraftContent(element.content);
    onStopEditing?.();
  }

  function handleDoubleClick(event: ReactMouseEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();

    onSelect?.(element.id);
    setDraftContent(element.content);
    onStartEditing?.(element.id);
  }

  function handleEditorKeyDown(event: ReactKeyboardEvent<HTMLTextAreaElement>) {
    event.stopPropagation();

    if (event.key === "Escape") {
      event.preventDefault();
      cancelEditing();
      return;
    }

    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      commitContent();
    }
  }

  /**
   * Open the element context menu from right click.
   *
   * Right-clicking an element inside the current multi-selection keeps the whole
   * group selected. Right-clicking an unselected element switches to that element.
   */
  function handleContextMenu(event: ReactMouseEvent<HTMLDivElement>) {
    if (isEditing) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    if (!selected) {
      onSelect?.(element.id);
    }

    onOpenContextMenu?.(element.id, {
      x: event.clientX,
      y: event.clientY,
    });
  }

  /**
   * Select a single element normally, or toggle multi-selection with Shift.
   *
   * Clicking an element that already belongs to the current selection keeps the
   * whole multi-selection. This prevents a group from collapsing to one element
   * after dragging or opening its context menu.
   */
  function handleElementClick(event: ReactMouseEvent<HTMLDivElement>) {
    event.stopPropagation();

    if (event.shiftKey) {
      onToggleSelect?.(element.id);
      return;
    }

    // Keep the current multi-selection when this element is already selected.
    if (!selected) {
      onSelect?.(element.id);
    }
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (isEditing) {
      return;
    }

    if (event.button !== 0) {
      return;
    }

    // Shift click is reserved for multi-selection, so it should not start dragging.
    if (event.shiftKey) {
      event.stopPropagation();
      return;
    }

    onBeginChange?.();

    // Do not collapse an existing multi-selection when dragging one of its elements.
    if (!selected) {
      onSelect?.(element.id);
    }

    const moveElement = onMove;

    if (!moveElement) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    dragStateRef.current = {
      startClientX: event.clientX,
      startClientY: event.clientY,
      startX: style.x,
      startY: style.y,
    };

    function handlePointerMove(moveEvent: PointerEvent) {
      const dragState = dragStateRef.current;

      if (!dragState) {
        return;
      }

      const deltaX = (moveEvent.clientX - dragState.startClientX) / scale;
      const deltaY = (moveEvent.clientY - dragState.startClientY) / scale;

      moveElement?.(element.id, {
        x: Math.round(dragState.startX + deltaX),
        y: Math.round(dragState.startY + deltaY),
      });
    }

    function handlePointerUp() {
      dragStateRef.current = null;
      onFinishChange?.();
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  }

  function handleResizePointerDown(
    direction: ResizeDirection,
    event: ReactPointerEvent<HTMLButtonElement>,
  ) {
    const resizeElement = onResize;

    if (!resizeElement || isEditing || event.button !== 0) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    onBeginChange?.();

    resizeStateRef.current = {
      startClientX: event.clientX,
      startClientY: event.clientY,
      startX: style.x,
      startY: style.y,
      startWidth: style.width,
      startHeight: style.height,
    };

    function handlePointerMove(moveEvent: PointerEvent) {
      const resizeState = resizeStateRef.current;

      if (!resizeState) {
        return;
      }

      const deltaX = (moveEvent.clientX - resizeState.startClientX) / scale;
      const deltaY = (moveEvent.clientY - resizeState.startClientY) / scale;
      const minWidth = element.type === "text" ? 48 : 40;
      const minHeight = element.type === "text" ? 32 : 40;

      let nextX = resizeState.startX;
      let nextY = resizeState.startY;
      let nextWidth = resizeState.startWidth;
      let nextHeight = resizeState.startHeight;

      if (direction.includes("e")) {
        nextWidth = resizeState.startWidth + deltaX;
      }

      if (direction.includes("s")) {
        nextHeight = resizeState.startHeight + deltaY;
      }

      if (direction.includes("w")) {
        nextWidth = resizeState.startWidth - deltaX;
        nextX = resizeState.startX + deltaX;
      }

      if (direction.includes("n")) {
        nextHeight = resizeState.startHeight - deltaY;
        nextY = resizeState.startY + deltaY;
      }

      if (nextWidth < minWidth) {
        nextWidth = minWidth;

        if (direction.includes("w")) {
          nextX = resizeState.startX + resizeState.startWidth - minWidth;
        }
      }

      if (nextHeight < minHeight) {
        nextHeight = minHeight;

        if (direction.includes("n")) {
          nextY = resizeState.startY + resizeState.startHeight - minHeight;
        }
      }

      resizeElement?.(element.id, {
        x: Math.round(nextX),
        y: Math.round(nextY),
        width: Math.round(nextWidth),
        height: Math.round(nextHeight),
      });
    }

    function handlePointerUp() {
      resizeStateRef.current = null;
      onFinishChange?.();
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  }

  function handleRotatePointerDown(
    event: ReactPointerEvent<HTMLButtonElement>,
  ) {
    const rotateElement = onRotate;
    const rect = elementNodeRef.current?.getBoundingClientRect();

    if (!rotateElement || !rect || isEditing || event.button !== 0) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    onBeginChange?.();

    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const startPointerAngle = getPointerAngle(
      event.clientX,
      event.clientY,
      centerX,
      centerY,
    );

    rotateStateRef.current = {
      centerX,
      centerY,
      startPointerAngle,
      startRotate: style.rotate,
    };

    function handlePointerMove(moveEvent: PointerEvent) {
      const rotateState = rotateStateRef.current;

      if (!rotateState) {
        return;
      }

      const currentPointerAngle = getPointerAngle(
        moveEvent.clientX,
        moveEvent.clientY,
        rotateState.centerX,
        rotateState.centerY,
      );

      const deltaRotate = currentPointerAngle - rotateState.startPointerAngle;
      const nextRotate = normalizeRotate(rotateState.startRotate + deltaRotate);

      rotateElement?.(element.id, nextRotate);
    }

    function handlePointerUp() {
      rotateStateRef.current = null;
      onFinishChange?.();
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  }

  return (
    <div
      ref={elementNodeRef}
      className={`absolute border-0 bg-transparent p-0 text-center ${
        selected && showTransformControls
          ? "ring-2 ring-violet-500 ring-offset-2"
          : ""
      } ${onMove && !isEditing ? "cursor-move touch-none" : ""}`}
      style={outerStyle}
      onPointerDown={handlePointerDown}
      onContextMenu={handleContextMenu}
      onDoubleClick={handleDoubleClick}
      onClick={handleElementClick}
    >
      {isEditing ? (
        <textarea
          ref={textareaRef}
          className="h-full w-full resize-none border-0 p-0 text-center outline-none"
          value={draftContent}
          style={{
            ...innerStyle,
            padding: 8 * scale,
            lineHeight: 1.2,
          }}
          onChange={(event) => setDraftContent(event.target.value)}
          onBlur={commitContent}
          onKeyDown={handleEditorKeyDown}
          onClick={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
        />
      ) : (
        <span
          ref={animationNodeRef}
          className="flex h-full w-full items-center justify-center whitespace-pre-wrap wrap-break-word"
          style={innerStyle}
        >
          {element.type === "image" && asset?.type === "image" ? (
            <img
              src={asset.source}
              alt={asset.name}
              draggable={false}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "contain",
                pointerEvents: "none",
                userSelect: "none",
                borderRadius: element.style.borderRadius ?? 0,
              }}
            />
          ) : (
            element.content
          )}
        </span>
      )}

      {/* Show the canvas selection number for each multi-selected element.
          Purple means the element is an active property-panel target.
          Gray means it remains selected on the canvas but is not targeted. */}
      {selectionNumber !== undefined ? (
        <div
          className={`pointer-events-none absolute -left-2 -top-2 z-40 flex h-6 min-w-6 items-center justify-center rounded-full border-2 border-white px-1 text-xs font-black text-white shadow-lg ${
            propertyTargeted ? "bg-violet-600" : "bg-slate-400"
          }`}
          title={
            propertyTargeted
              ? `属性操作对象 ${selectionNumber}`
              : `已框选但未勾选 ${selectionNumber}`
          }
        >
          {selectionNumber}
        </div>
      ) : null}

      {selected && showTransformControls && onResize && !isEditing ? (
        <>
          {resizeHandleConfigs.map((handle) => (
            <button
              key={handle.direction}
              type="button"
              className={`absolute z-20 h-3 w-3 rounded-full border-2 border-white bg-violet-500 shadow-md ${handle.className}`}
              aria-label={handle.label}
              title={handle.label}
              onPointerDown={(event) =>
                handleResizePointerDown(handle.direction, event)
              }
              onClick={(event) => event.stopPropagation()}
            />
          ))}
        </>
      ) : null}

      {selected && showTransformControls && onRotate && !isEditing ? (
        <>
          <div className="absolute left-1/2 top-0 z-10 h-0 w-px -translate-x-1/2 -translate-y-8 border-l border-dashed border-violet-400" />

          <button
            type="button"
            className="absolute left-1/2 top-0 z-20 flex h-4 w-4 -translate-x-1/2 -translate-y-10 items-center justify-center rounded-full border-2 border-white bg-violet-500 shadow-md cursor-grab active:cursor-grabbing"
            aria-label="拖拽旋转"
            title="拖拽旋转"
            onPointerDown={handleRotatePointerDown}
            onClick={(event) => event.stopPropagation()}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-white" />
          </button>
        </>
      ) : null}
    </div>
  );
}

function CanvasAnimationStyles() {
  return (
    <style>
      {`
        @keyframes fade-in {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes slide-up {
          from {
            opacity: 0;
            transform: translateY(32px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes zoom-in {
          from {
            opacity: 0;
            transform: scale(0.85);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        @keyframes fade-in-up {
          from {
            opacity: 0;
            transform: translateY(24px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}
    </style>
  );
}
