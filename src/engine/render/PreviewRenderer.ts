import type { VideoSample } from 'mediabunny';
import { findUpcomingClips, resolveLayers, type Layer } from '@/core/composition.ts';
import type { Asset, Project } from '@/core/project.ts';
import { containRect } from '@/core/render/fit.ts';
import type { Microseconds } from '@/core/time.ts';
import { FrameStream } from '../decode/FrameStream.ts';
import type { MediaSources } from '../media/mediaSources.ts';
import type { VideoSource } from '../media/videoSource.ts';

/** PlaybackEngine이 사용하는 렌더러 인터페이스. 테스트에서는 가짜 구현으로 대체한다. */
export interface FrameRenderer {
  /** 정지 상태(탐색 등)에서 time의 프레임을 정확히 디코딩해 그린다 */
  renderAt(project: Project, time: Microseconds): Promise<void>;
  /** 재생 중 매 프레임 호출된다. 이미 디코딩된 프레임만 즉시 그리고, 이후 필요한 디코딩을 준비한다 */
  renderPlaying(project: Project, time: Microseconds): void;
  startPlayback(): void;
  stopPlayback(): void;
}

export interface RenderStats {
  /** 재생 중 renderPlaying 호출 수 */
  ticks: number;
  /** 필요한 프레임이 준비되지 않아 이전 화면을 유지한 횟수 */
  lateTicks: number;
  lastDrawn: {
    time: Microseconds;
    frames: { clipId: string; frameTime: Microseconds | null }[];
  } | null;
}

type Drawable =
  | { kind: 'video'; clipId: string; sample: VideoSample; frameTime: Microseconds }
  | { kind: 'image'; clipId: string; bitmap: ImageBitmap };

interface StreamEntry {
  source: VideoSource;
  stream: FrameStream<VideoSample>;
}

/** 다음 클립을 미리 디코딩하기 시작하는 시점 (클립 경계 끊김 방지) */
const PRELOAD_LOOKAHEAD: Microseconds = 1_000_000;

export class PreviewRenderer implements FrameRenderer {
  readonly stats: RenderStats = { ticks: 0, lateTicks: 0, lastDrawn: null };
  private readonly sources: MediaSources;
  private readonly streams = new Map<string, StreamEntry>();
  private canvas: HTMLCanvasElement | null = null;
  private context: CanvasRenderingContext2D | null = null;
  /** 진행 중인 renderAt이 더 새로운 렌더에 의해 무효화되었는지 판별한다 */
  private renderToken = 0;

  constructor(sources: MediaSources) {
    this.sources = sources;
  }

  /** 캔버스의 실제 픽셀 크기. 출력 해상도와 같은 비율이어야 한다. */
  setCanvas(canvas: HTMLCanvasElement | null, width = 0, height = 0): void {
    this.canvas = canvas;
    this.context = null;
    if (canvas) {
      canvas.width = width;
      canvas.height = height;
    }
  }

  async renderAt(project: Project, time: Microseconds): Promise<void> {
    const token = ++this.renderToken;
    if (!this.canvas) {
      return;
    }
    const assets = indexAssets(project);
    const results = await Promise.allSettled(
      resolveLayers(project, time).map((layer) => this.loadStill(assets.get(layer.assetId), layer)),
    );
    const drawables = results.flatMap((result) => {
      if (result.status === 'rejected') {
        console.error(result.reason);
        return [];
      }
      return result.value ? [result.value] : [];
    });

    try {
      if (token === this.renderToken) {
        this.draw(time, drawables);
      }
    } finally {
      for (const drawable of drawables) {
        if (drawable.kind === 'video') {
          drawable.sample.close();
        }
      }
    }
  }

  renderPlaying(project: Project, time: Microseconds): void {
    // 재생이 진행되면 그 전에 시작된 탐색 렌더 결과는 버린다
    this.renderToken++;
    if (!this.canvas) {
      return;
    }
    this.stats.ticks++;

    const assets = indexAssets(project);
    const layers = resolveLayers(project, time);
    this.updateStreams(project, time, layers, assets);

    const drawables: Drawable[] = [];
    for (const layer of layers) {
      const drawable = this.peekFrame(assets.get(layer.assetId), layer);
      if (!drawable) {
        // 프레임이 아직 준비되지 않았다. 검은 화면으로 깜빡이는 대신 이전 화면을 유지한다.
        this.stats.lateTicks++;
        return;
      }
      drawables.push(drawable);
    }
    this.draw(time, drawables);
  }

