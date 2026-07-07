import { useDroppable } from "@dnd-kit/core";
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type { Slide, SlideElement } from "../../types/presentation";

const SLIDE_WIDTH = 1280;
const SLIDE_HEIGHT = 720;

type ResizeDirection = "nw" | "ne" | "sw" | "se";

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
  scale?: number;
  selectedElementId?: string;
  onSelectElement?: (elementId: string) => void;
  onMoveElement?: (
    elementId: string,
    position: { x: number; y: number },
  ) => void;
  onResizeElement?: (
    elementId: string,
    style: Partial<SlideElement["style"]>,
  ) => void;
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
  scale = 0.6,
  selectedElementId,
  onSelectElement,
  onMoveElement,
  onResizeElement,
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

  const { isOver, setNodeRef } = useDroppable({
    id: "slide-canvas-droppable",
  });

  function setDropZoneRef(node: HTMLDivElement | null) {
    setNodeRef(node);
  }

  function setSlideSurfaceNode(node: HTMLDivElement | null) {
    if (slideSurfaceRef) {
      slideSurfaceRef.current = node;
    }
  }

  const slideSurface = (
    <div
      ref={setSlideSurfaceNode}
      className={`relative rounded-2xl shadow-xl ${
        clipOverflow ? "overflow-hidden" : "overflow-visible"
      }`}
      style={{
        width: SLIDE_WIDTH * scale,
        height: SLIDE_HEIGHT * scale,
        backgroundColor: slide.backgroundColor,
      }}
    >
      {slide.elements.map((element) => {
        const firstAnimation = element.animations[0];
        const animationKey = firstAnimation
          ? `${element.id}-${firstAnimation.keyframes}-${firstAnimation.duration}-${firstAnimation.delay}-${animationPreviewKey}`
          : `${element.id}-${animationPreviewKey}`;

        return (
          <SlideElementView
            key={animationKey}
            element={element}
            scale={scale}
            selected={element.id === selectedElementId}
            isEditing={element.id === editingElementId}
            onSelect={onSelectElement}
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
  scale,
  selected,
  isEditing,
  onSelect,
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
  scale: number;
  selected: boolean;
  isEditing: boolean;
  onSelect?: (elementId: string) => void;
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
  const animation = element.animations[0];
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const elementNodeRef = useRef<HTMLDivElement | null>(null);
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
    animation: animation
      ? `${animation.keyframes} ${animation.duration}ms ${animation.easing} ${animation.delay}ms both`
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

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (isEditing) {
      return;
    }

    onBeginChange?.();
    onSelect?.(element.id);

    const moveElement = onMove;

    if (!moveElement || event.button !== 0) {
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
        selected ? "ring-2 ring-violet-500 ring-offset-2" : ""
      } ${onMove && !isEditing ? "cursor-move touch-none" : ""}`}
      style={outerStyle}
      onPointerDown={handlePointerDown}
      onDoubleClick={handleDoubleClick}
      onClick={(event) => {
        event.stopPropagation();
        onSelect?.(element.id);
      }}
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
          className="flex h-full w-full items-center justify-center whitespace-pre-wrap wrap-break-word"
          style={innerStyle}
        >
          {element.content}
        </span>
      )}

      {selected && onResize && !isEditing ? (
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

      {selected && onRotate && !isEditing ? (
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
