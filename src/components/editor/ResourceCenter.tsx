import { useEffect, useMemo, useRef, useState } from "react";
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

  readOnly?: boolean;

  focusAssetId?: string;

  focusRequestId?: number;

  onUploadResource: () => void;

  onInsertAsset: (assetId: string) => void;

  onRelinkAsset: (assetId: string) => void;

  onFocusReference: (slideId: string, elementId: string) => void;

  onDeleteAsset: (assetId: string) => void;

  onCleanupUnusedAssets: () => void;
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
 * Read the visible file extension without trusting MIME metadata. This is useful
 * for formats such as FLV whose MIME may be empty or generic on Windows.
 */
function getAssetExtension(fileName: string) {
  const normalizedName = fileName.trim().toLowerCase();

  const lastDotIndex = normalizedName.lastIndexOf(".");

  if (lastDotIndex <= 0 || lastDotIndex === normalizedName.length - 1) {
    return "";
  }

  return normalizedName.slice(lastDotIndex + 1);
}

function getAssetFormatLabel(asset: PresentationAsset) {
  const extension = getAssetExtension(asset.name);

  if (extension) {
    return extension.toUpperCase();
  }

  const mimeSubtype = asset.mimeType.split("/")[1]?.split(";")[0]?.trim();

  return mimeSubtype ? mimeSubtype.toUpperCase() : "未知格式";
}

/**
 * Explain what Animify can currently do with the stored resource.
 */
function getAssetSupportLabel(asset: PresentationAsset, missing: boolean) {
  if (missing) {
    return "资源文件缺失";
  }

  if (asset.type === "image") {
    return "可插入画布";
  }

  if (asset.type === "video" && getAssetExtension(asset.name) === "flv") {
    return "已入库 · FLV 播放待接入";
  }

  if (asset.type === "video") {
    return "可插入画布 · 浏览器原生视频";
  }

  return "可插入画布 · 浏览器原生音频";
}

/**
 * Images and browser-native media can become canvas elements immediately.
 * FLV remains a library-only asset until the dedicated playback layer exists.
 */
