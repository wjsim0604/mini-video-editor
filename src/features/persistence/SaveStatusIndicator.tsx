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

  return (
    <p
      role="status"
      title={title}
      className={`text-xs ${state === 'error' ? 'text-red-400' : 'text-neutral-500'}`}
    >
      {LABEL[state]}
    </p>
  );
}
