import type { Command } from '../commands/command.ts';
import { assertItemPlaceable, assertValidSpan } from '../commands/clipValidation.ts';
import type { Project, TextOverlay, Track } from '../project.ts';
import { frameToUs, quantizeToFrame, usToFrame } from '../time.ts';
import { overlayItem } from '../timelineItem.ts';
import { nextTrackOrder } from '../track.ts';
import type { SubtitleCue } from './srt.ts';

/** 자막 글자 크기: 출력 높이의 약 5.5% (1080p에서 59px) */
const SUBTITLE_FONT_RATIO = 0.055;
/** 자막 중심의 아래 여백: 출력 높이의 12% (1080p에서 아래에서 130px) */
const SUBTITLE_BOTTOM_RATIO = 0.12;
/** 겹치는 자막(위 트랙)을 올리는 간격: 두 줄 높이 (줄 높이는 글자 크기의 1.25배) */
const LANE_SPACING_RATIO = 2.5;

export function subtitleStyle(project: Pick<Project, 'width' | 'height'>): TextOverlay['style'] {
  return {
    fontSize: Math.round(project.height * SUBTITLE_FONT_RATIO),
    color: '#ffffff',
    x: Math.round(project.width / 2),
    y: Math.round(project.height * (1 - SUBTITLE_BOTTOM_RATIO)),
  };
}

export interface SubtitleImportPlan {
  /** 새로 만들 텍스트 트랙 (겹치는 자막이 있으면 여러 개) */
  tracks: Track[];
  overlays: TextOverlay[];
}

/**
 * 자막을 새 텍스트 트랙에 배치하는 계획. 시각은 프레임 경계로 맞추고(최소 1프레임),
 * 같은 트랙의 항목은 겹칠 수 없으므로 겹치는 자막은 위 트랙으로 나눈다 (구간 분할, 시작 순 탐욕 배치).
 * 위 트랙의 자막은 화면에서도 겹쳐 보이지 않도록 트랙마다 두 줄 높이씩 위에 놓는다.
 */
export function planSubtitleImport(
  project: Project,
  cues: readonly SubtitleCue[],
  createId: () => string,
): SubtitleImportPlan {
  const { fps } = project;
  const spans = cues
    .map((cue) => {
      const start = quantizeToFrame(cue.start, fps);
      const minEnd = frameToUs(usToFrame(start, fps) + 1, fps);
      return { start, end: Math.max(quantizeToFrame(cue.end, fps), minEnd), text: cue.text };
    })
    .sort((a, b) => a.start - b.start || a.end - b.end);

  const style = subtitleStyle(project);
  const baseOrder = nextTrackOrder(project.tracks);
  const tracks: Track[] = [];
  const laneEnds: number[] = [];
  const overlays = spans.map((span): TextOverlay => {
    let lane = laneEnds.findIndex((end) => end <= span.start);
    if (lane === -1) {
      lane = laneEnds.length;
      tracks.push({ id: createId(), kind: 'text', order: baseOrder + lane });
    }
    laneEnds[lane] = span.end;
    const track = tracks[lane];
    if (!track) {
      throw new Error(`Missing subtitle track for lane ${String(lane)}`);
    }
    return {
      id: createId(),
      trackId: track.id,
      start: span.start,
      duration: span.end - span.start,
      text: span.text,
      style: {
        ...style,
        y: Math.max(
          style.fontSize,
          style.y - lane * Math.round(style.fontSize * LANE_SPACING_RATIO),
        ),
      },
    };
  });
  return { tracks, overlays };
}

/** 계획한 트랙과 자막을 한 번에 추가한다. undo 한 번에 모두 사라진다 */
export function createImportSubtitlesCommand(plan: SubtitleImportPlan): Command {
  const trackIds = new Set(plan.tracks.map((track) => track.id));
  const overlayIds = new Set(plan.overlays.map((overlay) => overlay.id));
  return {
    label: '자막 가져오기',
    execute(project) {
      if (project.tracks.some((track) => trackIds.has(track.id))) {
        throw new Error('Subtitle track already exists');
      }
      if (project.overlays.some((overlay) => overlayIds.has(overlay.id))) {
        throw new Error('Subtitle overlay already exists');
      }
      const next = {
        ...project,
        tracks: [...project.tracks, ...plan.tracks],
        overlays: [...project.overlays, ...plan.overlays],
      };
      for (const overlay of plan.overlays) {
        if (!trackIds.has(overlay.trackId)) {
          throw new Error(`Subtitle must be on a new track: ${overlay.id}`);
        }
        const item = overlayItem(overlay);
        assertValidSpan(item);
        assertItemPlaceable(next, item);
      }
      return next;
    },
    undo(project) {
      return {
        ...project,
        tracks: project.tracks.filter((track) => !trackIds.has(track.id)),
        overlays: project.overlays.filter((overlay) => !overlayIds.has(overlay.id)),
      };
    },
  };
}

/** 프로젝트의 모든 텍스트를 시작 순 자막 목록으로 (SRT 저장용). 내용이 빈 텍스트는 뺀다 */
export function subtitleCuesFromProject(project: Project): SubtitleCue[] {
  return project.overlays
    .filter((overlay) => overlay.text.trim() !== '')
    .map((overlay) => ({
      start: overlay.start,
      end: overlay.start + overlay.duration,
      text: overlay.text,
    }))
    .sort((a, b) => a.start - b.start || a.end - b.end);
}
