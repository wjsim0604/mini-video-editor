import { createEmptyProject } from '@/core/project.ts';
import { playbackEngine } from '@/features/preview/playback.ts';
import { createDefaultRepository, type ProjectRepository } from '@/lib/projectRepository.ts';
import { mediaStore } from '@/store/mediaStore.ts';
import { projectStore } from '@/store/projectStore.ts';
import { saveStatusStore } from '@/store/saveStatusStore.ts';
import { timelineStore } from '@/store/timelineStore.ts';
import { createAutosave, describeSaveError, type Autosave } from './autosave.ts';
import { createLocalStorageBackup } from './emergencyBackup.ts';
import { restoreSession, type RestoreResult } from './restore.ts';

// 앱 전체에서 하나의 저장 세션을 쓴다. 저장소 구현과 store를 여기서만 연결한다.

export const repository: ProjectRepository = createDefaultRepository();
const backup = createLocalStorageBackup();
let autosave: Autosave | null = null;

/** 가져오기에 성공한 원본 파일과 썸네일을 저장한다. 실패해도 편집은 계속할 수 있다 */
export async function persistMedia(assetId: string, file: File, thumbnail: Blob): Promise<void> {
  try {
    await repository.saveMedia({
      assetId,
      blob: file,
      name: file.name,
      type: file.type,
      thumbnail,
    });
  } catch (error) {
    console.error(`Failed to store media for ${assetId}`, error);
    saveStatusStore.setState({
      state: 'error',
      message: `${file.name}: ${describeSaveError(error)} (새로고침 후 복원되지 않습니다)`,
    });
  }
}

/**
 * 시작 시 한 번 호출한다: 마지막 프로젝트 복원 → 자동 저장 시작 → 탭을 숨기거나 닫을 때 즉시 저장.
 * 복원이 끝나기 전에는 편집기를 보여주지 않아, 복원 전 편집이 저장본을 덮어쓰지 않게 한다.
 */
export async function startPersistence(): Promise<RestoreResult> {
  // 브라우저가 공간이 부족할 때 데이터를 지우지 않도록 영구 저장을 요청한다 (거절되어도 동작한다)
  // 오래된 브라우저·테스트 환경에는 navigator.storage가 없으므로 선택적 타입으로 다룬다
  const storage: Partial<StorageManager> | undefined = (navigator as Partial<Navigator>).storage;
  void storage?.persist?.().catch(() => false);

  let result: RestoreResult;
  try {
    result = await restoreSession({
      repository,
      backup,
      registerMedia: (assetId, file, thumbnail) => {
        mediaStore.getState().register(assetId, file, thumbnail);
      },
      loadProject: (project) => {
        projectStore.getState().loadProject(project);
      },
    });
  } catch (error) {
    console.error('Failed to restore the last project', error);
    result = { status: 'invalid' };
  }

  autosave = createAutosave({
    repository,
    getProject: () => projectStore.getState().project,
    subscribe: (listener) =>
      projectStore.subscribe((state, previous) => {
        if (state.project !== previous.project) {
          listener();
        }
      }),
    onStatus: (status) => {
      saveStatusStore.setState(status);
    },
  });
  const flushNow = () => {
    // 페이지가 내려가는 중에는 비동기 IndexedDB 저장이 끝나지 못할 수 있어, 동기 백업을 먼저 남긴다
    if (autosave?.hasPendingChanges()) {
      backup.write(projectStore.getState().project);
    }
    void autosave?.flush();
  };
  window.addEventListener('pagehide', flushNow);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      flushNow();
    }
  });
  return result;
}

/** 저장본과 원본 파일을 지우고 빈 프로젝트로 시작한다 */
export async function startNewProject(): Promise<void> {
  playbackEngine.pause();
  await autosave?.flush();
  await repository.clear();
  backup.clear();
  mediaStore.getState().releaseAll();
  timelineStore.getState().selectItem(null);
  projectStore.getState().loadProject(createEmptyProject(crypto.randomUUID(), '새 프로젝트'));
  playbackEngine.seek(0);
}
