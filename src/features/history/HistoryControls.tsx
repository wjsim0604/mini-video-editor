import { projectStore, useProjectStore } from '@/store/projectStore.ts';

const BUTTON_CLASS =
  'flex h-7 w-7 items-center justify-center rounded text-neutral-300 hover:bg-neutral-800 disabled:text-neutral-600 disabled:hover:bg-transparent';

/** 헤더의 실행 취소/다시 실행 버튼. 툴팁에 대상 편집 이름을 보여준다 */
export function HistoryControls() {
  const undoLabel = useProjectStore((state) => state.past.at(-1)?.label ?? null);
  const redoLabel = useProjectStore((state) => state.future.at(-1)?.label ?? null);

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        aria-label="실행 취소"
        title={undoLabel ? `실행 취소: ${undoLabel} (Ctrl/Cmd+Z)` : '실행 취소할 편집이 없습니다'}
        disabled={undoLabel === null}
        className={BUTTON_CLASS}
        onClick={() => {
          projectStore.getState().undo();
        }}
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 16 16"
          className="h-4 w-4 fill-none stroke-current"
          strokeWidth="1.5"
        >
          <path d="M5 4L2 7l3 3M2 7h7.5a4 4 0 0 1 0 8H7" />
        </svg>
      </button>
      <button
        type="button"
        aria-label="다시 실행"
        title={
          redoLabel ? `다시 실행: ${redoLabel} (Shift+Ctrl/Cmd+Z)` : '다시 실행할 편집이 없습니다'
        }
        disabled={redoLabel === null}
        className={BUTTON_CLASS}
        onClick={() => {
          projectStore.getState().redo();
        }}
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 16 16"
          className="h-4 w-4 fill-none stroke-current"
          strokeWidth="1.5"
        >
          <path d="M11 4l3 3-3 3M14 7H6.5a4 4 0 0 0 0 8H9" />
        </svg>
      </button>
    </div>
  );
}
