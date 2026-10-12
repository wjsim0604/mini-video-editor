import { projectDuration } from '@/core/composition.ts';
import { useProjectStore } from '@/store/projectStore.ts';
import { useExportState } from './exportStore.ts';
import { startExport } from './runExport.ts';

export function ExportButton() {
  const isEmpty = useProjectStore((state) => projectDuration(state.project) === 0);
  const isRunning = useExportState().status === 'running';

  return (
    <button
      type="button"
      disabled={isEmpty || isRunning}
      title={isEmpty ? '내보낼 클립이 없습니다' : '프로젝트를 MP4 영상으로 내보내기 (소리 없음)'}
      className="rounded bg-sky-600 px-3 py-1 text-xs font-medium text-white hover:bg-sky-500 disabled:bg-neutral-800 disabled:text-neutral-500"
      onClick={() => {
        void startExport();
      }}
    >
      내보내기
    </button>
  );
}
