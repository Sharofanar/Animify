import type {
  SlideElement,
  SlideElementAnimation,
} from "../../types/presentation";

type LayerAction =
  | "bring-forward"
  | "send-backward"
  | "bring-to-front"
  | "send-to-back";

type PropertyPanelProps = {
  selectedElement?: SlideElement;
  onUpdateElement?: (
    elementId: string,
    updates: Partial<Omit<SlideElement, "style">> & {
      style?: Partial<SlideElement["style"]>;
    },
  ) => void;
  onDeleteElement?: (elementId: string) => void;
  onLayerElement?: (elementId: string, action: LayerAction) => void;
};

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

export function PropertyPanel({
  selectedElement,
  onUpdateElement,
  onDeleteElement,
  onLayerElement,
}: PropertyPanelProps) {
  function updateContent(content: string) {
    if (!selectedElement) {
      return;
    }

    onUpdateElement?.(selectedElement.id, {
      content,
    });
  }

  function updateStyle(
    key: keyof SlideElement["style"],
    value: string | number,
  ) {
    if (!selectedElement) {
      return;
    }

    onUpdateElement?.(selectedElement.id, {
      style: {
        ...selectedElement.style,
        [key]: value,
      },
    });
  }

  function updateAnimationPreset(value: string) {
    if (!selectedElement) {
      return;
    }

    if (value === "none") {
      onUpdateElement?.(selectedElement.id, {
        animations: [],
      });
      return;
    }

    const preset = animationPresets.find((item) => item.value === value);

    if (!preset) {
      return;
    }

    const oldAnimation = selectedElement.animations[0];

    const animation: SlideElementAnimation = {
      id: oldAnimation?.id ?? `animation-${Date.now()}`,
      name: preset.name,
      type: "enter",
      duration: oldAnimation?.duration ?? 600,
      delay: oldAnimation?.delay ?? 0,
      easing: oldAnimation?.easing ?? "ease-out",
      keyframes: preset.keyframes,
    };

    onUpdateElement?.(selectedElement.id, {
      animations: [animation],
    });
  }

  function updateAnimationNumber(key: "duration" | "delay", value: number) {
    if (!selectedElement || selectedElement.animations.length === 0) {
      return;
    }

    const [firstAnimation, ...otherAnimations] = selectedElement.animations;

    onUpdateElement?.(selectedElement.id, {
      animations: [
        {
          ...firstAnimation,
          [key]: value,
        },
        ...otherAnimations,
      ],
    });
  }

  function deleteSelectedElement() {
    if (!selectedElement) {
      return;
    }

    onDeleteElement?.(selectedElement.id);
  }

  function updateLayer(action: LayerAction) {
    if (!selectedElement) {
      return;
    }

    onLayerElement?.(selectedElement.id, action);
  }

  const currentAnimation = selectedElement?.animations[0];

  return (
    <aside className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-4">
        <p className="text-sm font-semibold text-slate-400">属性面板</p>
        <h2 className="text-xl font-bold text-slate-950">
          {selectedElement ? selectedElement.name : "未选择元素"}
        </h2>
      </div>

      {selectedElement ? (
        <div className="space-y-4">
          <section className="rounded-2xl bg-slate-50 p-4">
            <h3 className="mb-3 text-sm font-bold text-slate-700">基础信息</h3>

            <div className="space-y-3 text-sm">
              <ReadOnlyField label="元素 ID" value={selectedElement.id} />
              <ReadOnlyField label="元素类型" value={selectedElement.type} />

              <label className="block">
                <span className="mb-1 block text-slate-400">内容</span>
                <input
                  className="w-full rounded-xl bg-white px-3 py-2 text-slate-700 outline-none ring-1 ring-transparent transition focus:ring-violet-300"
                  value={selectedElement.content}
                  onChange={(event) => updateContent(event.target.value)}
                />
              </label>
            </div>
          </section>

          <section className="rounded-3xl bg-slate-50 p-4">
            <h3 className="text-sm font-black text-slate-800">图层管理</h3>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                className="rounded-2xl bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-violet-50 hover:text-violet-600"
                onClick={() => updateLayer("bring-forward")}
              >
                上移一层
              </button>

              <button
                type="button"
                className="rounded-2xl bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-violet-50 hover:text-violet-600"
                onClick={() => updateLayer("send-backward")}
              >
                下移一层
              </button>

              <button
                type="button"
                className="rounded-2xl bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-violet-50 hover:text-violet-600"
                onClick={() => updateLayer("bring-to-front")}
              >
                置于顶层
              </button>

              <button
                type="button"
                className="rounded-2xl bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-violet-50 hover:text-violet-600"
                onClick={() => updateLayer("send-to-back")}
              >
                置于底层
              </button>
            </div>

            <p className="mt-3 text-xs leading-5 text-slate-400">
              上移/下移会优先按重叠元素调整，置顶/置底会按全部元素调整。
            </p>
          </section>

          <section className="rounded-2xl bg-red-50 p-4">
            <h3 className="mb-3 text-sm font-bold text-red-700">危险操作</h3>

            <button
              type="button"
              className="w-full rounded-xl bg-red-500 px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-red-600"
              onClick={deleteSelectedElement}
            >
              删除当前元素
            </button>

            <p className="mt-3 text-xs leading-5 text-red-500">
              删除后会从当前画布中移除该元素。
            </p>
          </section>

          <section className="rounded-2xl bg-slate-50 p-4">
            <h3 className="mb-3 text-sm font-bold text-slate-700">位置尺寸</h3>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <NumberField
                label="X"
                value={selectedElement.style.x}
                onChange={(value) => updateStyle("x", value)}
              />
              <NumberField
                label="Y"
                value={selectedElement.style.y}
                onChange={(value) => updateStyle("y", value)}
              />
              <NumberField
                label="宽度"
                value={selectedElement.style.width}
                onChange={(value) => updateStyle("width", value)}
              />
              <NumberField
                label="高度"
                value={selectedElement.style.height}
                onChange={(value) => updateStyle("height", value)}
              />
              <NumberField
                label="旋转"
                value={selectedElement.style.rotate}
                onChange={(value) => updateStyle("rotate", value)}
              />
              <NumberField
                label="透明度"
                value={selectedElement.style.opacity}
                step={0.1}
                min={0}
                max={1}
                onChange={(value) => updateStyle("opacity", value)}
              />
            </div>
          </section>

          <section className="rounded-2xl bg-slate-50 p-4">
            <h3 className="mb-3 text-sm font-bold text-slate-700">样式</h3>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <NumberField
                label="字号"
                value={selectedElement.style.fontSize ?? 16}
                onChange={(value) => updateStyle("fontSize", value)}
              />
              <NumberField
                label="字重"
                value={selectedElement.style.fontWeight ?? 400}
                step={100}
                min={100}
                max={900}
                onChange={(value) => updateStyle("fontWeight", value)}
              />
              <NumberField
                label="圆角"
                value={selectedElement.style.borderRadius ?? 0}
                onChange={(value) => updateStyle("borderRadius", value)}
              />
              <ReadOnlyField
                label="动画"
                value={`${selectedElement.animations.length} 个`}
              />
            </div>
          </section>

          <section className="rounded-2xl bg-slate-50 p-4">
            <h3 className="mb-3 text-sm font-bold text-slate-700">颜色</h3>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <ColorField
                label="文字颜色"
                value={selectedElement.style.color ?? "#0f172a"}
                onChange={(value) => updateStyle("color", value)}
              />
              <ColorField
                label="背景颜色"
                value={selectedElement.style.backgroundColor ?? "#ffffff"}
                onChange={(value) => updateStyle("backgroundColor", value)}
              />
            </div>
          </section>

          <section className="rounded-2xl bg-violet-50 p-4">
            <h3 className="mb-3 text-sm font-bold text-violet-700">动画配置</h3>

            <label className="block text-sm">
              <span className="mb-1 block text-slate-500">进入动画</span>
              <select
                className="w-full rounded-xl bg-white px-3 py-2 text-slate-700 outline-none ring-1 ring-transparent transition focus:ring-violet-300"
                value={currentAnimation?.keyframes ?? "none"}
                onChange={(event) => updateAnimationPreset(event.target.value)}
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
                onChange={(value) => updateAnimationNumber("duration", value)}
              />
              <NumberField
                label="延迟(ms)"
                value={currentAnimation?.delay ?? 0}
                min={0}
                step={100}
                onChange={(value) => updateAnimationNumber("delay", value)}
              />
            </div>

            <p className="mt-3 text-xs leading-5 text-violet-500">
              当前阶段先保存动画参数，下一步接入画布预览和 HTML 导出播放。
            </p>
          </section>
        </div>
      ) : (
        <div className="rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-500">
          请在画布中选择一个元素。后续版本会支持修改位置、尺寸、颜色、字体和动画参数。
        </div>
      )}
    </aside>
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
