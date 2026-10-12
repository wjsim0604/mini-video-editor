import { CircleAlert, CircleCheck, Download, LoaderCircle, TriangleAlert } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert.tsx';
import { Button } from '@/components/ui/button.tsx';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog.tsx';
import { Progress } from '@/components/ui/progress.tsx';
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

/**
 * 내보내기 진행 창 (shadcn Dialog). 내보내는 동안에는 편집을 막는 모달이며
 * Esc·바깥 클릭으로 닫히지 않고 취소만 할 수 있다. 끝난 뒤에는 Esc로도 닫힌다.
 */
export function ExportDialog() {
  const state = useExportState();
  const primaryRef = useRef<HTMLButtonElement>(null);
  const isRunning = state.status === 'running';

  // 진행 중 → 완료처럼 상태가 바뀌면 취소 버튼이 사라지므로 새 기본 버튼으로 포커스를 옮긴다
  useEffect(() => {
    primaryRef.current?.focus();
  }, [state.status]);

  const percent =
    state.status === 'running' && state.total > 0
      ? Math.floor((state.frame / state.total) * 100)
      : 0;
  const remaining =
    state.status === 'running'
      ? estimateRemainingMs(state.frame, state.total, state.elapsedMs)
      : null;

  return (
    <Dialog
      open={state.status !== 'idle'}
      onOpenChange={(open) => {
        if (!open && !isRunning) {
          closeExportDialog();
        }
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="sm:max-w-md"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          primaryRef.current?.focus();
        }}
        onEscapeKeyDown={(event) => {
          if (isRunning) {
            event.preventDefault();
          }
        }}
        onInteractOutside={(event) => {
          event.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {state.status === 'running' && (
              <>
                <LoaderCircle aria-hidden="true" className="size-4 animate-spin text-primary" />
                MP4로 내보내는 중
              </>
            )}
            {state.status === 'done' && (
              <>
                <CircleCheck aria-hidden="true" className="size-4 text-primary" />
                내보내기 완료
              </>
            )}
            {state.status === 'cancelled' && '내보내기를 취소했습니다'}
            {state.status === 'error' && (
              <>
                <CircleAlert aria-hidden="true" className="size-4 text-destructive" />
                내보내기 실패
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {state.status === 'running' && '1920×1080 · 30fps · 소리 없음'}
            {state.status === 'done' &&
              `${state.fileName} · ${formatSize(state.blob.size)} · ${state.codecLabel} · ${formatSeconds(state.elapsedMs)} 걸림`}
            {state.status === 'cancelled' && '파일을 만들지 않았습니다.'}
            {state.status === 'error' && state.message}
          </DialogDescription>
        </DialogHeader>

        {state.status === 'running' && (
          <div className="space-y-2">
            <Progress value={percent} aria-label="내보내기 진행률" />
            <p className="flex justify-between text-xs text-muted-foreground tabular-nums">
              <span>
                {state.frame} / {state.total} 프레임 ({percent}%)
              </span>
              <span>
                {remaining === null ? '남은 시간 계산 중…' : `약 ${formatSeconds(remaining)} 남음`}
              </span>
            </p>
          </div>
        )}

        {state.status === 'done' && state.codec !== 'avc' && (
          <Alert variant="warning">
            <TriangleAlert />
            <AlertDescription>
              이 브라우저에서는 H.264 인코더를 쓸 수 없어 {state.codecLabel}로 내보냈습니다. 일부
              플레이어(QuickTime 등)에서는 재생되지 않을 수 있습니다.
            </AlertDescription>
          </Alert>
        )}

        <DialogFooter>
          {isRunning ? (
            <Button ref={primaryRef} variant="outline" onClick={cancelExport}>
              취소
            </Button>
          ) : (
            <>
              {state.status === 'done' && (
                <Button
                  variant="ghost"
                  onClick={() => {
                    downloadBlob(state.blob, state.fileName);
                  }}
                >
                  <Download />
                  다시 받기
                </Button>
              )}
              <Button ref={primaryRef} onClick={closeExportDialog}>
                닫기
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
