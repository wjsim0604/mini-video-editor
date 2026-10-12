import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';
import type { Microseconds } from '@/core/time.ts';

/**
 * 재생 상태. currentTime은 재생 중 매 프레임 바뀌므로 React 컴포넌트에서 훅으로 구독하지 말고
 * playbackStore.subscribe로 DOM을 직접 갱신한다 (재생 중 리렌더 최소화).
 */
export interface PlaybackStoreState {
  currentTime: Microseconds;
  isPlaying: boolean;
}

export const playbackStore = createStore<PlaybackStoreState>()(() => ({
  currentTime: 0,
  isPlaying: false,
}));

export function usePlaybackStore<T>(selector: (state: PlaybackStoreState) => T): T {
  return useStore(playbackStore, selector);
}
