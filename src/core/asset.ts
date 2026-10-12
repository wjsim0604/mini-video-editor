import type { Asset } from './project.ts';
import type { Microseconds } from './time.ts';

/** 이미지 에셋은 고유한 길이가 없으므로 타임라인에 놓일 때 이 길이를 기본으로 사용한다. */
export const DEFAULT_IMAGE_DURATION: Microseconds = 5_000_000;

export type ImportableAssetType = Extract<Asset['type'], 'video' | 'image'>;

// SVG는 createImageBitmap 지원이 브라우저마다 달라 제외한다
const UNSUPPORTED_IMAGE_TYPES = new Set(['image/svg+xml']);

/** MIME 타입으로 가져올 수 있는 에셋 종류를 판별한다. 지원하지 않으면 null. */
export function detectAssetType(mimeType: string): ImportableAssetType | null {
  if (mimeType.startsWith('video/')) {
    return 'video';
  }
  if (mimeType.startsWith('image/') && !UNSUPPORTED_IMAGE_TYPES.has(mimeType)) {
    return 'image';
  }
  return null;
}
