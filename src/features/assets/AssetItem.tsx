import type { Asset } from '@/core/project.ts';
import { formatDuration } from '@/core/time.ts';
import { useMediaStore } from '@/store/mediaStore.ts';
import { ASSET_DRAG_TYPE, timelineStore } from '@/store/timelineStore.ts';
import type { DragEvent } from 'react';

interface AssetItemProps {
  asset: Asset;
}

export function AssetItem({ asset }: AssetItemProps) {
  const thumbnailUrl = useMediaStore((state) => state.entries[asset.id]?.thumbnailUrl);
  // 복원할 때 원본 파일이 저장되어 있지 않았던 에셋 (저장 공간 부족 등)
  const isMissing = useMediaStore((state) => state.entries[asset.id] === undefined);

  const handleDragStart = (event: DragEvent) => {
    event.dataTransfer.setData(ASSET_DRAG_TYPE, asset.id);
    event.dataTransfer.effectAllowed = 'copy';
    timelineStore.getState().setDraggingAssetId(asset.id);
  };

  const handleDragEnd = () => {
    timelineStore.getState().setDraggingAssetId(null);
  };

  return (
    <li
      draggable
      aria-label={asset.name}
      className="flex cursor-grab items-center gap-2 rounded p-1.5 hover:bg-neutral-800 active:cursor-grabbing"
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="relative aspect-video w-20 shrink-0 overflow-hidden rounded bg-black">
        {thumbnailUrl && (
          <img
            src={thumbnailUrl}
            alt=""
            className="h-full w-full object-contain"
            draggable={false}
          />
        )}
        {asset.type === 'video' && (
          <span className="absolute right-0.5 bottom-0.5 rounded bg-black/70 px-1 text-[10px] tabular-nums">
            {formatDuration(asset.duration)}
          </span>
        )}
      </div>
      <div className="min-w-0 text-xs">
        <p className="truncate" title={asset.name}>
          {asset.name}
        </p>
        {asset.width !== undefined && asset.height !== undefined && (
          <p className="text-neutral-400 tabular-nums">
            {asset.width}×{asset.height}
          </p>
        )}
        {isMissing && (
          <p
            className="text-amber-400"
            title="원본 파일이 저장되지 않아 복원하지 못했습니다. 다시 가져와 주세요."
          >
            파일 없음
          </p>
        )}
      </div>
    </li>
  );
}
