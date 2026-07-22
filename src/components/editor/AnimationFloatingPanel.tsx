import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type { AnimationScene, SlideElement } from "../../types/presentation";
import type {
  AddAnimationClipCommand,
  AddAnimationKeyframeCommand,
  DeleteAnimationClipCommand,
  DeleteAnimationKeyframeCommand,
  DuplicateAnimationClipCommand,
  UpdateAnimationClipEasingCommand,
  UpdateAnimationClipTimingCommand,
  UpdateAnimationKeyframeEasingCommand,
  UpdateAnimationKeyframeOffsetCommand,
  UpdateAnimationKeyframeValueCommand,
} from "../../utils/animationCommands";
import {
  AnimationBatchEditor,
  type AnimationElementBatchUpdate,
} from "./AnimationBatchEditor";
import { AnimationTrackInspector } from "./AnimationTrackInspector";

type AnimationEditOptions = {
  recordHistory?: boolean;
};

type ActiveAnimationContext = {
  elementId: string;
  clipId: string;
  requestId: number;
};

type AnimationFloatingPanelProps = {
  visible: boolean;
  persistent?: boolean;
  scene?: AnimationScene;
  elements: SlideElement[];
  activeAnimationContext?: ActiveAnimationContext;
  onSelectClip?: (elementId: string, clipId: string) => void;
  onClose?: () => void;
  onReplayAnimation?: () => void;
  onAddClip?: (command: AddAnimationClipCommand) => void;
  onDuplicateClip?: (command: DuplicateAnimationClipCommand) => void;
  onDeleteClip?: (command: DeleteAnimationClipCommand) => void;
  onUpdateClipTiming?: (
    command: UpdateAnimationClipTimingCommand,
    options?: AnimationEditOptions,
  ) => void;
  onUpdateElements?: (
    updates: AnimationElementBatchUpdate[],
    options?: AnimationEditOptions,
  ) => void;
  onUpdateClipTimings?: (
    commands: UpdateAnimationClipTimingCommand[],
    options?: AnimationEditOptions,
  ) => void;
  onUpdateClipEasings?: (
    commands: UpdateAnimationClipEasingCommand[],
    options?: AnimationEditOptions,
  ) => void;
  onUpdateKeyframeValue?: (
    command: UpdateAnimationKeyframeValueCommand,
    options?: AnimationEditOptions,
  ) => void;
  onUpdateKeyframeEasing?: (
    command: UpdateAnimationKeyframeEasingCommand,
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
  persistent = false,
  scene,
  elements,
  activeAnimationContext,
  onSelectClip,
  onClose,
  onReplayAnimation,
  onAddClip,
  onDuplicateClip,
  onDeleteClip,
  onUpdateClipTiming,
  onUpdateElements,
  onUpdateClipTimings,
  onUpdateClipEasings,
  onUpdateKeyframeValue,
  onUpdateKeyframeEasing,
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
   * Open one selected object inside the inspector without replacing the canvas
   * multi-selection.
   */
  const [focusedElementState, setFocusedElementState] = useState<{
    selectionKey: string;
    elementId: string;
  } | null>(null);

  const selectionKey = elements.map((element) => element.id).join("|");

  const focusedElement =
    focusedElementState?.selectionKey === selectionKey
      ? elements.find((element) => element.id === focusedElementState.elementId)
      : undefined;

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

  const selectedTitle = focusedElement
    ? `${focusedElement.name} · 多选详情`
    : elements.length === 0
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

          {persistent ? (
            <span
              className="rounded-full bg-white px-3 py-1.5 text-xs font-black text-violet-600 shadow-sm"
              title="高级轨道编辑器当前设置为始终显示"
            >
              常驻
            </span>
          ) : (
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
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
        {elements.length === 0 ? (
          <section className="rounded-2xl border border-dashed border-violet-200 bg-violet-50/50 p-8 text-center">
            <p className="text-base font-black text-slate-700">尚未选择元素</p>

            <p className="mt-2 text-sm leading-6 text-slate-400">
              在幕布上选择一个元素后，这里会显示该元素的 Clip、Track 和
              Keyframe。
            </p>
          </section>
        ) : elements.length > 1 && focusedElement ? (
          <div className="space-y-3">
            <button
              type="button"
              className="rounded-xl bg-violet-100 px-3 py-2 text-xs font-black text-violet-600 transition hover:bg-violet-200"
              onClick={() => setFocusedElementState(null)}
            >
              ← 返回批量动画编辑
            </button>

            <AnimationTrackInspector
              scene={scene}
              elements={[focusedElement]}
              requestedClipId={
                activeAnimationContext?.elementId === focusedElement.id
                  ? activeAnimationContext.clipId
                  : undefined
              }
              requestedClipRequestId={
                activeAnimationContext?.elementId === focusedElement.id
                  ? activeAnimationContext.requestId
                  : undefined
              }
              onSelectClip={onSelectClip}
              onAddClip={onAddClip}
              onDuplicateClip={onDuplicateClip}
              onDeleteClip={onDeleteClip}
              onUpdateClipTiming={onUpdateClipTiming}
              onUpdateKeyframeValue={onUpdateKeyframeValue}
              onUpdateKeyframeEasing={onUpdateKeyframeEasing}
              onUpdateKeyframeOffset={onUpdateKeyframeOffset}
              onAddKeyframe={onAddKeyframe}
              onDeleteKeyframe={onDeleteKeyframe}
              onBeginChange={onBeginChange}
              onFinishChange={onFinishChange}
            />
          </div>
        ) : elements.length > 1 ? (
          <AnimationBatchEditor
            scene={scene}
            elements={elements}
            onOpenElementDetails={(elementId) =>
              setFocusedElementState({
                selectionKey,
                elementId,
              })
            }
            onUpdateElements={onUpdateElements}
            onUpdateClipTimings={onUpdateClipTimings}
            onUpdateClipEasings={onUpdateClipEasings}
            onBeginChange={onBeginChange}
            onFinishChange={onFinishChange}
          />
        ) : (
          <AnimationTrackInspector
            scene={scene}
            elements={elements}
            requestedClipId={
              activeAnimationContext?.elementId === elements[0]?.id
                ? activeAnimationContext.clipId
                : undefined
            }
            requestedClipRequestId={
              activeAnimationContext?.elementId === elements[0]?.id
                ? activeAnimationContext.requestId
                : undefined
            }
            onSelectClip={onSelectClip}
            onAddClip={onAddClip}
            onDuplicateClip={onDuplicateClip}
            onDeleteClip={onDeleteClip}
            onUpdateClipTiming={onUpdateClipTiming}
            onUpdateKeyframeValue={onUpdateKeyframeValue}
            onUpdateKeyframeEasing={onUpdateKeyframeEasing}
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
