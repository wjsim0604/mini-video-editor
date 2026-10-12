import { useState, type DragEvent } from 'react';
import type { Asset, Clip } from '@/core/project.ts';
import { pxToUs } from '@/core/timeline/coords.ts';
import { findFreePlacement } from '@/core/timeline/placement.ts';
import type { Microseconds } from '@/core/time.ts';
import { projectStore } from '@/store/projectStore.ts';
import { ASSET_DRAG_TYPE, timelineStore } from '@/store/timelineStore.ts';

export interface DropPreview {
  start: Microseconds;
  duration: Microseconds;
}

interface AssetDropTargetOptions {
  /** 이 대상에 이미 놓여 있는 클립 (겹치지 않는 자리 계산용) */
  clips: readonly Clip[];
  pxPerSecond: number;
  onDrop: (asset: Asset, start: Microseconds) => void;
}

/** 에셋 패널에서 끌어온 에셋을 받는 드롭 대상 (트랙, 새 트랙 영역 공통) */
export function useAssetDropTarget({ clips, pxPerSecond, onDrop }: AssetDropTargetOptions) {
  const [preview, setPreview] = useState<DropPreview | null>(null);

  /** 포인터 위치에 에셋을 놓았을 때 실제로 배치될 시작 시각 */
  const resolveStart = (event: DragEvent, duration: Microseconds): Microseconds => {
    const rect = event.currentTarget.getBoundingClientRect();
    return findFreePlacement(clips, pxToUs(event.clientX - rect.left, pxPerSecond), duration);
  };

  const findAsset = (assetId: string | null) =>
    projectStore.getState().project.assets.find((asset) => asset.id === assetId);

  const onDragOver = (event: DragEvent) => {
    if (!event.dataTransfer.types.includes(ASSET_DRAG_TYPE)) {
      return;
    }
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';

    const asset = findAsset(timelineStore.getState().draggingAssetId);
    if (!asset) {
      return;
    }
    const start = resolveStart(event, asset.duration);
    if (preview?.start !== start || preview.duration !== asset.duration) {
      setPreview({ start, duration: asset.duration });
    }
  };

  const onDragLeave = (event: DragEvent) => {
    // 자식 요소로 들어갈 때도 dragleave가 발생하므로 대상 밖으로 나갈 때만 지운다
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setPreview(null);
    }
  };

  const handleDrop = (event: DragEvent) => {
    setPreview(null);
    const asset = findAsset(event.dataTransfer.getData(ASSET_DRAG_TYPE));
    if (!asset) {
      return;
    }
    event.preventDefault();
    onDrop(asset, resolveStart(event, asset.duration));
    timelineStore.getState().setDraggingAssetId(null);
  };

  return { preview, handlers: { onDragOver, onDragLeave, onDrop: handleDrop } };
}
