import { CircleAlert, Cloud, LoaderCircle } from 'lucide-react';
import { Separator } from '@/components/ui/separator.tsx';
import { cn } from '@/lib/utils.ts';
import { useSaveStatus } from '@/store/saveStatusStore.ts';

const LABEL = {
  idle: '',
  saving: '저장 중…',
  saved: '저장됨',
  error: '저장 실패',
} as const;

/** 헤더의 자동 저장 상태 */
export function SaveStatusIndicator() {
  const state = useSaveStatus((status) => status.state);
  const message = useSaveStatus((status) => status.message);
  const savedAt = useSaveStatus((status) => status.savedAt);

  if (state === 'idle') {
    return null;
  }
  const title =
    state === 'error'
      ? (message ?? undefined)
      : savedAt === null
        ? undefined
        : `마지막 저장: ${new Date(savedAt).toLocaleTimeString()}`;
  const Icon = state === 'error' ? CircleAlert : state === 'saving' ? LoaderCircle : Cloud;

  return (
    <>
      <p
        role="status"
        title={title}
        className={cn(
          'flex items-center gap-1.5 text-xs',
          state === 'error' ? 'text-destructive' : 'text-muted-foreground',
        )}
      >
        <Icon aria-hidden="true" className={cn('size-3.5', state === 'saving' && 'animate-spin')} />
        {LABEL[state]}
      </p>
      <Separator orientation="vertical" className="mx-1 data-[orientation=vertical]:h-5" />
    </>
  );
}
