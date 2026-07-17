import { useState } from "react";
import type {
  AnimationClip,
  AnimationEasing,
  AnimationScene,
  SlideElement,
  SlideElementAnimation,
} from "../../types/presentation";
import type {
  UpdateAnimationClipEasingCommand,
  UpdateAnimationClipTimingCommand,
} from "../../utils/animationCommands";
import { animationPresets } from "../../utils/animationPresets";

type BatchEditOptions = {
  recordHistory?: boolean;
};

export type AnimationElementBatchUpdate = {
  elementId: string;
  updates: {
    animations: SlideElementAnimation[];
  };
};

type AnimationBatchEditorProps = {
  scene?: AnimationScene;
  elements: SlideElement[];
  onOpenElementDetails?: (elementId: string) => void;
  onUpdateElements?: (
    updates: AnimationElementBatchUpdate[],
    options?: BatchEditOptions,
  ) => void;
  onUpdateClipTimings?: (
    commands: UpdateAnimationClipTimingCommand[],
    options?: BatchEditOptions,
  ) => void;
  onUpdateClipEasings?: (
    commands: UpdateAnimationClipEasingCommand[],
    options?: BatchEditOptions,
  ) => void;
  onBeginChange?: () => void;
  onFinishChange?: () => void;
};

const BATCH_EASING_OPTIONS = [
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

type BatchEasingValue = (typeof BATCH_EASING_OPTIONS)[number]["value"];

type BatchEasingSelection = BatchEasingValue | "custom";

function getSharedValue<T>(values: T[]): T | undefined {
  if (values.length === 0) {
    return undefined;
  }

  const firstValue = values[0];

  return values.every((value) => Object.is(value, firstValue))
    ? firstValue
    : undefined;
}

function getPrimaryAnimationClip(
  scene: AnimationScene | undefined,
  element: SlideElement,
) {
  const animationId = element.animations[0]?.id;

  if (!scene || !animationId) {
    return undefined;
  }

  return Object.values(scene.clips).find(
    (clip) =>
      clip.metadata?.legacyAnimationId === animationId &&
      clip.targets.some((target) => target.elementId === element.id),
  );
}

/**
 * Read one Clip-wide easing value.
 *
 * When different segments already use different curves, batch mode reports
 * "custom" instead of hiding the detailed per-segment configuration.
 */
function getClipBatchEasing(clip: AnimationClip): BatchEasingSelection {
  const outgoingEasings = clip.tracks.flatMap((track) => {
    const sortedKeyframes = [...track.keyframes].sort(
      (left, right) =>
        left.offset - right.offset || left.id.localeCompare(right.id),
    );

    return sortedKeyframes.slice(0, -1).map(
      (keyframe) =>
        keyframe.easing ?? {
          type: "css" as const,
          value: "linear",
        },
    );
  });

  if (outgoingEasings.length === 0) {
    return "linear";
  }

  const firstSerialized = JSON.stringify(outgoingEasings[0]);

  const allSegmentsMatch = outgoingEasings.every(
    (easing) => JSON.stringify(easing) === firstSerialized,
  );

  if (!allSegmentsMatch) {
    return "custom";
  }

  const firstEasing = outgoingEasings[0];

  if (firstEasing.type !== "css") {
    return "custom";
  }

  const supported = BATCH_EASING_OPTIONS.some(
    (option) => option.value === firstEasing.value,
  );

  return supported ? (firstEasing.value as BatchEasingValue) : "custom";
}

export function AnimationBatchEditor({
  scene,
  elements,
  onOpenElementDetails,
  onUpdateElements,
  onUpdateClipTimings,
  onUpdateClipEasings,
  onBeginChange,
  onFinishChange,
}: AnimationBatchEditorProps) {
  const primaryClipEntries = elements.map((element) => ({
    element,
    clip: getPrimaryAnimationClip(scene, element),
  }));

  const primaryClips = Array.from(
    new Map(
      primaryClipEntries
        .map(({ clip }) => clip)
        .filter((clip): clip is AnimationClip => Boolean(clip))
        .map((clip) => [clip.id, clip] as const),
    ).values(),
  );

  const allElementsHaveAnimation =
    elements.length > 0 &&
    elements.every((element) => element.animations.length > 0);

  const allElementsHavePrimaryClip =
    elements.length > 0 &&
    primaryClipEntries.every(({ clip }) => Boolean(clip));

  const sharedPreset = getSharedValue(
    elements.map((element) => element.animations[0]?.keyframes ?? "none"),
  );

  const sharedStartMs = getSharedValue(
    primaryClips.map((clip) => clip.startMs),
  );

  const sharedDurationMs = getSharedValue(
    primaryClips.map((clip) => clip.durationMs),
  );

  const sharedIterations = getSharedValue(
    primaryClips.map((clip) => clip.iterations),
  );

  const sharedPlaybackRate = getSharedValue(
    primaryClips.map((clip) => clip.playbackRate ?? 1),
  );

  const sharedDirection = getSharedValue(
    primaryClips.map((clip) => clip.direction),
  );

  const sharedEasing = getSharedValue(primaryClips.map(getClipBatchEasing));

  function updatePreset(value: string) {
    if (value === "mixed" || elements.length === 0) {
      return;
    }

    if (value === "none") {
      onUpdateElements?.(
        elements.map((element) => ({
          elementId: element.id,
          updates: {
            animations: [],
          },
        })),
      );

      return;
    }

    const preset = animationPresets.find(
      (item) => item.value === value || item.keyframes === value,
    );

    if (!preset) {
      return;
    }

    const now = Date.now();

    onUpdateElements?.(
      elements.map((element, index) => {
        const oldAnimation = element.animations[0];

        const animation: SlideElementAnimation = {
          id: oldAnimation?.id ?? `animation-${element.id}-${now}-${index}`,
          name: preset.name,
          type: "enter",
          duration: oldAnimation?.duration ?? 600,
          delay: oldAnimation?.delay ?? 0,
          easing: oldAnimation?.easing ?? "ease-out",
          keyframes: preset.keyframes,
        };

        return {
          elementId: element.id,
          updates: {
            animations: [animation],
          },
        };
      }),
    );
  }

  function updateClipTiming(
    updates: UpdateAnimationClipTimingCommand["updates"],
    options?: BatchEditOptions,
  ) {
    if (!allElementsHavePrimaryClip || primaryClips.length === 0) {
      return;
    }

    onUpdateClipTimings?.(
      primaryClips.map((clip) => ({
        clipId: clip.id,
        updates,
      })),
      options,
    );
  }

  function updateClipEasing(value: string) {
    if (
      value === "mixed" ||
      value === "custom" ||
      !allElementsHavePrimaryClip
    ) {
      return;
    }

    const easing: AnimationEasing = {
      type: "css",
      value,
    };

    onUpdateClipEasings?.(
      primaryClips.map((clip) => ({
        clipId: clip.id,
        easing,
      })),
    );
  }

  const timingDisabled =
    !allElementsHaveAnimation ||
    !allElementsHavePrimaryClip ||
    primaryClips.length === 0;

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-violet-100 bg-violet-50/60 p-4">
        <h3 className="text-sm font-black text-violet-700">批量动画编辑</h3>

        <p className="mt-2 text-xs leading-5 text-violet-500">
          当前修改会同时作用于 {elements.length} 个框选元素。
          具体轨道和关键帧仍需进入单个对象编辑。
        </p>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <label className="block">
          <span className="mb-1 block text-xs font-bold text-slate-500">
            进入动画预设
          </span>

          <select
            className="w-full rounded-xl bg-slate-50 px-3 py-2 text-sm font-bold text-slate-700 outline-none ring-1 ring-transparent transition focus:bg-white focus:ring-violet-300"
            value={sharedPreset ?? "mixed"}
            disabled={!onUpdateElements}
            onChange={(event) => updatePreset(event.target.value)}
          >
            {sharedPreset === undefined ? (
              <option value="mixed" disabled>
                混合
              </option>
            ) : null}

            <option value="none">无动画</option>

            {animationPresets.map((preset) => (
              <option key={preset.value} value={preset.keyframes}>
                {preset.label}
              </option>
            ))}
          </select>
        </label>

        <div className="mt-3 grid grid-cols-2 gap-3">
          <BatchNumberInput
            label="开始时间"
            value={sharedStartMs}
            placeholder="混合"
            suffix="ms"
            min={0}
            step={100}
            disabled={timingDisabled}
            onBeginChange={onBeginChange}
            onFinishChange={onFinishChange}
            onCommit={(startMs) =>
              updateClipTiming(
                {
                  startMs,
                },
                {
                  recordHistory: false,
                },
              )
            }
          />

          <BatchNumberInput
            label="持续时间"
            value={sharedDurationMs}
            placeholder="混合"
            suffix="ms"
            min={1}
            step={100}
            disabled={timingDisabled}
            onBeginChange={onBeginChange}
            onFinishChange={onFinishChange}
            onCommit={(durationMs) =>
              updateClipTiming(
                {
                  durationMs,
                },
                {
                  recordHistory: false,
                },
              )
            }
          />

          <BatchNumberInput
            label="循环次数"
            value={sharedIterations}
            placeholder="混合"
            suffix="次"
            min={1}
            max={100}
            step={1}
            disabled={timingDisabled}
            onBeginChange={onBeginChange}
            onFinishChange={onFinishChange}
            onCommit={(iterations) =>
              updateClipTiming(
                {
                  iterations,
                },
                {
                  recordHistory: false,
                },
              )
            }
          />

          <BatchNumberInput
            label="播放速度"
            value={sharedPlaybackRate}
            placeholder="混合"
            suffix="×"
            min={0.05}
            max={16}
            step={0.1}
            disabled={timingDisabled}
            onBeginChange={onBeginChange}
            onFinishChange={onFinishChange}
            onCommit={(playbackRate) =>
              updateClipTiming(
                {
                  playbackRate,
                },
                {
                  recordHistory: false,
                },
              )
            }
          />
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-xs font-bold text-slate-500">
              播放方向
            </span>

            <select
              className="w-full rounded-xl bg-slate-50 px-3 py-2 text-sm font-bold text-slate-700 outline-none ring-1 ring-transparent transition focus:bg-white focus:ring-violet-300 disabled:cursor-not-allowed disabled:text-slate-300"
              value={sharedDirection ?? "mixed"}
              disabled={timingDisabled}
              onChange={(event) => {
                if (event.target.value === "mixed") {
                  return;
                }

                updateClipTiming({
                  direction: event.target.value as AnimationClip["direction"],
                });
              }}
            >
              {sharedDirection === undefined ? (
                <option value="mixed" disabled>
                  混合
                </option>
              ) : null}

              <option value="normal">正向</option>
              <option value="reverse">反向</option>
              <option value="alternate">正向往返</option>
              <option value="alternate-reverse">反向往返</option>
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-bold text-slate-500">
              整体缓动
            </span>

            <select
              className="w-full rounded-xl bg-slate-50 px-3 py-2 text-sm font-bold text-slate-700 outline-none ring-1 ring-transparent transition focus:bg-white focus:ring-violet-300 disabled:cursor-not-allowed disabled:text-slate-300"
              value={sharedEasing ?? "mixed"}
              disabled={timingDisabled || !onUpdateClipEasings}
              onChange={(event) => updateClipEasing(event.target.value)}
            >
              {sharedEasing === undefined ? (
                <option value="mixed" disabled>
                  混合
                </option>
              ) : null}

              {sharedEasing === "custom" ? (
                <option value="custom" disabled>
                  自定义/分段
                </option>
              ) : null}

              {BATCH_EASING_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {!allElementsHaveAnimation ? (
          <p className="mt-3 rounded-xl bg-violet-50 p-3 text-xs leading-5 text-violet-500">
            部分元素尚未设置动画。请先统一选择一种进入动画， 再修改 Clip
            播放参数。
          </p>
        ) : null}

        {allElementsHaveAnimation && !allElementsHavePrimaryClip ? (
          <p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-600">
            部分元素尚未建立对应的 V2 Clip。 重新选择一次当前预设即可完成同步。
          </p>
        ) : null}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <h3 className="text-sm font-black text-slate-800">单独编辑对象</h3>

        <p className="mt-1 text-xs leading-5 text-slate-400">
          进入单个对象的详细轨道不会取消幕布上的多选。
        </p>

        <div className="mt-3 grid grid-cols-2 gap-2">
          {elements.map((element, index) => (
            <button
              key={element.id}
              type="button"
              className="min-w-0 rounded-xl border border-violet-100 bg-violet-50/40 px-3 py-3 text-left transition hover:border-violet-300 hover:bg-violet-50"
              onClick={() => onOpenElementDetails?.(element.id)}
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
    </div>
  );
}

function BatchNumberInput({
  label,
  value,
  placeholder,
  suffix,
  min,
  max,
  step,
  disabled,
  onCommit,
  onBeginChange,
  onFinishChange,
}: {
  label: string;
  value?: number;
  placeholder: string;
  suffix: string;
  min: number;
  max?: number;
  step: number;
  disabled: boolean;
  onCommit: (value: number) => void;
  onBeginChange?: () => void;
  onFinishChange?: () => void;
}) {
  const [draftValue, setDraftValue] = useState("");
  const [isEditing, setIsEditing] = useState(false);

  const displayedValue = isEditing
    ? draftValue
    : value === undefined
      ? ""
      : String(value);

  function commitDraftValue() {
    const trimmedValue = draftValue.trim();

    if (trimmedValue === "") {
      setDraftValue(value === undefined ? "" : String(value));
      return;
    }

    const parsedValue = Number(trimmedValue);

    if (!Number.isFinite(parsedValue)) {
      setDraftValue(value === undefined ? "" : String(value));
      return;
    }

    const minimumValue = Math.max(min, parsedValue);

    const clampedValue =
      max === undefined ? minimumValue : Math.min(max, minimumValue);

    setDraftValue(String(clampedValue));

    if (value !== undefined && Object.is(clampedValue, value)) {
      return;
    }

    onCommit(clampedValue);
  }

  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold text-slate-500">
        {label}
      </span>

      <span className="flex items-center rounded-xl bg-slate-50 px-2 ring-1 ring-transparent transition focus-within:bg-white focus-within:ring-violet-300">
        <input
          type="number"
          className="min-w-0 flex-1 bg-transparent px-1 py-2 text-sm font-black text-slate-700 outline-none disabled:cursor-not-allowed disabled:text-slate-300"
          value={displayedValue}
          placeholder={placeholder}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          onFocus={() => {
            setDraftValue(value === undefined ? "" : String(value));
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

        <span className="shrink-0 text-[10px] font-black text-slate-400">
          {suffix}
        </span>
      </span>
    </label>
  );
}
