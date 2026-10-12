import type { InputVideoTrack, VideoSample } from 'mediabunny';
import { secondsToUs, US_PER_SECOND, type Microseconds } from '@/core/time.ts';

export class UnsupportedMediaError extends Error {
  override name = 'UnsupportedMediaError';
}

/**
 * 영상 파일 하나에 대한 디먹서·디코더 접근점.
 * 내부 시간(원본 기준 μs, 0부터 시작)과 mediabunny의 시간(초, 컨테이너 타임스탬프)을 이 경계에서 변환한다.
 */
export interface VideoSource {
  readonly track: InputVideoTrack;
  /** 원본 기준 길이 */
  readonly duration: Microseconds;
  readonly width: number;
  readonly height: number;
  /** 원본 기준 sourceTime에 표시되는 프레임 (탐색용) */
  getSample(sourceTime: Microseconds): Promise<VideoSample | null>;
  /** [start, end) 구간의 프레임을 순서대로 디코딩한다 (재생용) */
  samples(start: Microseconds, end: Microseconds): AsyncGenerator<VideoSample, void, unknown>;
  /** 컨테이너 타임스탬프(μs)를 원본 기준 시각으로 변환한다 */
  toSourceTime(sample: VideoSample): Microseconds;
  dispose(): void;
}

export async function openVideoSource(file: Blob): Promise<VideoSource> {
  // 디먹서·디코더 코드는 용량이 커서 첫 화면 번들에서 분리하고, 처음 영상을 열 때 불러온다
  const { BlobSource, Input, MATROSKA, MP4, QTFF, VideoSampleSink, WEBM } =
    await import('mediabunny');
  // 영상 편집에 쓰는 컨테이너만 등록한다 (오디오·스트리밍 형식 디먹서는 번들에서 제외)
  const input = new Input({ source: new BlobSource(file), formats: [MP4, QTFF, WEBM, MATROSKA] });
  try {
    if (!(await input.canRead())) {
      throw new UnsupportedMediaError('지원하지 않는 영상 형식입니다');
    }
    const track = await input.getPrimaryVideoTrack();
    if (!track) {
      throw new UnsupportedMediaError('영상 트랙이 없습니다');
    }
    if (!(await track.canDecode())) {
      const codec = await track.getCodec();
      throw new UnsupportedMediaError(
        `이 브라우저에서 디코딩할 수 없는 코덱입니다 (${codec ?? '알 수 없음'})`,
      );
    }

    // 컨테이너의 첫 타임스탬프가 0이 아닐 수 있으므로 원본 기준 0으로 맞춘다
    const firstSeconds = await track.getFirstTimestamp();
    const endSeconds = await track.computeDuration();
    const offset = secondsToUs(firstSeconds);
    const duration = secondsToUs(endSeconds) - offset;
    const width = await track.getDisplayWidth();
    const height = await track.getDisplayHeight();
    const sink = new VideoSampleSink(track);
    const toSeconds = (sourceTime: Microseconds) => (sourceTime + offset) / US_PER_SECOND;

    return {
      track,
      duration,
      width,
      height,
      getSample: (sourceTime) => sink.getSample(toSeconds(sourceTime)),
      samples: (start, end) => sink.samples(toSeconds(start), toSeconds(end)),
      toSourceTime: (sample) => Math.round(sample.microsecondTimestamp) - offset,
      dispose: () => {
        input.dispose();
      },
    };
  } catch (error) {
    input.dispose();
    throw error;
  }
}
