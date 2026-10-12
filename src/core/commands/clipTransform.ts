import type { ClipTransform, Project } from '../project.ts';
import { defaultClipTransform } from '../render/fit.ts';
import type { Command } from './command.ts';

function applyTransform(
  project: Project,
  clipId: string,
  transform: ClipTransform | undefined,
): Project {
  if (!project.clips.some((clip) => clip.id === clipId)) {
    throw new Error(`Clip not found: ${clipId}`);
  }
  if (transform) {
    const { x, y, scale } = transform;
    if (!(scale > 0) || ![x, y, scale].every(Number.isFinite)) {
      throw new RangeError(`Invalid clip transform: ${clipId}`);
    }
  }
  return {
    ...project,
    clips: project.clips.map((clip) => {
      if (clip.id !== clipId) {
        return clip;
      }
      if (transform) {
        return { ...clip, transform };
      }
      // 기본 배치로 되돌릴 때는 필드를 지워 저장본을 transform 도입 전과 같게 둔다
      const rest = { ...clip };
      delete rest.transform;
      return rest;
    }),
  };
}

/**
 * 클립의 위치·크기 수정. patch가 null이면 기본 배치(가운데, 꽉 맞춤)로 되돌린다.
 * mergeKey는 바꾸는 필드 이름까지 포함해, 같은 필드를 연속으로 바꿀 때만 히스토리를 합친다.
 */
export function buildSetClipTransformCommand(
  project: Project,
  clipId: string,
  patch: Partial<ClipTransform> | null,
): Command | null {
  const clip = project.clips.find((candidate) => candidate.id === clipId);
  if (!clip) {
    return null;
  }
  const before = clip.transform;
  const after = patch ? { ...(before ?? defaultClipTransform(project)), ...patch } : undefined;
  const fields = patch ? Object.keys(patch).sort().join(',') : 'reset';
  return {
    label: patch ? '클립 위치·크기 수정' : '클립 배치 초기화',
    mergeKey: `clip-transform:${clipId}:${fields}`,
    execute: (current) => applyTransform(current, clipId, after),
    undo: (current) => applyTransform(current, clipId, before),
  };
}
