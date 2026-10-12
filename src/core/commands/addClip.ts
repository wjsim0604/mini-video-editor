import type { Clip } from '../project.ts';
import { assertClipPlaceable, assertValidClipTiming } from './clipValidation.ts';
import type { Command } from './command.ts';

export function createAddClipCommand(clip: Clip): Command {
  return {
    label: '클립 추가',
    execute(project) {
      assertValidClipTiming(clip);
      if (!project.assets.some((asset) => asset.id === clip.assetId)) {
        throw new Error(`Asset not found: ${clip.assetId}`);
      }
      if (project.clips.some((existing) => existing.id === clip.id)) {
        throw new Error(`Clip already exists: ${clip.id}`);
      }
      assertClipPlaceable(project, clip);
      return { ...project, clips: [...project.clips, clip] };
    },
    undo(project) {
      return { ...project, clips: project.clips.filter((existing) => existing.id !== clip.id) };
    },
  };
}
