import { useDroppable } from "@dnd-kit/core";
import {
  useRef,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type { Slide, SlideElement } from "../../types/presentation";

const SLIDE_WIDTH = 1280;
const SLIDE_HEIGHT = 720;

type SlideCanvasProps = {
  slide: Slide;
  scale?: number;
  selectedElementId?: string;
  onSelectElement?: (elementId: string) => void;
  onMoveElement?: (
    elementId: string,
    position: { x: number; y: number },
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
  slideSurfaceRef,
  animationPreviewKey = 0,
  chrome = true,
  clipOverflow = false,
  bare = false,
}: SlideCanvasProps) {
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
            onSelect={onSelectElement}
            onMove={onMoveElement}
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

function SlideElementView({
  element,
  scale,
  selected,
  onSelect,
  onMove,
}: {
  element: SlideElement;
  scale: number;
  selected: boolean;
  onSelect?: (elementId: string) => void;
  onMove?: (elementId: string, position: { x: number; y: number }) => void;
}) {
  const style = element.style;
  const animation = element.animations[0];
  const dragStateRef = useRef<{
    startClientX: number;
    startClientY: number;
    startX: number;
    startY: number;
  } | null>(null);

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

  function handlePointerDown(event: ReactPointerEvent<HTMLButtonElement>) {
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
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  }

  return (
    <button
      type="button"
      className={`absolute border-0 bg-transparent p-0 text-center transition ${
        selected ? "ring-2 ring-violet-500 ring-offset-2" : ""
      } ${onMove ? "cursor-move touch-none" : ""}`}
      style={outerStyle}
      onPointerDown={handlePointerDown}
      onClick={() => onSelect?.(element.id)}
    >
      <span
        className="flex h-full w-full items-center justify-center whitespace-pre-wrap wrap-break-word"
        style={innerStyle}
      >
        {element.content}
      </span>
    </button>
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
