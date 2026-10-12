import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';

export type SaveState = 'idle' | 'saving' | 'saved' | 'error';

export interface SaveStatus {
  state: SaveState;
  /** 마지막으로 저장에 성공한 시각 */
  savedAt: number | null;
  /** 실패 이유 (사용자에게 보여줄 문장) */
  message: string | null;
}

export const saveStatusStore = createStore<SaveStatus>()(() => ({
  state: 'idle',
  savedAt: null,
  message: null,
}));

export function useSaveStatus<T>(selector: (state: SaveStatus) => T): T {
  return useStore(saveStatusStore, selector);
}
