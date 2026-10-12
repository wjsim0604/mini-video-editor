import { describe, expect, it } from 'vitest';
import { createEmptyProject, type Asset, type Clip, type Project } from '../project.ts';
import { resolveTrim } from './trim.ts';

const S = 1_000_000;
const FRAME = 33_333; // 30fps

const video: Asset = { id: 'video', type: 'video', name: 'v.mp4', duration: 10 * S };
const image: Asset = { id: 'image', type: 'image', name: 'i.png', duration: 5 * S };

function makeProject(clips: Clip[]): Project {
  return {
    ...createEmptyProject('p', 'test'),
    tracks: [{ id: 't', kind: 'video', order: 0 }],
    assets: [video, image],
    clips,
  };
}

/** 원본 2s~6s 구간을 타임라인 5s에 놓은 영상 클립 (5s~9s) */
const clip: Clip = {
  id: 'c',
  assetId: 'video',
  trackId: 't',
  start: 5 * S,
  inPoint: 2 * S,
  outPoint: 6 * S,
};

describe('resolveTrim — 영상', () => {
  it('왼쪽 끝을 줄이면 start와 inPoint가 함께 움직인다', () => {
    expect(resolveTrim(makeProject([clip]), 'c', 'start', 6 * S)).toEqual({
      start: 6 * S,
      inPoint: 3 * S,
      outPoint: 6 * S,
    });
  });

  it('오른쪽 끝을 줄이면 outPoint만 움직인다', () => {
    expect(resolveTrim(makeProject([clip]), 'c', 'end', 8 * S)).toEqual({
      start: 5 * S,
      inPoint: 2 * S,
      outPoint: 5 * S,
    });
  });

  it('원본 범위를 넘어 늘릴 수 없다', () => {
    const project = makeProject([clip]);

    // 원본 0 지점은 타임라인 3s, 원본 끝(10s)은 타임라인 13s
    expect(resolveTrim(project, 'c', 'start', 0)).toMatchObject({ start: 3 * S, inPoint: 0 });
    expect(resolveTrim(project, 'c', 'end', 20 * S)).toMatchObject({ outPoint: 10 * S });
  });

  it('최소 1프레임 길이를 유지한다', () => {
    const project = makeProject([clip]);

    expect(resolveTrim(project, 'c', 'start', 20 * S)).toMatchObject({ start: 9 * S - FRAME });
    expect(resolveTrim(project, 'c', 'end', 0)).toMatchObject({ outPoint: 2 * S + FRAME });
  });

  it('같은 트랙 이웃 클립의 경계에서 멈춘다', () => {
    const before: Clip = { ...clip, id: 'before', start: 0, inPoint: 0, outPoint: 4 * S };
    const after: Clip = { ...clip, id: 'after', start: 10 * S, inPoint: 0, outPoint: 2 * S };
    const project = makeProject([before, clip, after]);

    expect(resolveTrim(project, 'c', 'start', 0)).toMatchObject({ start: 4 * S, inPoint: S });
    expect(resolveTrim(project, 'c', 'end', 20 * S)).toMatchObject({ outPoint: 7 * S });
  });

  it('다른 트랙의 클립은 제한하지 않는다', () => {
    const other: Clip = { ...clip, id: 'other', trackId: 'other-track', start: 9 * S };
    const project = {
      ...makeProject([clip, other]),
      tracks: [
        { id: 't', kind: 'video' as const, order: 0 },
        { id: 'other-track', kind: 'video' as const, order: 1 },
      ],
    };

    expect(resolveTrim(project, 'c', 'end', 12 * S)).toMatchObject({ outPoint: 9 * S });
  });

  it('결과는 항상 정수 μs다', () => {
    expect(resolveTrim(makeProject([clip]), 'c', 'end', 7.3333333 * S)?.outPoint).toSatisfy(
      Number.isInteger,
    );
  });
});

describe('resolveTrim — 이미지', () => {
  const imageClip: Clip = {
    id: 'i',
    assetId: 'image',
    trackId: 't',
    start: 2 * S,
    inPoint: 0,
    outPoint: 5 * S,
  };

  it('원본 길이 제한 없이 늘릴 수 있다', () => {
    expect(resolveTrim(makeProject([imageClip]), 'i', 'end', 30 * S)).toEqual({
      start: 2 * S,
      inPoint: 0,
      outPoint: 28 * S,
    });
  });

  it('왼쪽으로 늘려도 inPoint는 0으로 유지한다', () => {
    expect(resolveTrim(makeProject([imageClip]), 'i', 'start', 0)).toEqual({
      start: 0,
      inPoint: 0,
      outPoint: 7 * S,
    });
  });
});

describe('resolveTrim — 예외', () => {
  it('없는 클립이면 null', () => {
    expect(resolveTrim(makeProject([]), 'missing', 'end', 0)).toBeNull();
  });
});
