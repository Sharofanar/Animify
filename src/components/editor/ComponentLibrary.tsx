import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import type { SlideElementType } from "../../types/presentation";

type ComponentItem = {
  id: SlideElementType;
  title: string;
  description: string;
  icon: string;
};

type ComponentLibraryProps = {
  onAddElement: (type: SlideElementType) => void;

  /**
   * Open the image picker and insert the selected file through the asset store.
   * Image elements should not be created as empty placeholders.
   */
  onAddImage?: () => void;
};

const componentItems: ComponentItem[] = [
  {
    id: "text",
    title: "文本",
    description: "添加标题、段落或说明文字",
    icon: "T",
  },
  {
    id: "shape",
    title: "形状",
    description: "添加矩形、卡片或装饰图形",
    icon: "□",
  },
  {
    id: "image",
    title: "图像",
    description: "选择本地图片并插入画布",
    icon: "◎",
  },
  {
    id: "svg",
    title: "SVG",
    description: "添加矢量图标或装饰元素",
    icon: "◇",
  },
];

export function ComponentLibrary({
  onAddElement,
  onAddImage,
}: ComponentLibraryProps) {
  return (
    <aside className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-4">
        <p className="text-sm font-semibold text-slate-400">组件库</p>
        <h2 className="text-xl font-bold text-slate-950">添加元素</h2>
      </div>

      <div className="space-y-3">
        {componentItems.map((item) => (
          <DraggableComponentItem
            key={item.id}
            item={item}
            onAddElement={onAddElement}
            onAddImage={onAddImage}
          />
        ))}
      </div>

      <p className="mt-4 rounded-2xl bg-slate-100 p-3 text-xs leading-5 text-slate-500">
        文本、形状和 SVG
        可以点击添加，也可以拖拽到画布。图像需要点击后选择本地文件。
      </p>
    </aside>
  );
}

function DraggableComponentItem({
  item,
  onAddElement,
  onAddImage,
}: {
  item: ComponentItem;
  onAddElement: (type: SlideElementType) => void;

  /**
   * Used only by the image card. Images must be selected from local files
   * and stored in the project asset store before an image element is created.
   */
  onAddImage?: () => void;
}) {
  const isImageItem = item.id === "image";

  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: `component-${item.id}`,
      data: {
        type: item.id,
      },

      // Image insertion needs a real file. Disable dragging to avoid creating
      // an empty image placeholder on the canvas.
      disabled: isImageItem,
    });

  const style = {
    transform: CSS.Translate.toString(transform),
  };

  return (
    <button
      ref={setNodeRef}
      type="button"
      className={`flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-left transition hover:border-violet-200 hover:bg-violet-50 ${
        isDragging ? "z-50 opacity-60 shadow-xl" : ""
      }`}
      style={style}
      onClick={() => {
        // Image components are backed by the project asset store.
        // Clicking the image card opens the file picker instead of creating
        // an empty image placeholder.
        if (isImageItem) {
          onAddImage?.();
          return;
        }

        onAddElement(item.id);
      }}
      {...(isImageItem ? {} : listeners)}
      {...(isImageItem ? {} : attributes)}
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-lg font-black text-violet-600 shadow-sm">
        {item.icon}
      </span>
      <span>
        <span className="block font-semibold text-slate-950">{item.title}</span>
        <span className="mt-1 block text-xs leading-5 text-slate-500">
          {item.description}
        </span>
      </span>
    </button>
  );
}
