import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type {
  ActiveAnimationContext,
  TimelinePlaybackStatus,
} from "../../types/editor";
import type {
  AnimationTimelineClipEntry,
  AnimationTimelineProtectionReason,
  AnimationTimelineViewModel,
} from "../../utils/animationTimeline";

type AnimationTimelineProps = {
  viewModel: AnimationTimelineViewModel;

  currentTimeMs: number;

  playbackStatus: TimelinePlaybackStatus;

  clipPreviewStatus?: TimelinePlaybackStatus;
  clipPreviewAvailable?: boolean;

  activeSequenceId?: string;
  playbackDurationMs: number;

  activeAnimationContext?: ActiveAnimationContext;

  onCurrentTimeChange: (timeMs: number) => void;

  onSelectClip: (elementId: string, clipId: string) => void;

  onOpenClipDetails: (elementId: string, clipId: string) => void;

  onTogglePlayback: () => void;
  onToggleClipPreview: () => void;
  onReplayClipPreview: () => void;
  onStopClipPreview: () => void;
  onStopPlayback: () => void;
};

const LABEL_COLUMN_WIDTH = 168;

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
  const seconds = timeMs / 1000;

  if (Number.isInteger(seconds)) {
    return `${seconds}s`;
  }

  return `${seconds.toFixed(2).replace(/0+$/, "")}s`;
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
  currentTimeMs,
  playbackStatus,
  clipPreviewStatus,
  clipPreviewAvailable = false,
  activeSequenceId,
  playbackDurationMs,
  activeAnimationContext,
  onCurrentTimeChange,
  onSelectClip,
  onOpenClipDetails,
  onTogglePlayback,
  onToggleClipPreview,
  onReplayClipPreview,
  onStopClipPreview,
  onStopPlayback,
}: AnimationTimelineProps) {
  const [zoom, setZoom] = useState<number>(1);

  const rulerRef = useRef<HTMLDivElement | null>(null);

  /**
   * Shared horizontal / vertical Timeline viewport.
   *
   * The time area converts wheel movement into horizontal navigation while the
   * sticky layer-label column keeps ordinary vertical scrolling available.
   */
  const scrollViewportRef = useRef<HTMLDivElement | null>(null);

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

          {/* Animated object rows */}
          {viewModel.objectRows.map((row, elementIndex) => {
            const rowHeight = Math.max(36, row.clips.length * 28 + 8);

            return (
              <div
                key={row.elementId}
                className="grid border-b border-slate-100 last:border-b-0"
                style={{
                  gridTemplateColumns: `${LABEL_COLUMN_WIDTH}px ${timelineTrackWidth}px`,
                }}
              >
                <div
                  className="sticky left-0 z-50 flex items-center border-r border-slate-200 bg-slate-50 px-3 shadow-[1px_0_0_rgba(15,23,42,0.06)]"
                  style={{
                    height: rowHeight,
                  }}
                  title={row.elementName}
                >
                  <span className="min-w-0 truncate text-xs font-bold text-slate-600">
                    {elementIndex + 1}. {row.label}
                  </span>
                </div>

                <div
                  className="relative z-0 overflow-hidden bg-white"
                  style={{
                    height: rowHeight,
                  }}
                >
                  {/* Major vertical guide lines */}
                  {majorTicks.map((timeMs) => (
                    <div
                      key={`guide-${timeMs}`}
                      className="pointer-events-none absolute bottom-0 top-0 border-l border-slate-100"
                      style={{
                        left: timeMs * pixelsPerMs,
                      }}
                    />
                  ))}

                  {row.clips.map((clip, clipIndex) => {
                    const focused =
                      activeAnimationContext?.clipId === clip.id;
                    const inactiveNormalSequence =
                      clip.status === "normal" &&
                      clip.sequenceId !== activeSequenceId;
                    const clipLeft = clip.localStartMs * pixelsPerMs;

                    const clipWidth = Math.max(
                      12,
                      Math.max(0, clip.authoredDurationMs) * pixelsPerMs,
                    );

                    const targetSummary = clip.targets
                      .map(
                        (target) =>
                          target.elementName ??
                          `${target.elementId}${
                            target.available ? "" : "（缺失）"
                          }`,
                      )
                      .join("、");
                    const protectionLabel = getProtectionLabel(
                      clip.protectionReason,
                    );

                    return (
                      <div key={clip.id}>
                        <button
                          type="button"
                          className={`absolute flex h-5 min-w-0 items-center gap-1 overflow-hidden rounded-md px-2 text-left text-[10px] font-black text-white shadow-sm transition hover:z-20 hover:brightness-105 ${
                            focused
                              ? clip.status === "protected"
                                ? "z-10 bg-amber-600 ring-2 ring-amber-300"
                                : "z-10 bg-violet-600 ring-2 ring-violet-300"
                              : clip.status === "protected"
                                ? "bg-amber-500"
                                : "bg-violet-400"
                          } ${inactiveNormalSequence ? "opacity-50" : ""}`}
                          style={{
                            left: clipLeft,
                            top: 4 + clipIndex * 28,
                            width: clipWidth,
                          }}
                          title={`${clip.name} · ${getAnimationCategoryLabel(
                            clip.category,
                          )} · ${clip.sequenceLabel} · Sequence-local 开始 ${
                            clip.authoredStartMs
                          }ms · 时长 ${clip.authoredDurationMs}ms · 目标 ${
                            targetSummary || "无"
                          }${
                            protectionLabel
                              ? ` · 受保护：${protectionLabel}`
                              : ""
                          } · 单击选择 · 双击详细编辑`}
                          onClick={(event) => {
                            event.stopPropagation();

                            onSelectClip(row.elementId, clip.id);
                          }}
                          onDoubleClick={(event) => {
                            event.stopPropagation();

                            onOpenClipDetails(row.elementId, clip.id);
                          }}
                        >
                          <span className="min-w-0 flex-1 truncate">
                            {clip.name}
                          </span>

                          <span className="shrink-0 rounded-full bg-white/20 px-1 text-[8px]">
                            {clip.status === "protected"
                              ? "保护"
                              : getAnimationCategoryLabel(clip.category)}
                          </span>
                        </button>

                        {clip.keyframeLocalTimesMs.map(
                          (keyframeTimeMs, keyframeIndex) => {
                            const keyframeLeft = keyframeTimeMs * pixelsPerMs;

                            return (
                              <span
                                key={`${clip.id}-keyframe-${keyframeTimeMs}-${keyframeIndex}`}
                                className={`pointer-events-none absolute z-30 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-[1px] border shadow-sm ${
                                  focused
                                    ? clip.status === "protected"
                                      ? "border-amber-700 bg-amber-100"
                                      : "border-violet-700 bg-violet-100"
                                    : clip.status === "protected"
                                      ? "border-amber-500 bg-white"
                                      : "border-violet-500 bg-white"
                                }`}
                                style={{
                                  left: keyframeLeft,
                                  top: 14 + clipIndex * 28,
                                }}
                              />
                            );
                          },
                        )}
                      </div>
                    );
                  })}

                  {/* Playhead line continues through every row. */}
                  <div
                    className="pointer-events-none absolute bottom-0 top-0 z-40 w-px bg-rose-500"
                    style={{
                      left: playheadX,
                    }}
                  />
                </div>
              </div>
            );
          })}

          {viewModel.objectRows.length === 0 ? (
            <div
              className="grid border-b border-slate-100"
              style={{
                gridTemplateColumns: `${LABEL_COLUMN_WIDTH}px ${timelineTrackWidth}px`,
              }}
            >
              <div className="sticky left-0 z-50 flex h-12 items-center border-r border-slate-200 bg-slate-50 px-3 text-xs font-bold text-slate-400">
                动画对象
              </div>
              <div className="flex h-12 items-center bg-white px-3 text-[11px] font-semibold text-slate-400">
                当前页面没有可显示的 V2 动画对象
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
