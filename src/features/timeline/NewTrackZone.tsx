import { createClipFromAsset } from '@/core/clip.ts';
import { createAddClipCommand } from '@/core/commands/addClip.ts';
import { createAddTrackCommand } from '@/core/commands/addTrack.ts';
import { createCompositeCommand } from '@/core/commands/composite.ts';
import { nextTrackOrder } from '@/core/track.ts';
import { projectStore } from '@/store/projectStore.ts';
import { useTimelineStore } from '@/store/timelineStore.ts';
import { NEW_TRACK_ZONE_HEIGHT } from './layout.ts';
import { PlacementGhost } from './PlacementGhost.tsx';
import { useAssetDropTarget } from './useAssetDropTarget.ts';

interface NewTrackZoneProps {
  pxPerSecond: number;
}

/** 맨 위 트랙 위의 영역. 여기에 클립이나 에셋을 놓으면 새 트랙이 만들어진다. */
export function NewTrackZone({ pxPerSecond }: NewTrackZoneProps) {
  const movePreview = useTimelineStore((state) =>
    state.itemDrag?.target.trackId === null ? state.itemDrag : null,
  );
  const isDraggingSomething = useTimelineStore(
    (state) => state.itemDrag !== null || state.draggingAssetId !== null,
  );
  const assetDrop = useAssetDropTarget({
    clips: [],
    pxPerSecond,
    onDrop: (asset, start) => {
      const { project, dispatch } = projectStore.getState();
      const trackId = crypto.randomUUID();
      dispatch(
        createCompositeCommand('새 트랙에 클립 추가', [
          createAddTrackCommand({
            id: trackId,
            kind: 'video',
            order: nextTrackOrder(project.tracks),
          }),
          createAddClipCommand(
            createClipFromAsset(asset, { id: crypto.randomUUID(), trackId, start }),
          ),
        ]),
      );
    },
  });
  const showGhost = assetDrop.preview ?? movePreview;

  return (
    <div
      role="region"
      aria-label="새 트랙"
      className="relative border-b"
      style={{ height: NEW_TRACK_ZONE_HEIGHT }}
      {...assetDrop.handlers}
    >
      {isDraggingSomething && !showGhost && (
        <p className="pointer-events-none sticky left-0 inline-block px-2 text-[11px] leading-8 text-muted-foreground">
          여기에 놓으면 새 트랙이 만들어집니다
        </p>
      )}
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
