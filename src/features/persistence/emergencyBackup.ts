import { toPersisted } from '@/core/persistence/persistedProject.ts';
import type { Project } from '@/core/project.ts';

/**
 * 탭을 닫거나 새로고침할 때를 위한 동기 백업.
 * IndexedDB 저장은 비동기라 페이지가 내려가는 중에 시작하면 끝나기 전에 중단될 수 있다.
 * localStorage는 동기적으로 쓰이므로 아직 저장되지 않은 마지막 편집을 여기에 남기고,
 * 다음 시작 때 IndexedDB 저장본보다 최신이면 이것을 복원한다. (Project JSON은 수십 KB 수준)
 */
export interface EmergencyBackup {
  write: (project: Project) => void;
  read: () => unknown;
  clear: () => void;
}

const BACKUP_KEY = 'mini-video-editor:backup';

/** localStorage에 접근할 수 없으면(일부 iframe·보안 설정에서는 접근 자체가 예외를 던진다) null */
function getLocalStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export function createLocalStorageBackup(
  storage: Storage | null = getLocalStorage(),
  now: () => number = () => Date.now(),
): EmergencyBackup {
  return {
    write: (project) => {
      try {
        storage?.setItem(BACKUP_KEY, JSON.stringify(toPersisted(project, now())));
      } catch (error) {
        console.error('Failed to write emergency backup', error);
      }
    },
    read: () => {
      try {
        const value = storage?.getItem(BACKUP_KEY);
        return value ? (JSON.parse(value) as unknown) : null;
      } catch {
        return null;
      }
    },
    clear: () => {
      try {
        storage?.removeItem(BACKUP_KEY);
      } catch {
        // 저장소에 접근할 수 없으면 지울 것도 없다
      }
    },
  };
}
