import { useState } from "react";
import type {
  SlideElement,
  SlideElementAnimation,
} from "../../types/presentation";

type LayerAction =
  | "bring-forward"
  | "send-backward"
  | "bring-to-front"
  | "send-to-back";

type PropertyTab = "basic" | "font" | "animation" | "layer";

type ElementUpdates = Partial<Omit<SlideElement, "style">> & {
  style?: Partial<SlideElement["style"]>;
};

type PropertyPanelProps = {
  selectedElements: SlideElement[];
  targetElementIds: string[];
  onTargetElementIdsChange?: (elementIds: string[]) => void;
  onUpdateElement?: (elementId: string, updates: ElementUpdates) => void;
  onDeleteElement?: (elementId: string) => void;
  onLayerElement?: (elementId: string, action: LayerAction) => void;
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

const animationPresets = [
  {
    value: "fade-in",
    label: "淡入",
    name: "淡入动画",
    keyframes: "fade-in",
  },
  {
    value: "slide-up",
    label: "上滑进入",
    name: "上滑进入动画",
    keyframes: "slide-up",
  },
  {
    value: "zoom-in",
    label: "放大进入",
    name: "放大进入动画",
    keyframes: "zoom-in",
  },
];

const elementTypeLabels: Record<SlideElement["type"], string> = {
  text: "文本",
  shape: "形状",
  image: "图片",
  svg: "SVG",
};

export function PropertyPanel({
  selectedElements,
  targetElementIds,
  onTargetElementIdsChange,
  onUpdateElement,
  onDeleteElement,
  onLayerElement,
}: PropertyPanelProps) {
  const [activeTab, setActiveTab] = useState<PropertyTab>("basic");

  const targetElementIdSet = new Set(targetElementIds);
  const targetElements = selectedElements.filter((element) =>
    targetElementIdSet.has(element.id),
  );

  // The first checked element is used by single-target controls.
  const activeElement =
    targetElements.length === 1 ? targetElements[0] : undefined;

  const layerAnchorElement = selectedElements[0];
  const currentAnimation = activeElement?.animations[0];
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

  function updateContent(content: string) {
    if (!activeElement) {
      return;
    }

    onUpdateElement?.(activeElement.id, {
      content,
    });
  }

  function updateStyle(
    key: keyof SlideElement["style"],
    value: string | number,
  ) {
    if (!activeElement) {
      return;
    }

    onUpdateElement?.(activeElement.id, {
      style: {
        [key]: value,
      },
    });
  }

  function updateAnimationPreset(value: string) {
    if (!activeElement) {
      return;
    }

    if (value === "none") {
      onUpdateElement?.(activeElement.id, {
        animations: [],
      });
      return;
    }

    const preset = animationPresets.find((item) => item.value === value);

    if (!preset) {
      return;
    }

    const oldAnimation = activeElement.animations[0];

    const animation: SlideElementAnimation = {
      id: oldAnimation?.id ?? `animation-${Date.now()}`,
      name: preset.name,
      type: "enter",
      duration: oldAnimation?.duration ?? 600,
      delay: oldAnimation?.delay ?? 0,
      easing: oldAnimation?.easing ?? "ease-out",
      keyframes: preset.keyframes,
    };

    onUpdateElement?.(activeElement.id, {
      animations: [animation],
    });
  }

  function updateAnimationNumber(key: "duration" | "delay", value: number) {
    if (!activeElement || activeElement.animations.length === 0) {
      return;
    }

    const [firstAnimation, ...otherAnimations] = activeElement.animations;

    onUpdateElement?.(activeElement.id, {
      animations: [
        {
          ...firstAnimation,
          [key]: value,
        },
        ...otherAnimations,
      ],
    });
  }

  function updateLayer(action: LayerAction) {
    if (!layerAnchorElement) {
      return;
    }

    onLayerElement?.(layerAnchorElement.id, action);
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
          />
        ) : null}

        {activeTab === "font" ? (
          activeElement ? (
            <FontTab element={activeElement} onUpdateStyle={updateStyle} />
          ) : (
            <MultiTargetNotice
              title="字体批量修改"
              description="当前已勾选多个对象。下一阶段会把字号、字重和颜色同时应用到勾选的文本元素。"
            />
          )
        ) : null}

        {activeTab === "animation" ? (
          activeElement ? (
            <AnimationTab
              element={activeElement}
              currentAnimation={currentAnimation}
              onUpdatePreset={updateAnimationPreset}
              onUpdateNumber={updateAnimationNumber}
            />
          ) : (
            <MultiTargetNotice
              title="动画批量修改"
              description="操作对象已经建立。下一阶段会把动画类型、时长和延迟应用到当前勾选元素。"
            />
          )
        ) : null}

        {activeTab === "layer" ? (
          <LayerTab
            selectedCount={selectedElements.length}
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
}: {
  selectedElements: SlideElement[];
  targetElements: SlideElement[];
  activeElement?: SlideElement;
  onUpdateContent: (content: string) => void;
  onUpdateStyle: (
    key: keyof SlideElement["style"],
    value: string | number,
  ) => void;
}) {
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

      {activeElement ? (
        <>
          <section className="rounded-2xl bg-slate-50 p-4">
            <div className="space-y-3 text-sm">
              <ReadOnlyField label="元素 ID" value={activeElement.id} />
              <ReadOnlyField
                label="元素类型"
                value={elementTypeLabels[activeElement.type]}
              />

              <label className="block">
                <span className="mb-1 block text-slate-400">内容</span>
                <input
                  className="w-full rounded-xl bg-white px-3 py-2 text-slate-700 outline-none ring-1 ring-transparent transition focus:ring-violet-300"
                  value={activeElement.content}
                  onChange={(event) => onUpdateContent(event.target.value)}
                />
              </label>
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
  element,
  onUpdateStyle,
}: {
  element: SlideElement;
  onUpdateStyle: (
    key: keyof SlideElement["style"],
    value: string | number,
  ) => void;
}) {
  return (
    <div className="space-y-4">
      <section className="rounded-2xl bg-slate-50 p-4">
        <h3 className="mb-3 text-sm font-black text-slate-800">字体与外观</h3>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <NumberField
            label="字号"
            value={element.style.fontSize ?? 16}
            min={8}
            onChange={(value) => onUpdateStyle("fontSize", value)}
          />
          <NumberField
            label="字重"
            value={element.style.fontWeight ?? 400}
            min={100}
            max={900}
            step={100}
            onChange={(value) => onUpdateStyle("fontWeight", value)}
          />
          <NumberField
            label="圆角"
            value={element.style.borderRadius ?? 0}
            min={0}
            onChange={(value) => onUpdateStyle("borderRadius", value)}
          />
          <ReadOnlyField
            label="动画"
            value={`${element.animations.length} 个`}
          />
        </div>
      </section>

      <section className="rounded-2xl bg-slate-50 p-4">
        <h3 className="mb-3 text-sm font-black text-slate-800">颜色</h3>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <ColorField
            label="文字颜色"
            value={element.style.color ?? "#0f172a"}
            onChange={(value) => onUpdateStyle("color", value)}
          />
          <ColorField
            label="背景颜色"
            value={element.style.backgroundColor ?? "#ffffff"}
            onChange={(value) => onUpdateStyle("backgroundColor", value)}
          />
        </div>
      </section>
    </div>
  );
}

function AnimationTab({
  element,
  currentAnimation,
  onUpdatePreset,
  onUpdateNumber,
}: {
  element: SlideElement;
  currentAnimation?: SlideElementAnimation;
  onUpdatePreset: (value: string) => void;
  onUpdateNumber: (key: "duration" | "delay", value: number) => void;
}) {
  return (
    <section className="rounded-2xl bg-violet-50 p-4">
      <h3 className="mb-3 text-sm font-black text-violet-700">动画配置</h3>

      <p className="mb-3 text-xs font-bold text-violet-500">
        当前对象：{element.name}
      </p>

      <label className="block text-sm">
        <span className="mb-1 block text-slate-500">进入动画</span>
        <select
          className="w-full rounded-xl bg-white px-3 py-2 text-slate-700 outline-none ring-1 ring-transparent transition focus:ring-violet-300"
          value={currentAnimation?.keyframes ?? "none"}
          onChange={(event) => onUpdatePreset(event.target.value)}
        >
          <option value="none">无动画</option>
          {animationPresets.map((preset) => (
            <option key={preset.value} value={preset.keyframes}>
              {preset.label}
            </option>
          ))}
        </select>
      </label>

      <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
        <NumberField
          label="时长(ms)"
          value={currentAnimation?.duration ?? 600}
          min={100}
          step={100}
          onChange={(value) => onUpdateNumber("duration", value)}
        />
        <NumberField
          label="延迟(ms)"
          value={currentAnimation?.delay ?? 0}
          min={0}
          step={100}
          onChange={(value) => onUpdateNumber("delay", value)}
        />
      </div>
    </section>
  );
}

function LayerTab({
  selectedCount,
  singleTarget,
  onUpdateLayer,
  onDeleteElement,
}: {
  selectedCount: number;
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
          {selectedCount > 1
            ? "当前图层按钮作用于幕布中的完整多选组。按属性勾选对象操作将在下一阶段接入。"
            : "图层按钮作用于当前元素。"}
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
  onChange,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-slate-400">{label}</span>
      <input
        type="number"
        className="w-full rounded-xl bg-white px-3 py-2 text-slate-700 outline-none ring-1 ring-transparent transition focus:ring-violet-300"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-slate-400">{label}</span>
      <input
        type="color"
        className="h-10 w-full cursor-pointer rounded-xl bg-white px-2 py-1 outline-none ring-1 ring-transparent transition focus:ring-violet-300"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}
