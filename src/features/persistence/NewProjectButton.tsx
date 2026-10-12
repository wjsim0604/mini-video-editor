import { startNewProject } from './session.ts';

/** 저장본과 원본 파일을 지우고 빈 프로젝트로 시작한다 (되돌릴 수 없으므로 확인을 받는다) */
export function NewProjectButton() {
  return (
    <button
      type="button"
      className="rounded px-2 py-1 text-xs text-neutral-300 hover:bg-neutral-800"
      onClick={() => {
        if (
          window.confirm(
            '현재 프로젝트와 가져온 파일을 지우고 새 프로젝트를 시작할까요?\n이 작업은 되돌릴 수 없습니다.',
          )
        ) {
          void startNewProject();
        }
      }}
    >
      새 프로젝트
    </button>
  );
}
