import { createRemoveItemCommand } from '@/core/commands/removeItem.ts';
import { buildSplitCommand } from '@/core/commands/splitItem.ts';
import { playbackStore } from '@/store/playbackStore.ts';
import { projectStore } from '@/store/projectStore.ts';
import { timelineStore } from '@/store/timelineStore.ts';

/**
 * 툴바 버튼과 단축키가 함께 쓰는 편집 동작. 실행했으면 true.
 */

/** 플레이헤드 위치에서 자르기 (선택한 항목 우선, 없으면 플레이헤드 아래 모든 항목) */
export function splitAtPlayhead(): boolean {
  const { project, dispatch } = projectStore.getState();
  const command = buildSplitCommand(
    project,
    playbackStore.getState().currentTime,
    timelineStore.getState().selectedItemId,
    () => crypto.randomUUID(),
  );
  return command ? dispatch(command) : false;
}

/** 선택한 클립·텍스트 삭제 */
export function deleteSelection(): boolean {
  const { selectedItemId } = timelineStore.getState();
  if (selectedItemId === null) {
    return false;
  }
  const { project, dispatch } = projectStore.getState();
  const command = createRemoveItemCommand(project, selectedItemId);
  return command ? dispatch(command) : false;
}
