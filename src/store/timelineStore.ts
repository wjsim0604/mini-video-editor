import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';

/** 에셋 패널 → 타임라인 드래그에 사용하는 dataTransfer 타입 */
export const ASSET_DRAG_TYPE = 'application/x-mini-video-editor-asset';

export const DEFAULT_PX_PER_SECOND = 50;

/** 편집 결과가 아닌 타임라인 화면 상태. undo 대상이 아니며 저장하지 않는다. */
export interface TimelineState {
  pxPerSecond: number;
  /**
   * 드래그 중인 에셋 id. HTML5 DnD는 dragover 중에 dataTransfer 값을 읽을 수 없으므로
   * 배치 미리보기에 필요한 에셋 정보를 여기서 얻는다.
   */
  draggingAssetId: string | null;
  setDraggingAssetId: (assetId: string | null) => void;
}

export function createTimelineStore() {
  return createStore<TimelineState>()((set) => ({
    pxPerSecond: DEFAULT_PX_PER_SECOND,
    draggingAssetId: null,
    setDraggingAssetId: (assetId) => {
      set({ draggingAssetId: assetId });
    },
  }));
}

export const timelineStore = createTimelineStore();

export function useTimelineStore<T>(selector: (state: TimelineState) => T): T {
  return useStore(timelineStore, selector);
}
