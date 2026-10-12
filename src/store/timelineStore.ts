import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';
import type { ClipMoveTarget } from '@/core/timeline/moveClip.ts';
import type { ClipTiming, TrimEdge } from '@/core/timeline/trim.ts';
import type { Microseconds } from '@/core/time.ts';

/** 에셋 패널 → 타임라인 드래그에 사용하는 dataTransfer 타입 */
export const ASSET_DRAG_TYPE = 'application/x-mini-video-editor-asset';

export const DEFAULT_PX_PER_SECOND = 50;

/** 진행 중인 클립 이동. 놓기 전까지 Project는 바뀌지 않고 이 상태로만 미리보기를 그린다. */
export interface ClipDragState {
  clipId: string;
  duration: Microseconds;
  target: ClipMoveTarget;
}

/** 진행 중인 트리밍. 놓기 전까지 클립은 이 타이밍으로 표시된다. */
export interface ClipTrimState {
  clipId: string;
  edge: TrimEdge;
  timing: ClipTiming;
}

/** 편집 결과가 아닌 타임라인 화면 상태. undo 대상이 아니며 저장하지 않는다. */
export interface TimelineState {
  pxPerSecond: number;
  /**
   * 드래그 중인 에셋 id. HTML5 DnD는 dragover 중에 dataTransfer 값을 읽을 수 없으므로
   * 배치 미리보기에 필요한 에셋 정보를 여기서 얻는다.
   */
  draggingAssetId: string | null;
  selectedClipId: string | null;
  clipDrag: ClipDragState | null;
  clipTrim: ClipTrimState | null;
  snapEnabled: boolean;
  /** 드래그 중 스냅된 기준점 (세로 안내선 위치) */
  snapLine: Microseconds | null;
  setDraggingAssetId: (assetId: string | null) => void;
  selectClip: (clipId: string | null) => void;
  setClipDrag: (drag: ClipDragState | null) => void;
  setClipTrim: (trim: ClipTrimState | null) => void;
  toggleSnap: () => void;
  setSnapLine: (time: Microseconds | null) => void;
}

export function createTimelineStore() {
  return createStore<TimelineState>()((set) => ({
    pxPerSecond: DEFAULT_PX_PER_SECOND,
    draggingAssetId: null,
    selectedClipId: null,
    clipDrag: null,
    clipTrim: null,
    snapEnabled: true,
    snapLine: null,
    setDraggingAssetId: (assetId) => {
      set({ draggingAssetId: assetId });
    },
    selectClip: (clipId) => {
      set({ selectedClipId: clipId });
    },
    setClipDrag: (drag) => {
      set({ clipDrag: drag });
    },
    setClipTrim: (trim) => {
      set({ clipTrim: trim });
    },
    toggleSnap: () => {
      set((state) => ({ snapEnabled: !state.snapEnabled }));
    },
    setSnapLine: (time) => {
      set({ snapLine: time });
    },
  }));
}

export const timelineStore = createTimelineStore();

export function useTimelineStore<T>(selector: (state: TimelineState) => T): T {
  return useStore(timelineStore, selector);
}
