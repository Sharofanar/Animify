import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { PresentationProject } from "../../types/presentation";

export function SlideNavigator({
  project,
  assetSources,
  assetStoreReady,
  missingAssetIds,
  activeSlideId,
  readOnly,
  onAddSlide,
  onSelectSlide,
  onDeleteSlide,
  onDuplicateSlide,
}: {
  project: PresentationProject;
  assetSources: Record<string, string>;
  assetStoreReady: boolean;
  missingAssetIds: string[];
  activeSlideId: string;
  readOnly: boolean;
  onAddSlide: () => void;
  onSelectSlide: (slideId: string) => void;
  onDeleteSlide: (slideId: string) => void;
  onDuplicateSlide: (slideId: string) => void;
}) {
  const previewWidth = 112;
  const previewScale = previewWidth / project.width;
  const previewHeight = Math.round(project.height * previewScale);
  const slideIds = project.slides.map((slide) => slide.id);

  return (
    <aside className="flex min-h-0 flex-col rounded-3xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex shrink-0 items-center justify-between">
        <div>
          <p className="text-xs font-bold text-violet-400">页面</p>
          <h2 className="text-base font-black text-slate-950">幻灯片</h2>
        </div>

        <button
          type="button"
          disabled={readOnly}
          className={`flex h-9 w-9 items-center justify-center rounded-2xl text-lg font-black transition ${
            readOnly
              ? "cursor-not-allowed bg-slate-200 text-slate-400"
              : "bg-violet-500 text-white shadow-sm hover:bg-violet-600"
          }`}
          onClick={onAddSlide}
          title={readOnly ? "重复资源确认期间不可新增页面" : "新增页面"}
        >
          +
        </button>
      </div>

      <div className="mt-3 min-h-0 flex-1 space-y-3 overflow-y-auto overflow-x-hidden pr-2">
        <SortableContext
          items={slideIds}
          strategy={verticalListSortingStrategy}
        >
          {project.slides.map((slide, index) => (
            <SortableSlideCard
              key={slide.id}
              readOnly={readOnly}
              slide={slide}
              index={index}
              isActive={slide.id === activeSlideId}
              slideCount={project.slides.length}
              previewWidth={previewWidth}
              previewHeight={previewHeight}
              previewScale={previewScale}
              assets={project.assets}
              assetSources={assetSources}
              assetStoreReady={assetStoreReady}
              missingAssetIds={missingAssetIds}
              onSelectSlide={onSelectSlide}
              onDeleteSlide={onDeleteSlide}
              onDuplicateSlide={onDuplicateSlide}
            />
          ))}
        </SortableContext>
      </div>
    </aside>
  );
}

