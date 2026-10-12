import type { Project } from '../project.ts';
import type { ClipTiming } from '../timeline/trim.ts';
import {
  assertClipPlaceable,
  assertValidClipTiming,
  assertWithinSource,
} from './clipValidation.ts';
import type { Command } from './command.ts';

/** 클립의 start/inPoint/outPoint를 바꾼다 (트리밍). from은 undo에 쓰이므로 생성 시점 값을 넘긴다. */
export function createSetClipTimingCommand(
  clipId: string,
  from: ClipTiming,
  to: ClipTiming,
  label = '클립 트리밍',
): Command {
  const apply = (project: Project, timing: ClipTiming): Project => {
    const clip = project.clips.find((candidate) => candidate.id === clipId);
    if (!clip) {
      throw new Error(`Clip not found: ${clipId}`);
    }
    const updated = { ...clip, ...timing };
    assertValidClipTiming(updated);
    assertWithinSource(project, updated);
    assertClipPlaceable(project, updated);
    return {
      ...project,
      clips: project.clips.map((candidate) => (candidate.id === clipId ? updated : candidate)),
    };
  };

  return {
    label,
    execute: (project) => apply(project, to),
    undo: (project) => apply(project, from),
  };
}
