import { useState, type DragEvent } from 'react';
import type { Asset, Clip } from '@/core/project.ts';
import { pxToUs } from '@/core/timeline/coords.ts';
import { findFreePlacement } from '@/core/timeline/placement.ts';
import { autoScrollSpeed } from '@/core/timeline/viewport.ts';
import type { Microseconds } from '@/core/time.ts';
import { projectStore } from '@/store/projectStore.ts';
import { ASSET_DRAG_TYPE, timelineStore } from '@/store/timelineStore.ts';
import { createPositionerForEdit } from './editPosition.ts';

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

  /**
   * 포인터 위치에 에셋을 놓았을 때 실제로 배치될 시작 시각과 스냅 안내선 위치.
   * 시작·끝 중 기준점에 가까운 쪽으로 스냅(Alt를 누르면 해제)한 뒤 빈자리 배치를 적용한다.
   */
  const resolveStart = (
    event: DragEvent,
    duration: Microseconds,
  ): { start: Microseconds; snapLine: Microseconds | null } => {
    const rect = event.currentTarget.getBoundingClientRect();
    const desired = pxToUs(event.clientX - rect.left, pxPerSecond);
    const position = createPositionerForEdit(null)([desired, desired + duration], event.altKey);
    const start = findFreePlacement(clips, desired + position.delta, duration);
    const snapped = position.snappedTo;
    return {
      start,
      snapLine:
        snapped !== null && (snapped === start || snapped === start + duration) ? snapped : null,
    };
  };

  const findAsset = (assetId: string | null) =>
    projectStore.getState().project.assets.find((asset) => asset.id === assetId);

  const onDragOver = (event: DragEvent) => {
    if (!event.dataTransfer.types.includes(ASSET_DRAG_TYPE)) {
      return;
    }
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    scrollNearEdge(event);

    const asset = findAsset(timelineStore.getState().draggingAssetId);
    if (!asset) {
      return;
    }
    const { start, snapLine } = resolveStart(event, asset.duration);
    if (preview?.start !== start || preview.duration !== asset.duration) {
      setPreview({ start, duration: asset.duration });
    }
    timelineStore.getState().setSnapLine(snapLine);
  };

  const onDragLeave = (event: DragEvent) => {
    // 자식 요소로 들어갈 때도 dragleave가 발생하므로 대상 밖으로 나갈 때만 지운다
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setPreview(null);
      timelineStore.getState().setSnapLine(null);
    }
  };

  const handleDrop = (event: DragEvent) => {
    setPreview(null);
    timelineStore.getState().setSnapLine(null);
    const asset = findAsset(event.dataTransfer.getData(ASSET_DRAG_TYPE));
    if (!asset) {
      return;
    }
    event.preventDefault();
    onDrop(asset, resolveStart(event, asset.duration).start);
    timelineStore.getState().setDraggingAssetId(null);
  };

  return { preview, handlers: { onDragOver, onDragLeave, onDrop: handleDrop } };
}

/**
 * HTML5 드래그 중 가장자리 자동 스크롤. dragover는 포인터가 멈춰 있어도 주기적으로 발생하므로
 * 별도 rAF 루프 없이 이벤트마다 조금씩 스크롤한다.
 */
function scrollNearEdge(event: DragEvent): void {
  const scroller = event.currentTarget.closest<HTMLElement>('[data-timeline-scroll]');
  if (!scroller) {
    return;
  }
  const rect = scroller.getBoundingClientRect();
  if (rect.width > 0) {
    scroller.scrollLeft += autoScrollSpeed(event.clientX - rect.left, rect.width);
  }
}