function SortableSlideCard({
  slide,
  index,
  isActive,
  slideCount,
  previewWidth,
  previewHeight,
  previewScale,
  assets,
  assetSources,
  assetStoreReady,
  missingAssetIds,
  readOnly,
  onSelectSlide,
  onDeleteSlide,
  onDuplicateSlide,
}: {
  slide: PresentationProject["slides"][number];
  index: number;
  isActive: boolean;
  slideCount: number;
  previewWidth: number;
  previewHeight: number;
  previewScale: number;
  assets: PresentationProject["assets"];
  assetSources: Record<string, string>;
  assetStoreReady: boolean;
  missingAssetIds: string[];
  readOnly: boolean;
  onSelectSlide: (slideId: string) => void;
  onDeleteSlide: (slideId: string) => void;
  onDuplicateSlide: (slideId: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: slide.id,

    disabled: readOnly,

    data: {
      kind: "slide",
    },
  });

  return (
    <article
      ref={setNodeRef}
      className={`w-full cursor-pointer overflow-hidden rounded-2xl border p-2 text-left transition ${
        isActive
          ? "border-violet-400 bg-violet-50 shadow-sm"
          : "border-slate-200 bg-white hover:border-violet-200 hover:bg-slate-50"
      } ${isDragging ? "z-20 opacity-60 shadow-lg" : ""}`}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      onClick={() => onSelectSlide(slide.id)}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1">
          <button
            type="button"
            disabled={readOnly}
            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-xs font-black transition ${
              readOnly
                ? "cursor-not-allowed text-slate-300"
                : "cursor-grab text-slate-400 hover:bg-violet-100 hover:text-violet-500 active:cursor-grabbing"
            }`}
            onClick={(event) => event.stopPropagation()}
            title="拖拽排序"
            {...attributes}
            {...listeners}
          >
            ⋮⋮
          </button>

          <span className="truncate text-xs font-black text-slate-700">
            {index + 1}. {slide.title}
          </span>
        </div>

        <span
          className={`h-2 w-2 shrink-0 rounded-full ${
            isActive ? "bg-violet-500" : "bg-slate-300"
          }`}
        />
      </div>

      <div
        className="relative mx-auto overflow-hidden rounded-xl border border-slate-200 bg-slate-50 shadow-inner"
        style={{
          width: previewWidth,
          height: previewHeight,
          backgroundColor: slide.backgroundColor,
        }}
      >
        {slide.elements.map((element) => {
          const style = element.style;

          // Thumbnail previews use the same asset store as the main canvas.
          // Image elements only keep assetId, so the real image source must be
          // resolved from project.assets before rendering.
          const asset = element.assetId ? assets[element.assetId] : undefined;

          const assetSource = element.assetId
            ? assetSources[element.assetId]
            : undefined;

          const assetMissing = Boolean(
            element.assetId && missingAssetIds.includes(element.assetId),
          );

          const isImageElement =
            element.type === "image" &&
            asset?.type === "image" &&
            Boolean(assetSource) &&
            !assetMissing;

          return (
            <div
              key={element.id}
              className="absolute flex items-center justify-center overflow-hidden whitespace-nowrap text-center"
              style={{
                left: style.x * previewScale,
                top: style.y * previewScale,
                width: style.width * previewScale,
                height: style.height * previewScale,
                transform: `rotate(${style.rotate}deg)`,
                opacity: style.opacity,
                color: style.color ?? "#0f172a",
                backgroundColor: style.backgroundColor ?? "transparent",
                fontSize: (style.fontSize ?? 16) * previewScale,
                fontWeight: style.fontWeight ?? 400,
                borderRadius: (style.borderRadius ?? 0) * previewScale,
              }}
            >
              {isImageElement ? (
                <img
                  src={assetSource}
                  alt={asset?.name ?? "image"}
                  draggable={false}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    display: "block",
                    pointerEvents: "none",
                    userSelect: "none",
                    borderRadius: (style.borderRadius ?? 0) * previewScale,
                  }}
                />
              ) : element.type === "image" ? (
                <div
                  className={`flex h-full w-full items-center justify-center text-[10px] font-black ${
                    assetStoreReady
                      ? "bg-rose-50 text-rose-500"
                      : "bg-slate-100 text-slate-400"
                  }`}
                  title={
                    assetStoreReady
                      ? `资源缺失：${asset?.name ?? element.content}`
                      : "资源加载中"
                  }
                >
                  {assetStoreReady ? "⚠" : "…"}
                </div>
              ) : (
                element.content
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-slate-400">
          {slide.elements.length} 个元素
        </span>

        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={readOnly}
            className="rounded-full bg-violet-50 px-2 py-1 text-xs font-bold text-violet-500 transition hover:bg-violet-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-300"
            onClick={(event) => {
              event.stopPropagation();
              onDuplicateSlide(slide.id);
            }}
          >
            复制
          </button>

          <button
            type="button"
            className="rounded-full bg-red-50 px-2 py-1 text-xs font-bold text-red-500 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-40"
            disabled={readOnly || slideCount <= 1}
            onClick={(event) => {
              event.stopPropagation();
              onDeleteSlide(slide.id);
            }}
          >
            删除
          </button>
        </div>
      </div>
    </article>
  );
}
