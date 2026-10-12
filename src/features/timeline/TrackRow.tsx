import { useState, type DragEvent } from 'react';
import { createClipFromAsset } from '@/core/clip.ts';
import { createAddClipCommand } from '@/core/commands/addClip.ts';
import type { Asset, Clip, Track } from '@/core/project.ts';
import { pxToUs, usToPx } from '@/core/timeline/coords.ts';
import { findFreePlacement } from '@/core/timeline/placement.ts';
import type { Microseconds } from '@/core/time.ts';
import { projectStore } from '@/store/projectStore.ts';
import { ASSET_DRAG_TYPE, timelineStore } from '@/store/timelineStore.ts';
import { ClipView } from './ClipView.tsx';

interface TrackRowProps {
  track: Track;
  label: string;
  clips: readonly Clip[];
  assets: readonly Asset[];
  pxPerSecond: number;
}

interface DropPreview {
  start: Microseconds;
  duration: Microseconds;
}

export function TrackRow({ track, label, clips, assets, pxPerSecond }: TrackRowProps) {
  const [preview, setPreview] = useState<DropPreview | null>(null);

  /** 포인터 위치에 에셋을 놓았을 때 실제로 배치될 시작 시각 */
  const resolvePlacement = (event: DragEvent, duration: Microseconds): Microseconds => {
    const rect = event.currentTarget.getBoundingClientRect();
    const desiredStart = pxToUs(event.clientX - rect.left, pxPerSecond);
    return findFreePlacement(clips, desiredStart, duration);
  };

  const handleDragOver = (event: DragEvent) => {
    if (!event.dataTransfer.types.includes(ASSET_DRAG_TYPE)) {
      return;
    }
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';

    const { draggingAssetId } = timelineStore.getState();
    const asset = assets.find((candidate) => candidate.id === draggingAssetId);
    if (!asset) {
      return;
    }
    const start = resolvePlacement(event, asset.duration);
    if (preview?.start !== start || preview.duration !== asset.duration) {
      setPreview({ start, duration: asset.duration });
    }
  };

  const handleDragLeave = (event: DragEvent) => {
    // 자식 요소로 들어갈 때도 dragleave가 발생하므로 트랙 밖으로 나갈 때만 지운다
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setPreview(null);
    }
  };

  const handleDrop = (event: DragEvent) => {
    const assetId = event.dataTransfer.getData(ASSET_DRAG_TYPE);
    setPreview(null);
    const asset = assets.find((candidate) => candidate.id === assetId);
    if (!asset) {
      return;
    }
    event.preventDefault();

    const clip = createClipFromAsset(asset, {
      id: crypto.randomUUID(),
      trackId: track.id,
      start: resolvePlacement(event, asset.duration),
    });
    projectStore.getState().dispatch(createAddClipCommand(clip));
    timelineStore.getState().setDraggingAssetId(null);
  };

  return (
    <div
      role="list"
      aria-label={`트랙 ${label}`}
      className="relative h-14 border-b border-neutral-800"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {clips.map((clip) => (
        <ClipView
          key={clip.id}
          clip={clip}
          asset={assets.find((asset) => asset.id === clip.assetId)}
          pxPerSecond={pxPerSecond}
        />
      ))}
      {preview && (
        <div
          data-testid="drop-preview"
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-1 rounded border border-dashed border-sky-300 bg-sky-300/15"
          style={{
            left: usToPx(preview.start, pxPerSecond),
            width: usToPx(preview.duration, pxPerSecond),
          }}
        />
      )}
    </div>
  );
}