  startPlayback(): void {
    this.disposeStreams();
    this.stats.ticks = 0;
    this.stats.lateTicks = 0;
  }

  stopPlayback(): void {
    this.disposeStreams();
  }

  private async loadStill(asset: Asset | undefined, layer: Layer): Promise<Drawable | null> {
    if (asset?.type === 'image') {
      return {
        kind: 'image',
        clipId: layer.clipId,
        bitmap: await this.sources.loadImage(asset.id),
      };
    }
    if (asset?.type === 'video') {
      const source = await this.sources.loadVideo(asset.id);
      const sample = await source.getSample(layer.sourceTime);
      return sample
        ? { kind: 'video', clipId: layer.clipId, sample, frameTime: source.toSourceTime(sample) }
        : null;
    }
    return null;
  }

  private peekFrame(asset: Asset | undefined, layer: Layer): Drawable | null {
    if (asset?.type === 'image') {
      const bitmap = this.sources.peekImage(asset.id);
      return bitmap ? { kind: 'image', clipId: layer.clipId, bitmap } : null;
    }
    if (asset?.type === 'video') {
      const entry = this.streams.get(layer.clipId);
      const sample = entry?.stream.frameAt(layer.sourceTime);
      return entry && sample
        ? {
            kind: 'video',
            clipId: layer.clipId,
            sample,
            frameTime: entry.source.toSourceTime(sample),
          }
        : null;
    }
    return null;
  }

  /** 지금 보이는 클립과 곧 시작할 클립의 디코딩 스트림을 유지하고, 필요 없어진 스트림은 해제한다 */
  private updateStreams(
    project: Project,
    time: Microseconds,
    layers: readonly Layer[],
    assets: ReadonlyMap<string, Asset>,
  ): void {
    const isVideo = (assetId: string) => assets.get(assetId)?.type === 'video';
    const wanted = new Map<string, Microseconds>();
    for (const layer of layers) {
      if (isVideo(layer.assetId)) {
        wanted.set(layer.clipId, layer.sourceTime);
      }
    }
    for (const clip of findUpcomingClips(project, time, PRELOAD_LOOKAHEAD)) {
      if (isVideo(clip.assetId)) {
        wanted.set(clip.id, clip.inPoint);
      }
    }

    for (const [clipId, entry] of this.streams) {
      const sourceTime = wanted.get(clipId);
      if (sourceTime === undefined || !entry.stream.canServe(sourceTime)) {
        entry.stream.dispose();
        this.streams.delete(clipId);
      }
    }

    for (const [clipId, startTime] of wanted) {
      const clip = project.clips.find((candidate) => candidate.id === clipId);
      if (!clip || this.streams.has(clipId)) {
        continue;
      }
      const source = this.sources.peekVideo(clip.assetId);
      if (!source) {
        continue;
      }
      const stream = new FrameStream<VideoSample>({
        frames: source.samples(startTime, clip.outPoint),
        timeOf: (sample) => source.toSourceTime(sample),
        startTime,
        onError: (error) => {
          console.error(`Decoding failed for clip ${clipId}`, error);
        },
      });
      this.streams.set(clipId, { source, stream });
    }
  }

  private draw(time: Microseconds, drawables: readonly Drawable[]): void {
    const canvas = this.canvas;
    if (!canvas) {
      return;
    }
    this.context ??= canvas.getContext('2d', { alpha: false });
    const context = this.context;
    if (!context) {
      return;
    }

    context.fillStyle = '#000';
    context.fillRect(0, 0, canvas.width, canvas.height);
    for (const drawable of drawables) {
      if (drawable.kind === 'video') {
        drawable.sample.drawWithFit(context, { fit: 'contain' });
      } else {
        const rect = containRect(
          drawable.bitmap.width,
          drawable.bitmap.height,
          canvas.width,
          canvas.height,
        );
        context.drawImage(drawable.bitmap, rect.x, rect.y, rect.width, rect.height);
      }
    }

    this.stats.lastDrawn = {
      time,
      frames: drawables.map((drawable) => ({
        clipId: drawable.clipId,
        frameTime: drawable.kind === 'video' ? drawable.frameTime : null,
      })),
    };
  }

  private disposeStreams(): void {
    for (const { stream } of this.streams.values()) {
      stream.dispose();
    }
    this.streams.clear();
  }
}

function indexAssets(project: Project): Map<string, Asset> {
  return new Map(project.assets.map((asset) => [asset.id, asset]));
}
