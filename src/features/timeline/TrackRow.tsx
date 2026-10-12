import { createClipFromAsset } from '@/core/clip.ts';
import { createAddClipCommand } from '@/core/commands/addClip.ts';
import type { Asset, Track } from '@/core/project.ts';
import { spanInRange, type TimeRange } from '@/core/timeline/viewport.ts';
import type { TimelineItem } from '@/core/timelineItem.ts';
import { projectStore } from '@/store/projectStore.ts';
import { useTimelineStore } from '@/store/timelineStore.ts';
import { ItemView } from './ItemView.tsx';
import { TRACK_HEIGHT } from './layout.ts';
import { PlacementGhost } from './PlacementGhost.tsx';
import { useAssetDropTarget } from './useAssetDropTarget.ts';

interface TrackRowProps {
  track: Track;
  label: string;
  items: readonly TimelineItem[];
  assetsById: ReadonlyMap<string, Asset>;
  pxPerSecond: number;
  /** 렌더링할 시간 범위 (보이는 영역 + 여유) */
  range: TimeRange;
}

function itemLabel(item: TimelineItem, assetsById: ReadonlyMap<string, Asset>): string {
  if (item.kind === 'text') {
    return item.overlay.text.split('\n')[0] ?? '';
  }
  return assetsById.get(item.clip.assetId)?.name ?? '(없는 에셋)';
}

export function TrackRow({ track, label, items, assetsById, pxPerSecond, range }: TrackRowProps) {
  // 이 트랙이 이동 대상일 때만 다시 그려진다
  const movePreview = useTimelineStore((state) =>
    state.itemDrag?.target.trackId === track.id ? state.itemDrag : null,
  );
  // 끌거나 트리밍 중인 항목은 범위 밖으로 스크롤되어도 계속 그린다 (포인터 캡처가 끊기지 않도록)
  const activeItemId = useTimelineStore(
    (state) => state.itemDrag?.itemId ?? state.itemTrim?.itemId ?? null,
  );
  const assetDrop = useAssetDropTarget({
    clips: items,
    pxPerSecond,
    onDrop: (asset, start) => {
      const clip = createClipFromAsset(asset, {
        id: crypto.randomUUID(),
        trackId: track.id,
        start,
      });
      projectStore.getState().dispatch(createAddClipCommand(clip));
    },
  });
  const visibleItems = items.filter((item) => spanInRange(item, range) || item.id === activeItemId);
  // 에셋(영상·이미지)은 비디오 트랙에만 놓을 수 있다
  const dropHandlers = track.kind === 'video' ? assetDrop.handlers : {};

  return (
    <div
      role="list"
      aria-label={`트랙 ${label}`}
      className="relative border-b"
      style={{ height: TRACK_HEIGHT }}
      {...dropHandlers}
    >
      {visibleItems.map((item) => (
        <ItemView
          key={item.id}
          item={item}
          label={itemLabel(item, assetsById)}
          pxPerSecond={pxPerSecond}
        />
      ))}
      {assetDrop.preview && <PlacementGhost {...assetDrop.preview} pxPerSecond={pxPerSecond} />}
      {movePreview && (
        <PlacementGhost
          start={movePreview.target.start}
          duration={movePreview.duration}
          pxPerSecond={pxPerSecond}
        />
      )}
    </div>
  );
}
