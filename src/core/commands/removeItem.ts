import type { Clip, Project, TextOverlay } from '../project.ts';
import { findItem, itemsOnTrack } from '../timelineItem.ts';
import type { Command } from './command.ts';

/** 배열의 index 위치에 다시 넣는다 (undo 결과가 원래 Project와 정확히 같도록) */
function insertAt<T>(list: readonly T[], index: number, value: T): T[] {
  return [...list.slice(0, index), value, ...list.slice(index)];
}

/** 클립·텍스트를 지운다. undo하면 원래 배열 위치에 되돌린다. 없는 항목이면 null */
export function createRemoveItemCommand(project: Project, itemId: string): Command | null {
  const item = findItem(project, itemId);
  if (!item) {
    return null;
  }
  if (item.kind === 'clip') {
    const clip: Clip = item.clip;
    const index = project.clips.findIndex((candidate) => candidate.id === itemId);
    return {
      label: '클립 삭제',
      execute: (current) => {
        if (!current.clips.some((candidate) => candidate.id === itemId)) {
          throw new Error(`Clip not found: ${itemId}`);
        }
        return { ...current, clips: current.clips.filter((candidate) => candidate.id !== itemId) };
      },
      undo: (current) => ({ ...current, clips: insertAt(current.clips, index, clip) }),
    };
  }
  const overlay: TextOverlay = item.overlay;
  const index = project.overlays.findIndex((candidate) => candidate.id === itemId);
  return {
    label: '텍스트 삭제',
    execute: (current) => {
      if (!current.overlays.some((candidate) => candidate.id === itemId)) {
        throw new Error(`Overlay not found: ${itemId}`);
      }
      return {
        ...current,
        overlays: current.overlays.filter((candidate) => candidate.id !== itemId),
      };
    },
    undo: (current) => ({ ...current, overlays: insertAt(current.overlays, index, overlay) }),
  };
}

/** 빈 트랙만 지울 수 있다. 마지막 남은 비디오 트랙은 지울 수 없다 (에셋을 놓을 곳이 없어지므로) */
export function canRemoveTrack(project: Project, trackId: string): boolean {
  const track = project.tracks.find((candidate) => candidate.id === trackId);
  if (!track || itemsOnTrack(project, trackId).length > 0) {
    return false;
  }
  const videoTracks = project.tracks.filter((candidate) => candidate.kind === 'video');
  return !(track.kind === 'video' && videoTracks.length <= 1);
}

/** 빈 트랙을 지운다. undo하면 원래 위치에 되돌린다. 지울 수 없으면 null */
export function createRemoveTrackCommand(project: Project, trackId: string): Command | null {
  if (!canRemoveTrack(project, trackId)) {
    return null;
  }
  const index = project.tracks.findIndex((candidate) => candidate.id === trackId);
  const track = project.tracks[index];
  if (!track) {
    return null;
  }
  return {
    label: '트랙 삭제',
    execute: (current) => {
      if (!canRemoveTrack(current, trackId)) {
        throw new Error(`Cannot remove track: ${trackId}`);
      }
      return { ...current, tracks: current.tracks.filter((candidate) => candidate.id !== trackId) };
    },
    undo: (current) => ({ ...current, tracks: insertAt(current.tracks, index, track) }),
  };
}
