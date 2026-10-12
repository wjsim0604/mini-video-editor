import type { Command } from './command.ts';

/** 여러 커맨드를 하나의 편집 단위로 묶는다. undo 한 번에 모두 되돌린다 (역순). */
export function createCompositeCommand(label: string, commands: readonly Command[]): Command {
  return {
    label,
    execute: (project) => commands.reduce((current, command) => command.execute(current), project),
    undo: (project) => commands.reduceRight((current, command) => command.undo(current), project),
  };
}
