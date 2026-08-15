import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
  type SetStateAction,
} from "react";
import type {
  ActiveAnimationContext,
  TimelinePlaybackStatus,
} from "../../types/editor";
import type {
  AnimationTimelineClipEntry,
  AnimationTimelineHierarchyClipNode,
  AnimationTimelineProtectionReason,
  AnimationTimelineRevealRequest,
  AnimationTimelineSelection,
  AnimationTimelineKeyframeSelection,
  AnimationTimelineSequenceGroup,
  AnimationTimelineViewModel,
} from "../../utils/animationTimeline";
import {
  getAnimationTimelineHierarchy,
  getAnimationTimelineKeyframeSelection,
} from "../../utils/animationTimeline";
import {
  ANIMATION_TIMELINE_TIMING_DRAG_THRESHOLD_PX,
  ANIMATION_TIMELINE_TIMING_PRECISION_MS,
  getAnimationTimelineTimingDragSession,
  type AnimationTimelineTimingEditSession,
  type BeginAnimationTimelineTimingEditRequest,
} from "../../utils/animationTimelineTiming";

type AnimationTimelineProps = {
  viewModel: AnimationTimelineViewModel;
  hierarchyContextKey: string;

  currentTimeMs: number;

  playbackStatus: TimelinePlaybackStatus;

  clipPreviewStatus?: TimelinePlaybackStatus;
  clipPreviewAvailable?: boolean;

  activeSequenceId?: string;
  playbackDurationMs: number;

  activeAnimationContext?: ActiveAnimationContext;
  selection?: AnimationTimelineSelection;
  revealRequest?: AnimationTimelineRevealRequest;

  onCurrentTimeChange: (timeMs: number) => void;

  onSelectSequence: (sequenceId: string) => void;

  onSelectClip: (elementId: string, clipId: string) => void;

  onSelectTrack: (
    elementId: string,
    selection: Extract<AnimationTimelineSelection, { kind: "track" }>,
  ) => void;

  onSelectKeyframe: (
    elementId: string,
    selection: Extract<AnimationTimelineSelection, { kind: "keyframe" }>,
  ) => void;

  onClearKeyframeSelection: () => void;

  onOpenClipDetails: (elementId: string, clipId: string) => void;

  timingEditSession?: AnimationTimelineTimingEditSession;
  timingEditingDisabled?: boolean;
  durationEditableClipIds: ReadonlySet<string>;
  onBeginTimingEdit: (
    request: BeginAnimationTimelineTimingEditRequest,
  ) => AnimationTimelineTimingEditSession | null;
  onUpdateTimingEdit: (
    session: AnimationTimelineTimingEditSession,
  ) => void;
  onCommitTimingEdit: (
    session: AnimationTimelineTimingEditSession,
  ) => void;
  onCancelTimingEdit: (
    session: AnimationTimelineTimingEditSession,
  ) => void;
  onPausePlaybackForTimingEdit: () => void;

  onTogglePlayback: () => void;
  onToggleClipPreview: () => void;
  onReplayClipPreview: () => void;
  onStopClipPreview: () => void;
  onStopPlayback: () => void;
};

type AnimationTimelineTimingPointerRequest =
  | { kind: "clip-start" | "clip-duration" }
  | { kind: "keyframe-offset"; trackId: string; keyframeId: string }
  | {
      kind: "keyframe-group-offset";
      anchorTrackId: string;
      anchorKeyframeId: string;
      keyframes: AnimationTimelineKeyframeSelection["selectedKeyframes"];
    };

const LABEL_COLUMN_WIDTH = 168;
const MIN_CLIP_VISUAL_WIDTH_PX = 12;
const ANIMATION_TIMELINE_PLAYHEAD_HIT_RADIUS_PX = 6;

function shouldClearAnimationTimelineKeyframeSelectionFromBackgroundClick({
  pointerDownOnBackground,
  pointerUpOnBackground,
  movementExceededThreshold,
  modified,
  playheadHit,
}: {
  pointerDownOnBackground: boolean;
  pointerUpOnBackground: boolean;
  movementExceededThreshold: boolean;
  modified: boolean;
  playheadHit: boolean;
}) {
  return (
    pointerDownOnBackground &&
    pointerUpOnBackground &&
    !movementExceededThreshold &&
    !modified &&
    !playheadHit
  );
}

type AnimationTimelineCollapseState = {
  contextKey: string;
  ids: Set<string>;
};

const BASE_PIXELS_PER_SECOND = 220;

const ZOOM_LEVELS = [0.5, 0.75, 1, 1.5, 2, 3, 4] as const;

