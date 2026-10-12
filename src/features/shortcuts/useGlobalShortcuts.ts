import { useEffect } from 'react';
import { projectStore } from '@/store/projectStore.ts';
import { isEditInProgress, timelineStore } from '@/store/timelineStore.ts';
import { resolveShortcut } from './keymap.ts';

/**
 * 앱 전역 단축키. undo/redo는 입력칸에 포커스가 있어도 앱 히스토리를 대상으로 한다
 * (입력칸 값이 store와 연결되어 있어 브라우저 기본 undo와 섞이면 값이 어긋난다).
 * 드래그·트리밍 중에는 미리보기 상태와 어긋나지 않도록 무시한다.
 */
export function useGlobalShortcuts(): void {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const action = resolveShortcut(event);
      if (!action) {
        return;
      }
      event.preventDefault();
      if (isEditInProgress(timelineStore.getState())) {
        return;
      }
      if (action === 'undo') {
        projectStore.getState().undo();
      } else {
        projectStore.getState().redo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);
}
