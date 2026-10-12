import { memo } from 'react';
import { usToPx } from '@/core/timeline/coords.ts';
import type { TimelineItem } from '@/core/timelineItem.ts';
import { useMediaStore } from '@/store/mediaStore.ts';
import { useTimelineStore } from '@/store/timelineStore.ts';
import { useItemDrag } from './useItemDrag.ts';
import { useItemTrim } from './useItemTrim.ts';

interface ItemViewProps {
  item: TimelineItem;
  /** 표시 이름 (클립은 에셋 이름, 텍스트는 내용) */
  label: string;
  pxPerSecond: number;
}

const HANDLE_CLASS =
  'absolute inset-y-0 z-10 w-1.5 cursor-ew-resize bg-selection/0 hover:bg-selection/80 group-data-[selected=true]:bg-selection/60';

const KIND_STYLE: Record<TimelineItem['kind'], { prefix: string; className: string }> = {
  clip: { prefix: '클립', className: 'bg-clip border-clip-border text-clip-foreground' },
  text: {
    prefix: '텍스트',
    className: 'bg-text-item border-text-item-border text-text-item-foreground',
  },
};

function ClipThumbnail({ assetId }: { assetId: string }) {
  const thumbnailUrl = useMediaStore((state) => state.entries[assetId]?.thumbnailUrl);
  if (!thumbnailUrl) {
    return null;
  }
  return (
    <img
      src={thumbnailUrl}
      alt=""
      draggable={false}
      className="pointer-events-none h-full w-auto shrink-0 object-cover opacity-80"
    />
  );
}

/**
 * 타임라인의 항목(클립·텍스트) 블록. 이동·트리밍은 공통 훅으로 처리한다.
 * 같은 트랙의 다른 항목이 바뀌어도 이 항목의 props가 같으면 다시 그리지 않는다.
 */
export const ItemView = memo(function ItemView({ item, label, pxPerSecond }: ItemViewProps) {
  const isSelected = useTimelineStore((state) => state.selectedItemId === item.id);
  const { isDragging, handlers } = useItemDrag(item);
  const { trim, handleProps } = useItemTrim(item);
  const style = KIND_STYLE[item.kind];

  // 트리밍 중에는 아직 반영되지 않은 구간으로 표시한다
  const span = trim?.span ?? item;

  return (
    <div
      role="listitem"
      aria-label={`${style.prefix} ${label}`}
      data-selected={isSelected}
      className={`group absolute inset-y-1 flex cursor-grab touch-none overflow-hidden rounded border select-none active:cursor-grabbing ${
        style.className
      } ${isSelected ? 'border-selection ring-1 ring-selection' : ''} ${isDragging ? 'opacity-40' : ''}`}
      style={{
        left: usToPx(span.start, pxPerSecond),
        width: usToPx(span.end - span.start, pxPerSecond),
      }}
      {...handlers}
    >
      {item.kind === 'clip' && <ClipThumbnail assetId={item.clip.assetId} />}
      <span className="truncate px-1.5 py-1 text-[11px]">{label}</span>
      <div
        role="separator"
        aria-label={`${label} 시작 지점 트리밍`}
        data-edge="start"
        className={`${HANDLE_CLASS} left-0`}
        {...handleProps}
      />
      <div
        role="separator"
        aria-label={`${label} 끝 지점 트리밍`}
        data-edge="end"
        className={`${HANDLE_CLASS} right-0`}
        {...handleProps}
      />
    </div>
  );
});
