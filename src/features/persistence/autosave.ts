import { toPersisted } from '@/core/persistence/persistedProject.ts';
import type { Project } from '@/core/project.ts';
import type { ProjectRepository } from '@/lib/projectRepository.ts';
import type { SaveStatus } from '@/store/saveStatusStore.ts';

export interface AutosaveOptions {
  repository: ProjectRepository;
  getProject: () => Project;
  /** Project가 바뀔 때 호출되는 구독. 해제 함수를 반환한다 */
  subscribe: (listener: () => void) => () => void;
  onStatus: (status: SaveStatus) => void;
  debounceMs?: number;
  now?: () => number;
}

export interface Autosave {
  /** 대기 중인 저장을 즉시 실행한다 (탭을 숨기거나 닫을 때) */
  flush: () => Promise<void>;
  /** 아직 저장소에 쓰지 않은 변경이 있는지 */
  hasPendingChanges: () => boolean;
  dispose: () => void;
}

export const AUTOSAVE_DEBOUNCE_MS = 500;

/**
 * Project가 바뀌면 debounceMs 뒤에 저장한다. 연속 편집은 한 번의 저장으로 합쳐진다.
 * 저장은 순서대로 하나씩 실행해, 늦게 끝난 이전 저장이 최신 저장을 덮어쓰지 않게 한다.
 */
export function createAutosave(options: AutosaveOptions): Autosave {
  const { repository, getProject, onStatus } = options;
  const debounceMs = options.debounceMs ?? AUTOSAVE_DEBOUNCE_MS;
  const now = options.now ?? (() => Date.now());
  let timer: ReturnType<typeof setTimeout> | null = null;
  let dirty = false;
  let lastSavedAt: number | null = null;
  let queue: Promise<void> = Promise.resolve();
  // await 동안 새 편집으로 바뀔 수 있다 (TS의 좁히기는 await 너머의 변경을 모르므로 함수로 읽는다)
  const isDirty = () => dirty;

  const save = async () => {
    if (!dirty) {
      return;
    }
    dirty = false;
    const project = getProject();
    onStatus({ state: 'saving', savedAt: lastSavedAt, message: null });
    try {
      const at = now();
      await repository.saveProject(toPersisted(project, at));
      lastSavedAt = at;
      onStatus({ state: isDirty() ? 'saving' : 'saved', savedAt: at, message: null });
    } catch (error) {
      console.error('Autosave failed', error);
      dirty = true;
      onStatus({ state: 'error', savedAt: lastSavedAt, message: describeSaveError(error) });
    }
  };

  const flush = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    queue = queue.then(save);
    return queue;
  };

  const unsubscribe = options.subscribe(() => {
    dirty = true;
    if (timer !== null) {
      clearTimeout(timer);
    }
    timer = setTimeout(() => {
      timer = null;
      void flush();
    }, debounceMs);
  });

  return {
    flush,
    hasPendingChanges: isDirty,
    dispose: () => {
      unsubscribe();
      if (timer !== null) {
        clearTimeout(timer);
      }
    },
  };
}

/** 저장 실패 이유를 사용자에게 보여줄 문장으로 */
export function describeSaveError(error: unknown): string {
  if (error instanceof DOMException && error.name === 'QuotaExceededError') {
    return '브라우저 저장 공간이 부족합니다';
  }
  return '저장하지 못했습니다';
}
