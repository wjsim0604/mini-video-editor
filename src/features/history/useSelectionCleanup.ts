import { useEffect } from 'react';
import { findItem } from '@/core/timelineItem.ts';
import { projectStore } from '@/store/projectStore.ts';
import { timelineStore } from '@/store/timelineStore.ts';

/** undo 등으로 선택한 항목이 Project에서 사라지면 선택을 해제한다 */
export function useSelectionCleanup(): void {
  useEffect(
    () =>
      projectStore.subscribe((state, previous) => {
        if (state.project === previous.project) {
          return;
        }
        const { selectedItemId, selectItem } = timelineStore.getState();
        if (selectedItemId !== null && !findItem(state.project, selectedItemId)) {
          selectItem(null);
        }
      }),
    [],
  );
}
