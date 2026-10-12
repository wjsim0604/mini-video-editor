import type { Asset, Clip, Project, TextOverlay, Track } from '../project.ts';

/** 저장 형식 버전. 데이터 모델이 바뀌면 올리고 migrate에 변환을 추가한다 */
export const SCHEMA_VERSION = 1;

export interface PersistedProject {
  schemaVersion: number;
  project: Project;
  /** 저장 시각 (Date.now) */
  savedAt: number;
}

export function toPersisted(project: Project, savedAt: number): PersistedProject {
  return { schemaVersion: SCHEMA_VERSION, project, savedAt };
}

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isTime(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isPositive(value: unknown): value is number {
  return isFiniteNumber(value) && value > 0;
}

function isOneOf<T extends string>(value: unknown, options: readonly T[]): value is T {
  return isString(value) && (options as readonly string[]).includes(value);
}

function isTrack(value: unknown): value is Track {
  return (
    isRecord(value) &&
    isString(value['id']) &&
    isOneOf(value['kind'], ['video', 'text', 'audio'] as const) &&
    isFiniteNumber(value['order'])
  );
}

function isAsset(value: unknown): value is Asset {
  return (
    isRecord(value) &&
    isString(value['id']) &&
    isOneOf(value['type'], ['video', 'image', 'audio'] as const) &&
    isString(value['name']) &&
    isTime(value['duration']) &&
    (value['width'] === undefined || isPositive(value['width'])) &&
    (value['height'] === undefined || isPositive(value['height']))
  );
}

function isClip(value: unknown): value is Clip {
  return (
    isRecord(value) &&
    isString(value['id']) &&
    isString(value['assetId']) &&
    isString(value['trackId']) &&
    isTime(value['start']) &&
    isTime(value['inPoint']) &&
    isTime(value['outPoint']) &&
    value['outPoint'] > value['inPoint']
  );
}

function isOverlay(value: unknown): value is TextOverlay {
  if (!isRecord(value) || !isRecord(value['style'])) {
    return false;
  }
  const style = value['style'];
  return (
    isString(value['id']) &&
    isString(value['trackId']) &&
    isTime(value['start']) &&
    isTime(value['duration']) &&
    value['duration'] > 0 &&
    isString(value['text']) &&
    isPositive(style['fontSize']) &&
    isString(style['color']) &&
    isFiniteNumber(style['x']) &&
    isFiniteNumber(style['y'])
  );
}

function isArrayOf<T>(value: unknown, guard: (item: unknown) => item is T): value is T[] {
  return Array.isArray(value) && value.every(guard);
}

/** 형식 검사 + 참조 무결성(클립·텍스트가 가리키는 트랙과 에셋이 존재하는지) */
export function isProject(value: unknown): value is Project {
  if (
    !isRecord(value) ||
    !isString(value['id']) ||
    !isString(value['name']) ||
    !isPositive(value['width']) ||
    !isPositive(value['height']) ||
    !isPositive(value['fps']) ||
    !isArrayOf(value['tracks'], isTrack) ||
    !isArrayOf(value['clips'], isClip) ||
    !isArrayOf(value['overlays'], isOverlay) ||
    !isArrayOf(value['assets'], isAsset)
  ) {
    return false;
  }
  const trackIds = new Set(value['tracks'].map((track) => track.id));
  const assetIds = new Set(value['assets'].map((asset) => asset.id));
  return (
    value['clips'].every((clip) => trackIds.has(clip.trackId) && assetIds.has(clip.assetId)) &&
    value['overlays'].every((overlay) => trackIds.has(overlay.trackId))
  );
}

/**
 * 이전 버전 저장본을 현재 형식으로 바꾼다. 지금은 버전 1뿐이라 그대로 돌려준다.
 * 알 수 없는(더 새로운) 버전이면 null.
 */
function migrate(schemaVersion: number, project: unknown): unknown {
  return schemaVersion === SCHEMA_VERSION ? project : null;
}

/**
 * 저장소에서 읽은 값을 검증해 Project와 저장 시각을 얻는다. 형식이 깨졌거나 알 수 없는 버전이면 null.
 * 저장소의 데이터는 언제든 이전 버전이거나 손상되었을 수 있으므로 타입을 믿지 않고 검사한다.
 */
export function parsePersistedRecord(value: unknown): { project: Project; savedAt: number } | null {
  if (!isRecord(value) || typeof value['schemaVersion'] !== 'number') {
    return null;
  }
  const project = migrate(value['schemaVersion'], value['project']);
  const savedAt = value['savedAt'];
  return isProject(project) && isFiniteNumber(savedAt) ? { project, savedAt } : null;
}

export function parsePersistedProject(value: unknown): Project | null {
  return parsePersistedRecord(value)?.project ?? null;
}

/** 여러 저장본 중 유효하고 가장 최근에 저장된 것 */
export function pickLatestRecord(
  values: readonly unknown[],
): { project: Project; savedAt: number; index: number } | null {
  let latest: { project: Project; savedAt: number; index: number } | null = null;
  values.forEach((value, index) => {
    const record = parsePersistedRecord(value);
    if (record && (!latest || record.savedAt > latest.savedAt)) {
      latest = { ...record, index };
    }
  });
  return latest;
}
