import { useEffect, useRef, useState } from "react";
import type {
  AnimationClip,
  AnimationEasing,
  AnimationScene,
  AnimationTrack,
  AnimationValue,
  SlideElement,
} from "../../types/presentation";
import type {
  AddAnimationClipCommand,
  AddAnimationKeyframeCommand,
  DeleteAnimationClipCommand,
  DeleteAnimationKeyframeCommand,
  DuplicateAnimationClipCommand,
  UpdateAnimationClipTimingCommand,
  UpdateAnimationKeyframeEasingCommand,
  UpdateAnimationKeyframeOffsetCommand,
  UpdateAnimationKeyframeValueCommand,
} from "../../utils/animationCommands";
import { animationPresets } from "../../utils/animationPresets";

/**
 * Keep the inspector's input limits consistent with the V2 command layer.
 */
const MINIMUM_KEYFRAME_OFFSET_GAP = 0.001;

const CSS_EASING_OPTIONS = [
  {
    value: "linear",
    label: "线性",
  },
  {
    value: "ease",
    label: "Ease",
  },
  {
    value: "ease-in",
    label: "缓入",
  },
  {
    value: "ease-out",
    label: "缓出",
  },
  {
    value: "ease-in-out",
    label: "缓入缓出",
  },
] as const;

type CssEasingValue = (typeof CSS_EASING_OPTIONS)[number]["value"];

type EasingEditorSelection =
  | CssEasingValue
  | "cubic-bezier"
  | "steps"
  | "unsupported";

type InspectorUpdateOptions = {
  recordHistory?: boolean;
};

type AnimationTrackInspectorProps = {
  scene?: AnimationScene;
  elements: SlideElement[];
  requestedClipId?: string;
  requestedClipRequestId?: number;
  onSelectClip?: (elementId: string, clipId: string) => void;
  onAddClip?: (command: AddAnimationClipCommand) => void;
  onDuplicateClip?: (command: DuplicateAnimationClipCommand) => void;
  onDeleteClip?: (command: DeleteAnimationClipCommand) => void;
  onUpdateClipTiming?: (
    command: UpdateAnimationClipTimingCommand,
    options?: InspectorUpdateOptions,
  ) => void;
  onUpdateKeyframeValue?: (
    command: UpdateAnimationKeyframeValueCommand,
    options?: InspectorUpdateOptions,
  ) => void;
  onUpdateKeyframeEasing?: (
    command: UpdateAnimationKeyframeEasingCommand,
    options?: InspectorUpdateOptions,
  ) => void;
  onUpdateKeyframeOffset?: (
    command: UpdateAnimationKeyframeOffsetCommand,
    options?: InspectorUpdateOptions,
  ) => void;
  onAddKeyframe?: (command: AddAnimationKeyframeCommand) => void;
  onDeleteKeyframe?: (command: DeleteAnimationKeyframeCommand) => void;
  onBeginChange?: () => void;
  onFinishChange?: () => void;
};

type VisibleClip = {
  clip: AnimationClip;
  sequenceName: string;
  targetNames: string[];
};

/**
 * Read and edit Animation Schema V2 clips, tracks, and keyframes for the
 * currently checked property-panel targets.
 *
 * Every edit is forwarded through explicit V2 animation commands instead of
 * mutating inspector-local data.
 */
