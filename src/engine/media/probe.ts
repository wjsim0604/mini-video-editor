import { DEFAULT_IMAGE_DURATION, detectAssetType, type ImportableAssetType } from '@/core/asset.ts';
import type { Microseconds } from '@/core/time.ts';
import { openVideoSource, UnsupportedMediaError } from './videoSource.ts';

export { UnsupportedMediaError };

export interface ProbeResult {
  type: ImportableAssetType;
  duration: Microseconds;
  width: number;
  height: number;
  thumbnail: Blob;
}

const THUMBNAIL_MAX_WIDTH = 320;
const THUMBNAIL_MAX_HEIGHT = 180;
const THUMBNAIL_TIME: Microseconds = 1_000_000;

/**
 * 파일의 메타데이터(길이, 해상도)를 읽고 썸네일을 만든다.
 * 영상은 재생과 같은 디코딩 경로(mediabunny + WebCodecs)를 사용해, 가져온 에셋은 재생도 가능함을 보장한다.
 */
export async function probeFile(file: File): Promise<ProbeResult> {
  const type = detectAssetType(file.type);
  if (type === 'video') {
    return probeVideo(file);
  }
  if (type === 'image') {
    return probeImage(file);
  }
  throw new UnsupportedMediaError(`지원하지 않는 형식입니다 (${file.type || '알 수 없음'})`);
}

async function probeVideo(file: File): Promise<ProbeResult> {
  const source = await openVideoSource(file).catch((error: unknown) => {
    if (error instanceof UnsupportedMediaError) {
      throw error;
    }
    console.error(error);
    throw new UnsupportedMediaError('영상을 읽을 수 없습니다');
  });

  try {
    if (source.duration <= 0 || source.width === 0) {
      throw new UnsupportedMediaError('영상 정보를 읽을 수 없습니다');
    }
    // 첫 프레임은 검은 화면인 경우가 많아 조금 뒤의 프레임을 썸네일로 쓴다
    const sample = await source.getSample(
      Math.min(THUMBNAIL_TIME, Math.floor(source.duration / 10)),
    );
    if (!sample) {
      throw new UnsupportedMediaError('영상 프레임을 디코딩할 수 없습니다');
    }
    try {
      const thumbnail = await renderThumbnail(source.width, source.height, (context) => {
        sample.drawWithFit(context, { fit: 'contain' });
      });
      return {
        type: 'video',
        duration: source.duration,
        width: source.width,
        height: source.height,
        thumbnail,
      };
    } finally {
      sample.close();
    }
  } finally {
    source.dispose();
  }
}

async function probeImage(file: File): Promise<ProbeResult> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new UnsupportedMediaError('이미지를 읽을 수 없습니다');
  }

  try {
    const thumbnail = await renderThumbnail(
      bitmap.width,
      bitmap.height,
      (context, width, height) => {
        context.drawImage(bitmap, 0, 0, width, height);
      },
    );
    return {
      type: 'image',
      duration: DEFAULT_IMAGE_DURATION,
      width: bitmap.width,
      height: bitmap.height,
      thumbnail,
    };
  } finally {
    bitmap.close();
  }
}

/** 비율을 유지한 채 최대 크기 안에 맞춘 캔버스에 그려 JPEG로 인코딩한다. */
async function renderThumbnail(
  sourceWidth: number,
  sourceHeight: number,
  draw: (context: CanvasRenderingContext2D, width: number, height: number) => void,
): Promise<Blob> {
  const scale = Math.min(THUMBNAIL_MAX_WIDTH / sourceWidth, THUMBNAIL_MAX_HEIGHT / sourceHeight, 1);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(sourceWidth * scale));
  canvas.height = Math.max(1, Math.round(sourceHeight * scale));

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Canvas 2D context is not available');
  }
  draw(context, canvas.width, canvas.height);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to encode thumbnail'));
        }
      },
      'image/jpeg',
      0.8,
    );
  });
}
