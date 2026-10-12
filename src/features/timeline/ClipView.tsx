import { clipDuration } from '@/core/clip.ts';
import type { Asset, Clip } from '@/core/project.ts';
import { usToPx } from '@/core/timeline/coords.ts';
import { useMediaStore } from '@/store/mediaStore.ts';
import { useTimelineStore } from '@/store/timelineStore.ts';
import { useClipDrag } from './useClipDrag.ts';

interface ClipViewProps {
  clip: Clip;
  asset: Asset | undefined;
  pxPerSecond: number;
}

export function ClipView({ clip, asset, pxPerSecond }: ClipViewProps) {
  const thumbnailUrl = useMediaStore((state) => state.entries[clip.assetId]?.thumbnailUrl);
  const isSelected = useTimelineStore((state) => state.selectedClipId === clip.id);
  const { isDragging, handlers } = useClipDrag(clip, pxPerSecond);
  const name = asset?.name ?? '(없는 에셋)';

  return (
    <div
      role="listitem"
      aria-label={`클립 ${name}`}
      data-selected={isSelected}
      className={`absolute inset-y-1 flex cursor-grab touch-none overflow-hidden rounded border bg-sky-800 select-none active:cursor-grabbing ${
        isSelected ? 'border-amber-300 ring-1 ring-amber-300' : 'border-sky-400/60'
      } ${isDragging ? 'opacity-40' : ''}`}
      style={{
        left: usToPx(clip.start, pxPerSecond),
        width: usToPx(clipDuration(clip), pxPerSecond),
      }}
      {...handlers}
    >
      {thumbnailUrl && (
        <img
          src={thumbnailUrl}
          alt=""
          draggable={false}
          className="pointer-events-none h-full w-auto shrink-0 object-cover opacity-80"
        />
      )}
      <span className="truncate px-1.5 py-1 text-[11px] text-sky-50">{name}</span>
    </div>
  );
}