export function AnimationTrackInspector({
  scene,
  elements,
  requestedClipId,
  requestedClipRequestId,
  onSelectClip,
  onAddClip,
  onDuplicateClip,
  onDeleteClip,
  onUpdateClipTiming,
  onUpdateKeyframeValue,
  onUpdateKeyframeEasing,
  onUpdateKeyframeOffset,
  onAddKeyframe,
  onDeleteKeyframe,
  onBeginChange,
  onFinishChange,
}: AnimationTrackInspectorProps) {
  const selectedElementIds = new Set(elements.map((element) => element.id));

  const elementNameById = new Map(
    elements.map((element) => [element.id, element.name]),
  );

  const visibleClips = getVisibleClips(
    scene,
    selectedElementIds,
    elementNameById,
  );

  const [newClipPresetId, setNewClipPresetId] = useState(
    animationPresets[0]?.value ?? "fade-in",
  );

  /**
   * Remember the most recently activated card inside the inspector.
   *
   * requestId records which outside timeline request has already been handled,
   * allowing a later timeline click to take control again.
   */
  const [activeClipState, setActiveClipState] = useState<{
    clipId: string;
    requestId: number;
  } | null>(null);

  const selectedPreset = animationPresets.find(
    (preset) => preset.value === newClipPresetId,
  );

  const visibleRequestedClip = requestedClipId
    ? visibleClips.find((item) => item.clip.id === requestedClipId)?.clip
    : undefined;

  const visibleLocallyActiveClip = activeClipState
    ? visibleClips.find((item) => item.clip.id === activeClipState.clipId)?.clip
    : undefined;

  /**
   * An unhandled timeline request temporarily takes priority over local card
   * selection. Clicking another card records the current request as handled.
   */
  const requestedClipIsNew =
    visibleRequestedClip !== undefined &&
    requestedClipRequestId !== undefined &&
    activeClipState?.requestId !== requestedClipRequestId;

  const resolvedActiveClipId = requestedClipIsNew
    ? visibleRequestedClip.id
    : visibleLocallyActiveClip
      ? visibleLocallyActiveClip.id
      : visibleRequestedClip
        ? visibleRequestedClip.id
        : (visibleClips[0]?.clip.id ?? null);

  function handleAddClip() {
    const element = elements[0];

    if (!element || elements.length !== 1 || !selectedPreset) {
      return;
    }

    onAddClip?.({
      elementId: element.id,
      presetId: selectedPreset.keyframes,
      name: selectedPreset.name,
      category: "enter",
    });
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-black text-slate-800">V2 动画轨道</h3>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            当前已开放 Clip 播放参数，以及关键帧数值、位置、增删和区间缓动。
          </p>
        </div>

        <span className="shrink-0 rounded-full bg-slate-200 px-2.5 py-1 text-[11px] font-black text-slate-500">
          多 Clip
        </span>
      </div>

      {elements.length === 1 ? (
        <section className="mt-4 rounded-2xl border border-violet-100 bg-violet-50/60 p-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h4 className="text-xs font-black text-slate-700">
                添加动画 Clip
              </h4>

              <p className="mt-1 text-[10px] leading-4 text-slate-400">
                新动画会自动接在当前元素最后一个 Clip 之后。
              </p>
            </div>

            <span className="rounded-full bg-white px-2 py-1 text-[9px] font-black text-violet-500 shadow-sm">
              {visibleClips.length} 个
            </span>
          </div>

          <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] gap-2">
            <select
              className="min-w-0 rounded-xl bg-white px-3 py-2 text-xs font-bold text-slate-700 outline-none ring-1 ring-transparent transition focus:ring-violet-300"
              value={newClipPresetId}
              onChange={(event) => setNewClipPresetId(event.target.value)}
            >
              {animationPresets.map((preset) => (
                <option key={preset.value} value={preset.value}>
                  {preset.label}
                </option>
              ))}
            </select>

            <button
              type="button"
              className="rounded-xl bg-violet-500 px-4 py-2 text-xs font-black text-white transition hover:bg-violet-600 disabled:cursor-not-allowed disabled:bg-slate-300"
              disabled={!onAddClip || !selectedPreset}
              onClick={handleAddClip}
            >
              + 添加
            </button>
          </div>
        </section>
      ) : null}

      {visibleClips.length > 0 ? (
        <div className="mt-4 space-y-3">
          {visibleClips.map((item, index) => {
            const requested = item.clip.id === visibleRequestedClip?.id;

            const hasExternalFocusRequest =
              visibleRequestedClip !== undefined &&
              requestedClipRequestId !== undefined;

            const selectionElementId =
              item.clip.targets.find((target) =>
                selectedElementIds.has(target.elementId),
              )?.elementId ?? item.clip.targets[0]?.elementId;

            return (
              <AnimationClipCard
                key={`${item.clip.id}-${
                  hasExternalFocusRequest ? requestedClipRequestId : 0
                }`}
                item={item}
                defaultOpen={hasExternalFocusRequest ? requested : index === 0}
                active={item.clip.id === resolvedActiveClipId}
                focusRequestId={requested ? requestedClipRequestId : undefined}
                onActivate={() => {
                  setActiveClipState({
                    clipId: item.clip.id,
                    requestId:
                      requestedClipRequestId ?? activeClipState?.requestId ?? 0,
                  });

                  if (selectionElementId) {
                    onSelectClip?.(selectionElementId, item.clip.id);
                  }
                }}
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
            );
          })}
        </div>
      ) : (
        <div className="mt-4 rounded-xl border border-dashed border-slate-200 bg-white p-4 text-center">
          <p className="text-sm font-bold text-slate-500">
            当前勾选对象没有 V2 动画轨道
          </p>
          <p className="mt-1 text-xs leading-5 text-slate-400">
            先在上方选择一种进入动画，轨道和关键帧会自动显示在这里。
          </p>
        </div>
      )}
    </section>
  );
}

