import { describe, expect, it } from 'vitest';
import { containRect } from './fit.ts';

describe('containRect', () => {
  it('같은 비율이면 대상 영역을 꽉 채운다', () => {
    expect(containRect(1280, 720, 1920, 1080)).toEqual({ x: 0, y: 0, width: 1920, height: 1080 });
  });

  it('더 넓은 원본은 위아래에 여백을 둔다 (letterbox)', () => {
    expect(containRect(2000, 500, 1000, 500)).toEqual({ x: 0, y: 125, width: 1000, height: 250 });
  });

  it('더 좁은 원본은 좌우에 여백을 둔다 (pillarbox)', () => {
    expect(containRect(800, 600, 1920, 1080)).toEqual({ x: 240, y: 0, width: 1440, height: 1080 });
  });

  it('크기가 0이면 빈 사각형', () => {
    expect(containRect(0, 600, 1920, 1080)).toEqual({ x: 0, y: 0, width: 0, height: 0 });
    expect(containRect(800, 600, 0, 1080)).toEqual({ x: 0, y: 0, width: 0, height: 0 });
  });
});
