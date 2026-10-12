import { useEffect } from 'react';
import { playbackEngine } from '@/features/preview/playback.ts';
import { deleteSelection, splitAtPlayhead } from '@/features/timeline/actions.ts';
import { projectStore } from '@/store/projectStore.ts';
import { isEditInProgress, timelineStore } from '@/store/timelineStore.ts';
import {
  isTypingTarget,
  resolveShortcut,
  worksWhileTyping,
  type ShortcutAction,
} from './keymap.ts';

function run(action: ShortcutAction): void {
  switch (action) {
    case 'undo':
      projectStore.getState().undo();
      return;
    case 'redo':
      projectStore.getState().redo();
      return;
    case 'togglePlay':
      playbackEngine.toggle();
      return;
    case 'delete':
      deleteSelection();
      return;
    case 'split':
      splitAtPlayhead();
      return;
  }
}

/**
 * 앱 전역 단축키.
 * - undo/redo는 입력칸에서도 앱 히스토리를 대상으로 한다 (입력값이 store와 연결되어 있어 브라우저 undo와 섞이면 어긋난다)
 * - Space·Delete·S는 입력칸에서는 글자 입력이므로 가로채지 않는다
 * - 한글 조합 중, 키를 누르고 있어 반복되는 입력(undo/redo 제외), 드래그·트리밍 중에는 무시한다
 */
export function useGlobalShortcuts(): void {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.isComposing) {
        return;
      }
      const action = resolveShortcut(event);
      if (!action || (!worksWhileTyping(action) && isTypingTarget(event.target))) {
        return;
      }
      // 포커스된 버튼에서 Space가 버튼 클릭으로도 처리되는 것과 페이지 스크롤을 막는다
      event.preventDefault();
      if (event.repeat && !worksWhileTyping(action)) {
        return;
      }
      if (isEditInProgress(timelineStore.getState())) {
        return;
      }
      run(action);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);
}
