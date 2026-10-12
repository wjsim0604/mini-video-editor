import type { Microseconds } from './time.ts';

/** 업로드된 원본 파일. 원본 File과 썸네일은 직렬화할 수 없으므로 mediaStore에 따로 보관한다. */
export interface Asset {
  id: string;
  type: 'video' | 'image' | 'audio';
  name: string;
  duration: Microseconds; // 이미지는 기본값 사용
  width?: number;
  height?: number;
}

/** 타임라인 위에 놓인 조각 */
export interface Clip {
  id: string;
  assetId: string;
  trackId: string;
  start: Microseconds; // 타임라인상 시작 위치
  inPoint: Microseconds; // 원본에서 사용 시작 지점
  outPoint: Microseconds; // 원본에서 사용 끝 지점
}

export interface TextOverlay {
  id: string;
  trackId: string;
  start: Microseconds;
  duration: Microseconds;
  text: string;
  style: { fontSize: number; color: string; x: number; y: number };
}

export interface Track {
  id: string;
  kind: 'video' | 'text' | 'audio';
  order: number;
}

export interface Project {
  id: string;
  name: string;
  width: number; // 출력 해상도
  height: number;
  fps: number;
  tracks: Track[];
  clips: Clip[];
  overlays: TextOverlay[];
  assets: Asset[];
}

export const DEFAULT_PROJECT_WIDTH = 1920;
export const DEFAULT_PROJECT_HEIGHT = 1080;
export const DEFAULT_PROJECT_FPS = 30;

export function createEmptyProject(id: string, name: string): Project {
  return {
    id,
    name,
    width: DEFAULT_PROJECT_WIDTH,
    height: DEFAULT_PROJECT_HEIGHT,
    fps: DEFAULT_PROJECT_FPS,
    tracks: [],
    clips: [],
    overlays: [],
    assets: [],
  };
}
