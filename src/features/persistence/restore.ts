import { pickLatestRecord, toPersisted } from '@/core/persistence/persistedProject.ts';
import type { Project } from '@/core/project.ts';
import type { ProjectRepository } from '@/lib/projectRepository.ts';

export interface RestoreDeps {
  repository: ProjectRepository;
  /** 페이지를 떠날 때 남긴 동기 백업. IndexedDB 저장본보다 최신이면 이것을 복원한다 */
  backup?: { read: () => unknown; clear: () => void };
  /** 원본 파일과 썸네일을 등록한다 (mediaStore) */
  registerMedia: (assetId: string, file: File, thumbnail: Blob) => void;
  /** 복원한 Project로 교체한다 (히스토리 초기화) */
  loadProject: (project: Project) => void;
}

export type RestoreResult =
  | { status: 'empty' }
  | { status: 'invalid' }
  | { status: 'restored'; project: Project; missingAssetIds: string[] };

/**
 * 마지막 프로젝트를 복원한다.
 * - IndexedDB 저장본과 비상 백업 중 유효하고 더 최근인 것을 고른다. 백업이 이기면 IndexedDB에도 다시 저장한다
 * - 저장본이 없으면 empty, 형식이 깨졌거나 알 수 없는 버전이면 invalid (빈 프로젝트로 시작, 저장본은 지우지 않는다)
 * - 원본 파일을 먼저 등록한 뒤 Project를 교체해, 화면이 그려질 때 파일이 이미 준비되어 있게 한다
 * - Project가 참조하지 않는 원본 파일(예: undo된 가져오기)은 지운다. 히스토리는 복원하지 않으므로 다시 필요해질 일이 없다
 */
export async function restoreSession(deps: RestoreDeps): Promise<RestoreResult> {
  const stored = await deps.repository.loadLastProject();
  const backup = deps.backup?.read() ?? null;
  const latest = pickLatestRecord([stored, backup]);
  if (!latest) {
    if (stored === null && backup === null) {
      return { status: 'empty' };
    }
    console.warn('Saved project is invalid or from an unknown version; starting a new project');
    return { status: 'invalid' };
  }
  const { project } = latest;
  if (latest.index === 1) {
    // 마지막 편집이 백업에만 남아 있었다: IndexedDB에 옮겨 둔다
    await deps.repository.saveProject(toPersisted(project, latest.savedAt));
  }
  deps.backup?.clear();

  const assetIds = project.assets.map((asset) => asset.id);
  const media = await deps.repository.loadMedia(assetIds);
  for (const item of media) {
    deps.registerMedia(
      item.assetId,
      new File([item.blob], item.name, { type: item.type }),
      item.thumbnail,
    );
  }
  deps.loadProject(project);
  await deps.repository.deleteMediaExcept(new Set(assetIds));

  const restored = new Set(media.map((item) => item.assetId));
  return {
    status: 'restored',
    project,
    missingAssetIds: assetIds.filter((id) => !restored.has(id)),
  };
}
