import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';

/** Project에 넣을 수 없는(직렬화 불가) 에셋의 원본 파일과 썸네일 URL */
export interface MediaEntry {
  file: File;
  thumbnailUrl: string;
}

export interface MediaState {
  entries: Partial<Record<string, MediaEntry>>;
  register: (assetId: string, file: File, thumbnail: Blob) => void;
  release: (assetId: string) => void;
  /** 모든 파일과 썸네일 URL을 해제한다 (새 프로젝트) */
  releaseAll: () => void;
}

export function createMediaStore() {
  return createStore<MediaState>()((set, get) => ({
    entries: {},
    releaseAll: () => {
      for (const entry of Object.values(get().entries)) {
        if (entry) {
          URL.revokeObjectURL(entry.thumbnailUrl);
        }
      }
      set({ entries: {} });
    },
    register: (assetId, file, thumbnail) => {
      get().release(assetId);
      const entry: MediaEntry = { file, thumbnailUrl: URL.createObjectURL(thumbnail) };
      set((state) => ({ entries: { ...state.entries, [assetId]: entry } }));
    },
    release: (assetId) => {
      const entry = get().entries[assetId];
      if (!entry) {
        return;
      }
      URL.revokeObjectURL(entry.thumbnailUrl);
      set((state) => {
        const entries = Object.entries(state.entries).filter(([id]) => id !== assetId);
        return { entries: Object.fromEntries(entries) };
      });
    },
  }));
}

export const mediaStore = createMediaStore();

export function useMediaStore<T>(selector: (state: MediaState) => T): T {
  return useStore(mediaStore, selector);
}
