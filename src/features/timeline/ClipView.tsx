import { clipDuration } from '@/core/clip.ts';
import type { Asset, Clip } from '@/core/project.ts';
import { usToPx } from '@/core/timeline/coords.ts';
import { useMediaStore } from '@/store/mediaStore.ts';

interface ClipViewProps {
  clip: Clip;
  asset: Asset | undefined;
  pxPerSecond: number;
}

export function ClipView({ clip, asset, pxPerSecond }: ClipViewProps) {
  const thumbnailUrl = useMediaStore((state) => state.entries[clip.assetId]?.thumbnailUrl);
  const name = asset?.name ?? '(없는 에셋)';

  return (
    <div
      role="listitem"
      aria-label={`클립 ${name}`}
      className="absolute inset-y-1 flex overflow-hidden rounded border border-sky-400/60 bg-sky-800"
      style={{
        left: usToPx(clip.start, pxPerSecond),
        width: usToPx(clipDuration(clip), pxPerSecond),
      }}
    >
      {thumbnailUrl && (
        <img
          src={thumbnailUrl}
          alt=""
          draggable={false}
          className="h-full w-auto shrink-0 object-cover opacity-80"
        />
      )}
      <span className="truncate px-1.5 py-1 text-[11px] text-sky-50">{name}</span>
    </div>
  );
}
