import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';

export type ExportState =
  | { status: 'idle' }
  | { status: 'running'; frame: number; total: number; elapsedMs: number }
  | {
      status: 'done';
      blob: Blob;
      fileName: string;
      codec: string;
      codecLabel: string;
      elapsedMs: number;
    }
  | { status: 'cancelled' }
  | { status: 'error'; message: string };

export const exportStore = createStore<{ state: ExportState }>()(() => ({
  state: { status: 'idle' },
}));

export function useExportState(): ExportState {
  return useStore(exportStore, (store) => store.state);
}

export function isExporting(): boolean {
  return exportStore.getState().state.status === 'running';
}
