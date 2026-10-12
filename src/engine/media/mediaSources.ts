import { openVideoSource, type VideoSource } from './videoSource.ts';

type Entry<T> =
  { status: 'loading'; promise: Promise<T> } | { status: 'ready'; value: T } | { status: 'failed' };

/**
 * 에셋별 디코딩 자원(영상 VideoSource, 이미지 ImageBitmap)을 한 번만 열고 재사용한다.
 * 재생 루프는 동기적으로 동작해야 하므로 peek*로 준비된 자원만 즉시 얻고, 없으면 로딩을 시작한다.
 */
export class MediaSources {
  private readonly videos = new Map<string, Entry<VideoSource>>();
  private readonly images = new Map<string, Entry<ImageBitmap>>();

  private readonly getFile: (assetId: string) => Blob | undefined;

  constructor(getFile: (assetId: string) => Blob | undefined) {
    this.getFile = getFile;
  }

  /** 원본 파일이 있는지. 복원 시 파일이 저장되지 않았던 에셋은 그리지 않고 건너뛴다 */
  hasFile(assetId: string): boolean {
    return this.getFile(assetId) !== undefined;
  }

  loadVideo(assetId: string): Promise<VideoSource> {
    return this.load(this.videos, assetId, openVideoSource);
  }

  loadImage(assetId: string): Promise<ImageBitmap> {
    return this.load(this.images, assetId, (file) => createImageBitmap(file));
  }

  peekVideo(assetId: string): VideoSource | null {
    return this.peek(this.videos, assetId, () => this.loadVideo(assetId));
  }

  peekImage(assetId: string): ImageBitmap | null {
    return this.peek(this.images, assetId, () => this.loadImage(assetId));
  }

  private peek<T>(cache: Map<string, Entry<T>>, assetId: string, load: () => Promise<T>): T | null {
    const entry = cache.get(assetId);
    if (entry?.status === 'ready') {
      return entry.value;
    }
    if (!entry) {
      load().catch((error: unknown) => {
        console.error(`Failed to load media for asset ${assetId}`, error);
      });
    }
    return null;
  }

  private load<T>(
    cache: Map<string, Entry<T>>,
    assetId: string,
    open: (file: Blob) => Promise<T>,
  ): Promise<T> {
    const entry = cache.get(assetId);
    if (entry?.status === 'ready') {
      return Promise.resolve(entry.value);
    }
    if (entry?.status === 'loading') {
      return entry.promise;
    }
    const file = this.getFile(assetId);
    if (!file) {
      return Promise.reject(new Error(`Media file not found for asset ${assetId}`));
    }
    const promise = open(file).then(
      (value) => {
        cache.set(assetId, { status: 'ready', value });
        return value;
      },
      (error: unknown) => {
        cache.set(assetId, { status: 'failed' });
        throw error;
      },
    );
    cache.set(assetId, { status: 'loading', promise });
    return promise;
  }
}
