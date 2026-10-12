import { exportFileName } from '@/core/export/exportPlan.ts';
import { exportVideo, ExportUnsupportedError } from '@/engine/export/exportVideo.ts';
import { playbackEngine } from '@/features/preview/playback.ts';
import { mediaStore } from '@/store/mediaStore.ts';
import { projectStore } from '@/store/projectStore.ts';
import { exportStore, isExporting } from './exportStore.ts';

let controller: AbortController | null = null;

/** 다운로드가 시작될 때까지 object URL을 유지할 시간 */
const REVOKE_DELAY_MS = 10_000;

/**
 * 결과 파일을 내려받는다. 링크를 문서에 잠시 붙여 클릭해야 브라우저가 download 속성(파일 이름)을 적용하고,
 * URL을 바로 해제하면 다운로드가 시작되기 전에 무효가 될 수 있어 조금 뒤에 해제한다.
 */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.style.display = 'none';
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, REVOKE_DELAY_MS);
}

/** 현재 Project를 내보낸다. 재생을 멈추고, 시작 시점의 Project를 고정해 쓴다 */
export async function startExport(now: () => number = () => performance.now()): Promise<void> {
  if (isExporting()) {
    return;
  }
  playbackEngine.pause();
  const project = projectStore.getState().project;
  controller = new AbortController();
  const startedAt = now();
  exportStore.setState({ state: { status: 'running', frame: 0, total: 0, elapsedMs: 0 } });

  try {
    const result = await exportVideo({
      project,
      getFile: (assetId) => mediaStore.getState().entries[assetId]?.file,
      signal: controller.signal,
      onProgress: ({ frame, total }) => {
        // 경과 시간은 렌더 중이 아니라 여기서 계산한다 (렌더는 순수해야 한다)
        exportStore.setState({
          state: { status: 'running', frame, total, elapsedMs: now() - startedAt },
        });
      },
    });
    const fileName = exportFileName(project.name);
    exportStore.setState({
      state: {
        status: 'done',
        blob: result.blob,
        fileName,
        codec: result.codec,
        codecLabel: result.codecLabel,
        elapsedMs: now() - startedAt,
      },
    });
    downloadBlob(result.blob, fileName);
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      exportStore.setState({ state: { status: 'cancelled' } });
    } else {
      console.error('Export failed', error);
      exportStore.setState({
        state: {
          status: 'error',
          message:
            error instanceof ExportUnsupportedError
              ? error.message
              : '내보내는 중 오류가 발생했습니다',
        },
      });
    }
  } finally {
    controller = null;
  }
}

export function cancelExport(): void {
  controller?.abort();
}

/** 완료·취소·오류 창을 닫는다 (결과 Blob 참조도 놓아 메모리를 돌려준다) */
export function closeExportDialog(): void {
  if (!isExporting()) {
    exportStore.setState({ state: { status: 'idle' } });
  }
}
