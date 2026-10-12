import { DEFAULT_IMAGE_DURATION, detectAssetType, type ImportableAssetType } from '@/core/asset.ts';
import { secondsToUs, type Microseconds } from '@/core/time.ts';

export interface ProbeResult {
  type: ImportableAssetType;
  duration: Microseconds;
  width: number;
  height: number;
  thumbnail: Blob;
}

export class UnsupportedMediaError extends Error {
  override name = 'UnsupportedMediaError';
}

const THUMBNAIL_MAX_WIDTH = 320;
const THUMBNAIL_MAX_HEIGHT = 180;
const THUMBNAIL_SEEK_SECONDS = 1;
const LOAD_TIMEOUT_MS = 15_000;

/**
 * 파일의 메타데이터(길이, 해상도)를 읽고 썸네일을 만든다.
 * 현재는 브라우저 기본 디코더(<video>, createImageBitmap)를 사용한다.
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
  const url = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';

  try {
    const loaded = waitForMediaEvent(video, 'loadedmetadata');
    video.src = url;
    await loaded;

    let durationSeconds = video.duration;
    if (!Number.isFinite(durationSeconds)) {
      // MediaRecorder로 만든 webm 등은 컨테이너에 길이 정보가 없어 Infinity로 보고된다.
      // 끝 너머로 seek하면 브라우저가 파일을 훑어 실제 길이를 계산한다.
      const resolved = waitForMediaEvent(video, 'durationchange');
      video.currentTime = Number.MAX_SAFE_INTEGER;
      await resolved;
      durationSeconds = video.duration;
    }
    if (!Number.isFinite(durationSeconds) || video.videoWidth === 0) {
      throw new UnsupportedMediaError('영상 정보를 읽을 수 없습니다');
    }

    // 첫 프레임은 검은 화면인 경우가 많아 조금 뒤의 프레임을 썸네일로 쓴다
    const seeked = waitForMediaEvent(video, 'seeked');
    video.currentTime = Math.min(THUMBNAIL_SEEK_SECONDS, durationSeconds * 0.1);
    await seeked;

    return {
      type: 'video',
      duration: secondsToUs(durationSeconds),
      width: video.videoWidth,
      height: video.videoHeight,
      thumbnail: await renderThumbnail(video, video.videoWidth, video.videoHeight),
    };
  } finally {
    video.removeAttribute('src');
    video.load();
    URL.revokeObjectURL(url);
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
    return {
      type: 'image',
      duration: DEFAULT_IMAGE_DURATION,
      width: bitmap.width,
      height: bitmap.height,
      thumbnail: await renderThumbnail(bitmap, bitmap.width, bitmap.height),
    };
  } finally {
    bitmap.close();
  }
}

/** 비율을 유지한 채 최대 크기 안에 맞춰 JPEG로 그린다. */
async function renderThumbnail(
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
): Promise<Blob> {
  const scale = Math.min(THUMBNAIL_MAX_WIDTH / sourceWidth, THUMBNAIL_MAX_HEIGHT / sourceHeight, 1);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(sourceWidth * scale));
  canvas.height = Math.max(1, Math.round(sourceHeight * scale));

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Canvas 2D context is not available');
  }
  context.drawImage(source, 0, 0, canvas.width, canvas.height);

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

/** 미디어 이벤트를 기다린다. 디코딩 오류나 시간 초과 시 UnsupportedMediaError로 거부한다. */
function waitForMediaEvent(
  media: HTMLMediaElement,
  type: keyof HTMLMediaElementEventMap,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timer);
      media.removeEventListener(type, onEvent);
      media.removeEventListener('error', onError);
    };
    const onEvent = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new UnsupportedMediaError('브라우저가 이 영상을 재생할 수 없습니다'));
    };
    const timer = setTimeout(() => {
      cleanup();
      reject(new UnsupportedMediaError('영상을 불러오는 데 시간이 너무 오래 걸립니다'));
    }, LOAD_TIMEOUT_MS);

    media.addEventListener(type, onEvent);
    media.addEventListener('error', onError);
  });
}
