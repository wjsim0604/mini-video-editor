import { clipEnd, isClipActiveAtTime } from './clip.ts';
import type { Clip, ClipTransform, Project, TextOverlay } from './project.ts';
import type { Microseconds } from './time.ts';

/** 특정 시각에 프리뷰에 그려야 할 하나의 레이어 */
export type Layer =
  | {
      kind: 'clip';
      clipId: string;
      assetId: string;
      trackId: string;
      /** 원본 에셋 기준 시각 */
      sourceTime: Microseconds;
      /** 없으면 기본 배치 */
      transform?: ClipTransform;
    }
  | { kind: 'text'; overlay: TextOverlay; trackId: string };

function videoTrackOrders(project: Project): Map<string, number> {
  return new Map(
    project.tracks
      .filter((track) => track.kind === 'video')
      .map((track) => [track.id, track.order]),
  );
}

/**
 * render(project, time)의 "무엇을 그릴지" 부분. 아래 레이어부터 위 레이어 순서로 반환한다.
 * order가 큰 트랙이 위에 그려진다 (비디오·텍스트 트랙 공통, 오디오 트랙은 제외).
 */
export function resolveLayers(project: Project, time: Microseconds): Layer[] {
  const orders = new Map(
    project.tracks
      .filter((track) => track.kind !== 'audio')
      .map((track) => [track.id, track.order]),
  );
  const clipLayers: Layer[] = project.clips
    .filter((clip) => orders.has(clip.trackId) && isClipActiveAtTime(clip, time))
    .map((clip) => ({
      kind: 'clip',
      clipId: clip.id,
      assetId: clip.assetId,
      trackId: clip.trackId,
      sourceTime: clip.inPoint + (time - clip.start),
      ...(clip.transform ? { transform: clip.transform } : {}),
    }));
  const textLayers: Layer[] = project.overlays
    .filter(
      (overlay) =>
        orders.has(overlay.trackId) &&
        overlay.start <= time &&
        time < overlay.start + overlay.duration,
    )
    .map((overlay) => ({ kind: 'text', overlay, trackId: overlay.trackId }));
  return [...clipLayers, ...textLayers].sort(
    (a, b) => (orders.get(a.trackId) ?? 0) - (orders.get(b.trackId) ?? 0),
  );
}

/** (time, time + lookahead] 구간에서 시작하는 비디오 트랙 클립. 재생 중 미리 디코딩할 대상이다. */
export function findUpcomingClips(
  project: Project,
  time: Microseconds,
  lookahead: Microseconds,
): Clip[] {
  const orders = videoTrackOrders(project);
  return project.clips.filter(
    (clip) => orders.has(clip.trackId) && clip.start > time && clip.start <= time + lookahead,
  );
}

/** 프로젝트의 전체 길이 = 가장 늦게 끝나는 클립 또는 텍스트의 끝 */
export function projectDuration(project: Project): Microseconds {
  const clipsEnd = project.clips.reduce((end, clip) => Math.max(end, clipEnd(clip)), 0);
  return project.overlays.reduce(
    (end, overlay) => Math.max(end, overlay.start + overlay.duration),
    clipsEnd,
  );
}
