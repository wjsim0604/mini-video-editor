import type { Project } from '../project.ts';
import { findSplitTargets, splitClipAt, splitOverlayAt } from '../timeline/split.ts';
import type { TimelineItem } from '../timelineItem.ts';
import type { Microseconds } from '../time.ts';
import type { Command } from './command.ts';
import { createCompositeCommand } from './composite.ts';

/** items 배열에서 original을 [left, right]로 교체하는 커맨드. undo하면 original로 되돌린다. */
function createReplaceCommand<T extends { id: string }>(
  key: 'clips' | 'overlays',
  original: T,
  left: T,
  right: T,
): Command {
  const list = (project: Project) => project[key] as unknown as readonly T[];
  const withList = (project: Project, items: T[]): Project => ({ ...project, [key]: items });
  return {
    label: '자르기',
    execute(project) {
      if (!list(project).some((item) => item.id === original.id)) {
        throw new Error(`Item not found: ${original.id}`);
      }
      if (list(project).some((item) => item.id === right.id)) {
        throw new Error(`Item already exists: ${right.id}`);
      }
      return withList(
        project,
        list(project).flatMap((item) => (item.id === original.id ? [left, right] : [item])),
      );
    },
    undo(project) {
      return withList(
        project,
        list(project)
          .filter((item) => item.id !== right.id)
          .map((item) => (item.id === original.id ? original : item)),
      );
    },
  };
}

function splitCommandFor(
  project: Project,
  item: TimelineItem,
  time: Microseconds,
  newId: string,
): Command {
  if (item.kind === 'text') {
    const [left, right] = splitOverlayAt(item.overlay, time, newId);
    return createReplaceCommand('overlays', item.overlay, left, right);
  }
  const isImage = project.assets.find((asset) => asset.id === item.clip.assetId)?.type === 'image';
  const [left, right] = splitClipAt(item.clip, time, newId, isImage);
  return createReplaceCommand('clips', item.clip, left, right);
}

/** 플레이헤드 위치에서 자르기 대상(선택 우선)을 찾아 커맨드로 만든다. 대상이 없으면 null. */
export function buildSplitCommand(
  project: Project,
  time: Microseconds,
  selectedItemId: string | null,
  createId: () => string,
): Command | null {
  const targets = findSplitTargets(project, time, selectedItemId);
  if (targets.length === 0) {
    return null;
  }
  const commands = targets.map((item) => splitCommandFor(project, item, time, createId()));
  return commands.length === 1 && commands[0]
    ? commands[0]
    : createCompositeCommand('자르기', commands);
}
