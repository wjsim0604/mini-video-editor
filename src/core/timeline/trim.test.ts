import { describe, expect, it } from 'vitest';
import {
  createEmptyProject,
  type Asset,
  type Clip,
  type Project,
  type TextOverlay,
} from '../project.ts';
import { resolveTrim } from './trim.ts';

const S = 1_000_000;
const FRAME = 33_333; // 30fps

const video: Asset = { id: 'video', type: 'video', name: 'v.mp4', duration: 10 * S };
const image: Asset = { id: 'image', type: 'image', name: 'i.png', duration: 5 * S };

function makeProject(clips: Clip[], overlays: TextOverlay[] = []): Project {
  return {
    ...createEmptyProject('p', 'test'),
    tracks: [
      { id: 't', kind: 'video', order: 0 },
      { id: 'other-track', kind: 'video', order: 1 },
      { id: 'text', kind: 'text', order: 2 },
    ],
    assets: [video, image],
    clips,
    overlays,
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
  it('왼쪽·오른쪽 끝을 옮긴다', () => {
    const project = makeProject([clip]);

    expect(resolveTrim(project, 'c', 'start', 6 * S)).toEqual({ start: 6 * S, end: 9 * S });
    expect(resolveTrim(project, 'c', 'end', 8 * S)).toEqual({ start: 5 * S, end: 8 * S });
  });

  it('원본 범위를 넘어 늘릴 수 없다', () => {
    const project = makeProject([clip]);

    // 원본 0 지점은 타임라인 3s, 원본 끝(10s)은 타임라인 13s
    expect(resolveTrim(project, 'c', 'start', 0)?.start).toBe(3 * S);
    expect(resolveTrim(project, 'c', 'end', 20 * S)?.end).toBe(13 * S);
  });

  it('최소 1프레임 길이를 유지한다', () => {
    const project = makeProject([clip]);

    expect(resolveTrim(project, 'c', 'start', 20 * S)?.start).toBe(9 * S - FRAME);
    expect(resolveTrim(project, 'c', 'end', 0)?.end).toBe(5 * S + FRAME);
  });

  it('같은 트랙 이웃 항목의 경계에서 멈추고, 다른 트랙은 제한하지 않는다', () => {
    const before: Clip = { ...clip, id: 'before', start: 0, inPoint: 0, outPoint: 4 * S };
    const after: Clip = { ...clip, id: 'after', start: 10 * S, inPoint: 0, outPoint: 2 * S };
    const elsewhere: Clip = { ...clip, id: 'elsewhere', trackId: 'other-track', start: 9 * S };
    const project = makeProject([before, clip, after, elsewhere]);

    expect(resolveTrim(project, 'c', 'start', 0)?.start).toBe(4 * S);
    expect(resolveTrim(project, 'c', 'end', 20 * S)?.end).toBe(10 * S);
  });

  it('결과는 항상 정수 μs다', () => {
    expect(resolveTrim(makeProject([clip]), 'c', 'end', 7.3333333 * S)?.end).toSatisfy(
      Number.isInteger,
    );
  });
});

describe('resolveTrim — 이미지·텍스트', () => {
  const imageClip: Clip = {
    id: 'i',
    assetId: 'image',
    trackId: 't',
    start: 2 * S,
    inPoint: 0,
    outPoint: 5 * S,
  };
  const text: TextOverlay = {
    id: 'x',
    trackId: 'text',
    start: 2 * S,
    duration: 3 * S,
    text: 'hi',
    style: { fontSize: 72, color: '#fff', x: 0, y: 0 },
  };

  it('원본 길이 제한 없이 늘릴 수 있다', () => {
    const project = makeProject([imageClip], [text]);

    expect(resolveTrim(project, 'i', 'end', 30 * S)).toEqual({ start: 2 * S, end: 30 * S });
    expect(resolveTrim(project, 'i', 'start', 0)).toEqual({ start: 0, end: 7 * S });
    expect(resolveTrim(project, 'x', 'end', 30 * S)).toEqual({ start: 2 * S, end: 30 * S });
  });
});

describe('resolveTrim — 예외', () => {
  it('없는 항목이면 null', () => {
    expect(resolveTrim(makeProject([]), 'missing', 'end', 0)).toBeNull();
  });
});
