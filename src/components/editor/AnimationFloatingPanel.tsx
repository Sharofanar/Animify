import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type { AnimationScene, SlideElement } from "../../types/presentation";
import type {
  AddAnimationKeyframeCommand,
  DeleteAnimationKeyframeCommand,
  UpdateAnimationClipTimingCommand,
  UpdateAnimationKeyframeOffsetCommand,
  UpdateAnimationKeyframeValueCommand,
} from "../../utils/animationCommands";
import { AnimationTrackInspector } from "./AnimationTrackInspector";

type AnimationEditOptions = {
  recordHistory?: boolean;
};

type AnimationFloatingPanelProps = {
  visible: boolean;
  scene?: AnimationScene;
  elements: SlideElement[];
  onClose?: () => void;
  onSelectElement?: (elementId: string) => void;
  onReplayAnimation?: () => void;
  onUpdateClipTiming?: (
    command: UpdateAnimationClipTimingCommand,
    options?: AnimationEditOptions,
  ) => void;
  onUpdateKeyframeValue?: (
    command: UpdateAnimationKeyframeValueCommand,
    options?: AnimationEditOptions,
  ) => void;
  onUpdateKeyframeOffset?: (
    command: UpdateAnimationKeyframeOffsetCommand,
    options?: AnimationEditOptions,
  ) => void;
  onAddKeyframe?: (command: AddAnimationKeyframeCommand) => void;
  onDeleteKeyframe?: (command: DeleteAnimationKeyframeCommand) => void;
  onBeginChange?: () => void;
  onFinishChange?: () => void;
};

type PanelPosition = {
  x: number;
  y: number;
};

type PanelDragState = {
  pointerId: number;
  offsetX: number;
  offsetY: number;
};

const PANEL_MARGIN = 16;
const PANEL_FALLBACK_WIDTH = 640;
const PANEL_FALLBACK_HEIGHT = 640;

/**
 * Keep the floating animation workspace inside the visible browser viewport.
 */
function clampPanelPosition(
  x: number,
  y: number,
  panelNode: HTMLDivElement | null,
): PanelPosition {
  const panelWidth = panelNode?.offsetWidth ?? PANEL_FALLBACK_WIDTH;

  const panelHeight = panelNode?.offsetHeight ?? PANEL_FALLBACK_HEIGHT;

  const visiblePanelHeight = Math.min(
    panelHeight,
    window.innerHeight - PANEL_MARGIN * 2,
  );

  const maximumX = Math.max(
    PANEL_MARGIN,
    window.innerWidth - panelWidth - PANEL_MARGIN,
  );

  const maximumY = Math.max(
    PANEL_MARGIN,
    window.innerHeight - visiblePanelHeight - PANEL_MARGIN,
  );

  return {
    x: Math.min(maximumX, Math.max(PANEL_MARGIN, x)),
    y: Math.min(maximumY, Math.max(PANEL_MARGIN, y)),
  };
}

function createInitialPanelPosition(): PanelPosition {
  return {
    x: Math.max(
      PANEL_MARGIN,
      window.innerWidth - PANEL_FALLBACK_WIDTH - PANEL_MARGIN,
    ),
    y: 96,
  };
}

/**
 * Floating workspace used only in animation mode.
 *
 * The component remains mounted while hidden, so its last dragged position is
 * preserved when the user switches between edit and animation modes.
 */
