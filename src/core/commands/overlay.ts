import type { Project, TextOverlay } from '../project.ts';
import { overlayItem } from '../timelineItem.ts';
import { assertItemPlaceable, assertValidSpan } from './clipValidation.ts';
import type { Command } from './command.ts';

export function createAddOverlayCommand(overlay: TextOverlay): Command {
  return {
    label: '텍스트 추가',
    execute(project) {
      if (project.overlays.some((existing) => existing.id === overlay.id)) {
        throw new Error(`Overlay already exists: ${overlay.id}`);
      }
      const item = overlayItem(overlay);
      assertValidSpan(item);
      assertItemPlaceable(project, item);
      return { ...project, overlays: [...project.overlays, overlay] };
    },
    undo(project) {
      return {
        ...project,
        overlays: project.overlays.filter((existing) => existing.id !== overlay.id),
      };
    },
  };
}

/** 인스펙터·프리뷰에서 바꿀 수 있는 텍스트 속성 */
export interface OverlayPatch {
  text?: string;
  style?: Partial<TextOverlay['style']>;
}

function applyPatch(project: Project, overlayId: string, patch: OverlayPatch): Project {
  const overlay = project.overlays.find((candidate) => candidate.id === overlayId);
  if (!overlay) {
    throw new Error(`Overlay not found: ${overlayId}`);
  }
  const updated: TextOverlay = {
    ...overlay,
    ...(patch.text === undefined ? {} : { text: patch.text }),
    style: { ...overlay.style, ...patch.style },
  };
  const { fontSize, x, y } = updated.style;
  if (!(fontSize > 0) || ![fontSize, x, y].every(Number.isFinite)) {
    throw new RangeError(`Invalid text style: ${overlayId}`);
  }
  return {
    ...project,
    overlays: project.overlays.map((candidate) =>
      candidate.id === overlayId ? updated : candidate,
    ),
  };
}

/**
 * 텍스트 내용·스타일 수정. 현재 값을 읽어 undo용 이전 값을 만든다.
 * mergeKey는 바꾸는 필드 이름까지 포함해, 같은 필드를 연속으로 바꿀 때만 히스토리를 합친다.
 */
export function buildUpdateOverlayCommand(
  project: Project,
  overlayId: string,
  patch: OverlayPatch,
): Command | null {
  const overlay = project.overlays.find((candidate) => candidate.id === overlayId);
  if (!overlay) {
    return null;
  }
  const styleKeys = Object.keys(patch.style ?? {}) as (keyof TextOverlay['style'])[];
  const before: OverlayPatch = {
    ...(patch.text === undefined ? {} : { text: overlay.text }),
    style: Object.fromEntries(styleKeys.map((key) => [key, overlay.style[key]])),
  };
  const fields = [...(patch.text === undefined ? [] : ['text']), ...styleKeys].sort().join(',');
  return {
    label: '텍스트 수정',
    mergeKey: `overlay:${overlayId}:${fields}`,
    execute: (current) => applyPatch(current, overlayId, patch),
    undo: (current) => applyPatch(current, overlayId, before),
  };
}
