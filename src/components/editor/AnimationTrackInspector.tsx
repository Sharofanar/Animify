import { useState } from "react";
import type {
  AnimationClip,
  AnimationEasing,
  AnimationScene,
  AnimationTrack,
  AnimationValue,
  SlideElement,
} from "../../types/presentation";
import type { UpdateAnimationKeyframeValueCommand } from "../../utils/animationCommands";

type InspectorUpdateOptions = {
  recordHistory?: boolean;
};

type AnimationTrackInspectorProps = {
  scene?: AnimationScene;
  elements: SlideElement[];
  onUpdateKeyframeValue?: (
    command: UpdateAnimationKeyframeValueCommand,
    options?: InspectorUpdateOptions,
  ) => void;
  onBeginChange?: () => void;
  onFinishChange?: () => void;
};

type VisibleClip = {
  clip: AnimationClip;
  sequenceName: string;
  targetNames: string[];
};

/**
 * Read Animation Schema V2 clips, tracks, and keyframes for the currently
 * checked property-panel targets.
 *
 * This first version is intentionally read-only. Editing commands will be added
 * only after the stored track structure has been visually verified.
 */
export function AnimationTrackInspector({
  scene,
  elements,
  onUpdateKeyframeValue,
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

  return (
    <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-black text-slate-800">V2 动画轨道</h3>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            当前先开放数值关键帧编辑，位置、增删和缓动将在后续阶段开放。
          </p>
        </div>

        <span className="shrink-0 rounded-full bg-slate-200 px-2.5 py-1 text-[11px] font-black text-slate-500">
          数值可编辑
        </span>
      </div>

      {visibleClips.length > 0 ? (
        <div className="mt-4 space-y-3">
          {visibleClips.map((item, index) => (
            <AnimationClipCard
              key={item.clip.id}
              item={item}
              defaultOpen={index === 0}
              onUpdateKeyframeValue={onUpdateKeyframeValue}
              onBeginChange={onBeginChange}
              onFinishChange={onFinishChange}
            />
          ))}
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
  onUpdateKeyframeValue,
  onBeginChange,
  onFinishChange,
}: {
  item: VisibleClip;
  defaultOpen: boolean;
  onUpdateKeyframeValue?: (
    command: UpdateAnimationKeyframeValueCommand,
    options?: InspectorUpdateOptions,
  ) => void;
  onBeginChange?: () => void;
  onFinishChange?: () => void;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const { clip, sequenceName, targetNames } = item;

  return (
    <article className="overflow-hidden rounded-2xl border border-violet-100 bg-white shadow-sm">
      <button
        type="button"
        className="flex w-full items-start justify-between gap-3 p-3 text-left transition hover:bg-violet-50/60"
        onClick={() => setOpen((current) => !current)}
      >
        <span className="min-w-0">
          <span className="block truncate text-sm font-black text-slate-800">
            {clip.name}
          </span>

          <span className="mt-1 block truncate text-[11px] text-slate-400">
            {targetNames.join("、")}
          </span>
        </span>

        <span className="shrink-0 rounded-full bg-violet-100 px-2.5 py-1 text-[11px] font-black text-violet-600">
          {open ? "收起" : "展开"}
        </span>
      </button>

      {open ? (
        <div className="border-t border-violet-100 p-3">
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <InspectorMetadata label="序列" value={sequenceName} />
            <InspectorMetadata
              label="类型"
              value={getCategoryLabel(clip.category)}
            />
            <InspectorMetadata label="开始" value={`${clip.startMs} ms`} />
            <InspectorMetadata label="时长" value={`${clip.durationMs} ms`} />
            <InspectorMetadata label="循环" value={`${clip.iterations} 次`} />
            <InspectorMetadata
              label="方向"
              value={getDirectionLabel(clip.direction)}
            />
          </div>

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

function AnimationTrackCard({
  clipId,
  track,
  onUpdateKeyframeValue,
  onBeginChange,
  onFinishChange,
}: {
  clipId: string;
  track: AnimationTrack;
  onUpdateKeyframeValue?: (
    command: UpdateAnimationKeyframeValueCommand,
    options?: InspectorUpdateOptions,
  ) => void;
  onBeginChange?: () => void;
  onFinishChange?: () => void;
}) {
  const sortedKeyframes = [...track.keyframes].sort(
    (left, right) => left.offset - right.offset,
  );

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

        <div className="flex shrink-0 gap-1">
          <TrackBadge value={getValueModeLabel(track.valueMode)} />
          <TrackBadge value={getBlendModeLabel(track.blendMode)} />
        </div>
      </div>

      <KeyframePositionBar keyframes={sortedKeyframes} />

      <div className="mt-3 space-y-2">
        {sortedKeyframes.map((keyframe) => (
          <div
            key={keyframe.id}
            className="grid grid-cols-[54px_minmax(0,1fr)] gap-2 rounded-lg bg-white px-2.5 py-2 text-[11px]"
          >
            <span className="font-black text-violet-600">
              {formatOffset(keyframe.offset)}
            </span>

            <span className="min-w-0">
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

              <span className="mt-0.5 block truncate text-[10px] text-slate-400">
                {keyframe.hold ? "保持关键帧" : formatEasing(keyframe.easing)}
              </span>
            </span>
          </div>
        ))}
      </div>
    </section>
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

function getDirectionLabel(direction: AnimationClip["direction"]) {
  switch (direction) {
    case "normal":
      return "正向";
    case "reverse":
      return "反向";
    case "alternate":
      return "往返";
    case "alternate-reverse":
      return "反向往返";
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
