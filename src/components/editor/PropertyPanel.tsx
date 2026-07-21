import { useState } from "react";
import type {
  AnimationClip,
  AnimationScene,
  SlideElement,
} from "../../types/presentation";
import type { UpdateAnimationClipTimingCommand } from "../../utils/animationCommands";

type LayerAction =
  | "bring-forward"
  | "send-backward"
  | "bring-to-front"
  | "send-to-back";

type PropertyTab = "basic" | "font" | "animation" | "layer";

type ElementUpdates = Partial<Omit<SlideElement, "style">> & {
  style?: Partial<SlideElement["style"]>;
};

type PropertyUpdateOptions = {
  recordHistory?: boolean;
};

type ActiveAnimationContext = {
  elementId: string;
  clipId: string;
  requestId: number;
};

type PageAnimationItem = {
  clip: AnimationClip;
  elementId: string;
  elementName: string;
  sequenceName: string;
};

type ElementBatchUpdate = {
  elementId: string;
  updates: ElementUpdates;
};

type PropertyPanelProps = {
  selectedElements: SlideElement[];
  targetElementIds: string[];
  slideElements: SlideElement[];
  animationScene?: AnimationScene;
  activeAnimationContext?: ActiveAnimationContext;
  onSelectAnimationClip?: (elementId: string, clipId: string) => void;
  onUpdateAnimationClipTiming?: (
    command: UpdateAnimationClipTimingCommand,
    options?: PropertyUpdateOptions,
  ) => void;
  onOpenAnimationWorkspace?: () => void;
  onTargetElementIdsChange?: (elementIds: string[]) => void;
  onUpdateElements?: (
    batchUpdates: ElementBatchUpdate[],
    options?: PropertyUpdateOptions,
  ) => void;
  onBeginPropertyChange?: () => void;
  onFinishPropertyChange?: () => void;
  onDeleteElement?: (elementId: string) => void;
  onLayerElement?: (
    elementId: string,
    action: LayerAction,
    targetElementIds?: string[],
  ) => void;
};

const propertyTabs: Array<{
  id: PropertyTab;
  label: string;
}> = [
  { id: "basic", label: "基础" },
  { id: "font", label: "字体" },
  { id: "animation", label: "动画" },
  { id: "layer", label: "图层" },
];

const elementTypeLabels: Record<SlideElement["type"], string> = {
  text: "文本",
  shape: "形状",
  image: "图片",
  video: "视频",
  audio: "音频",
  svg: "SVG",
};

