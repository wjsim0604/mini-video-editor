import { createClipFromAsset } from '@/core/clip.ts';
import { createAddClipCommand } from '@/core/commands/addClip.ts';
import type { Asset, Clip, Track } from '@/core/project.ts';
import { clipInRange, type TimeRange } from '@/core/timeline/viewport.ts';
import { projectStore } from '@/store/projectStore.ts';
import { useTimelineStore } from '@/store/timelineStore.ts';
import { ClipView } from './ClipView.tsx';
import { TRACK_HEIGHT } from './layout.ts';
import { PlacementGhost } from './PlacementGhost.tsx';
import { useAssetDropTarget } from './useAssetDropTarget.ts';

interface TrackRowProps {
  track: Track;
  label: string;
  clips: readonly Clip[];
  assetsById: ReadonlyMap<string, Asset>;
  pxPerSecond: number;
  /** 렌더링할 시간 범위 (보이는 영역 + 여유) */
  range: TimeRange;
}

export function TrackRow({ track, label, clips, assetsById, pxPerSecond, range }: TrackRowProps) {
  // 이 트랙이 클립 이동 대상일 때만 다시 그려진다
  const movePreview = useTimelineStore((state) =>
    state.clipDrag?.target.trackId === track.id ? state.clipDrag : null,
  );
  // 끌거나 트리밍 중인 클립은 범위 밖으로 스크롤되어도 계속 그린다 (포인터 캡처가 끊기지 않도록)
  const activeClipId = useTimelineStore(
    (state) => state.clipDrag?.clipId ?? state.clipTrim?.clipId ?? null,
  );
  const assetDrop = useAssetDropTarget({
    clips,
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
  const visibleClips = clips.filter((clip) => clipInRange(clip, range) || clip.id === activeClipId);

  return (
    <div
      role="list"
      aria-label={`트랙 ${label}`}
      className="relative border-b border-neutral-800"
      style={{ height: TRACK_HEIGHT }}
      {...assetDrop.handlers}
    >
      {visibleClips.map((clip) => (
        <ClipView
          key={clip.id}
          clip={clip}
          asset={assetsById.get(clip.assetId)}
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
