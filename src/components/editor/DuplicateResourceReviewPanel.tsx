import {
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type {
  PresentationAsset,
  PresentationAssetType,
} from "../../types/presentation";

type DuplicateCandidateView = {
  name: string;
  size: number;
  type: PresentationAssetType;
};

type DuplicateResourceReviewPanelProps = {
  candidate: DuplicateCandidateView;
  existingAsset: PresentationAsset;
  existingUsageCount: number;
  reviewIndex: number;
  reviewTotal: number;

  onLocateExisting: () => void;
  onUseExisting: () => void;
  onKeepDuplicate: () => void;
  onSkip: () => void;
};

function formatFileSize(size: number) {
  if (size < 1024) {
    return `${size} B`;
  }

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function getTypeLabel(type: PresentationAssetType) {
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
 * Non-modal duplicate-resource decision panel.
 *
 * The panel stays above the editor but can be moved away so users can inspect
 * the existing resource before deciding what to do with the incoming file.
 */
export function DuplicateResourceReviewPanel({
  candidate,
  existingAsset,
  existingUsageCount,
  reviewIndex,
  reviewTotal,
  onLocateExisting,
  onUseExisting,
  onKeepDuplicate,
  onSkip,
}: DuplicateResourceReviewPanelProps) {
  const [position, setPosition] = useState(() => ({
    x: Math.max(24, window.innerWidth - 500),
    y: 96,
  }));

  const dragStateRef = useRef<{
    startClientX: number;
    startClientY: number;
    startX: number;
    startY: number;
  } | null>(null);

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0) {
      return;
    }

    event.preventDefault();

    dragStateRef.current = {
      startClientX: event.clientX,
      startClientY: event.clientY,
      startX: position.x,
      startY: position.y,
    };

    function handlePointerMove(moveEvent: PointerEvent) {
      const dragState = dragStateRef.current;

      if (!dragState) {
        return;
      }

      const panelWidth = 460;
      const panelHeight = 520;

      const nextX =
        dragState.startX + moveEvent.clientX - dragState.startClientX;

      const nextY =
        dragState.startY + moveEvent.clientY - dragState.startClientY;

      setPosition({
        x: Math.min(
          Math.max(12, nextX),
          Math.max(12, window.innerWidth - panelWidth - 12),
        ),

        y: Math.min(
          Math.max(12, nextY),
          Math.max(12, window.innerHeight - panelHeight - 12),
        ),
      });
    }

    function handlePointerUp() {
      dragStateRef.current = null;

      window.removeEventListener("pointermove", handlePointerMove);

      window.removeEventListener("pointerup", handlePointerUp);
    }

    window.addEventListener("pointermove", handlePointerMove);

    window.addEventListener("pointerup", handlePointerUp);
  }

  return (
    <aside
      className="fixed z-10000 w-460px overflow-hidden rounded-3xl border border-white/70 bg-white/95 shadow-2xl backdrop-blur-xl"
      style={{
        left: position.x,
        top: position.y,
      }}
      onClick={(event) => event.stopPropagation()}
    >
      <div
        className="cursor-move border-b border-slate-100 bg-slate-950 px-5 py-4 text-white select-none"
        onPointerDown={handlePointerDown}
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-violet-300">
              Duplicate Review
            </p>

            <h2 className="mt-1 text-lg font-black">发现重复资源</h2>
          </div>

          <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-black">
            {reviewIndex} / {reviewTotal}
          </span>
        </div>

        <p className="mt-2 text-xs text-slate-300">拖动此区域可移动窗口</p>
      </div>

      <div className="space-y-4 p-5">
        <section className="rounded-2xl bg-violet-50 p-4">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-violet-500">
            准备导入
          </p>

          <p className="mt-2 break-all text-sm font-black text-slate-900">
            {candidate.name}
          </p>

          <p className="mt-1 text-xs font-semibold text-slate-500">
            {formatFileSize(candidate.size)}
            {" · "}
            {getTypeLabel(candidate.type)}
          </p>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
            项目中已有
          </p>

          <p className="mt-2 break-all text-sm font-black text-slate-900">
            {existingAsset.name}
          </p>

          <p className="mt-1 text-xs font-semibold text-slate-500">
            {formatFileSize(existingAsset.size)}
            {" · "}
            {getTypeLabel(existingAsset.type)}
            {" · "}
            引用 {existingUsageCount} 次
          </p>
        </section>

        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
          <p className="text-sm font-black text-emerald-700">
            ✓ 文件内容完全一致
          </p>

          <p className="mt-1 text-xs leading-5 text-emerald-600">
            Animify 已通过 SHA-256 对真实文件内容完成校验。
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            className="rounded-xl border border-violet-200 bg-violet-50 px-3 py-2.5 text-xs font-black text-violet-600 transition hover:bg-violet-100"
            onClick={onLocateExisting}
          >
            定位已有资源
          </button>

          <button
            type="button"
            className="rounded-xl bg-violet-500 px-3 py-2.5 text-xs font-black text-white transition hover:bg-violet-600"
            onClick={onUseExisting}
          >
            使用已有并结束此项
          </button>

          <button
            type="button"
            className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-black text-slate-700 transition hover:bg-slate-50"
            onClick={onKeepDuplicate}
          >
            仍然保留重复项
          </button>

          <button
            type="button"
            className="rounded-xl border border-slate-200 bg-slate-100 px-3 py-2.5 text-xs font-black text-slate-500 transition hover:bg-slate-200"
            onClick={onSkip}
          >
            跳过此文件
          </button>
        </div>
      </div>
    </aside>
  );
}
