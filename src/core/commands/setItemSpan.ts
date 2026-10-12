import type { Project } from '../project.ts';
import { findItem, withItemSpan, type Span } from '../timelineItem.ts';
import {
  assertItemPlaceable,
  assertValidClipTiming,
  assertValidSpan,
  assertWithinSource,
} from './clipValidation.ts';
import type { Command } from './command.ts';

function applySpan(project: Project, itemId: string, span: Span): Project {
  const item = findItem(project, itemId);
  if (!item) {
    throw new Error(`Item not found: ${itemId}`);
  }
  assertValidSpan({ id: itemId, ...span });
  assertItemPlaceable(project, { ...item, ...span });
  const next = withItemSpan(project, item, span);
  const updated = findItem(next, itemId);
  if (updated?.kind === 'clip') {
    assertValidClipTiming(updated.clip);
    assertWithinSource(next, updated.clip);
  }
  return next;
}

/** 항목의 구간을 바꾼다 (트리밍). 클립은 원본 사용 구간을 함께 맞춘다. from은 생성 시점 구간을 넘긴다. */
export function createSetItemSpanCommand(
  itemId: string,
  from: Span,
  to: Span,
  label = '트리밍',
): Command {
  return {
    label,
    execute: (project) => applySpan(project, itemId, to),
    undo: (project) => applySpan(project, itemId, from),
  };
}
