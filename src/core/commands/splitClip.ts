import type { Clip, Project } from '../project.ts';
import { findSplitTargets, splitClipAt } from '../timeline/split.ts';
import type { Microseconds } from '../time.ts';
import type { Command } from './command.ts';
import { createCompositeCommand } from './composite.ts';

/** original을 [left, right]로 교체한다. undo하면 두 조각을 제거하고 original을 되돌린다. */
export function createSplitClipCommand(original: Clip, left: Clip, right: Clip): Command {
  return {
    label: '클립 자르기',
    execute(project) {
      if (!project.clips.some((clip) => clip.id === original.id)) {
        throw new Error(`Clip not found: ${original.id}`);
      }
      if (project.clips.some((clip) => clip.id === right.id)) {
        throw new Error(`Clip already exists: ${right.id}`);
      }
      return {
        ...project,
        clips: project.clips.flatMap((clip) => (clip.id === original.id ? [left, right] : [clip])),
      };
    },
    undo(project) {
      return {
        ...project,
        clips: project.clips
          .filter((clip) => clip.id !== right.id)
          .map((clip) => (clip.id === original.id ? original : clip)),
      };
    },
  };
}

/** 플레이헤드 위치에서 자르기 대상(선택 우선)을 찾아 커맨드로 만든다. 대상이 없으면 null. */
export function buildSplitCommand(
  project: Project,
  time: Microseconds,
  selectedClipId: string | null,
  createClipId: () => string,
): Command | null {
  const targets = findSplitTargets(project, time, selectedClipId);
  if (targets.length === 0) {
    return null;
  }
  const commands = targets.map((clip) => {
    const isImage = project.assets.find((asset) => asset.id === clip.assetId)?.type === 'image';
    const [left, right] = splitClipAt(clip, time, createClipId(), isImage);
    return createSplitClipCommand(clip, left, right);
  });
  return commands.length === 1 && commands[0]
    ? commands[0]
    : createCompositeCommand('클립 자르기', commands);
}