function getAnimationCategoryLabel(category: AnimationClip["category"]) {
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

/**
 * Read every active-slide Clip in sequence order.
 *
 * Orphan Clips are appended by start time so partially migrated projects never
 * hide animation data from the user.
 */
function getPageAnimationItems(
  scene: AnimationScene | undefined,
  elements: SlideElement[],
): PageAnimationItem[] {
  if (!scene || scene.schemaVersion !== 2) {
    return [];
  }

  /**
   * Preserve the narrowed V2 scene type inside nested helper functions.
   */
  const activeScene = scene;

  const elementNameById = new Map(
    elements.map((element) => [element.id, element.name]),
  );

  const includedClipIds = new Set<string>();
  const items: PageAnimationItem[] = [];

  function appendClip(clipId: string, sequenceName: string) {
    if (includedClipIds.has(clipId)) {
      return;
    }

    const clip = activeScene.clips[clipId];

    if (!clip) {
      return;
    }

    const target =
      clip.targets.find((item) => elementNameById.has(item.elementId)) ??
      clip.targets[0];

    if (!target) {
      return;
    }

    includedClipIds.add(clip.id);

    items.push({
      clip,
      elementId: target.elementId,
      elementName: elementNameById.get(target.elementId) ?? target.elementId,
      sequenceName,
    });
  }

  for (const sequenceId of activeScene.sequenceOrder) {
    const sequence = activeScene.sequences[sequenceId];

    if (!sequence) {
      continue;
    }

    for (const clipId of sequence.clipIds) {
      appendClip(clipId, sequence.name);
    }
  }

  Object.values(activeScene.clips)
    .sort(
      (left, right) =>
        left.startMs - right.startMs || left.name.localeCompare(right.name),
    )
    .forEach((clip) => {
      appendClip(clip.id, "未分组序列");
    });

  /**
   * Until relational scheduling is introduced, the animation pane follows the
   * actual absolute playback time shown by the lower timeline.
   *
   * JavaScript's stable sort preserves sequence order when Clips share the same
   * start time.
   */
  return items.sort((left, right) => left.clip.startMs - right.clip.startMs);
}

/**
 * Return one shared value when every target uses the same value.
 *
 * Undefined means the selected targets contain mixed values.
 */
function getSharedValue<T>(values: T[]): T | undefined {
  if (values.length === 0) {
    return undefined;
  }

  const firstValue = values[0];

  return values.every((value) => Object.is(value, firstValue))
    ? firstValue
    : undefined;
}

export function PropertyPanel({
  selectedElements,
  targetElementIds,
  slideElements,
  animationScene,
  activeAnimationContext,
  onSelectAnimationClip,
  onUpdateAnimationClipTiming,
  onOpenAnimationWorkspace,
  onTargetElementIdsChange,
  onUpdateElements,
  onBeginPropertyChange,
  onFinishPropertyChange,
  onDeleteElement,
  onLayerElement,
}: PropertyPanelProps) {
  const [activeTab, setActiveTab] = useState<PropertyTab>("basic");

  const targetElementIdSet = new Set(targetElementIds);
  const targetElements = selectedElements.filter((element) =>
    targetElementIdSet.has(element.id),
  );

  const pageAnimationItems = getPageAnimationItems(
    animationScene,
    slideElements,
  );

  const activeAnimationClip =
    activeAnimationContext && animationScene?.schemaVersion === 2
      ? animationScene.clips[activeAnimationContext.clipId]
      : undefined;

  const activeAnimationElement = activeAnimationContext
    ? slideElements.find(
        (element) => element.id === activeAnimationContext.elementId,
      )
    : undefined;

  /**
   * Only text-capable elements participate in font batch editing.
   *
   * Images, videos, and audio elements keep their media-specific visual content.
   */
  const fontTargetElements = targetElements.filter(
    (element) =>
      element.type === "text" ||
      element.type === "shape" ||
      element.type === "svg",
  );

  const sharedFontSize = getSharedValue(
    fontTargetElements.map((element) => element.style.fontSize ?? 16),
  );

  const sharedFontWeight = getSharedValue(
    fontTargetElements.map((element) => element.style.fontWeight ?? 400),
  );

  const sharedFontColor = getSharedValue(
    fontTargetElements.map((element) => element.style.color ?? "#0f172a"),
  );

  const sharedBackgroundColor = getSharedValue(
    fontTargetElements.map(
      (element) => element.style.backgroundColor ?? "#ffffff",
    ),
  );

  // The first checked element is used by single-target controls.
  const activeElement =
    targetElements.length === 1 ? targetElements[0] : undefined;

  const multiSelectionActive = selectedElements.length > 1;

  function toggleTargetElement(elementId: string) {
    const isChecked = targetElementIds.includes(elementId);

    // Keep at least one property target while canvas elements are selected.
    if (isChecked && targetElementIds.length === 1) {
      return;
    }

    const nextTargetIds = isChecked
      ? targetElementIds.filter((id) => id !== elementId)
      : selectedElements
          .filter(
            (element) =>
              targetElementIds.includes(element.id) || element.id === elementId,
          )
          .map((element) => element.id);

    onTargetElementIdsChange?.(nextTargetIds);
  }

  function selectAllTargets() {
    onTargetElementIdsChange?.(selectedElements.map((element) => element.id));
  }

  function selectOnlyTarget(elementId: string) {
    onTargetElementIdsChange?.([elementId]);
  }

  function updateContent(content: string, options?: PropertyUpdateOptions) {
    if (!activeElement) {
      return;
    }

    onUpdateElements?.(
      [
        {
          elementId: activeElement.id,
          updates: {
            content,
          },
        },
      ],
      options,
    );
  }

  /**
   * Update one exact element style from the basic-property tab.
   */
  function updateStyle(
    key: keyof SlideElement["style"],
    value: string | number,
    options?: PropertyUpdateOptions,
  ) {
    if (!activeElement) {
      return;
    }

    onUpdateElements?.(
      [
        {
          elementId: activeElement.id,
          updates: {
            style: {
              [key]: value,
            },
          },
        },
      ],
      options,
    );
  }

  /**
   * Update persistent playback preferences for one selected video or audio
   * element.
   *
   * Always submit the complete media object because the shared element-update
   * command performs a top-level replacement for non-style fields.
   */
  function updateMediaSettings(
    updates: Partial<NonNullable<SlideElement["media"]>>,
    options?: PropertyUpdateOptions,
  ) {
    if (
      !activeElement ||
      (activeElement.type !== "video" && activeElement.type !== "audio")
    ) {
      return;
    }

    const currentMedia = activeElement.media ?? {
      startBehavior: "manual" as const,
      loop: false,
      muted: false,
      volume: 1,
    };

    onUpdateElements?.(
      [
        {
          elementId: activeElement.id,

          updates: {
            media: {
              ...currentMedia,
              ...updates,
            },
          },
        },
      ],
      options,
    );
  }

  /**
   * Apply one font-style value to every checked compatible element.
   */
  function updateFontStyle(
    key: keyof SlideElement["style"],
    value: string | number,
    options?: PropertyUpdateOptions,
  ) {
    if (fontTargetElements.length === 0) {
      return;
    }

    onUpdateElements?.(
      fontTargetElements.map((element) => ({
        elementId: element.id,
        updates: {
          style: {
            [key]: value,
          },
        },
      })),
      options,
    );
  }

  /**
   * Apply layer changes only to the currently checked property targets.
   *
   * The canvas selection remains unchanged, so unchecked elements stay inside
   * the outer multi-selection frame but do not participate in the layer action.
   */
  function updateLayer(action: LayerAction) {
    const layerAnchorElement = targetElements[0];

    if (!layerAnchorElement || targetElementIds.length === 0) {
      return;
    }

    onLayerElement?.(layerAnchorElement.id, action, targetElementIds);
  }

  function deleteActiveElement() {
    if (!activeElement) {
      return;
    }

    onDeleteElement?.(activeElement.id);
  }

  if (selectedElements.length === 0) {
    return (
      <aside className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-sm font-semibold text-slate-400">属性面板</p>
        <h2 className="mt-1 text-xl font-bold text-slate-950">未选择元素</h2>

        <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-500">
          请在画布中选择一个或多个元素。
        </div>
      </aside>
    );
  }

  return (
    <aside className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
      <div>
        <p className="text-sm font-semibold text-slate-400">属性面板</p>
        <div className="mt-1 flex items-center justify-between gap-3">
          <h2 className="min-w-0 truncate text-xl font-bold text-slate-950">
            {multiSelectionActive
              ? `已选择 ${selectedElements.length} 个元素`
              : selectedElements[0]?.name}
          </h2>

          <span className="shrink-0 rounded-full bg-violet-100 px-3 py-1 text-xs font-black text-violet-600">
            {targetElements.length}/{selectedElements.length}
          </span>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-4 gap-1 rounded-2xl bg-slate-100 p-1">
        {propertyTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`rounded-xl px-2 py-2 text-xs font-bold transition ${
              activeTab === tab.id
                ? "bg-white text-violet-600 shadow-sm"
                : "text-slate-500 hover:text-slate-800"
            }`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {multiSelectionActive ? (
        <section className="mt-4 rounded-2xl border border-violet-100 bg-violet-50/60 p-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-black text-slate-800">
                属性操作对象
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                取消勾选不会取消幕布框选
              </p>
            </div>

            <button
              type="button"
              className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-violet-600 shadow-sm transition hover:bg-violet-100"
              onClick={selectAllTargets}
            >
              全选
            </button>
          </div>

          <div className="mt-3 max-h-48 space-y-2 overflow-y-auto pr-1">
            {selectedElements.map((element, index) => {
              const checked = targetElementIdSet.has(element.id);

              return (
                <div
                  key={element.id}
                  className={`flex items-center gap-2 rounded-xl border p-2 transition ${
                    checked
                      ? "border-violet-200 bg-white"
                      : "border-transparent bg-slate-100/80"
                  }`}
                >
                  <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-violet-600"
                      checked={checked}
                      onChange={() => toggleTargetElement(element.id)}
                    />

                    <span
                      className={`flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-xs font-black text-white ${
                        checked ? "bg-violet-600" : "bg-slate-400"
                      }`}
                    >
                      {index + 1}
                    </span>

                    <span className="min-w-0">
                      <span className="block truncate text-xs font-bold text-slate-700">
                        {element.name}
                      </span>
                      <span className="block text-[11px] text-slate-400">
                        {elementTypeLabels[element.type]}
                      </span>
                    </span>
                  </label>

                  <button
                    type="button"
                    className="shrink-0 rounded-lg px-2 py-1 text-[11px] font-bold text-slate-400 transition hover:bg-violet-100 hover:text-violet-600"
                    onClick={() => selectOnlyTarget(element.id)}
                  >
                    仅此项
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      <div className="mt-4">
        {activeTab === "basic" ? (
          <BasicTab
            selectedElements={selectedElements}
            targetElements={targetElements}
            activeElement={activeElement}
            onUpdateContent={updateContent}
            onUpdateStyle={updateStyle}
            onUpdateMediaSettings={updateMediaSettings}
            onBeginChange={onBeginPropertyChange}
            onFinishChange={onFinishPropertyChange}
          />
        ) : null}

        {activeTab === "font" ? (
          fontTargetElements.length > 0 ? (
            <FontTab
              elements={fontTargetElements}
              skippedElementCount={
                targetElements.length - fontTargetElements.length
              }
              sharedFontSize={sharedFontSize}
              sharedFontWeight={sharedFontWeight}
              sharedFontColor={sharedFontColor}
              sharedBackgroundColor={sharedBackgroundColor}
              onUpdateStyle={updateFontStyle}
              onBeginChange={onBeginPropertyChange}
              onFinishChange={onFinishPropertyChange}
            />
          ) : (
            <MultiTargetNotice
              title="没有可修改字体的对象"
              description="当前勾选对象没有可修改字体的内容。请选择文本、形状或 SVG 元素后再修改字体。"
            />
          )
        ) : null}

        {activeTab === "animation" ? (
          <AnimationTab
            animationItems={pageAnimationItems}
            activeAnimationContext={activeAnimationContext}
            activeClip={activeAnimationClip}
            activeElement={activeAnimationElement}
            canAddAnimation={selectedElements.length === 1}
            onSelectClip={onSelectAnimationClip}
            onUpdateClipTiming={onUpdateAnimationClipTiming}
            onOpenAnimationWorkspace={onOpenAnimationWorkspace}
            onBeginChange={onBeginPropertyChange}
            onFinishChange={onFinishPropertyChange}
          />
        ) : null}

        {activeTab === "layer" ? (
          <LayerTab
            singleTarget={activeElement}
            onUpdateLayer={updateLayer}
            onDeleteElement={deleteActiveElement}
          />
        ) : null}
      </div>
    </aside>
  );
}

function BasicTab({
  selectedElements,
  targetElements,
  activeElement,
  onUpdateContent,
  onUpdateStyle,
  onUpdateMediaSettings,
  onBeginChange,
  onFinishChange,
}: {
  selectedElements: SlideElement[];
  targetElements: SlideElement[];
  activeElement?: SlideElement;
  onUpdateContent: (content: string) => void;
  onUpdateStyle: (
    key: keyof SlideElement["style"],
    value: string | number,
  ) => void;
  onUpdateMediaSettings: (
    updates: Partial<NonNullable<SlideElement["media"]>>,
    options?: PropertyUpdateOptions,
  ) => void;

  onBeginChange?: () => void;

  onFinishChange?: () => void;
}) {
  
    const rawMediaVolume = activeElement?.media?.volume;

    const normalizedMediaVolume =
      typeof rawMediaVolume === "number" && Number.isFinite(rawMediaVolume)
        ? Math.min(1, Math.max(0, rawMediaVolume))
        : 1;

    const mediaSettings: NonNullable<SlideElement["media"]> | null =
      activeElement &&
      (activeElement.type === "video" || activeElement.type === "audio")
        ? {
            startBehavior: activeElement.media?.startBehavior ?? "manual",

            loop: activeElement.media?.loop ?? false,

            muted: activeElement.media?.muted ?? false,

            volume: normalizedMediaVolume,
          }
        : null;
  
  return (
    <div className="space-y-4">
      <section className="rounded-2xl bg-slate-50 p-4">
        <h3 className="mb-3 text-sm font-black text-slate-800">基础信息</h3>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <ReadOnlyField
            label="幕布框选"
            value={`${selectedElements.length} 个`}
          />
          <ReadOnlyField
            label="属性目标"
            value={`${targetElements.length} 个`}
          />
        </div>
      </section>

      {mediaSettings ? (
        <section className="rounded-2xl bg-slate-50 p-4">
          <h3 className="text-sm font-black text-slate-800">媒体播放</h3>

          <p className="mt-1 text-xs leading-5 text-slate-400">
            这些设置会同时用于放映模式和导出的 HTML。
          </p>

          <label className="mt-4 block text-sm">
            <span className="mb-1 block text-slate-400">开始播放方式</span>

            <select
              className="w-full rounded-xl bg-white px-3 py-2 text-slate-700 outline-none ring-1 ring-transparent transition focus:ring-violet-300"
              value={mediaSettings.startBehavior}
              onChange={(event) =>
                onUpdateMediaSettings({
                  startBehavior:
                    event.target.value === "slide-enter"
                      ? "slide-enter"
                      : "manual",
                })
              }
            >
              <option value="manual">手动播放</option>

              <option value="slide-enter">进入页面时播放</option>
            </select>
          </label>

          <div className="mt-3 space-y-2">
            <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl bg-white px-3 py-3">
              <span>
                <span className="block text-sm font-bold text-slate-700">
                  循环播放
                </span>

                <span className="mt-0.5 block text-[10px] leading-4 text-slate-400">
                  播放结束后自动从头开始
                </span>
              </span>

              <input
                type="checkbox"
                className="h-4 w-4 shrink-0 accent-violet-600"
                checked={mediaSettings.loop}
                onChange={(event) =>
                  onUpdateMediaSettings({
                    loop: event.target.checked,
                  })
                }
              />
            </label>

            <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl bg-white px-3 py-3">
              <span>
                <span className="block text-sm font-bold text-slate-700">
                  静音
                </span>

                <span className="mt-0.5 block text-[10px] leading-4 text-slate-400">
                  自动播放视频时建议开启
                </span>
              </span>

              <input
                type="checkbox"
                className="h-4 w-4 shrink-0 accent-violet-600"
                checked={mediaSettings.muted}
                onChange={(event) =>
                  onUpdateMediaSettings({
                    muted: event.target.checked,
                  })
                }
              />
            </label>
          </div>

          <div className="mt-3">
            <NumberField
              label="音量（0–100）"
              value={Math.round(mediaSettings.volume * 100)}
              min={0}
              max={100}
              step={1}
              onBeginChange={onBeginChange}
              onFinishChange={onFinishChange}
              onChange={(value) =>
                onUpdateMediaSettings(
                  {
                    volume: Math.min(1, Math.max(0, value / 100)),
                  },
                  {
                    recordHistory: false,
                  },
                )
              }
            />
          </div>

          {mediaSettings.startBehavior === "slide-enter" &&
          !mediaSettings.muted ? (
            <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-700">
              浏览器可能阻止有声音的自动播放。需要稳定自动播放时，请同时开启静音。
            </p>
          ) : null}

          <p className="mt-3 rounded-xl bg-violet-50 px-3 py-2 text-xs leading-5 text-violet-600">
            编辑画布不会因为“进入页面时播放”而自动播放；该行为只在正式放映和导出播放器中执行。
          </p>
        </section>
      ) : null}

      {activeElement ? (
        <>
          <section className="rounded-2xl bg-slate-50 p-4">
            <div className="space-y-3 text-sm">
              <ReadOnlyField label="元素 ID" value={activeElement.id} />
              <ReadOnlyField
                label="元素类型"
                value={elementTypeLabels[activeElement.type]}
              />

              {activeElement.assetId ? (
                <ReadOnlyField label="资源名称" value={activeElement.content} />
              ) : (
                <label className="block">
                  <span className="mb-1 block text-slate-400">内容</span>

                  <input
                    className="w-full rounded-xl bg-white px-3 py-2 text-slate-700 outline-none ring-1 ring-transparent transition focus:ring-violet-300"
                    value={activeElement.content}
                    onChange={(event) => onUpdateContent(event.target.value)}
                  />
                </label>
              )}
            </div>
          </section>

          <section className="rounded-2xl bg-slate-50 p-4">
            <h3 className="mb-3 text-sm font-black text-slate-800">位置尺寸</h3>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <NumberField
                label="X"
                value={activeElement.style.x}
                onChange={(value) => onUpdateStyle("x", value)}
              />
              <NumberField
                label="Y"
                value={activeElement.style.y}
                onChange={(value) => onUpdateStyle("y", value)}
              />
              <NumberField
                label="宽度"
                value={activeElement.style.width}
                onChange={(value) => onUpdateStyle("width", value)}
              />
              <NumberField
                label="高度"
                value={activeElement.style.height}
                onChange={(value) => onUpdateStyle("height", value)}
              />
              <NumberField
                label="旋转"
                value={activeElement.style.rotate}
                onChange={(value) => onUpdateStyle("rotate", value)}
              />
              <NumberField
                label="透明度"
                value={activeElement.style.opacity}
                min={0}
                max={1}
                step={0.1}
                onChange={(value) => onUpdateStyle("opacity", value)}
              />
            </div>
          </section>
        </>
      ) : (
        <MultiTargetNotice
          title="多对象基础信息"
          description="幕布框选和属性操作对象已经分离。勾选“仅此项”后，可以查看并修改该元素的精确位置和尺寸。"
        />
      )}
    </div>
  );
}

function FontTab({
  elements,
  skippedElementCount,
  sharedFontSize,
  sharedFontWeight,
  sharedFontColor,
  sharedBackgroundColor,
  onUpdateStyle,
  onBeginChange,
  onFinishChange,
}: {
  elements: SlideElement[];
  skippedElementCount: number;
  sharedFontSize?: number;
  sharedFontWeight?: number;
  sharedFontColor?: string;
  sharedBackgroundColor?: string;
  onUpdateStyle: (
    key: keyof SlideElement["style"],
    value: string | number,
    options?: PropertyUpdateOptions,
  ) => void;
  onBeginChange?: () => void;
  onFinishChange?: () => void;
}) {
  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-violet-100 bg-violet-50/60 p-4">
        <h3 className="text-sm font-black text-violet-700">批量字体</h3>
        <p className="mt-2 text-xs leading-5 text-violet-500">
          当前会修改 {elements.length} 个勾选对象
          {skippedElementCount > 0
            ? `，并跳过 ${skippedElementCount} 个非文字样式元素`
            : ""}
          。
        </p>
      </section>

      <section className="rounded-2xl bg-slate-50 p-4">
        <h3 className="mb-3 text-sm font-black text-slate-800">字体与外观</h3>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <NumberField
            label="字号"
            value={sharedFontSize ?? ""}
            placeholder="混合"
            min={8}
            onBeginChange={onBeginChange}
            onFinishChange={onFinishChange}
            onChange={(value) =>
              onUpdateStyle("fontSize", value, { recordHistory: false })
            }
          />

          <NumberField
            label="字重"
            value={sharedFontWeight ?? ""}
            placeholder="混合"
            min={100}
            max={900}
            step={100}
            onBeginChange={onBeginChange}
            onFinishChange={onFinishChange}
            onChange={(value) =>
              onUpdateStyle("fontWeight", value, { recordHistory: false })
            }
          />
        </div>
      </section>

      <section className="rounded-2xl bg-slate-50 p-4">
        <h3 className="mb-3 text-sm font-black text-slate-800">颜色</h3>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <ColorField
            label="文字颜色"
            value={sharedFontColor}
            mixed={sharedFontColor === undefined}
            onBeginChange={onBeginChange}
            onFinishChange={onFinishChange}
            onChange={(value) =>
              onUpdateStyle("color", value, { recordHistory: false })
            }
          />

          <ColorField
            label="背景颜色"
            value={sharedBackgroundColor}
            mixed={sharedBackgroundColor === undefined}
            onBeginChange={onBeginChange}
            onFinishChange={onFinishChange}
            onChange={(value) =>
              onUpdateStyle("backgroundColor", value, { recordHistory: false })
            }
          />
        </div>
      </section>
    </div>
  );
}

function AnimationTab({
  animationItems,
  activeAnimationContext,
  activeClip,
  activeElement,
  canAddAnimation,
  onSelectClip,
  onUpdateClipTiming,
  onOpenAnimationWorkspace,
  onBeginChange,
  onFinishChange,
}: {
  animationItems: PageAnimationItem[];
  activeAnimationContext?: ActiveAnimationContext;
  activeClip?: AnimationClip;
  activeElement?: SlideElement;
  canAddAnimation: boolean;
  onSelectClip?: (elementId: string, clipId: string) => void;
  onUpdateClipTiming?: (
    command: UpdateAnimationClipTimingCommand,
    options?: PropertyUpdateOptions,
  ) => void;
  onOpenAnimationWorkspace?: () => void;
  onBeginChange?: () => void;
  onFinishChange?: () => void;
}) {
  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-violet-100 bg-violet-50/60 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-black text-violet-700">动画与交互</h3>

            <p className="mt-1 text-xs leading-5 text-violet-500">
              当前版本先统一页面动画
              Clip。点击、悬停和组件状态将在后续阶段接入。
            </p>
          </div>

          <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-[10px] font-black text-violet-500 shadow-sm">
            {animationItems.length} 个
          </span>
        </div>

        <button
          type="button"
          className="mt-3 w-full rounded-xl bg-violet-500 px-4 py-2.5 text-sm font-black text-white shadow-sm transition hover:bg-violet-600 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
          disabled={!canAddAnimation || !onOpenAnimationWorkspace}
          title={
            canAddAnimation ? "打开动画工作区并添加动画" : "请先只选择一个元素"
          }
          onClick={onOpenAnimationWorkspace}
        >
          ＋ 添加动画
        </button>
      </section>

      {activeClip && activeAnimationContext ? (
        <section className="rounded-2xl border border-violet-200 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-violet-500">
                当前动画
              </p>

              <h3 className="mt-1 truncate text-sm font-black text-slate-800">
                {activeClip.name}
              </h3>

              <p className="mt-1 truncate text-xs text-slate-400">
                {activeElement?.name ?? activeAnimationContext.elementId}
                {" · "}
                {getAnimationCategoryLabel(activeClip.category)}
              </p>
            </div>

            <span className="shrink-0 rounded-full bg-violet-100 px-2.5 py-1 text-[10px] font-black text-violet-600">
              已选中
            </span>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <NumberField
              label="开始时间(ms)"
              value={activeClip.startMs}
              min={0}
              step={10}
              disabled={!onUpdateClipTiming}
              onBeginChange={onBeginChange}
              onFinishChange={onFinishChange}
              onChange={(startMs) =>
                onUpdateClipTiming?.(
                  {
                    clipId: activeClip.id,
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

            <NumberField
              label="持续时间(ms)"
              value={activeClip.durationMs}
              min={1}
              step={10}
              disabled={!onUpdateClipTiming}
              onBeginChange={onBeginChange}
              onFinishChange={onFinishChange}
              onChange={(durationMs) =>
                onUpdateClipTiming?.(
                  {
                    clipId: activeClip.id,
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
          </div>

          <button
            type="button"
            className="mt-3 w-full rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
            disabled={!onOpenAnimationWorkspace}
            onClick={onOpenAnimationWorkspace}
          >
            详细编辑轨道与关键帧
          </button>

          <p className="mt-3 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-500">
            此处只修改当前 Clip 的时间参数，不会重置同一元素的其他动画。
          </p>
        </section>
      ) : (
        <section className="rounded-2xl border border-dashed border-violet-200 bg-white p-4">
          <h3 className="text-sm font-black text-slate-700">尚未选择动画</h3>

          <p className="mt-2 text-xs leading-5 text-slate-400">
            从下方页面动画列表、底部时间轴或高级轨道编辑器中选择一个 Clip。
          </p>
        </section>
      )}

      <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-black text-slate-800">当前页面动画</h3>

            <p className="mt-1 text-xs text-slate-400">
              按实际开始时间排列，与底部时间轴保持一致
            </p>
          </div>

          <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-black text-slate-500 shadow-sm">
            V2
          </span>
        </div>

        {animationItems.length > 0 ? (
          <div className="mt-3 space-y-2">
            {animationItems.map((item, index) => {
              const active = item.clip.id === activeAnimationContext?.clipId;

              return (
                <button
                  key={item.clip.id}
                  type="button"
                  className={`w-full rounded-xl border p-3 text-left transition ${
                    active
                      ? "border-violet-300 bg-white ring-2 ring-violet-200"
                      : "border-transparent bg-white hover:border-violet-200 hover:bg-violet-50/60"
                  }`}
                  disabled={!onSelectClip}
                  onClick={() => onSelectClip?.(item.elementId, item.clip.id)}
                >
                  <span className="flex items-start gap-3">
                    <span
                      className={`flex h-7 min-w-7 items-center justify-center rounded-full px-1 text-xs font-black text-white ${
                        active ? "bg-violet-600" : "bg-slate-400"
                      }`}
                    >
                      {index + 1}
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="min-w-0 truncate text-xs font-black text-slate-800">
                          {item.elementName}
                          {" · "}
                          {item.clip.name}
                        </span>

                        <span className="shrink-0 rounded-full bg-violet-50 px-2 py-0.5 text-[9px] font-black text-violet-500">
                          {getAnimationCategoryLabel(item.clip.category)}
                        </span>
                      </span>

                      <span className="mt-1 block truncate text-[10px] text-slate-400">
                        {item.sequenceName}
                        {" · "}
                        {item.clip.startMs}ms
                        {" → "}
                        {item.clip.startMs + item.clip.durationMs}
                        ms
                        {!item.clip.enabled ? " · 已停用" : ""}
                      </span>
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="mt-3 rounded-xl border border-dashed border-slate-200 bg-white p-5 text-center">
            <p className="text-sm font-bold text-slate-500">当前页面暂无动画</p>

            <p className="mt-1 text-xs leading-5 text-slate-400">
              选择一个元素，然后点击上方“添加动画”。
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

function LayerTab({
  singleTarget,
  onUpdateLayer,
  onDeleteElement,
}: {
  singleTarget?: SlideElement;
  onUpdateLayer: (action: LayerAction) => void;
  onDeleteElement: () => void;
}) {
  return (
    <div className="space-y-4">
      <section className="rounded-2xl bg-slate-50 p-4">
        <h3 className="text-sm font-black text-slate-800">图层管理</h3>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <LayerButton
            label="上移一层"
            onClick={() => onUpdateLayer("bring-forward")}
          />
          <LayerButton
            label="下移一层"
            onClick={() => onUpdateLayer("send-backward")}
          />
          <LayerButton
            label="置于顶层"
            onClick={() => onUpdateLayer("bring-to-front")}
          />
          <LayerButton
            label="置于底层"
            onClick={() => onUpdateLayer("send-to-back")}
          />
        </div>

        <p className="mt-3 text-xs leading-5 text-slate-400">
          图层按钮只作用于当前勾选的属性操作对象。
          未勾选元素会继续保留在幕布框选组中。
        </p>
      </section>

      <section className="rounded-2xl bg-red-50 p-4">
        <h3 className="mb-3 text-sm font-black text-red-700">危险操作</h3>

        <button
          type="button"
          className="w-full rounded-xl bg-red-500 px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-red-600 disabled:cursor-not-allowed disabled:bg-red-200"
          disabled={!singleTarget}
          onClick={onDeleteElement}
        >
          {singleTarget ? "删除当前属性对象" : "请先选择仅此项"}
        </button>
      </section>
    </div>
  );
}

function MultiTargetNotice({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <section className="rounded-2xl border border-dashed border-violet-200 bg-violet-50/60 p-4">
      <h3 className="text-sm font-black text-violet-700">{title}</h3>
      <p className="mt-2 text-xs leading-5 text-violet-500">{description}</p>
    </section>
  );
}

function LayerButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="rounded-2xl bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-violet-50 hover:text-violet-600"
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function ReadOnlyField({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div>
      <p className="mb-1 text-slate-400">{label}</p>
      <p className="rounded-xl bg-white px-3 py-2 text-slate-700">{value}</p>
    </div>
  );
}

function NumberField({
  label,
  value,
  min,
  max,
  step = 1,
  placeholder,
  disabled = false,
  onBeginChange,
  onFinishChange,
  onChange,
}: {
  label: string;
  value: number | "";
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
  disabled?: boolean;
  onBeginChange?: () => void;
  onFinishChange?: () => void;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-slate-400">{label}</span>

      <input
        type="number"
        className="w-full rounded-xl bg-white px-3 py-2 text-slate-700 outline-none ring-1 ring-transparent transition focus:ring-violet-300 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-300"
        value={value}
        min={min}
        max={max}
        step={step}
        placeholder={placeholder}
        disabled={disabled}
        onFocus={onBeginChange}
        onBlur={onFinishChange}
        onChange={(event) => {
          if (event.target.value === "") {
            return;
          }

          onChange(Number(event.target.value));
        }}
      />
    </label>
  );
}

function ColorField({
  label,
  value,
  mixed = false,
  onBeginChange,
  onFinishChange,
  onChange,
}: {
  label: string;
  value?: string;
  mixed?: boolean;
  onBeginChange?: () => void;
  onFinishChange?: () => void;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 flex items-center justify-between gap-2 text-slate-400">
        <span>{label}</span>

        {mixed ? (
          <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold text-violet-500">
            混合
          </span>
        ) : null}
      </span>

      <input
        type="color"
        className="h-10 w-full cursor-pointer rounded-xl bg-white px-2 py-1 outline-none ring-1 ring-transparent transition focus:ring-violet-300"
        value={value ?? "#0f172a"}
        onFocus={onBeginChange}
        onBlur={onFinishChange}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}
