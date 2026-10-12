import { clipsOverlap } from '../clip.ts';
import type { Clip } from '../project.ts';
import type { Command } from './command.ts';

export function createAddClipCommand(clip: Clip): Command {
  return {
    label: '클립 추가',
    execute(project) {
      assertValidTiming(clip);
      if (!project.tracks.some((track) => track.id === clip.trackId)) {
        throw new Error(`Track not found: ${clip.trackId}`);
      }
      if (!project.assets.some((asset) => asset.id === clip.assetId)) {
        throw new Error(`Asset not found: ${clip.assetId}`);
      }
      if (project.clips.some((existing) => existing.id === clip.id)) {
        throw new Error(`Clip already exists: ${clip.id}`);
      }
      const overlapping = project.clips.find(
        (existing) => existing.trackId === clip.trackId && clipsOverlap(existing, clip),
      );
      if (overlapping) {
        throw new Error(`Clip overlaps with ${overlapping.id}`);
      }
      return { ...project, clips: [...project.clips, clip] };
    },
    undo(project) {
      return { ...project, clips: project.clips.filter((existing) => existing.id !== clip.id) };
    },
  };
}

function assertValidTiming(clip: Clip): void {
  const { start, inPoint, outPoint } = clip;
  if (![start, inPoint, outPoint].every(Number.isSafeInteger)) {
    throw new RangeError(`Clip timing must be integer microseconds: ${clip.id}`);
  }
  if (start < 0 || inPoint < 0 || outPoint <= inPoint) {
    throw new RangeError(`Invalid clip range: ${clip.id}`);
  }
}
