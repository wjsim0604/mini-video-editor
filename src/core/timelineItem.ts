import { clipEnd } from './clip.ts';
import type { Clip, Project, TextOverlay, Track } from './project.ts';
import type { Microseconds } from './time.ts';

/** 타임라인상의 구간 [start, end) */
export interface Span {
  start: Microseconds;
  end: Microseconds;
}

interface ItemBase extends Span {
  id: string;
  trackId: string;
}

/**
 * 타임라인에 놓이는 모든 항목(클립·텍스트)의 공통 형태.
 * 배치·이동·트리밍·자르기·스냅·가상화는 이 형태로 계산해 클립과 텍스트가 같은 규칙을 따른다.
 */
export type TimelineItem =
  (ItemBase & { kind: 'clip'; clip: Clip }) | (ItemBase & { kind: 'text'; overlay: TextOverlay });

// 같은 Clip/TextOverlay 객체에는 같은 item 객체를 돌려줘 React.memo 비교가 유지되게 한다
const itemCache = new WeakMap<Clip | TextOverlay, TimelineItem>();

export function clipItem(clip: Clip): TimelineItem {
  let item = itemCache.get(clip);
  if (!item) {
    item = {
      kind: 'clip',
      id: clip.id,
      trackId: clip.trackId,
      start: clip.start,
      end: clipEnd(clip),
      clip,
    };
    itemCache.set(clip, item);
  }
  return item;
}

export function overlayItem(overlay: TextOverlay): TimelineItem {
  let item = itemCache.get(overlay);
  if (!item) {
    item = {
      kind: 'text',
      id: overlay.id,
      trackId: overlay.trackId,
      start: overlay.start,
      end: overlay.start + overlay.duration,
      overlay,
    };
    itemCache.set(overlay, item);
  }
  return item;
}

export function timelineItems(project: Project): TimelineItem[] {
  return [...project.clips.map(clipItem), ...project.overlays.map(overlayItem)];
}

export function findItem(project: Project, itemId: string | null): TimelineItem | undefined {
  if (itemId === null) {
    return undefined;
  }
  const clip = project.clips.find((candidate) => candidate.id === itemId);
  if (clip) {
    return clipItem(clip);
  }
  const overlay = project.overlays.find((candidate) => candidate.id === itemId);
  return overlay ? overlayItem(overlay) : undefined;
}

/** 같은 트랙의 다른 항목들 (excludeId 제외) */
export function itemsOnTrack(
  project: Project,
  trackId: string,
  excludeId?: string,
): TimelineItem[] {
  return timelineItems(project).filter((item) => item.trackId === trackId && item.id !== excludeId);
}

export function spanDuration(span: Span): Microseconds {
  return span.end - span.start;
}

/** 두 구간이 겹치는지. 끝과 시작이 맞닿는 것은 겹침이 아니다. */
export function spansOverlap(a: Span, b: Span): boolean {
  return a.start < b.end && b.start < a.end;
}

export function isSpanActiveAt(span: Span, time: Microseconds): boolean {
  return span.start <= time && time < span.end;
}

/** 항목이 놓일 수 있는 트랙 종류: 영상·이미지 클립은 비디오 트랙, 텍스트는 텍스트 트랙 */
export function trackKindFor(item: Pick<TimelineItem, 'kind'>): Track['kind'] {
  return item.kind === 'clip' ? 'video' : 'text';
}

/** 항목의 구간을 span으로 바꾼 Project. 클립은 원본 사용 구간(inPoint/outPoint)을 함께 맞춘다. */
export function withItemSpan(project: Project, item: TimelineItem, span: Span): Project {
  if (item.kind === 'text') {
    const updated: TextOverlay = {
      ...item.overlay,
      start: span.start,
      duration: span.end - span.start,
    };
    return {
      ...project,
      overlays: project.overlays.map((overlay) => (overlay.id === item.id ? updated : overlay)),
    };
  }
  const { clip } = item;
  const isImage = project.assets.find((asset) => asset.id === clip.assetId)?.type === 'image';
  // 이미지는 어느 시각이나 같은 그림이므로 inPoint 0으로 정규화한다
  const inPoint = isImage ? 0 : clip.inPoint + (span.start - clip.start);
  const updated: Clip = {
    ...clip,
    start: span.start,
    inPoint,
    outPoint: inPoint + (span.end - span.start),
  };
  return {
    ...project,
    clips: project.clips.map((candidate) => (candidate.id === item.id ? updated : candidate)),
  };
}
