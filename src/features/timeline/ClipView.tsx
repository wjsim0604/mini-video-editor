import { memo } from 'react';
import type { Asset, Clip } from '@/core/project.ts';
import { usToPx } from '@/core/timeline/coords.ts';
import { useMediaStore } from '@/store/mediaStore.ts';
import { useTimelineStore } from '@/store/timelineStore.ts';
import { useClipDrag } from './useClipDrag.ts';
import { useClipTrim } from './useClipTrim.ts';

interface ClipViewProps {
  clip: Clip;
  asset: Asset | undefined;
  pxPerSecond: number;
}

const HANDLE_CLASS =
  'absolute inset-y-0 z-10 w-1.5 cursor-ew-resize bg-amber-300/0 hover:bg-amber-300/80 group-data-[selected=true]:bg-amber-300/60';

/** 같은 트랙의 다른 클립이 바뀌어도 이 클립의 props가 같으면 다시 그리지 않는다 */
export const ClipView = memo(function ClipView({ clip, asset, pxPerSecond }: ClipViewProps) {
  const thumbnailUrl = useMediaStore((state) => state.entries[clip.assetId]?.thumbnailUrl);
  const isSelected = useTimelineStore((state) => state.selectedClipId === clip.id);
  const { isDragging, handlers } = useClipDrag(clip);
  const { trim, handleProps } = useClipTrim(clip);
  const name = asset?.name ?? '(없는 에셋)';

  // 트리밍 중에는 아직 반영되지 않은 타이밍으로 표시한다
  const timing = trim?.timing ?? clip;
  const duration = timing.outPoint - timing.inPoint;

  return (
    <div
      role="listitem"
      aria-label={`클립 ${name}`}
      data-selected={isSelected}
      className={`group absolute inset-y-1 flex cursor-grab touch-none overflow-hidden rounded border bg-sky-800 select-none active:cursor-grabbing ${
        isSelected ? 'border-amber-300 ring-1 ring-amber-300' : 'border-sky-400/60'
      } ${isDragging ? 'opacity-40' : ''}`}
      style={{ left: usToPx(timing.start, pxPerSecond), width: usToPx(duration, pxPerSecond) }}
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
      <div
        role="separator"
        aria-label={`${name} 시작 지점 트리밍`}
        data-edge="start"
        className={`${HANDLE_CLASS} left-0`}
        {...handleProps}
      />
      <div
        role="separator"
        aria-label={`${name} 끝 지점 트리밍`}
        data-edge="end"
        className={`${HANDLE_CLASS} right-0`}
        {...handleProps}
      />
    </div>
  );
});
