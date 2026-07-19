import { useMemo, useState } from "react";
import type {
  PresentationAsset,
  PresentationAssetType,
  Slide,
} from "../../types/presentation";

type AssetFilter = "all" | PresentationAssetType;

type ResourceCenterProps = {
  assets: Record<string, PresentationAsset>;
  assetSources: Record<string, string>;
  missingAssetIds: string[];
  slides: Slide[];

  onUploadResource: () => void;

  onInsertAsset: (assetId: string) => void;

  onRelinkAsset: (assetId: string) => void;

  onFocusReference: (slideId: string, elementId: string) => void;

  /**
   * Permanently remove one unused project asset.
   */
  onDeleteAsset: (assetId: string) => void;
};

const assetFilters: Array<{
  id: AssetFilter;
  label: string;
}> = [
  {
    id: "all",
    label: "全部",
  },
  {
    id: "image",
    label: "图片",
  },
  {
    id: "video",
    label: "视频",
  },
  {
    id: "audio",
    label: "音频",
  },
];

/**
 * Format resource sizes without storing display-only values in project data.
 */
function formatFileSize(size: number) {
  if (!Number.isFinite(size) || size <= 0) {
    return "0 B";
  }

  if (size < 1024) {
    return `${size} B`;
  }

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function getAssetTypeLabel(type: PresentationAssetType) {
  switch (type) {
    case "image":
      return "图片";

    case "video":
      return "视频";

    case "audio":
      return "音频";
  }
}

/**
 * Resource Center V1.
 *
 * The project remains the source of truth for metadata and references. Runtime
 * Blob URLs are received separately and never written back into project JSON.
 */
export function ResourceCenter({
  assets,
  assetSources,
  missingAssetIds,
  slides,
  onUploadResource,
  onInsertAsset,
  onRelinkAsset,
  onFocusReference,
  onDeleteAsset,
}: ResourceCenterProps) {
  const [activeFilter, setActiveFilter] = useState<AssetFilter>("all");

  const [searchTerm, setSearchTerm] = useState("");

  const [expandedReferenceAssetId, setExpandedReferenceAssetId] = useState<
    string | null
  >(null);

  const missingAssetIdSet = useMemo(
    () => new Set(missingAssetIds),
    [missingAssetIds],
  );

  /**
   * Build concrete reference locations instead of storing only a count.
   *
   * The same data powers the usage counter and allows users to navigate directly
   * to every slide element using the resource.
   */
  const referencesByAssetId = useMemo(() => {
    const nextReferences: Record<
      string,
      Array<{
        slideId: string;
        slideTitle: string;
        elementId: string;
        elementName: string;
      }>
    > = {};

    for (const slide of slides) {
      for (const element of slide.elements) {
        if (!element.assetId) {
          continue;
        }

        const references = nextReferences[element.assetId] ?? [];

        references.push({
          slideId: slide.id,
          slideTitle: slide.title,
          elementId: element.id,
          elementName: element.name,
        });

        nextReferences[element.assetId] = references;
      }
    }

    return nextReferences;
  }, [slides]);

  const filteredAssets = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return Object.values(assets)
      .filter((asset) => {
        if (activeFilter !== "all" && asset.type !== activeFilter) {
          return false;
        }

        if (!normalizedSearch) {
          return true;
        }

        return (
          asset.name.toLowerCase().includes(normalizedSearch) ||
          asset.mimeType.toLowerCase().includes(normalizedSearch)
        );
      })
      .sort(
        (left, right) =>
          Date.parse(right.createdAt) - Date.parse(left.createdAt),
      );
  }, [activeFilter, assets, searchTerm]);

  return (
    <aside className="flex h-full min-h-0 flex-col rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex shrink-0 items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-400">资源中心</p>

          <h2 className="text-xl font-bold text-slate-950">项目资源</h2>

          <p className="mt-1 text-xs text-slate-400">
            共 {Object.keys(assets).length} 项资源
          </p>
        </div>

        <button
          type="button"
          className="shrink-0 rounded-full bg-violet-500 px-3 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-violet-600"
          onClick={onUploadResource}
        >
          + 上传资源
        </button>
      </div>

      <input
        type="search"
        value={searchTerm}
        onChange={(event) => setSearchTerm(event.target.value)}
        placeholder="搜索资源名称…"
        className="mt-4 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-violet-300 focus:bg-white"
      />

      <div className="mt-3 grid grid-cols-4 gap-1 rounded-2xl bg-slate-100 p-1">
        {assetFilters.map((filter) => {
          const active = activeFilter === filter.id;

          return (
            <button
              key={filter.id}
              type="button"
              className={`rounded-xl px-2 py-2 text-xs font-bold transition ${
                active
                  ? "bg-white text-violet-600 shadow-sm"
                  : "text-slate-500 hover:text-slate-900"
              }`}
              onClick={() => setActiveFilter(filter.id)}
            >
              {filter.label}
            </button>
          );
        })}
      </div>

      <div className="mt-4 min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain pr-1">
        {filteredAssets.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center">
            <p className="text-sm font-bold text-slate-500">暂无资源</p>

            <p className="mt-2 text-xs leading-5 text-slate-400">
              上传图片后会自动出现在资源中心。
            </p>
          </div>
        ) : (
          filteredAssets.map((asset) => {
            const missing = missingAssetIdSet.has(asset.id);

            const source = assetSources[asset.id];

            const references = referencesByAssetId[asset.id] ?? [];

            const usageCount = references.length;

            const referencesExpanded = expandedReferenceAssetId === asset.id;

            return (
              <article
                key={asset.id}
                className={`overflow-hidden rounded-2xl border bg-white ${
                  missing ? "border-rose-200" : "border-slate-200"
                }`}
              >
                <div className="relative flex h-28 items-center justify-center overflow-hidden bg-slate-100">
                  {asset.type === "image" && source && !missing ? (
                    <img
                      src={source}
                      alt={asset.name}
                      draggable={false}
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <div
                      className={`flex h-full w-full flex-col items-center justify-center gap-1 ${
                        missing ? "bg-rose-50 text-rose-500" : "text-slate-400"
                      }`}
                    >
                      <span className="text-2xl font-black">
                        {missing
                          ? "⚠"
                          : asset.type === "video"
                            ? "▶"
                            : asset.type === "audio"
                              ? "♪"
                              : "◎"}
                      </span>

                      <span className="text-[10px] font-bold">
                        {missing ? "资源缺失" : getAssetTypeLabel(asset.type)}
                      </span>
                    </div>
                  )}

                  <span
                    className={`absolute left-2 top-2 rounded-full px-2 py-1 text-[10px] font-bold shadow-sm ${
                      missing
                        ? "bg-rose-500 text-white"
                        : "bg-white/90 text-slate-600"
                    }`}
                  >
                    {missing ? "缺失" : getAssetTypeLabel(asset.type)}
                  </span>
                </div>

                <div className="p-3">
                  <p
                    className="truncate text-sm font-bold text-slate-900"
                    title={asset.name}
                  >
                    {asset.name}
                  </p>

                  <div className="mt-2 flex flex-wrap gap-2 text-[10px] font-semibold text-slate-400">
                    <span>{formatFileSize(asset.size)}</span>

                    <span>引用 {usageCount} 次</span>
                  </div>

                  {asset.type === "image" ? (
                    <button
                      type="button"
                      disabled={missing || !source}
                      className={`mt-3 w-full rounded-xl px-3 py-2 text-xs font-bold transition ${
                        missing || !source
                          ? "cursor-not-allowed bg-slate-100 text-slate-300"
                          : "bg-violet-500 text-white hover:bg-violet-600"
                      }`}
                      onClick={() => onInsertAsset(asset.id)}
                    >
                      {missing ? "资源缺失" : "插入当前页"}
                    </button>
                  ) : (
                    <div className="mt-3 rounded-xl bg-slate-100 px-3 py-2 text-center text-[10px] font-bold text-slate-400">
                      画布接入将在后续阶段开放
                    </div>
                  )}

                  {missing ? (
                    <button
                      type="button"
                      className="mt-2 w-full rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-700 transition hover:border-amber-300 hover:bg-amber-100"
                      onClick={() => onRelinkAsset(asset.id)}
                    >
                      重新挂载资源
                    </button>
                  ) : null}

                  {usageCount === 0 ? (
                    <button
                      type="button"
                      className="mt-2 w-full rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-600 transition hover:border-rose-300 hover:bg-rose-100"
                      onClick={() => onDeleteAsset(asset.id)}
                    >
                      删除资源
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600 transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-600"
                        onClick={() =>
                          setExpandedReferenceAssetId(
                            referencesExpanded ? null : asset.id,
                          )
                        }
                      >
                        {referencesExpanded
                          ? "收起引用位置"
                          : `查看引用位置（${usageCount}）`}
                      </button>

                      {referencesExpanded ? (
                        <div className="mt-2 space-y-1 rounded-xl bg-slate-50 p-2">
                          {references.map((reference, index) => (
                            <button
                              key={`${reference.slideId}-${reference.elementId}`}
                              type="button"
                              className="w-full rounded-lg bg-white px-2 py-2 text-left text-[10px] font-semibold text-slate-500 transition hover:bg-violet-50 hover:text-violet-600"
                              onClick={() =>
                                onFocusReference(
                                  reference.slideId,
                                  reference.elementId,
                                )
                              }
                            >
                              <span className="block font-black text-slate-700">
                                {index + 1}. {reference.slideTitle}
                              </span>

                              <span className="mt-0.5 block truncate">
                                {reference.elementName}
                              </span>
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </>
                  )}
                </div>
              </article>
            );
          })
        )}
      </div>
    </aside>
  );
}
