import { useEffect, useRef } from 'react';
import { estimateRemainingMs } from '@/core/export/exportPlan.ts';
import { useExportState } from './exportStore.ts';
import { downloadBlob } from '@/lib/download.ts';
import { cancelExport, closeExportDialog } from './runExport.ts';

function formatSeconds(ms: number): string {
  const seconds = Math.ceil(ms / 1000);
  return seconds >= 60
    ? `${String(Math.floor(seconds / 60))}분 ${String(seconds % 60)}초`
    : `${String(seconds)}초`;
}

function formatSize(bytes: number): string {
  return bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)}MB`
    : `${String(Math.max(1, Math.round(bytes / 1024)))}KB`;
}

const BUTTON_CLASS = 'rounded px-3 py-1.5 text-xs';

/**
 * 내보내기 진행 창. 내보내는 동안에는 편집을 막는 모달이며(Esc로 닫히지 않는다), 취소만 할 수 있다.
 */
export function ExportDialog() {
  const state = useExportState();
  const primaryRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    primaryRef.current?.focus();
  }, [state.status]);

  if (state.status === 'idle') {
    return null;
  }

  const percent =
    state.status === 'running' && state.total > 0
      ? Math.floor((state.frame / state.total) * 100)
      : 0;
  const remaining =
    state.status === 'running'
      ? estimateRemainingMs(state.frame, state.total, state.elapsedMs)
      : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-dialog-title"
        className="w-96 space-y-4 rounded-lg border border-neutral-700 bg-neutral-900 p-5 text-sm shadow-xl"
      >
        <h2 id="export-dialog-title" className="font-semibold">
          {state.status === 'running' && 'MP4로 내보내는 중'}
          {state.status === 'done' && '내보내기 완료'}
          {state.status === 'cancelled' && '내보내기를 취소했습니다'}
          {state.status === 'error' && '내보내기 실패'}
        </h2>

        {state.status === 'running' && (
          <div className="space-y-2">
            <div
              role="progressbar"
              aria-label="내보내기 진행률"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={percent}
              className="h-2 overflow-hidden rounded bg-neutral-800"
            >
              <div
                className="h-full bg-sky-500 transition-[width]"
                style={{ width: `${String(percent)}%` }}
              />
            </div>
            <p className="flex justify-between text-xs text-neutral-400 tabular-nums">
              <span>
                {state.frame} / {state.total} 프레임 ({percent}%)
              </span>
              <span>
                {remaining === null ? '남은 시간 계산 중…' : `약 ${formatSeconds(remaining)} 남음`}
              </span>
            </p>
          </div>
        )}

        {state.status === 'done' && (
          <div className="space-y-1 text-xs text-neutral-300">
            <p>
              {state.fileName} · {formatSize(state.blob.size)} · {state.codecLabel} ·{' '}
              {formatSeconds(state.elapsedMs)} 걸림
            </p>
            {state.codec !== 'avc' && (
              <p className="text-amber-400">
                이 브라우저에서는 H.264 인코더를 쓸 수 없어 {state.codecLabel}로 내보냈습니다. 일부
                플레이어(QuickTime 등)에서는 재생되지 않을 수 있습니다.
              </p>
            )}
          </div>
        )}

        {state.status === 'error' && <p className="text-xs text-red-400">{state.message}</p>}

        <div className="flex justify-end gap-2">
          {state.status === 'running' ? (
            <button
              ref={primaryRef}
              type="button"
              className={`${BUTTON_CLASS} bg-neutral-800 hover:bg-neutral-700`}
              onClick={cancelExport}
            >
              취소
            </button>
          ) : (
            <>
              {state.status === 'done' && (
                <button
                  type="button"
                  className={`${BUTTON_CLASS} text-neutral-300 hover:bg-neutral-800`}
                  onClick={() => {
                    downloadBlob(state.blob, state.fileName);
                  }}
                >
                  다시 받기
                </button>
              )}
              <button
                ref={primaryRef}
                type="button"
                className={`${BUTTON_CLASS} bg-neutral-800 hover:bg-neutral-700`}
                onClick={closeExportDialog}
              >
                닫기
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