function canInsertAssetToCanvas(
  asset: PresentationAsset,
  missing: boolean,
  source?: string,
) {
  if (missing || !source) {
    return false;
  }

  if (asset.type === "video" && getAssetExtension(asset.name) === "flv") {
    return false;
  }

  return true;
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

  readOnly = false,

  focusAssetId,

  focusRequestId = 0,

  onUploadResource,
  onInsertAsset,
  onRelinkAsset,
  onFocusReference,
  onDeleteAsset,
  onCleanupUnusedAssets,
}: ResourceCenterProps) {
  const [activeFilter, setActiveFilter] = useState<AssetFilter>("all");

  const [searchTerm, setSearchTerm] = useState("");

  /**
   * Keep DOM references so duplicate-review navigation can reveal one exact
   * resource card without rebuilding the resource list.
   */
  const assetCardRefs = useRef<Record<string, HTMLElement | null>>({});

  const [highlightedAssetId, setHighlightedAssetId] = useState<string | null>(
    null,
  );

  const [expandedReferenceAssetId, setExpandedReferenceAssetId] = useState<
    string | null
  >(null);

  /**
   * Reveal the resource selected by the duplicate-review panel.
   *
   * Search is cleared and the matching category is opened first. The card is then
   * scrolled into view and temporarily highlighted so the user can inspect it
   * while the review window remains open.
   */
  useEffect(() => {
    if (!focusAssetId || focusRequestId <= 0) {
      return;
    }

    const focusedAsset = assets[focusAssetId];

    if (!focusedAsset) {
      return;
    }

    let scrollFrameId = 0;

    const prepareFrameId = window.requestAnimationFrame(() => {
      setSearchTerm("");

      setActiveFilter(focusedAsset.type);

      setHighlightedAssetId(focusAssetId);

      /**
       * Wait one more frame for filtering to expose the requested card.
       */
      scrollFrameId = window.requestAnimationFrame(() => {
        assetCardRefs.current[focusAssetId]?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      });
    });

    const clearHighlightTimer = window.setTimeout(() => {
      setHighlightedAssetId((currentAssetId) =>
        currentAssetId === focusAssetId ? null : currentAssetId,
      );
    }, 2200);

    return () => {
      window.cancelAnimationFrame(prepareFrameId);

      if (scrollFrameId) {
        window.cancelAnimationFrame(scrollFrameId);
      }

      window.clearTimeout(clearHighlightTimer);
    };
  }, [assets, focusAssetId, focusRequestId]);

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

  const unusedAssetCount = useMemo(
    () =>
      Object.keys(assets).filter(
        (assetId) => (referencesByAssetId[assetId] ?? []).length === 0,
      ).length,
    [assets, referencesByAssetId],
  );

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

        <div className="flex shrink-0 flex-col gap-2">
          <button
            type="button"
            disabled={readOnly}
            className={`rounded-full px-3 py-2 text-xs font-bold transition ${
              readOnly
                ? "cursor-not-allowed bg-slate-200 text-slate-400"
                : "bg-violet-500 text-white shadow-sm hover:bg-violet-600"
            }`}
            onClick={onUploadResource}
          >
            + 上传资源
          </button>

          <button
            type="button"
            disabled={readOnly || unusedAssetCount === 0}
            className={`rounded-full px-3 py-2 text-[10px] font-bold transition ${
              readOnly || unusedAssetCount === 0
                ? "cursor-not-allowed bg-slate-100 text-slate-300"
                : "border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100"
            }`}
            onClick={onCleanupUnusedAssets}
          >
            {unusedAssetCount === 0
              ? "暂无未使用"
              : `清理未使用（${unusedAssetCount}）`}
          </button>
        </div>
      </div>

      {readOnly ? (
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold leading-5 text-amber-700">
          🔒 重复资源确认中
          <br />
          可搜索、筛选和查看引用，资源修改操作暂时锁定。
        </div>
      ) : null}

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
              上传图片、视频或音频后会自动出现在资源中心。
            </p>
          </div>
        ) : (
          filteredAssets.map((asset) => {
            const missing = missingAssetIdSet.has(asset.id);

            const source = assetSources[asset.id];

            const references = referencesByAssetId[asset.id] ?? [];

            const usageCount = references.length;

            const referencesExpanded = expandedReferenceAssetId === asset.id;

            const formatLabel = getAssetFormatLabel(asset);

            const supportLabel = getAssetSupportLabel(asset, missing);

            const canInsertToCanvas = canInsertAssetToCanvas(
              asset,
              missing,
              source,
            );

            const insertDisabled = readOnly || !canInsertToCanvas;

            const insertButtonLabel = missing
              ? "资源缺失"
              : !source
                ? "资源加载中…"
                : asset.type === "video" &&
                    getAssetExtension(asset.name) === "flv"
                  ? "FLV 播放待接入"
                  : "插入当前页";

            return (
              <article
                key={asset.id}
                ref={(node) => {
                  assetCardRefs.current[asset.id] = node;
                }}
                className={`overflow-hidden rounded-2xl border bg-white transition-all duration-300 ${
                  highlightedAssetId === asset.id
                    ? "animate-pulse border-amber-400 ring-4 ring-amber-200 shadow-lg shadow-amber-100"
                    : missing
                      ? "border-rose-200"
                      : "border-slate-200"
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

                    <span>{formatLabel}</span>

                    <span>引用 {usageCount} 次</span>
                  </div>

                  <p
                    className="mt-1 truncate text-[10px] font-medium text-slate-400"
                    title={asset.mimeType}
                  >
                    {asset.mimeType || "MIME 未知"}
                  </p>

                  <p
                    className={`mt-2 rounded-lg px-2 py-1.5 text-center text-[10px] font-bold ${
                      missing
                        ? "bg-rose-50 text-rose-500"
                        : asset.type === "image"
                          ? "bg-emerald-50 text-emerald-600"
                          : "bg-amber-50 text-amber-700"
                    }`}
                  >
                    {supportLabel}
                  </p>

                  <button
                    type="button"
                    disabled={insertDisabled}
                    className={`mt-3 w-full rounded-xl px-3 py-2 text-xs font-bold transition ${
                      !insertDisabled
                        ? "bg-violet-500 text-white hover:bg-violet-600"
                        : "cursor-not-allowed bg-slate-100 text-slate-300"
                    }`}
                    onClick={() => onInsertAsset(asset.id)}
                  >
                    {readOnly ? "只读审查中" : insertButtonLabel}
                  </button>

                  {missing ? (
                    <button
                      type="button"
                      disabled={readOnly}
                      className="mt-2 w-full rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-700 transition hover:border-amber-300 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-40"
                      onClick={() => onRelinkAsset(asset.id)}
                    >
                      重新挂载资源
                    </button>
                  ) : null}

                  {usageCount === 0 ? (
                    <button
                      type="button"
                      disabled={readOnly}
                      className="mt-2 w-full rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-600 transition hover:border-rose-300 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-40"
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
