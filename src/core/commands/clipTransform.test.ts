import { describe, expect, it } from 'vitest';
import { createEmptyProject, type Project } from '../project.ts';
import { splitClipAt } from '../timeline/split.ts';
import { buildSetClipTransformCommand } from './clipTransform.ts';

const S = 1_000_000;

function project(): Project {
  const base = createEmptyProject('p', 'test');
  return {
    ...base,
    assets: [{ id: 'a', type: 'image', name: 'a.png', duration: 5 * S, width: 800, height: 600 }],
    clips: [
      {
        id: 'c',
        assetId: 'a',
        trackId: base.tracks[0]?.id ?? '',
        start: 0,
        inPoint: 0,
        outPoint: S,
      },
    ],
  };
}

function required<T>(value: T | null): T {
  if (value === null) {
    throw new Error('value expected');
  }
  return value;
}

describe('buildSetClipTransformCommand', () => {
  it('기본 배치(화면 중심, 배율 1)에서 바꾼 필드만 덮어쓴다', () => {
    const command = required(buildSetClipTransformCommand(project(), 'c', { x: 100 }));

    expect(command.execute(project()).clips[0]?.transform).toEqual({ x: 100, y: 540, scale: 1 });
  });

  it('null이면 기본 배치로 되돌리며 필드를 지운다', () => {
    const moved = required(buildSetClipTransformCommand(project(), 'c', { scale: 2 })).execute(
      project(),
    );
    const reset = required(buildSetClipTransformCommand(moved, 'c', null)).execute(moved);

    expect(reset.clips[0]).not.toHaveProperty('transform');
  });

  it('같은 필드를 바꿀 때만 mergeKey가 같다', () => {
    const p = project();
    const key = (patch: Parameters<typeof buildSetClipTransformCommand>[2]) =>
      buildSetClipTransformCommand(p, 'c', patch)?.mergeKey;

    expect(key({ x: 1, y: 2 })).toBe(key({ y: 3, x: 4 }));
    expect(key({ scale: 2 })).not.toBe(key({ x: 1, y: 2 }));
  });

  it('없는 클립이면 null, 잘못된 배율이면 실행하지 않는다', () => {
    expect(buildSetClipTransformCommand(project(), 'missing', { x: 0 })).toBeNull();

    const command = required(buildSetClipTransformCommand(project(), 'c', { scale: 0 }));
    expect(() => command.execute(project())).toThrow(RangeError);
  });

  it('자르면 두 조각이 같은 배치를 이어받는다', () => {
    const transform = { x: 1, y: 2, scale: 0.5 };
    const clip = { ...required(project().clips[0] ?? null), transform };

    const [left, right] = splitClipAt(clip, S / 2, 'c2', true);

    expect(left.transform).toEqual(transform);
    expect(right.transform).toEqual(transform);
  });
});
