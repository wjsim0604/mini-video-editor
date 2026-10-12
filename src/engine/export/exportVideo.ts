import type { VideoSample } from 'mediabunny';
import { resolveLayers, type Layer } from '@/core/composition.ts';
import { exportFrameCount, exportFrameTiming } from '@/core/export/exportPlan.ts';
import type { Asset, Project } from '@/core/project.ts';
import { US_PER_SECOND } from '@/core/time.ts';
import { openVideoSource, type VideoSource } from '../media/videoSource.ts';
import { drawLayers, placement, type DrawableLayer } from '../render/drawLayers.ts';
import { ClipFrameReader } from './ClipFrameReader.ts';
import { CODEC_LABEL, pickExportCodec } from './codec.ts';

export class ExportUnsupportedError extends Error {
  override name = 'ExportUnsupportedError';
}

export interface ExportProgress {
  frame: number;
  total: number;
}

export interface ExportOptions {
  /** 시작 시점에 고정한 Project (내보내는 동안의 편집은 결과에 섞이지 않는다) */
  project: Project;
  getFile: (assetId: string) => Blob | undefined;
  onProgress: (progress: ExportProgress) => void;
  signal: AbortSignal;
}

export interface ExportResult {
  blob: Blob;
  codec: string;
  codecLabel: string;
  frames: number;
}

type ClipLayer = Extract<Layer, { kind: 'clip' }>;

/**
 * 내보내기용 자원. 영상 원본은 에셋마다 한 번 열고, 디코딩 리더는 클립마다 따로 둔다
 * (같은 영상을 나눈 클립들이 서로 다른 위치를 읽기 때문). 끝난 클립의 리더는 바로 해제한다.
 */
class ExportResources {
  private readonly getFile: (assetId: string) => Blob | undefined;
  private readonly sources = new Map<string, Promise<VideoSource>>();
  private readonly readers = new Map<string, ClipFrameReader<VideoSample>>();
  private readonly bitmaps = new Map<string, Promise<ImageBitmap>>();

  constructor(getFile: (assetId: string) => Blob | undefined) {
    this.getFile = getFile;
  }

  async layerFor(asset: Asset, layer: ClipLayer, project: Project): Promise<DrawableLayer | null> {
    const file = this.getFile(asset.id);
    if (!file) {
      return null; // 원본 파일이 없는 클립(복원 실패)은 그리지 않는다
    }
    if (asset.type === 'image') {
      let bitmap = this.bitmaps.get(asset.id);
      if (!bitmap) {
        bitmap = createImageBitmap(file);
        this.bitmaps.set(asset.id, bitmap);
      }
      return { kind: 'image', bitmap: await bitmap, ...placement(layer) };
    }
    if (asset.type !== 'video') {
      return null;
    }
    let reader = this.readers.get(layer.clipId);
    if (!reader) {
      let source = this.sources.get(asset.id);
      if (!source) {
        source = openVideoSource(file);
        this.sources.set(asset.id, source);
      }
      const opened = await source;
      const clip = project.clips.find((candidate) => candidate.id === layer.clipId);
      reader = new ClipFrameReader(
        opened.samples(layer.sourceTime, clip?.outPoint ?? opened.duration),
        (sample) => opened.toSourceTime(sample),
      );
      this.readers.set(layer.clipId, reader);
    }
    const sample = await reader.frameAt(layer.sourceTime);
    return sample ? { kind: 'video', sample, ...placement(layer) } : null;
  }

  /** 지금 화면에 없는 클립의 리더를 해제한다 (시간은 앞으로만 가므로 다시 쓰이지 않는다) */
  releaseInactive(activeClipIds: ReadonlySet<string>): void {
    for (const [clipId, reader] of this.readers) {
      if (!activeClipIds.has(clipId)) {
        reader.dispose();
        this.readers.delete(clipId);
      }
    }
  }

  async dispose(): Promise<void> {
    this.releaseInactive(new Set());
    const [sources, bitmaps] = await Promise.all([
      Promise.allSettled(this.sources.values()),
      Promise.allSettled(this.bitmaps.values()),
    ]);
    for (const result of sources) {
      if (result.status === 'fulfilled') {
        result.value.dispose();
      }
    }
    for (const result of bitmaps) {
      if (result.status === 'fulfilled') {
        result.value.close();
      }
    }
  }
}

function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) {
    throw new DOMException('Export cancelled', 'AbortError');
  }
}

/**
 * 프로젝트 전체를 프레임 단위로 렌더링해 MP4로 인코딩한다 (영상만).
 * 프레임마다 resolveLayers(project, time) → drawLayers로 프리뷰와 같은 합성을 하고,
 * CanvasSource.add가 인코더가 밀릴 때 기다려 주므로 메모리가 쌓이지 않는다.
 */
export async function exportVideo(options: ExportOptions): Promise<ExportResult> {
  const { project, signal, onProgress } = options;
  const total = exportFrameCount(project);
  if (total === 0) {
    throw new Error('Nothing to export');
  }
  const codec = await pickExportCodec(project.width, project.height, project.fps);
  if (!codec) {
    throw new ExportUnsupportedError(
      '이 브라우저에서는 영상 인코딩(WebCodecs)을 사용할 수 없습니다',
    );
  }
  throwIfAborted(signal);

  const { BufferTarget, CanvasSource, Mp4OutputFormat, Output, QUALITY_HIGH } =
    await import('mediabunny');
  const canvas = new OffscreenCanvas(project.width, project.height);
  const context = canvas.getContext('2d', { alpha: false });
  if (!context) {
    throw new ExportUnsupportedError('캔버스를 사용할 수 없습니다');
  }
  const target = new BufferTarget();
  const output = new Output({ format: new Mp4OutputFormat({ fastStart: 'in-memory' }), target });
  const videoSource = new CanvasSource(canvas, { codec, quality: QUALITY_HIGH });
  output.addVideoTrack(videoSource);

  const assets = new Map(project.assets.map((asset) => [asset.id, asset]));
  const resources = new ExportResources(options.getFile);
  let finished = false;
  try {
    await output.start();
    for (let index = 0; index < total; index++) {
      throwIfAborted(signal);
      const { time, duration } = exportFrameTiming(index, project.fps);
      const layers = resolveLayers(project, time);
      resources.releaseInactive(
        new Set(layers.flatMap((layer) => (layer.kind === 'clip' ? [layer.clipId] : []))),
      );

      const drawables: DrawableLayer[] = [];
      for (const layer of layers) {
        if (layer.kind === 'text') {
          drawables.push({ kind: 'text', overlay: layer.overlay });
          continue;
        }
        const asset = assets.get(layer.assetId);
        const drawable = asset ? await resources.layerFor(asset, layer, project) : null;
        if (drawable) {
          drawables.push(drawable);
        }
      }
      drawLayers(context, drawables, project.width);
      await videoSource.add(time / US_PER_SECOND, duration / US_PER_SECOND);
      onProgress({ frame: index + 1, total });
    }
    throwIfAborted(signal);
    await output.finalize();
    finished = true;
  } finally {
    await resources.dispose();
    if (!finished && output.state !== 'canceled' && output.state !== 'finalized') {
      await output.cancel().catch(() => undefined);
    }
  }

  if (!target.buffer) {
    throw new Error('Export produced no data');
  }
  return {
    blob: new Blob([target.buffer], { type: 'video/mp4' }),
    codec,
    codecLabel: CODEC_LABEL[codec] ?? codec,
    frames: total,
  };
}