function AnimationClipCard({
  item,
  defaultOpen,
  active,
  focusRequestId,
  onActivate,
  onDuplicateClip,
  onDeleteClip,
  onUpdateClipTiming,
  onUpdateKeyframeValue,
  onUpdateKeyframeEasing,
  onUpdateKeyframeOffset,
  onAddKeyframe,
  onDeleteKeyframe,
  onBeginChange,
  onFinishChange,
}: {
  item: VisibleClip;
  defaultOpen: boolean;
  active: boolean;
  focusRequestId?: number;
  onActivate: () => void;
  onDuplicateClip?: (command: DuplicateAnimationClipCommand) => void;
  onDeleteClip?: (command: DeleteAnimationClipCommand) => void;
  onUpdateClipTiming?: (
    command: UpdateAnimationClipTimingCommand,
    options?: InspectorUpdateOptions,
  ) => void;
  onUpdateKeyframeValue?: (
    command: UpdateAnimationKeyframeValueCommand,
    options?: InspectorUpdateOptions,
  ) => void;
  onUpdateKeyframeEasing?: (
    command: UpdateAnimationKeyframeEasingCommand,
    options?: InspectorUpdateOptions,
  ) => void;
  onUpdateKeyframeOffset?: (
    command: UpdateAnimationKeyframeOffsetCommand,
    options?: InspectorUpdateOptions,
  ) => void;
  onAddKeyframe?: (command: AddAnimationKeyframeCommand) => void;
  onDeleteKeyframe?: (command: DeleteAnimationKeyframeCommand) => void;
  onBeginChange?: () => void;
  onFinishChange?: () => void;
}) {
  const [open, setOpen] = useState(defaultOpen);

  const cardRef = useRef<HTMLElement | null>(null);

  const { clip, sequenceName, targetNames } = item;

  /**
   * Scrolling is a DOM synchronization side effect, so it does not duplicate
   * project state or trigger the React set-state-in-effect lint rule.
   */
  useEffect(() => {
    if (focusRequestId === undefined) {
      return;
    }

    cardRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
    });
  }, [focusRequestId]);

  return (
    <article
      ref={cardRef}
      className={`overflow-hidden rounded-2xl border bg-white shadow-sm transition ${
        active
          ? "border-violet-300 ring-2 ring-violet-200"
          : "border-violet-100"
      }`}
    >
      <div className="flex items-start gap-2 p-3 transition hover:bg-violet-50/60">
        <button
          type="button"
          className="min-w-0 flex-1 text-left"
          onClick={() => {
            onActivate();
            setOpen((current) => !current);
          }}
        >
          <span className="block truncate text-sm font-black text-slate-800">
            {clip.name}
          </span>

          <span className="mt-1 block truncate text-[11px] text-slate-400">
            {targetNames.join("、")}
          </span>
        </button>

        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            className="rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-black text-slate-500 transition hover:bg-violet-100 hover:text-violet-600 disabled:cursor-not-allowed disabled:opacity-40"
            disabled={!onDuplicateClip}
            onClick={() => {
              onActivate();
              onDuplicateClip?.({ clipId: clip.id });
            }}
          >
            复制
          </button>

          <button
            type="button"
            className="rounded-lg bg-rose-50 px-2 py-1 text-[10px] font-black text-rose-500 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-40"
            disabled={!onDeleteClip}
            onClick={() => onDeleteClip?.({ clipId: clip.id })}
          >
            删除
          </button>

          <button
            type="button"
            className="rounded-full bg-violet-100 px-2.5 py-1 text-[11px] font-black text-violet-600"
            onClick={() => {
              onActivate();
              setOpen((current) => !current);
            }}
          >
            {open ? "收起" : "展开"}
          </button>
        </div>
      </div>

      {open ? (
        <div className="border-t border-violet-100 p-3">
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <InspectorMetadata label="序列" value={sequenceName} />

            <InspectorMetadata
              label="类型"
              value={getCategoryLabel(clip.category)}
            />
          </div>

          <section className="mt-3 rounded-xl border border-violet-100 bg-violet-50/50 p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h4 className="text-xs font-black text-slate-700">
                  Clip 播放参数
                </h4>

                <p className="mt-1 text-[10px] leading-4 text-slate-400">
                  修改当前动画片段的时间、循环、方向和独立播放速度。
                </p>
              </div>

              <span className="shrink-0 rounded-full bg-white px-2 py-1 text-[9px] font-black text-violet-500 shadow-sm">
                V2
              </span>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <ClipNumberInput
                label="开始时间"
                value={clip.startMs}
                min={0}
                step={10}
                suffix="ms"
                disabled={!onUpdateClipTiming}
                onBeginChange={onBeginChange}
                onFinishChange={onFinishChange}
                onCommit={(startMs) =>
                  onUpdateClipTiming?.(
                    {
                      clipId: clip.id,
                      updates: {
                        startMs,
                      },
                    },
                    {
                      recordHistory: false,
                    },
                  )
                }
              />

              <ClipNumberInput
                label="持续时间"
                value={clip.durationMs}
                min={1}
                step={10}
                suffix="ms"
                disabled={!onUpdateClipTiming}
                onBeginChange={onBeginChange}
                onFinishChange={onFinishChange}
                onCommit={(durationMs) =>
                  onUpdateClipTiming?.(
                    {
                      clipId: clip.id,
                      updates: {
                        durationMs,
                      },
                    },
                    {
                      recordHistory: false,
                    },
                  )
                }
              />

              <ClipNumberInput
                label="循环次数"
                value={clip.iterations}
                min={1}
                max={100}
                step={1}
                suffix="次"
                disabled={!onUpdateClipTiming}
                onBeginChange={onBeginChange}
                onFinishChange={onFinishChange}
                onCommit={(iterations) =>
                  onUpdateClipTiming?.(
                    {
                      clipId: clip.id,
                      updates: {
                        iterations,
                      },
                    },
                    {
                      recordHistory: false,
                    },
                  )
                }
              />

              <ClipNumberInput
                label="播放速度"
                value={clip.playbackRate ?? 1}
                min={0.05}
                max={16}
                step={0.1}
                suffix="×"
                disabled={!onUpdateClipTiming}
                onBeginChange={onBeginChange}
                onFinishChange={onFinishChange}
                onCommit={(playbackRate) =>
                  onUpdateClipTiming?.(
                    {
                      clipId: clip.id,
                      updates: {
                        playbackRate,
                      },
                    },
                    {
                      recordHistory: false,
                    },
                  )
                }
              />
            </div>

            <label className="mt-2 block">
              <span className="mb-1 block text-[10px] font-bold text-slate-400">
                播放方向
              </span>

              <select
                className="w-full rounded-xl bg-white px-3 py-2 text-xs font-bold text-slate-700 outline-none ring-1 ring-transparent transition focus:ring-violet-300 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-300"
                value={clip.direction}
                disabled={!onUpdateClipTiming}
                onChange={(event) =>
                  onUpdateClipTiming?.({
                    clipId: clip.id,
                    updates: {
                      direction: event.target
                        .value as AnimationClip["direction"],
                    },
                  })
                }
              >
                <option value="normal">正向</option>
                <option value="reverse">反向</option>
                <option value="alternate">正向往返</option>
                <option value="alternate-reverse">反向往返</option>
              </select>
            </label>
          </section>

          {clip.sourcePreset ? (
            <p className="mt-3 rounded-xl bg-violet-50 px-3 py-2 text-[11px] text-violet-500">
              来源预设：
              <span className="ml-1 font-black">
                {clip.sourcePreset.presetId}
              </span>
              <span className="ml-1">v{clip.sourcePreset.presetVersion}</span>
            </p>
          ) : null}

          <div className="mt-3 space-y-3">
            {clip.tracks.length > 0 ? (
              clip.tracks.map((track) => (
                <AnimationTrackCard
                  key={track.id}
                  clipId={clip.id}
                  track={track}
                  onUpdateKeyframeValue={onUpdateKeyframeValue}
                  onUpdateKeyframeEasing={onUpdateKeyframeEasing}
                  onUpdateKeyframeOffset={onUpdateKeyframeOffset}
                  onAddKeyframe={onAddKeyframe}
                  onDeleteKeyframe={onDeleteKeyframe}
                  onBeginChange={onBeginChange}
                  onFinishChange={onFinishChange}
                />
              ))
            ) : (
              <p className="rounded-xl bg-slate-50 p-3 text-xs text-slate-400">
                此 Clip 暂无属性轨道。
              </p>
            )}
          </div>
        </div>
      ) : null}
    </article>
  );
}

/**
 * Edit one numeric Clip parameter with a temporary text draft.
 *
 * The field may be completely empty while typing. Leaving an empty or invalid
 * field restores the latest stored project value without generating a change.
 */
