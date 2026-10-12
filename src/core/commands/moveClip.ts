import type { Clip, Project, Track } from '../project.ts';
import type { Microseconds } from '../time.ts';
import { nextTrackOrder } from '../track.ts';
import { createAddTrackCommand } from './addTrack.ts';
import { assertClipPlaceable, assertValidClipTiming } from './clipValidation.ts';
import type { Command } from './command.ts';
import { createCompositeCommand } from './composite.ts';

export interface ClipPosition {
  trackId: string;
  start: Microseconds;
}

/** 클립의 트랙과 시작 위치를 바꾼다. from은 undo에 쓰이므로 생성 시점의 위치를 넘긴다. */
export function createMoveClipCommand(
  clipId: string,
  from: ClipPosition,
  to: ClipPosition,
): Command {
  const moveTo = (project: Project, position: ClipPosition): Project => {
    const clip = project.clips.find((candidate) => candidate.id === clipId);
    if (!clip) {
      throw new Error(`Clip not found: ${clipId}`);
    }
    const moved: Clip = { ...clip, trackId: position.trackId, start: position.start };
    assertValidClipTiming(moved);
    assertClipPlaceable(project, moved);
    return {
      ...project,
      clips: project.clips.map((candidate) => (candidate.id === clipId ? moved : candidate)),
    };
  };

  return {
    label: '클립 이동',
    execute: (project) => moveTo(project, to),
    undo: (project) => moveTo(project, from),
  };
}

/**
 * 드래그 결과(resolveClipMove)를 커맨드로 만든다. 새 트랙이면 트랙 추가와 이동을 하나로 묶는다.
 * 위치가 바뀌지 않았으면 null (히스토리에 의미 없는 항목을 남기지 않는다).
 */
export function buildMoveClipCommand(
  project: Project,
  clipId: string,
  target: { trackId: string | null; start: Microseconds },
  createTrackId: () => string,
): Command | null {
  const clip = project.clips.find((candidate) => candidate.id === clipId);
  if (!clip) {
    return null;
  }
  const from: ClipPosition = { trackId: clip.trackId, start: clip.start };

  if (target.trackId === null) {
    const track: Track = {
      id: createTrackId(),
      kind: 'video',
      order: nextTrackOrder(project.tracks),
    };
    return createCompositeCommand('새 트랙으로 클립 이동', [
      createAddTrackCommand(track),
      createMoveClipCommand(clipId, from, { trackId: track.id, start: target.start }),
    ]);
  }
  if (target.trackId === from.trackId && target.start === from.start) {
    return null;
  }
  return createMoveClipCommand(clipId, from, { trackId: target.trackId, start: target.start });
}
