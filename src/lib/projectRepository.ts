import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { PersistedProject } from '@/core/persistence/persistedProject.ts';

/** IndexedDB에 저장하는 원본 파일과 썸네일 */
export interface StoredMedia {
  assetId: string;
  blob: Blob;
  name: string;
  type: string;
  thumbnail: Blob;
}

/**
 * 저장소 인터페이스. 앱은 이 인터페이스만 알고, 실제 구현(IndexedDB/메모리)은 바꿔 끼울 수 있다.
 * 프로젝트는 검증 전의 원시 값(unknown)으로 돌려준다: 저장소 데이터는 손상되었거나 이전 버전일 수 있다.
 */
export interface ProjectRepository {
  /** 프로젝트를 저장하고 "마지막 프로젝트"로 표시한다 */
  saveProject(record: PersistedProject): Promise<void>;
  loadLastProject(): Promise<unknown>;
  saveMedia(media: StoredMedia): Promise<void>;
  loadMedia(assetIds: readonly string[]): Promise<StoredMedia[]>;
  /** keep에 없는 원본 파일을 지우고 지운 개수를 반환한다 */
  deleteMediaExcept(keep: ReadonlySet<string>): Promise<number>;
  clear(): Promise<void>;
}

const LAST_PROJECT_KEY = 'lastProjectId';

interface EditorDB extends DBSchema {
  projects: { key: string; value: PersistedProject };
  media: { key: string; value: StoredMedia };
  meta: { key: string; value: string };
}

export function createIndexedDbRepository(name = 'mini-video-editor'): ProjectRepository {
  let database: Promise<IDBPDatabase<EditorDB>> | null = null;
  const db = () => {
    database ??= openDB<EditorDB>(name, 1, {
      upgrade(upgradeDb) {
        upgradeDb.createObjectStore('projects');
        upgradeDb.createObjectStore('media', { keyPath: 'assetId' });
        upgradeDb.createObjectStore('meta');
      },
    });
    return database;
  };

  return {
    async saveProject(record) {
      const tx = (await db()).transaction(['projects', 'meta'], 'readwrite');
      await Promise.all([
        tx.objectStore('projects').put(record, record.project.id),
        tx.objectStore('meta').put(record.project.id, LAST_PROJECT_KEY),
        tx.done,
      ]);
    },
    async loadLastProject() {
      const handle = await db();
      const lastId = await handle.get('meta', LAST_PROJECT_KEY);
      return lastId === undefined ? null : ((await handle.get('projects', lastId)) ?? null);
    },
    async saveMedia(media) {
      await (await db()).put('media', media);
    },
    async loadMedia(assetIds) {
      const handle = await db();
      const found = await Promise.all(assetIds.map((id) => handle.get('media', id)));
      return found.filter((media) => media !== undefined);
    },
    async deleteMediaExcept(keep) {
      const tx = (await db()).transaction('media', 'readwrite');
      let deleted = 0;
      for (const key of await tx.store.getAllKeys()) {
        if (!keep.has(key)) {
          await tx.store.delete(key);
          deleted++;
        }
      }
      await tx.done;
      return deleted;
    },
    async clear() {
      const tx = (await db()).transaction(['projects', 'media', 'meta'], 'readwrite');
      await Promise.all([
        tx.objectStore('projects').clear(),
        tx.objectStore('media').clear(),
        tx.objectStore('meta').clear(),
        tx.done,
      ]);
    },
  };
}

/** 테스트와 IndexedDB를 쓸 수 없는 환경(일부 시크릿 모드 등)을 위한 메모리 구현 */
export function createMemoryRepository(): ProjectRepository & {
  readonly media: Map<string, StoredMedia>;
} {
  const projects = new Map<string, PersistedProject>();
  const media = new Map<string, StoredMedia>();
  let lastProjectId: string | null = null;

  return {
    media,
    saveProject(record) {
      // 실제 저장소처럼 복사본을 보관해 이후 변경이 저장본에 섞이지 않게 한다
      projects.set(record.project.id, structuredClone(record));
      lastProjectId = record.project.id;
      return Promise.resolve();
    },
    loadLastProject() {
      return Promise.resolve(lastProjectId === null ? null : (projects.get(lastProjectId) ?? null));
    },
    saveMedia(item) {
      media.set(item.assetId, item);
      return Promise.resolve();
    },
    loadMedia(assetIds) {
      return Promise.resolve(
        assetIds.flatMap((id) => {
          const item = media.get(id);
          return item ? [item] : [];
        }),
      );
    },
    deleteMediaExcept(keep) {
      let deleted = 0;
      for (const id of [...media.keys()]) {
        if (!keep.has(id)) {
          media.delete(id);
          deleted++;
        }
      }
      return Promise.resolve(deleted);
    },
    clear() {
      projects.clear();
      media.clear();
      lastProjectId = null;
      return Promise.resolve();
    },
  };
}

/** IndexedDB를 쓸 수 있으면 IndexedDB, 아니면 메모리 저장소 */
export function createDefaultRepository(): ProjectRepository {
  return typeof indexedDB === 'undefined' ? createMemoryRepository() : createIndexedDbRepository();
}