const MAJOR_TICK_CANDIDATES_MS = [
  100, 250, 500, 1000, 2000, 5000, 10000, 30000, 60000,
];

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getAnimationCategoryLabel(
  category: AnimationTimelineClipEntry["category"],
) {
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

function getProtectionLabel(
  reason: AnimationTimelineProtectionReason | undefined,
) {
  switch (reason) {
    case "orphan":
      return "未归入 Sequence";
    case "ambiguous-ownership":
      return "归属不明确";
    case "additional-slide-enter":
      return "额外页面进入";
    case "advanced-trigger":
      return "高级触发";
    case "missing-target":
      return "目标缺失";
    case "inactive-legacy-clip":
      return "兼容数据不完整";
    case "invalid-sequence":
      return "无效 Sequence";
    case "missing-clip":
      return "Clip 缺失";
    case undefined:
      return "";
  }
}

function getMajorTickStepMs(timelineDurationMs: number, pixelsPerMs: number) {
  return (
    MAJOR_TICK_CANDIDATES_MS.find((candidate) => {
      const labelSpacing = candidate * pixelsPerMs;

      const estimatedMinorTicks =
        timelineDurationMs / Math.max(1, candidate / 5);

      return labelSpacing >= 72 && estimatedMinorTicks <= 1400;
    }) ?? MAJOR_TICK_CANDIDATES_MS[MAJOR_TICK_CANDIDATES_MS.length - 1]
  );
}

function formatRulerTime(timeMs: number) {
  const safeTimeMs = Math.max(0, timeMs);

  if (safeTimeMs > 0 && safeTimeMs < 100) {
    return `${Math.max(1, Math.round(safeTimeMs))}ms`;
  }

  const seconds = safeTimeMs / 1000;

  if (Number.isInteger(seconds)) {
    return `${seconds}s`;
  }

  return `${Number(seconds.toFixed(2))}s`;
}

function formatCurrentTime(timeMs: number) {
  const safeTime = Math.max(0, timeMs);

  const minutes = Math.floor(safeTime / 60000);

  const seconds = Math.floor((safeTime % 60000) / 1000);

  const milliseconds = Math.floor(safeTime % 1000);

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(
    2,
    "0",
  )}.${String(milliseconds).padStart(3, "0")}`;
}

/**
 * Stage 7 Batch 1 data foundation on the existing Timeline V2-B surface.
 *
 * This phase adds persistent ruler navigation, AE-style horizontal wheel
 * scrolling, and Clip-level keyframe visualization.
 *
 * Active-Sequence playback and isolated Clip preview both use the shared
 * playback controller, while this component remains responsible only for
 * navigation and user intent.
 */
export function AnimationTimeline({
  viewModel,
  hierarchyContextKey,
  currentTimeMs,
  playbackStatus,
  clipPreviewStatus,
  clipPreviewAvailable = false,
  activeSequenceId,
  playbackDurationMs,
  activeAnimationContext,
  selection,
  revealRequest,
  onCurrentTimeChange,
  onSelectSequence,
  onSelectClip,
  onSelectTrack,
  onSelectKeyframe,
  onClearKeyframeSelection,
  onOpenClipDetails,
  timingEditSession,
  timingEditingDisabled = false,
  durationEditableClipIds,
  onBeginTimingEdit,
  onUpdateTimingEdit,
  onCommitTimingEdit,
  onCancelTimingEdit,
  onPausePlaybackForTimingEdit,
  onTogglePlayback,
  onToggleClipPreview,
  onReplayClipPreview,
  onStopClipPreview,
  onStopPlayback,
}: AnimationTimelineProps) {
  const [zoom, setZoom] = useState<number>(1);

  const [sequenceCollapseState, setSequenceCollapseState] =
    useState<AnimationTimelineCollapseState>(() => ({
      contextKey: hierarchyContextKey,
      ids: new Set(),
    }));

  const [clipExpansionState, setClipExpansionState] =
    useState<AnimationTimelineCollapseState>(() => ({
      contextKey: hierarchyContextKey,
      ids: new Set(),
    }));
  const [suppressedRevealRequestKey, setSuppressedRevealRequestKey] = useState<
    string | null
  >(null);
  const [multiSelectModeState, setMultiSelectModeState] = useState(() => ({
    contextKey: hierarchyContextKey,
    enabled: false,
  }));
  const multiSelectMode =
    multiSelectModeState.contextKey === hierarchyContextKey &&
    multiSelectModeState.enabled;

  const collapsedSequenceIds =
    sequenceCollapseState.contextKey === hierarchyContextKey
      ? sequenceCollapseState.ids
      : new Set<string>();

  /** Empty means every Clip starts collapsed; only explicit local expansion wins. */
  const expandedClipIds =
    clipExpansionState.contextKey === hierarchyContextKey
      ? clipExpansionState.ids
      : new Set<string>();

  const rulerRef = useRef<HTMLDivElement | null>(null);

  /**
   * Shared horizontal / vertical Timeline viewport.
   *
   * The time area converts wheel movement into horizontal navigation while the
   * sticky layer-label column keeps ordinary vertical scrolling available.
   */
  const scrollViewportRef = useRef<HTMLDivElement | null>(null);
  const clipRowRefs = useRef(new Map<string, HTMLDivElement>());
  const completedRevealRequestKeyRef = useRef<string | null>(null);

  /**
   * Convert wheel movement into horizontal Timeline navigation only when the
   * pointer is inside the time-track area.
   *
   * The listener is registered as non-passive so preventDefault can reliably
   * suppress the browser's simultaneous vertical scrolling.
   */
  useEffect(() => {
    const viewport = scrollViewportRef.current;

    if (!viewport) {
      return;
    }

    function handleWheel(event: WheelEvent) {
      const viewportRect = viewport!.getBoundingClientRect();

      /**
       * The sticky Layer-name column keeps native vertical scrolling.
       */
      const pointerInsideLayerColumn =
        event.clientX < viewportRect.left + LABEL_COLUMN_WIDTH;

      if (pointerInsideLayerColumn) {
        return;
      }

      const canScrollHorizontally =
        viewport!.scrollWidth > viewport!.clientWidth;

      if (!canScrollHorizontally) {
        return;
      }

      const horizontalDelta =
        Math.abs(event.deltaX) > Math.abs(event.deltaY)
          ? event.deltaX
          : event.deltaY;

      if (horizontalDelta === 0) {
        return;
      }

      event.preventDefault();

      viewport!.scrollLeft += horizontalDelta;
    }

    viewport.addEventListener("wheel", handleWheel, {
      passive: false,
    });

    return () => {
      viewport.removeEventListener("wheel", handleWheel);
    };
  }, []);

  const timelineDurationMs = viewModel.rulerExtentMs;

  const hierarchy = useMemo(
    () => getAnimationTimelineHierarchy(viewModel),
    [viewModel],
  );

  const activeSequence = viewModel.sequenceGroups.find(
    (group) =>
      group.status === "normal" && group.sequenceId === activeSequenceId,
  );

  const normalPlaybackAvailable =
    activeSequence !== undefined && playbackDurationMs > 0;

  const pixelsPerSecond = BASE_PIXELS_PER_SECOND * zoom;

  const pixelsPerMs = pixelsPerSecond / 1000;

  const timelineTrackWidth = Math.max(320, timelineDurationMs * pixelsPerMs);

  const effectiveCurrentTimeMs = clamp(currentTimeMs, 0, timelineDurationMs);

  const playheadX = effectiveCurrentTimeMs * pixelsPerMs;
  const revealRequestKey = revealRequest
    ? `${hierarchyContextKey}:${revealRequest.requestId}:${revealRequest.clipId}`
    : null;
  const revealSequenceNode = revealRequest
    ? hierarchy.sequences.find((entry) =>
        entry.clips.some((clipNode) => clipNode.id === revealRequest.clipId),
      )
    : undefined;
  const revealedSequenceGroupId =
    revealRequestKey &&
    suppressedRevealRequestKey !== revealRequestKey
      ? revealSequenceNode?.id
      : undefined;

  /**
   * Reveal external Clip navigation without touching selection or local time.
   * The parent Sequence opens first; the animation frame waits for that row to
   * enter the DOM before applying the smallest vertical/horizontal scroll.
   */
  useEffect(() => {
    if (!revealRequest) {
      return;
    }

    if (
      !revealRequestKey ||
      completedRevealRequestKeyRef.current === revealRequestKey
    ) {
      return;
    }

    const clipNode = revealSequenceNode?.clips.find(
      (entry) => entry.id === revealRequest.clipId,
    );

    if (!revealSequenceNode || !clipNode) {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      const viewport = scrollViewportRef.current;
      const clipRow = clipRowRefs.current.get(clipNode.id);

      if (!viewport || !clipRow) {
        return;
      }

      completedRevealRequestKeyRef.current = revealRequestKey;

      const viewportRect = viewport.getBoundingClientRect();
      const clipRowRect = clipRow.getBoundingClientRect();
      const visibleTop = viewportRect.top + 36;
      const visibleBottom = viewportRect.bottom;

      if (clipRowRect.top < visibleTop) {
        viewport.scrollTop += clipRowRect.top - visibleTop;
      } else if (clipRowRect.bottom > visibleBottom) {
        viewport.scrollTop += clipRowRect.bottom - visibleBottom;
      }

      const visibleTimelineWidth = Math.max(
        0,
        viewport.clientWidth - LABEL_COLUMN_WIDTH,
      );

      if (visibleTimelineWidth === 0) {
        return;
      }

      const clipStartX = clipNode.clip.localStartMs * pixelsPerMs;
      const clipWidth = Math.max(
        MIN_CLIP_VISUAL_WIDTH_PX,
        Math.max(0, clipNode.clip.authoredDurationMs) * pixelsPerMs,
      );
      const clipEndX = clipStartX + clipWidth;
      const visibleStartX = viewport.scrollLeft;
      const visibleEndX = visibleStartX + visibleTimelineWidth;
      let nextScrollLeft = visibleStartX;

      if (clipStartX < visibleStartX) {
        nextScrollLeft = clipStartX;
      } else if (clipEndX > visibleEndX) {
        nextScrollLeft =
          clipWidth >= visibleTimelineWidth
            ? clipStartX
            : clipEndX - visibleTimelineWidth;
      }

      viewport.scrollLeft = clamp(
        nextScrollLeft,
        0,
        Math.max(0, viewport.scrollWidth - viewport.clientWidth),
      );
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [
    hierarchy,
    hierarchyContextKey,
    pixelsPerMs,
    revealRequest,
    revealRequestKey,
    revealSequenceNode,
  ]);

  const majorTickStepMs = getMajorTickStepMs(timelineDurationMs, pixelsPerMs);

  const minorTickStepMs = Math.max(10, majorTickStepMs / 5);

  const tickCount = Math.floor(timelineDurationMs / minorTickStepMs) + 1;

  const ticks = useMemo(
    () =>
      Array.from(
        {
          length: tickCount,
        },
        (_, index) => index * minorTickStepMs,
      ),
    [minorTickStepMs, tickCount],
  );

  const majorTicks = ticks.filter((timeMs) => {
    const nearestMajorTick =
      Math.round(timeMs / majorTickStepMs) * majorTickStepMs;

    return Math.abs(timeMs - nearestMajorTick) < 0.001;
  });

  function getPointerTimeMs(clientX: number) {
    const rulerNode = rulerRef.current;

    if (!rulerNode) {
      return null;
    }

    const rulerRect = rulerNode.getBoundingClientRect();

    const localX = clamp(clientX - rulerRect.left, 0, timelineTrackWidth);

    const rawTime = localX / pixelsPerMs;

    /**
     * Ten-millisecond precision keeps dragging smooth without filling UI state
     * with meaningless floating-point values.
     */
    return clamp(Math.round(rawTime / 10) * 10, 0, playbackDurationMs);
  }

  function handleRulerPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || !normalPlaybackAvailable) {
      return;
    }

    event.preventDefault();

    const initialTime = getPointerTimeMs(event.clientX);

    if (initialTime !== null) {
      onCurrentTimeChange(initialTime);
    }

    function handlePointerMove(moveEvent: PointerEvent) {
      const nextTime = getPointerTimeMs(moveEvent.clientX);

      if (nextTime !== null) {
        onCurrentTimeChange(nextTime);
      }
    }

    function handlePointerUp() {
      window.removeEventListener("pointermove", handlePointerMove);

      window.removeEventListener("pointerup", handlePointerUp);
    }

    window.addEventListener("pointermove", handlePointerMove);

    window.addEventListener("pointerup", handlePointerUp);
  }

  function changeZoom(direction: -1 | 1) {
    const currentIndex = ZOOM_LEVELS.findIndex((level) => level === zoom);

    const nextIndex = clamp(
      currentIndex + direction,
      0,
      ZOOM_LEVELS.length - 1,
    );

    setZoom(ZOOM_LEVELS[nextIndex]);
  }

  const currentZoomIndex = ZOOM_LEVELS.findIndex((level) => level === zoom);

  function toggleIdInState(
    setter: Dispatch<SetStateAction<AnimationTimelineCollapseState>>,
    id: string,
  ) {
    setter((currentState) => {
      const nextIds = new Set(
        currentState.contextKey === hierarchyContextKey
          ? currentState.ids
          : undefined,
      );

      if (nextIds.has(id)) {
        nextIds.delete(id);
      } else {
        nextIds.add(id);
      }

      return {
        contextKey: hierarchyContextKey,
        ids: nextIds,
      };
    });
  }

  return (
    <section
      className="mt-3 flex shrink-0 flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white p-4 shadow-sm"
      style={{
        height: 260,
      }}
    >
      <div className="flex shrink-0 items-center justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-violet-500">
            TIMELINE V2
          </p>

          <div className="mt-0.5 flex items-center gap-3">
            <h2 className="text-lg font-black text-slate-950">动画时间轴</h2>

            <span className="rounded-full bg-slate-100 px-2.5 py-1 font-mono text-[11px] font-black text-slate-600">
              {formatCurrentTime(effectiveCurrentTimeMs)}
            </span>

            <span
              className={`rounded-full px-2.5 py-1 text-[10px] font-black ${
                activeSequence
                  ? "bg-violet-100 text-violet-700"
                  : "bg-slate-100 text-slate-400"
              }`}
              title="Playhead 使用当前 Sequence 的本地时间"
            >
              当前：{activeSequence?.label ?? "无可播放 Sequence"}
            </span>

            {viewModel.protectedClipCount > 0 ? (
              <span
                className="rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-black text-amber-700"
                title="高级、无效或归属不明确的数据保持只读，不会由 Timeline 自动修复"
              >
                {viewModel.protectedClipCount} 个受保护 Clip
              </span>
            ) : null}

            {viewModel.unanchoredClipCount > 0 ? (
              <span
                className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black text-slate-500"
                title="这些 Clip 已保留在读取模型中，但没有可用的 Timeline Object row"
              >
                {viewModel.unanchoredClipCount} 个无可用对象
              </span>
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-pressed={multiSelectMode}
            className={`rounded-full px-3 py-2 text-[10px] font-black transition ${
              multiSelectMode
                ? "bg-violet-500 text-white shadow-sm"
                : "bg-violet-100 text-violet-600 hover:bg-violet-200"
            }`}
            onClick={() =>
              setMultiSelectModeState({
                contextKey: hierarchyContextKey,
                enabled: !multiSelectMode,
              })
            }
            title="触控多选：开启后轻点关键帧切换选择；已选关键帧仍可拖动"
          >
            多选
          </button>

          <div className="flex items-center rounded-full bg-slate-100 p-1">
            <button
              type="button"
              disabled={currentZoomIndex <= 0}
              className="flex h-7 w-7 items-center justify-center rounded-full text-sm font-black text-slate-500 transition hover:bg-white hover:text-violet-600 disabled:cursor-not-allowed disabled:text-slate-300"
              onClick={() => changeZoom(-1)}
              title="缩小时间轴"
            >
              −
            </button>

            <span className="min-w-14 px-2 text-center text-[11px] font-black text-slate-500">
              {Math.round(zoom * 100)}%
            </span>

            <button
              type="button"
              disabled={currentZoomIndex >= ZOOM_LEVELS.length - 1}
              className="flex h-7 w-7 items-center justify-center rounded-full text-sm font-black text-slate-500 transition hover:bg-white hover:text-violet-600 disabled:cursor-not-allowed disabled:text-slate-300"
              onClick={() => changeZoom(1)}
              title="放大时间轴"
            >
              ＋
            </button>
          </div>

          <button
            type="button"
            disabled={!activeAnimationContext || !clipPreviewAvailable}
            className="min-w-22 rounded-full bg-amber-100 px-3 py-2 text-xs font-black text-amber-700 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-300"
            onClick={onToggleClipPreview}
            title="只播放当前选中的 Clip"
          >
            {clipPreviewStatus === "playing"
              ? "暂停 Clip"
              : clipPreviewStatus === "paused"
                ? "继续 Clip"
                : "预览 Clip"}
          </button>

          {clipPreviewStatus ? (
            <>
              <button
                type="button"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-100 text-xs font-black text-amber-700 transition hover:bg-amber-200"
                onClick={onReplayClipPreview}
                title="从头重播当前 Clip"
                aria-label="从头重播当前 Clip"
              >
                ↻
              </button>

              <button
                type="button"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-[10px] font-black text-slate-500 transition hover:bg-slate-200 hover:text-slate-900"
                onClick={onStopClipPreview}
                title="停止 Clip 预览并恢复原画面"
                aria-label="停止 Clip 预览"
              >
                ■
              </button>
            </>
          ) : null}

          <button
            type="button"
            disabled={!normalPlaybackAvailable}
            className="min-w-24 rounded-full bg-violet-500 px-4 py-2 text-xs font-black text-white shadow-sm transition hover:bg-violet-600 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
            onClick={onTogglePlayback}
          >
            {playbackStatus === "playing" ? "⏸ 当前序列" : "▶ 当前序列"}
          </button>

          {playbackStatus !== "idle" ? (
            <button
              type="button"
              className="rounded-full bg-violet-100 px-3 py-2 text-xs font-black text-violet-600 transition hover:bg-violet-200"
              onClick={onStopPlayback}
              title="停止当前 Sequence 播放并返回 0 秒"
            >
              停止序列
            </button>
          ) : null}
        </div>
      </div>

      <div
        ref={scrollViewportRef}
        className="mt-3 min-h-0 flex-1 overflow-auto rounded-2xl border border-slate-200 bg-slate-50"
      >
        <div
          className="relative"
          style={{
            width: LABEL_COLUMN_WIDTH + timelineTrackWidth,
            minWidth: "100%",
          }}
        >
          {/* Time ruler */}
          <div
            className="sticky top-0 z-60 grid border-b border-slate-200 bg-white shadow-[0_1px_0_rgba(15,23,42,0.06)]"
            style={{
              gridTemplateColumns: `${LABEL_COLUMN_WIDTH}px ${timelineTrackWidth}px`,
            }}
          >
            <div className="sticky left-0 z-70 flex h-9 items-center border-r border-slate-200 bg-slate-100 px-3 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
              LAYERS
            </div>

            <div
              ref={rulerRef}
              className={`relative h-9 select-none bg-white ${
                normalPlaybackAvailable
                  ? "cursor-ew-resize"
                  : "cursor-not-allowed"
              }`}
              onPointerDown={handleRulerPointerDown}
              title="点击或拖动 Playhead · 滚轮横向浏览时间轴"
            >
              {ticks.map((timeMs) => {
                const major = majorTicks.includes(timeMs);

                return (
                  <div
                    key={timeMs}
                    className={`pointer-events-none absolute bottom-0 border-l ${
                      major ? "h-5 border-slate-400" : "h-2.5 border-slate-200"
                    }`}
                    style={{
                      left: timeMs * pixelsPerMs,
                    }}
                  >
                    {major ? (
                      <span className="absolute left-1 top-0 whitespace-nowrap text-[9px] font-bold text-slate-400">
                        {formatRulerTime(timeMs)}
                      </span>
                    ) : null}
                  </div>
                );
              })}

              {/* Playhead handle */}
              <div
                className="pointer-events-none absolute bottom-0 top-0 z-40 w-px bg-rose-500"
                style={{
                  left: playheadX,
                }}
              >
                <span className="absolute -left-1.5 top-0 h-3 w-3 rotate-45 rounded-sm bg-rose-500 shadow-sm" />
              </div>
            </div>
          </div>

          {/* Sequence → Object / Clip → Track → Keyframe hierarchy */}
          {hierarchy.sequences.map((sequenceNode) => {
            const { group } = sequenceNode;
            const sequenceCollapsed =
              collapsedSequenceIds.has(group.id) &&
              revealedSequenceGroupId !== group.id;
            const active =
              group.status === "normal" && group.sequenceId === activeSequenceId;
            const sequenceDuration = formatRulerTime(group.semanticDurationMs);

            return (
              <div key={sequenceNode.id} className="border-b border-slate-200">
                <div
                  className={`grid ${
                    active
                      ? "bg-violet-50"
                      : group.status === "protected"
                        ? "bg-amber-50"
                        : "bg-slate-100"
                  }`}
                  style={{
                    gridTemplateColumns: `${LABEL_COLUMN_WIDTH}px ${timelineTrackWidth}px`,
                  }}
                >
                  <div className="sticky left-0 z-50 flex h-10 min-w-0 items-center gap-1 border-r border-slate-200 px-2 shadow-[1px_0_0_rgba(15,23,42,0.06)]">
                    <button
                      type="button"
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[10px] font-black text-slate-500 hover:bg-white"
                      onClick={() => {
                        if (revealedSequenceGroupId === group.id) {
                          setSuppressedRevealRequestKey(revealRequestKey);
                          setSequenceCollapseState((currentState) => {
                            const nextIds = new Set(
                              currentState.contextKey === hierarchyContextKey
                                ? currentState.ids
                                : undefined,
                            );
                            nextIds.add(group.id);

                            return {
                              contextKey: hierarchyContextKey,
                              ids: nextIds,
                            };
                          });
                          return;
                        }

                        toggleIdInState(setSequenceCollapseState, group.id);
                      }}
                      aria-label={`${sequenceCollapsed ? "展开" : "折叠"} ${group.label}`}
                    >
                      {sequenceCollapsed ? "▶" : "▼"}
                    </button>
                    <button
                      type="button"
                      disabled={group.status === "protected" || !group.sequenceId}
                      className={`min-w-0 flex-1 truncate text-left text-[11px] font-black disabled:cursor-default ${
                        active
                          ? "text-violet-700"
                          : group.status === "protected"
                            ? "text-amber-700"
                            : "text-slate-700"
                      }`}
                      onClick={() => {
                        if (group.sequenceId) {
                          onSelectSequence(group.sequenceId);
                        }
                      }}
                      title={
                        group.status === "protected"
                          ? `${group.label} · 受保护，只读检查`
                          : `${group.label} · 选择 Active Sequence`
                      }
                    >
                      {group.label}
                    </button>
                  </div>
                  <div className="flex h-10 items-center gap-2 px-3 text-[10px] font-bold text-slate-500">
                    <span>{sequenceNode.clips.length} Clips</span>
                    <span>·</span>
                    <span>{sequenceDuration}</span>
                    {active ? (
                      <span className="rounded-full bg-violet-100 px-2 py-0.5 text-violet-700">
                        ACTIVE
                      </span>
                    ) : null}
                    {group.status === "protected" ? (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-700">
                        只读保护
                      </span>
                    ) : null}
                  </div>
                </div>

                {!sequenceCollapsed
                  ? sequenceNode.clips.map((clipNode) => (
                      <AnimationTimelineClipHierarchyRows
                        key={clipNode.id}
                        node={clipNode}
                        group={group}
                        activeSequenceId={activeSequenceId}
                        activeAnimationContext={activeAnimationContext}
                        selection={selection}
                        multiSelectMode={multiSelectMode}
                        collapsed={!expandedClipIds.has(clipNode.id)}
                        timelineTrackWidth={timelineTrackWidth}
                        pixelsPerMs={pixelsPerMs}
                        playheadX={playheadX}
                        majorTicks={majorTicks}
                        onToggleCollapse={() =>
                          toggleIdInState(setClipExpansionState, clipNode.id)
                        }
                        registerClipRow={(node) => {
                          if (node) {
                            clipRowRefs.current.set(clipNode.id, node);
                          } else {
                            clipRowRefs.current.delete(clipNode.id);
                          }
                        }}
                        onSelectClip={onSelectClip}
                        onSelectTrack={onSelectTrack}
                        onSelectKeyframe={onSelectKeyframe}
                        onClearKeyframeSelection={onClearKeyframeSelection}
                        onOpenClipDetails={onOpenClipDetails}
                        timingEditSession={timingEditSession}
                        timingEditingDisabled={timingEditingDisabled}
                        durationEditable={durationEditableClipIds.has(
                          clipNode.clip.id,
                        )}
                        currentTimeMs={currentTimeMs}
                        rulerGridStepMs={minorTickStepMs}
                        onBeginTimingEdit={onBeginTimingEdit}
                        onUpdateTimingEdit={onUpdateTimingEdit}
                        onCommitTimingEdit={onCommitTimingEdit}
                        onCancelTimingEdit={onCancelTimingEdit}
                        onPausePlaybackForTimingEdit={
                          onPausePlaybackForTimingEdit
                        }
                      />
                    ))
                  : null}
              </div>
            );
          })}

          {hierarchy.sequences.length === 0 ? (
            <div
              className="grid border-b border-slate-100"
              style={{
                gridTemplateColumns: `${LABEL_COLUMN_WIDTH}px ${timelineTrackWidth}px`,
              }}
            >
              <div className="sticky left-0 z-50 flex h-12 items-center border-r border-slate-200 bg-slate-50 px-3 text-xs font-bold text-slate-400">
                动画层级
              </div>
              <div className="flex h-12 items-center bg-white px-3 text-[11px] font-semibold text-slate-400">
                当前页面没有可显示的 V2 动画 Sequence
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function AnimationTimelineClipHierarchyRows({
  node,
  group,
  activeSequenceId,
  activeAnimationContext,
  selection,
  multiSelectMode,
  collapsed,
  timelineTrackWidth,
  pixelsPerMs,
  playheadX,
  majorTicks,
  onToggleCollapse,
  registerClipRow,
  onSelectClip,
  onSelectTrack,
  onSelectKeyframe,
  onClearKeyframeSelection,
  onOpenClipDetails,
  timingEditSession,
  timingEditingDisabled,
  durationEditable,
  currentTimeMs,
  rulerGridStepMs,
  onBeginTimingEdit,
  onUpdateTimingEdit,
  onCommitTimingEdit,
  onCancelTimingEdit,
  onPausePlaybackForTimingEdit,
}: {
  node: AnimationTimelineHierarchyClipNode;
  group: AnimationTimelineSequenceGroup;
  activeSequenceId?: string;
  activeAnimationContext?: ActiveAnimationContext;
  selection?: AnimationTimelineSelection;
  multiSelectMode: boolean;
  collapsed: boolean;
  timelineTrackWidth: number;
  pixelsPerMs: number;
  playheadX: number;
  majorTicks: number[];
  onToggleCollapse: () => void;
  registerClipRow: (node: HTMLDivElement | null) => void;
  onSelectClip: (elementId: string, clipId: string) => void;
  onSelectTrack: (
    elementId: string,
    selection: Extract<AnimationTimelineSelection, { kind: "track" }>,
  ) => void;
  onSelectKeyframe: (
    elementId: string,
    selection: Extract<AnimationTimelineSelection, { kind: "keyframe" }>,
  ) => void;
  onClearKeyframeSelection: () => void;
  onOpenClipDetails: (elementId: string, clipId: string) => void;
  timingEditSession?: AnimationTimelineTimingEditSession;
  timingEditingDisabled: boolean;
  durationEditable: boolean;
  currentTimeMs: number;
  rulerGridStepMs: number;
  onBeginTimingEdit: (
    request: BeginAnimationTimelineTimingEditRequest,
  ) => AnimationTimelineTimingEditSession | null;
  onUpdateTimingEdit: (
    session: AnimationTimelineTimingEditSession,
  ) => void;
  onCommitTimingEdit: (
    session: AnimationTimelineTimingEditSession,
  ) => void;
  onCancelTimingEdit: (
    session: AnimationTimelineTimingEditSession,
  ) => void;
  onPausePlaybackForTimingEdit: () => void;
}) {
  const { clip } = node;
  const clipHierarchySelected =
    activeAnimationContext?.clipId === clip.id && selection?.clipId === clip.id;
  const clipLevelSelected =
    clipHierarchySelected && selection?.kind === "clip";
  const clipActive = activeAnimationContext?.clipId === clip.id;
  const inactiveNormalSequence =
    clip.status === "normal" && clip.sequenceId !== activeSequenceId;
  const protectionLabel = getProtectionLabel(clip.protectionReason);
  const targetSummary = node.targetLabels.join("、") || "无";
  const clipLeft = clip.localStartMs * pixelsPerMs;
  const clipWidth = Math.max(
    MIN_CLIP_VISUAL_WIDTH_PX,
    Math.max(0, clip.authoredDurationMs) * pixelsPerMs,
  );
  const visualClipRight = clipLeft + clipWidth;
  const selectionElementId = node.selectionElementId;
  const cancelClipPointerInteractionRef = useRef<(() => void) | null>(null);
  const suppressKeyframeClickRef = useRef<string | null>(null);
  const directlyEditable =
    clip.status === "normal" &&
    clip.liveForElements &&
    clip.sequenceId !== undefined &&
    clip.sequenceId === activeSequenceId &&
    !timingEditingDisabled;
  const activeTimingEdit =
    timingEditSession?.clipId === clip.id &&
    timingEditSession.sequenceId === clip.sequenceId
      ? timingEditSession
      : undefined;
  const durationEditActive =
    activeTimingEdit?.kind === "clip-duration" && activeTimingEdit.dragging;
  const effectiveEndDiffersFromAuthoredEnd =
    clip.effectiveEndMs !== undefined &&
    Number.isFinite(clip.effectiveEndMs) &&
    Math.abs(
      clip.effectiveEndMs -
        (clip.localStartMs + Math.max(0, clip.authoredDurationMs)),
    ) >= ANIMATION_TIMELINE_TIMING_PRECISION_MS;

  function selectClip() {
    if (selectionElementId) {
      onSelectClip(selectionElementId, clip.id);
    }
  }

  function selectTrack(trackId: string) {
    if (!selectionElementId) {
      return;
    }

    onSelectTrack(selectionElementId, {
      kind: "track",
      sequenceGroupId: group.id,
      sequenceId: clip.sequenceId,
      clipId: clip.id,
      trackId,
    });
  }

  function applyKeyframeSelection(
    nextSelection: AnimationTimelineSelection,
  ) {
    if (!selectionElementId) {
      return;
    }

    if (nextSelection.kind === "keyframe") {
      onSelectKeyframe(selectionElementId, nextSelection);
    } else if (nextSelection.kind === "track") {
      onSelectTrack(selectionElementId, nextSelection);
    } else {
      onSelectClip(selectionElementId, clip.id);
    }
  }

  function selectKeyframe(
    trackId: string,
    keyframeId: string,
    toggle = false,
  ) {
    applyKeyframeSelection(
      getAnimationTimelineKeyframeSelection(
        clip,
        selection,
        { trackId, keyframeId },
        toggle,
      ),
    );
  }

  function handleTimingPointerDown(
    event: ReactPointerEvent<HTMLElement>,
    request: AnimationTimelineTimingPointerRequest,
    keyframeSelection?: AnimationTimelineKeyframeSelection,
  ) {
    if (event.button !== 0) {
      return;
    }

    if (!directlyEditable || !clip.sequenceId) {
      return;
    }

    const sequenceId = clip.sequenceId;
    const sourceClientX = event.clientX;
    const pointerId = event.pointerId;
    const gestureTarget = event.currentTarget;
    gestureTarget.setPointerCapture(pointerId);
    let activeSession: AnimationTimelineTimingEditSession | null = null;
    let latestSession: AnimationTimelineTimingEditSession | null = null;
    let dragStarted = false;
    let finished = false;

    function finish(kind: "commit" | "cancel") {
      if (finished) {
        return;
      }

      finished = true;
      if (
        cancelClipPointerInteractionRef.current === cancelCurrentInteraction
      ) {
        cancelClipPointerInteractionRef.current = null;
      }
      window.removeEventListener("keydown", handleKeyDown);
      gestureTarget.removeEventListener("pointermove", handlePointerMove);
      gestureTarget.removeEventListener("pointerup", handlePointerUp);
      gestureTarget.removeEventListener("pointercancel", handlePointerCancel);
      gestureTarget.removeEventListener(
        "lostpointercapture",
        handleLostPointerCapture,
      );

      if (
        kind === "commit" &&
        dragStarted &&
        (request.kind === "keyframe-offset" ||
          request.kind === "keyframe-group-offset")
      ) {
        const trackId =
          request.kind === "keyframe-group-offset"
            ? request.anchorTrackId
            : request.trackId;
        const keyframeId =
          request.kind === "keyframe-group-offset"
            ? request.anchorKeyframeId
            : request.keyframeId;
        suppressKeyframeClickRef.current = `${trackId}\u0000${keyframeId}`;
      }

      if (kind === "commit" && dragStarted && latestSession) {
        onCommitTimingEdit(latestSession);
      } else if (latestSession) {
        onCancelTimingEdit(latestSession);
      }

      if (gestureTarget.hasPointerCapture(pointerId)) {
        gestureTarget.releasePointerCapture(pointerId);
      }
    }

    function cancelCurrentInteraction() {
      finish("cancel");
    }

    function handleKeyDown(keyEvent: KeyboardEvent) {
      if (keyEvent.key !== "Escape") {
        return;
      }

      keyEvent.preventDefault();
      finish("cancel");
    }

    window.addEventListener("keydown", handleKeyDown);

    function handlePointerMove(moveEvent: PointerEvent) {
      if (moveEvent.pointerId !== pointerId || finished) {
        return;
      }

      const deltaPixels = moveEvent.clientX - sourceClientX;

      if (
        !dragStarted &&
        Math.abs(deltaPixels) <
          ANIMATION_TIMELINE_TIMING_DRAG_THRESHOLD_PX
      ) {
        return;
      }

      if (!dragStarted) {
        if (keyframeSelection) {
          applyKeyframeSelection(keyframeSelection);
        } else {
          selectClip();
        }
        activeSession = onBeginTimingEdit({
          ...request,
          sequenceId,
          clipId: clip.id,
          pointerId,
        });

        if (!activeSession) {
          if (
            request.kind === "keyframe-offset" ||
            request.kind === "keyframe-group-offset"
          ) {
            const trackId =
              request.kind === "keyframe-group-offset"
                ? request.anchorTrackId
                : request.trackId;
            const keyframeId =
              request.kind === "keyframe-group-offset"
                ? request.anchorKeyframeId
                : request.keyframeId;
            suppressKeyframeClickRef.current = `${trackId}\u0000${keyframeId}`;
          }

          finish("cancel");
          return;
        }

        dragStarted = true;
        moveEvent.preventDefault();
        onPausePlaybackForTimingEdit();
      }

      if (!activeSession) {
        return;
      }

      latestSession = getAnimationTimelineTimingDragSession(activeSession, {
        deltaPixels,
        pixelsPerMs,
        rulerGridStepMs,
        playheadTimeMs: currentTimeMs,
      });
      onUpdateTimingEdit(latestSession);
    }

    function handlePointerUp(upEvent: PointerEvent) {
      if (upEvent.pointerId !== pointerId) {
        return;
      }

      finish("commit");
    }

    function handlePointerCancel(cancelEvent: PointerEvent) {
      if (cancelEvent.pointerId === pointerId) {
        finish("cancel");
      }
    }

    function handleLostPointerCapture() {
      finish("cancel");
    }

    gestureTarget.addEventListener("pointermove", handlePointerMove);
    gestureTarget.addEventListener("pointerup", handlePointerUp);
    gestureTarget.addEventListener("pointercancel", handlePointerCancel);
    gestureTarget.addEventListener(
      "lostpointercapture",
      handleLostPointerCapture,
    );
    cancelClipPointerInteractionRef.current = cancelCurrentInteraction;
  }

  function handleClipPointerDown(
    event: ReactPointerEvent<HTMLButtonElement>,
  ) {
    handleTimingPointerDown(event, { kind: "clip-start" });
  }

  function handleDurationPointerDown(
    event: ReactPointerEvent<HTMLButtonElement>,
  ) {
    event.stopPropagation();

    if (!durationEditable) {
      return;
    }

    handleTimingPointerDown(event, { kind: "clip-duration" });
  }

  function handleKeyframePointerDown(
    event: ReactPointerEvent<HTMLButtonElement>,
    trackId: string,
    keyframeId: string,
  ) {
    event.stopPropagation();

    if (event.ctrlKey || event.metaKey) {
      return;
    }

    const identity = { trackId, keyframeId };
    const markerSelected =
      selection?.kind === "keyframe" &&
      selection.clipId === clip.id &&
      selection.selectedKeyframes.some(
        (selectedKeyframe) =>
          selectedKeyframe.trackId === trackId &&
          selectedKeyframe.keyframeId === keyframeId,
      );

    if (multiSelectMode && !markerSelected) {
      return;
    }

    const dragSelection =
      markerSelected && selection?.kind === "keyframe"
        ? {
            ...selection,
            primary: identity,
          }
        : getAnimationTimelineKeyframeSelection(
            clip,
            selection,
            identity,
            false,
          );

    if (dragSelection.kind !== "keyframe") {
      return;
    }

    if (dragSelection.selectedKeyframes.length > 1) {
      handleTimingPointerDown(
        event,
        {
          kind: "keyframe-group-offset",
          anchorTrackId: trackId,
          anchorKeyframeId: keyframeId,
          keyframes: dragSelection.selectedKeyframes,
        },
        dragSelection,
      );
      return;
    }

    handleTimingPointerDown(
      event,
      {
        kind: "keyframe-offset",
        trackId,
        keyframeId,
      },
      dragSelection,
    );
  }

  useEffect(
    () => () => {
      cancelClipPointerInteractionRef.current?.();
      cancelClipPointerInteractionRef.current = null;
    },
    [],
  );

  return (
    <>
      <AnimationTimelineHierarchyRow
        rowRef={registerClipRow}
        label={
          <div className="flex min-w-0 items-center gap-1 pl-2">
            <button
              type="button"
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-[9px] font-black text-slate-400 hover:bg-white"
              onClick={(event) => {
                event.stopPropagation();
                onToggleCollapse();
              }}
              aria-label={`${collapsed ? "展开" : "折叠"} ${clip.name}`}
            >
              {collapsed ? "▶" : "▼"}
            </button>
            <button
              type="button"
              className={`min-w-0 flex-1 truncate text-left text-[11px] font-black ${
                clipLevelSelected
                  ? clip.status === "protected"
                    ? "text-amber-700"
                    : "text-violet-700"
                  : clipHierarchySelected
                    ? clip.status === "protected"
                      ? "text-amber-600"
                      : "text-violet-600"
                  : clipActive
                    ? "text-slate-800"
                    : "text-slate-600"
              }`}
              onClick={selectClip}
              onDoubleClick={() => {
                if (selectionElementId) {
                  onOpenClipDetails(selectionElementId, clip.id);
                }
              }}
              title={`${node.objectLabel} · ${clip.name} · 目标 ${targetSummary}`}
            >
              <span className="text-slate-400">{node.objectLabel}</span>
              <span> / {clip.name}</span>
            </button>
            {clip.multiTarget ? (
              <span
                className="shrink-0 rounded-full bg-slate-200 px-1.5 py-0.5 text-[8px] font-black text-slate-500"
                title={targetSummary}
              >
                {clip.targets.length} targets
              </span>
            ) : null}
          </div>
        }
        timelineTrackWidth={timelineTrackWidth}
        playheadX={playheadX}
        majorTicks={majorTicks}
        pixelsPerMs={pixelsPerMs}
        rowClassName={
          clip.status === "protected" ? "bg-amber-50/40" : "bg-white"
        }
        onEmptyTimelineClick={
          selection?.kind === "keyframe"
            ? onClearKeyframeSelection
            : undefined
        }
      >
        <button
          type="button"
          className={`absolute top-2 flex h-5 min-w-0 touch-none items-center gap-1 overflow-visible rounded-md px-2 text-left text-[10px] font-black text-white shadow-sm transition hover:z-20 hover:brightness-105 ${
            clipHierarchySelected
              ? clip.status === "protected"
                ? "z-10 bg-amber-600 ring-2 ring-amber-300"
                : "z-10 bg-violet-600 ring-2 ring-violet-300"
              : clip.status === "protected"
                ? "bg-amber-500"
                : "bg-violet-400"
          } ${inactiveNormalSequence ? "opacity-50" : ""} ${
            directlyEditable ? "cursor-grab active:cursor-grabbing" : ""
          }`}
          style={{ left: clipLeft, width: clipWidth }}
          title={`${clip.name} · ${getAnimationCategoryLabel(
            clip.category,
          )} · Sequence-local 开始 ${clip.authoredStartMs}ms · 时长 ${
            clip.authoredDurationMs
          }ms${protectionLabel ? ` · 受保护：${protectionLabel}` : ""}`}
          onPointerDown={handleClipPointerDown}
          onClick={selectClip}
          onDoubleClick={() => {
            if (selectionElementId) {
              onOpenClipDetails(selectionElementId, clip.id);
            }
          }}
        >
          <span className="min-w-0 flex-1 truncate">{clip.name}</span>
          <span className="shrink-0 rounded-full bg-white/20 px-1 text-[8px]">
            {clip.status === "protected"
              ? "保护"
              : getAnimationCategoryLabel(clip.category)}
          </span>
          {activeTimingEdit?.dragging ? (
            <>
              {activeTimingEdit.kind === "clip-start" && activeTimingEdit.snap ? (
                <span className="pointer-events-none absolute -top-2 left-0 z-40 h-9 w-px bg-cyan-400 shadow-[0_0_0_1px_rgba(255,255,255,0.65)]" />
              ) : null}
              {activeTimingEdit.kind === "clip-start" ? (
                <span className="pointer-events-none absolute -top-8 left-1/2 z-50 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 font-mono text-[9px] font-bold text-white shadow-lg">
                  {formatRulerTime(activeTimingEdit.candidateStartMs)}
                  {activeTimingEdit.snap ? " · SNAP" : ""}
                </span>
              ) : null}
            </>
          ) : null}
        </button>

        {directlyEditable && durationEditable ? (
          <button
            type="button"
            className={`group absolute top-1.5 z-30 flex h-6 w-2.5 -translate-x-1/2 touch-none cursor-ew-resize items-center justify-center rounded-sm outline-none transition hover:bg-white/70 focus-visible:ring-2 focus-visible:ring-cyan-400 ${
              durationEditActive ? "bg-white/80" : ""
            }`}
            style={{ left: visualClipRight }}
            onPointerDown={handleDurationPointerDown}
            onClick={(event) => {
              event.stopPropagation();
              selectClip();
            }}
            aria-label={`调整 ${clip.name} 的基础时长`}
            title={`拖动右边缘调整基础时长 · 当前 ${formatRulerTime(
              clip.authoredDurationMs,
            )}`}
          >
            <span className="pointer-events-none h-4 w-0.5 rounded-full bg-white/90 shadow-sm transition group-hover:bg-cyan-500" />
            {durationEditActive ? (
              <>
                {activeTimingEdit.snap ? (
                  <span className="pointer-events-none absolute -top-1 left-1/2 z-40 h-9 w-px -translate-x-1/2 bg-cyan-400 shadow-[0_0_0_1px_rgba(255,255,255,0.65)]" />
                ) : null}
                <span className="pointer-events-none absolute -top-12 left-1/2 z-50 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-left font-mono text-[9px] font-bold leading-4 text-white shadow-lg">
                  <span className="block">
                    基础时长：
                    {formatRulerTime(activeTimingEdit.candidateDurationMs)}
                  </span>
                  <span className="block text-slate-300">
                    结束：
                    {formatRulerTime(activeTimingEdit.candidateAuthoredEndMs)}
                    {activeTimingEdit.snap ? " · SNAP" : ""}
                  </span>
                  {effectiveEndDiffersFromAuthoredEnd ? (
                    <span className="block text-cyan-300">
                      有效结束：{formatRulerTime(clip.effectiveEndMs ?? 0)}
                    </span>
                  ) : null}
                </span>
              </>
            ) : null}
          </button>
        ) : null}
      </AnimationTimelineHierarchyRow>

      {!collapsed
        ? clip.tracks.map((track) => {
            const selectedTrack =
              selection?.clipId === clip.id &&
              selection.kind === "track" &&
              selection.trackId === track.id;
            const trackContainsSelection =
              selection?.clipId === clip.id &&
              ((selection.kind === "track" && selection.trackId === track.id) ||
                (selection.kind === "keyframe" &&
                  selection.selectedKeyframes.some(
                    (keyframe) => keyframe.trackId === track.id,
                  )));

            return (
              <AnimationTimelineHierarchyRow
                key={track.id}
                label={
                  <button
                    type="button"
                    className={`flex h-full w-full min-w-0 items-center gap-2 pl-10 pr-2 text-left text-[10px] font-bold ${
                      selectedTrack
                        ? clip.status === "protected"
                          ? "bg-amber-100 text-amber-700"
                          : "bg-violet-100 text-violet-700"
                        : trackContainsSelection
                          ? clip.status === "protected"
                            ? "bg-amber-50 text-amber-600"
                            : "bg-violet-50 text-violet-600"
                        : "text-slate-500 hover:bg-slate-100"
                    }`}
                    onClick={() => selectTrack(track.id)}
                    title={`${track.name} · ${track.property} · Track ${track.id}`}
                  >
                    <span className="min-w-0 flex-1 truncate">
                      {track.name || track.property}
                    </span>
                    <span className="shrink-0 font-mono text-[8px] text-slate-400">
                      {track.property}
                    </span>
                  </button>
                }
                timelineTrackWidth={timelineTrackWidth}
                playheadX={playheadX}
                majorTicks={majorTicks}
                pixelsPerMs={pixelsPerMs}
                rowClassName={
                  clip.status === "protected" ? "bg-amber-50/20" : "bg-white"
                }
                onEmptyTimelineClick={
                  selection?.kind === "keyframe"
                    ? onClearKeyframeSelection
                    : undefined
                }
              >
                <div
                  className={`pointer-events-none absolute top-1/2 h-0.5 -translate-y-1/2 rounded-full ${
                    clip.status === "protected"
                      ? "bg-amber-200"
                      : "bg-violet-200"
                  }`}
                  style={{ left: clipLeft, width: clipWidth }}
                />
                {track.keyframes.map((keyframe) => {
                  const selectedKeyframe =
                    selection?.kind === "keyframe" &&
                    selection.clipId === clip.id &&
                    selection.selectedKeyframes.some(
                      (selectedIdentity) =>
                        selectedIdentity.trackId === track.id &&
                        selectedIdentity.keyframeId === keyframe.id,
                    );
                  const primaryKeyframe =
                    selectedKeyframe &&
                    selection?.kind === "keyframe" &&
                    selection.primary.trackId === track.id &&
                    selection.primary.keyframeId === keyframe.id;
                  const singleKeyframeTimingEdit =
                    activeTimingEdit?.kind === "keyframe-offset" &&
                    activeTimingEdit.trackId === track.id &&
                    activeTimingEdit.keyframeId === keyframe.id
                      ? activeTimingEdit
                      : undefined;
                  const groupKeyframeTimingEdit =
                    activeTimingEdit?.kind === "keyframe-group-offset" &&
                    activeTimingEdit.keyframes.some(
                      (selectedIdentity) =>
                        selectedIdentity.trackId === track.id &&
                        selectedIdentity.keyframeId === keyframe.id,
                    )
                      ? activeTimingEdit
                      : undefined;
                  const keyframeTimingDragging =
                    singleKeyframeTimingEdit?.dragging ||
                    groupKeyframeTimingEdit?.dragging;
                  const keyframeTimingAnchor =
                    singleKeyframeTimingEdit ??
                    (groupKeyframeTimingEdit?.anchorTrackId === track.id &&
                    groupKeyframeTimingEdit.anchorKeyframeId === keyframe.id
                      ? groupKeyframeTimingEdit
                      : undefined);
                  const candidateLocalTimeMs =
                    keyframeTimingAnchor?.kind === "keyframe-group-offset"
                      ? keyframeTimingAnchor.candidateAnchorLocalTimeMs
                      : keyframeTimingAnchor?.candidateLocalTimeMs;
                  const candidateOffset =
                    keyframeTimingAnchor?.kind === "keyframe-group-offset"
                      ? keyframeTimingAnchor.sourceAnchorOffset +
                        keyframeTimingAnchor.candidateDeltaOffset
                      : keyframeTimingAnchor?.candidateOffset;
                  const keyframeDirectlyEditable =
                    directlyEditable && keyframe.timingEditable;
                  const keyframeIdentityKey = `${track.id}\u0000${keyframe.id}`;

                  return (
                    <span key={keyframe.id}>
                      <button
                        type="button"
                        className={`absolute top-1/2 z-30 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-[2px] border-2 shadow-sm transition hover:scale-125 ${
                          keyframeTimingDragging
                            ? "border-cyan-700 bg-cyan-300 ring-2 ring-cyan-200"
                            : primaryKeyframe
                              ? clip.status === "protected"
                                ? "border-amber-700 bg-amber-300 ring-2 ring-amber-200"
                                : "border-violet-700 bg-violet-300 ring-2 ring-violet-200"
                              : selectedKeyframe
                              ? clip.status === "protected"
                                ? "border-amber-700 bg-amber-300"
                                : "border-violet-700 bg-violet-300"
                              : clip.status === "protected"
                                ? "border-amber-500 bg-white"
                                : "border-violet-500 bg-white"
                        } ${
                          keyframeDirectlyEditable
                            ? "touch-none cursor-ew-resize"
                            : "cursor-default"
                        }`}
                        style={{ left: keyframe.localTimeMs * pixelsPerMs }}
                        onPointerDown={
                          keyframeDirectlyEditable
                            ? (event) =>
                                handleKeyframePointerDown(
                                  event,
                                  track.id,
                                  keyframe.id,
                                )
                            : undefined
                        }
                        onClick={(event) => {
                          event.stopPropagation();

                          if (
                            suppressKeyframeClickRef.current ===
                            keyframeIdentityKey
                          ) {
                            suppressKeyframeClickRef.current = null;
                            return;
                          }

                          selectKeyframe(
                            track.id,
                            keyframe.id,
                            multiSelectMode || event.ctrlKey || event.metaKey,
                          );
                        }}
                        title={`${track.property} · Keyframe ${keyframe.id} · ${formatRulerTime(
                          keyframe.localTimeMs,
                        )}${
                          keyframeDirectlyEditable
                            ? " · 水平拖动调整时间"
                            : " · 时间编辑已锁定"
                        }`}
                        aria-label={`${
                          keyframeDirectlyEditable ? "调整" : "选择"
                        } ${track.property} 的 ${formatRulerTime(
                          keyframe.localTimeMs,
                        )} 关键帧`}
                      />
                      {keyframeTimingAnchor?.dragging &&
                      candidateLocalTimeMs !== undefined &&
                      candidateOffset !== undefined ? (
                        <>
                          {keyframeTimingAnchor.snap ? (
                            <span
                              className="pointer-events-none absolute bottom-0 top-0 z-20 w-px -translate-x-1/2 bg-cyan-400"
                              style={{
                                left: candidateLocalTimeMs * pixelsPerMs,
                              }}
                            />
                          ) : null}
                          <span
                            className="pointer-events-none absolute top-0 z-50 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 font-mono text-[9px] font-bold text-white shadow-lg"
                            style={{
                              left: candidateLocalTimeMs * pixelsPerMs,
                            }}
                          >
                            {formatRulerTime(candidateLocalTimeMs)}
                            {` · offset ${candidateOffset.toFixed(3)}`}
                            {keyframeTimingAnchor.kind ===
                            "keyframe-group-offset"
                              ? ` · ${keyframeTimingAnchor.keyframes.length} 帧`
                              : ""}
                            {keyframeTimingAnchor.snap ? " · SNAP" : ""}
                          </span>
                        </>
                      ) : null}
                    </span>
                  );
                })}
              </AnimationTimelineHierarchyRow>
            );
          })
        : null}
    </>
  );
}

function AnimationTimelineHierarchyRow({
  rowRef,
  label,
  children,
  timelineTrackWidth,
  playheadX,
  majorTicks,
  pixelsPerMs,
  rowClassName,
  onEmptyTimelineClick,
}: {
  rowRef?: (node: HTMLDivElement | null) => void;
  label: ReactNode;
  children: ReactNode;
  timelineTrackWidth: number;
  playheadX: number;
  majorTicks: number[];
  pixelsPerMs: number;
  rowClassName: string;
  onEmptyTimelineClick?: () => void;
}) {
  function handleEmptyTimelinePointerDown(
    event: ReactPointerEvent<HTMLDivElement>,
  ) {
    if (
      !onEmptyTimelineClick ||
      event.button !== 0 ||
      !event.isPrimary ||
      event.target !== event.currentTarget ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }

    const background = event.currentTarget;
    const backgroundRect = background.getBoundingClientRect();
    const sourceClientX = event.clientX;
    const sourceClientY = event.clientY;
    const pointerId = event.pointerId;
    let movementExceededThreshold = false;

    const isPlayheadHit = (clientX: number) =>
      Math.abs(clientX - backgroundRect.left - playheadX) <=
      ANIMATION_TIMELINE_PLAYHEAD_HIT_RADIUS_PX;

    if (isPlayheadHit(sourceClientX)) {
      return;
    }

    const cleanup = () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerCancel);
    };
    const handlePointerMove = (pointerEvent: PointerEvent) => {
      if (pointerEvent.pointerId !== pointerId) {
        return;
      }
      if (
        Math.hypot(
          pointerEvent.clientX - sourceClientX,
          pointerEvent.clientY - sourceClientY,
        ) >= ANIMATION_TIMELINE_TIMING_DRAG_THRESHOLD_PX
      ) {
        movementExceededThreshold = true;
      }
    };
    const handlePointerUp = (pointerEvent: PointerEvent) => {
      if (pointerEvent.pointerId !== pointerId) {
        return;
      }
      cleanup();
      const finalMovementExceededThreshold =
        movementExceededThreshold ||
        Math.hypot(
          pointerEvent.clientX - sourceClientX,
          pointerEvent.clientY - sourceClientY,
        ) >= ANIMATION_TIMELINE_TIMING_DRAG_THRESHOLD_PX;

      if (
        shouldClearAnimationTimelineKeyframeSelectionFromBackgroundClick({
          pointerDownOnBackground: true,
          pointerUpOnBackground: pointerEvent.target === background,
          movementExceededThreshold: finalMovementExceededThreshold,
          modified:
            pointerEvent.ctrlKey ||
            pointerEvent.metaKey ||
            pointerEvent.shiftKey ||
            pointerEvent.altKey,
          playheadHit: isPlayheadHit(pointerEvent.clientX),
        })
      ) {
        onEmptyTimelineClick();
      }
    };
    const handlePointerCancel = (pointerEvent: PointerEvent) => {
      if (pointerEvent.pointerId === pointerId) {
        cleanup();
      }
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerCancel);
  }

  return (
    <div
      ref={rowRef}
      className="grid border-t border-slate-100"
      style={{
        gridTemplateColumns: `${LABEL_COLUMN_WIDTH}px ${timelineTrackWidth}px`,
      }}
    >
      <div className="sticky left-0 z-50 h-9 min-w-0 border-r border-slate-200 bg-slate-50 shadow-[1px_0_0_rgba(15,23,42,0.06)]">
        {label}
      </div>
      <div
        className={`relative h-9 overflow-hidden ${rowClassName}`}
        onPointerDown={handleEmptyTimelinePointerDown}
      >
        {majorTicks.map((timeMs) => (
          <div
            key={`guide-${timeMs}`}
            className="pointer-events-none absolute bottom-0 top-0 border-l border-slate-100"
            style={{ left: timeMs * pixelsPerMs }}
          />
        ))}
        {children}
        <div
          className="pointer-events-none absolute bottom-0 top-0 z-40 w-px bg-rose-500"
          style={{ left: playheadX }}
        />
      </div>
    </div>
  );
}
