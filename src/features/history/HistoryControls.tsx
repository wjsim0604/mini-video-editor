import { Redo2, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button.tsx';
import { projectStore, useProjectStore } from '@/store/projectStore.ts';

/** 헤더의 실행 취소/다시 실행 버튼. 툴팁에 대상 편집 이름을 보여준다 */
export function HistoryControls() {
  const undoLabel = useProjectStore((state) => state.past.at(-1)?.label ?? null);
  const redoLabel = useProjectStore((state) => state.future.at(-1)?.label ?? null);

  return (
    <div className="flex items-center gap-0.5">
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="실행 취소"
        title={undoLabel ? `실행 취소: ${undoLabel} (Ctrl/Cmd+Z)` : '실행 취소할 편집이 없습니다'}
        disabled={undoLabel === null}
        onClick={() => {
          projectStore.getState().undo();
        }}
      >
        <Undo2 />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="다시 실행"
        title={
          redoLabel ? `다시 실행: ${redoLabel} (Shift+Ctrl/Cmd+Z)` : '다시 실행할 편집이 없습니다'
        }
        disabled={redoLabel === null}
        onClick={() => {
          projectStore.getState().redo();
        }}
      >
        <Redo2 />
      </Button>
    </div>
  );
}
