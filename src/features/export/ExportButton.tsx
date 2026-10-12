import { useEffect, useState } from 'react';
import { projectDuration } from '@/core/composition.ts';
import { checkExportSupport } from '@/engine/export/codec.ts';
import { useProjectStore } from '@/store/projectStore.ts';
import { useExportState } from './exportStore.ts';
import { startExport } from './runExport.ts';

export function ExportButton() {
  const isEmpty = useProjectStore((state) => projectDuration(state.project) === 0);
  const isRunning = useExportState().status === 'running';
  // 확인이 끝나기 전에는 켜 둔다 (실제 내보내기도 시작할 때 다시 확인한다)
  const [supported, setSupported] = useState(true);
  useEffect(() => {
    let active = true;
    void checkExportSupport().then((result) => {
      if (active) {
        setSupported(result);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <button
      type="button"
      disabled={isEmpty || isRunning || !supported}
      title={
        !supported
          ? '이 브라우저는 영상 인코딩(WebCodecs)을 지원하지 않아 내보낼 수 없습니다'
          : isEmpty
            ? '내보낼 클립이 없습니다'
            : '프로젝트를 MP4 영상으로 내보내기 (소리 없음)'
      }
      className="rounded bg-sky-600 px-3 py-1 text-xs font-medium text-white hover:bg-sky-500 disabled:bg-neutral-800 disabled:text-neutral-500"
      onClick={() => {
        void startExport();
      }}
    >
      내보내기
    </button>
  );
}
