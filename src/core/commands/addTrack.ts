import type { Track } from '../project.ts';
import type { Command } from './command.ts';

export function createAddTrackCommand(track: Track): Command {
  return {
    label: '트랙 추가',
    execute(project) {
      if (project.tracks.some((existing) => existing.id === track.id)) {
        throw new Error(`Track already exists: ${track.id}`);
      }
      return { ...project, tracks: [...project.tracks, track] };
    },
    undo(project) {
      if (project.clips.some((clip) => clip.trackId === track.id)) {
        throw new Error(`Cannot remove non-empty track: ${track.id}`);
      }
      return { ...project, tracks: project.tracks.filter((existing) => existing.id !== track.id) };
    },
  };
}