function ClipNumberInput({
  label,
  value,
  min,
  max,
  step,
  suffix,
  disabled,
  onCommit,
  onBeginChange,
  onFinishChange,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step: number;
  suffix: string;
  disabled: boolean;
  onCommit: (value: number) => void;
  onBeginChange?: () => void;
  onFinishChange?: () => void;
}) {
  const [draftValue, setDraftValue] = useState(String(value));
  const [isEditing, setIsEditing] = useState(false);

  const displayedValue = isEditing ? draftValue : String(value);

  function commitDraftValue() {
    const trimmedValue = draftValue.trim();

    if (trimmedValue === "") {
      setDraftValue(String(value));
      return;
    }

    const parsedValue = Number(trimmedValue);

    if (!Number.isFinite(parsedValue)) {
      setDraftValue(String(value));
      return;
    }

    const minimumValue =
      min === undefined ? parsedValue : Math.max(min, parsedValue);

    const clampedValue =
      max === undefined ? minimumValue : Math.min(max, minimumValue);

    setDraftValue(String(clampedValue));

    if (Object.is(clampedValue, value)) {
      return;
    }

    onCommit(clampedValue);
  }

  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-bold text-slate-400">
        {label}
      </span>

      <span className="flex items-center rounded-xl bg-white px-2 ring-1 ring-transparent transition focus-within:ring-violet-300">
        <input
          type="number"
          className="min-w-0 flex-1 bg-transparent px-1 py-2 text-xs font-black text-slate-700 outline-none disabled:cursor-not-allowed disabled:text-slate-300"
          value={displayedValue}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          onFocus={() => {
            setDraftValue(String(value));
            setIsEditing(true);
            onBeginChange?.();
          }}
          onChange={(event) => {
            setDraftValue(event.target.value);
          }}
          onBlur={() => {
            commitDraftValue();
            setIsEditing(false);
            onFinishChange?.();
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.currentTarget.blur();
            }
          }}
        />

        <span className="shrink-0 text-[10px] font-black text-slate-400">
          {suffix}
        </span>
      </span>
    </label>
  );
}