export function AnimationFloatingPanel({
  visible,
  scene,
  elements,
  onClose,
  onSelectElement,
  onReplayAnimation,
  onUpdateClipTiming,
  onUpdateKeyframeValue,
  onUpdateKeyframeOffset,
  onAddKeyframe,
  onDeleteKeyframe,
  onBeginChange,
  onFinishChange,
}: AnimationFloatingPanelProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<PanelDragState | null>(null);

  const [position, setPosition] = useState<PanelPosition>(
    createInitialPanelPosition,
  );

  /**
   * Re-clamp the panel when the browser window changes size.
   */
  useEffect(() => {
    function handleWindowResize() {
      setPosition((currentPosition) =>
        clampPanelPosition(
          currentPosition.x,
          currentPosition.y,
          panelRef.current,
        ),
      );
    }

    window.addEventListener("resize", handleWindowResize);

    return () => {
      window.removeEventListener("resize", handleWindowResize);
    };
  }, []);

  function handleDragStart(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0) {
      return;
    }

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);

    dragStateRef.current = {
      pointerId: event.pointerId,
      offsetX: event.clientX - position.x,
      offsetY: event.clientY - position.y,
    };
  }

  function handleDragMove(event: ReactPointerEvent<HTMLDivElement>) {
    const dragState = dragStateRef.current;

    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    setPosition(
      clampPanelPosition(
        event.clientX - dragState.offsetX,
        event.clientY - dragState.offsetY,
        panelRef.current,
      ),
    );
  }

  function handleDragEnd(event: ReactPointerEvent<HTMLDivElement>) {
    const dragState = dragStateRef.current;

    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    dragStateRef.current = null;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  if (!visible) {
    return null;
  }

  const selectedTitle =
    elements.length === 0
      ? "未选择元素"
      : elements.length === 1
        ? (elements[0]?.name ?? "未命名元素")
        : `已选择 ${elements.length} 个元素`;

  return (
    <aside
      ref={panelRef}
      className="fixed z-9000 flex flex-col overflow-hidden rounded-3xl border border-violet-200 bg-white/95 shadow-2xl backdrop-blur-xl"
      style={{
        left: position.x,
        top: position.y,
        width: "min(640px, calc(100vw - 32px))",
        maxHeight: "calc(100vh - 32px)",
      }}
      onClick={(event) => event.stopPropagation()}
      onContextMenu={(event) => event.stopPropagation()}
    >
      <div
        className="flex shrink-0 touch-none cursor-move items-center justify-between gap-4 border-b border-violet-100 bg-violet-50/90 px-5 py-3 select-none"
        onPointerDown={handleDragStart}
        onPointerMove={handleDragMove}
        onPointerUp={handleDragEnd}
        onPointerCancel={handleDragEnd}
      >
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.28em] text-violet-500">
            Animation Workspace
          </p>

          <h2 className="mt-1 truncate text-base font-black text-slate-900">
            {selectedTitle}
          </h2>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            className="rounded-full bg-violet-500 px-3 py-1.5 text-xs font-black text-white transition hover:bg-violet-600"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={onReplayAnimation}
          >
            播放
          </button>

          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-sm font-black text-slate-400 shadow-sm transition hover:bg-rose-50 hover:text-rose-500"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={onClose}
            aria-label="关闭动画工作区"
            title="关闭动画工作区"
          >
            ×
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
        {elements.length === 0 ? (
          <section className="rounded-2xl border border-dashed border-violet-200 bg-violet-50/50 p-8 text-center">
            <p className="text-base font-black text-slate-700">尚未选择元素</p>

            <p className="mt-2 text-sm leading-6 text-slate-400">
              在幕布上点击一个元素，动画工作区会自动显示该元素的 Clip、Track 和
              Keyframe。
            </p>
          </section>
        ) : elements.length > 1 ? (
          <section className="rounded-2xl border border-violet-100 bg-violet-50/50 p-4">
            <h3 className="text-sm font-black text-violet-700">
              选择一个动画对象
            </h3>

            <p className="mt-1 text-xs leading-5 text-violet-500">
              多选状态保留在幕布上。点击下面的对象，可进入该对象的详细轨道。
            </p>

            <div className="mt-4 grid grid-cols-2 gap-2">
              {elements.map((element, index) => (
                <button
                  key={element.id}
                  type="button"
                  className="min-w-0 rounded-xl border border-violet-100 bg-white px-3 py-3 text-left transition hover:border-violet-300 hover:bg-violet-50"
                  disabled={!onSelectElement}
                  onClick={() => onSelectElement?.(element.id)}
                >
                  <span className="block truncate text-xs font-black text-slate-700">
                    {index + 1}. {element.name}
                  </span>

                  <span className="mt-1 block truncate text-[10px] text-slate-400">
                    {element.content || element.id}
                  </span>
                </button>
              ))}
            </div>
          </section>
        ) : (
          <AnimationTrackInspector
            scene={scene}
            elements={elements}
            onUpdateClipTiming={onUpdateClipTiming}
            onUpdateKeyframeValue={onUpdateKeyframeValue}
            onUpdateKeyframeOffset={onUpdateKeyframeOffset}
            onAddKeyframe={onAddKeyframe}
            onDeleteKeyframe={onDeleteKeyframe}
            onBeginChange={onBeginChange}
            onFinishChange={onFinishChange}
          />
        )}
      </div>
    </aside>
  );
}
