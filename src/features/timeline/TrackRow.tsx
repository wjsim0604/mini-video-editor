import { createClipFromAsset } from '@/core/clip.ts';
import { createAddClipCommand } from '@/core/commands/addClip.ts';
import type { Asset, Clip, Track } from '@/core/project.ts';
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
  assets: readonly Asset[];
  pxPerSecond: number;
}

export function TrackRow({ track, label, clips, assets, pxPerSecond }: TrackRowProps) {
  // 이 트랙이 클립 이동 대상일 때만 다시 그려진다
  const movePreview = useTimelineStore((state) =>
    state.clipDrag?.target.trackId === track.id ? state.clipDrag : null,
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

  return (
    <div
      role="list"
      aria-label={`트랙 ${label}`}
      className="relative border-b border-neutral-800"
      style={{ height: TRACK_HEIGHT }}
      {...assetDrop.handlers}
    >
      {clips.map((clip) => (
        <ClipView
          key={clip.id}
          clip={clip}
          asset={assets.find((asset) => asset.id === clip.assetId)}
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