function AnimationTrackCard({
  clipId,
  track,
  onUpdateKeyframeValue,
  onUpdateKeyframeEasing,
  onUpdateKeyframeOffset,
  onAddKeyframe,
  onDeleteKeyframe,
  onBeginChange,
  onFinishChange,
}: {
  clipId: string;
  track: AnimationTrack;
  onUpdateKeyframeValue?: (
    command: UpdateAnimationKeyframeValueCommand,
    options?: InspectorUpdateOptions,
  ) => void;
  onUpdateKeyframeEasing?: (
    command: UpdateAnimationKeyframeEasingCommand,
    options?: InspectorUpdateOptions,
  ) => void;
  onUpdateKeyframeOffset?: (
    command: UpdateAnimationKeyframeOffsetCommand,
    options?: InspectorUpdateOptions,
  ) => void;
  onAddKeyframe?: (command: AddAnimationKeyframeCommand) => void;
  onDeleteKeyframe?: (command: DeleteAnimationKeyframeCommand) => void;
  onBeginChange?: () => void;
  onFinishChange?: () => void;
}) {
  const sortedKeyframes = [...track.keyframes].sort(
    (left, right) =>
      left.offset - right.offset || left.id.localeCompare(right.id),
  );

  /**
   * A keyframe can be inserted only when at least one adjacent gap has enough
   * room to preserve the minimum separation on both sides.
   */
  const canAddKeyframe = hasAvailableKeyframeGap(sortedKeyframes);

  /**
   * Basic mode always keeps at least two keyframes on every animation track.
   */
  const canDeleteKeyframe = sortedKeyframes.length > 2;

  return (
    <section
      className={`rounded-xl border p-3 ${
        track.enabled
          ? "border-slate-200 bg-slate-50"
          : "border-slate-100 bg-slate-100 opacity-60"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 className="truncate text-xs font-black text-slate-700">
            {track.name}
          </h4>

          <p className="mt-1 truncate font-mono text-[10px] text-violet-500">
            {track.property}
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap justify-end gap-1">
          <TrackBadge value={getValueModeLabel(track.valueMode)} />
          <TrackBadge value={getBlendModeLabel(track.blendMode)} />

          <button
            type="button"
            className="rounded-full bg-violet-100 px-2 py-1 text-[9px] font-black text-violet-600 transition hover:bg-violet-200 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-300"
            disabled={!onAddKeyframe || !canAddKeyframe}
            title={
              canAddKeyframe
                ? "在最大关键帧空隙中添加关键帧"
                : "当前轨道没有足够的关键帧空隙"
            }
            onClick={() =>
              onAddKeyframe?.({
                clipId,
                trackId: track.id,
              })
            }
          >
            ＋关键帧
          </button>
        </div>
      </div>

      <KeyframePositionBar keyframes={sortedKeyframes} />

      <div className="mt-3 space-y-2">
        {sortedKeyframes.map((keyframe, keyframeIndex) => {
          const followingKeyframe = sortedKeyframes[keyframeIndex + 1];

          return (
            <div
              key={keyframe.id}
              className="grid grid-cols-[78px_minmax(0,1fr)] gap-2 rounded-lg bg-white px-2.5 py-2 text-[11px]"
            >
              <KeyframeOffsetInput
                value={keyframe.offset}
                offsetBounds={getKeyframeOffsetBounds(
                  sortedKeyframes,
                  keyframe.id,
                )}
                clipId={clipId}
                trackId={track.id}
                keyframeId={keyframe.id}
                onUpdateKeyframeOffset={onUpdateKeyframeOffset}
                onBeginChange={onBeginChange}
                onFinishChange={onFinishChange}
              />

              <div className="min-w-0">
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    {typeof keyframe.value === "number" ? (
                      <NumericKeyframeInput
                        value={keyframe.value}
                        property={track.property}
                        clipId={clipId}
                        trackId={track.id}
                        keyframeId={keyframe.id}
                        onUpdateKeyframeValue={onUpdateKeyframeValue}
                        onBeginChange={onBeginChange}
                        onFinishChange={onFinishChange}
                      />
                    ) : (
                      <span className="block truncate font-bold text-slate-700">
                        {formatAnimationValue(keyframe.value, track.property)}
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    className="shrink-0 rounded-lg bg-rose-50 px-2 py-1 text-[10px] font-black text-rose-500 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-300"
                    disabled={!onDeleteKeyframe || !canDeleteKeyframe}
                    title={
                      canDeleteKeyframe
                        ? "删除此关键帧"
                        : "每条轨道至少保留两个关键帧"
                    }
                    aria-label={`删除 ${formatOffset(keyframe.offset)} 关键帧`}
                    onClick={() =>
                      onDeleteKeyframe?.({
                        clipId,
                        trackId: track.id,
                        keyframeId: keyframe.id,
                      })
                    }
                  >
                    删除
                  </button>
                </div>

                {followingKeyframe ? (
                  <KeyframeEasingEditor
                    easing={keyframe.easing}
                    nextOffset={followingKeyframe.offset}
                    clipId={clipId}
                    trackId={track.id}
                    keyframeId={keyframe.id}
                    onUpdateKeyframeEasing={onUpdateKeyframeEasing}
                    onBeginChange={onBeginChange}
                    onFinishChange={onFinishChange}
                  />
                ) : (
                  <span className="mt-2 block rounded-lg bg-slate-50 px-2 py-1.5 text-[10px] text-slate-400">
                    末尾关键帧没有后续区间，不设置缓动。
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/**
 * Edit easing for the segment beginning at one keyframe.
 */
function KeyframeEasingEditor({
  easing,
  nextOffset,
  clipId,
  trackId,
  keyframeId,
  onUpdateKeyframeEasing,
  onBeginChange,
  onFinishChange,
}: {
  easing?: AnimationEasing;
  nextOffset: number;
  clipId: string;
  trackId: string;
  keyframeId: string;
  onUpdateKeyframeEasing?: (
    command: UpdateAnimationKeyframeEasingCommand,
    options?: InspectorUpdateOptions,
  ) => void;
  onBeginChange?: () => void;
  onFinishChange?: () => void;
}) {
  const selection = getEasingEditorSelection(easing);

  const cubicBezier =
    easing?.type === "cubic-bezier"
      ? easing
      : {
          type: "cubic-bezier" as const,
          x1: 0.25,
          y1: 0.1,
          x2: 0.25,
          y2: 1,
        };

  const steps =
    easing?.type === "steps"
      ? easing
      : {
          type: "steps" as const,
          count: 4,
          position: "end" as const,
        };

  function commitEasing(
    nextEasing: AnimationEasing,
    options?: InspectorUpdateOptions,
  ) {
    onUpdateKeyframeEasing?.(
      {
        clipId,
        trackId,
        keyframeId,
        easing: nextEasing,
      },
      options,
    );
  }

  return (
    <section className="mt-2 rounded-lg border border-violet-100 bg-violet-50/50 p-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-black text-violet-600">
          缓动至 {formatOffset(nextOffset)}
        </span>

        <span className="text-[9px] text-violet-400">同时间点轨道同步</span>
      </div>

      <select
        className="mt-2 w-full rounded-lg bg-white px-2 py-1.5 text-[11px] font-bold text-slate-700 outline-none ring-1 ring-transparent transition focus:ring-violet-300 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-300"
        value={selection}
        disabled={!onUpdateKeyframeEasing}
        onChange={(event) => {
          const nextSelection = event.target.value as EasingEditorSelection;

          if (nextSelection === "unsupported") {
            return;
          }

          commitEasing(createEasingFromSelection(nextSelection, easing));
        }}
      >
        {selection === "unsupported" ? (
          <option value="unsupported" disabled>
            {formatEasing(easing)}
          </option>
        ) : null}

        {CSS_EASING_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}

        <option value="cubic-bezier">自定义贝塞尔</option>

        <option value="steps">阶梯缓动</option>
      </select>

      {selection === "cubic-bezier" ? (
        <div className="mt-2 grid grid-cols-4 gap-1.5">
          <EasingNumberInput
            label="X1"
            value={cubicBezier.x1}
            min={0}
            max={1}
            step={0.01}
            disabled={!onUpdateKeyframeEasing}
            onBeginChange={onBeginChange}
            onFinishChange={onFinishChange}
            onCommit={(x1) =>
              commitEasing(
                {
                  ...cubicBezier,
                  x1,
                },
                {
                  recordHistory: false,
                },
              )
            }
          />

          <EasingNumberInput
            label="Y1"
            value={cubicBezier.y1}
            min={-4}
            max={4}
            step={0.01}
            disabled={!onUpdateKeyframeEasing}
            onBeginChange={onBeginChange}
            onFinishChange={onFinishChange}
            onCommit={(y1) =>
              commitEasing(
                {
                  ...cubicBezier,
                  y1,
                },
                {
                  recordHistory: false,
                },
              )
            }
          />

          <EasingNumberInput
            label="X2"
            value={cubicBezier.x2}
            min={0}
            max={1}
            step={0.01}
            disabled={!onUpdateKeyframeEasing}
            onBeginChange={onBeginChange}
            onFinishChange={onFinishChange}
            onCommit={(x2) =>
              commitEasing(
                {
                  ...cubicBezier,
                  x2,
                },
                {
                  recordHistory: false,
                },
              )
            }
          />

          <EasingNumberInput
            label="Y2"
            value={cubicBezier.y2}
            min={-4}
            max={4}
            step={0.01}
            disabled={!onUpdateKeyframeEasing}
            onBeginChange={onBeginChange}
            onFinishChange={onFinishChange}
            onCommit={(y2) =>
              commitEasing(
                {
                  ...cubicBezier,
                  y2,
                },
                {
                  recordHistory: false,
                },
              )
            }
          />
        </div>
      ) : null}

      {selection === "steps" ? (
        <div className="mt-2 grid grid-cols-2 gap-2">
          <EasingNumberInput
            label="阶梯数量"
            value={steps.count}
            min={1}
            max={100}
            step={1}
            disabled={!onUpdateKeyframeEasing}
            onBeginChange={onBeginChange}
            onFinishChange={onFinishChange}
            onCommit={(count) =>
              commitEasing(
                {
                  ...steps,
                  count: Math.round(count),
                },
                {
                  recordHistory: false,
                },
              )
            }
          />

          <label className="block">
            <span className="mb-1 block text-[9px] font-bold text-slate-400">
              跳变位置
            </span>

            <select
              className="w-full rounded-lg bg-white px-2 py-1.5 text-[11px] font-bold text-slate-700 outline-none ring-1 ring-transparent transition focus:ring-violet-300 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-300"
              value={steps.position}
              disabled={!onUpdateKeyframeEasing}
              onChange={(event) =>
                commitEasing({
                  ...steps,
                  position: event.target.value as "start" | "end",
                })
              }
            >
              <option value="end">区间末尾</option>
              <option value="start">区间开头</option>
            </select>
          </label>
        </div>
      ) : null}
    </section>
  );
}

/**
 * Numeric input used by cubic-bezier and steps easing parameters.
 *
 * The value can be cleared while editing. Empty or invalid content restores the
 * stored project value when focus leaves the field.
 */
function EasingNumberInput({
  label,
  value,
  min,
  max,
  step,
  disabled,
  onCommit,
  onBeginChange,
  onFinishChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  disabled: boolean;
  onCommit: (value: number) => void;
  onBeginChange?: () => void;
  onFinishChange?: () => void;
}) {
  const [draftValue, setDraftValue] = useState(String(value));

  const [isEditing, setIsEditing] = useState(false);

  const displayedValue = isEditing ? draftValue : String(value);

  function commitDraftValue() {
    const trimmedValue = draftValue.trim();

    if (trimmedValue === "") {
      setDraftValue(String(value));
      return;
    }

    const parsedValue = Number(trimmedValue);

    if (!Number.isFinite(parsedValue)) {
      setDraftValue(String(value));
      return;
    }

    const clampedValue = Math.min(max, Math.max(min, parsedValue));

    setDraftValue(String(clampedValue));

    if (Object.is(clampedValue, value)) {
      return;
    }

    onCommit(clampedValue);
  }

  return (
    <label className="block">
      <span className="mb-1 block text-[9px] font-bold text-slate-400">
        {label}
      </span>

      <input
        type="number"
        className="w-full rounded-lg bg-white px-2 py-1.5 text-[11px] font-black text-slate-700 outline-none ring-1 ring-transparent transition focus:ring-violet-300 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-300"
        value={displayedValue}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onFocus={() => {
          setDraftValue(String(value));
          setIsEditing(true);
          onBeginChange?.();
        }}
        onChange={(event) => setDraftValue(event.target.value)}
        onBlur={() => {
          commitDraftValue();
          setIsEditing(false);
          onFinishChange?.();
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.currentTarget.blur();
          }
        }}
      />
    </label>
  );
}

/**
 * Edit one keyframe's normalized timeline offset as a percentage.
 *
 * animationScene stores 0 to 1, while the user-facing input displays 0% to
 * 100%. The temporary draft may be empty; leaving an empty or invalid field
 * restores the latest stored percentage without creating a project change.
 */
function KeyframeOffsetInput({
  value,
  offsetBounds,
  clipId,
  trackId,
  keyframeId,
  onUpdateKeyframeOffset,
  onBeginChange,
  onFinishChange,
}: {
  value: number;
  offsetBounds: {
    minimumOffset: number;
    maximumOffset: number;
  };
  clipId: string;
  trackId: string;
  keyframeId: string;
  onUpdateKeyframeOffset?: (
    command: UpdateAnimationKeyframeOffsetCommand,
    options?: InspectorUpdateOptions,
  ) => void;
  onBeginChange?: () => void;
  onFinishChange?: () => void;
}) {
  const storedPercentage = Number((value * 100).toFixed(4));

  const minimumPercentage = Number(
    (offsetBounds.minimumOffset * 100).toFixed(4),
  );

  const maximumPercentage = Number(
    (offsetBounds.maximumOffset * 100).toFixed(4),
  );

  const [draftValue, setDraftValue] = useState(String(storedPercentage));
  const [isEditing, setIsEditing] = useState(false);

  const displayedValue = isEditing ? draftValue : String(storedPercentage);

  function commitDraftValue() {
    const trimmedValue = draftValue.trim();

    if (trimmedValue === "") {
      setDraftValue(String(storedPercentage));
      return;
    }

    const parsedValue = Number(trimmedValue);

    if (!Number.isFinite(parsedValue)) {
      setDraftValue(String(storedPercentage));
      return;
    }

    const clampedPercentage = Math.min(
      maximumPercentage,
      Math.max(minimumPercentage, parsedValue),
    );

    const normalizedOffset = Number((clampedPercentage / 100).toFixed(6));

    setDraftValue(String(Number(clampedPercentage.toFixed(4))));

    if (Object.is(normalizedOffset, value)) {
      return;
    }

    onUpdateKeyframeOffset?.(
      {
        clipId,
        trackId,
        keyframeId,
        offset: normalizedOffset,
      },
      {
        recordHistory: false,
      },
    );
  }

  return (
    <div className="flex items-center gap-1">
      <input
        type="number"
        aria-label="关键帧位置百分比"
        title={`当前允许范围：${minimumPercentage}% ～ ${maximumPercentage}%`}
        className="min-w-0 flex-1 rounded-lg bg-violet-50 px-2 py-1 font-black text-violet-600 outline-none ring-1 ring-transparent transition focus:bg-white focus:ring-violet-300"
        value={displayedValue}
        min={minimumPercentage}
        max={maximumPercentage}
        step={0.1}
        onFocus={() => {
          setDraftValue(String(storedPercentage));
          setIsEditing(true);
          onBeginChange?.();
        }}
        onChange={(event) => {
          setDraftValue(event.target.value);
        }}
        onBlur={() => {
          commitDraftValue();
          setIsEditing(false);
          onFinishChange?.();
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.currentTarget.blur();
          }
        }}
      />

      <span className="shrink-0 text-[10px] font-black text-violet-500">%</span>
    </div>
  );
}

/**
 * Keep a temporary text draft while the user edits one numeric keyframe.
 *
 * The draft may be empty during editing. A valid number is committed when the
 * input loses focus. Leaving an empty or invalid draft restores the last stored
 * project value without creating a history entry.
 */
function NumericKeyframeInput({
  value,
  property,
  clipId,
  trackId,
  keyframeId,
  onUpdateKeyframeValue,
  onBeginChange,
  onFinishChange,
}: {
  value: number;
  property: AnimationTrack["property"];
  clipId: string;
  trackId: string;
  keyframeId: string;
  onUpdateKeyframeValue?: (
    command: UpdateAnimationKeyframeValueCommand,
    options?: InspectorUpdateOptions,
  ) => void;
  onBeginChange?: () => void;
  onFinishChange?: () => void;
}) {
  /**
   * The input draft is separate from the stored animation value so the field
   * can temporarily become completely empty while the user is typing.
   */
  const [draftValue, setDraftValue] = useState(String(value));

  /**
   * While focused, the input displays its temporary editable draft.
   *
   * Outside editing mode it reads the latest project value directly, so undo,
   * redo, and external animation changes appear immediately without an effect.
   */
  const [isEditing, setIsEditing] = useState(false);

  const displayedValue = isEditing ? draftValue : String(value);

  function normalizeValue(nextValue: number) {
    if (property === "opacity") {
      return Math.min(1, Math.max(0, nextValue));
    }

    return nextValue;
  }

  function commitDraftValue() {
    const trimmedValue = draftValue.trim();

    /**
     * An empty field means cancel this edit and restore the stored value.
     */
    if (trimmedValue === "") {
      setDraftValue(String(value));
      return;
    }

    const parsedValue = Number(trimmedValue);

    /**
     * Invalid input is treated the same as cancellation.
     */
    if (!Number.isFinite(parsedValue)) {
      setDraftValue(String(value));
      return;
    }

    const nextValue = normalizeValue(parsedValue);

    setDraftValue(String(nextValue));

    if (Object.is(nextValue, value)) {
      return;
    }

    onUpdateKeyframeValue?.(
      {
        clipId,
        trackId,
        keyframeId,
        value: nextValue,
      },
      {
        recordHistory: false,
      },
    );
  }

  return (
    <div className="flex items-center gap-1">
      <input
        type="number"
        className="min-w-0 flex-1 rounded-lg bg-slate-50 px-2 py-1 font-bold text-slate-700 outline-none ring-1 ring-transparent transition focus:bg-white focus:ring-violet-300"
        value={displayedValue}
        min={property === "opacity" ? 0 : undefined}
        max={property === "opacity" ? 1 : undefined}
        step={getNumericInputStep(property)}
        onFocus={() => {
          /**
           * Start every editing session from the latest stored project value.
           */
          setDraftValue(String(value));
          setIsEditing(true);
          onBeginChange?.();
        }}
        onChange={(event) => {
          /**
           * Do not immediately write into the project. Keeping the raw draft
           * allows empty text, negative signs, and decimal input while typing.
           */
          setDraftValue(event.target.value);
        }}
        onBlur={() => {
          commitDraftValue();
          setIsEditing(false);
          onFinishChange?.();
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.currentTarget.blur();
          }
        }}
      />

      <span className="shrink-0 text-[10px] font-bold text-slate-400">
        {getPropertyUnit(property)}
      </span>
    </div>
  );
}

/**
 * Check whether at least one adjacent-keyframe gap can contain another frame
 * while preserving the minimum basic-mode separation on both sides.
 */
function hasAvailableKeyframeGap(keyframes: AnimationTrack["keyframes"]) {
  if (keyframes.length < 2) {
    return false;
  }

  for (let index = 0; index < keyframes.length - 1; index += 1) {
    const gap = keyframes[index + 1].offset - keyframes[index].offset;

    if (gap > MINIMUM_KEYFRAME_OFFSET_GAP * 2) {
      return true;
    }
  }

  return false;
}

/**
 * Calculate the editable range for one keyframe in basic timeline mode.
 *
 * Neighboring keyframes cannot be crossed and retain a 0.1% separation.
 */
function getKeyframeOffsetBounds(
  keyframes: AnimationTrack["keyframes"],
  keyframeId: string,
) {
  const sortedKeyframes = [...keyframes].sort(
    (left, right) =>
      left.offset - right.offset || left.id.localeCompare(right.id),
  );

  const keyframeIndex = sortedKeyframes.findIndex(
    (keyframe) => keyframe.id === keyframeId,
  );

  if (keyframeIndex < 0) {
    return {
      minimumOffset: 0,
      maximumOffset: 1,
    };
  }

  const currentKeyframe = sortedKeyframes[keyframeIndex];
  const previousKeyframe = sortedKeyframes[keyframeIndex - 1];
  const followingKeyframe = sortedKeyframes[keyframeIndex + 1];

  const minimumOffset = previousKeyframe
    ? Math.min(1, previousKeyframe.offset + MINIMUM_KEYFRAME_OFFSET_GAP)
    : 0;

  const maximumOffset = followingKeyframe
    ? Math.max(0, followingKeyframe.offset - MINIMUM_KEYFRAME_OFFSET_GAP)
    : 1;

  if (minimumOffset > maximumOffset) {
    return {
      minimumOffset: currentKeyframe.offset,
      maximumOffset: currentKeyframe.offset,
    };
  }

  return {
    minimumOffset,
    maximumOffset,
  };
}

function KeyframePositionBar({
  keyframes,
}: {
  keyframes: AnimationTrack["keyframes"];
}) {
  return (
    <div className="mt-3 px-1">
      <div className="relative h-6">
        <div className="absolute left-0 right-0 top-3 h-0.5 rounded-full bg-slate-200" />

        {keyframes.map((keyframe) => {
          const percentage = Math.min(100, Math.max(0, keyframe.offset * 100));

          return (
            <span
              key={keyframe.id}
              className="absolute top-1.5 h-3.5 w-3.5 -translate-x-1/2 rotate-45 rounded-[3px] border-2 border-white bg-violet-500 shadow-sm"
              style={{
                left: `${percentage}%`,
              }}
              title={`${formatOffset(keyframe.offset)}：${String(
                keyframe.value,
              )}`}
            />
          );
        })}
      </div>

      <div className="flex justify-between text-[9px] font-bold text-slate-300">
        <span>0%</span>
        <span>100%</span>
      </div>
    </div>
  );
}

function InspectorMetadata({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 px-3 py-2">
      <p className="text-slate-400">{label}</p>
      <p className="mt-0.5 truncate font-bold text-slate-700">{value}</p>
    </div>
  );
}

function TrackBadge({ value }: { value: string }) {
  return (
    <span className="rounded-full bg-white px-2 py-1 text-[9px] font-black text-slate-400 shadow-sm">
      {value}
    </span>
  );
}

function getVisibleClips(
  scene: AnimationScene | undefined,
  selectedElementIds: Set<string>,
  elementNameById: Map<string, string>,
): VisibleClip[] {
  if (!scene || scene.schemaVersion !== 2) {
    return [];
  }

  const sequenceNameByClipId = new Map<string, string>();

  for (const sequenceId of scene.sequenceOrder) {
    const sequence = scene.sequences[sequenceId];

    if (!sequence) {
      continue;
    }

    for (const clipId of sequence.clipIds) {
      sequenceNameByClipId.set(clipId, sequence.name);
    }
  }

  return Object.values(scene.clips)
    .filter((clip) =>
      clip.targets.some((target) => selectedElementIds.has(target.elementId)),
    )
    .map((clip) => {
      const targetNames = Array.from(
        new Set(
          clip.targets
            .filter((target) => selectedElementIds.has(target.elementId))
            .map(
              (target) =>
                elementNameById.get(target.elementId) ?? target.elementId,
            ),
        ),
      );

      return {
        clip,
        sequenceName: sequenceNameByClipId.get(clip.id) ?? "未归入序列",
        targetNames,
      };
    })
    .sort(
      (left, right) =>
        left.clip.startMs - right.clip.startMs ||
        left.clip.name.localeCompare(right.clip.name),
    );
}

function getCategoryLabel(category: AnimationClip["category"]) {
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

function getValueModeLabel(mode: AnimationTrack["valueMode"]) {
  return mode === "relative" ? "相对值" : "绝对值";
}

function getBlendModeLabel(mode: AnimationTrack["blendMode"]) {
  switch (mode) {
    case "replace":
      return "替换";
    case "add":
      return "叠加";
    case "multiply":
      return "相乘";
  }
}

function formatOffset(offset: number) {
  const percentage = Math.min(100, Math.max(0, offset * 100));

  return `${Number(percentage.toFixed(1))}%`;
}

function formatAnimationValue(
  value: AnimationValue,
  property: AnimationTrack["property"],
) {
  if (typeof value === "number") {
    return `${formatNumber(value)}${getPropertyUnit(property)}`;
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }

  if ("r" in value) {
    return `rgba(${formatNumber(value.r)}, ${formatNumber(
      value.g,
    )}, ${formatNumber(value.b)}, ${formatNumber(value.a)})`;
  }

  if ("z" in value) {
    return `(${formatNumber(value.x)}, ${formatNumber(
      value.y,
    )}, ${formatNumber(value.z)})`;
  }

  return `(${formatNumber(value.x)}, ${formatNumber(value.y)})`;
}

function getPropertyUnit(property: AnimationTrack["property"]) {
  if (
    property === "transform.x" ||
    property === "transform.y" ||
    property === "transform.z" ||
    property === "filter.blur" ||
    property === "style.borderRadius"
  ) {
    return "px";
  }

  if (
    property === "transform.rotateX" ||
    property === "transform.rotateY" ||
    property === "transform.rotateZ" ||
    property === "transform.skewX" ||
    property === "transform.skewY" ||
    property === "filter.hueRotate"
  ) {
    return "°";
  }

  return "";
}

function getEasingEditorSelection(
  easing?: AnimationEasing,
): EasingEditorSelection {
  if (!easing) {
    return "linear";
  }

  if (easing.type === "css") {
    const supported = CSS_EASING_OPTIONS.some(
      (option) => option.value === easing.value,
    );

    return supported ? (easing.value as CssEasingValue) : "unsupported";
  }

  if (easing.type === "cubic-bezier" || easing.type === "steps") {
    return easing.type;
  }

  return "unsupported";
}

function createEasingFromSelection(
  selection: Exclude<EasingEditorSelection, "unsupported">,
  currentEasing?: AnimationEasing,
): AnimationEasing {
  if (selection === "cubic-bezier") {
    return currentEasing?.type === "cubic-bezier"
      ? currentEasing
      : {
          type: "cubic-bezier",
          x1: 0.25,
          y1: 0.1,
          x2: 0.25,
          y2: 1,
        };
  }

  if (selection === "steps") {
    return currentEasing?.type === "steps"
      ? currentEasing
      : {
          type: "steps",
          count: 4,
          position: "end",
        };
  }

  return {
    type: "css",
    value: selection,
  };
}

function formatEasing(easing?: AnimationEasing) {
  if (!easing) {
    return "默认线性过渡";
  }

  switch (easing.type) {
    case "css":
      return `缓动：${easing.value}`;

    case "cubic-bezier":
      return `贝塞尔：${easing.x1}, ${easing.y1}, ${easing.x2}, ${easing.y2}`;

    case "steps":
      return `阶梯：${easing.count} / ${easing.position}`;

    case "spring":
      return `弹簧：质量 ${easing.mass}，刚度 ${easing.stiffness}，阻尼 ${easing.damping}`;

    case "bounce":
      return `弹跳：强度 ${easing.intensity}`;

    case "custom-curve":
      return `自定义曲线：${easing.points.length} 个控制点`;
  }
}

function getNumericInputStep(property: AnimationTrack["property"]) {
  if (
    property === "opacity" ||
    property === "transform.scaleX" ||
    property === "transform.scaleY"
  ) {
    return 0.01;
  }

  return 1;
}

function formatNumber(value: number) {
  return Number(value.toFixed(4));
}
